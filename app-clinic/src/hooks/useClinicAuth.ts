import { useState, useEffect, useCallback } from "react"
import type { User } from "@supabase/supabase-js"
import { supabase, clinicSupabaseConfigured, clinicSiteUrl } from "../lib/supabase"

export interface ClinicMember {
    id: string
    clinicId: string
    clinicName: string
    verificationStatus: "pending_verification" | "verified" | "suspended"
    role: "admin" | "vet" | "reception"
    displayName: string | null
}

export interface ClinicAuthState {
    user: User | null
    member: ClinicMember | null
    /** True while recovering password (PASSWORD_RECOVERY event active) */
    recoveryMode: boolean
    /** True when user is authenticated but has no clinic_users row */
    needsRegistration: boolean
    loading: boolean
    memberError: string | null
    signInWithPassword: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>
    signUp: (email: string, password: string) => Promise<{ ok: boolean; error?: string; emailConfirmationRequired?: boolean }>
    sendPasswordReset: (email: string) => Promise<{ ok: boolean; error?: string }>
    updatePassword: (password: string) => Promise<{ ok: boolean; error?: string }>
    signOut: () => Promise<void>
    /** Re-fetch clinic membership — call after register_clinic() succeeds */
    refreshMembership: () => Promise<void>
}

export function useClinicAuth(): ClinicAuthState {
    const [user, setUser] = useState<User | null>(null)
    const [member, setMember] = useState<ClinicMember | null>(null)
    const [recoveryMode, setRecoveryMode] = useState(false)
    const [needsRegistration, setNeedsRegistration] = useState(false)
    const [loading, setLoading] = useState(true)
    const [memberError, setMemberError] = useState<string | null>(null)

    const loadMembership = useCallback(async () => {
        setLoading(true)
        const { data, error } = await supabase
            .from("clinic_users")
            .select("id, clinic_id, role, display_name, clinics(name, verification_status)")
            .maybeSingle()

        if (!error && !data) {
            setNeedsRegistration(true)
            setMember(null)
            setMemberError(null)
        } else if (error) {
            setNeedsRegistration(false)
            setMember(null)
            setMemberError("Error al verificar membresía de clínica.")
        } else {
            const row = data as unknown as {
                id: string
                clinic_id: string
                role: "admin" | "vet" | "reception"
                display_name: string | null
                clinics:
                    | { name: string; verification_status: string }
                    | { name: string; verification_status: string }[]
                    | null
            }
            const clinic = Array.isArray(row.clinics) ? row.clinics[0] : row.clinics
            setMember({
                id: row.id,
                clinicId: row.clinic_id,
                clinicName: clinic?.name ?? "Clínica",
                verificationStatus: (clinic?.verification_status as ClinicMember["verificationStatus"]) ?? "pending_verification",
                role: row.role,
                displayName: row.display_name,
            })
            setNeedsRegistration(false)
            setMemberError(null)
        }
        setLoading(false)
    }, [])

    useEffect(() => {
        if (!clinicSupabaseConfigured) { setLoading(false); return }

        supabase.auth.getSession().then(({ data: { session } }) => {
            const u = session?.user ?? null
            setUser(u)
            if (u) void loadMembership()
            else setLoading(false)
        })

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            const u = session?.user ?? null
            setUser(u)

            if (event === "PASSWORD_RECOVERY") {
                // Block normal app flow while user sets a new password.
                setRecoveryMode(true)
                setLoading(false)
                return
            }

            setRecoveryMode(false)

            if (u) {
                void loadMembership()
            } else {
                setMember(null)
                setNeedsRegistration(false)
                setMemberError(null)
                setLoading(false)
            }
        })
        return () => subscription.unsubscribe()
    }, [loadMembership])

    // ── Auth actions ─────────────────────────────────────────────────────────────

    async function signInWithPassword(email: string, password: string) {
        if (!clinicSupabaseConfigured) return { ok: false, error: "Supabase no configurado" }
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) return { ok: false, error: _authError(error.message) }
        return { ok: true }
    }

    async function signUp(email: string, password: string) {
        if (!clinicSupabaseConfigured) return { ok: false, error: "Supabase no configurado" }
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                // Confirmation email will redirect back to the clinic app.
                emailRedirectTo: clinicSiteUrl,
            },
        })
        if (error) return { ok: false, error: _authError(error.message) }
        // session is null when email confirmation is required
        const emailConfirmationRequired = !data.session
        return { ok: true, emailConfirmationRequired }
    }

    async function sendPasswordReset(email: string) {
        if (!clinicSupabaseConfigured) return { ok: false, error: "Supabase no configurado" }
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: clinicSiteUrl,
        })
        if (error) return { ok: false, error: _authError(error.message) }
        return { ok: true }
    }

    async function updatePassword(password: string) {
        const { error } = await supabase.auth.updateUser({ password })
        if (error) return { ok: false, error: _authError(error.message) }
        setRecoveryMode(false)
        return { ok: true }
    }

    async function signOut() {
        await supabase.auth.signOut()
    }

    return {
        user,
        member,
        recoveryMode,
        needsRegistration,
        loading,
        memberError,
        signInWithPassword,
        signUp,
        sendPasswordReset,
        updatePassword,
        signOut,
        refreshMembership: loadMembership,
    }
}

// ── Error message normalization ───────────────────────────────────────────────

function _authError(msg: string): string {
    const m = msg.toLowerCase()
    if (m.includes("invalid login credentials") || m.includes("invalid credentials"))
        return "Correo o contraseña incorrectos."
    if (m.includes("email not confirmed"))
        return "Confirmá tu correo antes de ingresar. Revisá tu bandeja de entrada."
    if (m.includes("user already registered") || m.includes("already registered"))
        return "Ya existe una cuenta con ese correo. Iniciá sesión."
    if (m.includes("password should be"))
        return "La contraseña debe tener al menos 6 caracteres."
    if (m.includes("rate limit") || m.includes("too many"))
        return "Demasiados intentos. Esperá unos minutos."
    return msg
}
