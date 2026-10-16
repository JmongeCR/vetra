import { supabase, clinicSupabaseConfigured } from "../lib/supabase"

export type AppointmentStatus =
    | "scheduled"
    | "confirmed"
    | "in_progress"
    | "completed"
    | "cancelled"
    | "no_show"

export const STATUS_LABELS: Record<AppointmentStatus, string> = {
    scheduled: "Programada",
    confirmed: "Confirmada",
    in_progress: "En curso",
    completed: "Completada",
    cancelled: "Cancelada",
    no_show: "No asistió",
}

export const STATUS_COLORS: Record<AppointmentStatus, string> = {
    scheduled: "#3b82f6",
    confirmed: "#10b981",
    in_progress: "#f59e0b",
    completed: "#6b7280",
    cancelled: "#ef4444",
    no_show: "#9ca3af",
}

export interface Appointment {
    id: string
    clinic_id: string
    patient_id: string | null
    patient_name: string | null
    staff_id: string | null
    staff_name: string | null
    title: string
    reason: string | null
    starts_at: string
    ends_at: string
    status: AppointmentStatus
    notes: string | null
    created_at: string
}

export interface ClinicStaff {
    id: string
    display_name: string | null
    role: string
}

export async function listStaff(clinicId: string): Promise<ClinicStaff[]> {
    if (!clinicSupabaseConfigured) return []
    const { data, error } = await supabase
        .from("clinic_users")
        .select("id, display_name, role")
        .eq("clinic_id", clinicId)
        .eq("is_active", true)
        .order("display_name", { ascending: true })
    if (error) return []
    return (data ?? []) as ClinicStaff[]
}

export async function listAppointments(
    clinicId: string,
    from: string,
    to: string,
): Promise<Appointment[]> {
    if (!clinicSupabaseConfigured) return []
    const { data, error } = await supabase
        .from("appointments")
        .select(`
            id, clinic_id, patient_id, staff_id, title, reason,
            starts_at, ends_at, status, notes, created_at,
            clinic_patients!patient_id(name),
            clinic_users!staff_id(display_name)
        `)
        .eq("clinic_id", clinicId)
        .gte("starts_at", from)
        .lte("starts_at", to)
        .order("starts_at", { ascending: true })
    if (error) {
        console.error("listAppointments:", error.message)
        return []
    }
    return (data ?? []).map((r: Record<string, unknown>) => ({
        id: r.id,
        clinic_id: r.clinic_id,
        patient_id: r.patient_id,
        staff_id: r.staff_id,
        title: r.title,
        reason: r.reason,
        starts_at: r.starts_at,
        ends_at: r.ends_at,
        status: r.status,
        notes: r.notes,
        created_at: r.created_at,
        patient_name: (r.clinic_patients as { name?: string } | null)?.name ?? null,
        staff_name: (r.clinic_users as { display_name?: string } | null)?.display_name ?? null,
    })) as Appointment[]
}

export interface CreateAppointmentInput {
    clinic_id: string
    patient_id?: string | null
    staff_id?: string | null
    title: string
    reason?: string
    starts_at: string
    ends_at: string
    notes?: string
    created_by: string
}

export async function createAppointment(
    input: CreateAppointmentInput,
): Promise<{ ok: true; appointment: Appointment } | { ok: false; error: string }> {
    if (!clinicSupabaseConfigured) return { ok: false, error: "Supabase no configurado" }
    const { data, error } = await supabase
        .from("appointments")
        .insert({
            clinic_id: input.clinic_id,
            patient_id: input.patient_id || null,
            staff_id: input.staff_id || null,
            title: input.title.trim(),
            reason: input.reason?.trim() || null,
            starts_at: input.starts_at,
            ends_at: input.ends_at,
            notes: input.notes?.trim() || null,
            created_by: input.created_by,
            status: "scheduled",
        })
        .select("id, clinic_id, patient_id, staff_id, title, reason, starts_at, ends_at, status, notes, created_at")
        .single()
    if (error) return { ok: false, error: error.message }
    return {
        ok: true,
        appointment: { ...(data as object), patient_name: null, staff_name: null } as Appointment,
    }
}

export async function updateAppointment(
    id: string,
    input: Partial<Omit<CreateAppointmentInput, "clinic_id" | "created_by">>,
): Promise<{ ok: boolean; error?: string }> {
    if (!clinicSupabaseConfigured) return { ok: false, error: "Supabase no configurado" }
    const patch: Record<string, unknown> = {}
    if (input.patient_id !== undefined) patch.patient_id = input.patient_id || null
    if (input.staff_id !== undefined)   patch.staff_id = input.staff_id || null
    if (input.title !== undefined)      patch.title = input.title.trim()
    if (input.reason !== undefined)     patch.reason = input.reason?.trim() || null
    if (input.starts_at !== undefined)  patch.starts_at = input.starts_at
    if (input.ends_at !== undefined)    patch.ends_at = input.ends_at
    if (input.notes !== undefined)      patch.notes = input.notes?.trim() || null
    const { error } = await supabase.from("appointments").update(patch).eq("id", id)
    if (error) return { ok: false, error: error.message }
    return { ok: true }
}

export async function updateAppointmentStatus(
    id: string,
    status: AppointmentStatus,
): Promise<{ ok: boolean; error?: string }> {
    if (!clinicSupabaseConfigured) return { ok: false, error: "Supabase no configurado" }
    const { error } = await supabase.from("appointments").update({ status }).eq("id", id)
    if (error) return { ok: false, error: error.message }
    return { ok: true }
}
