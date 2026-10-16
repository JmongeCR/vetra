// petDb — Supabase data layer for pet CRUD (Sprint 4)
//
// All functions gracefully return null / [] when Supabase is not configured,
// letting the UI fall back to localStorage automatically.
//
// The `register_pet` SQL function (defined in the migration) creates the pet
// + guardian + stellar_identity + public_passport rows atomically. This avoids
// partial writes if any individual INSERT fails.
//
// Photos are NOT stored as base64 here. Use photoStorage.ts for image uploads;
// call updatePetPhotoPath() after a successful upload.

import { supabase, supabaseConfigured, isSupabaseTokenValid } from "../lib/supabase"
import type { Pet, PetSpecies, PetSex } from "../types/pet"

// ── Type mapping ─────────────────────────────────────────────────────────────

/** Row shape returned by Supabase for the pets table + joined stellar_identities. */
interface PetRow {
	id: string
	vet_id: string
	name: string
	species: PetSpecies
	breed: string | null
	sex: PetSex
	birth_date: string | null
	birth_date_estimated: boolean
	color: string
	microchip: string | null
	photo_path: string | null
	photo_url?: string | null  // injected after storage URL resolution
	created_at: string
	stellar_identities: { status: string; transaction_hash: string | null }[] | null
}

function rowToPet(row: PetRow, ownerAddress?: string): Pet {
	const stellar = row.stellar_identities?.[0]
	return {
		id: row.id,
		vetId: row.vet_id,
		vetIdScheme: "random",
		name: row.name,
		species: row.species,
		breed: row.breed ?? undefined,
		sex: row.sex,
		birthDate: row.birth_date ?? undefined,
		birthDateEstimated: row.birth_date_estimated,
		color: row.color,
		microchip: row.microchip ?? undefined,
		photoDataUrl: undefined,
		photoUrl: row.photo_url ?? undefined,
		photoPath: row.photo_path ?? undefined,
		ownerAddress: ownerAddress,
		registeredAt: row.created_at,
		stellarStatus: (stellar?.status as Pet["stellarStatus"]) ?? "local",
		stellarTxHash: stellar?.transaction_hash ?? undefined,
	}
}

// ── Queries ──────────────────────────────────────────────────────────────────

/**
 * Return all pets where the current user is a guardian.
 * Returns [] if Supabase is not configured or the user is not authenticated.
 */
export async function fetchPets(): Promise<Pet[]> {
	if (!supabaseConfigured || !isSupabaseTokenValid()) return []

	const { data, error } = await supabase
		.from("pets")
		.select(`
			*,
			stellar_identities(status, transaction_hash)
		`)
		.order("created_at", { ascending: false })

	if (error) throw new Error(error.message)
	if (!data) return []

	return data.map((row) => rowToPet(row as PetRow))
}

/**
 * Fetch a single pet by its internal UUID.
 * Returns null if not found or user is not a guardian.
 */
export async function fetchPetById(id: string): Promise<Pet | null> {
	if (!supabaseConfigured || !isSupabaseTokenValid()) return null

	const { data, error } = await supabase
		.from("pets")
		.select("*, stellar_identities(status, transaction_hash)")
		.eq("id", id)
		.maybeSingle()

	if (error || !data) return null

	return rowToPet(data as PetRow)
}

/**
 * Fetch a single pet by its VET-ID for the public passport view.
 * Uses the passport_view — no authentication required, no private data.
 */
export async function fetchPublicPassport(vetId: string): Promise<PassportData | null> {
	if (!supabaseConfigured) return null

	const { data, error } = await supabase
		.from("passport_view")
		.select("*")
		.eq("vet_id", vetId)
		.maybeSingle()

	if (error || !data) return null
	return data as PassportData
}

export interface PassportData {
	id: string
	vet_id: string
	name: string
	species: PetSpecies
	breed: string | null
	sex: PetSex
	birth_date: string | null
	birth_date_estimated: boolean
	color: string
	photo_path: string | null
	stellar_status: string
	stellar_tx_hash: string | null
	is_public: boolean
	registered_at: string
}

// ── Mutations ────────────────────────────────────────────────────────────────

export interface CreatePetInput {
	profileId: string
	vetId: string
	name: string
	species: PetSpecies
	breed?: string
	sex: PetSex
	birthDate?: string
	birthDateEstimated: boolean
	color: string
	microchip?: string
}

/**
 * Create a pet via the register_pet SQL function (atomic).
 * Returns the created pet or throws a descriptive error.
 */
export async function createPetInDb(input: CreatePetInput): Promise<Pet> {
	if (!supabaseConfigured) throw new Error("Supabase not configured")

	const { data, error } = await supabase.rpc("register_pet", {
		p_profile_id:           input.profileId,
		p_vet_id:               input.vetId,
		p_name:                 input.name,
		p_species:              input.species,
		p_breed:                input.breed ?? null,
		p_sex:                  input.sex,
		p_birth_date:           input.birthDate ?? null,
		p_birth_date_estimated: input.birthDateEstimated,
		p_color:                input.color,
		p_microchip:            input.microchip ?? null,
	})

	if (error) {
		if (error.message.includes("DuplicateVetId")) {
			throw new Error(`El identificador ${input.vetId} ya está registrado.`)
		}
		throw new Error(`Error al registrar mascota: ${error.message}`)
	}

	// Fetch the full row (with stellar_identities) from the returned partial data.
	return await fetchPetById((data as { id: string }).id) ?? {
		id: (data as { id: string }).id,
		vetId: input.vetId,
		vetIdScheme: "random",
		name: input.name,
		species: input.species,
		breed: input.breed,
		sex: input.sex,
		birthDate: input.birthDate,
		birthDateEstimated: input.birthDateEstimated,
		color: input.color,
		microchip: input.microchip,
		registeredAt: new Date().toISOString(),
		stellarStatus: "local",
	}
}

/**
 * Update a pet's photo_path after a successful Storage upload.
 * The caller is responsible for uploading the photo first.
 */
export async function updatePetPhotoPath(
	petId: string,
	photoPath: string,
): Promise<void> {
	if (!supabaseConfigured) return
	const { error } = await supabase
		.from("pets")
		.update({ photo_path: photoPath })
		.eq("id", petId)
	if (error) throw new Error(`Failed to update photo_path: ${error.message}`)
}

/** Delete a pet (primary guardian only — enforced by RLS). */
export async function deletePetFromDb(petId: string): Promise<void> {
	if (!supabaseConfigured) return
	const { error } = await supabase.from("pets").delete().eq("id", petId)
	if (error) throw new Error(`Failed to delete pet: ${error.message}`)
}

/**
 * Atomically transition stellar_identities from local → pending.
 * Must be called before presenting the Stellar signing prompt to
 * prevent duplicate registrations from concurrent tabs.
 */
export async function claimStellarPending(petId: string, metadataHash: string): Promise<void> {
	if (!supabaseConfigured) throw new Error("Supabase not configured")
	const { error } = await supabase.rpc("claim_stellar_pending", {
		p_pet_id: petId,
		p_metadata_hash: metadataHash,
	})
	if (error) throw new Error(`claim_stellar_pending: ${error.message}`)
}

/**
 * Atomically transition stellar_identities from pending → local.
 * Idempotent on rows that are not in pending status.
 * Called when the user cancels signing or the transaction fails.
 */
export async function rollbackStellarPending(petId: string): Promise<void> {
	if (!supabaseConfigured) return
	const { error } = await supabase.rpc("rollback_stellar_pending", { p_pet_id: petId })
	if (error) throw new Error(`rollback_stellar_pending: ${error.message}`)
}

