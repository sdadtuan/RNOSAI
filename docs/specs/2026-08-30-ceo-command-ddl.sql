-- CEO Command ChatBox — turns, confirm-gated actions, learn candidates (SRS §13)
CREATE TABLE IF NOT EXISTS ceo_command_turns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id VARCHAR(64) NOT NULL,
  actor_staff_id INTEGER NOT NULL,
  intent VARCHAR(64) NOT NULL,
  user_text TEXT NOT NULL DEFAULT '',
  reply_vi TEXT NOT NULL,
  stub_mode BOOLEAN NOT NULL DEFAULT TRUE,
  model_name VARCHAR(128) NOT NULL DEFAULT 'facts',
  facts_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  citations_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  proposed_action_json JSONB,
  cards_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  degraded_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  rating VARCHAR(8),
  rating_reason VARCHAR(200),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ceo_command_turns_actor_idx
  ON ceo_command_turns (actor_staff_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ceo_command_turns_thread_idx
  ON ceo_command_turns (thread_id, created_at ASC);
CREATE INDEX IF NOT EXISTS ceo_command_turns_rating_idx
  ON ceo_command_turns (rating, created_at DESC);

CREATE TABLE IF NOT EXISTS ceo_command_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  turn_id UUID NOT NULL,
  idempotency_key VARCHAR(64) NOT NULL,
  action_id VARCHAR(64) NOT NULL,
  params_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(32) NOT NULL,
  result_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  actor_staff_id INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS ceo_command_actions_idem_idx
  ON ceo_command_actions (idempotency_key);
CREATE INDEX IF NOT EXISTS ceo_command_actions_turn_idx
  ON ceo_command_actions (turn_id);

CREATE TABLE IF NOT EXISTS ceo_command_learn_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_key VARCHAR(191) NOT NULL,
  kind VARCHAR(32) NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  source_turn_id UUID,
  status VARCHAR(32) NOT NULL DEFAULT 'pending_review',
  reviewer_staff_id INTEGER,
  reviewed_at TIMESTAMPTZ,
  reject_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ceo_command_learn_status_idx
  ON ceo_command_learn_candidates (status, created_at DESC);
