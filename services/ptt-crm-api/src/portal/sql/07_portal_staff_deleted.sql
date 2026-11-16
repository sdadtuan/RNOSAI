-- Portal staff soft-delete: keep the row for case/notification history.
-- Additive and idempotent. Applied by ensurePortalCrmLocalSchema().
-- Review only — do not run against production database hosts.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'portal_client_users'
  ) THEN
    ALTER TABLE portal_client_users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
    COMMENT ON COLUMN portal_client_users.deleted_at IS
      'Set when an approver removes the staff account from Portal; row kept for history and notifications.';
  END IF;
END $$;
