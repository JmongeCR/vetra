-- Enforce uniqueness of (clinic_id, vet_id) at the database level.
-- Prevents duplicate patient records for the same VET-ID within a clinic,
-- even from concurrent inserts or direct API calls that bypass the frontend check.
-- Partial: only applies when vet_id IS NOT NULL (local patients without a VET-ID are unaffected).

CREATE UNIQUE INDEX uidx_cp_clinic_vet_id
  ON clinic_patients(clinic_id, vet_id)
  WHERE vet_id IS NOT NULL;
