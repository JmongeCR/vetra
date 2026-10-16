// authorizationDb — stub service for the Vetra authorization / consent system.
//
// The tables this service targets are defined in:
//   supabase/migrations/20261016500000_vetra_authorization_system.sql
//
// Status: PENDING MIGRATION — all functions return empty/null until the
// migration is applied and the tables exist.

import { supabase, supabaseConfigured, isSupabaseTokenValid } from "../lib/supabase"

// ── Types ─────────────────────────────────────────────────────────────────────

export type AuthScope =
	| "basic_data"
	| "vaccines"
	| "medical_history"
	| "shared_consultations"
	| "authorized_documents"

export type AccessRequestStatus = "pending" | "approved" | "rejected" | "expired"
export type ConsentStatus = "active" | "revoked" | "expired"

export interface AccessRequest {
	id: string
	clinic_id: string
	clinic_name?: string
	pet_id: string
	pet_name?: string
	scopes: AuthScope[]
	message: string | null
	status: AccessRequestStatus
	expires_at: string | null
	created_at: string
	updated_at: string
}

export interface Consent {
	id: string
	clinic_id: string
	clinic_name?: string
	pet_id: string
	pet_name?: string
	scopes: AuthScope[]
	status: ConsentStatus
	granted_at: string
	expires_at: string | null
	revoked_at: string | null
}

// ── Queries ──────────────────────────────────────────────────────────────────

export async function fetchAccessRequests(
	status?: AccessRequestStatus,
): Promise<AccessRequest[]> {
	if (!supabaseConfigured || !isSupabaseTokenValid()) return []
	const q = supabase
		.from("access_requests")
		.select("*, clinics(name), pets(name)")
		.order("created_at", { ascending: false })
	const { data, error } = status ? await q.eq("status", status) : await q
	if (error) return []
	return (data ?? []).map((r: Record<string, unknown>) => ({
		...r,
		clinic_name: (r.clinics as { name?: string } | null)?.name,
		pet_name: (r.pets as { name?: string } | null)?.name,
	})) as AccessRequest[]
}

export async function updateAccessRequestStatus(
	id: string,
	status: "approved" | "rejected",
): Promise<{ ok: boolean; error?: string }> {
	if (!supabaseConfigured || !isSupabaseTokenValid())
		return { ok: false, error: "No autenticado" }

	const fn = status === "approved" ? "approve_access_request" : "reject_access_request"
	const { error } = await supabase.rpc(fn, { p_request_id: id })
	if (error) return { ok: false, error: error.message }
	return { ok: true }
}

export async function fetchConsents(
	status?: ConsentStatus,
): Promise<Consent[]> {
	if (!supabaseConfigured || !isSupabaseTokenValid()) return []
	const q = supabase
		.from("consents")
		.select("*, clinics(name), pets(name)")
		.order("granted_at", { ascending: false })
	const { data, error } = status ? await q.eq("status", status) : await q
	if (error) return []
	return (data ?? []).map((r: Record<string, unknown>) => ({
		...r,
		clinic_name: (r.clinics as { name?: string } | null)?.name,
		pet_name: (r.pets as { name?: string } | null)?.name,
	})) as Consent[]
}

export async function revokeConsent(
	id: string,
): Promise<{ ok: boolean; error?: string }> {
	if (!supabaseConfigured || !isSupabaseTokenValid())
		return { ok: false, error: "No autenticado" }
	const { error } = await supabase
		.from("consents")
		.update({ status: "revoked", revoked_at: new Date().toISOString() })
		.eq("id", id)
	if (error) return { ok: false, error: error.message }
	return { ok: true }
}
