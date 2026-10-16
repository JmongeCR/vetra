import { supabase, clinicSupabaseConfigured } from "../lib/supabase"

// PassportData mirrors the passport_view columns accessible without auth
export interface PassportData {
    id: string
    vet_id: string
    name: string
    species: string
    breed: string | null
    sex: string
    birth_date: string | null
    birth_date_estimated: boolean
    color: string | null
    photo_path: string | null
    stellar_status: string
    is_public: boolean
}

export interface ClinicAccessRequest {
    id: string
    clinic_id: string
    pet_id: string
    pet_name?: string
    pet_vet_id?: string
    scopes: string[]
    message: string | null
    status: "pending" | "approved" | "rejected" | "expired"
    expires_at: string | null
    created_at: string
}

export interface ClinicConsent {
    id: string
    clinic_id: string
    pet_id: string
    pet_name?: string
    pet_vet_id?: string
    scopes: string[]
    status: "active" | "revoked" | "expired"
    granted_at: string
    expires_at: string | null
}

// ── Search ──────────────────────────────────────────────────────────────────
// passport_view is GRANT SELECT TO anon — no auth required
export async function searchPetByVetId(vetId: string): Promise<PassportData | null> {
    if (!clinicSupabaseConfigured) return null
    const { data, error } = await supabase
        .from("passport_view")
        .select("id,vet_id,name,species,breed,sex,birth_date,birth_date_estimated,color,photo_path,stellar_status,is_public")
        .eq("vet_id", vetId.trim().toUpperCase())
        .maybeSingle()
    if (error || !data) return null
    return data as PassportData
}

// ── Access requests ──────────────────────────────────────────────────────────

export async function createAccessRequest(input: {
    petId: string
    clinicId: string
    scopes: string[]
    message?: string
    expiresAt?: string
}): Promise<{ ok: boolean; error?: string }> {
    if (!clinicSupabaseConfigured) return { ok: false, error: "No configurado" }
    const { error } = await supabase
        .from("access_requests")
        .insert({
            clinic_id: input.clinicId,
            pet_id: input.petId,
            scopes: input.scopes,
            message: input.message ?? null,
            expires_at: input.expiresAt ?? null,
        })
    if (error) return { ok: false, error: error.message }
    return { ok: true }
}

export async function fetchClinicAccessRequests(
    status?: string,
): Promise<ClinicAccessRequest[]> {
    if (!clinicSupabaseConfigured) return []
    const q = supabase
        .from("access_requests")
        .select("*, pets(name, vet_id)")
        .order("created_at", { ascending: false })
    const { data, error } = status ? await q.eq("status", status) : await q
    if (error) return []
    return (data ?? []).map((r: Record<string, unknown>) => ({
        ...r,
        pet_name: (r.pets as { name?: string } | null)?.name,
        pet_vet_id: (r.pets as { vet_id?: string } | null)?.vet_id,
    })) as ClinicAccessRequest[]
}

export async function fetchClinicConsents(): Promise<ClinicConsent[]> {
    if (!clinicSupabaseConfigured) return []
    const { data, error } = await supabase
        .from("consents")
        .select("*, pets(name, vet_id)")
        .eq("status", "active")
        .order("granted_at", { ascending: false })
    if (error) return []
    return (data ?? []).map((r: Record<string, unknown>) => ({
        ...r,
        pet_name: (r.pets as { name?: string } | null)?.name,
        pet_vet_id: (r.pets as { vet_id?: string } | null)?.vet_id,
    })) as ClinicConsent[]
}
