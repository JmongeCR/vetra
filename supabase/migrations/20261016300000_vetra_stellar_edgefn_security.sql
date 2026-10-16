-- ============================================================================
-- Vetra — Sprint 5F: Revoke client-side confirmation grants
--
-- Problem (identified in Sprint 5E audit):
--   `confirm_stellar_registration` and `confirm_stellar_recovery` were callable
--   by any authenticated user. A malicious actor could call them directly —
--   bypassing on-chain verification — and mark any pet they own as 'registered'
--   without a real Stellar transaction.
--
-- Fix:
--   Revoke EXECUTE from the `authenticated` role on both functions.
--   Confirmation is now exclusively handled by the `stellar-verify` Edge Function,
--   which authenticates the user, verifies the on-chain state via Soroban RPC,
--   and writes directly to stellar_identities using the service_role key.
--
-- Functions that REMAIN callable by authenticated users:
--   - claim_stellar_pending    (local→pending before signing — not a promotion)
--   - rollback_stellar_pending (pending→local safety valve — not a promotion)
--
-- Functions revoked below remain callable by service_role only (Edge Function).
-- ============================================================================

-- ── Revoke confirmation functions from authenticated ─────────────────────────

REVOKE EXECUTE ON FUNCTION confirm_stellar_registration(UUID, TEXT, TEXT) FROM authenticated;
REVOKE EXECUTE ON FUNCTION confirm_stellar_recovery(UUID, TEXT)           FROM authenticated;

COMMENT ON FUNCTION confirm_stellar_registration IS
    'Server-only: called exclusively by stellar-verify Edge Function after '
    'on-chain verification via Soroban RPC. Revoked from authenticated in Sprint 5F.';

COMMENT ON FUNCTION confirm_stellar_recovery IS
    'Server-only: called exclusively by stellar-verify Edge Function after '
    'on-chain verification via Soroban RPC. Revoked from authenticated in Sprint 5F.';
