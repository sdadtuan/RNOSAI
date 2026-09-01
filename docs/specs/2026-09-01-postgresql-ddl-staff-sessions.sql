-- Staff account self-service — sessions + avatar columns (STAFF-ACCOUNT-20260901)

CREATE TABLE IF NOT EXISTS staff_sessions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES staff_users(id) ON DELETE CASCADE,
  login_method VARCHAR(32) NOT NULL,
  user_agent TEXT NOT NULL DEFAULT '',
  ip INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  revoke_reason VARCHAR(64)
);

CREATE INDEX IF NOT EXISTS idx_staff_sessions_user_seen
  ON staff_sessions (user_id, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_staff_sessions_user_active
  ON staff_sessions (user_id)
  WHERE revoked_at IS NULL;

ALTER TABLE staff_users
  ADD COLUMN IF NOT EXISTS avatar_storage_key TEXT,
  ADD COLUMN IF NOT EXISTS avatar_updated_at TIMESTAMPTZ;
