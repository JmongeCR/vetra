import { useState, useEffect, useCallback } from "react"
import type { User } from "@supabase/supabase-js"
import { supabase, clinicSupabaseConfigured } from "../lib/supabase"

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
    /** True when user is authenticated but has no clinic_users row */
    needsRegistration: boolean
    loading: boolean
    memberError: string | null
    signInWithEmail: (email: string) => Promise<{ ok: boolean; error?: string }>
    signOut: () => Promise<void>
    /** Re-fetch clinic membership — call after register_clinic() succeeds */
    refreshMembership: () => Promise<void>
}

export function useClinicAuth(): ClinicAuthState {
    const [user, setUser] = useState<User | null>(null)
    const [member, setMember] = useState<ClinicMember | null>(null)
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
            // Authenticated but no clinic_users row → prompt registration
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

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
            const u = session?.user ?? null
            setUser(u)
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

    async function signInWithEmail(email: string) {
        if (!clinicSupabaseConfigured) return { ok: false, error: "Supabase no configurado" }
        const { error } = await supabase.auth.signInWithOtp({
            email,
            options: { shouldCreateUser: true },
        })
        if (error) return { ok: false, error: error.message }
        return { ok: true }
    }

    async function signOut() {
        await supabase.auth.signOut()
    }

    return {
        user,
        member,
        needsRegistration,
        loading,
        memberError,
        signInWithEmail,
        signOut,
        refreshMembership: loadMembership,
    }
}
