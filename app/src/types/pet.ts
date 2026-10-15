// ── Pet domain types ────────────────────────────────────────────────────────

export type PetSpecies =
	| "dog"
	| "cat"
	| "bird"
	| "rabbit"
	| "reptile"
	| "other"

export type PetSex = "male" | "female" | "unknown"

/** What Stellar knows about this pet's identity. */
export type StellarStatus = "local" | "pending" | "registered"

/**
 * How the vetId was generated.
 * - "counter": legacy Sprint 2 counter (e.g. VET-000001). Per-browser, not collision-safe.
 * - "random":  Sprint 3+ crypto-random suffix (e.g. VET-K4X9M2PL). Globally unique.
 * Both remain valid and stable — this field is only for audit/migration purposes.
 */
export type VetIdScheme = "counter" | "random"

export interface Pet {
	/** UUID v4 — internal identifier, never shown as the universal ID. */
	id: string
	/** VET-XXXXXX — universal identifier, stable and never reused. */
	vetId: string
	/** Generation scheme of vetId. Older records without this field are "counter". */
	vetIdScheme?: VetIdScheme
	name: string
	species: PetSpecies
	breed?: string
	sex: PetSex
	/** ISO date string (YYYY-MM-DD) or undefined if unknown. */
	birthDate?: string
	/** True when the birth date is an estimate, not an exact date. */
	birthDateEstimated: boolean
	color: string
	microchip?: string
	/** Base64 data URL of the photo (localStorage). Undefined for DB-backed pets. */
	photoDataUrl?: string
	/** Supabase Storage path (pets/{id}/photo.ext). Set after DB upload. */
	photoPath?: string
	/** Signed or public URL for displaying the photo from Supabase Storage. */
	photoUrl?: string
	/** Stellar address of the owner at registration time. */
	ownerAddress?: string
	/** ISO date string when the record was created locally. */
	registeredAt: string
	/** Stellar Testnet registration state. */
	stellarStatus: StellarStatus
	/** Transaction hash, only when stellarStatus === "registered". */
	stellarTxHash?: string
}

export const SPECIES_LABELS: Record<PetSpecies, string> = {
	dog: "Perro",
	cat: "Gato",
	bird: "Ave",
	rabbit: "Conejo",
	reptile: "Reptil",
	other: "Otra especie",
}

export const SEX_LABELS: Record<PetSex, string> = {
	male: "Macho",
	female: "Hembra",
	unknown: "No especificado",
}

export const SPECIES_EMOJI: Record<PetSpecies, string> = {
	dog: "🐕",
	cat: "🐈",
	bird: "🦜",
	rabbit: "🐇",
	reptile: "🦎",
	other: "🐾",
}
