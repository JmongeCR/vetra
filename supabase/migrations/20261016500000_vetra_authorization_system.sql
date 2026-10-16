-- ============================================================================
-- Migration: veterinary authorization / consent system
-- Created:   2026-10-16
-- Status:    PENDING — do NOT execute without authorization
-- ============================================================================
-- Creates the tables that power the authorization flow between clinic staff
-- and pet owners:
--
--   clinics          — registered veterinary clinics
--   clinic_users     — clinic staff (admin | vet | reception)
--   access_requests  — clinic asks owner for permission to view pet data
--   consents         — approved access grants (owner → clinic per pet)
--   access_audit     — immutable log of every access event
--
-- Authorization scopes:
--   basic_data            name, species, breed, sex, birthdate, color
--   vaccines              vaccination history (future)
--   medical_history       full clinical history (future)
--   shared_consultations  consultations shared by this clinic
--   authorized_documents  documents the owner explicitly shares

-- ── Helper ───────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- ── clinics ──────────────────────────────────────────────────────────────────

CREATE TABLE clinics (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name              TEXT        NOT NULL,
    address           TEXT,
    phone             TEXT,
    email             TEXT,
    registration_code TEXT        UNIQUE,
    is_active         BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_clinics_updated_at
    BEFORE UPDATE ON clinics
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── clinic_users ─────────────────────────────────────────────────────────────

CREATE TABLE clinic_users (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id    UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    auth_user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role         TEXT NOT NULL DEFAULT 'vet'
                     CHECK (role IN ('admin', 'vet', 'reception')),
    display_name TEXT,
    is_active    BOOLEAN NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_clinic_users_clinic ON clinic_users(clinic_id);

-- ── access_requests ──────────────────────────────────────────────────────────

CREATE TABLE access_requests (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id    UUID        NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    pet_id       UUID        NOT NULL REFERENCES pets(id)    ON DELETE CASCADE,
    requested_by UUID        REFERENCES clinic_users(id)     ON DELETE SET NULL,
    scopes       TEXT[]      NOT NULL,
    message      TEXT,
    status       TEXT        NOT NULL DEFAULT 'pending'
                                 CHECK (status IN ('pending','approved','rejected','expired')),
    expires_at   TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT access_requests_scopes_valid
        CHECK (scopes <@ ARRAY['basic_data','vaccines','medical_history',
                               'shared_consultations','authorized_documents']::TEXT[])
);

CREATE INDEX idx_access_requests_pet    ON access_requests(pet_id);
CREATE INDEX idx_access_requests_clinic ON access_requests(clinic_id);
CREATE INDEX idx_access_requests_status ON access_requests(status) WHERE status = 'pending';

CREATE TRIGGER trg_access_requests_updated_at
    BEFORE UPDATE ON access_requests
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── consents ─────────────────────────────────────────────────────────────────

CREATE TABLE consents (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    access_request_id UUID        UNIQUE REFERENCES access_requests(id) ON DELETE SET NULL,
    clinic_id         UUID        NOT NULL REFERENCES clinics(id)   ON DELETE CASCADE,
    pet_id            UUID        NOT NULL REFERENCES pets(id)       ON DELETE CASCADE,
    owner_profile_id  UUID        NOT NULL REFERENCES profiles(id)   ON DELETE CASCADE,
    scopes            TEXT[]      NOT NULL,
    status            TEXT        NOT NULL DEFAULT 'active'
                                      CHECK (status IN ('active','revoked','expired')),
    granted_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at        TIMESTAMPTZ,
    revoked_at        TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_consents_pet     ON consents(pet_id);
CREATE INDEX idx_consents_clinic  ON consents(clinic_id);
CREATE INDEX idx_consents_owner   ON consents(owner_profile_id);
CREATE INDEX idx_consents_status  ON consents(status) WHERE status = 'active';

CREATE TRIGGER trg_consents_updated_at
    BEFORE UPDATE ON consents
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── access_audit ─────────────────────────────────────────────────────────────
-- Append-only. No UPDATE or DELETE allowed.

CREATE TABLE access_audit (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    consent_id     UUID        REFERENCES consents(id)      ON DELETE SET NULL,
    clinic_id      UUID        NOT NULL REFERENCES clinics(id),
    pet_id         UUID        NOT NULL REFERENCES pets(id),
    clinic_user_id UUID        REFERENCES clinic_users(id)  ON DELETE SET NULL,
    action         TEXT        NOT NULL,
    metadata       JSONB,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_access_audit_consent ON access_audit(consent_id);
CREATE INDEX idx_access_audit_pet     ON access_audit(pet_id);

-- ── Row Level Security ────────────────────────────────────────────────────────

ALTER TABLE clinics          ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_users     ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_requests  ENABLE ROW LEVEL SECURITY;
ALTER TABLE consents         ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_audit     ENABLE ROW LEVEL SECURITY;

-- Helper: is the current user a member of a given clinic?
CREATE OR REPLACE FUNCTION is_clinic_member(p_clinic_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
    SELECT EXISTS (
        SELECT 1 FROM clinic_users
        WHERE clinic_id = p_clinic_id AND auth_user_id = auth.uid() AND is_active
    );
$$;
REVOKE EXECUTE ON FUNCTION is_clinic_member(UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION is_clinic_member(UUID) TO authenticated;

-- clinics: staff can read their clinic
CREATE POLICY "clinics: staff read"
    ON clinics FOR SELECT USING (is_clinic_member(id));

-- clinic_users: read own clinic's staff
CREATE POLICY "clinic_users: read own clinic"
    ON clinic_users FOR SELECT USING (is_clinic_member(clinic_id));

-- access_requests: owners see requests for their pets
CREATE POLICY "access_requests: owner read"
    ON access_requests FOR SELECT
    USING (is_guardian_of(pet_id));

-- access_requests: owner can update status (approve/reject)
CREATE POLICY "access_requests: owner update status"
    ON access_requests FOR UPDATE
    USING (is_guardian_of(pet_id));

-- access_requests: clinic staff can insert
CREATE POLICY "access_requests: clinic staff insert"
    ON access_requests FOR INSERT
    WITH CHECK (is_clinic_member(clinic_id));

-- consents: owner can read and revoke their own
CREATE POLICY "consents: owner read"
    ON consents FOR SELECT
    USING (owner_profile_id IN (
        SELECT id FROM profiles WHERE auth_user_id = auth.uid()
    ));

CREATE POLICY "consents: owner update (revoke)"
    ON consents FOR UPDATE
    USING (owner_profile_id IN (
        SELECT id FROM profiles WHERE auth_user_id = auth.uid()
    ));

-- consents: clinic staff can read consents for their clinic
CREATE POLICY "consents: clinic staff read"
    ON consents FOR SELECT
    USING (is_clinic_member(clinic_id));

-- access_audit: append only via service_role; no direct client writes
CREATE POLICY "access_audit: nobody writes directly"
    ON access_audit FOR INSERT WITH CHECK (FALSE);

CREATE POLICY "access_audit: owner reads their pet's audit"
    ON access_audit FOR SELECT
    USING (is_guardian_of(pet_id));
