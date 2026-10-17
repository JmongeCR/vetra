import { supabase, clinicSupabaseConfigured } from "../lib/supabase"

export interface ClinicSettings {
    id: string
    name: string
    address: string | null
    phone: string | null
    email: string | null
    registration_code: string | null
    legal_id: string | null
    province: string | null
    canton: string | null
    district: string | null
    verification_status: "pending_verification" | "verified" | "suspended"
}

export type ClinicSettingsUpdate = Pick<
    ClinicSettings,
    "name" | "address" | "phone" | "email" | "legal_id" | "province" | "canton" | "district"
>

export async function fetchClinicSettings(
    clinicId: string,
): Promise<{ data: ClinicSettings | null; error?: string }> {
    if (!clinicSupabaseConfigured) return { data: null, error: "No configurado" }
    const { data, error } = await supabase
        .from("clinics")
        .select(
            "id, name, address, phone, email, registration_code, legal_id, province, canton, district, verification_status",
        )
        .eq("id", clinicId)
        .single()
    if (error) return { data: null, error: error.message }
    return { data: data as ClinicSettings }
}

export async function updateClinicSettings(
    clinicId: string,
    updates: ClinicSettingsUpdate,
): Promise<{ ok: boolean; error?: string }> {
    if (!clinicSupabaseConfigured) return { ok: false, error: "No configurado" }
    const { error } = await supabase.from("clinics").update(updates).eq("id", clinicId)
    if (error) return { ok: false, error: error.message }
    return { ok: true }
}
