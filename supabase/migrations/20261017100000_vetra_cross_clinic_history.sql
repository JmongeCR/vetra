-- ============================================================================
-- Migration: cross-clinic consultation history via shared_consultations scope
-- Created:   2026-10-17
-- Requires:  20261016500000_vetra_authorization_system.sql
--            20261016700000_vetra_clinical_system.sql
-- Status:    PENDING — do NOT execute without authorization
-- ============================================================================
--
-- Adds a SECURITY DEFINER RPC that returns consultations from other clinics
-- for a given pet, ONLY when the requesting clinic has an active consent with
-- the 'shared_consultations' scope approved by the owner.
--
-- Security guarantees:
--   • is_clinic_member() verified before any data access.
--   • Consent checked: active status + 'shared_consultations' in scopes + not expired.
--   • Returns only visit_date, clinical data and source clinic name.
--   • Never exposes owner name, phone, email or any PII.
--   • Never returns consultations from the requesting clinic itself.
--   • Read-only — no INSERT/UPDATE/DELETE.
-- ============================================================================

CREATE OR REPLACE FUNCTION get_authorized_consultations(
    p_clinic_id UUID,
    p_pet_id    UUID
)
RETURNS TABLE (
    id               UUID,
    visit_date       DATE,
    reason           TEXT,
    anamnesis        TEXT,
    physical_exam    TEXT,
    weight_kg        NUMERIC,
    temperature_c    NUMERIC,
    heart_rate_bpm   INTEGER,
    respiratory_rate INTEGER,
    diagnosis        TEXT,
    treatment_plan   TEXT,
    observations     TEXT,
    follow_up_date   DATE,
    source_clinic    TEXT,
    created_at       TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
    v_vet_id TEXT;
BEGIN
    -- 1. Caller must be an active member of the requesting clinic.
    IF NOT is_clinic_member(p_clinic_id) THEN
        RAISE EXCEPTION 'not_authorized';
    END IF;

    -- 2. Active consent with shared_consultations scope must exist.
    --    Checks: clinic_id, pet_id, status = 'active', scope present, not expired.
    IF NOT EXISTS (
        SELECT 1 FROM consents
        WHERE clinic_id  = p_clinic_id
          AND pet_id     = p_pet_id
          AND status     = 'active'
          AND 'shared_consultations' = ANY(scopes)
          AND (expires_at IS NULL OR expires_at > now())
    ) THEN
        RAISE EXCEPTION 'no_consent';
    END IF;

    -- 3. Resolve VET-ID from the canonical pets table.
    SELECT vet_id INTO v_vet_id FROM pets WHERE id = p_pet_id;
    IF NOT FOUND OR v_vet_id IS NULL THEN
        RAISE EXCEPTION 'pet_not_found';
    END IF;

    -- 4. Return consultations from other clinics for this VET-ID.
    --    Joins through clinic_patients.vet_id to find records from any clinic.
    --    Excludes: the requesting clinic's own consultations (no duplicates).
    --    Never returns owner PII (owner_name/phone/email not in result set).
    RETURN QUERY
        SELECT
            c.id,
            c.visit_date,
            c.reason,
            c.anamnesis,
            c.physical_exam,
            c.weight_kg,
            c.temperature_c,
            c.heart_rate_bpm,
            c.respiratory_rate,
            c.diagnosis,
            c.treatment_plan,
            c.observations,
            c.follow_up_date,
            cl.name AS source_clinic,
            c.created_at
        FROM consultations c
        JOIN clinic_patients cp
            ON  cp.id        = c.patient_id
            AND cp.clinic_id = c.clinic_id
        JOIN clinics cl
            ON  cl.id = c.clinic_id
        WHERE cp.vet_id   = v_vet_id
          AND c.clinic_id <> p_clinic_id
        ORDER BY c.visit_date DESC, c.created_at DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION get_authorized_consultations(UUID, UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION get_authorized_consultations(UUID, UUID) TO authenticated;
