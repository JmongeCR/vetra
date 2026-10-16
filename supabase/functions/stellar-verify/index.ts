// stellar-verify — Supabase Edge Function (Sprint 5F / 5F.1)
//
// Server-side verification of Stellar Testnet pet identities.
// This function is the ONLY authorized path to transition a pet's
// stellar_identities row from 'pending' → 'registered'.
//
// Security model:
//   1. Authenticate caller via local HS256 JWT verification (djwt@v3.0.2,
//      same library as auth-verify). DOES NOT call admin.auth.getUser —
//      our JWTs are issued by auth-verify, not GoTrue. JWT_SECRET is the
//      same secret used to sign the token at login time.
//   2. Verify the caller is a guardian of the pet in PostgreSQL (service_role).
//   3. For action="confirm": verify the transaction on Stellar Testnet via
//      Horizon API (exists + successful) before querying the contract.
//   4. Query the deployed Soroban contract on Testnet via simulateTransaction
//      (get_pet) to read current on-chain state.
//   5. Verify on-chain owner === caller's Stellar address.
//   6. Verify on-chain metadata_hash === hash stored at claim time.
//   7. Write status='registered' to stellar_identities via service_role.
//      No client can call this write directly — authenticated role revoked
//      in migration 20261016300000.
//
// Actions:
//   "confirm" — pet was just registered; caller supplies txHash.
//               Horizon verifies the TX; hash is stored for audit purposes.
//   "recover" — pet is stuck in pending; no txHash available.
//               transaction_hash remains NULL; contract state is authoritative.
//
// POST /functions/v1/stellar-verify
// Headers: Authorization: Bearer <jwt>
// Body: { petId: string, action: "confirm", txHash: string }
//    or { petId: string, action: "recover" }

import {
	Contract,
	Networks,
	Keypair,
	Account,
	TransactionBuilder,
	BASE_FEE,
	nativeToScVal,
	scValToNative,
	Address,
} from "npm:@stellar/stellar-sdk@^16"
import * as SorobanRpc from "npm:@stellar/stellar-sdk@^16/rpc"
import { createClient } from "npm:@supabase/supabase-js@^2"
import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { verifyVetraJwt, verifyHorizonTx } from "./_helpers.ts"

// ── Constants ────────────────────────────────────────────────────────────────

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
// JWT_SECRET is set via `supabase secrets set JWT_SECRET=...`
// It is the same secret used by auth-verify to sign tokens.
const JWT_SECRET = Deno.env.get("JWT_SECRET")

const CONTRACT_ID = "CAWA6S352RZWOPZENPU4C5KKLC47BQKT5OAIOVALIVK3YLLFWDH7ZBYJ"
const TESTNET_RPC = "https://soroban-testnet.stellar.org"

const CORS = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Headers": "content-type, authorization",
}

// ── Response helpers ─────────────────────────────────────────────────────────

function ok(data: Record<string, unknown> = {}): Response {
	return new Response(JSON.stringify({ ok: true, ...data }), {
		headers: { ...CORS, "Content-Type": "application/json" },
	})
}

function fail(status: number, error: string, extra: Record<string, unknown> = {}): Response {
	return new Response(JSON.stringify({ error, ...extra }), {
		status,
		headers: { ...CORS, "Content-Type": "application/json" },
	})
}

// ── Stellar contract query ───────────────────────────────────────────────────

interface OnChainIdentity {
	owner: string
	metadata_hash: string
}

async function queryContract(vetId: string): Promise<OnChainIdentity | null> {
	const server = new SorobanRpc.Server(TESTNET_RPC)
	const contract = new Contract(CONTRACT_ID)

	// Throwaway keypair — simulateTransaction does not submit; source account
	// does not need to exist on-chain.
	const source = new Account(Keypair.random().publicKey(), "0")

	const tx = new TransactionBuilder(source, {
		fee: BASE_FEE,
		networkPassphrase: Networks.TESTNET,
	})
		.addOperation(
			contract.call("get_pet", nativeToScVal(vetId, { type: "string" })),
		)
		.setTimeout(30)
		.build()

	const sim = await server.simulateTransaction(tx)

	if (SorobanRpc.Api.isSimulationError(sim)) {
		console.error("[stellar-verify] get_pet simulation error:", sim.error)
		return null
	}

	const retval = sim.result?.retval
	if (!retval) return null

	// Option<PetIdentity>: scvVoid = None, ScMap = Some(identity)
	if (retval.switch().name === "scvVoid") return null

	// scValToNative decodes the Soroban struct to a plain JS object.
	// PetIdentity { owner: Address, registered_at: u64, metadata_hash: String }
	const native = scValToNative(retval) as Record<string, unknown>

	const ownerRaw = native["owner"]
	const hashRaw = native["metadata_hash"]

	let owner: string
	if (typeof ownerRaw === "string") {
		owner = ownerRaw
	} else if (ownerRaw instanceof Address) {
		owner = ownerRaw.toString()
	} else {
		console.error("[stellar-verify] Unexpected owner type:", typeof ownerRaw)
		return null
	}

	let metadata_hash: string
	if (typeof hashRaw === "string") {
		metadata_hash = hashRaw
	} else if (hashRaw instanceof Uint8Array || ArrayBuffer.isView(hashRaw)) {
		metadata_hash = new TextDecoder().decode(hashRaw as Uint8Array)
	} else {
		console.error("[stellar-verify] Unexpected metadata_hash type:", typeof hashRaw)
		return null
	}

	return { owner, metadata_hash }
}

// ── Main handler ─────────────────────────────────────────────────────────────

serve(async (req: Request) => {
	if (req.method === "OPTIONS") {
		return new Response(null, { status: 204, headers: CORS })
	}
	if (req.method !== "POST") {
		return fail(405, "Method not allowed")
	}

	// Required env vars — fail loudly if absent
	if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !JWT_SECRET) {
		console.error("[stellar-verify] Missing required env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, JWT_SECRET")
		return fail(503, "Server configuration error")
	}

	// ── Step 1: Extract and locally verify JWT ─────────────────────────────────
	// We verify the JWT ourselves using JWT_SECRET (same as auth-verify used to
	// sign it). This avoids relying on admin.auth.getUser(), which calls GoTrue
	// and may reject custom JWTs issued outside of GoTrue's sign-up flow.
	const authHeader = req.headers.get("Authorization")
	if (!authHeader?.startsWith("Bearer ")) {
		return fail(401, "Missing authorization")
	}
	const token = authHeader.slice(7)

	let authUserId: string
	let stellarAddress: string
	try {
		const payload = await verifyVetraJwt(token, JWT_SECRET)
		authUserId = payload.sub
		stellarAddress = payload.user_metadata.stellar_address
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err)
		console.warn("[stellar-verify] JWT verification failed:", msg)
		return fail(401, "Invalid or expired token")
	}

	// ── Step 2: Parse and validate request body ─────────────────────────────────
	let body: { petId?: string; action?: string; txHash?: string }
	try {
		body = await req.json()
	} catch {
		return fail(400, "Invalid JSON")
	}

	const { petId, action, txHash } = body

	if (!petId || typeof petId !== "string") {
		return fail(400, "Missing or invalid petId")
	}
	if (action !== "confirm" && action !== "recover") {
		return fail(400, "action must be 'confirm' or 'recover'")
	}
	if (action === "confirm") {
		if (!txHash || typeof txHash !== "string") {
			return fail(400, "Missing txHash for confirm action")
		}
		if (!/^[0-9a-f]{64}$/.test(txHash)) {
			return fail(400, "Invalid txHash: must be 64 lowercase hex characters")
		}
	}

	// ── Step 3: Create service_role client ────────────────────────────────────
	// SECURITY: SERVICE_ROLE_KEY never leaves this function. It is injected by
	// Supabase at runtime and is never returned in any response body or header.
	const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
		auth: { autoRefreshToken: false, persistSession: false },
	})

	// ── Step 4: Verify guardian relationship ───────────────────────────────────
	// service_role bypasses RLS — we enforce authorization explicitly.
	const { count: guardianCount, error: guardianErr } = await admin
		.from("pet_guardians")
		.select("pet_id, profiles!inner(auth_user_id)", { count: "exact", head: true })
		.eq("pet_id", petId)
		.eq("profiles.auth_user_id", authUserId)

	if (guardianErr || !guardianCount || guardianCount === 0) {
		return fail(403, "Not authorized for this pet")
	}

	// ── Step 5: Fetch stellar_identities + vet_id ──────────────────────────────
	const { data: record, error: recErr } = await admin
		.from("stellar_identities")
		.select("status, metadata_hash, pets!inner(vet_id)")
		.eq("pet_id", petId)
		.eq("status", "pending")
		.single()

	if (recErr || !record) {
		return fail(409, "Pet is not in pending status")
	}

	const vetId: string = (record.pets as { vet_id: string }).vet_id
	const storedHash: string | null = record.metadata_hash as string | null

	// ── Step 6 (confirm only): Verify transaction via Horizon ─────────────────
	// For "recover", there is no txHash — skip Horizon, go straight to contract.
	if (action === "confirm") {
		const horizonResult = await verifyHorizonTx(txHash as string)
		if (!horizonResult.ok) {
			console.warn("[stellar-verify] Horizon verification failed:", horizonResult.reason)
			const isNotFound = horizonResult.reason?.includes("not found")
			return fail(
				isNotFound ? 404 : 422,
				isNotFound ? "tx_not_found" : "tx_failed",
				{ detail: horizonResult.reason },
			)
		}
	}

	// ── Step 7: Query Stellar Testnet contract ─────────────────────────────────
	let onChain: OnChainIdentity | null
	try {
		onChain = await queryContract(vetId)
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err)
		console.error("[stellar-verify] Contract query failed:", msg)
		return fail(502, "Stellar RPC unavailable", { detail: msg })
	}

	if (!onChain) {
		return fail(404, "not_found")
	}

	// ── Step 8: Verify on-chain owner ─────────────────────────────────────────
	if (onChain.owner !== stellarAddress) {
		return fail(409, "conflict_owner", { onChainOwner: onChain.owner })
	}

	// ── Step 9: Verify metadata_hash ──────────────────────────────────────────
	// Compare on-chain hash with the hash reserved at claim time.
	// If storedHash is null (Supabase not configured in claim flow), skip.
	if (storedHash !== null && onChain.metadata_hash !== storedHash) {
		return fail(409, "conflict_hash", {
			onChainHash: onChain.metadata_hash,
			storedHash,
		})
	}

	// ── Step 10: Update stellar_identities via service_role ───────────────────
	// Optimistic lock: WHERE status = 'pending' prevents double-confirmation.
	const updatePayload =
		action === "confirm"
			? {
					status: "registered",
					transaction_hash: txHash,
					contract_id: CONTRACT_ID,
					registered_at: new Date().toISOString(),
					updated_at: new Date().toISOString(),
				}
			: {
					status: "registered",
					contract_id: CONTRACT_ID,
					registered_at: new Date().toISOString(),
					updated_at: new Date().toISOString(),
					// transaction_hash stays NULL for recovery — no verified TX hash available
				}

	const { error: updateErr, count: updateCount } = await admin
		.from("stellar_identities")
		.update(updatePayload)
		.eq("pet_id", petId)
		.eq("status", "pending")
		.select("pet_id", { count: "exact", head: true })

	if (updateErr) {
		console.error("[stellar-verify] Update failed:", updateErr.message)
		return fail(500, "Failed to update registration status")
	}

	if (!updateCount || updateCount === 0) {
		// Another concurrent request already confirmed this pet
		return ok({ alreadyRegistered: true })
	}

	return ok()
})
