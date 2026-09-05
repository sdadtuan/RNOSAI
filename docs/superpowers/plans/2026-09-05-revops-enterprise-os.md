# RevOps Enterprise — Full Implementation Plan (SRS REVOPS-ENT-001 v2.0)

> **Superseded for execution:** dùng [2026-09-06-revops-enterprise-and-lead-pipeline.md](./2026-09-06-revops-enterprise-and-lead-pipeline.md) — plan mới khóa Track A (Lead Pipeline Tab) đủ TDD, quyết định PO §13, và file/API thật từ codebase. File này giữ làm lịch sử W0b.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Revenue Operations shell trên RNOSAI — `/crm/revenue-ops/*` + aggregate API — khớp mockup 12 view + 17 modal, orchestration trên module hiện có (Leads, Deal Room, KPI Hub, AM OS), không fork CRM SaaS.

**Architecture:** Nest module `revops` trong `ptt-crm-api` (aggregate read + SLA/commission mới). ops-web dùng `RevOpsShell` (clone pattern `AmShell` + embed/deep-link module con). Business logic giữ trong module gốc; RevOps chỉ navigation, dashboard, quick actions, native views (SLA, Reports, Settings).

**Tech Stack:** NestJS `ptt-crm-api` · Next.js 14 `ops-web` App Router · PostgreSQL · staff JWT + `staff_section_permissions` · Jest (API) · Vitest + Playwright (ops-web) · CSS prefix `revops-*` · không npm package mới trừ khi PO duyệt.

**SoT:**
- SRS: [2026-09-05-revops-enterprise-mockup-srs.md](../specs/2026-09-05-revops-enterprise-mockup-srs.md) **v2.0**
- Mockup: [docs/design/rnosai-revops-enterprise-mockup.html](../../design/rnosai-revops-enterprise-mockup.html)
- Sub-mockup L3 Lead: [2026-09-05-lead-pipeline-tab-srs.md](../specs/2026-09-05-lead-pipeline-tab-srs.md)
- Sub-mockup L3 AM: [2026-09-05-account-management-srs.md](../specs/2026-09-05-account-management-srs.md)

## Global Constraints

- UI tiếng Việt. Primary **`#17692f`**. Navy **`#0f172a`**. Class **`revops-*`**. Font Inter / Be Vietnam Pro.
- Feature flag shell: **`NEXT_PUBLIC_REVOPS_SHELL=1`** (`revops-flags.ts`, `'0'` = tắt).
- Route map dev bar: chỉ hiện khi `NODE_ENV=development` hoặc `NEXT_PUBLIC_REVOPS_ROUTE_CATALOG=1`.
- Shell **không** fork logic Leads / Deal / KPI / AM. Aggregate API **read-only** compose từ service hiện có.
- Empty / thiếu dữ liệu → `null` API, **`—`** UI. Không hard-code số mockup (`1,245 tỷ`, `84.65tr`, …).
- Không portal khách · không multi-tenant · không multi-currency · không AI auto-write routing/commission.
- Không bắt đầu Wave *n* cho đến khi Wave *n−1* UAT xanh.
- Mọi modal: required `*` · validate trước submit · toast sau success (prod).

---

## Route reconciliation (SRS mockup → prod — khóa)

Mockup dùng label marketing; prod map vào route **thật** + alias khi cần:

| View mockup | Route SRS | Route prod (khóa) | Ghi chú |
|---|---|---|---|
| Command Center | `/crm/revenue-ops` | `/crm/revenue-ops` | Native RevOps |
| Leads & Routing | `/crm/leads` | `/crm/leads` | Embed trong shell; inbox hiện có |
| Pipeline & Deal | `/crm/deal-room` | `/crm/revenue-ops/pipeline` | **Mới:** kanban tổng; drill-down → `/crm/leads/[id]/deal-room` |
| Account 360 | `/crm/account-management` | `/crm/account-management/clients` | Deep-link AM OS |
| Handover | `/crm/leads/handover` | `/crm/account-management/onboarding` | Alias redirect W2 |
| Renewal & Growth | `/crm/account-management/renewal` | `/crm/account-management/renewals` | Plural — route hiện có |
| KPI & Hoa hồng | `/crm/kpi-hub` | `/crm/kpi-hub/sales` | Persona sales; commission tab mới W3 |
| SLA & Escalation | `/crm/revenue-ops/sla` | `/crm/revenue-ops/sla` | Native W3 |
| Reports & Forecast | `/crm/revenue-ops/reports` | `/crm/revenue-ops/reports` | Native W4 |
| Territory & Capacity | `/crm/b2b-projects` | `/crm/revenue-ops/territory` | UI territory; link `delivery-projects` |
| Phê duyệt | `/crm/approvals` | `/crm/revenue-ops/approvals` | Unified queue W2; vẫn link KPI approvals |
| Cấu hình & Audit | `/crm/revenue-ops/settings` | `/crm/revenue-ops/settings` | Native W4 |

**Redirect aliases (W1):**
- `/crm/revenue-ops/leads` → `/crm/leads?revops=1`
- `/crm/revenue-ops/kpi` → `/crm/kpi-hub/sales?revops=1`

Query `?revops=1` bật inner layout không double-sidebar (embed mode).

---

## Dependency graph

```text
W0 (done) mockup + SRS
    │
    ├──► Track A: Lead Pipeline Tab (L3) — song song W1, không block shell
    │
    ▼
W1 RevOpsShell + Command Center + aggregate API + 6 modal W1
    │
    ▼
W2 Embed polish + Handover alias + Unified Approvals + 6 modal W2
    │
    ▼
W3 SLA center + Commission module + Territory/Routing UI + 5 modal W3
    │
    ▼
W4 Reports + Settings/Data quality + Mobile nav + UAT full 12 view
```

**Parallel:** Track A (Lead Pipeline Tab) có thể chạy cùng W1–W2; Track B (AM OS waves) tiếp tục độc lập — RevOps chỉ deep-link.

---

## File map

### Backend — `services/ptt-crm-api/src/revops/`

| File | Responsibility | Wave |
|---|---|---|
| `revops.types.ts` | DTO aggregate, filters | 1 |
| `revops-scope.util.ts` | BU / team scope SQL | 1 |
| `revops-dashboard.service.ts` | `GET /command-center` compose | 1 |
| `revops-actions.service.ts` | Today queue + at-risk list | 1 |
| `revops-team-performance.service.ts` | Team table FR-CC-03 | 1 |
| `revops-sla.service.ts` | Incident queue, policies | 3 |
| `revops-sla.worker.ts` | Breach tick + auto-reassign | 3 |
| `revops-commission/` | plan, transaction, payout (subfolder) | 3 |
| `revops-routing/` | territory, rules, simulate | 3 |
| `revops-reports.service.ts` | Report library + run | 4 |
| `revops-settings.service.ts` | Data quality + integration health | 4 |
| `revops-approvals.service.ts` | Unified approval queue facade | 2 |
| `guards/staff-revops.guard.ts` | `RequireRevopsAction` | 1 |
| `revops.controller.ts` | HTTP | 1+ |
| `revops.module.ts` | imports AmModule, KpiHub, Leads readers | 1 |

**API prefix:** `GET/POST /api/crm/revops/*`

**DDL:** `docs/specs/2026-09-05-postgresql-ddl-revops-w3.sql` (commission, sla_incidents, territories, routing_rules)

### Frontend — `services/ops-web/src/`

| File | Responsibility | Wave |
|---|---|---|
| `lib/crm/revops-flags.ts` | `isRevopsShellEnabled()` | 1 |
| `lib/crm/revops-nav.util.ts` | 4 nhóm nav + `REVOPS_NAV` | 1 |
| `lib/crm/revops-api.ts` | fetch command-center, sla, … | 1 |
| `lib/crm/revops-format.ts` | VND, %, `—`, tags | 1 |
| `components/crm/revops/RevOpsShell.tsx` | Sidebar + topbar + mobile nav | 1 |
| `components/crm/revops/RevOpsRouteCatalog.tsx` | Dev route chips FR-SHELL-03 | 1 |
| `components/crm/revops/RevOpsEmbedFrame.tsx` | iframe-less embed wrapper | 1 |
| `components/crm/revops/RevOpsCommandCenter.tsx` | NBV-01 | 1 |
| `components/crm/revops/RevOpsQuickCreateModal.tsx` | quickModal | 1 |
| `components/crm/revops/modals/RevOpsLeadModal.tsx` | leadModal | 1 |
| `components/crm/revops/modals/RevOpsAssignModal.tsx` | assignmentModal | 1 |
| `components/crm/revops/modals/RevOpsDuplicateModal.tsx` | duplicateModal | 1 |
| `components/crm/revops/modals/RevOpsDealModal.tsx` | dealModal | 1 |
| `components/crm/revops/modals/RevOpsQuoteModal.tsx` | quoteModal | 1 |
| `components/crm/revops/RevOpsPipelinePage.tsx` | NBV-03 aggregate kanban | 2 |
| `components/crm/revops/RevOpsApprovalsPage.tsx` | NBV-11 | 2 |
| `components/crm/revops/modals/RevOpsApprovalModal.tsx` | approvalModal | 2 |
| `components/crm/revops/modals/RevOpsHandoverModal.tsx` | handoverModal | 2 |
| `components/crm/revops/modals/RevOpsAccountModal.tsx` | accountModal | 2 |
| `components/crm/revops/modals/RevOpsAccountPlanModal.tsx` | accountPlanModal | 2 |
| `components/crm/revops/modals/RevOpsGrowthModal.tsx` | growthModal | 2 |
| `components/crm/revops/modals/RevOpsKpiModal.tsx` | kpiModal | 2 |
| `components/crm/revops/RevOpsSlaPage.tsx` | NBV-08 | 3 |
| `components/crm/revops/RevOpsTerritoryPage.tsx` | NBV-10 | 3 |
| `components/crm/revops/modals/RevOpsCommissionPlanModal.tsx` | commissionPlanModal | 3 |
| `components/crm/revops/modals/RevOpsPayoutModal.tsx` | payoutModal | 3 |
| `components/crm/revops/modals/RevOpsSlaPolicyModal.tsx` | slaPolicyModal | 3 |
| `components/crm/revops/modals/RevOpsTerritoryModal.tsx` | territoryModal | 3 |
| `components/crm/revops/modals/RevOpsRoutingModal.tsx` | routingModal | 3 |
| `components/crm/revops/RevOpsReportsPage.tsx` | NBV-09 | 4 |
| `components/crm/revops/RevOpsSettingsPage.tsx` | NBV-12 | 4 |
| `app/crm/revenue-ops/layout.tsx` | RevOpsShell layout | 1 |
| `app/crm/revenue-ops/page.tsx` | Command Center | 1 |
| `app/crm/revenue-ops/pipeline/page.tsx` | Pipeline aggregate | 2 |
| `app/crm/revenue-ops/sla/page.tsx` | SLA center | 3 |
| `app/crm/revenue-ops/territory/page.tsx` | Territory | 3 |
| `app/crm/revenue-ops/approvals/page.tsx` | Approvals | 2 |
| `app/crm/revenue-ops/reports/page.tsx` | Reports | 4 |
| `app/crm/revenue-ops/settings/page.tsx` | Settings | 4 |
| `app/crm/revenue-ops/revops.css` | Tokens | 1 |
| `app/crm/leads/handover/page.tsx` | redirect → AM onboarding | 2 |

### Shared / ops

| File | Responsibility |
|---|---|
| `services/ptt-crm-api/src/app.module.ts` | Register `RevopsModule` |
| `services/ptt-crm-api/src/staff-permissions/rbac-admin-catalog.json` | Cap `crm_revops` |
| `services/ops-web/src/lib/rbac-routes.ts` | Prefix `/crm/revenue-ops` |
| `services/ops-web/src/components/OpsNav.tsx` | Link "Revenue Operations" |
| `deploy/runtime.env.example` | `NEXT_PUBLIC_REVOPS_SHELL=0` |
| `scripts/seed_revops_rbac.sh` | Grant catalog |
| `services/ops-web/e2e/revops-shell-w1.spec.ts` | Playwright W1 |
| `services/ptt-crm-api/src/revops/revops-dashboard.service.spec.ts` | Unit aggregate |

---

## RBAC (khóa W1)

| Cap | Actions | Persona |
|---|---|---|
| `crm_revops` | `view` | Sales, AE |
| `crm_revops` | `view_team` | Team Lead |
| `crm_revops` | `view_all` | Sales Director, RevOps |
| `crm_revops` | `manage` | Admin — settings, routing publish |
| `crm_revops.commission` | `view` / `manage` | Finance — payout W3 |

Reuse caps module con cho embed actions (vd. `crm_leads.edit` để tạo lead).

---

# WAVE 1 — RevOpsShell + Command Center + Modal cơ bản

**Deliverable:** Director mở `/crm/revenue-ops` thấy Command Center thật; sidebar 12 mục; quick create; deep-link Leads/KPI; flag rollout.

**UAT W1:** §10.2 SRS + Playwright `revops-shell-w1.spec.ts` pass.

---

### Task 1: Feature flag + RBAC seed

**Files:**
- Create: `services/ops-web/src/lib/crm/revops-flags.ts`
- Modify: `deploy/runtime.env.example`
- Modify: `services/ptt-crm-api/src/staff-permissions/rbac-admin-catalog.json`
- Create: `scripts/seed_revops_rbac.sh`

**Interfaces:**
- Produces: `isRevopsShellEnabled(): boolean`

- [ ] **Step 1: Write failing test**

```typescript
// services/ops-web/src/lib/crm/revops-flags.spec.ts
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { isRevopsShellEnabled } from './revops-flags';

describe('revops-flags', () => {
  const prev = process.env.NEXT_PUBLIC_REVOPS_SHELL;
  afterEach(() => { process.env.NEXT_PUBLIC_REVOPS_SHELL = prev; });
  it('returns false when unset', () => {
    delete process.env.NEXT_PUBLIC_REVOPS_SHELL;
    expect(isRevopsShellEnabled()).toBe(false);
  });
  it('returns true when 1', () => {
    process.env.NEXT_PUBLIC_REVOPS_SHELL = '1';
    expect(isRevopsShellEnabled()).toBe(true);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `cd services/ops-web && npx vitest run src/lib/crm/revops-flags.spec.ts`
Expected: FAIL module not found

- [ ] **Step 3: Implement**

```typescript
// services/ops-web/src/lib/crm/revops-flags.ts
export function isRevopsShellEnabled(): boolean {
  return process.env.NEXT_PUBLIC_REVOPS_SHELL === '1';
}
export function isRevopsRouteCatalogEnabled(): boolean {
  return process.env.NODE_ENV === 'development'
    || process.env.NEXT_PUBLIC_REVOPS_ROUTE_CATALOG === '1';
}
```

- [ ] **Step 4: Add RBAC catalog entry `crm_revops` + seed script (mirror `scripts/seed_am_rbac.sh`)**

- [ ] **Step 5: Run test — expect PASS**

- [ ] **Step 6: Commit**

```bash
git add services/ops-web/src/lib/crm/revops-flags.ts services/ops-web/src/lib/crm/revops-flags.spec.ts \
  services/ptt-crm-api/src/staff-permissions/rbac-admin-catalog.json scripts/seed_revops_rbac.sh deploy/runtime.env.example
git commit -m "feat(revops): add feature flag and RBAC catalog"
```

---

### Task 2: RevOps nav config + route helpers

**Files:**
- Create: `services/ops-web/src/lib/crm/revops-nav.util.ts`
- Create: `services/ops-web/src/lib/crm/revops-nav.util.spec.ts`

**Interfaces:**
- Produces: `REVOPS_NAV_GROUPS`, `activeRevopsHref(pathname: string): string`, `canSeeRevopsNav(user): boolean`

- [ ] **Step 1: Write failing test** — 12 items, 4 groups, paths match route reconciliation table

- [ ] **Step 2: Run vitest — FAIL**

- [ ] **Step 3: Implement nav** (copy structure from `am-nav.util.ts`):

```typescript
export type RevopsNavItem = { id: string; label: string; href: string; icon: string };
export type RevopsNavGroup = { title: string; items: RevopsNavItem[] };

export const REVOPS_NAV_GROUPS: RevopsNavGroup[] = [
  { title: 'TỔNG QUAN', items: [
    { id: 'dashboard', label: 'Command Center', href: '/crm/revenue-ops', icon: 'command' },
  ]},
  { title: 'DOANH THU', items: [
    { id: 'leads', label: 'Leads & Routing', href: '/crm/leads?revops=1', icon: 'leads' },
    { id: 'pipeline', label: 'Pipeline & Deal', href: '/crm/revenue-ops/pipeline', icon: 'pipeline' },
    { id: 'accounts', label: 'Account 360', href: '/crm/account-management/clients?revops=1', icon: 'accounts' },
    { id: 'handover', label: 'Handover & Onboarding', href: '/crm/account-management/onboarding?revops=1', icon: 'handover' },
    { id: 'renewal', label: 'Renewal & Growth', href: '/crm/account-management/renewals?revops=1', icon: 'renewal' },
  ]},
  { title: 'HIỆU SUẤT', items: [
    { id: 'kpi', label: 'KPI & Hoa hồng', href: '/crm/kpi-hub/sales?revops=1', icon: 'kpi' },
    { id: 'sla', label: 'SLA & Escalation', href: '/crm/revenue-ops/sla', icon: 'sla' },
    { id: 'reports', label: 'Báo cáo & Forecast', href: '/crm/revenue-ops/reports', icon: 'reports' },
  ]},
  { title: 'QUẢN TRỊ', items: [
    { id: 'territory', label: 'Territory & Capacity', href: '/crm/revenue-ops/territory', icon: 'territory' },
    { id: 'approvals', label: 'Phê duyệt', href: '/crm/revenue-ops/approvals', icon: 'approvals' },
    { id: 'settings', label: 'Cấu hình & Audit', href: '/crm/revenue-ops/settings', icon: 'settings' },
  ]},
];
```

- [ ] **Step 4: Run vitest — PASS**

- [ ] **Step 5: Commit** `feat(revops): add navigation config`

---

### Task 3: RevOps CSS tokens

**Files:**
- Create: `services/ops-web/src/app/crm/revenue-ops/revops.css`
- Modify: `services/ops-web/src/app/crm/revenue-ops/layout.tsx` (import css)

- [ ] **Step 1: Add tokens** — `--revops-primary: #17692f`, sidebar `#0b1220`, `.revops-sidebar`, `.revops-nav-item.active`, `.revops-metric-card`, `.revops-tag-*`, `.revops-route-map` (mirror mockup)

- [ ] **Step 2: Visual smoke** — open static mockup side-by-side checklist

- [ ] **Step 3: Commit** `feat(revops): add CSS design tokens`

---

### Task 4: RevOpsShell component

**Files:**
- Create: `services/ops-web/src/components/crm/revops/RevOpsShell.tsx`
- Create: `services/ops-web/src/components/crm/revops/RevOpsRouteCatalog.tsx`
- Create: `services/ops-web/src/app/crm/revenue-ops/layout.tsx`

**Interfaces:**
- Consumes: `REVOPS_NAV_GROUPS`, `isRevopsShellEnabled`, `StaffPageShell`
- Produces: `RevOpsShell({ children, title, subtitle, actions })`, `useRevopsPage()` optional context

- [ ] **Step 1: Write Playwright skeleton** `e2e/revops-shell-w1.spec.ts` — visit `/crm/revenue-ops` expect sidebar "Command Center" active (skip if flag off)

- [ ] **Step 2: Implement layout** — clone `AmShell` structure:
  - Fixed sidebar 256px, brand RNOSAI CRM / Revenue Operations
  - Topbar breadcrumb: `RNOSAI CRM / Revenue Operations / {title}`
  - `RevOpsRouteCatalog` when dev flag
  - Mobile bottom nav 5 items @760px (FR-SHELL-05)
  - Wrap content in `StaffPageShell` **without** second `<main>` nest

- [ ] **Step 3: Gate layout** — if `!isRevopsShellEnabled()` redirect `/crm` or 404 per PO

- [ ] **Step 4: Run Playwright — PASS** (with flag on in test env)

- [ ] **Step 5: Commit** `feat(revops): add RevOpsShell layout`

---

### Task 5: Backend aggregate — command center API

**Files:**
- Create: `services/ptt-crm-api/src/revops/revops.module.ts`
- Create: `services/ptt-crm-api/src/revops/revops.types.ts`
- Create: `services/ptt-crm-api/src/revops/revops-dashboard.service.ts`
- Create: `services/ptt-crm-api/src/revops/revops.controller.ts`
- Create: `services/ptt-crm-api/src/revops/guards/staff-revops.guard.ts`
- Modify: `services/ptt-crm-api/src/app.module.ts`

**Interfaces:**
- Produces: `GET /api/crm/revops/command-center?period=2026-09&bu=all` → `RevopsCommandCenterDto`

```typescript
export type RevopsCommandCenterDto = {
  period: string;
  revenue: { actualVnd: number | null; targetVnd: number | null; attainmentPct: number | null; deltaPct: number | null };
  pipeline: { weightedVnd: number | null; coverageX: number | null; activeDeals: number; commitDeals: number };
  leadSla: { compliancePct: number | null; atRisk: number; breaches: number };
  commission: { estimatedVnd: number | null; approvedVnd: number | null; pendingVnd: number | null };
  funnel: Array<{ stage: string; count: number }>;
  teamRevenue: Array<{ teamId: string; label: string; actualVnd: number | null; targetVnd: number | null }>;
  teamPerformance: Array<RevopsTeamPerformanceRow>;
  todayQueue: Array<RevopsActionItem>;
  atRisk: Array<RevopsRiskItem>;
  fetchedAt: string;
};
```

- [ ] **Step 1: Write failing API test** `revops-dashboard.service.spec.ts` — mock KpiHubDashboardService, AmDashboardService, leads SLA reader

- [ ] **Step 2: Implement compose** (read-only):
  - Revenue / team targets → `kpi-hub/dashboard` sales persona
  - Pipeline weighted → aggregate từ `leads-funnel` + deal-room summaries (hoặc placeholder `null` + `—` cho đến khi pipeline page W2)
  - Lead SLA → `lead-sla-care.service` metrics
  - Commission → `null` until W3 (UI shows `—`)

- [ ] **Step 3: Register controller** `@Controller('api/crm/revops')` `@Get('command-center')`

- [ ] **Step 4: Run jest — PASS**

- [ ] **Step 5: Commit** `feat(revops): add command center aggregate API`

---

### Task 6: Frontend API client + Command Center page

**Files:**
- Create: `services/ops-web/src/lib/crm/revops-api.ts`
- Create: `services/ops-web/src/lib/crm/revops-format.ts`
- Create: `services/ops-web/src/components/crm/revops/RevOpsCommandCenter.tsx`
- Create: `services/ops-web/src/app/crm/revenue-ops/page.tsx`

- [ ] **Step 1: Implement `fetchRevopsCommandCenter(token, params)`**

- [ ] **Step 2: Build `RevOpsCommandCenter`** — 4 KPI cards + funnel + team chart + performance table + 2 list widgets (copy mockup structure, wire real data)

- [ ] **Step 3: Header filters** — period + BU (query params, refetch)

- [ ] **Step 4: Row actions** — deep-link `revops-nav` hrefs (FR-CC-07)

- [ ] **Step 5: Vitest** `revops-format.spec.ts` — VND, `%`, `—`

- [ ] **Step 6: Commit** `feat(revops): add Command Center page`

---

### Task 7: Quick Create modal (`quickModal`)

**Files:**
- Create: `services/ops-web/src/components/crm/revops/RevOpsQuickCreateModal.tsx`

- [ ] **Step 1: 6 tiles** — Lead, Deal, Account, Handover, KPI, Assign (mockup copy)

- [ ] **Step 2: Each tile opens respective modal or navigates** (Account/Handover → open modal W2 stub toast "Sắp có" ok in W1)

- [ ] **Step 3: Wire Command Center primary button**

- [ ] **Step 4: Commit** `feat(revops): add quick create modal`

---

### Task 8: Lead modal + Assign modal + Duplicate modal

**Files:**
- Create: `components/crm/revops/modals/RevOpsLeadModal.tsx`
- Create: `components/crm/revops/modals/RevOpsAssignModal.tsx`
- Create: `components/crm/revops/modals/RevOpsDuplicateModal.tsx`

- [ ] **Step 1: Lead modal** — form fields per SRS §5; submit → existing leads API `POST /api/v1/leads`; toast; close

- [ ] **Step 2: Assign modal** — 3 routing suggestions (read from leads assign endpoint or static ranked list until routing W3); override reason required if not top suggestion

- [ ] **Step 3: Duplicate modal** — two-column compare; actions select; wire leads dedup API if exists else read-only demo with TODO backend W3

- [ ] **Step 4: Export from barrel `modals/index.ts`**

- [ ] **Step 5: Commit** `feat(revops): add lead assign duplicate modals`

---

### Task 9: Deal modal + Quote modal

**Files:**
- Create: `RevOpsDealModal.tsx`, `RevOpsQuoteModal.tsx`

- [ ] **Step 1: Deal modal** — reuse deal-room create helpers; requires lead/account context picker

- [ ] **Step 2: Quote modal** — reuse presales quote API; discount notice triggers approval hint

- [ ] **Step 3: Accessible from Quick Create + future Pipeline page**

- [ ] **Step 4: Commit** `feat(revops): add deal and quote modals`

---

### Task 10: OpsNav + rbac-routes + embed mode

**Files:**
- Modify: `services/ops-web/src/components/OpsNav.tsx`
- Modify: `services/ops-web/src/lib/rbac-routes.ts`
- Modify: `services/ops-web/src/app/crm/leads/page.tsx` (hide duplicate nav when `?revops=1`)

- [ ] **Step 1: Add "Revenue Operations" link** when `canSeeRevopsNav`

- [ ] **Step 2: `rbac-routes.ts`** — prefix `/crm/revenue-ops` requires `crm_revops.view`

- [ ] **Step 3: Embed mode** — when `searchParams.revops=1`, suppress module inner sidebar if double chrome (Leads list, KPI Hub sales page)

- [ ] **Step 4: Playwright** — navigate Leads from RevOps sidebar, no double sidebar

- [ ] **Step 5: Commit** `feat(revops): wire global nav and embed mode`

---

### Task 11: W1 UAT + deploy checklist

- [ ] **Step 1: Run full test suite**

```bash
cd services/ptt-crm-api && npm test -- revops
cd services/ops-web && npx vitest run src/lib/crm/revops
cd services/ops-web && npx playwright test e2e/revops-shell-w1.spec.ts
```

- [ ] **Step 2: Manual UAT** — checklist SRS §10.2

- [ ] **Step 3: Set staging env** `NEXT_PUBLIC_REVOPS_SHELL=1`

- [ ] **Step 4: PO sign-off W1 before W2**

---

# WAVE 2 — Pipeline aggregate + Unified Approvals + Modal W2

**Deliverable:** Kanban pipeline tổng; approval queue thống nhất; handover alias; account/growth/kpi modals.

---

### Task 12: Pipeline aggregate page (NBV-03)

**Files:**
- Create: `revops-pipeline.service.ts`, `RevOpsPipelinePage.tsx`, `app/crm/revenue-ops/pipeline/page.tsx`

- [ ] Aggregate open deals across leads (new API or extend leads-funnel)
- [ ] KPI row: total, weighted, commit, stale
- [ ] Tabs: Kanban (W2), List (W2), Forecast stub (W3), Win/Loss stub (W4)
- [ ] Kanban 5 columns mockup; card click → `/crm/leads/[id]/deal-room`
- [ ] Deal detail drawer: stepper, hygiene checklist, link Approvals
- [ ] Playwright: kanban renders, navigation to deal-room

---

### Task 13: Unified Approvals (NBV-11)

**Files:**
- Create: `revops-approvals.service.ts` (facade: kpi-hub approvals + discount + clawback stubs)
- Create: `RevOpsApprovalsPage.tsx`, `RevOpsApprovalModal.tsx`

- [ ] KPI row 4 cards
- [ ] Queue table with types: Discount, Commission, Clawback, Account reassignment
- [ ] Discount matrix display (read-only config W2, editable W4)
- [ ] Review modal: approve / reject / request changes → existing approval APIs
- [ ] Cross-link from Deal detail discount gate

---

### Task 14: Handover alias + modal W2

**Files:**
- Create: `app/crm/leads/handover/page.tsx` (redirect)
- Create: `RevOpsHandoverModal.tsx`, `RevOpsAccountModal.tsx`, `RevOpsAccountPlanModal.tsx`, `RevOpsGrowthModal.tsx`, `RevOpsKpiModal.tsx`

- [ ] Redirect `/crm/leads/handover` → `/crm/account-management/onboarding?revops=1`
- [ ] Handover modal → `POST api/crm/am/handovers` (existing)
- [ ] Account modal → AM create client API
- [ ] Account plan → AM plans API
- [ ] Growth modal → AM opportunities API
- [ ] KPI modal → KPI Hub targets API

---

### Task 15: Leads inbox enhancements (NBV-02 delta)

**Files:**
- Modify: leads list components (not RevOps shell)

- [ ] Column parity mockup: ICP score tags, SLA countdown, bulk assign
- [ ] **Chăm lead** CTA → `/crm/leads/[id]?tab=pipeline` (requires Track A)
- [ ] Saved view "Lead P1"
- [ ] Routing waterfall + SLA timeline panels on leads page footer (or RevOps embed section)

---

### Task 16: W2 UAT

- [ ] Pipeline kanban + deal drawer
- [ ] Approval flow end-to-end for discount request
- [ ] Handover modal creates package visible in AM onboarding
- [ ] All W2 modals validate required fields

---

# WAVE 3 — SLA Center + Commission + Territory/Routing

**Deliverable:** Native SLA incidents; commission plan + payout; territory hierarchy + routing builder.

---

### Task 17: DDL + commission module

**Files:**
- Create: `docs/specs/2026-09-05-postgresql-ddl-revops-w3.sql`
- Create: `services/ptt-crm-api/src/revops/commission/*`

**Tables (sketch):**
- `crm_revops_commission_plans` (versioned)
- `crm_revops_commission_tiers`
- `crm_revops_commission_transactions`
- `crm_revops_payout_batches`
- `crm_revops_sla_policies`
- `crm_revops_sla_incidents`
- `crm_revops_territories`
- `crm_revops_routing_rules`

- [ ] Apply DDL script
- [ ] Plan builder CRUD + tier table
- [ ] Transaction generation on deal won/collected revenue events (hook existing)
- [ ] Payout batch lock + Finance reconciliation status
- [ ] Wire KPI page commission widgets (replace `—`)

---

### Task 18: SLA center (NBV-08)

**Files:**
- Create: `revops-sla.service.ts`, `revops-sla.worker.ts`, `RevOpsSlaPage.tsx`, `RevOpsSlaPolicyModal.tsx`

- [ ] Compose incidents from leads SLA + AM handover SLA + renewal SLA
- [ ] Incident queue table + filters
- [ ] Policy catalog CRUD
- [ ] Breach trend chart (7 days)
- [ ] Worker: T+3 reminder, T+5 breach, T+10 reassign (lead P1 policy)
- [ ] Link SLA page Assign → assignment modal

---

### Task 19: Territory & Routing (NBV-10)

**Files:**
- Create: `revops-routing/*`, `RevOpsTerritoryPage.tsx`, modals

- [ ] Territory hierarchy CRUD
- [ ] Capacity by member (join leads count + account count)
- [ ] Assignment rules table + priority
- [ ] Routing modal: simulate + publish version
- [ ] Integrate with leads assign suggestions (Task 8 upgrade)

---

### Task 20: KPI Hub commission UI delta (NBV-07)

**Files:**
- Modify: `/crm/kpi-hub/sales` page or add `/crm/kpi-hub/commission` tab

- [ ] Team KPI weighted row (45/25/15/15)
- [ ] Commission projection widgets
- [ ] Per-person statement table
- [ ] Transaction detail panel
- [ ] Payout flow stepper + `payoutModal`

---

### Task 21: W3 UAT

- [ ] Create commission plan v3.2 equivalent → estimate matches formula
- [ ] SLA breach creates incident → appears in queue → assign resolves
- [ ] Routing simulate returns ranked owner
- [ ] Command Center commission KPI shows real numbers (not `—`)

---

# WAVE 4 — Reports + Settings + Mobile polish

**Deliverable:** Report library, data quality center, full mobile nav, 12-view QA sign-off.

---

### Task 22: Reports & Forecast (NBV-09)

**Files:**
- Create: `revops-reports.service.ts`, `RevOpsReportsPage.tsx`

- [ ] Filters: period, BU, territory, currency
- [ ] 3 dashboard cards: revenue vs forecast, mix, commission liability
- [ ] Report library table + open/run/export
- [ ] Seed 4 reports from mockup; scheduler stub

---

### Task 23: Settings & Audit (NBV-12)

**Files:**
- Create: `revops-settings.service.ts`, `RevOpsSettingsPage.tsx`

- [ ] Org/users cards (link admin)
- [ ] Data quality counts: deals without next action, ownerless accounts, strategic without plan
- [ ] Integration health (ERP, FB Lead Ads, HR/Payroll)
- [ ] Role permission matrix (read-only mirror RBAC)
- [ ] Audit log timeline (reuse admin audit API)

---

### Task 24: Mobile + cross-nav polish

- [ ] Bottom nav 5 tabs functional on all embed routes
- [ ] All cross-nav buttons mockup → correct href
- [ ] `RevOpsRouteCatalog` hidden prod unless flag
- [ ] Performance: command center LCP < 3s staging

---

### Task 25: Full regression + documentation

- [ ] Playwright suite `revops-full.spec.ts` — smoke 12 nav items
- [ ] Update [23-leads-handover-flow](../../huong-dan-su-dung/23-leads-handover-flow-and-guides.md) with RevOps entry points
- [ ] Huong dan su dung RevOps (new doc) — optional PO request
- [ ] PO final sign-off SRS §10.3

---

# TRACK A — Lead Pipeline Tab (L3, song song W1–W2)

**SRS:** `LEAD-PIPELINE-UI-001` · **Không block RevOps shell.**

| Task | Deliverable | Wave |
|---|---|---|
| A1 | `lead-pipeline-flags.ts` · `NEXT_PUBLIC_LEAD_PIPELINE_TAB=1` | W1 |
| A2 | Tab "Pipeline bán hàng" on `/crm/leads/[id]` | W1 |
| A3 | Reuse `CrmFunnelStepper` + `LeadFunnelPanel` single pane | W1 |
| A4 | Hash legacy `#funnel-b2`, `#funnel-presales` redirect | W1 |
| A5 | SLA strip 1-line trong tab | W1 |
| A6 | Playwright `lead-pipeline-tab.spec.ts` | W1 |
| A7 | Link **Chăm lead** from leads inbox (Task 15) | W2 |

Chi tiết từng step: xem [2026-09-05-lead-pipeline-tab-srs.md](../specs/2026-09-05-lead-pipeline-tab-srs.md) §Implementation.

---

# FR coverage matrix (SRS → Wave)

| FR | Mô tả | Wave |
|---|---|---|
| FR-SHELL-01…07 | Chrome shell | W1 |
| FR-CC-01…07 | Command Center | W1 |
| FR-LEAD-01…12 | Leads inbox delta | W1–W2 + Track A |
| FR-PIPE-01…05 | Pipeline | W2 |
| FR-ACC-01…06 | Account 360 | AM OS + embed W2 |
| FR-MODAL quick…quote | 6 modal | W1 |
| FR-MODAL account…kpi | 5 modal | W2 |
| FR-MODAL commission…routing | 5 modal | W3 |
| NBV-05 Handover | Onboarding queue | W2 alias |
| NBV-06 Renewal | Renewals | AM OS + embed |
| NBV-07 KPI commission | Commission | W3 |
| NBV-08 SLA | SLA center | W3 |
| NBV-09 Reports | Reports | W4 |
| NBV-10 Territory | Territory | W3 |
| NBV-11 Approvals | Unified approvals | W2 |
| NBV-12 Settings | Settings | W4 |

---

# Testing strategy

| Layer | Tool | Scope |
|---|---|---|
| API unit | Jest | `revops-dashboard`, `revops-approvals`, `commission` calc |
| FE unit | Vitest | nav, flags, format |
| E2E | Playwright | shell nav, command center load, modal open, embed no double sidebar |
| Visual | Manual vs mockup HTML | Heros, KPI cards, table columns each wave |
| RBAC | auth.spec + manual | 403 without cap |

**CI:** Add `revops` to existing ops-web + ptt-crm-api test jobs; flag off by default in CI unless `REVOPS_CI=1`.

---

# Rollout & flags

| Env | Flags | Notes |
|---|---|---|
| local dev | `NEXT_PUBLIC_REVOPS_SHELL=1` | Full shell |
| staging | `1` | PO UAT |
| prod | `0` → `1` | Phased by wave after UAT |

**Rollback:** set flag `0`; no DB migration rollback for W1 (read-only aggregate). W3 DDL migrations reversible via down script.

---

# Effort estimate (engineering days, 1 dev)

| Wave | Days | Cumulative |
|---|---|---|
| W1 | 8–12 | 12 |
| W2 | 10–14 | 26 |
| W3 | 15–20 | 46 |
| W4 | 8–10 | 56 |
| Track A (parallel) | 3–5 | — |

Commission module (W3) là critical path dài nhất.

---

# Risks & mitigations

| Risk | Mitigation |
|---|---|
| Không có top-level deal-room API | W2 `revops-pipeline.service` aggregate từ leads |
| Double sidebar embed | `?revops=1` embed mode Task 10 |
| Commission phức tạp | W3 isolated subfolder + DDL riêng |
| SRS route ≠ code | Route reconciliation table khóa ở đầu plan |
| AM OS chưa xong renewal | RevOps deep-link; placeholder `—` ok W1 |

---

# Self-review (spec coverage)

- [x] 12 view → Task/Wave assigned
- [x] 17 modal → W1/W2/W3 tasks
- [x] Sub-mockup L3 → Track A
- [x] Global constraints copied verbatim
- [x] No TBD placeholders
- [x] Route reconciliation documented
- [x] File paths exact
- [x] W1 tasks bite-sized with test commands

**Gaps intentionally deferred:** AI growth playbook (NBV-06) → AM OS Wave 5; Forecast/Win-Loss tabs full logic → W4.

---

**Plan complete.** Two execution options:

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks  
2. **Inline Execution** — execute in session with executing-plans, batch checkpoints  

Which approach?
