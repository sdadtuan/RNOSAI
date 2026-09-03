# Thiết lập Nhóm KPI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Triển khai phân hệ **Cấu hình > Nhóm KPI** theo SRS v1.0 — danh sách, tạo/sửa, chi tiết, trạng thái, nhân bản, sắp xế thứ tự, audit log — khớp UI mockup danh sách và form **Thêm Nhóm KPI**.

**Architecture:** Tách module Nest `kpi-groups` cạnh `kpi` hiện có; PostgreSQL master + bảng quan hệ (departments, positions, unit_types, data_domains); API REST `/api/v1/kpi-groups`; ops-web routes `/crm/kpi/groups` và `/crm/kpi/groups/new`, `/crm/kpi/groups/[id]`; pattern UI tham chiếu **b2b-projects** (list + detail form) + layout 2 cột form mockup; audit log riêng `crm_kpi_group_audit_logs`. Wave 1 giao CRUD + UI; Wave 2 gắn `group_id` vào `crm_kpi_metrics` và dropdown tạo KPI; Wave 3 import + drag-order nâng cao.

**Tech Stack:** NestJS (`ptt-crm-api`), PostgreSQL, Next.js 14 (`ops-web`), Jest + Vitest + Playwright, CSS `globals.css` (prefix `.kpi-group-*`, không Tailwind).

**Spec gốc:** `/Users/quoctuan/Downloads/SRS_Thiet_lap_Nhom_KPI.md` — copy vào repo: `docs/superpowers/specs/2026-09-03-kpi-group-setup-srs.md` trước khi code.

**UI tham chiếu:** mockup **Danh sách Nhóm KPI** và **Thêm Nhóm KPI** (screenshot 2026-09-03).

## Global Constraints

- Copy UI tiếng Việt đúng SRS §8 (breadcrumb, nhãn trạng thái, thông báo lỗi mã FR-10).
- Mọi query repository **bắt buộc** lọc `tenant_id` + `deleted_at IS NULL` (trừ admin restore).
- Wave 1 dùng `tenant_id text NOT NULL DEFAULT 'PTT'` (cùng pattern `IWR_TENANT_ID`); không block chờ UUID tenant đa tenant đầy đủ.
- Trạng thái: `DRAFT` | `ACTIVE` | `INACTIVE`. Nhãn UI: Bản nháp / Đang hoạt động / Ngừng sử dụng.
- `scope_type`: `ORGANIZATION` | `DEPARTMENT` | `POSITION` | `CUSTOM`.
- `default_direction`: `INCREASE` | `DECREASE` | `RANGE`.
- `code`: regex `^[A-Z0-9_]{3,50}$`; unique `(tenant_id, code)` khi chưa xóa mềm.
- `name`: unique case-insensitive `(tenant_id, lower(name))` khi chưa xóa mềm.
- `color`: `#RRGGBB`. `display_order` integer > 0.
- Optimistic locking: header `If-Match: {row_version}` → `409 Conflict`.
- RBAC kiểm tra **cả UI và API**; không chỉ ẩn nút.
- Không AI, không sync Ads/GA4, không công thức kéo-thả (SRS §2.2).
- Deploy: script mới `scripts/apply_pg_ddl_kpi_groups.sh` + mở rộng `scripts/deploy_kpi_vps.sh` (hoặc tạo mới nếu chưa có).

---

## Hiện trạng codebase (gap analysis)

| Hạng mục | Hiện có | Cần làm |
|----------|---------|---------|
| Bảng DB | `crm_kpi_metrics`, `crm_staff_kpi` — **không có group** | `crm_kpi_groups` + 4 bảng quan hệ + audit |
| API | `/api/crm/kpi/metrics` CRUD một phần | `/api/v1/kpi-groups` đầy đủ SRS §10 |
| UI | `/crm/kpi` cockpit only | `/crm/kpi/groups`, form 2 cột |
| RBAC | `crm_kpi_records`, `crm_kpi_metrics` | Thêm `crm_kpi_groups` (view/manage/configure) |
| Org master | `GET /api/v1/staff/org/departments`, `GET .../positions` | Dùng cho multi-select phạm vi |
| KPI Type | **Chưa có** | Wave 2: `group_id` trên metric; Wave 3: `crm_kpi_types` |

---

## Lộ trình theo sóng (đề xuất 3 sprint)

| Sóng | Phạm vi | Nghiệm thu chính |
|------|---------|-----------------|
| **W1 — Foundation + List + Form** | DDL, seed, API CRUD cơ bản, RBAC, trang danh sách + tạo/sửa | AC-01, AC-02, AC-03, AC-12 |
| **W2 — Lifecycle + Detail + Audit** | Status, duplicate, soft delete + reference guard, chi tiết, audit, tích hợp metric picker | AC-05, AC-06, AC-07, AC-08, AC-11 |
| **W3 — Order + Scope runtime + Import** | Drag reorder, API scope cho dropdown KPI, nút Nhập dữ liệu CSV | AC-04, AC-09, AC-10 |

---

## File map (toàn bộ feature)

| File | Vai trò | Sóng |
|------|---------|------|
| `docs/superpowers/specs/2026-09-03-kpi-group-setup-srs.md` | Copy SRS vào repo | 0 |
| `docs/specs/2026-09-03-postgresql-ddl-kpi-groups.sql` | DDL + seed | W1 |
| `scripts/apply_pg_ddl_kpi_groups.sh` | Apply DDL VPS/local | W1 |
| `services/ptt-crm-api/src/kpi-groups/kpi-groups.module.ts` | Nest module | W1 |
| `services/ptt-crm-api/src/kpi-groups/kpi-groups.controller.ts` | REST endpoints | W1–W2 |
| `services/ptt-crm-api/src/kpi-groups/kpi-groups.service.ts` | Business rules BR-01…BR-12 | W1–W2 |
| `services/ptt-crm-api/src/kpi-groups/kpi-groups.repository.ts` | SQL + transactions | W1–W2 |
| `services/ptt-crm-api/src/kpi-groups/kpi-groups.types.ts` | Types + enums + error codes | W1 |
| `services/ptt-crm-api/src/kpi-groups/kpi-groups.validation.ts` | Pure validation | W1 |
| `services/ptt-crm-api/src/kpi-groups/kpi-groups.validation.spec.ts` | Jest | W1 |
| `services/ptt-crm-api/src/kpi-groups/kpi-groups.service.spec.ts` | Jest integration mocks | W1–W2 |
| `services/ptt-crm-api/src/kpi-groups/guards/staff-kpi-groups.guard.ts` | view / manage | W1 |
| `services/ptt-crm-api/src/kpi-groups/kpi-group-audit.repository.ts` | Audit insert/list | W2 |
| `services/ptt-crm-api/src/staff-permissions/rbac-admin-catalog.json` | Cap mới | W1 |
| `services/ptt-crm-api/src/app.module.ts` | Import module | W1 |
| `services/ops-web/src/lib/kpi-groups-api.ts` | API client | W1 |
| `services/ops-web/src/lib/kpi-groups-api.spec.ts` | parse helpers | W1 |
| `services/ops-web/src/lib/kpi-group-util.ts` | labels, badges, direction icons | W1 |
| `services/ops-web/src/lib/kpi-group-form.util.ts` | client validation | W1 |
| `services/ops-web/src/lib/kpi-group-form.util.spec.ts` | Vitest | W1 |
| `services/ops-web/src/app/crm/kpi/groups/page.tsx` | Danh sách (mockup 1) | W1 |
| `services/ops-web/src/app/crm/kpi/groups/new/page.tsx` | Tạo mới | W1 |
| `services/ops-web/src/app/crm/kpi/groups/[id]/page.tsx` | Sửa + chi tiết | W1–W2 |
| `services/ops-web/src/components/kpi-groups/KpiGroupSummaryCards.tsx` | 4 thẻ thống kê | W1 |
| `services/ops-web/src/components/kpi-groups/KpiGroupFilterBar.tsx` | Search + filter | W1 |
| `services/ops-web/src/components/kpi-groups/KpiGroupTable.tsx` | Bảng + menu ⋮ | W1 |
| `services/ops-web/src/components/kpi-groups/KpiGroupForm.tsx` | Form 4 section | W1 |
| `services/ops-web/src/components/kpi-groups/KpiGroupFormSidebar.tsx` | Tóm tắt + checklist | W1 |
| `services/ops-web/src/components/kpi-groups/KpiGroupScopePicker.tsx` | ORG / DEPT / POSITION | W1 |
| `services/ops-web/src/components/kpi-groups/KpiGroupStatusBadge.tsx` | Badge trạng thái | W1 |
| `services/ops-web/src/components/kpi-groups/KpiGroupAuditPanel.tsx` | Lịch sử thay đổi | W2 |
| `services/ops-web/src/components/kpi-groups/KpiGroupImportModal.tsx` | CSV import | W3 |
| `services/ops-web/src/app/globals.css` | `.kpi-group-*` styles | W1 |
| `services/ops-web/src/lib/rbac-routes.ts` | Route guard | W1 |
| `services/ops-web/src/components/OpsNav.tsx` | Nav KPI > Nhóm KPI | W1 |
| `services/ops-web/e2e/kpi-groups.spec.ts` | Playwright smoke | W2 |
| `docs/huong-dan-su-dung/XX-kpi-nhom-kpi.md` | Hướng dẫn người dùng | W2 |

---

## Schema PostgreSQL (Wave 1)

Tạo `docs/specs/2026-09-03-postgresql-ddl-kpi-groups.sql`:

```sql
-- Enums (hoặc CHECK constraints nếu team không dùng PG enum)
CREATE TABLE IF NOT EXISTS crm_kpi_groups (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       text NOT NULL DEFAULT 'PTT',
  parent_id       uuid NULL REFERENCES crm_kpi_groups(id),
  code            varchar(50) NOT NULL,
  name            varchar(100) NOT NULL,
  description     varchar(500),
  scope_type      text NOT NULL CHECK (scope_type IN ('ORGANIZATION','DEPARTMENT','POSITION','CUSTOM')),
  default_direction text NOT NULL CHECK (default_direction IN ('INCREASE','DECREASE','RANGE')),
  color           varchar(7) NOT NULL DEFAULT '#17B6A4',
  icon            varchar(100),
  display_order   integer NOT NULL DEFAULT 1 CHECK (display_order > 0),
  status          text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','ACTIVE','INACTIVE')),
  is_system_default boolean NOT NULL DEFAULT false,
  created_by_staff_id integer NOT NULL,
  updated_by_staff_id integer NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz NULL,
  deleted_by_staff_id integer NULL,
  row_version     integer NOT NULL DEFAULT 1
);

CREATE UNIQUE INDEX crm_kpi_groups_tenant_code_uq
  ON crm_kpi_groups (tenant_id, code) WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX crm_kpi_groups_tenant_name_ci_uq
  ON crm_kpi_groups (tenant_id, lower(name)) WHERE deleted_at IS NULL;

CREATE INDEX crm_kpi_groups_tenant_status_order_idx
  ON crm_kpi_groups (tenant_id, status, display_order);

CREATE TABLE IF NOT EXISTS crm_kpi_group_departments (
  group_id uuid NOT NULL REFERENCES crm_kpi_groups(id) ON DELETE CASCADE,
  department_id uuid NOT NULL,
  PRIMARY KEY (group_id, department_id)
);

CREATE TABLE IF NOT EXISTS crm_kpi_group_positions (
  group_id uuid NOT NULL REFERENCES crm_kpi_groups(id) ON DELETE CASCADE,
  position_id integer NOT NULL,
  PRIMARY KEY (group_id, position_id)
);

CREATE TABLE IF NOT EXISTS crm_kpi_group_unit_types (
  group_id uuid NOT NULL REFERENCES crm_kpi_groups(id) ON DELETE CASCADE,
  unit_type text NOT NULL,
  PRIMARY KEY (group_id, unit_type)
);

CREATE TABLE IF NOT EXISTS crm_kpi_group_data_domains (
  group_id uuid NOT NULL REFERENCES crm_kpi_groups(id) ON DELETE CASCADE,
  data_domain text NOT NULL,
  PRIMARY KEY (group_id, data_domain)
);

CREATE TABLE IF NOT EXISTS crm_kpi_group_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  entity_id uuid NOT NULL,
  action text NOT NULL,
  before_json jsonb,
  after_json jsonb,
  performed_by_staff_id integer NOT NULL,
  performed_at timestamptz NOT NULL DEFAULT now(),
  ip_address inet NULL,
  request_id text NULL
);

CREATE INDEX crm_kpi_group_audit_entity_idx ON crm_kpi_group_audit_logs (entity_id, performed_at DESC);
```

**Wave 2 migration** (file riêng): `ALTER TABLE crm_kpi_metrics ADD COLUMN group_id uuid NULL REFERENCES crm_kpi_groups(id);`

**Seed:** INSERT 10 nhóm SRS §5 (hoặc 5 nhóm SRS §15) với `is_system_default = true`, `status = 'ACTIVE'`, departments Marketing nếu có.

---

## API contract (mapping SRS §10)

| Method | Path | Guard | Sóng |
|--------|------|-------|------|
| GET | `/api/v1/kpi-groups` | view | W1 |
| POST | `/api/v1/kpi-groups` | manage | W1 |
| GET | `/api/v1/kpi-groups/:id` | view | W1 |
| PATCH | `/api/v1/kpi-groups/:id` | manage | W1 |
| POST | `/api/v1/kpi-groups/:id/status` | manage | W2 |
| POST | `/api/v1/kpi-groups/:id/duplicate` | manage | W2 |
| PUT | `/api/v1/kpi-groups/display-order` | configure | W3 |
| DELETE | `/api/v1/kpi-groups/:id` | manage | W2 |
| GET | `/api/v1/kpi-groups/:id/audit` | view | W2 |
| GET | `/api/v1/kpi-groups/summary` | view | W1 (4 cards stats) |

**List query params:** `page`, `page_size` (20|50|100), `q`, `status`, `department_id`, `scope_type`, `sort` (`display_order:asc`, `name:asc`, `updated_at:desc`).

**Response list item fields:** id, code, name, description, scope_type, departments[], positions[], default_direction, color, icon, display_order, status, usage_count, updated_at, updated_by {id, name}.

`usage_count` Wave 1 = `COUNT(crm_kpi_metrics WHERE group_id = …)` sau W2; trước đó trả 0.

---

## RBAC (SRS §11)

Thêm vào `rbac-admin-catalog.json`:

```json
{
  "id": "crm_kpi_groups",
  "label_vi": "CRM — Nhóm KPI",
  "pages": [
    {
      "id": "crm_kpi_groups",
      "path": "/crm/kpi/groups",
      "label_vi": "Nhóm KPI",
      "actions": ["view", "manage", "configure", "export"]
    }
  ]
}
```

| Action | Guard | Hành vi |
|--------|-------|---------|
| view | `StaffKpiGroupsViewGuard` | List, detail, audit read |
| manage | `StaffKpiGroupsManageGuard` | create, patch, status, duplicate, delete |
| configure | manage + cap configure | reorder, import, sửa system default code |

**Scope read (FR-09):** service method `listVisibleForStaff(staffId)` — Head of Dept / Marketing Leader chỉ thấy nhóm ACTIVE thuộc phòng ban/chức danh của họ; Tenant Admin thấy tất cả.

---

## UI mapping mockup → component

### Màn danh sách (mockup 1)

| Mockup | Component / data |
|--------|------------------|
| Breadcrumb `KPI & Hiệu suất / Cấu hình / Nhóm KPI` | `HubPageLayout` breadcrumbs |
| 4 summary cards | `KpiGroupSummaryCards` ← `GET /summary` |
| Nút **Nhập dữ liệu** | `KpiGroupImportModal` (W3) — W1: disabled + tooltip "Sắp ra mắt" |
| Nút **+ Thêm Nhóm KPI** | Link `/crm/kpi/groups/new` |
| Search + 3 filter + Xóa bộ lọc | `KpiGroupFilterBar` |
| Cột Nhóm KPI (icon, code, name, mô tả ngắn) | `KpiGroupTable` |
| Phạm vi áp dụng (tags) | departments / "Toàn doanh nghiệp" |
| Hướng đo mặc định | icon ↑/↓ + label Tăng dần/Giảm dần |
| Chỉ tiêu đang sử dụng | link `usage_count` → tab metrics (W2) |
| Trạng thái badge | `KpiGroupStatusBadge` |
| Cập nhật gần nhất + avatar | `updated_at` + staff name |
| Menu ⋮ | Xem, Sửa, Nhân bản, Ngừng sử dụng, Xóa |
| Pagination 20/trang | server-side meta |
| Sidebar **Gợi ý cấu hình** | static panel SRS §8.1 |

### Màn Thêm/Sửa (mockup 2)

| Section mockup | Fields |
|----------------|--------|
| **1. Thông tin cơ bản** | code*, name*, description (500), char counter |
| **2. Phạm vi áp dụng** | segmented: Toàn DN / Theo phòng ban / Theo chức danh → `scope_type`; multi-select dept; multi-select position (filter theo dept) |
| **3. Thiết lập đo lường** | default_direction*; suggested_unit_types[]; data_domains[] (icon chips) |
| **4. Nhận diện & hiển thị** | color picker, icon select, display_order*, live preview bar |
| Sidebar | `KpiGroupFormSidebar` — tóm tắt + checklist validation |
| Footer sticky | Hủy | Lưu nháp (DRAFT) | Lưu & Kích hoạt (ACTIVE) |

---

## Task breakdown

### Task 0: Copy SRS vào repo

**Files:**
- Create: `docs/superpowers/specs/2026-09-03-kpi-group-setup-srs.md`

- [ ] Copy nội dung từ `/Users/quoctuan/Downloads/SRS_Thiet_lap_Nhom_KPI.md`
- [ ] Commit: `docs(kpi): add KPI Group setup SRS v1.0`

---

### Task 1: DDL + apply script + seed

**Files:**
- Create: `docs/specs/2026-09-03-postgresql-ddl-kpi-groups.sql`
- Create: `scripts/apply_pg_ddl_kpi_groups.sh`

**Interfaces:**
- Produces: tables listed in Schema section; seed 5–10 default groups

- [ ] **Step 1:** Viết SQL đầy đủ (schema + seed + GRANT nếu cần)
- [ ] **Step 2:** Script apply idempotent (`psql -f`, echo OK)
- [ ] **Step 3:** Chạy local against dev DB; verify `\d crm_kpi_groups`
- [ ] **Step 4:** Commit `feat(kpi): add kpi groups PostgreSQL DDL and seed`

---

### Task 2: Validation pure functions (API)

**Files:**
- Create: `services/ptt-crm-api/src/kpi-groups/kpi-groups.validation.ts`
- Create: `services/ptt-crm-api/src/kpi-groups/kpi-groups.validation.spec.ts`

**Interfaces:**
- Produces:
  - `export const KPI_GROUP_CODE_RE = /^[A-Z0-9_]{3,50}$/`
  - `export function validateKpiGroupCode(code: string): string | null`
  - `export function validateKpiGroupColor(color: string): boolean`
  - `export function validateKpiGroupScope(body: { scope_type: string; department_ids?: string[]; position_ids?: string[] }): string | null`

- [ ] **Step 1: Write failing tests**

```typescript
describe('validateKpiGroupCode', () => {
  it('accepts GROWTH_CONVERSION', () => {
    expect(validateKpiGroupCode('GROWTH_CONVERSION')).toBeNull();
  });
  it('rejects lowercase', () => {
    expect(validateKpiGroupCode('growth')).toBe('KPI_GROUP_CODE_INVALID');
  });
});
```

- [ ] **Step 2:** Run `npx jest kpi-groups.validation.spec.ts` → FAIL
- [ ] **Step 3:** Implement validators returning error codes FR-10
- [ ] **Step 4:** Run jest → PASS
- [ ] **Step 5:** Commit

---

### Task 3: Repository layer

**Files:**
- Create: `services/ptt-crm-api/src/kpi-groups/kpi-groups.types.ts`
- Create: `services/ptt-crm-api/src/kpi-groups/kpi-groups.repository.ts`
- Create: `services/ptt-crm-api/src/kpi-groups/kpi-groups.repository.spec.ts` (mock pg)

**Interfaces:**
- Produces:
  - `KpiGroupRow`, `KpiGroupListQuery`, `CreateKpiGroupBody`, `PatchKpiGroupBody`
  - `listGroups(tenantId, query): Promise<{ rows; total }>`
  - `insertGroup(...)` transaction ghi junction tables
  - `getGroupById(tenantId, id)`
  - `patchGroup(...)` + increment row_version
  - `softDeleteGroup(...)`
  - `nextDisplayOrder(tenantId)`

- [ ] Implement list with JOIN departments (names from `crm_departments`)
- [ ] Implement insert/update junction replace pattern (DELETE + INSERT in txn)
- [ ] Test duplicate code throws `KPI_GROUP_CODE_DUPLICATE`
- [ ] Commit

---

### Task 4: Service + business rules

**Files:**
- Create: `services/ptt-crm-api/src/kpi-groups/kpi-groups.service.ts`
- Create: `services/ptt-crm-api/src/kpi-groups/kpi-groups.service.spec.ts`

**Interfaces:**
- Consumes: repository, validation, audit (stub W1)
- Produces:
  - `createGroup(staff, body)`
  - `updateGroup(staff, id, body, rowVersion)`
  - `changeStatus(staff, id, status, reason?)` — W2
  - `duplicateGroup(staff, id, { code, name })` — W2
  - `deleteGroup(staff, id)` — check references W2

**Rules to implement:**
- BR-07: auto `display_order` if omitted
- BR-11: ORGANIZATION → clear department_ids requirement
- FR-03: block code change if `usage_count > 0`
- BR-09: block code edit on `is_system_default` unless system admin

- [ ] Jest tests for each rule
- [ ] Commit

---

### Task 5: Controller + guards + module wiring

**Files:**
- Create: `services/ptt-crm-api/src/kpi-groups/kpi-groups.controller.ts`
- Create: `services/ptt-crm-api/src/kpi-groups/guards/staff-kpi-groups.guard.ts`
- Create: `services/ptt-crm-api/src/kpi-groups/kpi-groups.module.ts`
- Modify: `services/ptt-crm-api/src/app.module.ts`
- Modify: `services/ptt-crm-api/src/staff-permissions/rbac-admin-catalog.json`

- [ ] Wire GET/POST/PATCH list+create+patch endpoints W1
- [ ] Map HTTP errors: 400 validation, 409 duplicate/version, 403 RBAC, 404
- [ ] Manual curl smoke with staff token
- [ ] Commit

---

### Task 6: Frontend API client + util

**Files:**
- Create: `services/ops-web/src/lib/kpi-groups-api.ts`
- Create: `services/ops-web/src/lib/kpi-groups-api.spec.ts`
- Create: `services/ops-web/src/lib/kpi-group-util.ts`
- Create: `services/ops-web/src/lib/kpi-group-form.util.ts`
- Create: `services/ops-web/src/lib/kpi-group-form.util.spec.ts`

**Interfaces:**
- Produces: `fetchKpiGroups`, `fetchKpiGroupSummary`, `createKpiGroup`, `patchKpiGroup`, `changeKpiGroupStatus`, `duplicateKpiGroup`, `deleteKpiGroup`, `reorderKpiGroups`
- Labels: `labelKpiGroupStatus`, `labelKpiGroupDirection`, `kpiGroupStatusBadgeClass`

- [ ] Mirror patterns from `b2b-projects-api.ts`
- [ ] Vitest parse + form validation
- [ ] Commit

---

### Task 7: CSS design system `.kpi-group-*`

**Files:**
- Modify: `services/ops-web/src/app/globals.css`

- [ ] Summary cards grid (4 cột)
- [ ] Filter bar, table, status badges (green/yellow/gray)
- [ ] Form 2-column layout (70/30), sticky footer
- [ ] Scope segmented control, data domain chips, preview bar
- [ ] Sidebar tips panel
- [ ] Responsive min 1280px desktop; stack form sidebar <1024px

- [ ] Commit

---

### Task 8: Trang danh sách Nhóm KPI

**Files:**
- Create: `services/ops-web/src/app/crm/kpi/groups/page.tsx`
- Create: `services/ops-web/src/components/kpi-groups/KpiGroupSummaryCards.tsx`
- Create: `services/ops-web/src/components/kpi-groups/KpiGroupFilterBar.tsx`
- Create: `services/ops-web/src/components/kpi-groups/KpiGroupTable.tsx`
- Create: `services/ops-web/src/components/kpi-groups/KpiGroupStatusBadge.tsx`
- Modify: `services/ops-web/src/components/OpsNav.tsx`
- Modify: `services/ops-web/src/lib/rbac-routes.ts`

- [ ] Auth: `crm_kpi_groups.view`
- [ ] Empty state SRS §8.3
- [ ] Loading / error states
- [ ] Row actions navigate to edit or open confirm dialogs (stub W2)
- [ ] Commit

---

### Task 9: Form tạo / sửa Nhóm KPI

**Files:**
- Create: `services/ops-web/src/app/crm/kpi/groups/new/page.tsx`
- Create: `services/ops-web/src/app/crm/kpi/groups/[id]/page.tsx`
- Create: `services/ops-web/src/components/kpi-groups/KpiGroupForm.tsx`
- Create: `services/ops-web/src/components/kpi-groups/KpiGroupFormSidebar.tsx`
- Create: `services/ops-web/src/components/kpi-groups/KpiGroupScopePicker.tsx`

- [ ] Load departments: `fetchStaffDepartments(token)` from `api.ts`
- [ ] Load positions: `GET /api/v1/staff/org/positions`
- [ ] Position options filter when dept changes (mockup 2)
- [ ] Live sidebar summary + checklist (code valid, name unique debounce API HEAD optional W2)
- [ ] **Lưu nháp** → status DRAFT; **Lưu & Kích hoạt** → ACTIVE
- [ ] Edit mode: load group, show row_version in state, send If-Match
- [ ] Commit

---

### Task 10 (W2): Lifecycle — status, duplicate, delete

**Files:**
- Modify: controller/service/repository (endpoints §10.5–10.8)
- Create: `services/ops-web/src/components/kpi-groups/KpiGroupConfirmDialogs.tsx`

- [ ] POST status with confirm modal + impact counts
- [ ] Duplicate → redirect `/crm/kpi/groups/{newId}` status DRAFT
- [ ] DELETE: check `usage_count`; message SRS FR-06
- [ ] Wire table ⋮ menu actions
- [ ] Jest + manual UAT AC-05, AC-06, AC-07
- [ ] Commit

---

### Task 11 (W2): Audit log

**Files:**
- Create: `services/ptt-crm-api/src/kpi-groups/kpi-group-audit.repository.ts`
- Modify: service — log CREATE/UPDATE/ACTIVATE/INACTIVATE/DELETE/REORDER
- Create: `services/ops-web/src/components/kpi-groups/KpiGroupAuditPanel.tsx`

- [ ] GET audit paginated on detail page tab "Lịch sử"
- [ ] AC-08 verification
- [ ] Commit

---

### Task 12 (W2): Metric integration (`group_id`)

**Files:**
- Create: `docs/specs/2026-09-03-postgresql-ddl-kpi-groups-w2-metrics.sql`
- Modify: `kpi-pg.repository.ts`, `kpi.types.ts`, `KpiCreateMetricDrawer.tsx`

- [ ] Add nullable `group_id` FK on `crm_kpi_metrics`
- [ ] Metric create form: dropdown chỉ nhóm **ACTIVE** + scope filter (FR-09)
- [ ] `usage_count` accurate on list API
- [ ] AC-04, AC-05
- [ ] Commit

---

### Task 13 (W3): Display order drag-drop + bulk reorder API

**Files:**
- Modify: `KpiGroupTable.tsx` — drag handle column (mockup)
- Implement: `PUT /api/v1/kpi-groups/display-order`

- [ ] Optimistic UI + rollback on error
- [ ] AC-10
- [ ] Commit

---

### Task 14 (W3): Import CSV ("Nhập dữ liệu")

**Files:**
- Create: `services/ops-web/src/components/kpi-groups/KpiGroupImportModal.tsx`
- Create: `POST /api/v1/kpi-groups/import` (multipart or JSON rows)

- [ ] Template CSV: code,name,description,scope_type,...
- [ ] Row-level error report
- [ ] Commit

---

### Task 15: E2E + deploy + docs

**Files:**
- Create: `services/ops-web/e2e/kpi-groups.spec.ts`
- Create: `scripts/deploy_kpi_groups_vps.sh` (DDL + api jest + ops-web build)
- Create: `docs/huong-dan-su-dung/XX-kpi-nhom-kpi.md`

- [ ] Playwright: list load, create draft, activate, filter search
- [ ] Deploy script document in plan README
- [ ] User guide with screenshots
- [ ] Commit

---

## Kiểm thử

| Layer | Công cụ | Phạm vi |
|-------|---------|---------|
| Validation | Jest | code, color, scope, direction |
| Service | Jest | BR rules, duplicate, delete guard |
| Repository | Jest + test DB optional | SQL uniqueness |
| Frontend util | Vitest | form validation, labels |
| E2E | Playwright | happy path admin |
| Manual UAT | Checklist SRS §14 AC-01…AC-12 | QA sign-off |

**Commands:**

```bash
# API
cd services/ptt-crm-api && npx jest --testPathPattern='src/kpi-groups' --no-coverage

# Web unit
cd services/ops-web && npm run test:unit -- src/lib/kpi-group-form.util.spec.ts src/lib/kpi-groups-api.spec.ts src/lib/kpi-group-import.util.spec.ts

# E2E
cd services/ops-web && npm run test:e2e:kpi-groups

# Deploy VPS
APPLY=1 ./scripts/deploy_kpi_groups_vps.sh
```

**User guide:** `docs/huong-dan-su-dung/31-kpi-nhom-kpi.md`

---

## Deploy

```bash
# Local / VPS
bash scripts/apply_pg_ddl_kpi_groups.sh
APPLY=1 ./scripts/deploy_kpi_groups_vps.sh   # tạo script: DDL + jest kpi-groups + ops-web build + HUP
```

Sau deploy: cấp cap `crm_kpi_groups.*` cho role Tenant Admin; user **đăng xuất/đăng nhập lại**.

---

## Rủi ro & phụ thuộc

| Rủi ro | Giảm thiểu |
|--------|------------|
| Chưa có `crm_kpi_types` | Wave 2 dùng `crm_kpi_metrics.group_id` làm usage_count tạm |
| Tenant UUID vs text `PTT` | Giữ text đồng bộ IWR; migration UUID sau |
| `crm_departments.id` là uuid, `crm_positions.id` integer | Junction tables đúng kiểu; validate FK tồn tại |
| Trùng namespace `/api/crm/kpi` vs `/api/v1/kpi-groups` | Client mới `kpi-groups-api.ts`; không đụng cockpit W1 |
| Mockup có drag-order phức tạp | W1 dùng input số; W3 mới drag |

---

## Out of scope (từ chối nếu task lệch SRS)

- AI gợi ý nhóm KPI, sync Ads/GA4, formula builder, chấm điểm/thưởng phạt.
- Phân cấp parent_id nhiều cấp UI (DB có `parent_id` nullable — UI ẩn W1).
- OKR/BSC mapping.

---

## Self-review (spec coverage)

| SRS | Task |
|-----|------|
| FR-01 List | Task 8 |
| FR-02 Create | Task 9 |
| FR-03 Update | Task 9, 4 |
| FR-04 Detail | Task 9, 11 |
| FR-05 Status | Task 10 |
| FR-06 Delete | Task 10 |
| FR-07 Duplicate | Task 10 |
| FR-08 Reorder | Task 13 |
| FR-09 Scope runtime | Task 12 |
| FR-10 Validation | Task 2, 6 |
| FR-11 Audit | Task 11 |
| §5 Default catalog | Task 1 seed |
| §11 RBAC | Task 5 |
| §14 AC-01…12 | Tasks 8–15 |

**Placeholder scan:** Không còn TBD trong task code steps cốt lõi (Task 2 có test mẫu đầy đủ).

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-09-03-kpi-group-setup.md`.

**Hai hướng triển khai:**

1. **Subagent-Driven (recommended)** — một subagent/task, review giữa các task (skill: subagent-driven-development).
2. **Inline Execution** — làm tuần tự trong session với checkpoint sau W1/W2 (skill: executing-plans).

**Đề xuất bắt đầu:** Task 0 → Task 1 (DDL) → Task 2 (validation) trước khi làm UI.
