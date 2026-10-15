// auth-challenge — Supabase Edge Function (Sprint 4.1)
//
// Issues a short-lived, single-use challenge that the browser will sign with
// the user's Stellar wallet (Cavos).
//
// Design decisions (Sprint 4.1):
//   - Challenge nonce is stored server-side in `auth_challenges` table.
//   - ManageData value = nonce UUID (36 bytes ≤ 64-byte Stellar limit).
//   - Single-use enforced via DB: consumed_at is set atomically in auth-verify.
//   - No HMAC fallback secret — fails loudly if env vars are missing.
//   - Sequence "0" → incremented to "1" → cannot be submitted to any real account.
//
// POST /functions/v1/auth-challenge
// Body: { address: string }
// Response: { nonce: string, expires_at: number, xdr: string }

import { TransactionBuilder, Networks, Operation, Account } from "npm:@stellar/stellar-sdk@^16"
import { createClient } from "npm:@supabase/supabase-js@^2"
import { serve } from "https://deno.land/std@0.224.0/http/server.ts"

const CHALLENGE_TTL_SECONDS = 300 // 5 minutes

// Required env vars — fail loudly if missing (no insecure fallbacks)
const SUPABASE_URL         = Deno.env.get("SUPABASE_URL")
const SERVICE_ROLE_KEY     = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

const CORS = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Headers": "content-type, authorization",
}

function json(data: unknown, status = 200): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: { ...CORS, "Content-Type": "application/json" },
	})
}

serve(async (req) => {
	if (req.method === "OPTIONS") {
		return new Response(null, { status: 204, headers: CORS })
	}
	if (req.method !== "POST") {
		return new Response("Method not allowed", { status: 405, headers: CORS })
	}

	// Fail loudly if required secrets are absent — never use insecure defaults.
	if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
		console.error("[auth-challenge] Missing required env vars: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
		return json({ error: "Server configuration error" }, 503)
	}

	let address: string
	try {
		const body = await req.json()
		address = body.address
		if (typeof address !== "string" || !address.startsWith("G") || address.length !== 56) {
			throw new Error("invalid address")
		}
	} catch {
		return json({ error: "Invalid address" }, 400)
	}

	const nonce = crypto.randomUUID()
	const now = Math.floor(Date.now() / 1000)
	const expires_at = now + CHALLENGE_TTL_SECONDS

	// Store the challenge server-side (single-use enforcement in auth-verify).
	const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
		auth: { autoRefreshToken: false, persistSession: false },
	})
	const { error: insertErr } = await admin.from("auth_challenges").insert({
		nonce,
		address,
		expires_at: new Date(expires_at * 1000).toISOString(),
	})
	if (insertErr) {
		console.error("[auth-challenge] Failed to store challenge:", insertErr.message)
		return json({ error: "Failed to create challenge" }, 500)
	}

	// Build the ManageData challenge transaction.
	// - source = the claimant's address (proves intent; source is checked in auth-verify)
	// - sequence "0" → incremented to "1" → this sequence is invalid for any real account
	// - ManageData name = "vetra:auth" (identifier), value = nonce UUID (36 bytes ≤ 64)
	// - networkPassphrase = TESTNET → cannot be replayed on mainnet
	const account = new Account(address, "0")
	const tx = new TransactionBuilder(account, {
		fee: "100",
		networkPassphrase: Networks.TESTNET,
	})
		.addOperation(Operation.manageData({
			name: "vetra:auth",
			value: nonce,  // UUID = 36 bytes, well within the 64-byte limit
		}))
		.setTimeout(CHALLENGE_TTL_SECONDS)
		.build()

	return json({ nonce, expires_at, xdr: tx.toXDR() })
})
