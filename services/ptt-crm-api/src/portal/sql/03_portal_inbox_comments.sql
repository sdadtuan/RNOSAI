-- Portal Inbox comments, attachments, assignment view, inbox settings.
-- Additive and idempotent. Apply via ensurePortalCrmLocalSchema() or locally.
-- Review only — do not run against production database hosts.

CREATE TABLE IF NOT EXISTS portal_fb_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients (id) ON DELETE CASCADE,
  page_id VARCHAR(64) NOT NULL,
  post_id VARCHAR(128) NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  permalink TEXT NOT NULL DEFAULT '',
  picture TEXT NOT NULL DEFAULT '',
  created_time TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (client_id, post_id)
);
CREATE INDEX IF NOT EXISTS portal_fb_posts_client_page_idx
  ON portal_fb_posts (client_id, page_id, created_time DESC NULLS LAST);

CREATE TABLE IF NOT EXISTS portal_page_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients (id) ON DELETE CASCADE,
  page_id VARCHAR(64) NOT NULL,
  post_id VARCHAR(128) NOT NULL,
  comment_id VARCHAR(128) NOT NULL,
  parent_id VARCHAR(128) NOT NULL DEFAULT '',
  from_name TEXT NOT NULL DEFAULT '',
  from_id VARCHAR(64) NOT NULL DEFAULT '',
  message TEXT NOT NULL DEFAULT '',
  created_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
  replied BOOLEAN NOT NULL DEFAULT FALSE,
  can_hide BOOLEAN NOT NULL DEFAULT TRUE,
  can_reply BOOLEAN NOT NULL DEFAULT TRUE,
  can_reply_privately BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS portal_page_comments_client_comment_uq
  ON portal_page_comments (client_id, comment_id);
CREATE INDEX IF NOT EXISTS portal_page_comments_client_page_idx
  ON portal_page_comments (client_id, page_id, created_time DESC);
CREATE INDEX IF NOT EXISTS portal_page_comments_post_idx
  ON portal_page_comments (client_id, post_id, created_time);

CREATE TABLE IF NOT EXISTS portal_inbox_settings (
  client_id UUID PRIMARY KEY REFERENCES clients (id) ON DELETE CASCADE,
  auto_hide_phone_comments BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT NOT NULL DEFAULT ''
);

ALTER TABLE portal_care_cases ADD COLUMN IF NOT EXISTS last_viewed_by UUID;
ALTER TABLE portal_care_cases ADD COLUMN IF NOT EXISTS last_viewed_at TIMESTAMPTZ;

ALTER TABLE portal_page_messages ADD COLUMN IF NOT EXISTS attachments JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS portal_comment_sync (
  client_id UUID PRIMARY KEY REFERENCES clients (id) ON DELETE CASCADE,
  last_synced_at TIMESTAMPTZ,
  last_error TEXT NOT NULL DEFAULT '',
  permission_error TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
