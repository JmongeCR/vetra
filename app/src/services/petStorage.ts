// petStorage — localStorage persistence (Sprint 2-3).
//
// This is a temporary local-only layer. In Sprint 3+ these calls will be
// replaced by Vetra Core API requests. Data stored here is local to this
// browser/device, not shared with any server or verified on Stellar Testnet.

import type { Pet, PetSpecies, PetSex } from "../types/pet"

const STORAGE_KEY = "vetra:pets:v1"

// ── VET-XXXXXX generation ───────────────────────────────────────────────────
//
// Sprint 3 fix: use cryptographic randomness instead of a localStorage counter.
//
// Previous counter scheme (VET-000001 … VET-999999) was per-browser:
//   - Counter reset if localStorage is cleared.
//   - Two different browsers always start at VET-000001 → collisions guaranteed.
//
// New scheme: VET- + 8 chars from a 30-symbol alphabet (no 0/O/1/I/L to avoid
// visual ambiguity). Probability of collision: 1 in 30^8 ≈ 656 billion. Safe
// for local use and will stay unique when registered on Stellar Testnet.
//
// Existing records keep their counter-based IDs; they are marked with
// vetIdScheme: "counter" | undefined (legacy). The new scheme writes "random".
// No re-numbering occurs — references remain stable.

const VET_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789" // 30 chars, no 0/O/1/I/L

export function generateVetId(): string {
	const buf = new Uint8Array(8)
	crypto.getRandomValues(buf)
	const suffix = Array.from(buf, (b) => VET_ALPHABET[b % VET_ALPHABET.length]).join("")
	return `VET-${suffix}`
}

// ── CRUD ────────────────────────────────────────────────────────────────────

function readAll(): Pet[] {
	try {
		const raw = localStorage.getItem(STORAGE_KEY)
		return raw ? (JSON.parse(raw) as Pet[]) : []
	} catch {
		return []
	}
}

function writeAll(pets: Pet[]): void {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(pets))
	} catch {
		// Storage quota exceeded — nothing we can do silently here.
	}
}

export function getPets(): Pet[] {
	return readAll()
}

export function getPetById(id: string): Pet | undefined {
	return readAll().find((p) => p.id === id)
}

export function getPetByVetId(vetId: string): Pet | undefined {
	return readAll().find((p) => p.vetId === vetId)
}

export interface NewPetInput {
	name: string
	species: PetSpecies
	breed?: string
	sex: PetSex
	birthDate?: string
	birthDateEstimated: boolean
	color: string
	microchip?: string
	photoDataUrl?: string
	ownerAddress?: string
}

export function createPet(input: NewPetInput): Pet {
	const pet: Pet = {
		id: crypto.randomUUID(),
		vetId: generateVetId(),
		vetIdScheme: "random",
		...input,
		registeredAt: new Date().toISOString(),
		stellarStatus: "local",
	}
	writeAll([...readAll(), pet])
	return pet
}

export function deletePet(id: string): void {
	writeAll(readAll().filter((p) => p.id !== id))
}

/** Merge partial fields into an existing pet. No-op if id not found. */
export function updatePet(id: string, patch: Partial<Pet>): void {
	writeAll(readAll().map((p) => (p.id === id ? { ...p, ...patch } : p)))
}

// ── Identifier scheme helpers ───────────────────────────────────────────────

/** True if this pet's vetId was generated with the legacy counter scheme. */
export function isLegacyVetId(pet: Pet): boolean {
	return !pet.vetIdScheme || pet.vetIdScheme === "counter"
}

/**
 * Test helper: verify a vetId has the expected random format VET-XXXXXXXX.
 * Does NOT guarantee global uniqueness — that requires the Stellar contract.
 */
export function isRandomVetIdFormat(vetId: string): boolean {
	return /^VET-[A-HJ-NP-Z2-9]{8}$/.test(vetId)
}
