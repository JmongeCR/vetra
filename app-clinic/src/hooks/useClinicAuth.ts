import { useState, useEffect } from "react"
import type { User } from "@supabase/supabase-js"
import { supabase, clinicSupabaseConfigured } from "../lib/supabase"

export interface ClinicMember {
    id: string
    clinicId: string
    clinicName: string
    role: "admin" | "vet" | "reception"
    displayName: string | null
}

export interface ClinicAuthState {
    user: User | null
    member: ClinicMember | null
    loading: boolean
    memberError: string | null
    signInWithEmail: (email: string) => Promise<{ ok: boolean; error?: string }>
    signOut: () => Promise<void>
}

export function useClinicAuth(): ClinicAuthState {
    const [user, setUser] = useState<User | null>(null)
    const [member, setMember] = useState<ClinicMember | null>(null)
    const [loading, setLoading] = useState(true)
    const [memberError, setMemberError] = useState<string | null>(null)

    async function loadMembership() {
        const { data, error } = await supabase
            .from("clinic_users")
            .select("id, clinic_id, role, display_name, clinics(name)")
            .maybeSingle()
        if (error || !data) {
            setMemberError("No pertenecés a ninguna clínica registrada en Vetra.")
            setMember(null)
        } else {
            const row = data as unknown as {
                id: string
                clinic_id: string
                role: "admin" | "vet" | "reception"
                display_name: string | null
                clinics: { name: string } | { name: string }[] | null
            }
            setMember({
                id: row.id,
                clinicId: row.clinic_id,
                clinicName: (Array.isArray(row.clinics) ? row.clinics[0]?.name : row.clinics?.name) ?? "Clínica",
                role: row.role,
                displayName: row.display_name,
            })
            setMemberError(null)
        }
        setLoading(false)
    }

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
                setLoading(true)
                void loadMembership()
            } else {
                setMember(null)
                setMemberError(null)
                setLoading(false)
            }
        })
        return () => subscription.unsubscribe()
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    async function signInWithEmail(email: string) {
        if (!clinicSupabaseConfigured) return { ok: false, error: "Supabase no configurado" }
        const { error } = await supabase.auth.signInWithOtp({
            email,
            options: { shouldCreateUser: false },
        })
        if (error) return { ok: false, error: error.message }
        return { ok: true }
    }

    async function signOut() {
        await supabase.auth.signOut()
    }

    return { user, member, loading, memberError, signInWithEmail, signOut }
}
