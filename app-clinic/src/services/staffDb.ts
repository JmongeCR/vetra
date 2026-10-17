import { supabase, clinicSupabaseConfigured } from "../lib/supabase"

export interface StaffMember {
    id: string
    clinic_id: string
    auth_user_id: string
    role: "admin" | "vet" | "reception"
    display_name: string | null
    is_active: boolean
    created_at: string
    email: string | null
}

export async function listStaff(): Promise<{ data: StaffMember[]; error?: string }> {
    if (!clinicSupabaseConfigured) return { data: [], error: "No configurado" }
    const { data, error } = await supabase.rpc("get_clinic_staff")
    if (error) return { data: [], error: error.message }
    return { data: (data as StaffMember[]) ?? [] }
}

export async function updateStaffRole(
    memberId: string,
    role: "admin" | "vet" | "reception",
): Promise<{ ok: boolean; error?: string }> {
    if (!clinicSupabaseConfigured) return { ok: false, error: "No configurado" }
    const { error } = await supabase
        .from("clinic_users")
        .update({ role })
        .eq("id", memberId)
    if (error) return { ok: false, error: error.message }
    return { ok: true }
}

export async function updateStaffActive(
    memberId: string,
    isActive: boolean,
): Promise<{ ok: boolean; error?: string }> {
    if (!clinicSupabaseConfigured) return { ok: false, error: "No configurado" }
    const { error } = await supabase
        .from("clinic_users")
        .update({ is_active: isActive })
        .eq("id", memberId)
    if (error) return { ok: false, error: error.message }
    return { ok: true }
}
