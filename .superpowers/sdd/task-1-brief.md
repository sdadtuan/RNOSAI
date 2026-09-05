### Task 1: Wave 1 DDL

**Files:**
- Create: `docs/specs/2026-09-05-postgresql-ddl-am.sql`
- Create: `scripts/apply_pg_ddl_am.sh`
- Test: `psql` `\dt crm_am_*`

**Interfaces:**
- Consumes: none
- Produces: `crm_am_account_ext`, `crm_am_plans`, `crm_am_tasks`, `crm_am_health_snapshots`, `crm_am_settings`, `crm_am_saved_views`, `crm_am_notifications`, `crm_am_audit`

- [ ] **Step 1: Write DDL**

```sql
CREATE TABLE IF NOT EXISTS crm_am_account_ext (
  agency_client_id UUID PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  account_owner_staff_id INTEGER,
  backup_staff_id INTEGER,
  team_id INTEGER,
  parent_agency_client_id UUID,
  tier TEXT,
  am_status TEXT NOT NULL DEFAULT 'active',
  industry_override TEXT,
  quota_exempt BOOLEAN NOT NULL DEFAULT FALSE,
  churned_at TIMESTAMPTZ,
  churn_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT crm_am_account_ext_status_chk CHECK (
    am_status IN ('pending_handover','onboarding','active','at_risk','renewing','paused','churned')
  ),
  CONSTRAINT crm_am_account_ext_parent_chk CHECK (
    parent_agency_client_id IS NULL OR parent_agency_client_id <> agency_client_id
  )
);

CREATE INDEX IF NOT EXISTS crm_am_account_ext_owner_idx
  ON crm_am_account_ext (tenant_id, account_owner_staff_id);
CREATE INDEX IF NOT EXISTS crm_am_account_ext_team_idx
  ON crm_am_account_ext (tenant_id, team_id);
CREATE INDEX IF NOT EXISTS crm_am_account_ext_parent_idx
  ON crm_am_account_ext (parent_agency_client_id);

CREATE TABLE IF NOT EXISTS crm_am_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  agency_client_id UUID NOT NULL,
  contract_id BIGINT,
  kind TEXT NOT NULL,
  period_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  owner_staff_id INTEGER NOT NULL,
  due_on DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT crm_am_plans_kind_chk CHECK (kind IN ('care','qbr','renewal','expand')),
  UNIQUE (tenant_id, agency_client_id, kind, period_key)
);

CREATE TABLE IF NOT EXISTS crm_am_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  agency_client_id UUID NOT NULL,
  plan_id UUID REFERENCES crm_am_plans(id),
  title TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'task',
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'new',
  assignee_staff_id INTEGER,
  due_at TIMESTAMPTZ,
  source TEXT NOT NULL DEFAULT 'manual',
  source_ref TEXT,
  dismissed_at TIMESTAMPTZ,
  sla_first_due_at TIMESTAMPTZ,
  sla_resolve_due_at TIMESTAMPTZ,
  sla_paused BOOLEAN NOT NULL DEFAULT FALSE,
  waiting_client_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT crm_am_tasks_kind_chk CHECK (
    kind IN ('task','client_request','issue','escalation','approval','milestone')
  ),
  CONSTRAINT crm_am_tasks_status_chk CHECK (
    status IN ('new','in_progress','waiting_client','waiting_internal','resolved','closed','cancelled')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS crm_am_tasks_source_ref_uq
  ON crm_am_tasks (tenant_id, source, source_ref)
  WHERE source_ref IS NOT NULL AND dismissed_at IS NULL
    AND status NOT IN ('cancelled','closed');

CREATE TABLE IF NOT EXISTS crm_am_health_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  agency_client_id UUID NOT NULL,
  as_of DATE NOT NULL,
  score NUMERIC(5,1) NOT NULL,
  band TEXT NOT NULL,
  components_json JSONB NOT NULL,
  scorecard_version INTEGER NOT NULL DEFAULT 1,
  thin_data BOOLEAN NOT NULL DEFAULT FALSE,
  override_band TEXT,
  override_reason TEXT,
  override_until DATE,
  UNIQUE (tenant_id, agency_client_id, as_of),
  CONSTRAINT crm_am_health_band_chk CHECK (band IN ('healthy','watch','at_risk','critical'))
);

CREATE TABLE IF NOT EXISTS crm_am_settings (
  tenant_id TEXT PRIMARY KEY DEFAULT 'PTT',
  weights_json JSONB NOT NULL DEFAULT '{"kpi_delivery":30,"engagement":20,"financial":20,"satisfaction":15,"contract_support":15}',
  bands_json JSONB NOT NULL DEFAULT '{"healthy":[80,100],"watch":[60,79],"at_risk":[40,59],"critical":[0,39]}',
  quota_accounts_per_am INTEGER NOT NULL DEFAULT 40,
  watch_ends_on_days INTEGER NOT NULL DEFAULT 30,
  health_drop_alert INTEGER NOT NULL DEFAULT 10,
  rollup_parent_health BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by_staff_id INTEGER
);

INSERT INTO crm_am_settings (tenant_id) VALUES ('PTT') ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS crm_am_saved_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  owner_staff_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  shared BOOLEAN NOT NULL DEFAULT FALSE,
  page TEXT NOT NULL,
  query_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_am_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  staff_id INTEGER NOT NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  href TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_am_audit (
  id BIGSERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  actor_staff_id INTEGER,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  payload_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

- [ ] **Step 2: Write apply script** — copy `scripts/apply_pg_ddl_csd.sh` pattern; point at the AM DDL; do **not** seed user caps.

- [ ] **Step 3: Apply local**

```bash
chmod +x scripts/apply_pg_ddl_am.sh
./scripts/apply_pg_ddl_am.sh
```

Expected: `\dt crm_am_*` lists 8 tables. `SELECT weights_json FROM crm_am_settings WHERE tenant_id='PTT'` returns the 30/20/20/15/15 object.

- [ ] **Step 4: Commit**

```bash
git add docs/specs/2026-09-05-postgresql-ddl-am.sql scripts/apply_pg_ddl_am.sh
git commit -m "$(cat <<'EOF'
feat(am): add Wave 1 PostgreSQL tables for Account Management OS

EOF
)"
```

---

