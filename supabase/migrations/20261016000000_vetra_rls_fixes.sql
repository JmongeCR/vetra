-- ============================================================================
-- Vetra — Sprint 4.3: RLS policy fixes and Storage helper
--
-- Changes:
--   1. Fix public_passports SELECT policy.
--      The previous USING (TRUE) policy exposed ALL passport rows (including
--      is_public = FALSE) to anonymous users, leaking pet UUIDs of private pets.
--      The new policy restricts anonymous access to public rows only, while
--      letting authenticated guardians see their own private passport rows too.
--
--   2. Add is_pet_passport_public() helper function.
--      Used in Supabase Storage bucket policies to allow anonymous users to
--      generate signed URLs for photos of pets with is_public = TRUE passports.
--      Without this, getSignedPhotoUrl() would fail for unauthenticated visitors
--      viewing a public passport (no Storage SELECT policy for anon users).
-- ============================================================================

-- ── Fix: public_passports SELECT policy ─────────────────────────────────────
-- Drop the overly broad policy and replace with a two-tier version.

DROP POLICY IF EXISTS "public_passports: anyone can read public flag" ON public_passports;

CREATE POLICY "public_passports: read"
    ON public_passports FOR SELECT
    USING (
        is_public = TRUE          -- anon users see only public rows
        OR is_guardian_of(pet_id) -- guardians see all of their own rows (toggle UI)
    );

-- ── Add: is_pet_passport_public() for Storage policies ──────────────────────
-- SECURITY DEFINER so it queries public_passports with owner privileges even
-- when called from an anonymous Storage policy evaluation context.

CREATE OR REPLACE FUNCTION is_pet_passport_public(p_pet_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public_passports
        WHERE pet_id = p_pet_id
          AND is_public = TRUE
    );
$$;

-- Grant EXECUTE to anon — required for the Storage bucket policy that allows
-- anonymous users to download photos of public passport pets.
GRANT EXECUTE ON FUNCTION is_pet_passport_public(UUID) TO anon;
GRANT EXECUTE ON FUNCTION is_pet_passport_public(UUID) TO authenticated;
