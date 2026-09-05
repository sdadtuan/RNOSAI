### Task 31: Wave 4 DDL

**Files:** `docs/specs/2026-09-05-postgresql-ddl-am-w4.sql`, `scripts/apply_pg_ddl_am_w4.sh`

```sql
CREATE TABLE IF NOT EXISTS crm_am_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  agency_client_id UUID NOT NULL,
  title TEXT NOT NULL,
  kind TEXT,
  package TEXT,
  value_vnd BIGINT,
  probability INTEGER,
  stage TEXT NOT NULL DEFAULT 'qualify',
  next_step TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  ai_evidence_json JSONB,
  won_at TIMESTAMPTZ,
  lost_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT crm_am_opp_stage_chk CHECK (
    stage IN ('qualify','propose','negotiate','won','lost')
  )
);

CREATE TABLE IF NOT EXISTS crm_am_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  agency_client_id UUID NOT NULL,
  kind TEXT NOT NULL,
  score NUMERIC(5,2),
  comment TEXT,
  followup_task_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_am_surveys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  name TEXT NOT NULL,
  template TEXT NOT NULL,
  channel TEXT,
  audience_json JSONB,
  no_recontact_days INTEGER,
  csat_task_threshold NUMERIC(5,2) NOT NULL DEFAULT 3,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_am_custom_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  api_key TEXT NOT NULL,
  label TEXT NOT NULL,
  field_type TEXT NOT NULL,
  industry_slug TEXT,
  required BOOLEAN NOT NULL DEFAULT FALSE,
  filterable BOOLEAN NOT NULL DEFAULT FALSE,
  reportable BOOLEAN NOT NULL DEFAULT FALSE,
  access_json JSONB,
  UNIQUE (tenant_id, api_key)
);

CREATE TABLE IF NOT EXISTS crm_am_field_values (
  agency_client_id UUID NOT NULL,
  field_id UUID NOT NULL,
  value_json JSONB,
  PRIMARY KEY (agency_client_id, field_id)
);

CREATE TABLE IF NOT EXISTS crm_am_sla_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  name TEXT NOT NULL,
  first_response_minutes INTEGER NOT NULL,
  resolve_minutes INTEGER NOT NULL,
  pause_on_waiting_client BOOLEAN NOT NULL DEFAULT TRUE,
  escalate_json JSONB NOT NULL DEFAULT '{"70":"lead","90":"director","100":"executive"}',
  workday_start TEXT NOT NULL DEFAULT '08:30',
  workday_end TEXT NOT NULL DEFAULT '17:30',
  workdays INTEGER[] NOT NULL DEFAULT '{1,2,3,4,5}',
  holidays DATE[] NOT NULL DEFAULT '{}'
);
```

- [ ] Commit: `feat(am): add Wave 4 tables for growth, feedback, and fields`.

---

