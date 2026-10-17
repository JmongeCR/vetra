import { supabase, clinicSupabaseConfigured, clinicSiteUrl } from "../lib/supabase"

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

// ── Invitations ───────────────────────────────────────────────────────────────

export interface StaffInvitation {
    id: string
    email: string
    role: "admin" | "vet" | "reception"
    expires_at: string
    created_at: string
}

export type InvitationsResult =
    | { ok: true; data: StaffInvitation[] }
    | { ok: false; migrationPending: true }
    | { ok: false; error: string }

export async function listInvitations(): Promise<InvitationsResult> {
    if (!clinicSupabaseConfigured) return { ok: false, error: "No configurado" }
    const { data, error } = await supabase.rpc("get_pending_invitations")
    if (error) {
        if (error.message.includes("does not exist") || error.message.includes("no existe")) {
            return { ok: false, migrationPending: true }
        }
        return { ok: false, error: error.message }
    }
    return { ok: true, data: (data ?? []) as StaffInvitation[] }
}

export async function createInvitation(
    email: string,
    role: "admin" | "vet" | "reception",
): Promise<{ ok: boolean; invitationId?: string; token?: string; error?: string; migrationPending?: boolean }> {
    if (!clinicSupabaseConfigured) return { ok: false, error: "No configurado" }
    const { data, error } = await supabase.rpc("create_staff_invitation", {
        p_email: email,
        p_role: role,
    })
    if (error) {
        if (error.message.includes("does not exist") || error.message.includes("no existe")) {
            return { ok: false, migrationPending: true }
        }
        if (error.message.includes("already_member"))  return { ok: false, error: "ya es miembro de esta clínica" }
        if (error.message.includes("not_authorized"))  return { ok: false, error: "no tenés permisos para invitar colaboradores" }
        if (error.message.includes("invalid_role"))    return { ok: false, error: "rol inválido" }
        if (error.message.includes("invalid_email"))   return { ok: false, error: "email inválido" }
        return { ok: false, error: error.message }
    }
    const row = Array.isArray(data) ? (data as Record<string, string>[])[0] : (data as Record<string, string> | null)
    return { ok: true, invitationId: row?.invitation_id, token: row?.invitation_token }
}

export async function cancelInvitation(id: string): Promise<{ ok: boolean; error?: string }> {
    if (!clinicSupabaseConfigured) return { ok: false, error: "No configurado" }
    const { error } = await supabase.rpc("cancel_staff_invitation", { p_id: id })
    if (error) {
        if (error.message.includes("invitation_not_found")) return { ok: false, error: "invitación no encontrada" }
        if (error.message.includes("not_authorized"))       return { ok: false, error: "no tenés permisos" }
        return { ok: false, error: error.message }
    }
    return { ok: true }
}

export async function acceptInvitation(token: string): Promise<{ ok: boolean; clinicName?: string; error?: string }> {
    if (!clinicSupabaseConfigured) return { ok: false, error: "No configurado" }
    const { data, error } = await supabase.rpc("accept_staff_invitation", { p_token: token })
    if (error) {
        if (error.message.includes("invitation_not_found"))   return { ok: false, error: "Invitación no encontrada" }
        if (error.message.includes("invitation_not_pending")) return { ok: false, error: "Esta invitación ya fue aceptada o cancelada" }
        if (error.message.includes("invitation_expired"))     return { ok: false, error: "La invitación expiró" }
        if (error.message.includes("email_mismatch"))         return { ok: false, error: "El correo de tu cuenta no coincide con la invitación" }
        if (error.message.includes("already_member"))         return { ok: false, error: "Ya sos miembro de una clínica" }
        if (error.message.includes("not_authenticated"))      return { ok: false, error: "Necesitás iniciar sesión primero" }
        return { ok: false, error: error.message }
    }
    return { ok: true, clinicName: (data as string | null) ?? undefined }
}

export async function sendInvitationEmail(
    email: string,
    token: string,
): Promise<{ ok: boolean; error?: string }> {
    const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
            emailRedirectTo: `${clinicSiteUrl}/unirse?token=${token}`,
            shouldCreateUser: true,
        },
    })
    if (error) return { ok: false, error: error.message }
    return { ok: true }
}
