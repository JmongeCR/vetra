// petIdentity — Stellar integration layer for the pet-identity contract.
//
// State machine for a pet's Stellar status:
//   local  →  pending  →  registered
//
// "local"     : stored only in Supabase/localStorage on the owner's device.
// "pending"   : claimStellarPending called, tx signed, awaiting ledger confirmation.
// "registered": confirmed by Stellar Testnet, txHash recorded.
//
// Activation: CONTRACT_DEPLOYED = true after verifying the deployed
//   contract at CAWA6S352RZWOPZENPU4C5KKLC47BQKT5OAIOVALIVK3YLLFWDH7ZBYJ.

import type { StellarStatus } from "../types/pet"
import type { Pet } from "../types/pet"
import type { SignTransactionFn } from "../cavos/context"
import { supabaseConfigured, supabaseFunctionsUrl, getSupabaseAccessToken } from "../lib/supabase"
import { fundAccount } from "@stellar-scaffold/app-lib"
import {
	claimStellarPending,
	rollbackStellarPending,
} from "./petDb"

// ── Deployment gate ─────────────────────────────────────────────────────────

const CONTRACT_DEPLOYED = true

const PET_IDENTITY_CONTRACT_ID = "CAWA6S352RZWOPZENPU4C5KKLC47BQKT5OAIOVALIVK3YLLFWDH7ZBYJ"

// ── Network constants ───────────────────────────────────────────────────────

const TESTNET_EXPLORER = "https://stellar.expert/explorer/testnet"

/** Build a Stellar Expert link to a transaction on Testnet. */
export function explorerTxUrl(txHash: string): string {
	return `${TESTNET_EXPLORER}/tx/${txHash}`
}

/** Build a Stellar Expert link to an account on Testnet. */
export function explorerAccountUrl(address: string): string {
	return `${TESTNET_EXPLORER}/account/${address}`
}

// ── Types matching the on-chain PetIdentity struct ──────────────────────────

export interface OnChainPetIdentity {
	owner: string       // Stellar address
	registeredAt: number // unix seconds
	metadataHash: string // SHA-256 hex of off-chain metadata JSON
}

// ── Metadata hash ───────────────────────────────────────────────────────────
//
// Only non-sensitive, publicly shareable fields go into the hash.
// Never: owner name, owner address, medical history, owner PII.

export interface PetPublicMetadata {
	vetId: string
	species: string
	breed?: string
	sex: string
	birthDate?: string
	birthDateEstimated: boolean
	color: string
	microchip?: string
}

/** Compute the SHA-256 hex of the public metadata JSON for a pet. */
export async function computeMetadataHash(pet: Pet): Promise<string> {
	const payload: PetPublicMetadata = {
		vetId: pet.vetId,
		species: pet.species,
		breed: pet.breed,
		sex: pet.sex,
		birthDate: pet.birthDate,
		birthDateEstimated: pet.birthDateEstimated,
		color: pet.color,
		microchip: pet.microchip,
	}
	// Stable serialization: sorted keys so the hash is deterministic.
	const json = JSON.stringify(payload, Object.keys(payload).sort())
	const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(json))
	return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("")
}

// ── Status helpers ──────────────────────────────────────────────────────────

export const STELLAR_STATUS_LABELS: Record<StellarStatus, string> = {
	local: "Registrada en Vetra",
	pending: "Pendiente en Stellar Testnet",
	registered: "Registrada en Stellar Testnet",
}

export const STELLAR_STATUS_DESCRIPTIONS: Record<StellarStatus, string> = {
	local:
		"Este registro existe en Vetra. " +
		"Todavía no está vinculado a una identidad blockchain.",
	pending:
		"El registro fue enviado a Stellar Testnet y está esperando confirmación.",
	registered:
		"La identidad fue confirmada en Stellar Testnet. " +
		"El ID universal es permanente y verificable.",
}

// ── Contract reads ──────────────────────────────────────────────────────────

/**
 * Look up a pet's on-chain identity by its VET-ID.
 * Returns null if not yet registered or the contract is not deployed.
 */
export async function queryOnChainIdentity(
	petId: string,
): Promise<OnChainPetIdentity | null> {
	if (!CONTRACT_DEPLOYED) return null
	const { petIdentity } = await import("@stellar-scaffold/app-lib/clients")
	const raw = (await petIdentity.get_pet({ pet_id: petId })).result
	if (!raw) return null
	return {
		owner: raw.owner,
		registeredAt: Number(raw.registered_at),
		metadataHash: raw.metadata_hash,
	}
}

/**
 * Check whether a VET-ID is already recorded on Testnet.
 * Always false until the contract is deployed.
 */
export async function checkPetExistsOnChain(petId: string): Promise<boolean> {
	if (!CONTRACT_DEPLOYED) return false
	const { petIdentity } = await import("@stellar-scaffold/app-lib/clients")
	return (await petIdentity.pet_exists({ pet_id: petId })).result
}

/**
 * Return all VET-IDs registered by a Stellar address.
 * Returns [] until the contract is deployed.
 */
export async function queryPetsByOwner(ownerAddress: string): Promise<string[]> {
	if (!CONTRACT_DEPLOYED) return []
	const { petIdentity } = await import("@stellar-scaffold/app-lib/clients")
	return (await petIdentity.get_by_owner({ owner: ownerAddress })).result
}

// ── Contract write — register on Testnet ───────────────────────────────────

/** Result returned when a registration transaction is confirmed. */
export interface RegisterOnChainResult {
	txHash: string
	registeredAt: number // unix seconds, from the ledger response
	explorerUrl: string
}

/**
 * Errors that can occur during on-chain registration.
 * The UI maps these to user-facing messages.
 */
export type RegisterOnChainError =
	| { kind: "not_deployed" }
	| { kind: "no_wallet" }
	| { kind: "no_address" }
	| { kind: "already_registered"; vetId: string }
	| { kind: "invalid_pet_id"; vetId: string }
	| { kind: "sign_cancelled" }
	| { kind: "network_error"; message: string }

/**
 * Register a pet's identity on Stellar Testnet.
 *
 * SECURITY CONSTRAINTS:
 * - `signTransaction` must come from `useWallet()` — never imported directly.
 * - Calls `claimStellarPending` (Supabase RPC) before presenting the signing
 *   prompt, preventing duplicate registrations from concurrent tabs.
 * - Never signs automatically. The owner sees a Cavos confirmation dialog.
 * - Calls `confirmStellarRegistration` on success, `rollbackStellarPending`
 *   on any failure, maintaining the local→pending→registered state machine.
 */
export async function registerOnChain(
	pet: Pet,
	ownerAddress: string,
	signTransaction: SignTransactionFn,
): Promise<RegisterOnChainResult | RegisterOnChainError> {
	if (!CONTRACT_DEPLOYED) return { kind: "not_deployed" }
	if (!ownerAddress) return { kind: "no_address" }
	if (pet.ownerAddress && pet.ownerAddress !== ownerAddress) return { kind: "no_wallet" }

	const metadataHash = await computeMetadataHash(pet)

	try {
		// Reserve the slot atomically before the owner sees the signing prompt.
		// Prevents a second tab from triggering a duplicate registration.
		if (supabaseConfigured) {
			await claimStellarPending(pet.id, metadataHash)
		}

		const { petIdentity: client } = await import("@stellar-scaffold/app-lib/clients")

		const buildTx = () =>
			client.register_pet(
				{
					owner: ownerAddress,
					pet_id: pet.vetId,
					metadata_hash: metadataHash,
				},
				{ publicKey: ownerAddress },
			)

		// On Testnet a fresh Cavos wallet may not have been funded yet.
		// If the Stellar account doesn't exist, fund it via Friendbot once and retry.
		let tx = await buildTx().catch(async (err: unknown) => {
			const msg = err instanceof Error ? err.message : String(err)
			if (!msg.includes("Account not found")) throw err
			const funded = await fundAccount(ownerAddress)
			if (!funded.ok) throw new Error(`Account not found and Friendbot failed: ${funded.message}`)
			return buildTx()
		})

		if (tx.result.isErr()) {
			if (supabaseConfigured) {
				await rollbackStellarPending(pet.id).catch(() => {})
			}
			const err = tx.result.unwrapErr()
			if (err.message.includes("AlreadyRegistered")) {
				return { kind: "already_registered", vetId: pet.vetId }
			}
			if (err.message.includes("InvalidPetId")) {
				return { kind: "invalid_pet_id", vetId: pet.vetId }
			}
			return { kind: "network_error", message: err.message }
		}

		const sent = await tx.signAndSend({ signTransaction })

		// signAndSend does NOT throw on ledger FAILED — must check explicitly.
		if (sent.getTransactionResponse && sent.getTransactionResponse.status !== "SUCCESS") {
			if (supabaseConfigured) {
				await rollbackStellarPending(pet.id).catch(() => {})
			}
			return { kind: "network_error", message: `Transaction failed on ledger (status: ${sent.getTransactionResponse.status})` }
		}

		const txHash = sent.sendTransactionResponse?.hash ?? ""

		// Confirm via Edge Function — server verifies on-chain state before writing.
		if (supabaseConfigured) {
			const confirmResult = await callStellarVerify({
				petId: pet.id,
				action: "confirm",
				txHash,
			})
			if (!confirmResult.ok) {
				await rollbackStellarPending(pet.id).catch(() => {})
				return { kind: "network_error", message: confirmResult.error ?? "Verification failed" }
			}
		}

		return {
			txHash,
			registeredAt: Math.floor(Date.now() / 1000),
			explorerUrl: explorerTxUrl(txHash),
		}
	} catch (err) {
		if (supabaseConfigured) {
			await rollbackStellarPending(pet.id).catch(() => {})
		}
		const message = err instanceof Error ? err.message : String(err)
		if (message.toLowerCase().includes("cancel") || message.toLowerCase().includes("reject")) {
			return { kind: "sign_cancelled" }
		}
		return { kind: "network_error", message }
	}
}

// ── Edge Function client ────────────────────────────────────────────────────

interface StellarVerifyResponse {
	ok: boolean
	error?: string
	onChainOwner?: string
	onChainHash?: string
	storedHash?: string
	alreadyRegistered?: boolean
}

/**
 * Call the stellar-verify Edge Function.
 * Sends the user's JWT automatically via getSupabaseAccessToken().
 * Never throws — returns { ok: false, error: "..." } on any failure.
 */
async function callStellarVerify(
	payload: { petId: string; action: "confirm"; txHash: string } | { petId: string; action: "recover" },
): Promise<StellarVerifyResponse> {
	if (!supabaseFunctionsUrl) return { ok: false, error: "Supabase not configured" }
	const token = getSupabaseAccessToken()
	if (!token) return { ok: false, error: "Not authenticated" }

	try {
		const res = await fetch(`${supabaseFunctionsUrl}/stellar-verify`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${token}`,
			},
			body: JSON.stringify(payload),
		})
		const body = await res.json() as StellarVerifyResponse
		return { ...body, ok: res.ok }
	} catch (err) {
		return { ok: false, error: err instanceof Error ? err.message : String(err) }
	}
}

// ── Pending state recovery ──────────────────────────────────────────────────

/**
 * Result of verifying an on-chain identity and recovering a pending registration.
 *
 * - "registered": Edge Function verified on-chain state and confirmed in Supabase.
 * - "not_found": VET-ID is not on Stellar Testnet yet.
 * - "conflict_owner": on-chain identity belongs to a different Stellar address.
 * - "conflict_hash": owner matches but metadata_hash differs from claim-time value.
 * - "not_deployed": CONTRACT_DEPLOYED is false; verification unavailable.
 * - "error": network or unexpected error.
 */
export type RecoveryResult =
	| { kind: "registered" }
	| { kind: "not_found" }
	| { kind: "conflict_owner"; onChainOwner: string }
	| { kind: "conflict_hash"; onChainHash: string; storedHash: string }
	| { kind: "not_deployed" }
	| { kind: "error"; message: string }

/**
 * Verify a pet's on-chain status and recover its Supabase record via the
 * stellar-verify Edge Function.
 *
 * All on-chain verification (pet_exists, get_pet, owner check, hash check)
 * happens server-side. The client only triggers the action and handles the result.
 *
 * SECURITY: The Edge Function is the sole write path to status='registered'.
 *           This function cannot promote a pet without server-side on-chain proof.
 */
export async function verifyAndRecoverPending(
	pet: Pet,
	_ownerAddress: string,
): Promise<RecoveryResult> {
	if (!CONTRACT_DEPLOYED) return { kind: "not_deployed" }

	const result = await callStellarVerify({ petId: pet.id, action: "recover" })

	if (result.ok) return { kind: "registered" }

	switch (result.error) {
		case "not_found":
			return { kind: "not_found" }
		case "conflict_owner":
			return { kind: "conflict_owner", onChainOwner: result.onChainOwner ?? "" }
		case "conflict_hash":
			return {
				kind: "conflict_hash",
				onChainHash: result.onChainHash ?? "",
				storedHash: result.storedHash ?? "",
			}
		default:
			return { kind: "error", message: result.error ?? "Unknown error" }
	}
}

/** User-facing message for each RecoveryResult kind. */
export function recoveryMessage(result: RecoveryResult): string {
	switch (result.kind) {
		case "registered":
			return "La identidad fue encontrada en Stellar Testnet y el registro fue recuperado."
		case "not_found":
			return "La identidad no está registrada en Stellar Testnet todavía."
		case "conflict_owner":
			return `Conflicto: la identidad en Stellar pertenece a la dirección ${result.onChainOwner.slice(0, 6)}…${result.onChainOwner.slice(-4)}, no a tu billetera.`
		case "conflict_hash":
			return "Conflicto: el hash de metadatos en Stellar no coincide con el registrado en Vetra. Posible inconsistencia de datos."
		case "not_deployed":
			return "La verificación on-chain aún no está disponible (contrato no activado)."
		case "error":
			return `Error al verificar: ${result.message}`
	}
}

/** User-facing message for each RegisterOnChainError kind. */
export function registerErrorMessage(error: RegisterOnChainError): string {
	switch (error.kind) {
		case "not_deployed":
			return "El contrato pet-identity aún no está disponible en Stellar Testnet."
		case "no_wallet":
			return "La billetera conectada no coincide con el propietario de esta mascota."
		case "no_address":
			return "Conectá tu billetera antes de registrar la identidad en Stellar."
		case "already_registered":
			return `El identificador ${error.vetId} ya está registrado en Stellar Testnet.`
		case "invalid_pet_id":
			return `El identificador ${error.vetId} no es válido.`
		case "sign_cancelled":
			return "La firma de la transacción fue cancelada."
		case "network_error":
			return `Error de red: ${error.message}`
	}
}
