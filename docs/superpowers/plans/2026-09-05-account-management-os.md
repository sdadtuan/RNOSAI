# Account Management OS — Full Implementation Plan (SRS v2.0)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Account Management OS on RNOSAI — `/crm/account-management*` + `/api/crm/am` — matching SRS v2.0 and the HTML mockup, wave by wave, without a second app.

**Architecture:** Nest module `am` in `ptt-crm-api` (Postgres `crm_am_*`, staff JWT). ops-web uses a dedicated `AmShell` (never KPI Hub, never nested `<main>`). Customer SoR is the existing `clients` table (product name `agency_client`). Contract SoR is `crm_contracts`. Ticket/SLA SoR is CSD (link only). Health is one 4-band formula with snapshots.

**Tech Stack:** NestJS `ptt-crm-api` · Next.js `ops-web` · PostgreSQL · staff JWT + `staff_section_permissions` · Jest (API) · Vitest (ops-web) · no new npm packages · AI **off** until Wave 5 flag.

**SoT:**
- SRS: [2026-09-05-account-management-srs.md](../specs/2026-09-05-account-management-srs.md) **v2.0**
- Mockup: [docs/design/rnosai-am-os-srs-mockup.html](../../design/rnosai-am-os-srs-mockup.html)
- This file supersedes [2026-09-05-account-management-w1.md](./2026-09-05-account-management-w1.md)

## Global Constraints

- API prefix **`/api/crm/am`**. Same staff JWT as CRM. Tenant **`PTT` only**.
- Caps: `crm_am` `view` / `view_all` / `edit` / `assign` / `manage` + `crm_am.finance` `view`.
- Customer SoR = table **`clients`** (`id UUID`). AM never INSERTs a second customer master. Ext = `crm_am_account_ext`.
- Contract SoR = **`crm_contracts`** (`id BIGSERIAL`). AM stores `contract_id BIGINT`. Never delete or edit `amount_vnd` / legal terms.
- Ticket SoR = CSD. AM **links**. Never Resolve. Never clone tickets.
- Media spend never enters MRR / ARR / PTT managed revenue.
- Empty / missing → `null` in API and `—` in UI. Never fake `0`. Never hard-code mockup numbers `48` / `1,28 tỷ` / `1.248`.
- CSS `am-*`. Tokens: Navy `#0F2747` · Accent `#2563EB` · Success `#16A34A` · Warning `#D97706` · Danger `#DC2626` · Info `#0891B2` · bg `#F7F8FA` · radius 10–12. Do not touch `kpi-hub-*` / `csd-*`.
- Product sidebar: grouped nav, **no count badges**. No demo “Nhảy màn / Toàn catalog” bar.
- Staff id = INTEGER JWT `staffId`. Timezone ICT. Work hours 08:30–17:30 Mon–Fri VN.
- Health bands: Healthy 80–100 · Watch 60–79 · At Risk 40–59 · Critical 0–39. Weights 30/20/20/15/15.
- Dashboard has **exactly 6 KPI tiles**.
- Do not start Wave *n* until Wave *n−1* UAT is green.
- Do not implement client portal or FX in this plan.

---

## File map

### Backend (`services/ptt-crm-api/src/am/`)

| File | Responsibility | Wave |
|------|----------------|------|
| `am.types.ts` | Shared DTO / unions | 1 |
| `am-health.util.ts` | Score, band, thin-data | 1 |
| `am-scope.util.ts` | `me` / `team` / `all` SQL | 1 |
| `am-money.util.ts` | MRR / at-risk / VND format rules | 1 |
| `am-freshness.util.ts` | Work-hours remaining + stale | 1 |
| `am-audit.repository.ts` | Insert `crm_am_audit` | 1 |
| `guards/staff-am.guard.ts` | `RequireAmAction` | 1 |
| `am-dashboard.service.ts` | `GET /command-center` | 1 |
| `am-accounts.service.ts` | create/attach/list/360/transfer | 1–2 |
| `am-tasks.service.ts` | create/accept/dismiss/queue | 1–3 |
| `am-plans.service.ts` | create + seed | 1 |
| `am-search.service.ts` | ⌘K | 1 |
| `am-health.service.ts` | snapshot + recompute | 1 |
| `am-settings.service.ts` | GET/PUT settings | 1–2 |
| `am-renewals.service.ts` | case + pipeline + job | 2 |
| `am-onboarding.service.ts` | handover + workspace + go-live | 2 |
| `am-contracts.service.ts` | read catalog / detail | 2 |
| `am-interactions.service.ts` | timeline + log meeting | 3 |
| `am-risks.service.ts` | risk + recovery | 3 |
| `am-opportunities.service.ts` | growth | 4 |
| `am-reports.service.ts` | Logo/GRR/NRR | 4 |
| `am-finance.service.ts` | invoice snapshot | 4 |
| `am-feedback.service.ts` | CSAT / survey | 4 |
| `am-notifications.service.ts` | bell | 1 stub / 3–4 events |
| `am-ai.service.ts` | draft only, flag gated | 5 |
| `am.controller.ts` | HTTP | 1+ |
| `am.module.ts` | providers | 1 |
| `am-health.worker.ts` | 02:00 ICT + debounce | 2 |
| `am-renewal.worker.ts` | 90/60/30/14/7/1 | 2 |

### Frontend (`services/ops-web/src/`)

| File | Responsibility | Wave |
|------|----------------|------|
| `lib/crm/am-api.ts` | Fetch wrappers | 1 |
| `lib/crm/am-nav.util.ts` | Grouped nav + `canSeeAmNav` | 1 |
| `lib/crm/am-format.ts` | `—`, VND, band copy | 1 |
| `components/crm/am/AmShell.tsx` | Chrome: topbar + sidebar + scope/density | 1 |
| `components/crm/am/AmPalette.tsx` | UI-AM-00 | 1 |
| `components/crm/am/AmCreateMenu.tsx` | `+ Tạo mới ▾` | 1 |
| `components/crm/am/AmDashboard.tsx` | UI-AM-01 | 1 |
| `components/crm/am/AmPlaceholder.tsx` | Later-wave routes | 1 |
| `components/crm/am/AmAccountsList.tsx` | UI-AM-02 | 2 |
| `components/crm/am/AmAccount360.tsx` | UI-AM-03 | 2 |
| `components/crm/am/AmAccountForm.tsx` | UI-AM-05 | 2 |
| `components/crm/am/AmContactDrawer.tsx` | UI-AM-06 | 2 |
| `components/crm/am/AmHandover.tsx` | UI-AM-07 | 2 |
| `components/crm/am/AmOnboarding.tsx` | UI-AM-08/09 | 2 |
| `components/crm/am/AmContractDetail.tsx` | UI-AM-10 | 2 |
| `components/crm/am/AmRenewalKanban.tsx` | UI-AM-11 | 2 |
| `components/crm/am/AmRenewalCase.tsx` | UI-AM-12 | 2 |
| `components/crm/am/AmWorkQueue.tsx` | UI-AM-14 | 3 |
| `components/crm/am/AmWorkItem.tsx` | UI-AM-15/16/18 | 3 |
| `components/crm/am/AmTimeline.tsx` | UI-AM-04/17 | 3 |
| `components/crm/am/AmHealthCenter.tsx` | UI-AM-19/20 | 3 |
| `components/crm/am/AmRiskForm.tsx` | UI-AM-21/22 | 3 |
| `components/crm/am/AmGrowth.tsx` | UI-AM-24/25 | 4 |
| `components/crm/am/AmReports.tsx` | UI-AM-28 | 4 |
| `components/crm/am/AmFinance.tsx` | UI-AM-13 | 4 |
| `components/crm/am/AmFeedback.tsx` | UI-AM-26/27 | 4 |
| `components/crm/am/AmSettings.tsx` | UI-AM-23/29/30 | 2–4 |
| `components/crm/am/AmNotifyDrawer.tsx` | UI-AM-31 | 3 |
| `components/crm/am/AmAiDrawer.tsx` | UI-AM-32 | 5 |
| `app/crm/account-management/**` | Routes | 1+ |
| `app/crm/account-management/am.css` | Tokens | 1 |

### Shared / ops

| File | Responsibility |
|------|----------------|
| `docs/specs/2026-09-05-postgresql-ddl-am.sql` | Wave 1 tables |
| `docs/specs/2026-09-05-postgresql-ddl-am-w2.sql` | Wave 2 tables |
| `docs/specs/2026-09-05-postgresql-ddl-am-w3.sql` | Wave 3 tables |
| `docs/specs/2026-09-05-postgresql-ddl-am-w4.sql` | Wave 4 tables |
| `scripts/apply_pg_ddl_am.sh` | Apply W1 |
| `scripts/apply_pg_ddl_am_w2.sh` / `_w3.sh` / `_w4.sh` | Later DDL |
| `scripts/seed_am_rbac.sh` | Grant catalog (no prod users) |
| `services/ptt-crm-api/src/staff-permissions/rbac-admin-catalog.json` | Caps |
| `services/ops-web/src/lib/rbac-routes.ts` | Prefix before `/crm` |
| `services/ops-web/src/components/OpsNav.tsx` | Product nav link |
| `services/ops-web/src/lib/auth.spec.ts` | Route 403 tests |
| `services/ptt-crm-api/src/app.module.ts` | Register `AmModule` |

---

## Locked IDs (do not invent)

```text
clients.id                         UUID          ← AM agency_client_id
clients.owner_am_id                TEXT          ← sync from ext INTEGER as String(staffId)
clients.status                     TEXT          ← agency lifecycle; AM lifecycle lives on ext
crm_contracts.id                   BIGSERIAL
crm_contracts.agency_client_id     TEXT          ← join ::text of clients.id
crm_contracts.ends_on              DATE
crm_contracts.amount_vnd           BIGINT        ← read only
crm_contracts.billing_type         TEXT          ← recurring vs one_off/project
csd_tickets.sla_status             on_track|at_risk|near_breach|breached|paused|exempted
csd_tickets.scope_status           in_scope|...
staff_user_teams.user_id/team_id   INTEGER
staff_teams.id                     INTEGER
```

AM owner SoR = `crm_am_account_ext.account_owner_staff_id`. On create/transfer also `UPDATE clients SET owner_am_id = $staffId::text`.

Active book (`am_status`): `onboarding | active | at_risk | renewing | paused`. Never `churned`.

---

## Slice order

```text
W1  DDL/caps → Nest utils → Dashboard API → AmShell UI → claim/create work
    → create client/plan → ⌘K → health job → UAT
W2  List/360 → handover/onboard → contracts → renewal → settings → UAT
W3  Work queue/SLA → timeline → risk/recovery → CSD link → UAT
W4  Growth → reports → finance → feedback → fields/SLA policy → UAT
W5  AI flag-off → M01 → notify polish → UAT
```

---

# Wave 1 — Shell, Dashboard, create, claim, palette

**UAT gate:** 403, 6 KPI (`—` or real), claim work, create client on `clients`, ⌘K scoped, placeholders not 404.

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

### Task 2: Caps + route guard

**Files:**
- Modify: `services/ptt-crm-api/src/staff-permissions/rbac-admin-catalog.json`
- Create: `scripts/seed_am_rbac.sh` (catalog only; no auto-grant prod)
- Modify: `services/ops-web/src/lib/rbac-routes.ts` — insert **before** `{ prefix: '/crm', ... }`
- Modify: `services/ops-web/src/lib/auth.spec.ts`
- Create: `services/ops-web/src/lib/crm/am-nav.util.ts`
- Create: `services/ops-web/src/lib/crm/am-nav.util.spec.ts`

**Interfaces:**
- Consumes: `hasCap`, `canAccessPath`
- Produces: `canSeeAmNav(user)`, route prefix `/crm/account-management`

- [ ] **Step 1: Write failing route tests** in `auth.spec.ts`

```ts
it('AM path requires crm_am.view or view_all — agency-only is 403', () => {
  const agency = user([{ section: 'crm_agency', action: 'view' }]);
  expect(canAccessPath('/crm/account-management', agency, 'crm')).toBe(false);
  expect(canAccessPath('/crm/account-management/clients', agency, 'crm')).toBe(false);
});

it('crm_am.view can open AM routes', () => {
  const am = user([{ section: 'crm_am', action: 'view' }]);
  expect(canAccessPath('/crm/account-management', am, 'crm')).toBe(true);
  expect(canAccessPath('/crm/account-management/renewals/x', am, 'crm')).toBe(true);
});

it('crm_am.view_all can open AM routes', () => {
  const dir = user([{ section: 'crm_am', action: 'view_all' }]);
  expect(canAccessPath('/crm/account-management', dir, 'crm')).toBe(true);
});
```

Run: `cd services/ops-web && npx vitest run src/lib/auth.spec.ts`
Expected: FAIL — prefix missing, agency user matches generic `/crm`.

- [ ] **Step 2: Catalog**

In `section_actions` add next to `"csd"`:

```json
"crm_am": ["view", "view_all", "edit", "assign", "manage"],
"crm_am.finance": ["view"]
```

In `sections` add after the `csd` object:

```json
{
  "id": "crm_am",
  "label": "Account Management",
  "group": "CRM",
  "page": "/crm/account-management",
  "description": "AM post-contract: retain / renew / expand / health."
},
{
  "id": "crm_am.finance",
  "label": "Account Management — Tài chính",
  "group": "CRM",
  "page": "/crm/account-management",
  "description": "Xem snapshot công nợ / invoice AM. Không sửa Paid."
}
```

- [ ] **Step 3: Prefix in `PATH_CAP_RULES` immediately before `/crm/csd` (must be longer than `/crm`)**

```ts
{
  prefix: '/crm/account-management',
  anyOf: [
    { section: 'crm_am', action: 'view' },
    { section: 'crm_am', action: 'view_all' },
  ],
},
```

- [ ] **Step 4: `am-nav.util.ts`**

```ts
import type { StoredStaffUser } from '@/lib/auth';
import { hasCap } from '@/lib/auth';

export function canSeeAmNav(user: StoredStaffUser | null | undefined): boolean {
  if (!user) return false;
  return hasCap(user, 'crm_am', 'view') || hasCap(user, 'crm_am', 'view_all');
}

export type AmNavItem = {
  href: string;
  label: string;
  group: 'TỔNG QUAN' | 'KHÁCH HÀNG' | 'CÔNG VIỆC' | 'HỢP ĐỒNG' | 'PHÂN TÍCH' | 'CẤU HÌNH';
};

export const AM_NAV: AmNavItem[] = [
  { group: 'TỔNG QUAN', href: '/crm/account-management', label: 'Dashboard' },
  { group: 'KHÁCH HÀNG', href: '/crm/account-management/clients', label: 'Danh sách' },
  { group: 'KHÁCH HÀNG', href: '/crm/account-management/onboarding', label: 'Onboarding' },
  { group: 'CÔNG VIỆC', href: '/crm/account-management/work', label: 'Work Queue' },
  { group: 'HỢP ĐỒNG', href: '/crm/account-management/renewals', label: 'Gia hạn' },
  { group: 'PHÂN TÍCH', href: '/crm/account-management/reports', label: 'Báo cáo' },
  { group: 'PHÂN TÍCH', href: '/crm/account-management/health', label: 'Health & Risk' },
  { group: 'CẤU HÌNH', href: '/crm/account-management/settings', label: 'Cấu hình' },
];
```

Spec: `AM_NAV` has 8 items, group order as above, no `badge` field.

- [ ] **Step 5: Re-run vitest** — Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(am): register crm_am caps and fail-closed route guard

EOF
)"
```

---

### Task 3: Nest module + health / scope / money utils

**Files:**
- Create: `services/ptt-crm-api/src/am/am.types.ts`
- Create: `services/ptt-crm-api/src/am/am-health.util.ts`
- Create: `services/ptt-crm-api/src/am/am-health.util.spec.ts`
- Create: `services/ptt-crm-api/src/am/am-scope.util.ts`
- Create: `services/ptt-crm-api/src/am/am-scope.util.spec.ts`
- Create: `services/ptt-crm-api/src/am/am-money.util.ts`
- Create: `services/ptt-crm-api/src/am/am-money.util.spec.ts`
- Create: `services/ptt-crm-api/src/am/am-freshness.util.ts`
- Create: `services/ptt-crm-api/src/am/am-freshness.util.spec.ts`
- Create: `services/ptt-crm-api/src/am/guards/staff-am.guard.ts`
- Create: `services/ptt-crm-api/src/am/guards/staff-am.guard.spec.ts`
- Create: `services/ptt-crm-api/src/am/am.module.ts`
- Modify: `services/ptt-crm-api/src/app.module.ts` — `import { AmModule } from './am/am.module';` then `AmModule` next to `CsdModule`

**Interfaces:**
- Consumes: `StaffAuthService.hasCap`, `StaffOrInternalKeyGuard`
- Produces: types and pure functions below

```ts
export type AmHealthBand = 'healthy' | 'watch' | 'at_risk' | 'critical';
export type AmScope = 'me' | 'team' | 'all';
export type AmAmStatus =
  | 'pending_handover' | 'onboarding' | 'active' | 'at_risk'
  | 'renewing' | 'paused' | 'churned';
export type AmTaskKind =
  | 'task' | 'client_request' | 'issue' | 'escalation' | 'approval' | 'milestone';
export type AmTaskStatus =
  | 'new' | 'in_progress' | 'waiting_client' | 'waiting_internal'
  | 'resolved' | 'closed' | 'cancelled';
export type AmPlanKind = 'care' | 'qbr' | 'renewal' | 'expand';

export const ACTIVE_BOOK: AmAmStatus[] = [
  'onboarding', 'active', 'at_risk', 'renewing', 'paused',
];

export type AmHealthComponents = {
  kpi_delivery: number;
  engagement: number;
  financial: number;
  satisfaction: number;
  contract_support: number;
};

export const DEFAULT_WEIGHTS: AmHealthComponents = {
  kpi_delivery: 30,
  engagement: 20,
  financial: 20,
  satisfaction: 15,
  contract_support: 15,
};

export function bandFromScore(score: number): AmHealthBand {
  if (score >= 80) return 'healthy';
  if (score >= 60) return 'watch';
  if (score >= 40) return 'at_risk';
  return 'critical';
}

export function weightedScore(
  components: AmHealthComponents,
  weights: AmHealthComponents = DEFAULT_WEIGHTS,
): number {
  const w = weights;
  return (
    (components.kpi_delivery * w.kpi_delivery +
      components.engagement * w.engagement +
      components.financial * w.financial +
      components.satisfaction * w.satisfaction +
      components.contract_support * w.contract_support) / 100
  );
}

export function isActiveBook(status: AmAmStatus): boolean {
  return ACTIVE_BOOK.includes(status);
}

export function resolveAmScope(opts: {
  requested: AmScope | undefined;
  hasViewAll: boolean;
  canTeam: boolean;
}): AmScope {
  const req = opts.requested ?? 'me';
  if (req === 'all' && opts.hasViewAll) return 'all';
  if (req === 'team' && (opts.canTeam || opts.hasViewAll)) return 'team';
  return 'me';
}

export function monthlyRecurringVnd(opts: {
  billingType: string;
  amountVnd: number;
  startsOn: string | null;
  endsOn: string | null;
}): number | null {
  if (opts.billingType === 'media' || opts.billingType === 'media_spend') return null;
  if (opts.billingType === 'project' || opts.billingType === 'one_off') return null;
  if (opts.billingType === 'annual' || opts.billingType === 'yearly') {
    return Math.round(opts.amountVnd / 12);
  }
  return opts.amountVnd;
}

export function formatVnd(n: number | null | undefined): string {
  if (n == null) return '—';
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2).replace(/\.?0+$/, '')} tỷ`;
  if (n >= 1_000_000) return `${Math.round(n / 1_000_000)}tr`;
  return `${n.toLocaleString('vi-VN')} VND`;
}
```

`am-scope.util.ts` produces SQL fragment (alias `e` = `crm_am_account_ext`):

```ts
export function amScopeSql(opts: {
  scope: AmScope;
  staffId: number;
  teamIds: number[];
}): { sql: string; params: unknown[] } {
  if (opts.scope === 'all') return { sql: 'TRUE', params: [] };
  if (opts.scope === 'team') {
    if (!opts.teamIds.length) {
      return { sql: 'e.account_owner_staff_id = $staff', params: [opts.staffId] };
    }
    return {
      sql: '(e.team_id = ANY($teams) OR e.account_owner_staff_id = $staff)',
      params: [opts.teamIds, opts.staffId],
    };
  }
  return {
    sql: '(e.account_owner_staff_id = $staff OR EXISTS (SELECT 1 FROM crm_am_tasks t WHERE t.agency_client_id = e.agency_client_id AND t.assignee_staff_id = $staff AND t.status NOT IN (\'closed\',\'cancelled\')))',
    params: [opts.staffId],
  };
}
```

Guard copies `StaffCsdGuard` with section `crm_am` and metadata key `amRequiredAction`. Actions: `view | view_all | edit | assign | manage`. `view` also passes if user has `view_all`. Finance endpoints use section `crm_am.finance`.

- [ ] **Step 1: Write failing specs**

```ts
// am-health.util.spec.ts
expect(bandFromScore(80)).toBe('healthy');
expect(bandFromScore(79)).toBe('watch');
expect(bandFromScore(59)).toBe('at_risk');
expect(bandFromScore(39)).toBe('critical');
expect(weightedScore({
  kpi_delivery: 100, engagement: 100, financial: 100,
  satisfaction: 100, contract_support: 100,
})).toBe(100);
expect(isActiveBook('churned')).toBe(false);
expect(isActiveBook('paused')).toBe(true);

// am-money.util.spec.ts
expect(monthlyRecurringVnd({ billingType: 'media_spend', amountVnd: 50_000_000, startsOn: null, endsOn: null })).toBeNull();
expect(monthlyRecurringVnd({ billingType: 'project', amountVnd: 120_000_000, startsOn: null, endsOn: null })).toBeNull();
expect(monthlyRecurringVnd({ billingType: 'monthly', amountVnd: 20_000_000, startsOn: null, endsOn: null })).toBe(20_000_000);
expect(formatVnd(null)).toBe('—');

// am-scope.util.spec.ts
expect(resolveAmScope({ requested: 'all', hasViewAll: false, canTeam: false })).toBe('me');
expect(resolveAmScope({ requested: 'all', hasViewAll: true, canTeam: true })).toBe('all');
```

Run: `cd services/ptt-crm-api && npx jest src/am/am-health.util.spec.ts src/am/am-scope.util.spec.ts src/am/am-money.util.spec.ts --no-coverage`
Expected: FAIL — files missing.

- [ ] **Step 2: Implement utils + guard + empty `AmModule` + register in `app.module.ts`.**

- [ ] **Step 3: Re-run jest** — Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(am): add AmModule with 4-band health, scope, and money rules

EOF
)"
```

---

### Task 4: Dashboard API

**Files:**
- Create: `services/ptt-crm-api/src/am/am-dashboard.service.ts`
- Create: `services/ptt-crm-api/src/am/am-dashboard.service.spec.ts`
- Create: `services/ptt-crm-api/src/am/am-audit.repository.ts`
- Create: `services/ptt-crm-api/src/am/am.controller.ts`

**Interfaces:**
- Consumes: `amScopeSql`, `isActiveBook`, `monthlyRecurringVnd`, `bandFromScore`
- Produces: `GET /api/crm/am/command-center?from&to&scope=`

```ts
export type AmCommandCenter = {
  period: { from: string; to: string };
  scope: AmScope;
  freshness: { as_of: string; stale: boolean; work_left_label: string | null };
  role: 'am' | 'director' | 'admin';
  load: { accounts: number; quota: number };
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
  coverage: null | {
    avg_load: number | null;
    unassigned: number;
    delegated: number;
    qbr_this_week: number;
  };
  today_work: Array<{
    id: string;
    due_at: string | null;
    title: string;
    account_name: string;
    sla_label: string | null;
    chip: 'overdue' | 'today' | 'soon' | 'unassigned';
    can_accept: boolean;
  }>;
  attention: Array<{
    agency_client_id: string;
    name: string;
    parent_name: string | null;
    band: AmHealthBand;
    score: number | null;
    mrr_vnd: number | null;
    days_to_end: number | null;
  }>;
  forecast: {
    committed_vnd: number | null;
    likely_vnd: number | null;
    risk_vnd: number | null;
    unlikely_vnd: number | null;
  };
  health_dist: {
    healthy: number;
    watch: number;
    at_risk: number;
    critical: number;
    avg: number | null;
  };
  my_book: Array<{
    agency_client_id: string;
    name: string;
    is_parent: boolean;
    child_count: number;
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

Rules:
- `active_accounts` = clients with ext `am_status IN ACTIVE_BOOK`.
- `mrr_vnd` = Σ `monthlyRecurringVnd` of Active+Renewing contracts in scope. Media/project excluded.
- `renewal_90d_*` = Active contracts with `ends_on ∈ [as_of, as_of+90d]`. Count contracts, not clients.
- `revenue_at_risk_*` = Σ recurring of accounts whose **latest** snapshot band ∈ {at_risk, critical}. Do not add Watch.
- `sla_overdue` = count of CSD tickets `scope_status='in_scope' AND sla_status='breached'` joined to in-scope clients. Missing CSD table → `null`.
- `csat` = `null` in Wave 1.
- Missing previous period → omit `deltas` (do not send `0`).
- `from/to` changes KPI + forecast + health + book. **Does not** change `today_work`.
- `coverage` only when resolved scope is `team` or `all` **and** role is director/admin; else `null`.
- Empty book → every KPI `null`, arrays `[]`. Never `0` for money KPIs.

Controller:

```ts
@Controller('api/crm/am')
@UseGuards(StaffOrInternalKeyGuard, StaffAmGuard)
export class AmController {
  @Get('command-center')
  @RequireAmAction('view')
  commandCenter(@Req() req: AuthedReq, @Query() q: { from?: string; to?: string; scope?: AmScope }) {
    return this.dashboard.get(req, q);
  }
}
```

- [ ] **Step 1: Failing service spec** with an in-memory fixture (no DB):

```ts
it('counts revenue at risk only for at_risk ∪ critical', () => {
  const rows = [
    { band: 'watch', mrr: 100 },
    { band: 'at_risk', mrr: 50 },
    { band: 'critical', mrr: 20 },
    { band: 'healthy', mrr: 80 },
  ];
  const { vnd, count } = sumRevenueAtRisk(rows);
  expect(vnd).toBe(70);
  expect(count).toBe(2);
});

it('returns null KPIs for empty book', () => {
  const kpis = emptyKpis();
  expect(kpis.active_accounts).toBeNull();
  expect(kpis.mrr_vnd).toBeNull();
  expect(kpis.csat).toBeNull();
});
```

Extract `sumRevenueAtRisk` / `emptyKpis` into `am-dashboard.service.ts` (or `am-money.util.ts`) so the spec does not need Postgres.

- [ ] **Step 2: Implement service** — one aggregated SQL + latest-snapshot join. Cache in-process 60s keyed by `staffId|scope|from|to` (NFR-001). On write paths later, drop that key.

- [ ] **Step 3: Wire controller + module providers.**

- [ ] **Step 4: Run jest** — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(am): add command-center API with 6 KPIs and 4-band health

EOF
)"
```

---

### Task 5: AmShell + Dashboard UI + placeholders

**Files:**
- Create: `services/ops-web/src/lib/crm/am-api.ts`
- Create: `services/ops-web/src/lib/crm/am-format.ts`
- Create: `services/ops-web/src/lib/crm/am-format.spec.ts`
- Create: `services/ops-web/src/components/crm/am/AmShell.tsx`
- Create: `services/ops-web/src/components/crm/am/AmCreateMenu.tsx`
- Create: `services/ops-web/src/components/crm/am/AmDashboard.tsx`
- Create: `services/ops-web/src/components/crm/am/AmPlaceholder.tsx`
- Create: `services/ops-web/src/app/crm/account-management/am.css`
- Create: `services/ops-web/src/app/crm/account-management/layout.tsx`
- Create: pages: `page.tsx`, `clients/page.tsx`, `clients/[id]/page.tsx`, `onboarding/page.tsx`, `onboarding/[id]/page.tsx`, `work/page.tsx`, `work/[id]/page.tsx`, `renewals/page.tsx`, `renewals/[id]/page.tsx`, `contracts/[id]/page.tsx`, `reports/page.tsx`, `health/page.tsx`, `health/[id]/page.tsx`, `settings/page.tsx`, `feedback/page.tsx`, `opportunities/page.tsx`
- Modify: `services/ops-web/src/components/OpsNav.tsx` — TITLE_MAP + section after Service Desk
- Modify: `services/ops-web/src/lib/crm/am-nav.util.spec.ts` if needed

**Interfaces:**
- Consumes: `AmCommandCenter`, `AM_NAV`, `canSeeAmNav`
- Produces: working `/crm/account-management` page

`am-format.ts`:

```ts
export function dash(n: number | null | undefined): string {
  return n == null ? '—' : String(n);
}

export function bandCopy(band: AmHealthBand | null | undefined): string {
  if (band === 'healthy') return 'Khỏe mạnh';
  if (band === 'watch') return 'Cần theo dõi';
  if (band === 'at_risk') return 'Có rủi ro';
  if (band === 'critical') return 'Nghiêm trọng';
  return '—';
}
```

Layout **must** be:

```tsx
export default function AmLayout({ children }: { children: React.ReactNode }) {
  return <AmShell>{children}</AmShell>;
}
```

`AmShell` renders one page column. **Do not** wrap `{children}` in a second `<main>` if Ops chrome already has `<main>` — render a `<div className="am-root">`. Collapse control stores `localStorage.am-sidebar-collapsed`. Density stores `localStorage.am-density` = `comfortable | compact`. Scope is query `?scope=me|team|all` (default `me`). Role label is the real job/cap (`Admin` if `manage`, `Director` if `view_all`, else `AM`) — **not** a fake dropdown.

KPI tiles (copy exact):
1. Khách hàng active → `/crm/account-management/clients`
2. MRR hiện tại → `/crm/account-management/clients?sort=mrr`
3. Gia hạn 90 ngày (value + case count) → `/crm/account-management/renewals?window=90`
4. Revenue at risk → `/crm/account-management/health?band=at_risk,critical`
5. SLA quá hạn → `/crm/account-management/work?sla=breached`
6. CSAT → `/crm/account-management/feedback`

Placeholder copy: `Onboarding — mở ở Wave 2` (and Wave 3/4 as SRS §5.2).

OpsNav: after Service Desk block:

```ts
if (canSeeAmNav(user)) {
  sections.push({
    label: 'Account Management',
    links: [{ href: '/crm/account-management', label: 'Account Management' }],
    defaultOpen: true,
  });
}
```

Add `'/crm/account-management': 'Account Management'` to TITLE_MAP. Do **not** put AM under KPI Hub.

- [ ] **Step 1: Format spec** — `dash(null)==='—'`, `bandCopy('watch')==='Cần theo dõi'`.

- [ ] **Step 2: Implement shell/dashboard.** Widget errors: keep height + Retry. Empty today-work: `Bạn đã xử lý xong các việc ưu tiên hôm nay.` Empty book + `edit`: CTA Tạo khách.

- [ ] **Step 3: Create-menu Wave 1:** Khách · Việc · Renewal/Plan enabled if `edit`. Cơ hội + Log tương tác **disabled** with tooltip `Mở ở Wave 4` / `Mở ở Wave 3`.

- [ ] **Step 4: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(am): add AmShell and Wave 1 dashboard matching UI-AM-01

EOF
)"
```

---

### Task 6: Nhận việc + Tạo việc

**Files:**
- Create: `services/ptt-crm-api/src/am/am-tasks.service.ts`
- Create: `services/ptt-crm-api/src/am/am-tasks.service.spec.ts`
- Modify: `am.controller.ts`
- Modify: `AmDashboard.tsx` + `AmCreateMenu.tsx` (drawer UI-AM-16 subset)

**Interfaces:**

```ts
POST /api/crm/am/tasks
body: { agency_client_id: string; title: string; kind?: AmTaskKind; priority?: 'low'|'medium'|'high'; due_at?: string; source?: string; source_ref?: string }
cap: edit

POST /api/crm/am/tasks/:id/accept
cap: edit
→ assignee_staff_id = me, status = in_progress, audit action=task.accept

POST /api/crm/am/tasks/dismiss
body: { source: string; source_ref: string }
cap: edit
→ dismissed_at = now(); unique index allows a later real task
```

- [ ] **Step 1: Failing tests** (service with mocked repo)

```ts
it('accept assigns current staff and writes audit', async () => {
  const out = await service.accept('task-1', 42);
  expect(out.assignee_staff_id).toBe(42);
  expect(out.status).toBe('in_progress');
  expect(audit.calls[0].action).toBe('task.accept');
});

it('rejects duplicate open source_ref', async () => {
  await expect(service.create({
    agency_client_id: 'c1', title: 'A', source: 'csd', source_ref: 'T-1',
  }, 1)).rejects.toMatchObject({ status: 409 });
});
```

- [ ] **Step 2: Implement + UI “Nhận xử lý”** → toast → refetch command-center.

- [ ] **Step 3: Commit**

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
- UI drawers in `AmCreateMenu.tsx`

**Interfaces:**

```ts
POST /api/crm/am/accounts
cap: edit
body:
  | { mode: 'create'; code: string; name: string; industry_slug?: string; owner_am_id?: string }
  | { mode: 'attach'; agency_client_id: string; owner_staff_id?: number }

// create → AgencyService.createClient then UPSERT crm_am_account_ext
// attach → UPSERT ext only; 404 if clients.id missing
// create without crm_agency write → 403 { error: 'agency_write_required', fallback: '/agency/clients/new' }

POST /api/crm/am/plans
cap: edit
body: { agency_client_id: string; kind: AmPlanKind; period_key: string; contract_id?: number; due_on?: string }
// kind=renewal without contract_id → 400 { error: 'contract_required' }
// unique (client, kind, period_key) → 409
// seed tasks:
//   qbr: ['Chuẩn bị số liệu QBR','Đặt lịch QBR','Gửi biên bản']
//   renewal: ['Rà soát phạm vi','Liên hệ stakeholder','Soạn đề xuất gia hạn']
//   care: ['Gọi health-check','Lập recovery nếu Critical']
//   expand: ['Xác nhận nhu cầu','Tạo bước next']
```

- [ ] **Step 1: Tests**

```ts
it('create does not INSERT into a second customer table', async () => {
  await service.createAccount({ mode: 'create', code: 'AP01', name: 'An Phu' }, actor);
  expect(agency.createClient).toHaveBeenCalled();
  expect(db.inserts.some((s) => /insert into clients/i.test(s) && s.includes('am_'))).toBe(false);
});

it('attach does not call createClient', async () => {
  await service.createAccount({ mode: 'attach', agency_client_id: 'uuid' }, actor);
  expect(agency.createClient).not.toHaveBeenCalled();
});

it('renewal plan without contract_id is 400', async () => {
  await expect(plans.create({ agency_client_id: 'c', kind: 'renewal', period_key: '2026-Q3' }, 1))
    .rejects.toMatchObject({ error: 'contract_required' });
});
```

Inject `AgencyService` via `AmModule` importing `AgencyModule` (`forwardRef` if needed).

- [ ] **Step 2: UI** — create form fields match `/agency/clients/new` (code, name, industry_slug, owner). Tab **Gắn đã có** searches existing `clients`.

- [ ] **Step 3: Commit**

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

```ts
GET /api/crm/am/search?q=
cap: view
// q.trim().length < 2 → { items: [] } (not 500)
// groups Wave 1: account | contract | task
// apply amScopeSql — never return out-of-scope account
// exact code (clients.code ILIKE q) first, then name ILIKE
```

- [ ] **Step 1: Tests** — 1-char empty; view user cannot see other owner; exact code ranks first.

- [ ] **Step 2: UI** — ⌘/Ctrl+K, Esc closes, Enter opens. Account → `/crm/account-management/clients/[id]` (placeholder Wave 1). Debounce 300ms.

- [ ] **Step 3: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(am): add scoped command palette search

EOF
)"
```

---

### Task 9: Health snapshot + recompute

**Files:**
- Create: `services/ptt-crm-api/src/am/am-health.service.ts`
- Create: `services/ptt-crm-api/src/am/am-health.service.spec.ts`
- Modify: `am.controller.ts` — `POST /health/recompute` `@RequireAmAction('manage')`
- Create: `services/ptt-crm-api/src/am/am-settings.service.ts` — GET settings (all viewers)

**Interfaces:**

Wave 1 component stubs (replace in W3/W4 when sources exist):

| Component | Stub if missing |
|-----------|-----------------|
| kpi_delivery | 70 + thin_data |
| engagement | 70 + thin_data |
| financial | 80 if Active contract else 70 |
| satisfaction | 70 (no CSAT yet) |
| contract_support | 40 if any CSD breached else 70 |

Account Active < 30 days → `thin_data=true`. Churned clients skipped. Critical does **not** yet require recovery (Wave 3).

- [ ] **Step 1: Tests** — weights 30/20/20/15/15; score 72 → watch; churned excluded from dist.

- [ ] **Step 2: Implement upsert snapshot `ON CONFLICT (tenant_id, agency_client_id, as_of)`.**

- [ ] **Step 3: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(am): compute 4-band health snapshots for dashboard

EOF
)"
```

---

### Task 10: Settings GET + notify stub + freshness

**Files:**
- Modify: `am-settings.service.ts`, `am.controller.ts`
- Create: `services/ptt-crm-api/src/am/am-notifications.service.ts`
- Modify: `AmShell.tsx` — freshness chip + bell (empty list OK; **no** hard-coded `5`)

**Interfaces:**

```ts
GET /api/crm/am/settings          cap: view
GET /api/crm/am/notifications     cap: view   → { items, unread }
```

`work_left_label` from `am-freshness.util.ts`: VN 08:30–17:30 Mon–Fri. Weekend / after hours → `Giờ LV còn 0p` or `Ngoài giờ LV`.

- [ ] **Step 1: Freshness spec** — Tuesday 09:30 → remaining 8h; Saturday → ngoài giờ.

- [ ] **Step 2: Bell shows dot only when `unread > 0`.**

- [ ] **Step 3: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(am): add settings read, notifications stub, and work-hours freshness

EOF
)"
```

---

### Task 11: Wave 1 UAT + VPS

**Files:**
- Create: `scripts/deploy_am_w1_vps.sh` only if existing deploy scripts cannot apply one extra DDL — prefer reuse.

**UAT (local then `https://rs.pttads.vn`):**

1. User without cap → 403 on `/crm/account-management`.
2. User with `view` sees OpsNav + Dashboard. KPI is `—` or live numbers — never 48 / 1,28 tỷ hard-coded in HTML/JS.
3. Exactly 6 tiles + today work + attention + forecast + 4-band donut + my book.
4. Period change does not change today-work rows.
5. Scope `me` hides others; `all` needs `view_all`.
6. Nhận xử lý assigns current user; refresh keeps it.
7. Tạo khách appears in `clients` + `crm_am_account_ext`; `/agency/clients/{id}` opens.
8. Renewal plan without contract is blocked.
9. ⌘K does not leak out-of-scope accounts.
10. All child routes render placeholder, not 404.
11. No nested `<main>`. KPI Hub layout unchanged.
12. Sidebar has no numeric badges.

- [ ] **Step 1: Local UAT against the 12 items.**
- [ ] **Step 2: Apply DDL on VPS, rebuild `ops-web` + `ptt-crm-api`, grant `crm_am` to 1 AM + 1 Director via Admin RBAC.**
- [ ] **Step 3: Prod smoke.** Stop here until PO signs Wave 1.

---

# Wave 2 — List, 360, handover, onboard, contract, renewal, settings

**Entry:** Wave 1 UAT green.  
**UAT gate:** parent/child, Lost reason, Go-live gate, no contract amount edit.

### Task 12: Wave 2 DDL

**Files:**
- Create: `docs/specs/2026-09-05-postgresql-ddl-am-w2.sql`
- Create: `scripts/apply_pg_ddl_am_w2.sh`

```sql
CREATE TABLE IF NOT EXISTS crm_am_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  agency_client_id UUID NOT NULL,
  full_name TEXT NOT NULL,
  role_committee TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  sentiment TEXT,
  channel TEXT,
  renewal_attitude TEXT,
  email TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_am_handovers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  agency_client_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  commercial_json JSONB NOT NULL DEFAULT '{}',
  scope_json JSONB NOT NULL DEFAULT '{}',
  stakeholders_json JSONB NOT NULL DEFAULT '{}',
  reject_reason TEXT,
  accepted_by_staff_id INTEGER,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT crm_am_handovers_status_chk CHECK (
    status IN ('draft','pending_am','accepted','rejected','needs_info')
  )
);

CREATE TABLE IF NOT EXISTS crm_am_onboarding_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  name TEXT NOT NULL,
  version INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  items_json JSONB NOT NULL,
  UNIQUE (tenant_id, name, version)
);

CREATE TABLE IF NOT EXISTS crm_am_onboarding_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  agency_client_id UUID NOT NULL,
  template_id UUID,
  status TEXT NOT NULL DEFAULT 'open',
  go_live_on DATE,
  items_json JSONB NOT NULL,
  override_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_am_renewal_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  agency_client_id UUID NOT NULL,
  contract_id BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'not_started',
  forecast TEXT,
  forecast_pct INTEGER,
  next_action TEXT,
  lost_reason TEXT,
  lost_on DATE,
  lessons TEXT,
  new_contract_id BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT crm_am_renewal_status_chk CHECK (
    status IN ('not_started','evaluating','negotiating','decided','renewed','lost','paused')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS crm_am_renewal_open_uq
  ON crm_am_renewal_cases (tenant_id, contract_id)
  WHERE status NOT IN ('renewed','lost');
```

- [ ] Apply local. Commit: `feat(am): add Wave 2 tables for 360, onboard, and renewal`.

---

### Task 13: Accounts list API + UI-AM-02

**Files:** `am-accounts.service.ts` (list), `AmAccountsList.tsx`, `clients/page.tsx`

**Interfaces:**

```ts
GET /api/crm/am/accounts?scope&q&owner&team&band&lifecycle&industry&sort&page&page_size=50
→ { items, total, page }
item: {
  agency_client_id, code, name, parent_id, parent_name, is_parent, child_count,
  owner_staff_id, owner_label, delegated_until, team_label,
  am_status, band, score, mrr_vnd, ends_on, sla_label
}
```

Default hide `churned`. Saved-view chips: Tất cả · Của tôi · Cần chú ý · Gia hạn 90 ngày · Chưa gán owner · Parent group — implemented as query presets, not hard-coded rows. URL is source of filter. Sticky header. Density from shell.

- [ ] Tests: churned hidden; `view` cannot see other owner; sort `ends_on` server-side.
- [ ] UI: empty → `—`; parent row shows child count; unassigned only visible to assign/view_all.
- [ ] Commit: `feat(am): add scoped account list with saved-view chips`.

---

### Task 14: Saved views + bulk owner transfer

**Files:** settings/views endpoints, `AmAccountsList.tsx` bulk bar

```ts
GET/POST /api/crm/am/views
POST /api/crm/am/accounts/transfer
body: { agency_client_ids: string[]; to_staff_id: number; reason: string; keep_secondary?: boolean; move_open_tasks?: boolean }
cap: assign
```

Rules: reason required; one owner at a time; optional `backup_staff_id` if `keep_secondary`; audit `account.transfer`. Max 10 views / user; `shared=true` needs manage or team-lead (`assign`+`view_all`).

- [ ] Tests: missing reason 400; view user 403; task move optional flag.
- [ ] UI modal Đổi Owner.
- [ ] Commit: `feat(am): add saved views and bulk owner transfer`.

---

### Task 15: Account 360 Overview (UI-AM-03)

**Files:** `GET/PATCH /api/crm/am/accounts/:agencyClientId`, `AmAccount360.tsx`, `clients/[id]/page.tsx`

10 tabs. Wave 2 **implements** Tổng quan + Hợp đồng & Tài chính (read) + Audit. Other tabs: real headings + `Mở ở Wave n` panel (not 404).

Header: name, lifecycle, health badge → `/health/[id]`, code, industry, tier, team, Owner ▾ (assign), Delivery/Media labels if present. Quick actions: Log (W3 disable), Tạo việc, Tạo rủi ro (W3 disable), Bắt đầu gia hạn, Tạo cơ hội (W4 disable), no AI. `⋮` sửa / contact / đổi owner / lifecycle / archive (`manage`) / merge (`manage`, can 403 with tooltip). Deep-link `/agency/clients/[id]`. Parent lists children.

PATCH may update ext (tier, team, status, parent) — **not** `clients` legal identity except name via AgencyService if caller also has agency write.

- [ ] Tests: out-of-scope 404 not 200; parent returns children[]; PATCH amount on a contract endpoint does not exist.
- [ ] Commit: `feat(am): add Account 360 overview with parent/child`.

---

### Task 16: Create/Edit account + Contact drawer (UI-AM-05/06)

**Files:** `AmAccountForm.tsx`, `clients/new/page.tsx`, `AmContactDrawer.tsx`

Create reuses Task 7 API (full page). Edit: identity *, owner, ≥1 primary contact, tags. CTA: Hủy · Lưu nháp (status pending) · Lưu và tạo onboarding · Lưu. Dirty leave → `window` confirm (BR-024).

Contact: name, buying-committee role, sentiment, channel Gọi/Email/Zalo, renewal attitude.

- [ ] Tests: Active without primary contact → 400 `primary_contact_required`.
- [ ] Commit: `feat(am): add account form and contact drawer`.

---

### Task 17: Sales→AM Handover (UI-AM-07)

**Files:** `am-onboarding.service.ts`, `AmHandover.tsx`, `onboarding/page.tsx` (queue) + handover modal

4 steps: Thương mại → Scope & KPI → Stakeholder → Xác nhận. AM checklist required before accept. Reject / needs_info requires reason. Accept → `am_status=onboarding` + create onboarding case from published template (or empty checklist).

- [ ] Tests: accept without checklist 400; reject without reason 400; accept writes audit `handover.accept`.
- [ ] Commit: `feat(am): add Sales-to-AM handover workspace`.

---

### Task 18: Onboarding workspace + template + Go-live (UI-AM-08/09)

**Files:** `AmOnboarding.tsx`, `onboarding/[id]/page.tsx`, `settings` template panel (`manage`)

Case nav: Tổng quan / Checklist / Milestones / Stakeholders / Tài liệu / Activity. Go-live modal: all required items or override + reason. Warning if no health snapshot in last 24h. Published template is immutable — clone to draft.

- [ ] Tests: go-live blocked when required open and no override; published PATCH 409.
- [ ] Commit: `feat(am): add onboarding workspace and go-live gate`.

---

### Task 19: Contract catalog + detail (UI-AM-10)

**Files:** `am-contracts.service.ts`, `AmContractDetail.tsx`, `contracts/[id]/page.tsx`

```ts
GET /api/crm/am/contracts?agency_client_id&scope
GET /api/crm/am/contracts/:id
```

Read only. Tabs: Tổng quan · Dịch vụ & giá · Lịch TT (placeholder W4) · Gia hạn · Phụ lục · Tài liệu · Audit. **No** inputs for `amount_vnd`. Finance numbers hidden unless `crm_am.finance` (show `—`).

- [ ] Tests: PATCH route does not exist; amount visible only with finance cap (service flag `hide_amounts`).
- [ ] Commit: `feat(am): add read-only contract catalog and detail`.

---

### Task 20: Renewal pipeline + case + Lost (UI-AM-11/12)

**Files:** `am-renewals.service.ts`, `am-renewal.worker.ts`, `AmRenewalKanban.tsx`, `AmRenewalCase.tsx`

```ts
GET /api/crm/am/renewals?scope&window=90
GET /api/crm/am/renewals/:id
POST /api/crm/am/renewals          // start case for contract
PATCH /api/crm/am/renewals/:id     // forecast, status, next_action
```

Kanban columns: Chưa bắt đầu · Đang đánh giá · Đàm phán · Đã quyết định. Header: renewable / weighted / at risk. Drag requires forecast + next_action. Cannot move Renewed without `new_contract_id` (unless manage override). Cannot move Lost without `lost_reason`, `lost_on`, `lessons`. One open case per Active contract. Worker daily: if `ends_on` in {90,60,30,14,7,1} days and no open case → insert.

- [ ] Tests: second open case 409; Lost missing reason 400; Renewed missing contract 400; media amount not in weighted MRR.
- [ ] Commit: `feat(am): add renewal pipeline, case, and window job`.

---

### Task 21: Settings scorecard + health override (UI-AM-23, ACT-021/025)

**Files:** `AmSettings.tsx` (Wave 2 slice), `PUT /api/crm/am/settings`, `POST /api/crm/am/health/:agencyClientId/override`

PUT `manage` only. Validate weights sum = 100 and bands non-overlapping contiguous 0–100. Publish increments `scorecard_version` on **new** snapshots only.

Override: `manage` + reason + `until` ≤ 30 days. Banner on 360 + health.

- [ ] Tests: weights 29/20/20/15/15 → 400; overlap bands → 400; view PUT → 403; override 31 days → 400.
- [ ] Commit: `feat(am): add scorecard settings and health override`.

---

### Task 22: Wave 2 UAT

1. List filters survive refresh (URL).
2. Parent An-Phú-style row expands children; each child has own owner/score.
3. Bulk transfer writes audit; old owner loses `me` scope.
4. 360 has 10 tab labels; Ads/Portal tabs absent.
5. Handover reject requires reason; accept opens onboarding.
6. Go-live blocked on required items.
7. Contract amount not editable.
8. Lost/Churned modal required fields.
9. Settings read-only without manage.
10. KPI Hub + CSD unchanged.

Stop until PO signs Wave 2.

---

# Wave 3 — Work queue, timeline, risk, CSD link

**Entry:** Wave 2 UAT green.  
**UAT gate:** breach banner, no CSD Resolve, Critical requires recovery.

### Task 23: Wave 3 DDL

**Files:** `docs/specs/2026-09-05-postgresql-ddl-am-w3.sql`, `scripts/apply_pg_ddl_am_w3.sh`

```sql
CREATE TABLE IF NOT EXISTS crm_am_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  agency_client_id UUID NOT NULL,
  kind TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  actor_staff_id INTEGER,
  summary TEXT NOT NULL,
  sentiment TEXT,
  visibility TEXT NOT NULL DEFAULT 'internal',
  attendees_json JSONB,
  action_items_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT crm_am_interactions_kind_chk CHECK (
    kind IN ('note','call','meeting','email','system')
  )
);

CREATE TABLE IF NOT EXISTS crm_am_risks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  agency_client_id UUID NOT NULL,
  category TEXT NOT NULL,
  severity TEXT NOT NULL,
  probability INTEGER,
  impact INTEGER,
  evidence TEXT NOT NULL,
  owner_staff_id INTEGER,
  due_on DATE,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_am_recovery_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  agency_client_id UUID NOT NULL,
  risk_id UUID,
  goal TEXT NOT NULL,
  rca TEXT,
  actions_json JSONB NOT NULL,
  exit_criteria TEXT,
  outcome TEXT,
  lesson TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE crm_am_tasks
  ADD COLUMN IF NOT EXISTS csd_ticket_id UUID,
  ADD COLUMN IF NOT EXISTS escalation_level TEXT,
  ADD COLUMN IF NOT EXISTS resolution_summary TEXT,
  ADD COLUMN IF NOT EXISTS resolution_category TEXT;
```

- [ ] Commit: `feat(am): add Wave 3 tables for timeline, risk, and recovery`.

---

### Task 24: Work Queue (UI-AM-14)

**Files:** `AmWorkQueue.tsx`, `work/page.tsx`, expand `am-tasks.service.ts`

Inbox: của tôi / team / chưa gán. Views: list + board + week calendar. SLA clock. Bulk accept. Filters `sla=breached`. Unique `source+source_ref`.

- [ ] Tests: same `source_ref` not duplicated; waiting_client does not appear as overdue if `sla_paused` (BR-021).
- [ ] Commit: `feat(am): add work queue list, board, and week views`.

---

### Task 25: Work item detail + escalate (UI-AM-15/16/18)

**Files:** `AmWorkItem.tsx`, `work/[id]/page.tsx`

Banner red if breached. Waiting Client requires reason + evidence. Resolved requires summary; complaint adds category. Escalate: level + recipient + summary — **does not** call CSD resolve. Link field `csd_ticket_id` is a deep-link to `/crm/csd/tickets/[id]`.

Escalate thresholds (policy default): 70% Team Lead · 90% Director · 100% Executive — notify only in W3 (create `crm_am_notifications`).

- [ ] Tests: escalate does not change CSD ticket status (assert CSD repo `resolve` not called); waiting_client without reason 400.
- [ ] Commit: `feat(am): add work item detail, SLA pause, and escalate`.

---

### Task 26: Timeline + log meeting (UI-AM-04/17)

**Files:** `am-interactions.service.ts`, `AmTimeline.tsx`

Composer: note / call / meeting / task / attach. System events (contract, health, CSD) are read-only rows. Meeting attendees * + summary *. Ticked action items → `POST /tasks` with `source=interaction`.

Enable **Log tương tác** in `+ Tạo mới`.

- [ ] Tests: system kind cannot PATCH; creating meeting with one ticked item inserts a task.
- [ ] Commit: `feat(am): add account timeline and meeting log`.

---

### Task 27: Health & Risk Center + detail (UI-AM-19/20)

**Files:** `GET /api/crm/am/health`, `AmHealthCenter.tsx`, `health/page.tsx`, `health/[id]/page.tsx`

6 tiles: 4 bands + revenue at risk + open risks. 6-month sparkline from snapshots. Table of risky accounts. Detail: component contribution + signals + Recompute (`manage`) + Override (already Task 21).

- [ ] Tests: donut has 4 slices not 5; churned excluded; `/crm/health` (old) is **not** modified to a second formula — if touched, it must read `crm_am_health_snapshots`.
- [ ] Commit: `feat(am): add health and risk center on the AM scorecard`.

---

### Task 28: Risk + Recovery (UI-AM-21/22, BR-020)

**Files:** `am-risks.service.ts`, `AmRiskForm.tsx`

Critical latest snapshot **blocks** dashboard/360 write paths that ignore recovery: create required `crm_am_recovery_plans` status=open, except Director/admin override with reason.

Cannot close recovery without `outcome` + `lesson`.

- [ ] Tests: Critical without plan → 409 `recovery_required` on care-plan skip; close without lesson 400.
- [ ] Commit: `feat(am): add risk register and mandatory Critical recovery`.

---

### Task 29: CSD SLA parity (FR-025)

**Files:** `am-dashboard.service.ts` + `am-reports` helper `csdSlaRate(filter)`

```ts
// sample = CSD in_scope tickets created in period with a due
// on_time = response_on_time AND resolve_on_time
```

Wave 1 tile stays **count overdue**. Wave 3 adds optional `%` on Health/Reports. Same filter as CSD reports must differ by ≤ 0.1pp — unit test with shared fixture rows.

- [ ] Tests: identical 10-ticket fixture → AM rate === CSD helper rate.
- [ ] Commit: `feat(am): align AM SLA percent with CSD rollup`.

---

### Task 30: Wave 3 UAT

1. Queue board/list/week stay in sync after accept.
2. Breach banner on detail.
3. Escalate creates notify, CSD ticket still open.
4. Timeline system events not editable.
5. Critical account without recovery shows blocking banner.
6. SLA% vs CSD report same filter.
7. AI still absent.

Stop until PO signs Wave 3.

---

# Wave 4 — Growth, reports, finance, feedback, fields

**Entry:** Wave 3 UAT green.

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

### Task 32: Growth + Opportunity (UI-AM-24/25, FR-026, BR-015)

**Files:** `am-opportunities.service.ts`, `AmGrowth.tsx`, `opportunities/page.tsx`

Enable **Cơ hội** in create menu. Won **must not** INSERT `crm_contracts`. Opportunity only if client exists (converted). AI suggestion UI: Xem evidence + Tạo draft — no auto insert (flag still off).

- [ ] Tests: unknown client 400; Won does not call contract insert; 5 stages only.
- [ ] Commit: `feat(am): add growth pipeline without writing contracts`.

---

### Task 33: Reports Logo / GRR / NRR (UI-AM-28, FR-027)

**Files:** `am-reports.service.ts`, `AmReports.tsx`, `reports/page.tsx`

```
Logo = remaining_end / start_set          (new logos excluded from denominator)
GRR  = (Start − Churn − Contraction) / Start
NRR  = (Start − Churn − Contraction + Expansion) / Start
```

Missing expansion classification → hide NRR, show Logo + note. Every chart drills to account list. Tooltip shows formula. Freshness watermark. Churned MRR and expansion tiles. Cohort heatmap can be table-first (no new chart lib) — CSS stacked bars OK.

- [ ] Tests: fixture Start 100, churn 10, contraction 5, expansion 20 → GRR 0.85, NRR 1.05; new logo not in Logo denominator.
- [ ] Commit: `feat(am): add retention reports with GRR and NRR`.

---

### Task 34: Finance snapshot (UI-AM-13, FR-028)

**Files:** `am-finance.service.ts`, `AmFinance.tsx`

```ts
GET /api/crm/am/finance/:agencyClientId
cap: crm_am.finance view for amounts; others get { hidden: true }
```

Read invoices from existing finance tables if present (`invoices` / wave-b6). If table missing → `{ stale: true, kpis: all null }` + banner. **No** Paid/Issued buttons. CTA = deep-link ERP/finance page if it exists.

- [ ] Tests: without finance cap amounts are null; no update method exported.
- [ ] Commit: `feat(am): add read-only finance snapshot`.

---

### Task 35: Feedback + survey (UI-AM-26/27, FR-029)

**Files:** `am-feedback.service.ts`, `AmFeedback.tsx`, `feedback/page.tsx`

Dashboard CSAT tile now reads average if ≥1 score, else `—`. Survey rule: CSAT ≤ 3 → create task due +24h (`source=survey`). Follow-up button creates task. Complaint can link CSD (link only).

- [ ] Tests: score 3 creates a task with `source=survey`; score 4 does not; CSAT tile stays `null` when no rows.
- [ ] Commit: `feat(am): add feedback, survey follow-up, and CSAT tile`.

---

### Task 36: Custom fields + SLA policy (UI-AM-29/30, FR-030)

**Files:** `AmSettings.tsx` Wave 4 panels, field/SLA services

Custom field: label, `api_key` (immutable after publish), type, industry condition, required, filter/report flags, min/max, field-level access JSON. No free-form form-builder. Industry `bds` example fields: `project_name`, `leads_per_month`.

SLA policy: first response + resolution in business minutes, pause on Waiting Client, escalate 70/90/100, VN calendar 08:30–17:30 + holidays. Assign policy on task create (already has due fields).

- [ ] Tests: publish then rename `api_key` → 409; weights/holidays persist; non-manage PUT 403.
- [ ] Commit: `feat(am): add industry custom fields and AM SLA policies`.

---

### Task 37: Wave 4 UAT

1. Opportunity Won does not create a contract row.
2. Opportunity on non-`clients` id is rejected.
3. Reports: Logo/GRR tooltips; NRR hidden when expansion unclassified.
4. Finance snapshot has no Paid button; stale banner if unsynced.
5. CSAT tile is `—` or a real average — never mock 4.6.
6. CSAT ≤ 3 creates a 24h task.
7. Industry fields show only for matching `industry_slug`.
8. Export >10k (if implemented) is async + notify; otherwise button disabled with tooltip (BR-023: do not sync-dump).

Stop until PO signs Wave 4.

---

# Wave 5 — AI drawer, mobile M01, notify polish

**Entry:** Wave 4 UAT green. Portal and FX stay **out**.

### Task 38: AI drawer — flag off (UI-AM-32, FR-031, BR-012)

**Files:** `am-ai.service.ts`, `AmAiDrawer.tsx`

Env/flag `AM_AI_ENABLED` default **false**. When false: “Hỏi AI” hidden or disabled with tooltip `AI tắt`. When true: draft only — tóm tắt / giải thích health / QBR / follow-up. Every “Tạo task/draft” opens the existing form prefilled. Persist `ai_evidence_json`. 👍👎. Never write health/owner/contract from the model.

- [ ] Tests: flag off → 404 `{ error: 'ai_disabled' }`; flag on → response has `draft` + `evidence` and service does not call account PATCH.
- [ ] Commit: `feat(am): add flag-gated AI draft drawer`.

---

### Task 39: Mobile Account Quick View (UI-AM-M01, FR-032)

**Files:** `AmAccount360.tsx` responsive + `am.css` `@media (max-width: 767px)`

Show: MRR · ngày GH · task mở · cần xử lý · contact (Gọi/Email/Zalo) · activity · Log / Tạo task. Hide: settings, bulk, reports, kanban, custom-field admin. Desktop ≥1280 unchanged (NFR-003). No native app.

- [ ] Tests: nav util still 8 items on desktop; CSS class `am-m01` only under 768px. Manual: 375×812 screenshot of 360.
- [ ] Commit: `feat(am): add mobile Account Quick View`.

---

### Task 40: Notification center complete (UI-AM-31)

**Files:** `am-notifications.service.ts`, `AmNotifyDrawer.tsx`

Four kinds: `sla.breached`, `renewal.ending`, `health.drop`, `invoice.paid`. Mark read. Click → `href`. Dot only if unread. Never hard-code count `5`.

Wire writers:
- Task 25 already inserts SLA notifies.
- Renewal worker (Task 20) inserts when `ends_on` ≤ 14 days.
- Health job inserts when score drop ≥ `health_drop_alert`.
- Finance sync (if any) inserts `invoice.paid`.

- [ ] Tests: mark-read is per staff; other user’s unread unchanged; empty unread → no dot.
- [ ] Commit: `feat(am): complete in-app AM notification center`.

---

### Task 41: Wave 5 UAT + production gate

1. AI flag default off on prod.
2. M01 usable on phone; no settings/bulk.
3. Bell four kinds + navigate.
4. Full FR-001…032 checklist against this plan’s task column.
5. Regression: CSD Resolve, KPI Hub cream-gap, agency client create, contract amount.

Do **not** build client portal, multi-currency, or KPI Hub tiles unless a separate PO ticket exists.

---

## Out of this plan

| Item | Why |
|------|-----|
| Second AM app | Q1 |
| KPI Hub CRUD / nested `<main>` | Q2 / NFR-006 |
| Legal contract compose/sign | Q4 |
| CSD Resolve / clone | Q5 / BR-003 |
| IWRS | Q7 |
| Client portal / FX | Q12 / Wave 5 optional |
| AI auto-write | Q11 / BR-012 |
| Hard-coded mockup numbers | Q32 |
| Product nav count badges | BR-016 |

---

## Spec coverage (self-review)

| SRS item | Task |
|----------|------|
| FR-001 403 | T2, T11 |
| FR-002 6 KPI + `—` | T4, T5 |
| FR-003 period vs today-work | T4, T11 |
| FR-004 scope me/team/all | T3, T4 |
| FR-005 ⌘K | T8 |
| FR-006 create wrap agency | T7 |
| FR-007 plan + 409 | T7 |
| FR-008 accept + unique source_ref | T6 |
| FR-009 4-band 30/20/20/15/15 | T3, T9 |
| FR-010 OpsNav | T5 |
| FR-011 grouped nav, no badges | T2, T5 |
| FR-012 no 404 child routes | T5 |
| FR-013 create menu | T5, T7, T26, T32 |
| FR-014 collapse | T5 |
| FR-015 list / views / bulk | T13, T14 |
| FR-016 360 10 tabs + parent/child | T15 |
| FR-017 handover + go-live | T17, T18 |
| FR-018 contract read-only | T19 |
| FR-019 renewal + Lost reason | T20 |
| FR-020 settings weights | T21 |
| FR-021 work queue + SLA + CSD link | T24, T25 |
| FR-022 timeline + meeting | T26 |
| FR-023 risk + Critical recovery | T28 |
| FR-024 escalate ≠ Resolve CSD | T25 |
| FR-025 SLA% parity | T29 |
| FR-026 opportunity 5 stage | T32 |
| FR-027 Logo/GRR/NRR | T33 |
| FR-028 finance snapshot | T34 |
| FR-029 feedback / survey | T35 |
| FR-030 industry fields | T36 |
| FR-031 AI draft | T38 |
| FR-032 M01 | T39 |
| ACT-001…008 | T5–T10 |
| ACT-009…017, 021, 025, 027 | T14–T21 |
| ACT-018…020, 024 | T25–T28, T35 |
| ACT-023 | T32 |
| ACT-026 | T38 |
| BR-001…024 | T1 (IDs), T3–T4 (money/health), T7 (SoR), T19–T20, T25, T28, T32, T38 |
| UI-AM-00…01 | T5, T8 |
| UI-AM-02…12, 23 | T13–T21 |
| UI-AM-04, 13–22, 31 | T23–T30, T34, T40 |
| UI-AM-24…30 | T32–T36 |
| UI-AM-32, M01 | T38, T39 |
| NFR-001 cache 60s | T4 |
| NFR-002 health job | T9, T27 |
| NFR-006 `am-*`, no nested main | T5 |
| NFR-007 e2e 6 tiles + 403 | T11 |
| Q33 media ≠ MRR | T3 `monthlyRecurringVnd` |

**Intentional schema overrides vs SRS prose:** `agency_client` → table `clients`; `contract_id` → `BIGINT` not UUID. Product names in API stay `agency_client_id`.

---

## Wave exit checklist (repeat every wave)

1. Jest `src/am/**` green.
2. Vitest `am-nav`, `am-format`, `auth.spec` AM cases green.
3. Manual UAT list for that wave signed.
4. No hardcoded 48 / 1,28 tỷ / 1.248.
5. No product nav badges.
6. CSD and KPI Hub smoke still pass.

---

**Hết plan.** Implement Task 1 only after the user picks an execution mode. Do not skip to Wave 2 UI.