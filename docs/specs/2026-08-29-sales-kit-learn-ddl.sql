-- Sales Kit ChatBox + learn loop (SK-AI-0…4)
-- Apply: scripts/apply_pg_ddl_sales_kit_learn.sh

CREATE TABLE IF NOT EXISTS sales_kit_turns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id INTEGER NOT NULL,
  actor_staff_id INTEGER,
  intent VARCHAR(64) NOT NULL,
  user_text TEXT NOT NULL DEFAULT '',
  reply_vi TEXT NOT NULL,
  stub_mode BOOLEAN NOT NULL DEFAULT TRUE,
  model_name VARCHAR(128) NOT NULL DEFAULT 'rules',
  citations_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  apply_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  rating VARCHAR(8),
  rating_reason VARCHAR(200),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS sales_kit_turns_session_idx
  ON sales_kit_turns (session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS sales_kit_turns_rating_idx
  ON sales_kit_turns (rating, created_at DESC);

CREATE TABLE IF NOT EXISTS sales_kit_learn_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_key VARCHAR(191) NOT NULL,
  kind VARCHAR(32) NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  source_session_id INTEGER NOT NULL,
  source_lead_id INTEGER,
  source_turn_id UUID,
  status VARCHAR(32) NOT NULL DEFAULT 'pending_review',
  reviewer_staff_id INTEGER,
  reviewed_at TIMESTAMPTZ,
  reject_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS sales_kit_learn_status_idx
  ON sales_kit_learn_candidates (status, created_at DESC);
CREATE INDEX IF NOT EXISTS sales_kit_learn_folder_q_idx
  ON sales_kit_learn_candidates (folder_key, created_at DESC);

CREATE TABLE IF NOT EXISTS sales_kit_runtime (
  id SMALLINT PRIMARY KEY CHECK (id = 1),
  mode VARCHAR(16) NOT NULL DEFAULT 'off'
    CHECK (mode IN ('off', 'openai', 'ollama')),
  updated_by INTEGER,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO sales_kit_runtime (id, mode) VALUES (1, 'off')
  ON CONFLICT (id) DO NOTHING;
