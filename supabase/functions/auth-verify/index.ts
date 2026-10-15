// auth-verify — Supabase Edge Function (Sprint 4.1)
//
// Verifies a Stellar-signed challenge transaction and issues a Supabase session.
//
// Security chain (all steps must pass):
//   1. Validate input fields.
//   2. Look up the nonce in `auth_challenges` — issued by us, for this address.
//   3. Verify the challenge has not expired.
//   4. Verify the challenge has not already been consumed (single-use).
//   5. Parse the signed XDR on TESTNET passphrase.
//   6. Verify the transaction source = claimed address.
//   7. Verify there is exactly one operation: ManageData "vetra:auth" with value = nonce.
//   8. Verify the Stellar cryptographic signature.
//   9. Mark the nonce consumed (atomic — prevents replay within the same request).
//  10. Create or get the Supabase Auth user and profile.
//  11. Issue a Supabase-compatible JWT.
//
// POST /functions/v1/auth-verify
// Body: { address: string, nonce: string, expires_at: number, signedXdr: string }

import {
	TransactionBuilder,
	Networks,
	Keypair,
} from "npm:@stellar/stellar-sdk@^16"
import { createClient } from "npm:@supabase/supabase-js@^2"
import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { create as createJWT } from "https://deno.land/x/djwt@v3.0.2/mod.ts"

// Required env vars — no insecure fallbacks.
const SUPABASE_URL       = Deno.env.get("SUPABASE_URL")
const SERVICE_ROLE_KEY   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
// SUPABASE_ prefix is reserved by Supabase — set as JWT_SECRET via supabase secrets set
const JWT_SECRET         = Deno.env.get("JWT_SECRET")

const JWT_TTL = 3600 // 1 hour

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

	// Fail loudly if any required secret is absent.
	if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !JWT_SECRET) {
		console.error("[auth-verify] Missing required env vars")
		return json({ error: "Server configuration error" }, 503)
	}

	// ── Step 1: Validate request body ───────────────────────────────────────────
	let body: { address: string; nonce: string; expires_at: number; signedXdr: string }
	try {
		body = await req.json()
		const { address, nonce, expires_at, signedXdr } = body
		if (
			typeof address !== "string" || !address.startsWith("G") || address.length !== 56 ||
			typeof nonce !== "string" || nonce.length !== 36 ||
			typeof expires_at !== "number" ||
			typeof signedXdr !== "string" || signedXdr.length === 0
		) {
			throw new Error("invalid fields")
		}
	} catch {
		return json({ error: "Invalid request body" }, 400)
	}

	const { address, nonce, expires_at, signedXdr } = body

	const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
		auth: { autoRefreshToken: false, persistSession: false },
	})

	// ── Steps 2–4: Look up and validate the stored challenge ─────────────────────
	const { data: challenge, error: lookupErr } = await admin
		.from("auth_challenges")
		.select("nonce, address, expires_at, consumed_at")
		.eq("nonce", nonce)
		.eq("address", address)
		.maybeSingle()

	if (lookupErr || !challenge) {
		return json({ error: "Challenge not found" }, 401)
	}

	// Step 3: Check expiry (server-side, not trusting client-supplied expires_at)
	if (new Date() > new Date(challenge.expires_at)) {
		return json({ error: "Challenge expired" }, 401)
	}

	// Step 4: Check single-use
	if (challenge.consumed_at !== null) {
		return json({ error: "Challenge already used" }, 401)
	}

	// ── Steps 5–8: Verify the Stellar signature ──────────────────────────────────
	try {
		// Step 5: Parse on TESTNET passphrase — mainnet XDR will fail here
		const tx = TransactionBuilder.fromXDR(signedXdr, Networks.TESTNET)

		// Step 6: Transaction source must match the claimed address
		if (tx.source !== address) {
			return json({ error: "Address mismatch" }, 401)
		}

		// Step 7a: Exactly one operation
		if (tx.operations.length !== 1) {
			return json({ error: "Unexpected operation count" }, 401)
		}

		// Step 7b: Operation must be ManageData "vetra:auth"
		const op = tx.operations[0]
		if (op.type !== "manageData" || op.name !== "vetra:auth") {
			return json({ error: "Unexpected transaction content" }, 401)
		}

		// Step 7c: ManageData value must be exactly the nonce we issued
		// op.value is a Buffer in stellar-sdk — decode as UTF-8
		const opValue = op.value ? new TextDecoder().decode(op.value as Uint8Array) : ""
		if (opValue !== nonce) {
			return json({ error: "Nonce mismatch in transaction" }, 401)
		}

		// Step 8: Cryptographic signature verification
		const keypair = Keypair.fromPublicKey(address)
		const txHash = tx.hash()
		const sigs = tx.signatures
		if (sigs.length === 0) {
			return json({ error: "No signature found" }, 401)
		}
		const validSig = sigs.some((s) => {
			try {
				return keypair.verify(txHash, s.signature())
			} catch {
				return false
			}
		})
		if (!validSig) {
			return json({ error: "Signature verification failed" }, 401)
		}
	} catch (err) {
		// Don't leak internal error details
		console.error("[auth-verify] Stellar verification error:", err)
		return json({ error: "Transaction verification failed" }, 401)
	}

	// ── Step 9: Mark nonce consumed (prevents replay) ────────────────────────────
	// .select() returns the updated rows; an empty array means a concurrent
	// request already consumed this nonce (race condition). Only the request
	// that updates the row (changing consumed_at from NULL) gets data.length > 0.
	const { data: consumed, error: consumeErr } = await admin
		.from("auth_challenges")
		.update({ consumed_at: new Date().toISOString() })
		.eq("nonce", nonce)
		.is("consumed_at", null)
		.select("nonce")

	if (consumeErr) {
		console.error("[auth-verify] Failed to consume nonce:", consumeErr.message)
		return json({ error: "Failed to consume challenge" }, 500)
	}
	if (!consumed || consumed.length === 0) {
		return json({ error: "Challenge already used" }, 401)
	}

	// ── Step 10: Create or get Supabase Auth user and profile ────────────────────
	// Synthetic email — never used to send mail; just a stable, unique key.
	// The stellar_ prefix makes the origin unambiguous.
	const syntheticEmail = `stellar_${address.toLowerCase()}@vetra.internal`

	let authUserId: string

	const { data: existingProfile } = await admin
		.from("profiles")
		.select("auth_user_id")
		.eq("stellar_address", address)
		.maybeSingle()

	if (existingProfile) {
		authUserId = existingProfile.auth_user_id
	} else {
		const { data: newUser, error: createErr } = await admin.auth.admin.createUser({
			email: syntheticEmail,
			email_confirm: true,
			user_metadata: { stellar_address: address },
		})
		if (createErr || !newUser.user) {
			console.error("[auth-verify] Failed to create user:", createErr?.message)
			return json({ error: "Failed to create user" }, 500)
		}
		authUserId = newUser.user.id

		const { error: profileErr } = await admin.from("profiles").insert({
			auth_user_id: authUserId,
			stellar_address: address,
		})
		if (profileErr) {
			console.error("[auth-verify] Failed to create profile:", profileErr.message)
			return json({ error: "Failed to create profile" }, 500)
		}
	}

	// ── Step 11: Issue Supabase-compatible JWT ────────────────────────────────────
	// sub = auth.users UUID → auth.uid() in RLS returns this value.
	// role = "authenticated" → required by Supabase for RLS to apply.
	const now = Math.floor(Date.now() / 1000)
	const jwtKey = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(JWT_SECRET),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	)

	const accessToken = await createJWT(
		{ alg: "HS256", typ: "JWT" },
		{
			sub: authUserId,
			email: syntheticEmail,
			role: "authenticated",
			iss: "supabase",
			aud: "authenticated",
			iat: now,
			exp: now + JWT_TTL,
			app_metadata: { provider: "stellar" },
			user_metadata: { stellar_address: address },
		},
		jwtKey,
	)

	return json({
		access_token: accessToken,
		token_type: "bearer",
		expires_in: JWT_TTL,
	})
})
