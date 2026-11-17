-- Portal staff Page assignment: staff/viewer accounts only see Leads, messages and
-- comments of the Pages assigned to them. The approver (account owner) sees every Page.
-- Additive and idempotent. Applied by ensurePortalCrmLocalSchema().
-- Review only — do not run against production database hosts.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'portal_client_users'
  ) THEN
    CREATE TABLE IF NOT EXISTS portal_staff_pages (
      client_id  UUID NOT NULL,
      user_id    UUID NOT NULL REFERENCES portal_client_users (id) ON DELETE CASCADE,
      page_id    TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, page_id)
    );
    CREATE INDEX IF NOT EXISTS portal_staff_pages_client_page_idx
      ON portal_staff_pages (client_id, page_id);
    COMMENT ON TABLE portal_staff_pages IS
      'Pages assigned to a Portal staff/viewer account; scopes Leads, Tin nhắn and comments.';
  END IF;
END $$;
