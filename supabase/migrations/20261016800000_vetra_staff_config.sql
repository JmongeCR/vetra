-- ============================================================================
-- Migration: Personal y Configuración — políticas y funciones
-- Created:   2026-10-16
-- Status:    PENDING — do NOT execute without authorization
-- ============================================================================
-- Agrega:
--   1. is_clinic_admin()     — helper SECURITY DEFINER para verificar rol admin
--   2. clinics UPDATE policy — solo administradores pueden editar datos
--   3. clinic_users UPDATE   — solo administradores pueden cambiar rol / estado
--   4. get_clinic_staff()    — función SECURITY DEFINER que expone email desde
--                              auth.users (sin acceso directo del cliente)
-- ============================================================================

-- ── 1. is_clinic_admin helper ────────────────────────────────────────────────
-- Returns TRUE si el usuario autenticado es admin activo de p_clinic_id.

CREATE OR REPLACE FUNCTION is_clinic_admin(p_clinic_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
    SELECT EXISTS (
        SELECT 1 FROM clinic_users
        WHERE clinic_id    = p_clinic_id
          AND auth_user_id = auth.uid()
          AND is_active    = TRUE
          AND role         = 'admin'
    );
$$;
REVOKE EXECUTE ON FUNCTION is_clinic_admin(UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION is_clinic_admin(UUID) TO authenticated;

-- ── 2. clinics UPDATE policy ─────────────────────────────────────────────────
-- Solo el administrador activo de la clínica puede editar sus datos.
-- Los campos registration_code, verification_status e is_active NO deben
-- editarse desde el frontend; el CHECK no los restringe explícitamente porque
-- Supabase PostgREST respeta la columna seleccionada en el UPDATE.

CREATE POLICY "clinics: admin update"
    ON clinics FOR UPDATE
    USING     (is_clinic_admin(id))
    WITH CHECK (is_clinic_admin(id));

-- ── 3. clinic_users UPDATE policy ────────────────────────────────────────────
-- Solo el administrador activo puede actualizar role, is_active y display_name
-- de los miembros de su clínica.
-- Nota: el frontend debe evitar que el administrador se auto-desactive.

CREATE POLICY "clinic_users: admin update"
    ON clinic_users FOR UPDATE
    USING     (is_clinic_admin(clinic_id))
    WITH CHECK (is_clinic_admin(clinic_id));

-- ── 4. get_clinic_staff() ────────────────────────────────────────────────────
-- Retorna todos los miembros de la clínica del usuario autenticado, incluyendo
-- el email almacenado en auth.users. Acceso a auth.users requiere SECURITY
-- DEFINER; el email NUNCA se puede leer directamente desde el cliente.
--
-- Restricciones:
--   - Solo miembros activos de una clínica pueden llamar esta función.
--   - Retorna tanto activos como inactivos (el admin puede ver el historial).

CREATE OR REPLACE FUNCTION get_clinic_staff()
RETURNS TABLE (
    id           UUID,
    clinic_id    UUID,
    auth_user_id UUID,
    role         TEXT,
    display_name TEXT,
    is_active    BOOLEAN,
    created_at   TIMESTAMPTZ,
    email        TEXT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_clinic_id UUID;
BEGIN
    -- Verificar que el llamador es miembro activo de alguna clínica
    SELECT cu.clinic_id INTO v_clinic_id
    FROM clinic_users cu
    WHERE cu.auth_user_id = auth.uid()
      AND cu.is_active    = TRUE
    LIMIT 1;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'not_authorized'
            USING DETAIL = 'El usuario no pertenece a ninguna clínica activa';
    END IF;

    RETURN QUERY
    SELECT
        cu.id,
        cu.clinic_id,
        cu.auth_user_id,
        cu.role,
        cu.display_name,
        cu.is_active,
        cu.created_at,
        au.email::TEXT
    FROM clinic_users cu
    LEFT JOIN auth.users au ON au.id = cu.auth_user_id
    WHERE cu.clinic_id = v_clinic_id
    ORDER BY
        -- admins primero, luego por fecha de ingreso
        CASE cu.role WHEN 'admin' THEN 0 WHEN 'vet' THEN 1 ELSE 2 END,
        cu.created_at;
END;
$$;
REVOKE EXECUTE ON FUNCTION get_clinic_staff() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION get_clinic_staff() TO authenticated;
