import { createClient } from "@supabase/supabase-js"

const URL  = import.meta.env.PUBLIC_SUPABASE_URL     as string | undefined
const KEY  = import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string | undefined
const SITE = import.meta.env.PUBLIC_SITE_URL          as string | undefined

export const clinicSupabaseConfigured = Boolean(
    URL?.startsWith("https://") && KEY?.length,
)

/**
 * Base URL of this app — used as emailRedirectTo for password reset and
 * email confirmation. Must be set as PUBLIC_SITE_URL in Vercel env vars.
 * Falls back to window.location.origin at runtime if the variable is absent.
 */
export const clinicSiteUrl: string =
    SITE?.replace(/\/$/, "") ||
    (typeof window !== "undefined" ? window.location.origin : "https://vetra-beta.vercel.app")

// Clinic app uses Supabase built-in email/password auth (not the custom Cavos JWT).
// auth.uid() in DB returns the Supabase user UUID from the standard session JWT.
export const supabase = clinicSupabaseConfigured
    ? createClient(URL!, KEY!, {
          auth: { persistSession: true, storageKey: "vetra_clinic:session" },
      })
    : createClient("https://placeholder.supabase.co", "placeholder", {
          auth: { persistSession: false },
      })
