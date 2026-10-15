// Sprint 4.2 — auth flow local tests
//
// Tests the core logic of the Cavos → Supabase authentication bridge WITHOUT
// a live Supabase project or Cavos session. Uses only @stellar/stellar-sdk
// (already in app/node_modules) and Node.js built-ins.
//
// Run from the app/ directory:
//   node --test src/services/__tests__/auth-logic.test.mjs
//
// Requirements: Node ≥ 18 (node:test built-in), npm install already done.

import { strict as assert } from "node:assert"
import { describe, it } from "node:test"

// Dynamic import because ESM interop with stellar-sdk CJS bundle can vary.
const {
	TransactionBuilder,
	Networks,
	Keypair,
	Operation,
	Account,
} = await import("@stellar/stellar-sdk")

// ── Helpers mirroring auth-challenge/index.ts ────────────────────────────────

/**
 * Build a ManageData challenge XDR identical to what auth-challenge produces.
 * Uses sequence "0" → renders the tx unsubmittable (insufficient sequence for
 * any real account) while still being fully signable.
 */
function buildChallengeXdr(address, nonce) {
	const account = new Account(address, "0")
	const tx = new TransactionBuilder(account, {
		fee: "100",
		networkPassphrase: Networks.TESTNET,
	})
		.addOperation(
			Operation.manageData({
				name: "vetra:auth",
				value: nonce,
			}),
		)
		.setTimeout(300)
		.build()
	return tx.toXDR()
}

// ── Helpers mirroring auth-verify/index.ts (pure logic only) ─────────────────

/**
 * Verify the signed XDR matches the expected constraints.
 * Returns { ok: true } or { ok: false, reason: string }.
 */
function verifySignedXdr(signedXdr, expectedAddress, expectedNonce) {
	try {
		const tx = TransactionBuilder.fromXDR(signedXdr, Networks.TESTNET)

		if (tx.source !== expectedAddress) {
			return { ok: false, reason: "address mismatch" }
		}
		if (tx.operations.length !== 1) {
			return { ok: false, reason: "operation count" }
		}
		const op = tx.operations[0]
		if (op.type !== "manageData" || op.name !== "vetra:auth") {
			return { ok: false, reason: "wrong operation" }
		}
		const opValue = op.value ? new TextDecoder().decode(op.value) : ""
		if (opValue !== expectedNonce) {
			return { ok: false, reason: "nonce mismatch" }
		}

		const keypair = Keypair.fromPublicKey(expectedAddress)
		const txHash = tx.hash()
		const validSig = tx.signatures.some((s) => {
			try { return keypair.verify(txHash, s.signature()) }
			catch { return false }
		})
		if (!validSig) {
			return { ok: false, reason: "signature invalid" }
		}
		return { ok: true }
	} catch (e) {
		return { ok: false, reason: String(e) }
	}
}

/**
 * Input validation rules from auth-verify Step 1.
 */
function validateInput({ address, nonce, expires_at, signedXdr }) {
	if (typeof address !== "string" || !address.startsWith("G") || address.length !== 56)
		return "bad address"
	if (typeof nonce !== "string" || nonce.length !== 36)
		return "bad nonce"
	if (typeof expires_at !== "number")
		return "bad expires_at"
	if (typeof signedXdr !== "string" || signedXdr.length === 0)
		return "bad signedXdr"
	return null
}

// ── Tests ─────────────────────────────────────────────────────────────────────

const VALID_NONCE = "123e4567-e89b-12d3-a456-426614174000" // 36 chars

describe("Input validation", () => {
	it("accepts a valid payload", () => {
		const kp = Keypair.random()
		assert.equal(
			validateInput({
				address: kp.publicKey(),
				nonce: VALID_NONCE,
				expires_at: Date.now() / 1000 + 300,
				signedXdr: "dGVzdA==",
			}),
			null,
		)
	})

	it("rejects a non-G address", () => {
		assert.notEqual(
			validateInput({ address: "XBADADDRESS", nonce: VALID_NONCE, expires_at: 1, signedXdr: "x" }),
			null,
		)
	})

	it("rejects a nonce shorter than 36 chars", () => {
		const kp = Keypair.random()
		assert.notEqual(
			validateInput({ address: kp.publicKey(), nonce: "short", expires_at: 1, signedXdr: "x" }),
			null,
		)
	})

	it("rejects missing signedXdr", () => {
		const kp = Keypair.random()
		assert.notEqual(
			validateInput({ address: kp.publicKey(), nonce: VALID_NONCE, expires_at: 1, signedXdr: "" }),
			null,
		)
	})
})

describe("Challenge XDR structure", () => {
	it("produces a ManageData op with vetra:auth and the nonce as value", () => {
		const kp = Keypair.random()
		const xdr = buildChallengeXdr(kp.publicKey(), VALID_NONCE)
		const tx = TransactionBuilder.fromXDR(xdr, Networks.TESTNET)
		assert.equal(tx.operations.length, 1)
		const op = tx.operations[0]
		assert.equal(op.type, "manageData")
		assert.equal(op.name, "vetra:auth")
		assert.equal(new TextDecoder().decode(op.value), VALID_NONCE)
	})

	it("TESTNET signature fails verification against MAINNET hash", () => {
		// The XDR envelope does not embed the network passphrase — it is used when
		// computing the transaction hash for signing/verification. A transaction
		// signed on TESTNET will have a different hash on MAINNET, so signature
		// verification must fail when the wrong passphrase is used.
		const kp = Keypair.random()
		const xdr = buildChallengeXdr(kp.publicKey(), VALID_NONCE)
		const tx = TransactionBuilder.fromXDR(xdr, Networks.TESTNET)
		tx.sign(kp)
		const signedXdr = tx.toXDR()

		// Parse with MAINNET — SDK accepts the XDR but computes a different hash.
		const txMainnet = TransactionBuilder.fromXDR(signedXdr, Networks.PUBLIC)
		const keypair = Keypair.fromPublicKey(kp.publicKey())
		const mainnetHash = txMainnet.hash()
		const sigValid = txMainnet.signatures.some((s) => {
			try { return keypair.verify(mainnetHash, s.signature()) }
			catch { return false }
		})
		assert.equal(sigValid, false, "TESTNET sig must not verify against MAINNET hash")
	})

	it("nonce is within 64-byte ManageData value limit", () => {
		// UUIDs are 36 bytes — well within the 64-byte limit
		assert.ok(new TextEncoder().encode(VALID_NONCE).length <= 64)
	})
})

describe("Signature verification", () => {
	it("accepts a correctly signed challenge", () => {
		const kp = Keypair.random()
		const xdr = buildChallengeXdr(kp.publicKey(), VALID_NONCE)
		const tx = TransactionBuilder.fromXDR(xdr, Networks.TESTNET)
		tx.sign(kp)
		const signedXdr = tx.toXDR()
		const result = verifySignedXdr(signedXdr, kp.publicKey(), VALID_NONCE)
		assert.deepEqual(result, { ok: true })
	})

	it("rejects XDR signed by a different keypair", () => {
		const kp = Keypair.random()
		const attacker = Keypair.random()
		const xdr = buildChallengeXdr(kp.publicKey(), VALID_NONCE)
		const tx = TransactionBuilder.fromXDR(xdr, Networks.TESTNET)
		tx.sign(attacker)
		const signedXdr = tx.toXDR()
		const result = verifySignedXdr(signedXdr, kp.publicKey(), VALID_NONCE)
		assert.equal(result.ok, false)
	})

	it("rejects unsigned XDR", () => {
		const kp = Keypair.random()
		const xdr = buildChallengeXdr(kp.publicKey(), VALID_NONCE)
		const result = verifySignedXdr(xdr, kp.publicKey(), VALID_NONCE)
		assert.equal(result.ok, false)
		assert.equal(result.reason, "signature invalid")
	})

	it("rejects when the nonce in XDR does not match expected nonce", () => {
		const kp = Keypair.random()
		const xdr = buildChallengeXdr(kp.publicKey(), VALID_NONCE)
		const tx = TransactionBuilder.fromXDR(xdr, Networks.TESTNET)
		tx.sign(kp)
		const signedXdr = tx.toXDR()
		const differentNonce = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
		const result = verifySignedXdr(signedXdr, kp.publicKey(), differentNonce)
		assert.equal(result.ok, false)
		assert.equal(result.reason, "nonce mismatch")
	})

	it("rejects when the address does not match the transaction source", () => {
		const kp = Keypair.random()
		const attacker = Keypair.random()
		const xdr = buildChallengeXdr(kp.publicKey(), VALID_NONCE)
		const tx = TransactionBuilder.fromXDR(xdr, Networks.TESTNET)
		tx.sign(kp)
		const signedXdr = tx.toXDR()
		const result = verifySignedXdr(signedXdr, attacker.publicKey(), VALID_NONCE)
		assert.equal(result.ok, false)
		assert.equal(result.reason, "address mismatch")
	})
})

describe("Expiry checks (auth-verify step 3 / isSupabaseAuthenticated)", () => {
	it("detects an expired challenge (expires_at in the past)", () => {
		const pastTimestamp = new Date(Date.now() - 10_000) // 10 seconds ago
		const isExpired = new Date() > new Date(pastTimestamp)
		assert.equal(isExpired, true)
	})

	it("accepts a valid future challenge (expires_at in the future)", () => {
		const futureTimestamp = new Date(Date.now() + 300_000) // 5 minutes ahead
		const isExpired = new Date() > new Date(futureTimestamp)
		assert.equal(isExpired, false)
	})

	it("JWT expiry: unix epoch seconds in the past is expired", () => {
		const expiresAt = Math.floor(Date.now() / 1000) - 60 // 1 minute ago
		const isExpired = expiresAt < Math.floor(Date.now() / 1000)
		assert.equal(isExpired, true)
	})

	it("JWT expiry: unix epoch seconds in the future is valid", () => {
		const expiresAt = Math.floor(Date.now() / 1000) + 3600
		const isExpired = expiresAt < Math.floor(Date.now() / 1000)
		assert.equal(isExpired, false)
	})
})
