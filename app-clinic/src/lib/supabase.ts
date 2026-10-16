import { createClient } from "@supabase/supabase-js"

const URL = import.meta.env.PUBLIC_SUPABASE_URL as string | undefined
const KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string | undefined

export const clinicSupabaseConfigured = Boolean(
    URL?.startsWith("https://") && KEY?.length,
)

// Clinic app uses Supabase built-in email OTP auth (not the custom Cavos JWT).
// auth.uid() in DB returns the Supabase user UUID from the standard session JWT.
export const supabase = clinicSupabaseConfigured
    ? createClient(URL!, KEY!, {
          auth: { persistSession: true, storageKey: "vetra_clinic:session" },
      })
    : createClient("https://placeholder.supabase.co", "placeholder", {
          auth: { persistSession: false },
      })
