# Thiết lập KPI Type — Implementation Plan (hướng C)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Triển khai phân hệ **Cấu hình > KPI Type** theo SRS v1.0 hướng C — CRUD + form mockup **Thêm KPI Type** + AUTO/HYBRID với formula DSL, connector live trên PostgreSQL (`crm_leads`, `daily_performance`), version hóa công thức, audit, gắn Nhóm KPI đã có.

**Architecture:** Module Nest `kpi-types` cạnh `kpi-groups`. Catalog `crm_kpi_units` + `crm_kpi_data_sources`. Formula engine thuần (parse → AST → adapter SQL parameterized). Connector port: `KpiTypeDataSourceAdapter.preview(ast, period)` timeout 10s; lỗi → `CONNECTION_ERROR`, không ghi 0 giả. UI ops-web `/crm/kpi/types` form 2 cột prefix `.kpi-type-*`. Admin **Thiết lập KPI** thêm link KPI Type.

**Tech Stack:** NestJS (`ptt-crm-api`), PostgreSQL, Next.js 14 (`ops-web`), Jest + Vitest + Playwright, CSS `globals.css` (không Tailwind).

**Spec gốc:** `/Users/quoctuan/Downloads/SRS_Thiet_lap_KPI_Type.md` → copy `docs/superpowers/specs/2026-09-03-kpi-type-setup-srs.md`.  
**Design:** `docs/superpowers/specs/2026-09-03-kpi-type-setup-design.md`.  
**UI:** screenshot form Thêm KPI Type 2026-09-03.

## Global Constraints

- Copy UI tiếng Việt đúng SRS §8 / §10 (breadcrumb, badge Bản nháp / Đang hoạt động / Ngừng sử dụng, mã lỗi FR-08).
- Mọi query repository **bắt buộc** `tenant_id = 'PTT'` + `deleted_at IS NULL`.
- `code`: `^[A-Z0-9_]{3,80}$`; unique `(tenant_id, code)` khi chưa xóa mềm.
- `name`: unique case-insensitive `(tenant_id, lower(name))` khi chưa xóa mềm.
- Chỉ gán `kpi_group_id` vào Nhóm KPI `ACTIVE` cùng tenant (BR-01, BR-02).
- Trạng thái: `DRAFT` | `ACTIVE` | `INACTIVE`. Kích hoạt AUTO/HYBRID bắt buộc formula VALID + nguồn HEALTHY/STALE (không UNAVAILABLE/CONNECTION_ERROR).
- Optimistic locking: `If-Match: {row_version}` → `409` + `KPI_TYPE_VERSION_CONFLICT`.
- Formula: DSL allowlist, **không** nhận SQL thô. Preview không trả PII / raw lead.
- Connector fail: `validation_status = CONNECTION_ERROR`, Data Health rõ; **không** thay actual bằng 0 (BR-14).
- Chia 0: `divide_by_zero_fallback` = `ZERO` | `NA` | `ERROR` (mặc định `ERROR`).
- Đổi formula / source / unit / direction / target_mode trên type đang dùng → tạo `crm_kpi_type_versions` mới, không hồi tố (FR-07, AC-09).
- RBAC kiểm tra **cả UI và API**. Cap: `crm_kpi_types` view / manage / configure / export.
- Không AI, không visual formula builder, không gọi Ads/GA4 API trực tiếp (dùng bảng đã sync).
- Pattern copy từ `services/ptt-crm-api/src/kpi-groups/` và `services/ops-web/src/components/kpi-groups/`.
- Deploy: `scripts/apply_pg_ddl_kpi_types.sh` + `scripts/deploy_kpi_types_vps.sh`.

---

## Hiện trạng (gap)

| Hạng mục | Hiện có | Cần làm |
|----------|---------|---------|
| Nhóm KPI | `crm_kpi_groups` + UI `/crm/kpi/groups` | FK bắt buộc `kpi_group_id` |
| Chỉ tiêu | `crm_kpi_metrics.group_id` | Thêm `kpi_type_id` nullable |
| Formula engine | Không | Parser + 3 adapter |
| Data source registry | Không | `crm_kpi_data_sources` + health |
| Ads spend | `daily_performance` (Meta sync) | Adapter `ADS_META` |
| Leads | `crm_leads.status`, `created_at`, `source` | Map `lifecycle_stage` ← `status` |
| Admin Thiết lập KPI | Chỉ **Nhóm KPI** | Thêm **KPI Type** |

---

## Lộ trình 5 sóng

| Sóng | Phạm vi | AC |
|------|---------|-----|
| **W1 — Foundation** | DDL, units, data sources, validation, CRUD API, RBAC | AC-01, AC-03, AC-11, AC-12 |
| **W2 — UI form mockup** | List + form 2 cột + sidebar + gợi ý theo Nhóm KPI | AC-02, AC-13 |
| **W3 — Formula + CRM live** | Parser, validate-formula, adapter Lead, preview | AC-04, AC-05 |
| **W4 — Ads/Finance + health** | Adapter `daily_performance`, STALE/CONNECTION_ERROR | AC-14 |
| **W5 — Lifecycle + ship** | Status, duplicate, delete guard, versions, metric picker, E2E, deploy | AC-06…AC-10 |

---

## File map

| File | Vai trò | Sóng |
|------|---------|------|
| `docs/superpowers/specs/2026-09-03-kpi-type-setup-srs.md` | Copy SRS | 0 |
| `docs/superpowers/specs/2026-09-03-kpi-type-setup-design.md` | Design hướng C | 0 |
| `docs/specs/2026-09-03-postgresql-ddl-kpi-types.sql` | DDL + seed units/sources/types | W1 |
| `scripts/apply_pg_ddl_kpi_types.sh` | Apply DDL | W1 |
| `scripts/seed_kpi_types_rbac.sh` | Cap SUPER-ADMIN/CEO/GD | W1 |
| `scripts/deploy_kpi_types_vps.sh` | DDL + jest + ops-web build | W5 |
| `services/ptt-crm-api/src/kpi-types/kpi-types.types.ts` | Enums, bodies, error codes | W1 |
| `services/ptt-crm-api/src/kpi-types/kpi-types.validation.ts` | Pure validators | W1 |
| `services/ptt-crm-api/src/kpi-types/kpi-types.validation.spec.ts` | Jest | W1 |
| `services/ptt-crm-api/src/kpi-types/kpi-types.repository.ts` | SQL + txn junctions | W1 |
| `services/ptt-crm-api/src/kpi-types/kpi-type-audit.repository.ts` | Audit | W1 |
| `services/ptt-crm-api/src/kpi-types/kpi-types.service.ts` | BR-01…BR-16 | W1–W5 |
| `services/ptt-crm-api/src/kpi-types/kpi-types.controller.ts` | REST | W1–W5 |
| `services/ptt-crm-api/src/kpi-types/guards/staff-kpi-types.guard.ts` | view/manage/configure | W1 |
| `services/ptt-crm-api/src/kpi-types/formula/kpi-type-formula.parser.ts` | DSL → AST | W3 |
| `services/ptt-crm-api/src/kpi-types/formula/kpi-type-formula.parser.spec.ts` | Jest | W3 |
| `services/ptt-crm-api/src/kpi-types/connectors/kpi-type-connector.port.ts` | Adapter interface | W3 |
| `services/ptt-crm-api/src/kpi-types/connectors/crm-lead.adapter.ts` | Live `crm_leads` | W3 |
| `services/ptt-crm-api/src/kpi-types/connectors/ads-meta.adapter.ts` | Live `daily_performance` | W4 |
| `services/ptt-crm-api/src/kpi-types/connectors/crm-finance.adapter.ts` | Revenue snapshot | W4 |
| `services/ptt-crm-api/src/kpi-types/connectors/unavailable.adapter.ts` | SEO/Social stub | W3 |
| `services/ops-web/src/lib/kpi-types-api.ts` | Client | W2 |
| `services/ops-web/src/lib/kpi-type-util.ts` | Labels | W2 |
| `services/ops-web/src/lib/kpi-type-form.util.ts` | Client validation | W2 |
| `services/ops-web/src/app/crm/kpi/types/page.tsx` | Danh sách | W2 |
| `services/ops-web/src/app/crm/kpi/types/new/page.tsx` | Tạo | W2 |
| `services/ops-web/src/app/crm/kpi/types/[id]/page.tsx` | Sửa + versions + audit | W2–W5 |
| `services/ops-web/src/components/kpi-types/*` | Form sections, sidebar, table | W2 |
| `services/ops-web/src/app/globals.css` | `.kpi-type-*` | W2 |
| `services/ops-web/src/lib/rbac-routes.ts` | Guard `/crm/kpi/types` | W2 |
| `services/ops-web/src/lib/admin/admin-nav.ts` | Thiết lập KPI → KPI Type | W2 |
| `services/ops-web/src/components/kpi/KpiCreateMetricDrawer.tsx` | Dropdown KPI Type ACTIVE | W5 |
| `services/ops-web/e2e/kpi-types.spec.ts` | Playwright | W5 |
| `docs/huong-dan-su-dung/32-kpi-type.md` | User guide | W5 |

---

## Schema PostgreSQL

Tạo `docs/specs/2026-09-03-postgresql-ddl-kpi-types.sql` (idempotent):

```sql
CREATE TABLE IF NOT EXISTS crm_kpi_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL DEFAULT 'PTT',
  code varchar(40) NOT NULL,
  name varchar(80) NOT NULL,
  value_types text[] NOT NULL,
  UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS crm_kpi_data_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL DEFAULT 'PTT',
  code varchar(60) NOT NULL,
  name varchar(120) NOT NULL,
  adapter_key text NOT NULL,
  entities text[] NOT NULL,
  health text NOT NULL DEFAULT 'UNKNOWN'
    CHECK (health IN ('UNKNOWN','HEALTHY','STALE','CONNECTION_ERROR','UNAVAILABLE')),
  last_checked_at timestamptz,
  UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS crm_kpi_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL DEFAULT 'PTT',
  kpi_group_id uuid NOT NULL REFERENCES crm_kpi_groups(id),
  code varchar(80) NOT NULL,
  name varchar(150) NOT NULL,
  short_name varchar(50),
  description varchar(1000),
  direction text NOT NULL CHECK (direction IN ('INCREASE','DECREASE','RANGE')),
  value_type text NOT NULL CHECK (value_type IN (
    'INTEGER','DECIMAL','PERCENTAGE','CURRENCY','DURATION','SCORE','BOOLEAN')),
  unit_id uuid NOT NULL REFERENCES crm_kpi_units(id),
  decimal_places smallint NOT NULL DEFAULT 0 CHECK (decimal_places BETWEEN 0 AND 4),
  target_mode text NOT NULL CHECK (target_mode IN ('SINGLE_TARGET','THRESHOLD','RANGE')),
  minimum_target numeric(20,4),
  default_target numeric(20,4) NOT NULL,
  stretch_target numeric(20,4),
  lower_limit numeric(20,4),
  upper_limit numeric(20,4),
  calculation_mode text NOT NULL CHECK (calculation_mode IN ('AUTO','MANUAL','HYBRID')),
  primary_data_source_id uuid REFERENCES crm_kpi_data_sources(id),
  data_entity varchar(100),
  aggregation_type text CHECK (aggregation_type IN (
    'COUNT','SUM','AVG','RATE','DISTINCT_COUNT','CUSTOM')),
  formula_display text,
  sync_frequency text CHECK (sync_frequency IN (
    'REALTIME','HOURLY','DAILY','WEEKLY','MONTHLY')),
  timezone varchar(50) NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  divide_by_zero_fallback text NOT NULL DEFAULT 'ERROR'
    CHECK (divide_by_zero_fallback IN ('ZERO','NA','ERROR')),
  manual_evidence_required boolean NOT NULL DEFAULT true,
  scope_type text NOT NULL CHECK (scope_type IN (
    'ORGANIZATION','DEPARTMENT','POSITION','CUSTOM')),
  weight_min numeric(5,2),
  weight_max numeric(5,2),
  display_order integer NOT NULL DEFAULT 1 CHECK (display_order > 0),
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','ACTIVE','INACTIVE')),
  is_system_default boolean NOT NULL DEFAULT false,
  current_version integer NOT NULL DEFAULT 1,
  created_by_staff_id bigint NOT NULL,
  updated_by_staff_id bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by_staff_id bigint,
  row_version integer NOT NULL DEFAULT 1,
  CHECK (weight_min IS NULL OR (weight_min >= 0 AND weight_min <= 100)),
  CHECK (weight_max IS NULL OR (weight_max >= 0 AND weight_max <= 100)),
  CHECK (weight_max IS NULL OR weight_min IS NULL OR weight_max >= weight_min)
);

CREATE UNIQUE INDEX IF NOT EXISTS crm_kpi_types_tenant_code_uq
  ON crm_kpi_types (tenant_id, code) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS crm_kpi_types_tenant_name_ci_uq
  ON crm_kpi_types (tenant_id, lower(name)) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS crm_kpi_types_tenant_group_status_idx
  ON crm_kpi_types (tenant_id, kpi_group_id, status, display_order);

CREATE TABLE IF NOT EXISTS crm_kpi_type_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  kpi_type_id uuid NOT NULL REFERENCES crm_kpi_types(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_to timestamptz,
  formula_expression text,
  formula_display text,
  data_source_snapshot jsonb,
  target_config_snapshot jsonb,
  change_reason varchar(500),
  validation_status text NOT NULL DEFAULT 'NOT_TESTED'
    CHECK (validation_status IN ('NOT_TESTED','VALID','INVALID','CONNECTION_ERROR')),
  validation_result jsonb,
  created_by_staff_id bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kpi_type_id, version_number)
);

CREATE TABLE IF NOT EXISTS crm_kpi_type_departments (
  type_id uuid NOT NULL REFERENCES crm_kpi_types(id) ON DELETE CASCADE,
  department_id bigint NOT NULL REFERENCES crm_departments(id) ON DELETE CASCADE,
  PRIMARY KEY (type_id, department_id)
);
CREATE TABLE IF NOT EXISTS crm_kpi_type_positions (
  type_id uuid NOT NULL REFERENCES crm_kpi_types(id) ON DELETE CASCADE,
  position_id bigint NOT NULL REFERENCES crm_positions(id) ON DELETE CASCADE,
  PRIMARY KEY (type_id, position_id)
);

CREATE TABLE IF NOT EXISTS crm_kpi_type_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  entity_id uuid NOT NULL,
  action text NOT NULL,
  before_json jsonb,
  after_json jsonb,
  performed_by_staff_id bigint NOT NULL,
  performed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE crm_kpi_metrics
  ADD COLUMN IF NOT EXISTS kpi_type_id uuid NULL REFERENCES crm_kpi_types(id);
```

**Seed units:** `LEAD`, `PERCENT`, `VND`, `VND_PER_LEAD`, `TIMES`, `SESSION`, `KEYWORD`, `POINT`, `APPOINTMENT`.  
**Seed sources:** `CRM_LEAD_DASHBOARD` (adapter `crm_lead`), `ADS_META` (`ads_meta`), `CRM_FINANCE` (`crm_finance`), `WEBSITE_SEO` / `SOCIAL` (`unavailable`).  
**Seed types (DRAFT hoặc ACTIVE nếu group tồn tại):** tối thiểu `MQL_COUNT`, `CPL` theo SRS §18 / §5.

---

## API

| Method | Path | Guard |
|--------|------|-------|
| GET | `/api/v1/kpi-types` | view |
| GET | `/api/v1/kpi-types/summary` | view |
| GET | `/api/v1/kpi-types/units` | view |
| GET | `/api/v1/kpi-types/data-sources` | view |
| POST | `/api/v1/kpi-types` | manage |
| GET | `/api/v1/kpi-types/:id` | view |
| PATCH | `/api/v1/kpi-types/:id` | manage + If-Match |
| POST | `/api/v1/kpi-types/:id/status` | manage |
| POST | `/api/v1/kpi-types/:id/duplicate` | manage |
| POST | `/api/v1/kpi-types/:id/validate-formula` | configure **hoặc** manage |
| GET | `/api/v1/kpi-types/:id/versions` | view |
| GET | `/api/v1/kpi-types/:id/audit` | view |
| DELETE | `/api/v1/kpi-types/:id` | manage |

**List query:** `page`, `page_size` (20\|50\|100), `q`, `kpi_group_id`, `status`, `calculation_mode`, `direction`, `department_id`, `data_source_id`, `sort`.

---

## Formula AST

```typescript
export type KpiFormulaAst = {
  aggregation: 'COUNT' | 'SUM' | 'AVG' | 'RATE' | 'DISTINCT_COUNT';
  entity: string;          // Lead | AdSpend | AttributedRevenue
  field?: string;          // AdSpend.amount
  filters: Array<{ field: string; op: 'eq' | 'in_period'; value?: string }>;
  rate?: { numerator: KpiFormulaAst; denominator: KpiFormulaAst };
};

export function parseKpiTypeFormula(expr: string): KpiFormulaAst; // throws KPI_TYPE_FORMULA_INVALID
```

Ví dụ hợp lệ: `COUNT(Lead WHERE lifecycle_stage = 'MQL' AND created_at IN evaluation_period)`.

**CRM adapter mapping:** `lifecycle_stage` → `crm_leads.status` (so sánh case-insensitive). `created_at IN evaluation_period` → `created_at >= $from AND created_at < $to`. Chỉ COUNT/DISTINCT_COUNT trên Lead. Timeout `statement_timeout = '8s'`. Preview: `{ value, formatted_value, records_scanned }` — không list lead.

**Ads adapter:** `SUM(AdSpend.amount WHERE date IN evaluation_period)` → `SUM(spend) FROM daily_performance WHERE performance_date >= $from AND performance_date < $to`. Health STALE nếu `MAX(synced_at) < now() - 48 hours`.

---

## Task breakdown

### Task 0: Copy SRS + design đã có

**Files:**
- Create: `docs/superpowers/specs/2026-09-03-kpi-type-setup-srs.md`
- Keep: `docs/superpowers/specs/2026-09-03-kpi-type-setup-design.md`

- [ ] Copy `/Users/quoctuan/Downloads/SRS_Thiet_lap_KPI_Type.md` vào repo
- [ ] Commit: `docs(kpi): add KPI Type SRS v1.0 and C-path design`

---

### Task 1: DDL + apply + seed

**Files:**
- Create: `docs/specs/2026-09-03-postgresql-ddl-kpi-types.sql`
- Create: `scripts/apply_pg_ddl_kpi_types.sh`

**Interfaces:** tables ở Schema; seed units + 3 live sources + 2 sample types nếu `GROWTH_CONVERSION` / `BUDGET_EFFICIENCY` tồn tại.

- [ ] Viết SQL idempotent (CREATE IF NOT EXISTS + seed DO $$)
- [ ] Script: `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f docs/specs/2026-09-03-postgresql-ddl-kpi-types.sql`
- [ ] Commit: `feat(kpi): add kpi types PostgreSQL DDL and seed`

---

### Task 2: Validation thuần

**Files:**
- Create: `services/ptt-crm-api/src/kpi-types/kpi-types.types.ts`
- Create: `services/ptt-crm-api/src/kpi-types/kpi-types.validation.ts`
- Create: `services/ptt-crm-api/src/kpi-types/kpi-types.validation.spec.ts`

**Produces:**
- `KPI_TYPE_CODE_RE = /^[A-Z0-9_]{3,80}$/`
- `validateKpiTypeCode`, `validateKpiTypeName`, `validateKpiTypeTargets`, `validateKpiTypeWeights`, `validateCreateKpiTypeBody`

- [ ] **Step 1: Write failing tests**

```typescript
describe('validateKpiTypeCode', () => {
  it('accepts MQL_COUNT', () => {
    expect(validateKpiTypeCode('MQL_COUNT')).toBeNull();
  });
  it('rejects lowercase', () => {
    expect(validateKpiTypeCode('mql')).toBe('KPI_TYPE_CODE_INVALID');
  });
});

describe('validateKpiTypeTargets', () => {
  it('INCREASE THRESHOLD requires min <= default <= stretch', () => {
    expect(validateKpiTypeTargets({
      direction: 'INCREASE',
      target_mode: 'THRESHOLD',
      minimum_target: 900,
      default_target: 1200,
      stretch_target: 1500,
    })).toBeNull();
    expect(validateKpiTypeTargets({
      direction: 'INCREASE',
      target_mode: 'THRESHOLD',
      minimum_target: 1500,
      default_target: 1200,
      stretch_target: 900,
    })).toBe('KPI_TYPE_TARGET_INVALID');
  });
});
```

- [ ] Run `npx jest src/kpi-types/kpi-types.validation.spec.ts` → FAIL
- [ ] Implement validators (mã lỗi SRS §8)
- [ ] Jest PASS
- [ ] Commit: `feat(kpi): add kpi type validation`

---

### Task 3: Repository + service CRUD + guards

**Files:**
- Create: `kpi-types.repository.ts`, `kpi-type-audit.repository.ts`, `kpi-types.service.ts`, `kpi-types.service.spec.ts`, `kpi-types.controller.ts`, `kpi-types.module.ts`, `guards/staff-kpi-types.guard.ts`
- Modify: `app.module.ts`, `rbac-admin-catalog.json`
- Create: `scripts/seed_kpi_types_rbac.sh`

**Produces:**
- `listTypes`, `getById`, `insertType` (txn + junctions + version 1), `patchType`, `codeExists`, `nameExists`, `countUsage` (`crm_kpi_metrics.kpi_type_id`)
- Service ném `KPI_TYPE_GROUP_INACTIVE` nếu group không ACTIVE
- Guard copy pattern `staff-kpi-groups.guard.ts` với section `crm_kpi_types`

- [ ] Jest: create gắn group ACTIVE; reject group INACTIVE; duplicate code → 409
- [ ] Catalog: `{ "id": "crm_kpi_types", "label": "KPI — KPI Type", "page": "/crm/kpi/types" }`
- [ ] Seed RBAC cùng vị trí SUPER-ADMIN / CEO / GD
- [ ] Commit: `feat(kpi): add kpi-types Nest CRUD API`

---

### Task 4: Frontend list + form mockup

**Files:** pages/components/lib/CSS/nav như File map W2.

**Form sections (khớp screenshot):**
1. Thông tin cơ bản — nhóm (chỉ ACTIVE), mã, tên, viết tắt, mô tả 1000
2. Đơn vị & hướng đo — direction, value_type, unit, decimal_places + hint
3. Mục tiêu mặc định — segmented THRESHOLD / SINGLE / RANGE + thanh màu min/target/stretch
4. Cách tính — AUTO / MANUAL / HYBRID; nguồn + entity + aggregation + sync; editor monospace
5. Phạm vi & khuyến nghị — scope + dept/position + weight min/max + display_order

Sidebar: preview card, checklist kích hoạt, cảnh báo “chỉ hiện khi ACTIVE”.

Footer: Hủy | Lưu nháp | Lưu & Kích hoạt.

**FR-03:** chọn Nhóm KPI → gợi ý `direction` + units của group **chỉ khi user chưa sửa tay**; đổi group sau đó hiện confirm (không ghi đè im lặng).

- [ ] Vitest `kpi-type-form.util.spec.ts` (code, target, weight)
- [ ] `admin-nav` `buildKpiSetupLinks` thêm `{ href: '/crm/kpi/types', label: 'KPI Type' }` nếu `crm_kpi_types.view`
- [ ] OpsNav: dưới Nhóm KPI
- [ ] Commit: `feat(kpi): add KPI Type list and create form`

---

### Task 5: Formula parser + CRM live preview

**Files:** parser + `crm-lead.adapter.ts` + `POST validate-formula` + UI nút **Kiểm tra công thức**.

- [ ] **Failing tests**

```typescript
it('parses MQL count', () => {
  const ast = parseKpiTypeFormula(
    "COUNT(Lead WHERE lifecycle_stage = 'MQL' AND created_at IN evaluation_period)",
  );
  expect(ast.aggregation).toBe('COUNT');
  expect(ast.entity).toBe('Lead');
});

it('rejects SQL injection', () => {
  expect(() => parseKpiTypeFormula('COUNT(Lead); DROP TABLE crm_leads')).toThrow();
});
```

- [ ] Adapter: parameterized SQL only; `records_scanned` = COUNT filtered; `value` = aggregation
- [ ] Service `validateFormula`: parse → adapter.preview → persist `validation_status` trên version hiện tại; timeout 10s
- [ ] Activate AUTO: chặn nếu status ≠ VALID
- [ ] UI: badge Công thức hợp lệ / Có lỗi / Lỗi kết nối
- [ ] Commit: `feat(kpi): add formula parser and CRM lead preview`

---

### Task 6: Ads + Finance connectors + health

**Files:** `ads-meta.adapter.ts`, `crm-finance.adapter.ts`, health job/check trên `GET data-sources`.

- [ ] Jest mock pool: SUM spend trong period; empty table → value 0 **chỉ khi query thành công**; query throw → CONNECTION_ERROR
- [ ] STALE nếu max(synced_at) > 48h — vẫn cho preview, badge vàng
- [ ] CPL sample: `RATE(SUM(AdSpend.amount …) / COUNT(Lead WHERE source_category = 'Paid' …))` — RATE compile 2 adapter calls
- [ ] Commit: `feat(kpi): add ads and finance KPI type connectors`

---

### Task 7: Lifecycle, versions, metric picker, E2E, docs, deploy

**Files:** status/duplicate/delete; `GET versions`; `crm_kpi_metrics.kpi_type_id`; drawer tạo chỉ tiêu; `e2e/kpi-types.spec.ts`; `32-kpi-type.md`; `deploy_kpi_types_vps.sh`.

- [ ] Delete: `usage_count > 0` → `KPI_TYPE_DELETE_REFERENCED`
- [ ] Patch calculation fields khi `usage_count > 0` → bump `current_version`, insert version row, audit `VERSION`
- [ ] Duplicate → DRAFT, code/name mới, version 1
- [ ] Playwright: list, tạo draft MQL, validate-formula (skip nếu API down), activate nếu CRM HEALTHY
- [ ] Deploy script: DDL + seed RBAC + jest `kpi-types` + ops-web unit + build
- [ ] Commit: `feat(kpi): finish KPI Type lifecycle, e2e, and deploy`

---

## Kiểm thử

```bash
# API
cd services/ptt-crm-api && npx jest --testPathPattern='src/kpi-types' --no-coverage

# Web
cd services/ops-web && npm run test:unit -- src/lib/kpi-type-form.util.spec.ts src/lib/kpi-types-api.spec.ts

# E2E
cd services/ops-web && npm run test:e2e:kpi-types

# Deploy
APPLY=1 ./scripts/deploy_kpi_types_vps.sh
```

---

## Coverage SRS → task

| FR / AC | Task |
|---------|------|
| FR-01 List | 4 |
| FR-02 Create fields | 3–4 |
| FR-03 Group suggest | 4 |
| FR-04 Targets | 2, 4 |
| FR-05/06 Formula + preview | 5–6 |
| FR-07 Version | 7 |
| FR-08 Duplicate | 7 |
| FR-09 Status | 7 |
| FR-10 Delete | 7 |
| FR-11 Scope picker | 7 (dropdown metric) |
| FR-12 Audit | 3, 7 |
| AC-14 No fake zero | 5–6 |

**Cố ý để sau:** visual builder, import CSV, workflow duyệt, connector SEO/Social live, AI.

---

## Rủi ro hướng C

| Rủi ro | Cách xử lý trong plan |
|--------|------------------------|
| `crm_leads` không có cột `lifecycle_stage` | Map `status`; document trong seed/help text |
| `daily_performance` trống / chưa sync | Health STALE/CONNECTION_ERROR; DRAFT vẫn lưu; ACTIVE AUTO bị chặn |
| Preview chậm | `statement_timeout` 8s + API timeout 10s |
| RATE cross-source | 2 query tuần tự, chia 0 → fallback ERROR |

---

## Deploy ghi chú

Sau seed: user SUPER-ADMIN/CEO/GD **đăng nhập lại**. Menu: **Quản trị hệ thống → Thiết lập KPI → KPI Type** và `/crm/kpi/types`.
