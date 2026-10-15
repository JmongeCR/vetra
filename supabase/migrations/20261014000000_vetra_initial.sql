-- ============================================================================
-- Vetra — Initial schema migration
-- Sprint 4: Central pet identity database
-- Network: Stellar TESTNET
--
-- Table hierarchy:
--   auth.users (Supabase managed)
--     └─ profiles          (one per Stellar address)
--           └─ pet_guardians (links profiles ↔ pets)
--                 └─ pets
--                       ├─ stellar_identities
--                       └─ public_passports
--
-- Security model:
--   - Every write is gated by auth.uid() via profiles.auth_user_id.
--   - Anonymous visitors may only read public_passports + the specific
--     pet fields that have been explicitly made public.
--   - No clinical data, no sensitive PII stored in this schema.
-- ============================================================================

-- ── Extensions ──────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- gen_random_uuid() on older PG

-- ── Helpers ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- ── profiles ─────────────────────────────────────────────────────────────────
-- One profile per Supabase Auth user. The auth_user_id ties this row to the
-- JWT sub (auth.uid()). stellar_address is the verified Stellar G… address
-- — verified by the auth-verify Edge Function before the row is created.

CREATE TABLE profiles (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id      UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    stellar_address   TEXT UNIQUE NOT NULL,  -- G… — verified cryptographically
    display_name      TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_profiles_stellar_address ON profiles(stellar_address);
CREATE INDEX idx_profiles_auth_user_id    ON profiles(auth_user_id);

CREATE TRIGGER trg_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── pets ─────────────────────────────────────────────────────────────────────
-- Core identity record. Deliberately excludes clinical data (weight, vaccines,
-- medications). Only publicly shareable identity fields live here.
--
-- photo_path: Supabase Storage object path (pets/{pet_id}/{filename}).
-- NOT base64 — images are stored in Storage, never in the database row.

CREATE TABLE pets (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vet_id                TEXT UNIQUE NOT NULL,          -- VET-XXXXXXXX
    name                  TEXT NOT NULL,
    species               TEXT NOT NULL CHECK (species IN
                              ('dog','cat','bird','rabbit','reptile','other')),
    breed                 TEXT,
    sex                   TEXT NOT NULL CHECK (sex IN ('male','female','unknown')),
    birth_date            DATE,
    birth_date_estimated  BOOLEAN NOT NULL DEFAULT FALSE,
    color                 TEXT NOT NULL,
    microchip             TEXT,
    photo_path            TEXT,                          -- Storage path, nullable
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pets_vet_id    ON pets(vet_id);
CREATE INDEX idx_pets_microchip ON pets(microchip) WHERE microchip IS NOT NULL;

CREATE TRIGGER trg_pets_updated_at
    BEFORE UPDATE ON pets
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── pet_guardians ─────────────────────────────────────────────────────────────
-- Many-to-many: a pet can have multiple responsible guardians; a guardian can
-- own multiple pets. Exactly one guardian has is_primary = true per pet.
--
-- relationship values:
--   'owner'       — legal owner / primary registrant
--   'caretaker'   — authorized caretaker (family member, pet-sitter)
--   'transfer'    — pending ownership transfer (future use)

CREATE TABLE pet_guardians (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pet_id         UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
    profile_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    relationship   TEXT NOT NULL DEFAULT 'owner'
                       CHECK (relationship IN ('owner','caretaker','transfer')),
    is_primary     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (pet_id, profile_id)
);

-- Enforce: at most one primary guardian per pet.
CREATE UNIQUE INDEX idx_pet_guardians_primary
    ON pet_guardians(pet_id)
    WHERE is_primary = TRUE;

CREATE INDEX idx_pet_guardians_profile ON pet_guardians(profile_id);
CREATE INDEX idx_pet_guardians_pet     ON pet_guardians(pet_id);

-- ── stellar_identities ────────────────────────────────────────────────────────
-- Tracks the state of each pet's Stellar Testnet registration.
-- One row per pet (pets may have at most one active Stellar identity).
-- Sprint 5 will populate this table after contract deployment.

CREATE TABLE stellar_identities (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pet_id           UUID UNIQUE NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
    network          TEXT NOT NULL DEFAULT 'testnet'
                         CHECK (network IN ('testnet')),  -- mainnet PROHIBITED
    contract_id      TEXT,                                -- Soroban contract address
    transaction_hash TEXT,                                -- TX hash when registered
    status           TEXT NOT NULL DEFAULT 'local'
                         CHECK (status IN ('local','pending','registered')),
    registered_at    TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_stellar_identities_pet    ON stellar_identities(pet_id);
CREATE INDEX idx_stellar_identities_status ON stellar_identities(status);

CREATE TRIGGER trg_stellar_identities_updated_at
    BEFORE UPDATE ON stellar_identities
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── public_passports ─────────────────────────────────────────────────────────
-- Controls which pets have a publicly accessible passport page.
-- is_public = true → the /pasaporte/:vetId route works from any device.
-- The actual data exposed is controlled by the RLS policy on this table and
-- the passport_view view below — NOT by trusting the client.

CREATE TABLE public_passports (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pet_id     UUID UNIQUE NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
    is_public  BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_public_passports_pet    ON public_passports(pet_id);
CREATE INDEX idx_public_passports_public ON public_passports(is_public) WHERE is_public = TRUE;

CREATE TRIGGER trg_public_passports_updated_at
    BEFORE UPDATE ON public_passports
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- Row Level Security
-- ============================================================================

ALTER TABLE profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE pets              ENABLE ROW LEVEL SECURITY;
ALTER TABLE pet_guardians     ENABLE ROW LEVEL SECURITY;
ALTER TABLE stellar_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public_passports  ENABLE ROW LEVEL SECURITY;

-- ── Helper function: is the current user a guardian of this pet? ─────────────
-- Used in multiple RLS policies. SECURITY DEFINER so it runs as the db owner,
-- not as the calling user (prevents privilege escalation via the function body).

CREATE OR REPLACE FUNCTION is_guardian_of(p_pet_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM pet_guardians pg
        JOIN profiles pr ON pg.profile_id = pr.id
        WHERE pg.pet_id = p_pet_id
          AND pr.auth_user_id = auth.uid()
    );
$$;

-- Restrict execution: anon needs it for the public_passports RLS policy;
-- authenticated needs it for guardian-gated policies.
-- Revoking PUBLIC prevents unexpected callers (no practical route today, but
-- explicit grants document the intended call sites).
REVOKE EXECUTE ON FUNCTION is_guardian_of(UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION is_guardian_of(UUID) TO authenticated, anon;

-- ── profiles ─────────────────────────────────────────────────────────────────
-- Users read/update only their own profile.
-- The INSERT is done by the Edge Function with service_role, so no insert policy
-- is needed for regular users.

CREATE POLICY "profiles: read own"
    ON profiles FOR SELECT
    USING (auth_user_id = auth.uid());

CREATE POLICY "profiles: update own"
    ON profiles FOR UPDATE
    USING (auth_user_id = auth.uid());

-- ── pets ─────────────────────────────────────────────────────────────────────
-- Guardians can read their own pets.
-- Only the primary owner (is_primary = true) can update or delete.
-- INSERT is done via a function that atomically creates the pet + guardian row.

CREATE POLICY "pets: guardians can read"
    ON pets FOR SELECT
    USING (is_guardian_of(id));

CREATE POLICY "pets: primary guardian can update"
    ON pets FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM pet_guardians pg
            JOIN profiles pr ON pg.profile_id = pr.id
            WHERE pg.pet_id = pets.id
              AND pg.is_primary = TRUE
              AND pr.auth_user_id = auth.uid()
        )
    );

CREATE POLICY "pets: primary guardian can delete"
    ON pets FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM pet_guardians pg
            JOIN profiles pr ON pg.profile_id = pr.id
            WHERE pg.pet_id = pets.id
              AND pg.is_primary = TRUE
              AND pr.auth_user_id = auth.uid()
        )
    );

-- ── Register-pet function (atomic INSERT) ────────────────────────────────────
-- Creates pet + pet_guardian + stellar_identity + public_passport in a single
-- transaction. Bypasses INSERT RLS; the caller must be authenticated (checked
-- by the service_role check on profile_id).

CREATE OR REPLACE FUNCTION register_pet(
    p_profile_id          UUID,
    p_vet_id              TEXT,
    p_name                TEXT,
    p_species             TEXT,
    p_breed               TEXT,
    p_sex                 TEXT,
    p_birth_date          DATE,
    p_birth_date_estimated BOOLEAN,
    p_color               TEXT,
    p_microchip           TEXT
) RETURNS pets LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_pet pets;
    v_profile profiles;
BEGIN
    -- Verify the caller owns this profile.
    SELECT * INTO v_profile FROM profiles
    WHERE id = p_profile_id AND auth_user_id = auth.uid();
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Unauthorized: profile does not belong to current user';
    END IF;

    -- Check vet_id uniqueness (belt-and-suspenders, also enforced by UNIQUE constraint).
    IF EXISTS (SELECT 1 FROM pets WHERE vet_id = p_vet_id) THEN
        RAISE EXCEPTION 'DuplicateVetId: % already registered', p_vet_id;
    END IF;

    INSERT INTO pets (vet_id, name, species, breed, sex, birth_date,
                      birth_date_estimated, color, microchip)
    VALUES (p_vet_id, p_name, p_species, p_breed, p_sex, p_birth_date,
            p_birth_date_estimated, p_color, p_microchip)
    RETURNING * INTO v_pet;

    INSERT INTO pet_guardians (pet_id, profile_id, relationship, is_primary)
    VALUES (v_pet.id, p_profile_id, 'owner', TRUE);

    INSERT INTO stellar_identities (pet_id, status)
    VALUES (v_pet.id, 'local');

    INSERT INTO public_passports (pet_id, is_public)
    VALUES (v_pet.id, TRUE);

    RETURN v_pet;
END;
$$;

-- Only authenticated users may call register_pet. Anon callers would get an
-- "Unauthorized" exception anyway (auth.uid() = null), but an explicit REVOKE
-- makes the intent unambiguous and prevents the function from appearing in the
-- API spec for the anon role.
REVOKE EXECUTE ON FUNCTION register_pet(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, DATE, BOOLEAN, TEXT, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION register_pet(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, DATE, BOOLEAN, TEXT, TEXT) TO authenticated;

-- ── pet_guardians ─────────────────────────────────────────────────────────────

CREATE POLICY "pet_guardians: guardians can read"
    ON pet_guardians FOR SELECT
    USING (is_guardian_of(pet_id));

-- ── stellar_identities ────────────────────────────────────────────────────────
-- Guardians can read; only the service role (Edge Function) can update status.

CREATE POLICY "stellar_identities: guardians can read"
    ON stellar_identities FOR SELECT
    USING (is_guardian_of(pet_id));

-- ── public_passports — public read for is_public = true ──────────────────────
-- Anonymous visitors can read the passport flag, but NOT pet details directly.
-- The passport_view below enforces what data is exposed.
-- NOTE: migration 20261016 replaces this policy with a narrower version
-- (is_public = TRUE OR is_guardian_of(pet_id)) to prevent anon users from
-- reading is_public = FALSE rows and leaking private pet UUIDs.

CREATE POLICY "public_passports: anyone can read public flag"
    ON public_passports FOR SELECT
    USING (TRUE);  -- SUPERSEDED by migration 20261016

CREATE POLICY "public_passports: primary guardian can update"
    ON public_passports FOR UPDATE
    USING (is_guardian_of(pet_id));

-- ============================================================================
-- Public passport view
-- Exposes ONLY the non-sensitive fields that appear on the public passport.
-- Does NOT expose: owner address, microchip, guardians.
-- Exposes photo_path (raw storage path) — intentional: the frontend needs it
-- to call getSignedPhotoUrl(). The path pattern pets/{pet_id}/photo.ext only
-- reveals the pet UUID, which is already visible as p.id in this view.
-- An anonymous user can read this view iff is_public = true AND the pet exists.
-- ============================================================================

CREATE OR REPLACE VIEW passport_view AS
SELECT
    p.id,
    p.vet_id,
    p.name,
    p.species,
    p.breed,
    p.sex,
    p.birth_date,
    p.birth_date_estimated,
    p.color,
    p.photo_path,
    si.status    AS stellar_status,
    si.transaction_hash AS stellar_tx_hash,
    pp.is_public,
    p.created_at AS registered_at
FROM pets p
JOIN public_passports pp ON pp.pet_id = p.id AND pp.is_public = TRUE
LEFT JOIN stellar_identities si ON si.pet_id = p.id;

-- Grant anonymous access to the view only (not the underlying tables).
GRANT SELECT ON passport_view TO anon;
