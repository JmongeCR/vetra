import { supabase, clinicSupabaseConfigured } from "../lib/supabase"
import type { PatientSpecies, PatientSex } from "../types/patient"

export type { PatientSpecies, PatientSex }

export interface ClinicPatient {
    id: string
    clinic_id: string
    name: string
    species: PatientSpecies
    breed: string | null
    sex: PatientSex
    birth_date: string | null
    birth_date_estimated: boolean
    microchip: string | null
    vet_id: string | null
    owner_name: string
    owner_phone: string | null
    owner_email: string | null
    notes: string | null
    is_active: boolean
    created_at: string
    updated_at: string
}

export interface CreatePatientInput {
    clinic_id: string
    name: string
    species: PatientSpecies
    breed?: string
    sex: PatientSex
    birth_date?: string
    birth_date_estimated?: boolean
    microchip?: string
    vet_id?: string
    owner_name: string
    owner_phone?: string
    owner_email?: string
    notes?: string
}

export async function listPatients(clinicId: string): Promise<ClinicPatient[]> {
    if (!clinicSupabaseConfigured) return []
    const { data, error } = await supabase
        .from("clinic_patients")
        .select("*")
        .eq("clinic_id", clinicId)
        .eq("is_active", true)
        .order("name", { ascending: true })
    if (error) {
        console.error("listPatients:", error.message)
        return []
    }
    return (data ?? []) as ClinicPatient[]
}

export async function getPatient(id: string): Promise<ClinicPatient | null> {
    if (!clinicSupabaseConfigured) return null
    const { data, error } = await supabase
        .from("clinic_patients")
        .select("*")
        .eq("id", id)
        .maybeSingle()
    if (error || !data) return null
    return data as ClinicPatient
}

export async function createPatient(
    input: CreatePatientInput,
): Promise<{ ok: true; patient: ClinicPatient } | { ok: false; error: string }> {
    if (!clinicSupabaseConfigured) return { ok: false, error: "Supabase no configurado" }
    const { data, error } = await supabase
        .from("clinic_patients")
        .insert({
            clinic_id: input.clinic_id,
            name: input.name.trim(),
            species: input.species,
            breed: input.breed?.trim() || null,
            sex: input.sex,
            birth_date: input.birth_date || null,
            birth_date_estimated: input.birth_date_estimated ?? false,
            microchip: input.microchip?.trim() || null,
            vet_id: input.vet_id?.trim().toUpperCase() || null,
            owner_name: input.owner_name.trim(),
            owner_phone: input.owner_phone?.trim() || null,
            owner_email: input.owner_email?.trim() || null,
            notes: input.notes?.trim() || null,
        })
        .select()
        .single()
    if (error) return { ok: false, error: error.message }
    return { ok: true, patient: data as ClinicPatient }
}

export async function checkPatientByVetId(
    clinicId: string,
    vetId: string,
): Promise<{ id: string } | null> {
    if (!clinicSupabaseConfigured) return null
    const { data } = await supabase
        .from("clinic_patients")
        .select("id")
        .eq("clinic_id", clinicId)
        .eq("vet_id", vetId.trim().toUpperCase())
        .maybeSingle()
    return data ? { id: (data as { id: string }).id } : null
}

export async function updatePatient(
    id: string,
    input: Partial<Omit<CreatePatientInput, "clinic_id">>,
): Promise<{ ok: boolean; error?: string }> {
    if (!clinicSupabaseConfigured) return { ok: false, error: "Supabase no configurado" }
    const patch: Record<string, unknown> = {}
    if (input.name !== undefined)                  patch.name = input.name.trim()
    if (input.species !== undefined)               patch.species = input.species
    if (input.breed !== undefined)                 patch.breed = input.breed?.trim() || null
    if (input.sex !== undefined)                   patch.sex = input.sex
    if (input.birth_date !== undefined)            patch.birth_date = input.birth_date || null
    if (input.birth_date_estimated !== undefined)  patch.birth_date_estimated = input.birth_date_estimated
    if (input.microchip !== undefined)             patch.microchip = input.microchip?.trim() || null
    if (input.vet_id !== undefined)                patch.vet_id = input.vet_id?.trim().toUpperCase() || null
    if (input.owner_name !== undefined)            patch.owner_name = input.owner_name.trim()
    if (input.owner_phone !== undefined)           patch.owner_phone = input.owner_phone?.trim() || null
    if (input.owner_email !== undefined)           patch.owner_email = input.owner_email?.trim() || null
    if (input.notes !== undefined)                 patch.notes = input.notes?.trim() || null
    const { error } = await supabase.from("clinic_patients").update(patch).eq("id", id)
    if (error) return { ok: false, error: error.message }
    return { ok: true }
}
