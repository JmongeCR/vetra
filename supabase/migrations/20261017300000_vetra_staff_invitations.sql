-- ============================================================================
-- Migration: staff invitation system
-- Created:   2026-10-17
-- Requires:  20261016500000_vetra_authorization_system.sql (is_clinic_admin)
--            20261016800000_vetra_staff_config.sql (clinic_users structure)
-- Status:    PENDING — do NOT execute without authorization
-- ============================================================================
--
-- Adds:
--   1. clinic_invitations table — stores pending email invitations
--   2. create_staff_invitation()  — admin creates invite, returns token
--   3. accept_staff_invitation()  — invitee accepts after authenticating
--   4. cancel_staff_invitation()  — admin cancels a pending invite
--   5. get_pending_invitations()  — admin reads open invites for their clinic
--
-- Flow:
--   1. Admin calls create_staff_invitation(email, role) → gets token UUID
--   2. Frontend sends Supabase magic-link to email with /unirse?token=<token>
--   3. Invitee clicks link → authenticated → lands on /unirse
--   4. Frontend calls accept_staff_invitation(token) → creates clinic_users row
--
-- Security:
--   • Only active admins can create / cancel / list invitations.
--   • accept_staff_invitation verifies email match between auth session
--     and the stored invitation before creating the clinic_users row.
--   • No service_role key required — all functions use SECURITY DEFINER
--     and run as the DB owner.
--   • Invitation tokens are UUIDs (128-bit random), expire in 7 days.
--   • A new invitation for the same email auto-cancels the previous one.
-- ============================================================================

-- ── Table ─────────────────────────────────────────────────────────────────────

CREATE TABLE clinic_invitations (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id   UUID        NOT NULL REFERENCES clinics(id)      ON DELETE CASCADE,
    invited_by  UUID                 REFERENCES clinic_users(id) ON DELETE SET NULL,
    email       TEXT        NOT NULL,
    role        TEXT        NOT NULL DEFAULT 'vet'
                                CHECK (role IN ('admin', 'vet', 'reception')),
    token       UUID        NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    status      TEXT        NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending', 'accepted', 'cancelled', 'expired')),
    expires_at  TIMESTAMPTZ NOT NULL DEFAULT now() + interval '7 days',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_clinic_invitations_clinic ON clinic_invitations(clinic_id);
CREATE INDEX idx_clinic_invitations_email  ON clinic_invitations(lower(email));
CREATE INDEX idx_clinic_invitations_token  ON clinic_invitations(token) WHERE status = 'pending';
CREATE INDEX idx_clinic_invitations_active ON clinic_invitations(clinic_id, status) WHERE status = 'pending';

ALTER TABLE clinic_invitations ENABLE ROW LEVEL SECURITY;

-- Admins can read all invitations for their clinic
CREATE POLICY "clinic_invitations: admin read"
    ON clinic_invitations FOR SELECT
    USING (is_clinic_admin(clinic_id));

-- Admins can update status (cancel) for their clinic
CREATE POLICY "clinic_invitations: admin update"
    ON clinic_invitations FOR UPDATE
    USING     (is_clinic_admin(clinic_id))
    WITH CHECK (is_clinic_admin(clinic_id));

-- ── create_staff_invitation ───────────────────────────────────────────────────
-- Admin creates an invitation. Returns the new invitation id + token UUID.
-- Auto-cancels any existing pending invitation for the same email+clinic.

CREATE OR REPLACE FUNCTION create_staff_invitation(
    p_email TEXT,
    p_role  TEXT
)
RETURNS TABLE (invitation_id UUID, invitation_token UUID)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_clinic_id UUID;
    v_member_id UUID;
    v_new_id    UUID;
    v_token     UUID;
BEGIN
    -- Caller must be active admin
    SELECT cu.clinic_id, cu.id INTO v_clinic_id, v_member_id
    FROM clinic_users cu
    WHERE cu.auth_user_id = auth.uid()
      AND cu.is_active    = TRUE
      AND cu.role         = 'admin'
    LIMIT 1;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'not_authorized';
    END IF;

    -- Validate role
    IF p_role NOT IN ('admin', 'vet', 'reception') THEN
        RAISE EXCEPTION 'invalid_role';
    END IF;

    -- Validate email (basic check)
    IF p_email IS NULL OR char_length(trim(p_email)) < 5 OR position('@' IN trim(p_email)) = 0 THEN
        RAISE EXCEPTION 'invalid_email';
    END IF;

    -- Check not already an active member of this clinic
    IF EXISTS (
        SELECT 1 FROM clinic_users cu
        JOIN auth.users au ON au.id = cu.auth_user_id
        WHERE cu.clinic_id = v_clinic_id
          AND lower(au.email) = lower(trim(p_email))
    ) THEN
        RAISE EXCEPTION 'already_member';
    END IF;

    -- Cancel any previous pending invitation for this email+clinic
    UPDATE clinic_invitations
    SET status = 'cancelled'
    WHERE clinic_invitations.clinic_id = v_clinic_id
      AND lower(clinic_invitations.email) = lower(trim(p_email))
      AND clinic_invitations.status = 'pending';

    -- Create new invitation
    INSERT INTO clinic_invitations (clinic_id, invited_by, email, role)
    VALUES (v_clinic_id, v_member_id, lower(trim(p_email)), p_role)
    RETURNING clinic_invitations.id, clinic_invitations.token
    INTO v_new_id, v_token;

    RETURN QUERY SELECT v_new_id, v_token;
END;
$$;
REVOKE EXECUTE ON FUNCTION create_staff_invitation(TEXT, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION create_staff_invitation(TEXT, TEXT) TO authenticated;

-- ── accept_staff_invitation ───────────────────────────────────────────────────
-- Called by the invitee after authenticating via magic link.
-- Validates token, email match, expiry, then creates the clinic_users row.
-- Returns the clinic name for the welcome message.

CREATE OR REPLACE FUNCTION accept_staff_invitation(p_token UUID)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_inv       clinic_invitations%ROWTYPE;
    v_email     TEXT;
    v_clinic_name TEXT;
BEGIN
    -- Get caller's email
    SELECT lower(au.email) INTO v_email
    FROM auth.users au WHERE au.id = auth.uid();

    IF NOT FOUND OR v_email IS NULL THEN
        RAISE EXCEPTION 'not_authenticated';
    END IF;

    -- Find invitation by token
    SELECT * INTO v_inv
    FROM clinic_invitations WHERE clinic_invitations.token = p_token
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'invitation_not_found';
    END IF;

    IF v_inv.status <> 'pending' THEN
        RAISE EXCEPTION 'invitation_not_pending';
    END IF;

    IF v_inv.expires_at < now() THEN
        UPDATE clinic_invitations
        SET status = 'expired'
        WHERE clinic_invitations.id = v_inv.id;
        RAISE EXCEPTION 'invitation_expired';
    END IF;

    -- Email must match the invitation
    IF lower(v_inv.email) <> v_email THEN
        RAISE EXCEPTION 'email_mismatch';
    END IF;

    -- Caller must not already be a member of any clinic
    IF EXISTS (SELECT 1 FROM clinic_users WHERE auth_user_id = auth.uid()) THEN
        RAISE EXCEPTION 'already_member';
    END IF;

    -- Create clinic membership
    INSERT INTO clinic_users (clinic_id, auth_user_id, role, is_active)
    VALUES (v_inv.clinic_id, auth.uid(), v_inv.role, TRUE);

    -- Mark invitation as accepted
    UPDATE clinic_invitations
    SET status = 'accepted'
    WHERE clinic_invitations.id = v_inv.id;

    -- Return clinic name for the welcome screen
    SELECT clinics.name INTO v_clinic_name
    FROM clinics WHERE clinics.id = v_inv.clinic_id;

    RETURN v_clinic_name;
END;
$$;
REVOKE EXECUTE ON FUNCTION accept_staff_invitation(UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION accept_staff_invitation(UUID) TO authenticated;

-- ── cancel_staff_invitation ───────────────────────────────────────────────────
-- Admin cancels a pending invitation.

CREATE OR REPLACE FUNCTION cancel_staff_invitation(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_clinic_id UUID;
BEGIN
    SELECT clinic_invitations.clinic_id INTO v_clinic_id
    FROM clinic_invitations
    WHERE clinic_invitations.id = p_id
      AND clinic_invitations.status = 'pending';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'invitation_not_found';
    END IF;

    IF NOT is_clinic_admin(v_clinic_id) THEN
        RAISE EXCEPTION 'not_authorized';
    END IF;

    UPDATE clinic_invitations
    SET status = 'cancelled'
    WHERE clinic_invitations.id = p_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION cancel_staff_invitation(UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION cancel_staff_invitation(UUID) TO authenticated;

-- ── get_pending_invitations ───────────────────────────────────────────────────
-- Returns active (non-expired, non-cancelled) invitations for the caller's clinic.

CREATE OR REPLACE FUNCTION get_pending_invitations()
RETURNS TABLE (
    id         UUID,
    email      TEXT,
    role       TEXT,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_clinic_id UUID;
BEGIN
    SELECT cu.clinic_id INTO v_clinic_id
    FROM clinic_users cu
    WHERE cu.auth_user_id = auth.uid()
      AND cu.is_active    = TRUE
    LIMIT 1;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'not_authorized';
    END IF;

    RETURN QUERY
    SELECT
        ci.id,
        ci.email,
        ci.role,
        ci.expires_at,
        ci.created_at
    FROM clinic_invitations ci
    WHERE ci.clinic_id = v_clinic_id
      AND ci.status    = 'pending'
      AND ci.expires_at > now()
    ORDER BY ci.created_at DESC;
END;
$$;
REVOKE EXECUTE ON FUNCTION get_pending_invitations() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION get_pending_invitations() TO authenticated;
