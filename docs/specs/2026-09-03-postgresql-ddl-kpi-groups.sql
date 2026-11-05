-- KPI Groups — Wave 1 DDL + seed (2026-09-03)
-- Idempotent: safe to re-run

CREATE TABLE IF NOT EXISTS crm_kpi_groups (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           text NOT NULL DEFAULT 'PTT',
  parent_id           uuid NULL REFERENCES crm_kpi_groups(id),
  code                varchar(50) NOT NULL,
  name                varchar(100) NOT NULL,
  description         varchar(500),
  scope_type          text NOT NULL CHECK (scope_type IN ('ORGANIZATION','DEPARTMENT','POSITION','CUSTOM')),
  default_direction   text NOT NULL CHECK (default_direction IN ('INCREASE','DECREASE','RANGE')),
  color               varchar(7) NOT NULL DEFAULT '#17B6A4',
  icon                varchar(100),
  display_order       integer NOT NULL DEFAULT 1 CHECK (display_order > 0),
  status              text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','ACTIVE','INACTIVE')),
  is_system_default   boolean NOT NULL DEFAULT false,
  created_by_staff_id bigint NOT NULL,
  updated_by_staff_id bigint NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  deleted_at          timestamptz NULL,
  deleted_by_staff_id bigint NULL,
  row_version         integer NOT NULL DEFAULT 1
);

CREATE UNIQUE INDEX IF NOT EXISTS crm_kpi_groups_tenant_code_uq
  ON crm_kpi_groups (tenant_id, code) WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS crm_kpi_groups_tenant_name_ci_uq
  ON crm_kpi_groups (tenant_id, lower(name)) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS crm_kpi_groups_tenant_status_order_idx
  ON crm_kpi_groups (tenant_id, status, display_order);

CREATE INDEX IF NOT EXISTS crm_kpi_groups_tenant_scope_idx
  ON crm_kpi_groups (tenant_id, scope_type);

CREATE TABLE IF NOT EXISTS crm_kpi_group_departments (
  group_id       uuid NOT NULL REFERENCES crm_kpi_groups(id) ON DELETE CASCADE,
  department_id  bigint NOT NULL REFERENCES crm_departments(id) ON DELETE CASCADE,
  PRIMARY KEY (group_id, department_id)
);

CREATE TABLE IF NOT EXISTS crm_kpi_group_positions (
  group_id     uuid NOT NULL REFERENCES crm_kpi_groups(id) ON DELETE CASCADE,
  position_id  bigint NOT NULL REFERENCES crm_positions(id) ON DELETE CASCADE,
  PRIMARY KEY (group_id, position_id)
);

CREATE TABLE IF NOT EXISTS crm_kpi_group_unit_types (
  group_id   uuid NOT NULL REFERENCES crm_kpi_groups(id) ON DELETE CASCADE,
  unit_type  text NOT NULL,
  PRIMARY KEY (group_id, unit_type)
);

CREATE TABLE IF NOT EXISTS crm_kpi_group_data_domains (
  group_id     uuid NOT NULL REFERENCES crm_kpi_groups(id) ON DELETE CASCADE,
  data_domain  text NOT NULL,
  PRIMARY KEY (group_id, data_domain)
);

CREATE TABLE IF NOT EXISTS crm_kpi_group_audit_logs (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             text NOT NULL,
  entity_id             uuid NOT NULL,
  action                text NOT NULL,
  before_json           jsonb,
  after_json            jsonb,
  performed_by_staff_id bigint NOT NULL,
  performed_at          timestamptz NOT NULL DEFAULT now(),
  ip_address            inet NULL,
  request_id            text NULL
);

CREATE INDEX IF NOT EXISTS crm_kpi_group_audit_entity_idx
  ON crm_kpi_group_audit_logs (entity_id, performed_at DESC);

-- Wave 2: link KPI metrics to groups
ALTER TABLE crm_kpi_metrics
  ADD COLUMN IF NOT EXISTS group_id uuid NULL REFERENCES crm_kpi_groups(id);

CREATE INDEX IF NOT EXISTS idx_crm_kpi_metrics_group_id
  ON crm_kpi_metrics (group_id) WHERE group_id IS NOT NULL;

-- Seed 5 default groups (SRS §15) — skip if code already exists
DO $$
DECLARE
  v_staff_id bigint;
  v_mkt_dept bigint;
  v_group_id uuid;
BEGIN
  SELECT id INTO v_staff_id FROM crm_staff WHERE active = TRUE ORDER BY id LIMIT 1;
  IF v_staff_id IS NULL THEN
    v_staff_id := 1;
  END IF;

  SELECT id INTO v_mkt_dept
  FROM crm_departments
  WHERE active = TRUE AND (lower(code) LIKE '%mkt%' OR lower(name) LIKE '%marketing%')
  ORDER BY id LIMIT 1;

  -- GROWTH_CONVERSION
  IF NOT EXISTS (SELECT 1 FROM crm_kpi_groups WHERE tenant_id = 'PTT' AND code = 'GROWTH_CONVERSION' AND deleted_at IS NULL) THEN
    INSERT INTO crm_kpi_groups (
      tenant_id, code, name, description, scope_type, default_direction,
      color, icon, display_order, status, is_system_default,
      created_by_staff_id, updated_by_staff_id
    ) VALUES (
      'PTT', 'GROWTH_CONVERSION', 'Tăng trưởng & Chuyển đổi',
      'Đo hiệu quả tạo và chuyển đổi khách hàng tiềm năng.',
      'DEPARTMENT', 'INCREASE', '#17B6A4', 'trending-up', 1, 'ACTIVE', TRUE,
      v_staff_id, v_staff_id
    ) RETURNING id INTO v_group_id;
    IF v_mkt_dept IS NOT NULL THEN
      INSERT INTO crm_kpi_group_departments (group_id, department_id)
      VALUES (v_group_id, v_mkt_dept) ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  -- BUDGET_EFFICIENCY
  IF NOT EXISTS (SELECT 1 FROM crm_kpi_groups WHERE tenant_id = 'PTT' AND code = 'BUDGET_EFFICIENCY' AND deleted_at IS NULL) THEN
    INSERT INTO crm_kpi_groups (
      tenant_id, code, name, scope_type, default_direction,
      color, icon, display_order, status, is_system_default,
      created_by_staff_id, updated_by_staff_id
    ) VALUES (
      'PTT', 'BUDGET_EFFICIENCY', 'Hiệu quả ngân sách',
      'DEPARTMENT', 'DECREASE', '#F59E0B', 'wallet-cards', 2, 'ACTIVE', TRUE,
      v_staff_id, v_staff_id
    ) RETURNING id INTO v_group_id;
    IF v_mkt_dept IS NOT NULL THEN
      INSERT INTO crm_kpi_group_departments (group_id, department_id)
      VALUES (v_group_id, v_mkt_dept) ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  -- REVENUE_PIPELINE
  IF NOT EXISTS (SELECT 1 FROM crm_kpi_groups WHERE tenant_id = 'PTT' AND code = 'REVENUE_PIPELINE' AND deleted_at IS NULL) THEN
    INSERT INTO crm_kpi_groups (
      tenant_id, code, name, scope_type, default_direction,
      color, icon, display_order, status, is_system_default,
      created_by_staff_id, updated_by_staff_id
    ) VALUES (
      'PTT', 'REVENUE_PIPELINE', 'Doanh thu & Pipeline',
      'DEPARTMENT', 'INCREASE', '#4F46E5', 'chart-no-axes-combined', 3, 'ACTIVE', TRUE,
      v_staff_id, v_staff_id
    ) RETURNING id INTO v_group_id;
    IF v_mkt_dept IS NOT NULL THEN
      INSERT INTO crm_kpi_group_departments (group_id, department_id)
      VALUES (v_group_id, v_mkt_dept) ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  -- BRAND_AWARENESS
  IF NOT EXISTS (SELECT 1 FROM crm_kpi_groups WHERE tenant_id = 'PTT' AND code = 'BRAND_AWARENESS' AND deleted_at IS NULL) THEN
    INSERT INTO crm_kpi_groups (
      tenant_id, code, name, scope_type, default_direction,
      color, icon, display_order, status, is_system_default,
      created_by_staff_id, updated_by_staff_id
    ) VALUES (
      'PTT', 'BRAND_AWARENESS', 'Thương hiệu & Độ nhận biết',
      'DEPARTMENT', 'INCREASE', '#EC4899', 'sparkles', 4, 'ACTIVE', TRUE,
      v_staff_id, v_staff_id
    ) RETURNING id INTO v_group_id;
    IF v_mkt_dept IS NOT NULL THEN
      INSERT INTO crm_kpi_group_departments (group_id, department_id)
      VALUES (v_group_id, v_mkt_dept) ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  -- OPERATIONS_GOVERNANCE
  IF NOT EXISTS (SELECT 1 FROM crm_kpi_groups WHERE tenant_id = 'PTT' AND code = 'OPERATIONS_GOVERNANCE' AND deleted_at IS NULL) THEN
    INSERT INTO crm_kpi_groups (
      tenant_id, code, name, scope_type, default_direction,
      color, icon, display_order, status, is_system_default,
      created_by_staff_id, updated_by_staff_id
    ) VALUES (
      'PTT', 'OPERATIONS_GOVERNANCE', 'Vận hành & Quản trị Marketing',
      'DEPARTMENT', 'INCREASE', '#64748B', 'settings-2', 5, 'ACTIVE', TRUE,
      v_staff_id, v_staff_id
    ) RETURNING id INTO v_group_id;
    IF v_mkt_dept IS NOT NULL THEN
      INSERT INTO crm_kpi_group_departments (group_id, department_id)
      VALUES (v_group_id, v_mkt_dept) ON CONFLICT DO NOTHING;
    END IF;
  END IF;
END $$;
