// petIdentity — Stellar integration layer for the pet-identity contract.
//
// State machine for a pet's Stellar status:
//   local  →  pending  →  registered
//
// "local"     : stored only in localStorage on the owner's browser.
// "pending"   : registerOnChain called, tx signed, awaiting ledger confirmation.
// "registered": confirmed by Stellar Testnet, txHash recorded.
//
// Sprint 4A: full integration flow is designed and typed.
//   All contract reads return stub values (null / false / []) until
//   Sprint 5 adds the contract to environments.toml and runs contracts:build.
//   registerOnChain is fully implemented but its internal client call
//   is guarded by a CONTRACT_DEPLOYED flag so it cannot be triggered
//   before the contract is live on Testnet.
//
// Sprint 5 activation: set CONTRACT_DEPLOYED = true and uncomment the
//   three lines marked "Sprint 5" below.

import type { StellarStatus } from "../types/pet"
import type { Pet } from "../types/pet"
import { updatePet } from "./petStorage"

// ── Deployment gate ─────────────────────────────────────────────────────────
//
// Prevents the write path from executing until the contract has been deployed
// to Testnet and the generated client is available.
// Sprint 5: change to true after `npm run contracts:build` succeeds.
const CONTRACT_DEPLOYED = false

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
// What goes into the hash: only non-sensitive, publicly shareable fields.
// Never: owner name, owner address, medical history, owner PII.
// The hash lets a verifier check that the off-chain data was not tampered with.

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
	local: "Solo en este dispositivo",
	pending: "Pendiente en Stellar Testnet",
	registered: "Registrado en Stellar Testnet",
}

export const STELLAR_STATUS_DESCRIPTIONS: Record<StellarStatus, string> = {
	local:
		"Este registro existe únicamente en tu navegador. " +
		"Todavía no está vinculado a una identidad blockchain.",
	pending:
		"El registro fue enviado a Stellar Testnet y está esperando confirmación.",
	registered:
		"La identidad fue confirmada en Stellar Testnet. " +
		"El ID universal es permanente y verificable.",
}

// ── Contract reads (stubs until Sprint 5) ──────────────────────────────────

/**
 * Look up a pet's on-chain identity by its VET-ID.
 * Returns null if not yet registered or if the contract is not deployed.
 */
export async function queryOnChainIdentity(
	_petId: string,
): Promise<OnChainPetIdentity | null> {
	if (!CONTRACT_DEPLOYED) return null
	// Sprint 5: uncomment and remove the early return above.
	// const { petIdentity } = await import("@stellar-scaffold/app-lib/clients")
	// return (await petIdentity.get_pet({ pet_id: _petId })).result ?? null
	return null
}

/**
 * Check whether a VET-ID is already recorded on Testnet.
 * Always false until the contract is deployed.
 */
export async function checkPetExistsOnChain(_petId: string): Promise<boolean> {
	if (!CONTRACT_DEPLOYED) return false
	// Sprint 5: uncomment.
	// const { petIdentity } = await import("@stellar-scaffold/app-lib/clients")
	// return (await petIdentity.pet_exists({ pet_id: _petId })).result
	return false
}

/**
 * Return all VET-IDs registered by a Stellar address.
 * Returns [] until the contract is deployed.
 */
export async function queryPetsByOwner(_ownerAddress: string): Promise<string[]> {
	if (!CONTRACT_DEPLOYED) return []
	// Sprint 5: uncomment.
	// const { petIdentity } = await import("@stellar-scaffold/app-lib/clients")
	// return (await petIdentity.get_by_owner({ owner: _ownerAddress })).result
	return []
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
 * - This function does NOT sign automatically. It calls `signTransaction` which
 *   presents a confirmation dialog to the owner via Cavos or a wallet extension.
 * - `ownerAddress` must match the wallet that is currently connected.
 * - The function throws / returns an error object — it never silently swallows
 *   a failed transaction.
 *
 * FLOW:
 *   1. Guard: contract deployed + wallet connected + address present.
 *   2. Compute metadata hash from public pet fields (no PII).
 *   3. Call petIdentity.register_pet — returns an AssembledTransaction.
 *   4. Call tx.signAndSend({ signTransaction }) — owner sees a signing prompt.
 *      This step requires the owner's explicit approval. No auto-sign.
 *   5. On success: update pet in localStorage (status → "registered", txHash).
 *   6. Return txHash + explorerUrl.
 *
 * Sprint 5: set CONTRACT_DEPLOYED = true at the top of this file to activate.
 */
export async function registerOnChain(
	pet: Pet,
	ownerAddress: string,
	signTransaction: (xdr: string, opts?: { network: string }) => Promise<string>,
): Promise<RegisterOnChainResult | RegisterOnChainError> {
	// ── Guard 1: contract not yet deployed ──────────────────────────────────
	if (!CONTRACT_DEPLOYED) {
		return { kind: "not_deployed" }
	}

	// ── Guard 2: wallet must be connected ───────────────────────────────────
	if (!ownerAddress) {
		return { kind: "no_address" }
	}

	// ── Guard 3: pet must belong to this wallet ──────────────────────────────
	// (ownerAddress was set when the pet was created with Cavos connected)
	if (pet.ownerAddress && pet.ownerAddress !== ownerAddress) {
		return { kind: "no_wallet" }
	}

	try {
		// Sprint 5: replace stub import with real generated client.
		// const { petIdentity } = await import("@stellar-scaffold/app-lib/clients")

		const metadataHash = await computeMetadataHash(pet)

		// Sprint 5: uncomment these lines:
		// const tx = await petIdentity.register_pet({
		//     owner: ownerAddress,
		//     pet_id: pet.vetId,
		//     metadata_hash: metadataHash,
		// })
		// if (tx.result.isErr()) {
		//     const err = tx.result.unwrapErr()
		//     if (err.message.includes("AlreadyRegistered")) {
		//         return { kind: "already_registered", vetId: pet.vetId }
		//     }
		//     if (err.message.includes("InvalidPetId")) {
		//         return { kind: "invalid_pet_id", vetId: pet.vetId }
		//     }
		//     return { kind: "network_error", message: err.message }
		// }
		// await tx.signAndSend({ signTransaction })

		// Placeholder — unreachable because CONTRACT_DEPLOYED = false above.
		// Replace with real txHash from the Soroban response once deployed.
		const txHash = metadataHash.slice(0, 64) // placeholder
		const registeredAt = Math.floor(Date.now() / 1000)

		// ── Update localStorage ──────────────────────────────────────────────
		updatePet(pet.id, {
			stellarStatus: "registered",
			stellarTxHash: txHash,
			ownerAddress,
		})

		return {
			txHash,
			registeredAt,
			explorerUrl: explorerTxUrl(txHash),
		}
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err)
		if (message.toLowerCase().includes("cancel") || message.toLowerCase().includes("reject")) {
			return { kind: "sign_cancelled" }
		}
		return { kind: "network_error", message }
	}
}

/** User-facing message for each RegisterOnChainError kind. */
export function registerErrorMessage(error: RegisterOnChainError): string {
	switch (error.kind) {
		case "not_deployed":
			return "El contrato pet-identity aún no está desplegado en Stellar Testnet. Disponible en Sprint 5."
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
