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

-- W3: recipient policies, distribution lists, delivery, risks
CREATE TABLE IF NOT EXISTS iwr_recipient_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(32) NOT NULL DEFAULT 'PTT',
  scope_json JSONB NOT NULL DEFAULT '{}',
  rules_json JSONB NOT NULL DEFAULT '{"allow_bcc":true,"cc_mode":"w1"}',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO iwr_recipient_policies (tenant_id, scope_json, rules_json, active)
SELECT 'PTT', '{}'::jsonb, '{"allow_bcc":true,"cc_mode":"w1"}'::jsonb, TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM iwr_recipient_policies WHERE tenant_id = 'PTT' AND active = TRUE
);

CREATE TABLE IF NOT EXISTS iwr_distribution_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(32) NOT NULL DEFAULT 'PTT',
  code VARCHAR(64) NOT NULL,
  name_vi VARCHAR(255) NOT NULL,
  owner_staff_id INTEGER NOT NULL,
  kind VARCHAR(32) NOT NULL DEFAULT 'static',
  rule_json JSONB NOT NULL DEFAULT '{}',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS iwr_list_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES iwr_distribution_lists (id) ON DELETE CASCADE,
  staff_id INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (list_id, staff_id)
);

CREATE TABLE IF NOT EXISTS iwr_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES iwr_reports (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS iwr_distributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES iwr_reports (id) ON DELETE CASCADE,
  thread_id UUID REFERENCES iwr_threads (id),
  kind VARCHAR(32) NOT NULL,
  from_staff_id INTEGER NOT NULL,
  note_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT iwr_distributions_kind_chk CHECK (kind IN ('reply', 'reply_all', 'forward'))
);

CREATE TABLE IF NOT EXISTS iwr_delivery_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES iwr_reports (id) ON DELETE CASCADE,
  distribution_id UUID REFERENCES iwr_distributions (id),
  channel VARCHAR(32) NOT NULL DEFAULT 'in_app',
  status VARCHAR(32) NOT NULL DEFAULT 'delivered',
  to_snapshot JSONB NOT NULL DEFAULT '[]',
  cc_snapshot JSONB NOT NULL DEFAULT '[]',
  bcc_snapshot JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS iwr_delivery_logs_report_idx
  ON iwr_delivery_logs (report_id, created_at DESC);

CREATE TABLE IF NOT EXISTS iwr_mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES iwr_reports (id) ON DELETE CASCADE,
  comment_id UUID REFERENCES iwr_comments (id) ON DELETE CASCADE,
  staff_id INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS iwr_risks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(32) NOT NULL DEFAULT 'PTT',
  report_id UUID REFERENCES iwr_reports (id) ON DELETE SET NULL,
  item_id UUID REFERENCES iwr_report_items (id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  severity VARCHAR(16) NOT NULL DEFAULT 'medium',
  owner_staff_id INTEGER,
  status VARCHAR(32) NOT NULL DEFAULT 'open',
  due_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT iwr_risks_severity_chk CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  CONSTRAINT iwr_risks_status_chk CHECK (status IN ('open', 'mitigating', 'closed'))
);

CREATE INDEX IF NOT EXISTS iwr_risks_open_idx
  ON iwr_risks (tenant_id, status, severity)
  WHERE status <> 'closed';

ALTER TABLE iwr_reports
  ADD COLUMN IF NOT EXISTS search_vector tsvector;

CREATE INDEX IF NOT EXISTS iwr_reports_search_idx
  ON iwr_reports USING GIN (search_vector);

CREATE OR REPLACE FUNCTION iwr_reports_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('simple', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('simple', COALESCE(NEW.sections_json::text, '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS iwr_reports_search_vector_trg ON iwr_reports;
CREATE TRIGGER iwr_reports_search_vector_trg
  BEFORE INSERT OR UPDATE OF title, sections_json ON iwr_reports
  FOR EACH ROW EXECUTE FUNCTION iwr_reports_search_vector_update();

UPDATE iwr_reports SET title = title WHERE search_vector IS NULL;

-- W4: dashboards, schedules, jobs, calendars, delegations
CREATE TABLE IF NOT EXISTS iwr_dash_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(32) NOT NULL DEFAULT 'PTT',
  role VARCHAR(16) NOT NULL,
  period_ymd DATE NOT NULL,
  payload_json JSONB NOT NULL DEFAULT '{}',
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, role, period_ymd)
);

CREATE TABLE IF NOT EXISTS iwr_calendars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(32) NOT NULL DEFAULT 'PTT',
  code VARCHAR(64) NOT NULL,
  name_vi VARCHAR(255) NOT NULL,
  timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS iwr_calendar_exceptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_id UUID NOT NULL REFERENCES iwr_calendars (id) ON DELETE CASCADE,
  ymd DATE NOT NULL,
  kind VARCHAR(16) NOT NULL DEFAULT 'holiday',
  note_vi VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (calendar_id, ymd)
);

CREATE TABLE IF NOT EXISTS iwr_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(32) NOT NULL DEFAULT 'PTT',
  kind VARCHAR(32) NOT NULL,
  cron_expr VARCHAR(64) NOT NULL DEFAULT '0 6 * * *',
  timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  channel VARCHAR(32) NOT NULL DEFAULT 'in_app',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  next_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT iwr_schedules_kind_chk CHECK (kind IN ('reminder', 'digest', 'precreate'))
);

CREATE TABLE IF NOT EXISTS iwr_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(32) NOT NULL DEFAULT 'PTT',
  event_key VARCHAR(255) NOT NULL,
  kind VARCHAR(32) NOT NULL DEFAULT 'notify',
  payload_json JSONB NOT NULL DEFAULT '{}',
  status VARCHAR(32) NOT NULL DEFAULT 'done',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, event_key)
);

CREATE INDEX IF NOT EXISTS iwr_jobs_created_idx ON iwr_jobs (tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS iwr_delegations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(32) NOT NULL DEFAULT 'PTT',
  delegator_staff_id INTEGER NOT NULL,
  delegate_staff_id INTEGER NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS iwr_delegations_active_idx
  ON iwr_delegations (tenant_id, delegate_staff_id, starts_at, ends_at)
  WHERE active = TRUE;

INSERT INTO iwr_calendars (tenant_id, code, name_vi, active)
SELECT 'PTT', 'vn_work', 'Lịch làm việc VN', TRUE
WHERE NOT EXISTS (SELECT 1 FROM iwr_calendars WHERE tenant_id = 'PTT' AND code = 'vn_work');

INSERT INTO iwr_schedules (tenant_id, kind, cron_expr, timezone, channel, active, next_run_at)
SELECT 'PTT', g.kind, g.cron_expr, 'Asia/Ho_Chi_Minh', 'in_app', TRUE, NOW()
FROM (VALUES
  ('precreate', '0 6 * * *'),
  ('digest', '0 8 * * *'),
  ('reminder', '0 9,14,16 * * *')
) AS g(kind, cron_expr)
WHERE NOT EXISTS (
  SELECT 1 FROM iwr_schedules s WHERE s.tenant_id = 'PTT' AND s.kind = g.kind
);

-- W5: builder, template fields, approvals, webhooks

CREATE TABLE IF NOT EXISTS iwr_template_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(32) NOT NULL DEFAULT 'PTT',
  template_id UUID NOT NULL REFERENCES iwr_templates (id) ON DELETE CASCADE,
  version VARCHAR(16) NOT NULL DEFAULT 'v1.0',
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  sections_json JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, template_id, version)
);

CREATE INDEX IF NOT EXISTS iwr_template_versions_template_idx
  ON iwr_template_versions (tenant_id, template_id, effective_from DESC);

CREATE TABLE IF NOT EXISTS iwr_template_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_version_id UUID NOT NULL REFERENCES iwr_template_versions (id) ON DELETE CASCADE,
  field_key VARCHAR(64) NOT NULL,
  label_vi VARCHAR(255) NOT NULL,
  sensitivity VARCHAR(16) NOT NULL DEFAULT 'internal',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT iwr_template_fields_sensitivity_chk CHECK (sensitivity IN ('internal', 'hr', 'finance')),
  UNIQUE (template_version_id, field_key)
);

ALTER TABLE iwr_reports ADD COLUMN IF NOT EXISTS template_version_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'iwr_reports_template_version_fk'
  ) THEN
    ALTER TABLE iwr_reports
      ADD CONSTRAINT iwr_reports_template_version_fk
      FOREIGN KEY (template_version_id) REFERENCES iwr_template_versions (id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS iwr_saved_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(32) NOT NULL DEFAULT 'PTT',
  name_vi VARCHAR(255) NOT NULL,
  owner_staff_id INTEGER NOT NULL,
  query_json JSONB NOT NULL DEFAULT '{}',
  viz VARCHAR(16) NOT NULL DEFAULT 'table',
  shared_staff_ids INTEGER[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT iwr_saved_reports_viz_chk CHECK (viz IN ('table', 'kpi_tile', 'rag_list'))
);

CREATE INDEX IF NOT EXISTS iwr_saved_reports_owner_idx
  ON iwr_saved_reports (tenant_id, owner_staff_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS iwr_dash_widgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(32) NOT NULL DEFAULT 'PTT',
  owner_staff_id INTEGER NOT NULL,
  saved_report_id UUID REFERENCES iwr_saved_reports (id) ON DELETE SET NULL,
  role VARCHAR(16) NOT NULL DEFAULT 'staff',
  title_vi VARCHAR(255) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT iwr_dash_widgets_role_chk CHECK (role IN ('staff', 'leader', 'pm', 'bod'))
);

CREATE TABLE IF NOT EXISTS iwr_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(32) NOT NULL DEFAULT 'PTT',
  report_id UUID NOT NULL REFERENCES iwr_reports (id) ON DELETE CASCADE,
  kind VARCHAR(32) NOT NULL,
  requester_staff_id INTEGER NOT NULL,
  approver_staff_id INTEGER NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'pending',
  payload_json JSONB NOT NULL DEFAULT '{}',
  decided_at TIMESTAMPTZ,
  decided_by_staff_id INTEGER,
  decision_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT iwr_approvals_kind_chk CHECK (kind IN ('budget', 'scope', 'extension', 'staffing', 'other')),
  CONSTRAINT iwr_approvals_status_chk CHECK (status IN ('pending', 'approved', 'rejected'))
);

CREATE INDEX IF NOT EXISTS iwr_approvals_report_idx
  ON iwr_approvals (tenant_id, report_id, status);

CREATE TABLE IF NOT EXISTS iwr_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(32) NOT NULL DEFAULT 'PTT',
  name_vi VARCHAR(255) NOT NULL,
  url TEXT NOT NULL,
  secret VARCHAR(255) NOT NULL,
  events TEXT[] NOT NULL DEFAULT '{report.submitted,report.acknowledged}',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  owner_staff_id INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO iwr_template_versions (tenant_id, template_id, version, effective_from, sections_json)
SELECT t.tenant_id, t.id, 'v1.0', CURRENT_DATE, t.sections_json
FROM iwr_templates t
WHERE NOT EXISTS (
  SELECT 1 FROM iwr_template_versions v
  WHERE v.template_id = t.id AND v.tenant_id = t.tenant_id AND v.version = 'v1.0'
);

INSERT INTO iwr_template_fields (template_version_id, field_key, label_vi, sensitivity, sort_order)
SELECT v.id,
       elem.value,
       elem.value,
       CASE
         WHEN elem.value = 'people' THEN 'hr'
         WHEN elem.value IN ('kpi', 'plan_vs_actual') AND t.code = 'monthly_work' THEN 'finance'
         ELSE 'internal'
       END,
       elem.ord::int
FROM iwr_template_versions v
JOIN iwr_templates t ON t.id = v.template_id
CROSS JOIN LATERAL jsonb_array_elements_text(v.sections_json) WITH ORDINALITY AS elem(value, ord)
WHERE NOT EXISTS (
  SELECT 1 FROM iwr_template_fields f
  WHERE f.template_version_id = v.id AND f.field_key = elem.value
);

UPDATE iwr_reports r
   SET template_version_id = v.id
  FROM iwr_template_versions v
 WHERE r.template_version_id IS NULL
   AND v.template_id = r.template_id
   AND v.version = 'v1.0'
   AND v.tenant_id = r.tenant_id;
