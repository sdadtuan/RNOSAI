-- Portal staff profiles: optional display name and phone on portal_client_users.
-- Additive and idempotent. Applied by ensurePortalCrmLocalSchema().
-- Review only — do not run against production database hosts.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'portal_client_users'
  ) THEN
    ALTER TABLE portal_client_users ADD COLUMN IF NOT EXISTS display_name TEXT NOT NULL DEFAULT '';
    ALTER TABLE portal_client_users ADD COLUMN IF NOT EXISTS phone TEXT NOT NULL DEFAULT '';
    CREATE UNIQUE INDEX IF NOT EXISTS portal_client_users_client_phone_uq
      ON portal_client_users (client_id, phone)
      WHERE phone <> '';
    COMMENT ON COLUMN portal_client_users.display_name IS 'Optional display name shown in Portal staff settings.';
    COMMENT ON COLUMN portal_client_users.phone IS 'Optional contact phone; unique per client when non-empty.';
  END IF;
END $$;
