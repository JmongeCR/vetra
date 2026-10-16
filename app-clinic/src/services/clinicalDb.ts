import { supabase, clinicSupabaseConfigured } from "../lib/supabase"

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ClinicalRecord {
    id: string
    clinic_id: string
    patient_id: string
    antecedents: string | null
    allergies: string | null
    notes: string | null
    updated_at: string
}

export interface Consultation {
    id: string
    clinic_id: string
    patient_id: string
    record_id: string
    appointment_id: string | null
    staff_id: string | null
    staff_name: string | null
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
    created_at: string
}

export interface Vaccination {
    id: string
    clinic_id: string
    patient_id: string
    vaccine_name: string
    vaccine_lot: string | null
    administered_date: string
    next_dose_date: string | null
    notes: string | null
    created_at: string
}

export type TreatmentStatus = "active" | "completed" | "suspended"

export interface Treatment {
    id: string
    clinic_id: string
    patient_id: string
    consultation_id: string | null
    medication: string
    dosage: string | null
    frequency: string | null
    start_date: string
    end_date: string | null
    status: TreatmentStatus
    notes: string | null
    created_at: string
}

// ── Clinical record ────────────────────────────────────────────────────────────

export async function getOrCreateRecord(
    clinicId: string,
    patientId: string,
): Promise<ClinicalRecord | null> {
    if (!clinicSupabaseConfigured) return null
    const { data: existing } = await supabase
        .from("clinical_records")
        .select("*")
        .eq("clinic_id", clinicId)
        .eq("patient_id", patientId)
        .maybeSingle()
    if (existing) return existing as ClinicalRecord
    const { data, error } = await supabase
        .from("clinical_records")
        .insert({ clinic_id: clinicId, patient_id: patientId })
        .select()
        .single()
    if (error) {
        console.error("getOrCreateRecord:", error.message)
        return null
    }
    return data as ClinicalRecord
}

export async function updateRecord(
    id: string,
    input: { antecedents?: string | null; allergies?: string | null; notes?: string | null },
): Promise<{ ok: boolean; error?: string }> {
    if (!clinicSupabaseConfigured) return { ok: false, error: "Supabase no configurado" }
    const { error } = await supabase
        .from("clinical_records")
        .update({
            antecedents: input.antecedents ?? null,
            allergies: input.allergies ?? null,
            notes: input.notes ?? null,
        })
        .eq("id", id)
    if (error) return { ok: false, error: error.message }
    return { ok: true }
}

// ── Consultations ──────────────────────────────────────────────────────────────

export async function listConsultations(patientId: string): Promise<Consultation[]> {
    if (!clinicSupabaseConfigured) return []
    const { data, error } = await supabase
        .from("consultations")
        .select("*, clinic_users!staff_id(display_name)")
        .eq("patient_id", patientId)
        .order("visit_date", { ascending: false })
    if (error) {
        console.error("listConsultations:", error.message)
        return []
    }
    return (data ?? []).map((r: Record<string, unknown>) => ({
        ...r,
        staff_name: (r.clinic_users as { display_name?: string } | null)?.display_name ?? null,
    })) as Consultation[]
}

export interface CreateConsultationInput {
    clinic_id: string
    patient_id: string
    record_id: string
    appointment_id?: string | null
    staff_id?: string | null
    visit_date: string
    reason: string
    anamnesis?: string
    physical_exam?: string
    weight_kg?: number | null
    temperature_c?: number | null
    heart_rate_bpm?: number | null
    respiratory_rate?: number | null
    diagnosis?: string
    treatment_plan?: string
    observations?: string
    follow_up_date?: string | null
}

export async function createConsultation(
    input: CreateConsultationInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
    if (!clinicSupabaseConfigured) return { ok: false, error: "Supabase no configurado" }
    const { data, error } = await supabase
        .from("consultations")
        .insert({
            clinic_id: input.clinic_id,
            patient_id: input.patient_id,
            record_id: input.record_id,
            appointment_id: input.appointment_id || null,
            staff_id: input.staff_id || null,
            visit_date: input.visit_date,
            reason: input.reason.trim(),
            anamnesis: input.anamnesis?.trim() || null,
            physical_exam: input.physical_exam?.trim() || null,
            weight_kg: input.weight_kg ?? null,
            temperature_c: input.temperature_c ?? null,
            heart_rate_bpm: input.heart_rate_bpm ?? null,
            respiratory_rate: input.respiratory_rate ?? null,
            diagnosis: input.diagnosis?.trim() || null,
            treatment_plan: input.treatment_plan?.trim() || null,
            observations: input.observations?.trim() || null,
            follow_up_date: input.follow_up_date || null,
        })
        .select("id")
        .single()
    if (error) return { ok: false, error: error.message }
    return { ok: true, id: (data as { id: string }).id }
}

// ── Vaccinations ───────────────────────────────────────────────────────────────

export async function listVaccinations(patientId: string): Promise<Vaccination[]> {
    if (!clinicSupabaseConfigured) return []
    const { data, error } = await supabase
        .from("vaccinations")
        .select("*")
        .eq("patient_id", patientId)
        .order("administered_date", { ascending: false })
    if (error) return []
    return (data ?? []) as Vaccination[]
}

export async function createVaccination(input: {
    clinic_id: string
    patient_id: string
    vaccine_name: string
    vaccine_lot?: string
    administered_date: string
    next_dose_date?: string
    notes?: string
}): Promise<{ ok: boolean; error?: string }> {
    if (!clinicSupabaseConfigured) return { ok: false, error: "Supabase no configurado" }
    const { error } = await supabase.from("vaccinations").insert({
        clinic_id: input.clinic_id,
        patient_id: input.patient_id,
        vaccine_name: input.vaccine_name.trim(),
        vaccine_lot: input.vaccine_lot?.trim() || null,
        administered_date: input.administered_date,
        next_dose_date: input.next_dose_date || null,
        notes: input.notes?.trim() || null,
    })
    if (error) return { ok: false, error: error.message }
    return { ok: true }
}

// ── Treatments ─────────────────────────────────────────────────────────────────

export async function listTreatments(patientId: string): Promise<Treatment[]> {
    if (!clinicSupabaseConfigured) return []
    const { data, error } = await supabase
        .from("treatments")
        .select("*")
        .eq("patient_id", patientId)
        .order("created_at", { ascending: false })
    if (error) return []
    return (data ?? []) as Treatment[]
}

export async function createTreatment(input: {
    clinic_id: string
    patient_id: string
    consultation_id?: string
    medication: string
    dosage?: string
    frequency?: string
    start_date: string
    end_date?: string
    notes?: string
}): Promise<{ ok: boolean; error?: string }> {
    if (!clinicSupabaseConfigured) return { ok: false, error: "Supabase no configurado" }
    const { error } = await supabase.from("treatments").insert({
        clinic_id: input.clinic_id,
        patient_id: input.patient_id,
        consultation_id: input.consultation_id || null,
        medication: input.medication.trim(),
        dosage: input.dosage?.trim() || null,
        frequency: input.frequency?.trim() || null,
        start_date: input.start_date,
        end_date: input.end_date || null,
        notes: input.notes?.trim() || null,
        status: "active",
    })
    if (error) return { ok: false, error: error.message }
    return { ok: true }
}

export async function updateTreatmentStatus(
    id: string,
    status: TreatmentStatus,
): Promise<{ ok: boolean; error?: string }> {
    if (!clinicSupabaseConfigured) return { ok: false, error: "Supabase no configurado" }
    const { error } = await supabase.from("treatments").update({ status }).eq("id", id)
    if (error) return { ok: false, error: error.message }
    return { ok: true }
}
