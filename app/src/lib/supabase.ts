// Supabase client — Sprint 4
//
// Uses the PUBLIC_* anon key only. The service role key is NEVER exposed to
// the browser; it lives only in Supabase Edge Functions.
//
// Environment variables required in app/.env:
//   PUBLIC_SUPABASE_URL       — your project URL (https://<ref>.supabase.co)
//   PUBLIC_SUPABASE_ANON_KEY  — the anon/public key (safe to expose)
//
// When these variables are missing, `supabaseConfigured` is false and the app
// falls back to localStorage automatically (graceful degradation).

import { createClient, type SupabaseClient } from "@supabase/supabase-js"

const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL as string | undefined
const SUPABASE_ANON_KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string | undefined

/** True when the Supabase environment variables are present and look valid. */
export const supabaseConfigured = Boolean(
	SUPABASE_URL?.startsWith("https://") && SUPABASE_ANON_KEY?.length,
)

// ── Custom JWT store ──────────────────────────────────────────────────────────
// Tokens from auth-verify (Stellar ManageData challenge → HS256 JWT) are kept
// in localStorage so they survive page refreshes within the 1-hour TTL.
// The `accessToken` callback below passes them to every PostgREST / Storage
// request. Returning null tells supabase-js to fall back to the anon key —
// required so unauthenticated reads (public passport view) work correctly.

const JWT_STORAGE_KEY = "vetra:token"

interface StoredToken { token: string; expiresAt: number }

function _loadToken(): StoredToken | null {
	try {
		const raw = localStorage.getItem(JWT_STORAGE_KEY)
		return raw ? (JSON.parse(raw) as StoredToken) : null
	} catch { return null }
}

let _stored: StoredToken | null = _loadToken()

export function setSupabaseToken(token: string, expiresAt: number): void {
	_stored = { token, expiresAt }
	try { localStorage.setItem(JWT_STORAGE_KEY, JSON.stringify(_stored)) } catch {}
}

export function clearSupabaseToken(): void {
	_stored = null
	try { localStorage.removeItem(JWT_STORAGE_KEY) } catch {}
}

export function isSupabaseTokenValid(): boolean {
	if (!_stored) return false
	return _stored.expiresAt > Math.floor(Date.now() / 1000)
}

/** Base URL for Supabase Edge Functions. Null when Supabase is not configured. */
export const supabaseFunctionsUrl: string | null = supabaseConfigured
	? `${SUPABASE_URL}/functions/v1`
	: null

/** Return the current valid JWT, or null if expired / absent. */
export function getSupabaseAccessToken(): string | null {
	return isSupabaseTokenValid() ? _stored!.token : null
}

/** Supabase client. Always defined — but operations will fail gracefully when
 *  supabaseConfigured is false (the client is initialized with placeholder URLs). */
export const supabase: SupabaseClient = supabaseConfigured
	? createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
		// Custom JWT from auth-verify. Returning null falls back to anon key,
		// which is required for public passport reads (unauthenticated).
		accessToken: async () => isSupabaseTokenValid() ? _stored!.token : null,
		auth: { persistSession: false },
	})
	: createClient("https://placeholder.supabase.co", "placeholder", {
		auth: { persistSession: false },
	})
