// authBridge — Cavos → Supabase authentication bridge (Sprint 4)
//
// Flow:
//   1. Request a challenge from the auth-challenge Edge Function.
//   2. Sign the challenge transaction XDR with the user's Stellar wallet (Cavos).
//   3. Send the signed XDR to auth-verify for cryptographic validation.
//   4. Set the returned JWT as the active Supabase session.
//
// Security properties:
//   - No email address, userId, or Stellar address is trusted without a valid signature.
//   - The challenge XDR is built server-side — the client cannot tamper with it.
//   - The session JWT is signed with JWT_SECRET (Edge Function secret).
//   - Calling signTransaction() triggers Cavos's signing UI — no auto-sign.
//   - When supabaseConfigured is false, all functions are no-ops / return null.

import * as StellarSdk from "@stellar/stellar-sdk"
import {
	supabase,
	supabaseConfigured,
	setSupabaseToken,
	clearSupabaseToken,
	isSupabaseTokenValid,
} from "../lib/supabase"
import type { SignTransactionFn } from "../cavos/context"

const EDGE_BASE_URL = import.meta.env.PUBLIC_SUPABASE_URL
	? `${import.meta.env.PUBLIC_SUPABASE_URL}/functions/v1`
	: null

export type AuthBridgeResult =
	| { ok: true; address: string }
	| { ok: false; error: string }

/**
 * Authenticate the current Cavos wallet with Supabase.
 *
 * Returns { ok: true } when the Supabase session is active.
 * Returns { ok: false, error } on any failure — never throws.
 *
 * @param address        The user's Stellar G… address from useWallet().address
 * @param signTransaction The signing function from useWallet().signTransaction
 */
export async function authenticateWithSupabase(
	address: string,
	signTransaction: SignTransactionFn,
): Promise<AuthBridgeResult> {
	if (!supabaseConfigured || !EDGE_BASE_URL) {
		return { ok: false, error: "Supabase not configured" }
	}

	try {
		// ── Step 1: Request challenge ─────────────────────────────────────────
		const challengeRes = await fetch(`${EDGE_BASE_URL}/auth-challenge`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ address }),
		})
		if (!challengeRes.ok) {
			const err = await challengeRes.json().catch(() => ({})) as Record<string, string>
			return { ok: false, error: err["error"] ?? "Challenge request failed" }
		}
		// Sprint 4.1: mac removed — nonce is now stored server-side (DB), not HMAC-verified
		const { nonce, expires_at, xdr } = await challengeRes.json() as {
			nonce: string; expires_at: number; xdr: string
		}

		// ── Step 2: Sign the challenge XDR with Cavos ─────────────────────────
		// This triggers Cavos's signing flow — the user sees the transaction.
		const { signedTxXdr } = await signTransaction(xdr, {
			networkPassphrase: StellarSdk.Networks.TESTNET,
			address,
		})

		// ── Step 3: Verify signature + get Supabase JWT ───────────────────────
		const verifyRes = await fetch(`${EDGE_BASE_URL}/auth-verify`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ address, nonce, expires_at, signedXdr: signedTxXdr }),
		})
		if (!verifyRes.ok) {
			const err = await verifyRes.json().catch(() => ({})) as Record<string, string>
			return { ok: false, error: err["error"] ?? "Verification failed" }
		}
		const { access_token } = await verifyRes.json() as { access_token: string }

		// ── Step 4: Store the JWT for PostgREST requests ─────────────────────
		// The accessToken callback in supabase.ts picks this up on every API
		// call. Using the token store (not setSession) avoids any GoTrue
		// interaction — the JWT is HS256, not a real Supabase Auth session.
		const expiresAt = Math.floor(Date.now() / 1000) + 3600
		setSupabaseToken(access_token, expiresAt)

		return { ok: true, address }
	} catch (err) {
		return { ok: false, error: err instanceof Error ? err.message : String(err) }
	}
}

/** Clear the Supabase JWT. Cavos sign-out is handled externally by useWallet. */
export function signOutSupabase(): void {
	clearSupabaseToken()
}

/** Return the current Supabase session's profile_id for use in DB queries. */
export async function getCurrentProfileId(): Promise<string | null> {
	if (!supabaseConfigured) return null
	const { data } = await supabase
		.from("profiles")
		.select("id")
		.maybeSingle()
	return data?.id ?? null
}

/** True when the stored JWT exists and has not yet expired. */
export async function isSupabaseAuthenticated(): Promise<boolean> {
	return supabaseConfigured && isSupabaseTokenValid()
}
