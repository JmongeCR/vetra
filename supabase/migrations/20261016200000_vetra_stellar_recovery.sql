-- ============================================================================
-- Vetra — Sprint 5D: Stellar recovery function
--
-- Adds `confirm_stellar_recovery(pet_id, contract_id)` — SECURITY DEFINER.
--
-- Purpose:
--   When a pet is stuck in `pending` (e.g. the browser closed after signing but
--   before `confirmStellarRegistration` ran), the frontend can verify on-chain
--   that the registration exists and matches the expected owner + metadata_hash.
--   After verification, it calls this function to transition pending → registered
--   WITHOUT a transaction hash (which is unknown at recovery time).
--
-- Security model:
--   - Caller must be a guardian of the pet (is_guardian_of check).
--   - Only transitions rows that are in `pending` status.
--   - Does not accept a transaction_hash (avoids the "invented hash" attack vector
--     flagged in Sprint 5C). The transaction_hash column stays NULL for recovered
--     registrations.
--   - On-chain verification (pet_exists + get_pet owner/hash check) happens
--     client-side before this function is called; the SQL function enforces
--     guardian ownership and valid state machine transition only.
--
-- State machine:
--   pending ──confirm_stellar_recovery──▶ registered  (transaction_hash = NULL)
--
-- NOTE: requires the Sprint 5A migration
--   (20261016100000_vetra_stellar_metadata.sql) to be applied first.
-- ============================================================================

CREATE OR REPLACE FUNCTION confirm_stellar_recovery(
    p_pet_id      UUID,
    p_contract_id TEXT
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF NOT is_guardian_of(p_pet_id) THEN
        RAISE EXCEPTION 'Unauthorized: not a guardian of this pet';
    END IF;

    -- Transition pending → registered without a transaction_hash.
    -- The contract_id confirms which deployment holds this identity.
    -- transaction_hash remains NULL (unknown at recovery time).
    UPDATE stellar_identities
    SET status        = 'registered',
        contract_id   = p_contract_id,
        registered_at = now(),
        updated_at    = now()
    WHERE pet_id = p_pet_id
      AND status  = 'pending';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'InvalidState: pet % is not in pending status', p_pet_id;
    END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION confirm_stellar_recovery(UUID, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION confirm_stellar_recovery(UUID, TEXT) TO authenticated;
