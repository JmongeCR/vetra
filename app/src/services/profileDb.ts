import { supabase, supabaseConfigured, isSupabaseTokenValid } from "../lib/supabase"

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Profile {
	id: string
	auth_user_id: string
	stellar_address: string
	display_name: string | null
	// Requires migration 20261016400000_vetra_profile_fields
	first_name?: string | null
	last_name?: string | null
	phone?: string | null
	country?: string | null
	avatar_path?: string | null
	created_at: string
	updated_at: string
}

export type ProfileUpdate = Partial<
	Pick<Profile, "display_name" | "first_name" | "last_name" | "phone" | "country">
>

// ── Queries ──────────────────────────────────────────────────────────────────

export async function fetchProfile(): Promise<Profile | null> {
	if (!supabaseConfigured || !isSupabaseTokenValid()) return null
	const { data, error } = await supabase
		.from("profiles")
		.select("*")
		.single()
	if (error) return null
	return data as Profile
}

export async function updateProfile(
	patch: ProfileUpdate,
): Promise<{ ok: boolean; error?: string }> {
	if (!supabaseConfigured || !isSupabaseTokenValid())
		return { ok: false, error: "No autenticado" }

	// Fetch the row id first so the UPDATE has a stable WHERE clause
	const { data: existing, error: fetchErr } = await supabase
		.from("profiles")
		.select("id")
		.single()
	if (fetchErr || !existing)
		return { ok: false, error: "Perfil no encontrado" }

	const { error } = await supabase
		.from("profiles")
		.update(patch)
		.eq("id", existing.id)
	if (error) return { ok: false, error: error.message }
	return { ok: true }
}
