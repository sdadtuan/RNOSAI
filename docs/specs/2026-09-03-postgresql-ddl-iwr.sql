-- IWRS W1 DDL (IWR-20260903)
-- Internal Work Reporting — không đụng csd_reports

CREATE TABLE IF NOT EXISTS iwr_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(32) NOT NULL DEFAULT 'PTT',
  code VARCHAR(64) NOT NULL,
  name_vi VARCHAR(255) NOT NULL,
  kind VARCHAR(32) NOT NULL,
  sections_json JSONB NOT NULL DEFAULT '[]',
  due_rule_json JSONB NOT NULL DEFAULT '{}',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS iwr_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(32) NOT NULL DEFAULT 'PTT',
  template_id UUID NOT NULL REFERENCES iwr_templates (id),
  title VARCHAR(255) NOT NULL,
  author_staff_id INTEGER NOT NULL,
  reviewer_staff_id INTEGER,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  tz VARCHAR(64) NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  due_at TIMESTAMPTZ NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'draft',
  version VARCHAR(16) NOT NULL DEFAULT 'v1.0',
  rag VARCHAR(16),
  is_late BOOLEAN NOT NULL DEFAULT FALSE,
  late_reason TEXT,
  first_viewed_at TIMESTAMPTZ,
  first_viewed_by_staff_id INTEGER,
  submitted_at TIMESTAMPTZ,
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by_staff_id INTEGER,
  waived_at TIMESTAMPTZ,
  waived_by_staff_id INTEGER,
  waive_reason TEXT,
  sensitivity VARCHAR(32) NOT NULL DEFAULT 'internal',
  sections_json JSONB NOT NULL DEFAULT '{}',
  metrics_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT iwr_reports_status_chk CHECK (status IN (
    'draft', 'submitted', 'changes_requested', 'supplemented',
    'acknowledged', 'waived', 'archived'
  )),
  CONSTRAINT iwr_reports_period_chk CHECK (period_end >= period_start)
);

CREATE UNIQUE INDEX IF NOT EXISTS iwr_reports_author_period_uq
  ON iwr_reports (tenant_id, author_staff_id, template_id, period_start, period_end)
  WHERE is_deleted = FALSE;

CREATE INDEX IF NOT EXISTS iwr_reports_author_idx
  ON iwr_reports (tenant_id, author_staff_id, period_start DESC)
  WHERE is_deleted = FALSE;

CREATE INDEX IF NOT EXISTS iwr_reports_reviewer_status_idx
  ON iwr_reports (tenant_id, reviewer_staff_id, status)
  WHERE is_deleted = FALSE;

CREATE TABLE IF NOT EXISTS iwr_report_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES iwr_reports (id) ON DELETE CASCADE,
  version VARCHAR(16) NOT NULL,
  status VARCHAR(32) NOT NULL,
  sections_json JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by_staff_id INTEGER
);

CREATE INDEX IF NOT EXISTS iwr_report_versions_report_idx
  ON iwr_report_versions (report_id, created_at DESC);

CREATE TABLE IF NOT EXISTS iwr_report_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(32) NOT NULL DEFAULT 'PTT',
  report_id UUID NOT NULL REFERENCES iwr_reports (id) ON DELETE CASCADE,
  staff_id INTEGER NOT NULL,
  kind VARCHAR(8) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT iwr_report_recipients_kind_chk CHECK (kind IN ('to', 'cc', 'bcc'))
);

CREATE INDEX IF NOT EXISTS iwr_report_recipients_staff_idx
  ON iwr_report_recipients (tenant_id, staff_id, report_id);

CREATE TABLE IF NOT EXISTS iwr_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES iwr_reports (id) ON DELETE CASCADE,
  section_key VARCHAR(64) NOT NULL DEFAULT '',
  body_text TEXT NOT NULL,
  created_by_staff_id INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS iwr_comments_report_idx
  ON iwr_comments (report_id, created_at DESC);

CREATE TABLE IF NOT EXISTS iwr_report_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES iwr_reports (id) ON DELETE CASCADE,
  source_report_id UUID NOT NULL REFERENCES iwr_reports (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (report_id, source_report_id)
);

INSERT INTO iwr_templates (tenant_id, code, name_vi, kind, sections_json, due_rule_json, active)
VALUES
  (
    'PTT',
    'daily_work',
    'Báo cáo ngày',
    'daily',
    '["general","done","wip","next","blocked","approvals","notes"]'::jsonb,
    '{"hour":17}'::jsonb,
    TRUE
  ),
  (
    'PTT',
    'weekly_work',
    'Báo cáo tuần',
    'weekly',
    '["rag","priorities","highlights","kpi","deliverables","wip","blocked","plan_vs_actual","next_week","decisions"]'::jsonb,
    '{"weekday":5,"hour":17}'::jsonb,
    TRUE
  ),
  (
    'PTT',
    'monthly_work',
    'Báo cáo tháng',
    'monthly',
    '["rag","priorities","highlights","kpi","deliverables","wip","blocked","plan_vs_actual","next_week","decisions","month_highlights","people"]'::jsonb,
    '{"last_workday":true,"hour":17}'::jsonb,
    TRUE
  )
ON CONFLICT (tenant_id, code) DO UPDATE SET
  name_vi = EXCLUDED.name_vi,
  kind = EXCLUDED.kind,
  sections_json = EXCLUDED.sections_json,
  due_rule_json = EXCLUDED.due_rule_json,
  active = EXCLUDED.active,
  updated_at = NOW();

-- W2: typed items + evidence + RAG override
ALTER TABLE iwr_reports
  ADD COLUMN IF NOT EXISTS rag_override_reason TEXT;

CREATE TABLE IF NOT EXISTS iwr_report_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES iwr_reports (id) ON DELETE CASCADE,
  section_key VARCHAR(64) NOT NULL,
  title VARCHAR(255) NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  ref_kind VARCHAR(32) NOT NULL DEFAULT 'none',
  ref_id VARCHAR(128),
  evidence_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT iwr_report_items_ref_kind_chk CHECK (ref_kind IN (
    'csd_ticket', 'lead', 'customer', 'url', 'none'
  ))
);

CREATE INDEX IF NOT EXISTS iwr_report_items_report_idx
  ON iwr_report_items (report_id, section_key, sort_order);
