// photoStorage — Supabase Storage for pet photos (Sprint 4)
//
// Storage bucket: "pet-photos"
// Path pattern: pets/{petId}/{filename}
//
// Security rules (set in Supabase dashboard or via migration):
//   - Only authenticated guardians of the pet can upload/delete.
//   - Photos are stored as private by default.
//   - Public passports get a time-limited signed URL (not a public URL).
//   - A user cannot modify photos at another user's path (enforced by Storage RLS).
//
// The bucket "pet-photos" must be created manually in the Supabase dashboard
// or via the CLI before this code can run. See docs/SUPABASE-SETUP.md.

import { supabase, supabaseConfigured } from "../lib/supabase"

const BUCKET = "pet-photos"
const MAX_SIZE_BYTES = 2 * 1024 * 1024   // 2 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"]
const SIGNED_URL_TTL = 3600 // 1 hour

// ── Validation ───────────────────────────────────────────────────────────────

export interface PhotoValidationError {
	kind: "type" | "size"
	message: string
}

export function validatePhoto(file: File): PhotoValidationError | null {
	if (!ALLOWED_TYPES.includes(file.type)) {
		return {
			kind: "type",
			message: `Tipo de archivo no permitido. Usa JPG, PNG, WebP o GIF.`,
		}
	}
	if (file.size > MAX_SIZE_BYTES) {
		return {
			kind: "size",
			message: `La foto excede el límite de 2 MB.`,
		}
	}
	return null
}

// ── Upload ───────────────────────────────────────────────────────────────────

/**
 * Upload a photo to Supabase Storage and return the storage path.
 * The path is saved to pets.photo_path in the database.
 *
 * @param petId   Internal pet UUID (used as the folder name)
 * @param file    The image file from the <input type="file">
 * @returns       The storage path (e.g. "pets/uuid/photo.jpg")
 */
export async function uploadPetPhoto(petId: string, file: File): Promise<string> {
	if (!supabaseConfigured) throw new Error("Supabase not configured")

	const validation = validatePhoto(file)
	if (validation) throw new Error(validation.message)

	const ext = file.type.split("/")[1]
	const path = `pets/${petId}/photo.${ext}`

	const { error } = await supabase.storage
		.from(BUCKET)
		.upload(path, file, {
			contentType: file.type,
			upsert: true, // overwrite if a photo already exists for this pet
		})

	if (error) throw new Error(`Error al subir foto: ${error.message}`)
	return path
}

/**
 * Delete a pet's photo from Storage (called when deleting the pet or replacing the photo).
 * Never throws — logs silently if the file is not found.
 */
export async function deletePetPhoto(photoPath: string): Promise<void> {
	if (!supabaseConfigured || !photoPath) return
	await supabase.storage.from(BUCKET).remove([photoPath])
}

// ── URL generation ───────────────────────────────────────────────────────────

/**
 * Generate a time-limited signed URL for a photo.
 * Safe for both authenticated and anonymous users (for public passports).
 * Returns null if the path is empty or Supabase is not configured.
 */
export async function getSignedPhotoUrl(photoPath: string | null | undefined): Promise<string | null> {
	if (!supabaseConfigured || !photoPath) return null

	const { data, error } = await supabase.storage
		.from(BUCKET)
		.createSignedUrl(photoPath, SIGNED_URL_TTL)

	if (error || !data) return null
	return data.signedUrl
}

/**
 * Convert a base64 data URL (from localStorage) to a File object.
 * Used during localStorage → Supabase migration.
 */
export function dataUrlToFile(dataUrl: string, filename: string): File {
	const commaIdx = dataUrl.indexOf(",")
	const header = dataUrl.slice(0, commaIdx)
	const mime = (header.match(/:(.*?);/) ?? [])[1] ?? "image/jpeg"
	const bstr = atob(dataUrl.slice(commaIdx + 1))
	const u8arr = new Uint8Array(bstr.length)
	for (let i = 0; i < bstr.length; i++) u8arr[i] = bstr.charCodeAt(i)
	return new File([u8arr], filename, { type: mime })
}
