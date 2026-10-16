import { supabase, clinicSupabaseConfigured } from "../lib/supabase"

export interface RegisterClinicInput {
    name: string
    legalId: string
    email: string
    phone: string
    address: string
    province: string
    canton: string
    district: string
}

const ERROR_MAP: Record<string, string> = {
    user_already_registered: "Tu usuario ya está asociado a una clínica.",
    invalid_clinic_name: "El nombre de la clínica debe tener al menos 2 caracteres.",
    legal_id_already_registered: "Esa cédula jurídica ya está registrada.",
}

export async function registerClinic(
    input: RegisterClinicInput,
): Promise<{ ok: true; clinicId: string } | { ok: false; error: string }> {
    if (!clinicSupabaseConfigured) return { ok: false, error: "Supabase no configurado." }

    const { data, error } = await supabase.rpc("register_clinic", {
        p_name:     input.name,
        p_legal_id: input.legalId,
        p_email:    input.email,
        p_phone:    input.phone,
        p_address:  input.address,
        p_province: input.province,
        p_canton:   input.canton,
        p_district: input.district,
    })

    if (error) {
        const msg =
            Object.entries(ERROR_MAP).find(([key]) => error.message.includes(key))?.[1]
            ?? error.message
        return { ok: false, error: msg }
    }

    return { ok: true, clinicId: data as string }
}
