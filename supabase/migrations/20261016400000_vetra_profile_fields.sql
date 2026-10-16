-- ============================================================================
-- Migration: extend profiles with personal data fields
-- Created:   2026-10-16
-- Status:    PENDING — do NOT execute without authorization
-- ============================================================================
-- Adds optional personal data columns to the profiles table.
-- display_name already exists; this adds first_name, last_name, phone,
-- country, and avatar_path for the /perfil owner page (Tarea 1).
--
-- RLS: existing policies already scope SELECT/UPDATE to auth_user_id = auth.uid(),
-- so no new policies are needed for these columns.

ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS first_name   TEXT,
    ADD COLUMN IF NOT EXISTS last_name    TEXT,
    ADD COLUMN IF NOT EXISTS phone        TEXT,
    ADD COLUMN IF NOT EXISTS country      TEXT,
    ADD COLUMN IF NOT EXISTS avatar_path  TEXT;

-- Optional: constrain lengths to avoid oversized strings
ALTER TABLE profiles
    ADD CONSTRAINT profiles_first_name_length  CHECK (char_length(first_name)  <= 80),
    ADD CONSTRAINT profiles_last_name_length   CHECK (char_length(last_name)   <= 80),
    ADD CONSTRAINT profiles_phone_length       CHECK (char_length(phone)       <= 30),
    ADD CONSTRAINT profiles_country_length     CHECK (char_length(country)     <= 60),
    ADD CONSTRAINT profiles_avatar_path_length CHECK (char_length(avatar_path) <= 512);
