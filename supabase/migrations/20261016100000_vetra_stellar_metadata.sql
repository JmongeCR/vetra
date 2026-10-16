-- ============================================================================
-- Vetra — Sprint 5A: Stellar metadata hash + state-machine functions
--
-- Changes:
--   1. Add `metadata_hash TEXT` to stellar_identities.
--      Stores the SHA-256 hex of the pet's public metadata JSON, computed
--      client-side and passed to the Soroban register_pet call. Allows
--      off-chain integrity verification without exposing PII on-chain.
--      Constrained to 64 lowercase hex characters (SHA-256 output).
--
--   2. Add `claim_stellar_pending(pet_id, metadata_hash)` — SECURITY DEFINER.
--      Atomically transitions status: local → pending.
--      Called by the frontend BEFORE invoking signAndSend so that a second
--      tab or concurrent request cannot trigger a duplicate registration.
--      Only guardians may call it; only the local→pending transition is valid.
--
--   3. Add `confirm_stellar_registration(pet_id, tx_hash, contract_id)` — SECURITY DEFINER.
--      Transitions status: pending → registered.
--      Called after a successful signAndSend response from the Soroban client.
--      Sets transaction_hash, contract_id, and registered_at atomically.
--
--   4. Add `rollback_stellar_pending(pet_id)` — SECURITY DEFINER.
--      Transitions status: pending → local (idempotent on non-pending rows).
--      Called when the user cancels the signing modal or the transaction fails
--      before confirmation. Clears metadata_hash to allow retry.
--
-- State machine enforced server-side:
--   local ──claim──▶ pending ──confirm──▶ registered
--                       │
--                    rollback
--                       │
--                       ▼
--                     local
--
-- No UPDATE policy is granted to authenticated users — direct table updates
-- remain impossible for all non-service_role callers. Only the SECURITY
-- DEFINER functions below can mutate stellar_identities rows.
-- ============================================================================

-- ── 1. Add metadata_hash column ──────────────────────────────────────────────

ALTER TABLE stellar_identities
    ADD COLUMN IF NOT EXISTS metadata_hash TEXT
        CHECK (
            metadata_hash IS NULL
            OR metadata_hash ~ '^[0-9a-f]{64}$'
        );

COMMENT ON COLUMN stellar_identities.metadata_hash IS
    'SHA-256 hex (64 chars) of the public pet metadata JSON passed to register_pet. '
    'Allows off-chain integrity verification. NULL until claim_stellar_pending is called.';

-- ── 2. claim_stellar_pending ─────────────────────────────────────────────────
-- Reserves the identity slot before the owner signs the Stellar transaction.
-- Rejects if the pet is already pending or registered (prevents duplicate writes).

CREATE OR REPLACE FUNCTION claim_stellar_pending(
    p_pet_id        UUID,
    p_metadata_hash TEXT
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    -- Guard: caller must be a guardian of this pet.
    IF NOT is_guardian_of(p_pet_id) THEN
        RAISE EXCEPTION 'Unauthorized: not a guardian of this pet';
    END IF;

    -- Guard: validate hash format (64 lowercase hex characters).
    IF p_metadata_hash IS NOT NULL
       AND p_metadata_hash !~ '^[0-9a-f]{64}$' THEN
        RAISE EXCEPTION 'InvalidHash: metadata_hash must be 64 lowercase hex characters';
    END IF;

    -- Atomic transition local → pending.
    -- The WHERE status = 'local' clause acts as an optimistic lock:
    --   - Returns 0 rows if the pet is already pending/registered → FOUND is false.
    --   - Concurrent calls on the same pet_id will see status = 'pending' and raise.
    UPDATE stellar_identities
    SET status        = 'pending',
        metadata_hash = p_metadata_hash,
        updated_at    = now()
    WHERE pet_id = p_pet_id
      AND status  = 'local';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'InvalidState: pet % is not in local status (may already be pending or registered)', p_pet_id;
    END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION claim_stellar_pending(UUID, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION claim_stellar_pending(UUID, TEXT) TO authenticated;

-- ── 3. confirm_stellar_registration ─────────────────────────────────────────
-- Finalizes the registration after a successful Stellar transaction.
-- p_contract_id: the Soroban contract address (C…) that holds the identity.

CREATE OR REPLACE FUNCTION confirm_stellar_registration(
    p_pet_id      UUID,
    p_tx_hash     TEXT,
    p_contract_id TEXT
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF NOT is_guardian_of(p_pet_id) THEN
        RAISE EXCEPTION 'Unauthorized: not a guardian of this pet';
    END IF;

    IF p_tx_hash IS NULL OR p_tx_hash !~ '^[0-9a-f]{64}$' THEN
        RAISE EXCEPTION 'InvalidTxHash: transaction_hash must be a 64-character lowercase hex string';
    END IF;

    UPDATE stellar_identities
    SET status           = 'registered',
        transaction_hash = p_tx_hash,
        contract_id      = p_contract_id,
        registered_at    = now(),
        updated_at       = now()
    WHERE pet_id = p_pet_id
      AND status  = 'pending';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'InvalidState: pet % is not in pending status', p_pet_id;
    END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION confirm_stellar_registration(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION confirm_stellar_registration(UUID, TEXT, TEXT) TO authenticated;

-- ── 4. rollback_stellar_pending ──────────────────────────────────────────────
-- Cancels a pending registration (user cancelled signing, tx failed, tab closed).
-- Idempotent on rows that are not in pending status.

CREATE OR REPLACE FUNCTION rollback_stellar_pending(
    p_pet_id UUID
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF NOT is_guardian_of(p_pet_id) THEN
        RAISE EXCEPTION 'Unauthorized: not a guardian of this pet';
    END IF;

    UPDATE stellar_identities
    SET status        = 'local',
        metadata_hash = NULL,
        updated_at    = now()
    WHERE pet_id = p_pet_id
      AND status  = 'pending';
    -- No FOUND check — idempotent; silently succeeds if already local/registered.
END;
$$;

REVOKE EXECUTE ON FUNCTION rollback_stellar_pending(UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION rollback_stellar_pending(UUID) TO authenticated;
