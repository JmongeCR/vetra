-- ============================================================
-- Vetra Clinic — Sistema Clínico
-- Migración: 20261016700000  (revisión 2 — integridad cross-clinic)
-- Requiere: 20261016500000_vetra_authorization_system.sql
--
-- EJECUTAR MANUALMENTE en Supabase Dashboard → SQL Editor.
-- NO ejecutar en producción sin revisión previa.
-- ============================================================

-- ════════════════════════════════════════════════════════════
-- 0. PARCHE: is_clinic_member — garantiza verificación is_active
--    Reemplaza la versión previa si existe; no rompe nada existente.
-- ════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION is_clinic_member(p_clinic_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM clinic_users
    WHERE clinic_id    = p_clinic_id
      AND auth_user_id = auth.uid()
      AND is_active    = TRUE
  );
$$;

-- ════════════════════════════════════════════════════════════
-- 1. clinic_patients
--    • UNIQUE(clinic_id, id): habilita FKs compuestas desde tablas hijas.
--    • vet_id es solo texto identificador; no es FK ni otorga acceso.
--      Todo acceso a datos del propietario queda protegido por RLS.
-- ════════════════════════════════════════════════════════════

CREATE TABLE clinic_patients (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id             UUID        NOT NULL
                                    REFERENCES clinics(id) ON DELETE CASCADE,
  name                  TEXT        NOT NULL
                                    CHECK (char_length(trim(name)) >= 1),
  species               TEXT        NOT NULL DEFAULT 'other'
                                    CHECK (species IN ('dog','cat','bird','rabbit','reptile','other')),
  breed                 TEXT,
  sex                   TEXT        NOT NULL DEFAULT 'unknown'
                                    CHECK (sex IN ('male','female','unknown')),
  birth_date            DATE
                                    CHECK (birth_date <= CURRENT_DATE),
  birth_date_estimated  BOOLEAN     NOT NULL DEFAULT FALSE,
  microchip             TEXT,
  -- Identificador clínico local; no enlaza a datos privados del propietario.
  -- El acceso a owner_name/phone/email siempre requiere membresía activa.
  vet_id                TEXT,
  owner_name            TEXT        NOT NULL
                                    CHECK (char_length(trim(owner_name)) >= 1),
  owner_phone           TEXT,
  owner_email           TEXT,
  notes                 TEXT,
  is_active             BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Permite FK compuesta (clinic_id, id) desde tablas hijas.
  UNIQUE (clinic_id, id)
);

CREATE TRIGGER set_clinic_patients_updated_at
  BEFORE UPDATE ON clinic_patients
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE clinic_patients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clinic_patients_select"
  ON clinic_patients FOR SELECT
  USING (is_clinic_member(clinic_id));

CREATE POLICY "clinic_patients_insert"
  ON clinic_patients FOR INSERT
  WITH CHECK (is_clinic_member(clinic_id));

CREATE POLICY "clinic_patients_update"
  ON clinic_patients FOR UPDATE
  USING  (is_clinic_member(clinic_id))
  WITH CHECK (is_clinic_member(clinic_id));

-- Sin política DELETE: los pacientes no se borran vía API (solo desactivar is_active).

CREATE INDEX idx_cp_clinic          ON clinic_patients(clinic_id);
CREATE INDEX idx_cp_clinic_active   ON clinic_patients(clinic_id, is_active);
CREATE INDEX idx_cp_clinic_name     ON clinic_patients(clinic_id, lower(name));
CREATE INDEX idx_cp_clinic_vet_id   ON clinic_patients(clinic_id, vet_id)
  WHERE vet_id IS NOT NULL;


-- ════════════════════════════════════════════════════════════
-- 2. appointments
--    • patient_id / staff_id: FK simple (ON DELETE SET NULL) para que
--      PostgREST pueda hacer embedding con !patient_id y !staff_id.
--    • created_by:  FK simple a clinic_users.
--    • Trigger verifica que patient_id, staff_id y created_by pertenezcan
--      a la misma clínica (protección cross-clinic en capa de datos).
--    • UNIQUE(clinic_id, id): habilita FK compuesta desde consultations.
-- ════════════════════════════════════════════════════════════

CREATE TABLE appointments (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id   UUID        NOT NULL
                          REFERENCES clinics(id) ON DELETE CASCADE,
  -- FK simple: conserva cita si se elimina el paciente (patient_id → NULL).
  -- Integridad cross-clinic garantizada por trigger (ver sección 8).
  patient_id  UUID        REFERENCES clinic_patients(id) ON DELETE SET NULL,
  -- FK simple: requerida para join PostgREST clinic_users!staff_id(display_name).
  -- Integridad cross-clinic garantizada por trigger.
  staff_id    UUID        REFERENCES clinic_users(id) ON DELETE SET NULL,
  title       TEXT        NOT NULL
                          CHECK (char_length(trim(title)) >= 1),
  reason      TEXT,
  starts_at   TIMESTAMPTZ NOT NULL,
  ends_at     TIMESTAMPTZ NOT NULL,
  status      TEXT        NOT NULL DEFAULT 'scheduled'
                          CHECK (status IN (
                            'scheduled','confirmed','in_progress',
                            'completed','cancelled','no_show'
                          )),
  notes       TEXT,
  created_by  UUID        REFERENCES clinic_users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT appointments_end_after_start CHECK (ends_at > starts_at),

  -- Habilita FK compuesta (clinic_id, id) desde consultations.
  UNIQUE (clinic_id, id)
);

CREATE TRIGGER set_appointments_updated_at
  BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "appointments_select"
  ON appointments FOR SELECT
  USING (is_clinic_member(clinic_id));

CREATE POLICY "appointments_insert"
  ON appointments FOR INSERT
  WITH CHECK (is_clinic_member(clinic_id));

CREATE POLICY "appointments_update"
  ON appointments FOR UPDATE
  USING  (is_clinic_member(clinic_id))
  WITH CHECK (is_clinic_member(clinic_id));

CREATE INDEX idx_apt_clinic_period ON appointments(clinic_id, starts_at);
CREATE INDEX idx_apt_clinic_status ON appointments(clinic_id, status);
CREATE INDEX idx_apt_patient       ON appointments(clinic_id, patient_id)
  WHERE patient_id IS NOT NULL;
CREATE INDEX idx_apt_staff         ON appointments(clinic_id, staff_id)
  WHERE staff_id IS NOT NULL;


-- ════════════════════════════════════════════════════════════
-- 3. clinical_records
--    • UNIQUE(clinic_id, patient_id): un expediente base por paciente.
--    • FK compuesta (clinic_id, patient_id): garantiza que el paciente
--      pertenece a la misma clínica en capa de base de datos.
--    • UNIQUE(clinic_id, id): habilita FK compuesta desde consultations.
-- ════════════════════════════════════════════════════════════

CREATE TABLE clinical_records (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id    UUID        NOT NULL
                           REFERENCES clinics(id) ON DELETE CASCADE,
  -- No FK simple: se usa FK compuesta abajo para garantía cross-clinic.
  patient_id   UUID        NOT NULL,
  antecedents  TEXT,
  allergies    TEXT,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- FK compuesta: patient_id debe pertenecer a la misma clínica.
  CONSTRAINT clinical_records_patient_fk
    FOREIGN KEY (clinic_id, patient_id)
    REFERENCES clinic_patients(clinic_id, id)
    ON DELETE CASCADE,

  UNIQUE (clinic_id, patient_id),

  -- Habilita FK compuesta (clinic_id, id) desde consultations.
  UNIQUE (clinic_id, id)
);

CREATE TRIGGER set_clinical_records_updated_at
  BEFORE UPDATE ON clinical_records
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE clinical_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clinical_records_select"
  ON clinical_records FOR SELECT
  USING (is_clinic_member(clinic_id));

CREATE POLICY "clinical_records_insert"
  ON clinical_records FOR INSERT
  WITH CHECK (is_clinic_member(clinic_id));

CREATE POLICY "clinical_records_update"
  ON clinical_records FOR UPDATE
  USING  (is_clinic_member(clinic_id))
  WITH CHECK (is_clinic_member(clinic_id));

CREATE INDEX idx_cr_clinic_patient ON clinical_records(clinic_id, patient_id);


-- ════════════════════════════════════════════════════════════
-- 4. consultations
--    • patient_id y record_id: FK compuestas → garantía DB cross-clinic.
--    • appointment_id: FK simple (ON DELETE SET NULL) + trigger.
--    • staff_id: FK simple → requerida para PostgREST
--      clinic_users!staff_id(display_name); trigger verifica cross-clinic.
--    • Validaciones de signos vitales con rangos razonables para animales.
--    • follow_up_date no puede ser anterior a visit_date.
-- ════════════════════════════════════════════════════════════

CREATE TABLE consultations (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id        UUID         NOT NULL
                                REFERENCES clinics(id) ON DELETE CASCADE,
  -- FK compuesta: patient_id debe pertenecer a la misma clínica.
  patient_id       UUID         NOT NULL,
  -- FK compuesta: record_id debe pertenecer a la misma clínica.
  record_id        UUID         NOT NULL,
  -- FK simple: conserva consulta si se cancela la cita.
  -- Trigger verifica cross-clinic si appointment_id no es NULL.
  appointment_id   UUID         REFERENCES appointments(id) ON DELETE SET NULL,
  -- FK simple: requerida para PostgREST clinic_users!staff_id(display_name).
  -- Trigger verifica cross-clinic.
  staff_id         UUID         REFERENCES clinic_users(id) ON DELETE SET NULL,
  visit_date       DATE         NOT NULL DEFAULT CURRENT_DATE,
  reason           TEXT         NOT NULL
                                CHECK (char_length(trim(reason)) >= 1),
  anamnesis        TEXT,
  physical_exam    TEXT,
  -- Signos vitales: rangos válidos para animales domésticos comunes.
  weight_kg        NUMERIC(6,2) CHECK (weight_kg > 0 AND weight_kg <= 999),
  temperature_c    NUMERIC(4,1) CHECK (temperature_c >= 30.0 AND temperature_c <= 44.0),
  heart_rate_bpm   INTEGER      CHECK (heart_rate_bpm > 0 AND heart_rate_bpm <= 500),
  respiratory_rate INTEGER      CHECK (respiratory_rate > 0 AND respiratory_rate <= 200),
  diagnosis        TEXT,
  treatment_plan   TEXT,
  observations     TEXT,
  follow_up_date   DATE         CHECK (follow_up_date >= visit_date),
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),

  -- FK compuestas: garantía DB nivel cross-clinic.
  CONSTRAINT consultations_patient_fk
    FOREIGN KEY (clinic_id, patient_id)
    REFERENCES clinic_patients(clinic_id, id)
    ON DELETE CASCADE,

  CONSTRAINT consultations_record_fk
    FOREIGN KEY (clinic_id, record_id)
    REFERENCES clinical_records(clinic_id, id)
    ON DELETE CASCADE,

  -- appointment_id cross-clinic se valida en trigger (ver sección 8).
  CONSTRAINT consultations_appointment_fk
    FOREIGN KEY (appointment_id)
    REFERENCES appointments(id)
    ON DELETE SET NULL
);

CREATE TRIGGER set_consultations_updated_at
  BEFORE UPDATE ON consultations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE consultations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "consultations_select"
  ON consultations FOR SELECT
  USING (is_clinic_member(clinic_id));

CREATE POLICY "consultations_insert"
  ON consultations FOR INSERT
  WITH CHECK (is_clinic_member(clinic_id));

CREATE POLICY "consultations_update"
  ON consultations FOR UPDATE
  USING  (is_clinic_member(clinic_id))
  WITH CHECK (is_clinic_member(clinic_id));

CREATE INDEX idx_con_patient    ON consultations(patient_id);
CREATE INDEX idx_con_clinic     ON consultations(clinic_id, visit_date DESC);
CREATE INDEX idx_con_appointment ON consultations(appointment_id)
  WHERE appointment_id IS NOT NULL;


-- ════════════════════════════════════════════════════════════
-- 5. vaccinations
--    • patient_id: FK compuesta → garantía DB cross-clinic.
--    • staff_id: FK simple + trigger.
--    • next_dose_date debe ser posterior a administered_date.
-- ════════════════════════════════════════════════════════════

CREATE TABLE vaccinations (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id         UUID         NOT NULL
                                 REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id        UUID         NOT NULL,
  vaccine_name      TEXT         NOT NULL
                                 CHECK (char_length(trim(vaccine_name)) >= 1),
  vaccine_lot       TEXT,
  administered_date DATE         NOT NULL,
  next_dose_date    DATE         CHECK (next_dose_date > administered_date),
  -- FK simple; trigger verifica cross-clinic.
  staff_id          UUID         REFERENCES clinic_users(id) ON DELETE SET NULL,
  notes             TEXT,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),

  -- FK compuesta: patient_id debe pertenecer a la misma clínica.
  CONSTRAINT vaccinations_patient_fk
    FOREIGN KEY (clinic_id, patient_id)
    REFERENCES clinic_patients(clinic_id, id)
    ON DELETE CASCADE
);

ALTER TABLE vaccinations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vaccinations_select"
  ON vaccinations FOR SELECT
  USING (is_clinic_member(clinic_id));

CREATE POLICY "vaccinations_insert"
  ON vaccinations FOR INSERT
  WITH CHECK (is_clinic_member(clinic_id));

CREATE INDEX idx_vac_patient   ON vaccinations(patient_id);
CREATE INDEX idx_vac_clinic    ON vaccinations(clinic_id);
CREATE INDEX idx_vac_next_dose ON vaccinations(next_dose_date)
  WHERE next_dose_date IS NOT NULL;


-- ════════════════════════════════════════════════════════════
-- 6. treatments
--    • patient_id: FK compuesta → garantía DB cross-clinic.
--    • consultation_id: FK simple (ON DELETE SET NULL) + trigger.
--    • end_date no puede ser anterior a start_date.
-- ════════════════════════════════════════════════════════════

CREATE TABLE treatments (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id        UUID         NOT NULL
                                REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id       UUID         NOT NULL,
  -- FK simple: conserva tratamiento si se elimina la consulta.
  -- Trigger verifica cross-clinic si consultation_id no es NULL.
  consultation_id  UUID         REFERENCES consultations(id) ON DELETE SET NULL,
  medication       TEXT         NOT NULL
                                CHECK (char_length(trim(medication)) >= 1),
  dosage           TEXT,
  frequency        TEXT,
  start_date       DATE         NOT NULL,
  end_date         DATE         CHECK (end_date >= start_date),
  status           TEXT         NOT NULL DEFAULT 'active'
                                CHECK (status IN ('active','completed','suspended')),
  notes            TEXT,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),

  -- FK compuesta: patient_id debe pertenecer a la misma clínica.
  CONSTRAINT treatments_patient_fk
    FOREIGN KEY (clinic_id, patient_id)
    REFERENCES clinic_patients(clinic_id, id)
    ON DELETE CASCADE
);

ALTER TABLE treatments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "treatments_select"
  ON treatments FOR SELECT
  USING (is_clinic_member(clinic_id));

CREATE POLICY "treatments_insert"
  ON treatments FOR INSERT
  WITH CHECK (is_clinic_member(clinic_id));

CREATE POLICY "treatments_update"
  ON treatments FOR UPDATE
  USING  (is_clinic_member(clinic_id))
  WITH CHECK (is_clinic_member(clinic_id));

CREATE INDEX idx_tre_patient       ON treatments(patient_id);
CREATE INDEX idx_tre_clinic        ON treatments(clinic_id);
CREATE INDEX idx_tre_clinic_active ON treatments(clinic_id, status)
  WHERE status = 'active';


-- ════════════════════════════════════════════════════════════
-- 7. Función auxiliar reutilizable para verificación cross-clinic de staff
--    Ejecuta como SECURITY DEFINER para leer clinic_users sin depender del
--    RLS del usuario que dispara el trigger.
-- ════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION _assert_staff_same_clinic(
  p_staff_id  UUID,
  p_clinic_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_staff_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM clinic_users
      WHERE id = p_staff_id AND clinic_id = p_clinic_id
    ) THEN
      RAISE EXCEPTION
        'Integridad cross-clinic: staff_id % no pertenece a la clínica %',
        p_staff_id, p_clinic_id
        USING ERRCODE = 'foreign_key_violation';
    END IF;
  END IF;
END;
$$;


-- ════════════════════════════════════════════════════════════
-- 8. Triggers de integridad cross-clinic
--
--    Las FKs compuestas ya protegen patient_id y record_id a nivel DB.
--    Estos triggers cubren los casos donde solo se puede usar FK simple
--    (appointment_id/staff_id/consultation_id con ON DELETE SET NULL)
--    y también bloquean un UPDATE que intente mover un registro a otra
--    clínica (cambio de clinic_id).
-- ════════════════════════════════════════════════════════════

-- ── appointments ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION _trg_appointments_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Impedir cambio de clínica en UPDATE.
  IF TG_OP = 'UPDATE' AND NEW.clinic_id <> OLD.clinic_id THEN
    RAISE EXCEPTION
      'No se puede mover una cita a otra clínica'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  -- patient_id debe pertenecer a la misma clínica.
  IF NEW.patient_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM clinic_patients
      WHERE id = NEW.patient_id AND clinic_id = NEW.clinic_id
    ) THEN
      RAISE EXCEPTION
        'Integridad cross-clinic: patient_id % no pertenece a la clínica %',
        NEW.patient_id, NEW.clinic_id
        USING ERRCODE = 'foreign_key_violation';
    END IF;
  END IF;

  PERFORM _assert_staff_same_clinic(NEW.staff_id, NEW.clinic_id);
  PERFORM _assert_staff_same_clinic(NEW.created_by, NEW.clinic_id);

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_appointments_integrity
  BEFORE INSERT OR UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION _trg_appointments_integrity();


-- ── consultations ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION _trg_consultations_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.clinic_id <> OLD.clinic_id THEN
    RAISE EXCEPTION
      'No se puede mover una consulta a otra clínica'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  -- appointment_id debe pertenecer a la misma clínica (si está presente).
  IF NEW.appointment_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM appointments
      WHERE id = NEW.appointment_id AND clinic_id = NEW.clinic_id
    ) THEN
      RAISE EXCEPTION
        'Integridad cross-clinic: appointment_id % no pertenece a la clínica %',
        NEW.appointment_id, NEW.clinic_id
        USING ERRCODE = 'foreign_key_violation';
    END IF;
  END IF;

  PERFORM _assert_staff_same_clinic(NEW.staff_id, NEW.clinic_id);

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_consultations_integrity
  BEFORE INSERT OR UPDATE ON consultations
  FOR EACH ROW EXECUTE FUNCTION _trg_consultations_integrity();


-- ── vaccinations ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION _trg_vaccinations_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.clinic_id <> OLD.clinic_id THEN
    RAISE EXCEPTION
      'No se puede mover una vacunación a otra clínica'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  PERFORM _assert_staff_same_clinic(NEW.staff_id, NEW.clinic_id);

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_vaccinations_integrity
  BEFORE INSERT OR UPDATE ON vaccinations
  FOR EACH ROW EXECUTE FUNCTION _trg_vaccinations_integrity();


-- ── treatments ────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION _trg_treatments_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.clinic_id <> OLD.clinic_id THEN
    RAISE EXCEPTION
      'No se puede mover un tratamiento a otra clínica'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  -- consultation_id debe pertenecer a la misma clínica (si está presente).
  IF NEW.consultation_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM consultations
      WHERE id = NEW.consultation_id AND clinic_id = NEW.clinic_id
    ) THEN
      RAISE EXCEPTION
        'Integridad cross-clinic: consultation_id % no pertenece a la clínica %',
        NEW.consultation_id, NEW.clinic_id
        USING ERRCODE = 'foreign_key_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_treatments_integrity
  BEFORE INSERT OR UPDATE ON treatments
  FOR EACH ROW EXECUTE FUNCTION _trg_treatments_integrity();
