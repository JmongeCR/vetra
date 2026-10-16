-- ============================================================================
-- Migration: clinic registration fields + atomic register_clinic() function
-- Created:   2026-10-16
-- Status:    PENDING — do NOT execute without authorization
-- ============================================================================
-- Extends the clinics table with Costa Rica address fields and a
-- verification_status column. Adds the register_clinic() SECURITY DEFINER
-- function so the frontend never touches the DB directly with admin privileges.

-- ── Extend clinics ────────────────────────────────────────────────────────────

ALTER TABLE clinics
    ADD COLUMN IF NOT EXISTS legal_id            TEXT,
    ADD COLUMN IF NOT EXISTS province            TEXT,
    ADD COLUMN IF NOT EXISTS canton              TEXT,
    ADD COLUMN IF NOT EXISTS district            TEXT,
    ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT 'pending_verification';

ALTER TABLE clinics
    ADD CONSTRAINT clinics_verification_status_valid
        CHECK (verification_status IN ('pending_verification', 'verified', 'suspended'));

-- Optional: prevent duplicate legal_id across clinics
CREATE UNIQUE INDEX IF NOT EXISTS idx_clinics_legal_id
    ON clinics(legal_id) WHERE legal_id IS NOT NULL;

-- ── register_clinic() ─────────────────────────────────────────────────────────
-- Called by authenticated clinic staff on first sign-in.
-- Atomically:
--   1. Verifies the caller is not already in clinic_users.
--   2. Checks legal_id is not already registered (if provided).
--   3. INSERTs a new clinic with verification_status = 'pending_verification'.
--   4. INSERTs a clinic_users row with role = 'admin'.
-- Returns the new clinic UUID.
-- SECURITY DEFINER so it runs as the DB owner and can bypass RLS for the
-- INSERT — no client-facing INSERT policy is needed on clinics.

CREATE OR REPLACE FUNCTION register_clinic(
    p_name     TEXT,
    p_legal_id TEXT,
    p_email    TEXT,
    p_phone    TEXT,
    p_address  TEXT,
    p_province TEXT,
    p_canton   TEXT,
    p_district TEXT
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_clinic_id UUID;
BEGIN
    -- Prevent a user registering more than one clinic
    IF EXISTS (
        SELECT 1 FROM clinic_users WHERE auth_user_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'user_already_registered';
    END IF;

    -- Basic name validation
    IF p_name IS NULL OR char_length(trim(p_name)) < 2 THEN
        RAISE EXCEPTION 'invalid_clinic_name';
    END IF;

    -- Prevent duplicate legal_id
    IF p_legal_id IS NOT NULL AND trim(p_legal_id) <> '' AND EXISTS (
        SELECT 1 FROM clinics WHERE legal_id = trim(p_legal_id)
    ) THEN
        RAISE EXCEPTION 'legal_id_already_registered';
    END IF;

    INSERT INTO clinics (
        name, legal_id, email, phone, address, province, canton, district,
        verification_status
    ) VALUES (
        trim(p_name),
        NULLIF(trim(p_legal_id), ''),
        NULLIF(trim(p_email),    ''),
        NULLIF(trim(p_phone),    ''),
        NULLIF(trim(p_address),  ''),
        NULLIF(trim(p_province), ''),
        NULLIF(trim(p_canton),   ''),
        NULLIF(trim(p_district), ''),
        'pending_verification'
    )
    RETURNING id INTO v_clinic_id;

    INSERT INTO clinic_users (clinic_id, auth_user_id, role, is_active)
    VALUES (v_clinic_id, auth.uid(), 'admin', TRUE);

    RETURN v_clinic_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION register_clinic(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION register_clinic(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) TO authenticated;
