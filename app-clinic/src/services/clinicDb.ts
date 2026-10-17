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

/**
 * Return the current access status for a specific (clinicId, petId) pair.
 *
 * Checks consents first (approved → "authorized"), then falls back to the
 * most-recent access_request status for that pair.
 * Returns null when no request has ever been made.
 */
export type PetAccessStatus =
    | "authorized"   // active consent exists
    | "pending"      // request submitted, owner has not acted yet
    | "rejected"     // owner rejected the last request
    | "expired"      // request or consent expired
    | "revoked"      // consent was revoked by the owner
    | null           // no request on record

export async function fetchPetAccessStatus(
    clinicId: string,
    petId: string,
): Promise<PetAccessStatus> {
    if (!clinicSupabaseConfigured) return null

    // 1. Check for an active consent (takes priority)
    const { data: consent } = await supabase
        .from("consents")
        .select("status, expires_at")
        .eq("clinic_id", clinicId)
        .eq("pet_id", petId)
        .order("granted_at", { ascending: false })
        .limit(1)
        .maybeSingle()

    if (consent) {
        if (consent.status === "revoked") return "revoked"
        if (consent.status === "expired") return "expired"
        if (consent.expires_at && new Date(consent.expires_at as string) < new Date()) return "expired"
        if (consent.status === "active") return "authorized"
    }

    // 2. Fall back to the most recent access_request
    const { data: request } = await supabase
        .from("access_requests")
        .select("status, expires_at")
        .eq("clinic_id", clinicId)
        .eq("pet_id", petId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()

    if (!request) return null
    if (request.expires_at && new Date(request.expires_at as string) < new Date()) return "expired"
    return request.status as PetAccessStatus
}

// ── Cross-clinic history (shared_consultations scope) ────────────────────────

export interface AuthorizedConsultation {
    id: string
    visit_date: string
    reason: string
    anamnesis: string | null
    physical_exam: string | null
    weight_kg: number | null
    temperature_c: number | null
    heart_rate_bpm: number | null
    respiratory_rate: number | null
    diagnosis: string | null
    treatment_plan: string | null
    observations: string | null
    follow_up_date: string | null
    source_clinic: string
    created_at: string
}

/**
 * Fetch consultations from other clinics for a pet identified by its
 * canonical pets.id (from consents / passport_view).
 *
 * The DB-level RPC `get_authorized_consultations` enforces:
 *   - caller is an active member of p_clinic_id
 *   - active consent with 'shared_consultations' scope exists
 * Returns [] on no-consent or any other error.
 */
export async function fetchAuthorizedHistory(
    clinicId: string,
    petId: string,
): Promise<AuthorizedConsultation[]> {
    if (!clinicSupabaseConfigured) return []
    const { data, error } = await supabase.rpc("get_authorized_consultations", {
        p_clinic_id: clinicId,
        p_pet_id: petId,
    })
    if (error) {
        if (error.message.includes("no_consent") || error.message.includes("not_authorized")) {
            return []
        }
        console.error("fetchAuthorizedHistory:", error.message)
        return []
    }
    return (data ?? []) as AuthorizedConsultation[]
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
