// Exportable helpers for stellar-verify — JWT verification + Horizon TX check.
// Separated from index.ts so index.test.ts can import and unit-test them without
// instantiating the full Edge Function handler or its npm: dependencies.

import { verify as djwtVerify } from "https://deno.land/x/djwt@v3.0.2/mod.ts"

// ── JWT ──────────────────────────────────────────────────────────────────────

export interface VetraJwtPayload {
	sub: string
	role: string
	iss: string
	aud: string
	exp: number
	iat: number
	email?: string
	app_metadata?: { provider?: string }
	user_metadata: { stellar_address: string }
}

/**
 * Verify a Vetra custom HS256 JWT issued by the auth-verify Edge Function.
 *
 * Uses djwt@v3.0.2 (same library that auth-verify uses to create tokens) so the
 * signature check is symmetric. djwt throws JwtValidationError on bad signature,
 * expiry, or malformed structure — caller should catch and return 401.
 *
 * Claim requirements:
 *   - iss === "supabase"
 *   - role === "authenticated"
 *   - sub present (auth.users UUID)
 *   - user_metadata.stellar_address looks like a valid Stellar G-address (G + 55 chars)
 */
export async function verifyVetraJwt(
	token: string,
	secret: string,
): Promise<VetraJwtPayload> {
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["verify"],
	)

	// djwt.verify: checks HMAC signature, exp > now, and basic structure.
	// Throws on any failure — do not catch here; let it bubble to the handler.
	const raw = await djwtVerify(token, key)
	const payload = raw as unknown as VetraJwtPayload

	if (payload.iss !== "supabase") {
		throw new Error("JWT issuer mismatch: expected 'supabase'")
	}
	if (payload.role !== "authenticated") {
		throw new Error("JWT role must be 'authenticated'")
	}
	if (!payload.sub) {
		throw new Error("JWT missing 'sub' claim")
	}
	const addr = payload.user_metadata?.stellar_address
	if (typeof addr !== "string" || addr.length !== 56 || !addr.startsWith("G")) {
		throw new Error("JWT missing valid stellar_address in user_metadata")
	}

	return payload
}

// ── Horizon transaction verification ────────────────────────────────────────

export interface HorizonVerifyResult {
	ok: boolean
	reason?: string
}

/**
 * Confirm a Stellar Testnet transaction is confirmed and successful via Horizon.
 *
 * Accepts an optional `fetchFn` for dependency injection in tests.
 * Returns { ok: true } on success, { ok: false, reason } on any failure.
 */
export async function verifyHorizonTx(
	txHash: string,
	fetchFn: typeof globalThis.fetch = globalThis.fetch,
): Promise<HorizonVerifyResult> {
	const url = `https://horizon-testnet.stellar.org/transactions/${txHash}`

	let res: Response
	try {
		res = await fetchFn(url, { signal: AbortSignal.timeout(12_000) })
	} catch (err) {
		return {
			ok: false,
			reason: `Horizon request failed: ${err instanceof Error ? err.message : String(err)}`,
		}
	}

	if (res.status === 404) {
		return { ok: false, reason: "Transaction not found on Stellar Testnet" }
	}
	if (!res.ok) {
		return { ok: false, reason: `Horizon API error (${res.status})` }
	}

	const tx = await res.json() as { successful: boolean }
	if (!tx.successful) {
		return { ok: false, reason: "Transaction was not successful on ledger" }
	}

	return { ok: true }
}
