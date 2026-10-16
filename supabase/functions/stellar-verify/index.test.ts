// Unit tests for stellar-verify helpers — Sprint 5F.1
//
// Tests the JWT verification and Horizon TX check in isolation, without
// deploying the Edge Function or hitting any real Supabase/Stellar endpoint.
//
// Run from repo root:
//   deno test supabase/functions/stellar-verify/index.test.ts --allow-none
//
// All tests use a local secret and local mocks — no network calls.

import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts"
import { create as createJWT } from "https://deno.land/x/djwt@v3.0.2/mod.ts"
import { verifyVetraJwt, verifyHorizonTx } from "./_helpers.ts"

// ── Test fixtures ────────────────────────────────────────────────────────────

const TEST_SECRET = "vetra-test-secret-at-least-32-chars-long!!"
const TEST_SECRET_WRONG = "wrong-secret-that-is-also-32-chars-long!!"
// Valid 56-char Stellar G-address (format check only, not a real keypair)
const TEST_ADDRESS = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
const TEST_USER_ID = "00000000-0000-0000-0000-000000000001"
const TEST_TX_HASH = "a".repeat(64)

async function makeSignKey(secret: string): Promise<CryptoKey> {
	return crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign", "verify"],
	)
}

interface TokenOverrides {
	sub?: string
	role?: string
	iss?: string
	aud?: string
	exp?: number
	iat?: number
	user_metadata?: unknown
	app_metadata?: unknown
}

async function mintToken(overrides: TokenOverrides = {}, secret = TEST_SECRET): Promise<string> {
	const key = await makeSignKey(secret)
	const now = Math.floor(Date.now() / 1000)
	return createJWT(
		{ alg: "HS256", typ: "JWT" },
		{
			sub: TEST_USER_ID,
			role: "authenticated",
			iss: "supabase",
			aud: "authenticated",
			iat: now,
			exp: now + 3600,
			app_metadata: { provider: "stellar" },
			user_metadata: { stellar_address: TEST_ADDRESS },
			...overrides,
		},
		key,
	)
}

// ── JWT verification tests ───────────────────────────────────────────────────

Deno.test("verifyVetraJwt — 1. valid token returns correct payload", async () => {
	const token = await mintToken()
	const payload = await verifyVetraJwt(token, TEST_SECRET)

	assertEquals(payload.sub, TEST_USER_ID)
	assertEquals(payload.role, "authenticated")
	assertEquals(payload.iss, "supabase")
	assertEquals(payload.user_metadata.stellar_address, TEST_ADDRESS)
})

Deno.test("verifyVetraJwt — 2. expired token is rejected", async () => {
	const now = Math.floor(Date.now() / 1000)
	const token = await mintToken({ iat: now - 7200, exp: now - 3600 })

	// djwt throws when exp is in the past — any error means the token was rejected
	let threw = false
	try { await verifyVetraJwt(token, TEST_SECRET) } catch { threw = true }
	assertEquals(threw, true, "Should reject an expired token")
})

Deno.test("verifyVetraJwt — 3. invalid signature is rejected", async () => {
	// Token signed with TEST_SECRET, verified with wrong secret
	const token = await mintToken({}, TEST_SECRET)

	let threw = false
	try { await verifyVetraJwt(token, TEST_SECRET_WRONG) } catch { threw = true }
	assertEquals(threw, true, "Should reject a token signed with a different secret")
})

Deno.test("verifyVetraJwt — 4. wrong issuer is rejected", async () => {
	const token = await mintToken({ iss: "not-supabase" })

	await assertRejects(
		() => verifyVetraJwt(token, TEST_SECRET),
		Error,
		"issuer mismatch",
		"Should reject a token with wrong iss claim",
	)
})

Deno.test("verifyVetraJwt — 5. missing stellar_address is rejected", async () => {
	const token = await mintToken({ user_metadata: {} })

	await assertRejects(
		() => verifyVetraJwt(token, TEST_SECRET),
		Error,
		"stellar_address",
		"Should reject a token without stellar_address",
	)
})

Deno.test("verifyVetraJwt — 6. wrong role is rejected", async () => {
	const token = await mintToken({ role: "anon" })

	await assertRejects(
		() => verifyVetraJwt(token, TEST_SECRET),
		Error,
		"role",
		"Should reject a token with role other than 'authenticated'",
	)
})

// ── Horizon TX verification tests ────────────────────────────────────────────

Deno.test("verifyHorizonTx — 7. non-existent transaction (404) returns { ok: false }", async () => {
	const mockFetch = (_url: string | URL | Request): Promise<Response> =>
		Promise.resolve(
			new Response(JSON.stringify({ title: "Resource Missing" }), { status: 404 }),
		)

	const result = await verifyHorizonTx(TEST_TX_HASH, mockFetch as typeof fetch)

	assertEquals(result.ok, false)
	assertEquals(result.reason, "Transaction not found on Stellar Testnet")
})

Deno.test("verifyHorizonTx — 8. failed transaction (successful: false) returns { ok: false }", async () => {
	const mockFetch = (_url: string | URL | Request): Promise<Response> =>
		Promise.resolve(
			new Response(
				JSON.stringify({ successful: false, id: TEST_TX_HASH }),
				{ status: 200 },
			),
		)

	const result = await verifyHorizonTx(TEST_TX_HASH, mockFetch as typeof fetch)

	assertEquals(result.ok, false)
	assertEquals(result.reason, "Transaction was not successful on ledger")
})

Deno.test("verifyHorizonTx — 9. successful transaction returns { ok: true }", async () => {
	const mockFetch = (_url: string | URL | Request): Promise<Response> =>
		Promise.resolve(
			new Response(
				JSON.stringify({ successful: true, id: TEST_TX_HASH }),
				{ status: 200 },
			),
		)

	const result = await verifyHorizonTx(TEST_TX_HASH, mockFetch as typeof fetch)

	assertEquals(result.ok, true)
})

Deno.test("verifyHorizonTx — 10. Horizon network error returns { ok: false }", async () => {
	const mockFetch = (_url: string | URL | Request): Promise<Response> => {
		throw new TypeError("Network request failed")
	}

	const result = await verifyHorizonTx(TEST_TX_HASH, mockFetch as typeof fetch)

	assertEquals(result.ok, false)
	assertEquals(typeof result.reason, "string")
})
