# Account Management OS — Wave 1 Implementation Plan

> **Superseded:** Dùng plan master [2026-09-05-account-management-os.md](./2026-09-05-account-management-os.md) (Wave 1 = Task 1–11). File này giữ để đối chiếu lịch sử.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `/crm/account-management` — AmShell + Dashboard UI-AM-01 (6 KPI, 4-band health, việc hôm nay + Nhận xử lý) + ⌘K + drawer Tạo khách / Tạo việc / Tạo plan; 6 route con placeholder không 404.

**Architecture:** Nest module mới `am` trong `ptt-crm-api` (Postgres `crm_am_*`, JWT staff). ops-web routes `/crm/account-management*` dùng `AmShell` riêng — **không** nhét vào KPI Hub, **không** `<main>` lồng trong sidebar. SoR khách = `agency_client` qua `createAgencyClient`; AM chỉ thêm `crm_am_account_ext`. SoR HĐ = `crm_contracts` (đọc). SoR ticket = CSD (đọc / link, không Resolve).

**Tech Stack:** NestJS `ptt-crm-api` · Next.js ops-web · PostgreSQL · staff JWT + `staff_section_permissions` · không package mới · AI **tắt** Wave 1.

**SoT:**
- SRS: [2026-09-05-account-management-srs.md](../specs/2026-09-05-account-management-srs.md) **v2.0**
- Mockup: [docs/design/rnosai-am-os-srs-mockup.html](../../design/rnosai-am-os-srs-mockup.html)
- UI: **6 KPI**, **nav nhóm**, **health 4 band**, CTA `+ Tạo mới ▾`, role / phạm vi / mật độ

## Global Constraints

- API prefix **`/api/crm/am`**. Cùng JWT staff với CRM.
- Tenant **`PTT` only**. Không portal khách. Không app thứ hai.
- Caps: `crm_am` `view` / `view_all` / `edit` / `assign` / `manage` + `crm_am.finance` `view`.
- Tạo khách = wrap `createAgencyClient` (code, name, industry_slug, owner_am_id). Cấm INSERT master khách mới.
- AM **không** xóa/sửa amount/terms `crm_contracts`. **Không** Resolve CSD từ AM. **Không** clone ticket.
- Media spend **không** vào MRR / ARR PTT.
- Empty / no_data → `—`, không `0` giả, không hard-code số mockup (48 / 1,28 tỷ).
- CSS class `am-*` + token Navy `#0F2747` Accent `#2563EB`. Không phá `kpi-hub-*` / `csd-*`.
- Copy UI tiếng Việt. Sidebar **không** badge đếm (mockup demo có badge — product Wave 1 **bỏ**).
- Staff id = INTEGER JWT `staffId`.
- Wave 1 **không** làm: 360 đầy đủ, handover/onboard, renewal kanban, risk/recovery, growth, reports, AI drawer, mobile M01.

---

## File map

| File | Responsibility |
|------|----------------|
| `docs/specs/2026-09-05-postgresql-ddl-am.sql` | Schema `crm_am_*` + settings 1 hàng PTT |
| `scripts/apply_pg_ddl_am.sh` | Apply DDL local / VPS |
| `services/ptt-crm-api/src/am/am.types.ts` | DTO dashboard, task, plan, search |
| `services/ptt-crm-api/src/am/am-scope.util.ts` | `view` vs `view_all` filter |
| `services/ptt-crm-api/src/am/am-health.util.ts` | 5 component + 4 band |
| `services/ptt-crm-api/src/am/guards/staff-am.guard.ts` | Caps `crm_am` |
| `services/ptt-crm-api/src/am/am-dashboard.service.ts` | GET command-center |
| `services/ptt-crm-api/src/am/am-accounts.service.ts` | Wrap createAgencyClient + ext |
| `services/ptt-crm-api/src/am/am-tasks.service.ts` | Create / accept / dismiss |
| `services/ptt-crm-api/src/am/am-plans.service.ts` | Create plan + seed tasks |
| `services/ptt-crm-api/src/am/am-search.service.ts` | ⌘K |
| `services/ptt-crm-api/src/am/am.controller.ts` | HTTP `/api/crm/am` |
| `services/ptt-crm-api/src/am/am.module.ts` | Providers |
| `services/ptt-crm-api/src/staff-permissions/rbac-admin-catalog.json` | Sections `crm_am`, `crm_am.finance` |
| `services/ops-web/src/lib/rbac-routes.ts` | Prefix `/crm/account-management` |
| `services/ops-web/src/components/OpsNav.tsx` | Link Account Management |
| `services/ops-web/src/lib/crm/am-api.ts` | Fetch wrappers |
| `services/ops-web/src/components/crm/am/AmShell.tsx` | Sidebar nhóm + header |
| `services/ops-web/src/app/crm/account-management/**` | Pages |

---

## Slice order

**AM-0 DDL/caps → AM-1 Shell + 403 + placeholders → AM-2 Dashboard đọc → AM-3 Nhận việc + Tạo việc → AM-4 Tạo khách + Tạo plan → AM-5 Palette ⌘K → AM-6 UAT + deploy.**

Không ship 360 / renewal / AI trước khi Dashboard + Nhận xử lý pass.

---

### Task 1: DDL `crm_am_*`

**Files:**
- Create: `docs/specs/2026-09-05-postgresql-ddl-am.sql`
- Create: `scripts/apply_pg_ddl_am.sh`
- Test: `psql` verify (no Jest)

**Interfaces:**
- Consumes: SRS §11.1
- Produces: tables `crm_am_account_ext`, `crm_am_plans`, `crm_am_tasks`, `crm_am_health_snapshots`, `crm_am_settings`, `crm_am_audit`

- [ ] **Step 1: Write DDL**

Bảng tối thiểu Wave 1 (tenant `PTT`):

```sql
CREATE TABLE IF NOT EXISTS crm_am_account_ext (
  agency_client_id UUID PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  account_owner_staff_id INTEGER,
  backup_staff_id INTEGER,
  tier TEXT,
  am_status TEXT NOT NULL DEFAULT 'active',
  churned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_am_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  agency_client_id UUID NOT NULL,
  contract_id UUID,
  kind TEXT NOT NULL, -- care | qbr | renewal | expand
  period_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  owner_staff_id INTEGER NOT NULL,
  due_on DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS crm_am_tasks_source_ref_uq
  ON crm_am_tasks (tenant_id, source, source_ref)
  WHERE source_ref IS NOT NULL AND dismissed_at IS NULL AND status NOT IN ('cancelled','closed');

CREATE TABLE IF NOT EXISTS crm_am_health_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  agency_client_id UUID NOT NULL,
  as_of DATE NOT NULL,
  score NUMERIC(5,1) NOT NULL,
  band TEXT NOT NULL, -- healthy | watch | at_risk | critical
  components_json JSONB NOT NULL,
  UNIQUE (tenant_id, agency_client_id, as_of)
);

CREATE TABLE IF NOT EXISTS crm_am_settings (
  tenant_id TEXT PRIMARY KEY DEFAULT 'PTT',
  weights_json JSONB NOT NULL DEFAULT '{"kpi_delivery":30,"engagement":20,"financial":20,"satisfaction":15,"contract_support":15}',
  bands_json JSONB NOT NULL DEFAULT '{"healthy":[80,100],"watch":[60,79],"at_risk":[40,59],"critical":[0,39]}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO crm_am_settings (tenant_id) VALUES ('PTT') ON CONFLICT DO NOTHING;

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

- [ ] **Step 2: Apply local**

```bash
chmod +x scripts/apply_pg_ddl_am.sh
./scripts/apply_pg_ddl_am.sh
```

Expected: `\dt crm_am_*` lists 6 tables.

- [ ] **Step 3: Commit**

```bash
git add docs/specs/2026-09-05-postgresql-ddl-am.sql scripts/apply_pg_ddl_am.sh
git commit -m "$(cat <<'EOF'
feat(am): add Wave 1 PostgreSQL tables for Account Management OS

EOF
)"
```

---

### Task 2: Caps + route guard

**Files:**
- Modify: `services/ptt-crm-api/src/staff-permissions/rbac-admin-catalog.json`
- Modify: `services/ptt-crm-api/src/staff-job-functions` catalog nếu AM được gán theo function
- Modify: `services/ops-web/src/lib/rbac-routes.ts`
- Modify: `services/ops-web/src/lib/rbac-routes.spec.ts` (nếu có)
- Test: catalog load + route prefix

**Interfaces:**
- Produces: `hasCap(user, 'crm_am', 'view')` hợp lệ; `/crm/account-management` yêu cầu `crm_am.view` hoặc `view_all`

- [ ] **Step 1: Add catalog sections**

Trong `section_actions`:

```json
"crm_am": ["view", "view_all", "edit", "assign", "manage"],
"crm_am.finance": ["view"]
```

Trong `sections`:

```json
{
  "id": "crm_am",
  "label": "Account Management",
  "group": "CRM",
  "page": "/crm/account-management",
  "description": "AM post-contract: retain / renew / expand / health."
}
```

- [ ] **Step 2: RBAC prefix trước rule `/crm` generic**

```ts
{
  prefix: '/crm/account-management',
  anyOf: [
    { section: 'crm_am', action: 'view' },
    { section: 'crm_am', action: 'view_all' },
  ],
},
```

- [ ] **Step 3: Test prefix không lọt user chỉ có `crm_agency.view`**

User agency-only → 403 khi mở `/crm/account-management`.

- [ ] **Step 4: Grant thủ công 1 user UAT** (AM + Director) qua Admin RBAC trước demo.

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(am): register crm_am caps and route guard

EOF
)"
```

---

### Task 3: Nest module + health/scope utils

**Files:**
- Create: `services/ptt-crm-api/src/am/am.types.ts`
- Create: `services/ptt-crm-api/src/am/am-health.util.ts`
- Create: `services/ptt-crm-api/src/am/am-health.util.spec.ts`
- Create: `services/ptt-crm-api/src/am/am-scope.util.ts`
- Create: `services/ptt-crm-api/src/am/am-scope.util.spec.ts`
- Create: `services/ptt-crm-api/src/am/guards/staff-am.guard.ts`
- Create: `services/ptt-crm-api/src/am/am.module.ts`
- Modify: `services/ptt-crm-api/src/app.module.ts`

**Interfaces:**
- Produces:

```ts
export type AmHealthBand = 'healthy' | 'watch' | 'at_risk' | 'critical';

export function bandFromScore(score: number): AmHealthBand {
  if (score >= 80) return 'healthy';
  if (score >= 60) return 'watch';
  if (score >= 40) return 'at_risk';
  return 'critical';
}

export function weightedScore(components: {
  kpi_delivery: number;
  engagement: number;
  financial: number;
  satisfaction: number;
  contract_support: number;
}): number {
  return (
    components.kpi_delivery * 0.3 +
    components.engagement * 0.2 +
    components.financial * 0.2 +
    components.satisfaction * 0.15 +
    components.contract_support * 0.15
  );
}

export function amOwnerFilter(opts: {
  staffId: number;
  viewAll: boolean;
}): { sql: string; params: unknown[] } {
  if (opts.viewAll) return { sql: 'TRUE', params: [] };
  return { sql: 'e.account_owner_staff_id = $staff', params: [opts.staffId] };
}
```

- [ ] **Step 1: Failing tests** — `bandFromScore(72) === 'watch'`; `72` không phải 5-band cũ; `view` không thấy account owner khác.

- [ ] **Step 2: Implement + pass**

- [ ] **Step 3: Register `AmModule` in `app.module.ts`**

- [ ] **Step 4: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(am): add Nest AmModule with 4-band health and scope filter

EOF
)"
```

---

### Task 4: Dashboard API

**Files:**
- Create: `services/ptt-crm-api/src/am/am-dashboard.service.ts`
- Create: `services/ptt-crm-api/src/am/am-dashboard.service.spec.ts`
- Create: `services/ptt-crm-api/src/am/am.controller.ts`

**Interfaces:**
- Consumes: `crm_am_account_ext` + `agency_client` + `crm_contracts.ends_on` + latest health snapshot + `crm_am_tasks` + CSD SLA count (read)
- Produces: `GET /api/crm/am/command-center?from&to`

```ts
export type AmCommandCenter = {
  period: { from: string; to: string };
  freshness: { as_of: string; stale: boolean };
  kpis: {
    active_accounts: number | null;
    mrr_vnd: number | null;
    renewal_90d_vnd: number | null;
    renewal_90d_count: number | null;
    revenue_at_risk_vnd: number | null;
    revenue_at_risk_count: number | null;
    sla_overdue: number | null;
    csat: number | null;
    deltas?: Partial<Record<string, number>>;
  };
  today_work: Array<{
    id: string;
    due_at: string | null;
    title: string;
    account_name: string;
    sla_label: string | null;
    can_accept: boolean;
  }>;
  attention: Array<{
    agency_client_id: string;
    name: string;
    band: AmHealthBand;
    score: number | null;
    mrr_vnd: number | null;
    days_to_end: number | null;
  }>;
  forecast: { committed_vnd: number | null; likely_vnd: number | null; risk_vnd: number | null; unlikely_vnd: number | null };
  health_dist: { healthy: number; watch: number; at_risk: number; critical: number; avg: number | null };
  my_book: Array<{
    agency_client_id: string;
    name: string;
    owner_label: string;
    package_label: string;
    score: number | null;
    band: AmHealthBand | null;
    mrr_vnd: number | null;
    ends_on: string | null;
    next_action: string | null;
  }>;
};
```

**Quy tắc:**
- `active_accounts` = `agency_client` + ext `am_status=active`, không Churned.
- `revenue_at_risk` = Σ recurring value của account band `at_risk` ∪ `critical`.
- `renewal_90d` = HĐ Active `ends_on` trong 90 ngày.
- Thiếu số → `null` (UI vẽ `—`).
- Scope `view` = owner = current staff; `view_all` = team/all theo query sau (W1: all tenant nếu view_all).

- [ ] **Step 1: Service spec** — fixture 2 account (Watch + Critical) → at-risk count 1; empty book → kpi null không 0.

- [ ] **Step 2: Controller** `@UseGuards(StaffAmGuard)` `@RequireAmAction('view')`

- [ ] **Step 3: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(am): add command-center API with 6 KPIs and 4-band health

EOF
)"
```

---

### Task 5: AmShell + Dashboard UI

**Files:**
- Create: `services/ops-web/src/lib/crm/am-api.ts`
- Create: `services/ops-web/src/lib/crm/am-nav.util.ts`
- Create: `services/ops-web/src/components/crm/am/AmShell.tsx`
- Create: `services/ops-web/src/components/crm/am/AmDashboard.tsx`
- Create: `services/ops-web/src/app/crm/account-management/page.tsx`
- Create: `services/ops-web/src/app/crm/account-management/clients/page.tsx`
- Create: `services/ops-web/src/app/crm/account-management/onboarding/page.tsx`
- Create: `services/ops-web/src/app/crm/account-management/work/page.tsx`
- Create: `services/ops-web/src/app/crm/account-management/renewals/page.tsx`
- Create: `services/ops-web/src/app/crm/account-management/reports/page.tsx`
- Create: `services/ops-web/src/app/crm/account-management/health/page.tsx`
- Create: `services/ops-web/src/app/crm/account-management/settings/page.tsx`
- Create: `services/ops-web/src/app/crm/account-management/am.css`
- Test: `services/ops-web/src/lib/crm/am-nav.util.spec.ts` + e2e layout nếu repo đã có pattern `kpi-hub-*-layout.spec.ts`

**Interfaces:**
- Nav nhóm (copy mockup): TỔNG QUAN Dashboard · KHÁCH HÀNG Danh sách / Onboarding · CÔNG VIỆC Work Queue · HỢP ĐỒNG Gia hạn · PHÂN TÍCH Báo cáo / Health & Risk · CẤU HÌNH
- Placeholder pages: title đúng + dòng “Wave 2/3/4 — chưa mở”
- **Cấm** `<main>` thứ hai trong shell (bug KPI Hub cream-gap).

Copy KPI labels **đúng mockup**: Khách hàng active · MRR hiện tại · Gia hạn 90 ngày · Revenue at risk · SLA quá hạn · CSAT.

- [ ] **Step 1: Nav spec** — 8 mục, thứ tự nhóm, không badge số.

- [ ] **Step 2: Dashboard render `—` khi null; click KPI đi list/work/health (placeholder OK).**

- [ ] **Step 3: OpsNav** thêm `{ href: '/crm/account-management', label: 'Account Management' }` khi `hasCap(..., 'crm_am', 'view')` — nhóm Vận hành CSKH / sau Agency, **không** trong KPI Hub.

- [ ] **Step 4: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(am): add AmShell and Wave 1 dashboard matching UI-AM-01

EOF
)"
```

---

### Task 6: Nhận xử lý + Tạo việc

**Files:**
- Create: `services/ptt-crm-api/src/am/am-tasks.service.ts`
- Create: `services/ptt-crm-api/src/am/am-tasks.service.spec.ts`
- Modify: `am.controller.ts`
- Modify: `AmDashboard.tsx` + drawer create work

**Interfaces:**
- `POST /api/crm/am/tasks` body `{ agency_client_id, title, kind, priority, due_at }` — cần `edit`
- `POST /api/crm/am/tasks/:id/accept` — gán `assignee_staff_id = current`, status `in_progress`, audit
- `POST /api/crm/am/tasks/dismiss` body `{ source, source_ref }` — không tạo trùng `source_ref`

- [ ] **Step 1: Test accept** gán current user + audit row.

- [ ] **Step 2: Test unique `source_ref`** — accept lần 2 cùng ref không nhân bản.

- [ ] **Step 3: UI** nút **Nhận xử lý** trên hàng việc hôm nay → toast thành công → row cập nhật.

- [ ] **Step 4: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(am): claim today work items and create AM tasks

EOF
)"
```

---

### Task 7: Tạo khách + Tạo plan

**Files:**
- Create: `services/ptt-crm-api/src/am/am-accounts.service.ts`
- Create: `services/ptt-crm-api/src/am/am-accounts.service.spec.ts`
- Create: `services/ptt-crm-api/src/am/am-plans.service.ts`
- Create: `services/ptt-crm-api/src/am/am-plans.service.spec.ts`
- UI drawers trong `AmShell`

**Interfaces:**
- `POST /api/crm/am/accounts`  
  - `mode: 'create'` → gọi cùng service agency `createAgencyClient` rồi upsert ext  
  - `mode: 'attach'` → chỉ upsert ext cho `agency_client_id` đã có  
  - thiếu `crm_agency` write + `mode=create` → 403 `{ error: 'agency_write_required', fallback: '/agency/clients/new' }`
- `POST /api/crm/am/plans` `{ agency_client_id, kind, period_key, contract_id? }`  
  - `kind=renewal` bắt buộc `contract_id`  
  - trùng `(client, kind, period_key)` → 409  
  - seed 1–3 task mặc định theo kind

- [ ] **Step 1: Test create không INSERT bảng khách thứ hai**

- [ ] **Step 2: Test attach không gọi createAgencyClient**

- [ ] **Step 3: Test renewal thiếu HĐ → 400**

- [ ] **Step 4: UI `+ Tạo mới ▾`** Khách / Việc / Renewal-plan (Cơ hội + Log họp = Wave 3/4 disable + tooltip)

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(am): wrap agency client create and seed AM plans

EOF
)"
```

---

### Task 8: Command palette ⌘K

**Files:**
- Create: `services/ptt-crm-api/src/am/am-search.service.ts`
- Create: `services/ptt-crm-api/src/am/am-search.service.spec.ts`
- Create: `services/ops-web/src/components/crm/am/AmPalette.tsx`

**Interfaces:**
- `GET /api/crm/am/search?q=` — min 2 ký tự, debounce client 300ms
- Groups: Account / Contract / Task (Contact Wave 2)
- Kết quả tuân `am-scope.util` — không trả account ngoài quyền
- P95 không cần chứng minh Wave 1; test scope + empty “Không tìm thấy”

- [ ] **Step 1: Test q=1 char → 400 / empty**

- [ ] **Step 2: Test user view không thấy account owner khác**

- [ ] **Step 3: UI** focus ⌘K / Ctrl+K, Esc đóng, Enter mở record (account → placeholder 360 Wave 2 `/clients/[id]` tối thiểu)

- [ ] **Step 4: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(am): add scoped command palette search

EOF
)"
```

---

### Task 9: Health snapshot job tối thiểu

**Files:**
- Create: `services/ptt-crm-api/src/am/am-health.service.ts`
- Create: `services/ptt-crm-api/src/am/am-health.service.spec.ts`

**Interfaces:**
- Wave 1: công thức **đơn giản có test** — components có thể stub 50 nếu thiếu KPI/CSD; vẫn ra 4 band.
- `POST /api/crm/am/health/recompute` — `manage` only.
- Job nightly optional: skip nếu chưa có cron pattern; nút recompute đủ UAT.

- [ ] **Step 1: Test weights 30/20/20/15/15 + band 72 = watch**

- [ ] **Step 2: Dashboard donut đọc snapshot mới nhất, Churned loại khỏi dist**

- [ ] **Step 3: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(am): compute 4-band health snapshots for dashboard

EOF
)"
```

---

### Task 10: UAT + VPS

**Files:**
- Create: `scripts/deploy_am_w1_vps.sh` (hoặc tái dùng deploy script hiện có + bước DDL)
- Modify: grant RBAC trên prod cho 1 AM + 1 Director

**UAT checklist (khớp mockup, số thật):**
1. User không cap → 403
2. User có `view` thấy menu + Dashboard; KPI `—` hoặc số thật, không 48/1,28 tỷ hard-code
3. 6 thẻ + việc hôm nay + attention + forecast + health 4 band + sổ của tôi
4. Nhận xử lý gán đúng user, F5 vẫn đúng
5. Tạo khách → xuất hiện `agency_client` + ext; mở được `/agency/clients/{id}`
6. Tạo plan renewal thiếu HĐ bị chặn
7. ⌘K không lộ khách ngoài scope
8. 7 route con không 404
9. Không có `<main>` kép, sidebar không đè content (hồi quy KPI Hub)

- [ ] **Step 1: Local UAT**

- [ ] **Step 2: Apply DDL trên VPS + rebuild ops-web + ptt-crm-api**

- [ ] **Step 3: Grant cap + smoke `https://rs.pttads.vn/crm/account-management`**

---

## Ngoài Wave 1 (không làm trong plan này)

| Wave | Mockup | Điều kiện vào |
|---|---|---|
| **2** | List + 360 + Handover/Onboard + Renewal pipeline/case + saved view + scorecard settings | W1 UAT xanh |
| **3** | Work Queue đầy đủ + Timeline + Risk + Recovery + Escalate + CSD link | W2 |
| **4** | Growth + Reports GRR/NRR + Finance snapshot + Feedback + industry fields | W3 |
| **5** | AI draft-only + mobile M01 + portal + bubble | PO bật AI; không mặc định |

---

## Spec coverage (self-review)

| FR Wave 1 | Task |
|---|---|
| FR-AM-001 403 | T2 |
| FR-AM-002 / 003 / 033 dashboard | T4–T5 (6 KPI theo mockup, không 4 thẻ cũ) |
| FR-AM-004 / 034 palette | T8 |
| FR-AM-005 / 031 tạo khách | T7 |
| FR-AM-006 / 032 plan | T7 |
| FR-AM-007 health job | T9 |
| FR-AM-008 watchlist | T4 |
| FR-AM-016 OpsNav | T5 |
| FR-AM-018 placeholders | T5 |
| FR-AM-030 collapse | T5 |
| FR-AM-035 / 017 nhận việc | T6 — nav nhóm (v1.3), **không** 7 mục phẳng SRS cũ |
| FR-AM-036 CTA | T5 + T7 |

Lệch cố ý vs SRS §8.0 (7 mục phẳng): **mockup v1.3 thắng**.
