# Account Management OS — Gap-close Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the remaining SRS v2.0 / mockup gaps in Account Management OS so 360, contract, onboarding, jobs, and delegation match the SoT screens — without a second app and without reopening locked decisions.

**Architecture:** Keep the existing Nest `am` module (`/api/crm/am`) and ops-web `AmShell`. Fill placeholder tabs by composing APIs that already exist (tasks, health detail, contracts, views, interactions). Add only two new tables: `crm_am_documents` (link metadata) and `crm_am_delegations` (leave coverage). Payment schedule is derived read-only from `crm_contracts`. Nightly jobs wrap existing `AmHealthService.recompute` and `AmRenewalWorker.run` via Nest application context + systemd timers.

**Tech Stack:** NestJS `ptt-crm-api` · Next.js `ops-web` · PostgreSQL · staff JWT + `staff_section_permissions` · Jest (`services/ptt-crm-api/jest.config.js`) · Vitest (ops-web) · no new npm packages · `AM_AI_ENABLED` stays unset on prod.

**SoT:**
- SRS: [2026-09-05-account-management-srs.md](../specs/2026-09-05-account-management-srs.md) **v2.0** — UI-AM-03/04/08/10/14/17, §4.3, §6.4, FR-016, ACT-009/010
- Mockup: [docs/design/rnosai-am-os-srs-mockup.html](../../design/rnosai-am-os-srs-mockup.html)
- Shipped frame: [2026-09-05-account-management-os.md](./2026-09-05-account-management-os.md) (Waves 1–5, 41 tasks — **do not re-implement**)
- This file is the only execution plan for leftover gaps.

## Global Constraints

- API prefix **`/api/crm/am`**. Same staff JWT. Tenant **`PTT` only**.
- Caps: `crm_am` `view` / `view_all` / `edit` / `assign` / `manage` + `crm_am.finance` `view`. Do not invent new sections.
- Customer SoR = `clients` (`id UUID`). Contract SoR = `crm_contracts` (`id BIGSERIAL`). Ticket SoR = CSD (link only). Never Resolve CSD. Never clone tickets.
- Never edit/delete legal `amount_vnd` / terms on `crm_contracts`. AM must not write invoice Paid/Issued.
- Media spend never enters MRR / ARR / PTT managed revenue (`monthlyRecurringVnd` already returns null for media/media_spend/project/one_off).
- Empty / missing → API `null` / UI `—`. Never fake `0`. Never hard-code `48` / `1,28 tỷ` / `1.248`.
- CSS `am-*` only. No nested `<main>`. Dashboard **exactly 6 KPI tiles**. Product nav **no count badges**. `AM_NAV` stays **8 items**.
- Staff id = INTEGER JWT `staffId`. Nest: inject **class tokens**. Timezone ICT. Work hours 08:30–17:30 Mon–Fri VN.
- Health bands: Healthy 80–100 · Watch 60–79 · At Risk 40–59 · Critical 0–39. Weights 30/20/20/15/15.
- Active book: `onboarding | active | at_risk | renewing | paused`. Never churned in KPIs/list default.
- Out of plan — **do not implement:** client portal, FX/multi-currency, bubble, AI auto-write, new file-blob store, second delivery SoR, granting `staff_section_permissions` from scripts.
- VPS: `systemctl restart` **one unit per command** (`ptt-crm-api` then `ptt-ops-web`).
- Do not start Wave G*n* until Wave G*(n−1)* tests are green.
- Branch for implementation: `feat/am-os-gap-close` from current `main`. Use a git worktree. Do not commit `.DS_Store`, `node_modules`, or unrelated docs.

---

## What is already shipped (do not rebuild)

| Surface | Status |
|---|---|
| Dashboard 6 tiles, command-center, coverage widget | Live |
| Account list, 360 overview/timeline/finance/opportunities/feedback/audit | Live |
| Create/attach client, handover, onboarding checklist/milestones/stakeholders | Live |
| Contract catalog + detail overview/services/renewal/audit | Live |
| Work queue + work item, escalate, waiting-client | Live |
| Health center + `AmHealthDetail` page, `POST /health/recompute` | Live |
| Renewal pipeline + `AmRenewalWorker` + `POST /renewals/window-job` | Live |
| Saved views API (`GET/POST /views`) — **list page uses it; dashboard does not** | Live |
| Merge drawer, AI draft (flag off), notifications bell | Live |

## Locked gap decisions

1. **360 Work** — filter existing `GET /tasks` by `agency_client_id`. Do not clone the work-queue page.
2. **360 Health** — embed existing `AmHealthDetail`. Do not fetch a second scorecard.
3. **360 Projects** — read `crm_contracts` line items already on contract detail + optional deep-link to delivery/B2B. If `crm_delivery_projects` has no client join, return `delivery: []` and show `—`. Never INSERT a delivery project from AM.
4. **Documents** — metadata + `https`/`/` link only (`kind='link'`). No blob upload, no new object store.
5. **Payment schedule** — derive from `crm_contracts.starts_on/ends_on/amount_vnd/billing_type`. Status is `upcoming` or `overdue` vs `as_of`. Never `paid`. Cap recurring rows at 36 months.
6. **Amendments** — `crm_contracts` has no parent/appendix column. Keep `amendments: []` and render honest `—`. Do not invent a phụ lục SoR.
7. **Action item → task** — `POST /interactions/:id/action-items/:index/to-task`. `source='interaction'`, `source_ref='{id}:{index}'` (unique index already exists). Idempotent.
8. **Jobs** — no `@nestjs/schedule`. `NestFactory.createApplicationContext` + systemd oneshot. Restart one unit at a time.
9. **Delegation** — new `crm_am_delegations`. `backup_staff_id` stays secondary AM; do not treat backup as leave. Scope `me` includes accounts whose owner delegated *to* the actor for `CURRENT_DATE` in `[starts_on, ends_on]`.
10. **`/crm/health`** — add an AM snapshot strip when `crm_am.view`. Do **not** replace `CsHealthDashboardPanel`.
11. **Export** — sync CSV if row count `< 10000`. If `>= 10000` return `400 { error: 'export_too_large', max: 10000 }`. No async job queue.
12. **Import CSV** — out of this plan (ACT-011). List already blocks inventing customers; do not add an importer here.

---

## File map

### New

| File | Responsibility | Task |
|---|---|---|
| `docs/specs/2026-09-05-postgresql-ddl-am-g1.sql` | `crm_am_documents` + `crm_am_delegations` | 4, 10 |
| `scripts/apply_pg_ddl_am_g1.sh` | Static verify + `psql` apply | 4 |
| `services/ptt-crm-api/src/am/am-documents.service.ts` | List/create document links | 4 |
| `services/ptt-crm-api/src/am/am-documents.service.spec.ts` | Documents tests | 4 |
| `services/ptt-crm-api/src/am/am-payment-schedule.util.ts` | Derive schedule rows | 5 |
| `services/ptt-crm-api/src/am/am-payment-schedule.util.spec.ts` | Schedule tests | 5 |
| `services/ptt-crm-api/src/am/am-health.worker.ts` | Nightly recompute wrapper | 8 |
| `services/ptt-crm-api/src/am/am-health.worker.spec.ts` | Worker tests | 8 |
| `services/ptt-crm-api/src/am/am-delegations.service.ts` | Leave create/list | 10 |
| `services/ptt-crm-api/src/am/am-delegations.service.spec.ts` | Delegation tests | 10 |
| `scripts/run_am_job.ts` | Nest app-context CLI `health` \| `renewal` | 8 |
| `deploy/systemd/ptt-crm-am-health.{service,timer}` | 02:00 ICT | 8 |
| `deploy/systemd/ptt-crm-am-renewal.{service,timer}` | 06:00 ICT window job | 9 |
| `services/ops-web/src/components/crm/am/AmAccountWork.tsx` | 360 Công việc | 1 |
| `services/ops-web/src/components/crm/am/AmAccountProjects.tsx` | 360 Dự án & dịch vụ | 3 |
| `services/ops-web/src/components/crm/am/AmDocumentsPanel.tsx` | Shared documents list | 4 |
| `services/ops-web/src/components/crm/am/AmHelpDrawer.tsx` | Topbar ❔ | 14 |
| `services/ops-web/src/components/crm/health/AmCsHealthStrip.tsx` | `/crm/health` AM strip | 11 |
| `services/ops-web/src/lib/crm/am-cs-health-strip.util.ts` | Strip visibility + copy | 11 |
| `services/ops-web/src/lib/crm/am-delegation.util.ts` | Delegation form validation | 10 |
| `services/ops-web/src/lib/crm/am-payment-schedule.util.ts` | Payment row display | 5 |
| `services/ops-web/src/lib/crm/am-export.util.ts` | CSV escape + too-large copy | 13 |

### Modify (existing)

| File | Change | Task |
|---|---|---|
| `services/ptt-crm-api/src/am/am-tasks.service.ts` | `AmTasksListQuery.agency_client_id` filter | 1 |
| `services/ptt-crm-api/src/am/am-tasks.service.spec.ts` | Filter test | 1 |
| `services/ops-web/src/lib/crm/am-api.ts` | `agency_client_id` on work query + new fetchers | 1–13 |
| `services/ops-web/src/lib/crm/am-account-360.util.ts` | Flip `work`/`health`/`projects`/`documents` to `implemented: true` | 1–4 |
| `services/ops-web/src/lib/crm/am-account-360.util.spec.ts` | Expect all 10 tabs implemented | 4 |
| `services/ops-web/src/components/crm/am/AmAccount360.tsx` | Render new panels instead of `AmPlaceholder` | 1–4 |
| `services/ptt-crm-api/src/am/am-accounts.service.ts` | `GET :id/projects`; `delegated_until`; bulk tag; export count | 3, 10, 13 |
| `services/ptt-crm-api/src/am/am-contracts.service.ts` | Fill `payment_schedule` + `documents` | 4, 5 |
| `services/ops-web/src/components/crm/am/AmContractDetail.tsx` | Payments + documents panels | 4, 5 |
| `services/ptt-crm-api/src/am/am-interactions.service.ts` | `toTask`; keep `task_id` on action item | 6 |
| `services/ops-web/src/components/crm/am/AmTimeline.tsx` | Tick → task + attach link | 6, 7 |
| `services/ops-web/src/lib/crm/am-timeline.util.ts` | Tick / attach copy | 6, 7 |
| `services/ops-web/src/components/crm/am/AmOnboarding.tsx` | Documents + activity (reuse interactions) | 4, 7 |
| `services/ptt-crm-api/src/am/am-scope.util.ts` | `me` includes active delegation | 10 |
| `services/ptt-crm-api/src/am/am-scope.util.spec.ts` | Delegation SQL fragment | 10 |
| `services/ptt-crm-api/src/am/am-dashboard.service.ts` | Coverage `delegated` = active delegations | 10 |
| `services/ptt-crm-api/src/am/am.controller.ts` | New routes | 3–13 |
| `services/ptt-crm-api/src/am/am.module.ts` | Register documents, delegations, health worker | 4, 8, 10 |
| `services/ops-web/src/components/crm/am/AmDashboard.tsx` | Lưu view (`page: 'dashboard'`) | 12 |
| `services/ops-web/src/components/crm/am/AmAccountsList.tsx` | Bulk tag + Export CSV | 13 |
| `services/ops-web/src/components/crm/am/AmSettings.tsx` | Delegation form | 10 |
| `services/ops-web/src/components/crm/am/AmShell.tsx` | Help button | 14 |
| `services/ops-web/src/app/crm/health/page.tsx` | Mount AM strip | 11 |

---

## Wave G1 — 360 placeholders (highest visible)

Do not start G2 until G1 tests are green.

### Task 1: 360 tab Công việc

**Files:**
- Modify: `services/ptt-crm-api/src/am/am-tasks.service.ts` (`AmTasksListQuery` ~51–58, `list()` ~388–463)
- Modify: `services/ptt-crm-api/src/am/am-tasks.service.spec.ts`
- Modify: `services/ops-web/src/lib/crm/am-api.ts` (`AmWorkQueueQuery` ~167–174)
- Create: `services/ops-web/src/components/crm/am/AmAccountWork.tsx`
- Modify: `services/ops-web/src/lib/crm/am-account-360.util.ts` (`work.implemented`)
- Modify: `services/ops-web/src/components/crm/am/AmAccount360.tsx` (~618–633)
- Test: `services/ops-web/src/lib/crm/am-account-360.util.spec.ts`

**Interfaces:**
- Consumes: `AmTasksService.list`, `fetchAmWorkQueue`, `AmHealthDetail` is **not** this task
- Produces: `AmTasksListQuery.agency_client_id?: string`; `AmWorkQueueQuery.agency_client_id?: string`; `AmAccountWork({ agencyClientId: string })`

- [ ] **Step 1: Write the failing API test**

Add to `am-tasks.service.spec.ts`:

```ts
it('filters the queue by agency_client_id when provided', async () => {
  const target = '19d722af-0000-4000-8000-000000000001';
  const other = '19d722af-0000-4000-8000-000000000002';
  repo.query.mockImplementation(async (sql: string, params?: unknown[]) => {
    const text = String(sql);
    if (/from crm_am_tasks/i.test(text) || /t\.agency_client_id/i.test(text)) {
      expect(text).toMatch(/t\.agency_client_id::text = \$\d+/);
      expect(params).toContain(target);
      expect(params).not.toContain(other);
      return { rows: [issueRow({ agency_client_id: target })], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  });
  const out = await service.list(viewReq, { agency_client_id: target, inbox: 'all' });
  expect(out.items).toHaveLength(1);
  expect(out.items[0].agency_client_id).toBe(target);
});
```

If `list()` currently ignores `inbox: 'all'` without `view_all`, keep the existing actor mock (`view` only) and use `inbox: 'me'` — the assertion that matters is the SQL filter on `agency_client_id`.

- [ ] **Step 2: Run test to verify it fails**

```bash
cd services/ptt-crm-api && npx jest --config jest.config.js src/am/am-tasks.service.spec.ts -t "filters the queue by agency_client_id"
```

Expected: FAIL — `AmTasksListQuery` has no `agency_client_id` and SQL does not contain `t.agency_client_id::text`.

- [ ] **Step 3: Implement the filter**

In `AmTasksListQuery` add `agency_client_id?: string`.

Inside `list()`, after priority filters:

```ts
const agencyClientId = String(q.agency_client_id ?? '').trim();
if (agencyClientId) {
  if (!isUuid(agencyClientId)) return { items: [], counts, work_hours: WORK_HOURS };
  params.push(agencyClientId);
  where.push(`t.agency_client_id::text = $${params.length}`);
}
```

`counts` is loaded later — compute `counts` first or return empty counts `{ me: null, team: null, unassigned: null }` on invalid UUID (same as other early returns in this file).

Extend `AmWorkQueueQuery`:

```ts
export type AmWorkQueueQuery = {
  inbox?: string;
  scope?: AmScope;
  sla?: string;
  kind?: string;
  status?: string;
  priority?: string;
  agency_client_id?: string;
};
```

`fetchAmWorkQueue` already forwards every truthy query key — no new fetcher.

Create `AmAccountWork.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { fetchAmWorkQueue, type AmWorkQueueItem } from '@/lib/crm/am-api';
import { amWorkDash } from '@/lib/crm/am-work-queue.util';
import { useAmPage } from './AmShell';

export function AmAccountWork({ agencyClientId }: { agencyClientId: string }) {
  const { token, scope } = useAmPage();
  const [items, setItems] = useState<AmWorkQueueItem[] | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setError('');
    try {
      const out = await fetchAmWorkQueue(token, {
        agency_client_id: agencyClientId,
        inbox: 'all',
        scope,
      });
      setItems(out.items);
    } catch {
      setItems(null);
      setError('Không tải được công việc.');
    }
  }, [token, agencyClientId, scope]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) {
    return (
      <div className="am-360__panel">
        <p className="am-muted">{error}</p>
        <button type="button" className="am-btn" onClick={() => void load()}>Retry</button>
      </div>
    );
  }
  if (!items) return <p className="am-muted">Đang tải…</p>;
  if (items.length === 0) return <p className="am-muted">—</p>;

  return (
    <div className="am-360__panel">
      <table className="am-table">
        <thead>
          <tr>
            <th>Việc</th>
            <th>Status</th>
            <th>Hạn</th>
          </tr>
        </thead>
        <tbody>
          {items.map((row) => (
            <tr key={row.id}>
              <td>
                <Link href={`/crm/account-management/work/${row.id}`}>{row.title}</Link>
              </td>
              <td>{row.status}</td>
              <td>{amWorkDash(row.due_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

In `AM_360_TABS` set `{ id: 'work', … implemented: true }`.

In `AmAccount360.tsx` add `tab === 'work' ? <AmAccountWork agencyClientId={agencyClientId} />`.

- [ ] **Step 4: Run tests**

```bash
cd services/ptt-crm-api && npx jest --config jest.config.js src/am/am-tasks.service.spec.ts
cd services/ops-web && npx vitest run src/lib/crm/am-account-360.util.spec.ts
```

Expected: API PASS. Vitest still expects only 6 implemented IDs — **leave that spec failing until Task 4** (do not weaken it now). If you must keep CI green per-task, temporarily keep the spec assertion as a growing list: after this task `implemented` includes `work`. Update the spec to include `'work'` only.

Update the spec implemented list to:

```ts
expect(implemented).toEqual([
  'overview', 'timeline', 'work', 'finance', 'opportunities', 'feedback', 'audit',
]);
```

Order must match `AM_360_TABS.filter(t => t.implemented)` — `work` sits between `timeline` and `finance` once `projects` is still false.

- [ ] **Step 5: Commit**

```bash
git add services/ptt-crm-api/src/am/am-tasks.service.ts \
  services/ptt-crm-api/src/am/am-tasks.service.spec.ts \
  services/ops-web/src/lib/crm/am-api.ts \
  services/ops-web/src/lib/crm/am-account-360.util.ts \
  services/ops-web/src/lib/crm/am-account-360.util.spec.ts \
  services/ops-web/src/components/crm/am/AmAccountWork.tsx \
  services/ops-web/src/components/crm/am/AmAccount360.tsx
git commit -m "$(cat <<'EOF'
feat(am): filter work queue by account on 360 tab

EOF
)"
```

---

### Task 2: 360 tab Health & Risk

**Files:**
- Modify: `services/ops-web/src/lib/crm/am-account-360.util.ts`
- Modify: `services/ops-web/src/components/crm/am/AmAccount360.tsx`
- Modify: `services/ops-web/src/lib/crm/am-account-360.util.spec.ts`
- Reuse: `services/ops-web/src/components/crm/am/AmHealthDetail.tsx` (already takes `{ agencyClientId: string }`)

**Interfaces:**
- Consumes: `AmHealthDetail`, `GET /api/crm/am/health/:agencyClientId`
- Produces: `health.implemented === true`

- [ ] **Step 1: Write the failing UI test**

In `am-account-360.util.spec.ts` add `'health'` to the implemented list in tab order (`… 'finance', 'health', 'opportunities' …`).

- [ ] **Step 2: Run test to verify it fails**

```bash
cd services/ops-web && npx vitest run src/lib/crm/am-account-360.util.spec.ts
```

Expected: FAIL — `health.implemented` is `false`.

- [ ] **Step 3: Flip the flag and embed**

Set `health.implemented = true`.

In `AmAccount360.tsx`:

```tsx
} else if (tab === 'health') {
  return <AmHealthDetail agencyClientId={agencyClientId} />;
}
```

Do not wrap in a second page `<h1>`. `AmHealthDetail` already has its own heading/actions.

- [ ] **Step 4: Run test to verify it passes**

```bash
cd services/ops-web && npx vitest run src/lib/crm/am-account-360.util.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/ops-web/src/lib/crm/am-account-360.util.ts \
  services/ops-web/src/lib/crm/am-account-360.util.spec.ts \
  services/ops-web/src/components/crm/am/AmAccount360.tsx
git commit -m "$(cat <<'EOF'
feat(am): embed health detail on account 360

EOF
)"
```

---

### Task 3: 360 tab Dự án & dịch vụ

**Files:**
- Modify: `services/ptt-crm-api/src/am/am-accounts.service.ts`
- Create: `services/ptt-crm-api/src/am/am-accounts-projects.spec.ts`
- Modify: `services/ptt-crm-api/src/am/am.controller.ts`
- Modify: `services/ops-web/src/lib/crm/am-api.ts`
- Create: `services/ops-web/src/components/crm/am/AmAccountProjects.tsx`
- Modify: `AmAccount360.tsx`, `am-account-360.util.ts` + spec

**Interfaces:**
- Consumes: `crm_contracts` join already used in accounts/contracts (`TRIM(COALESCE(ct.agency_client_id, '')) = e.agency_client_id::text`)
- Produces:

```ts
export type AmAccountProjectContract = {
  id: number;
  title: string;
  service_slug: string;
  status: string;
  starts_on: string | null;
  ends_on: string | null;
  href: string;
};

export type AmAccountDeliveryLink = {
  id: string;
  name: string;
  href: string;
};

export type AmAccountProjects = {
  contracts: AmAccountProjectContract[];
  delivery: AmAccountDeliveryLink[];
};
```

`href` for contracts = `/crm/account-management/contracts/{id}`.  
`href` for delivery = `/crm/delivery-projects/{id}` only when the row exists. If the `crm_delivery_projects` / `crm_b2b_projects` join cannot see a client key, return `delivery: []` — do not invent IDs.

- [ ] **Step 1: Write the failing API test**

```ts
// services/ptt-crm-api/src/am/am-accounts-projects.spec.ts
import { AmAccountsService } from './am-accounts.service';

const CLIENT_ID = '19d722af-0000-4000-8000-000000000001';

describe('AmAccountsService.projects', () => {
  it('lists contracts for the account and returns empty delivery when join misses', async () => {
    const db = {
      query: jest.fn(async (sql: string) => {
        const text = String(sql);
        if (/from crm_contracts/i.test(text)) {
          return {
            rows: [
              {
                id: 84,
                title: 'SEO 2026',
                service_slug: 'seo',
                status: 'active',
                starts_on: '2026-01-01',
                ends_on: '2026-12-31',
              },
            ],
            rowCount: 1,
          };
        }
        if (/crm_delivery_projects/i.test(text)) {
          return { rows: [], rowCount: 0 };
        }
        return { rows: [], rowCount: 0 };
      }),
    };
    const svc = new AmAccountsService(/* pass the same constructor tokens as am-accounts.service.spec.ts */);
    const out = await svc.projects(viewReq, CLIENT_ID);
    expect(out.contracts).toHaveLength(1);
    expect(out.contracts[0].href).toBe('/crm/account-management/contracts/84');
    expect(out.delivery).toEqual([]);
  });
});
```

Copy the constructor/mock style from `am-accounts-360.spec.ts` — do not invent a new DI pattern. If `projects` is easier as a thin function `listAccountProjects(query, agencyClientId)` exported from the same file, test that function instead of constructing the whole service.

Preferred (smaller surface) — extract a pure mapper + SQL helper:

```ts
export function mapAccountProjectContract(row: Record<string, unknown>): AmAccountProjectContract {
  const id = Number(row.id);
  return {
    id,
    title: String(row.title ?? ''),
    service_slug: String(row.service_slug ?? ''),
    status: String(row.status ?? ''),
    starts_on: row.starts_on ? String(row.starts_on).slice(0, 10) : null,
    ends_on: row.ends_on ? String(row.ends_on).slice(0, 10) : null,
    href: `/crm/account-management/contracts/${id}`,
  };
}
```

Test `mapAccountProjectContract` if wiring the full service in this file is too heavy — but still add one `projects()` integration-style mock test that asserts `FROM crm_contracts` and **no INSERT**.

- [ ] **Step 2: Run test to verify it fails**

```bash
cd services/ptt-crm-api && npx jest --config jest.config.js src/am/am-accounts-projects.spec.ts
```

Expected: FAIL — `projects` is not a function.

- [ ] **Step 3: Implement**

Add `GET /accounts/:agencyClientId/projects` on `am.controller.ts` with `@RequireAmAction('view')`. Reuse the same scope check as `GET /accounts/:id` (404 if out of scope).

SQL for contracts (read-only):

```sql
SELECT ct.id, ct.title, ct.service_slug, ct.status, ct.starts_on, ct.ends_on
  FROM crm_contracts ct
 WHERE TRIM(COALESCE(ct.agency_client_id, '')) = $1
 ORDER BY ct.ends_on NULLS LAST, ct.id
```

Delivery probe (safe):

```sql
SELECT d.id::text AS id, COALESCE(d.name, d.code, d.id::text) AS name
  FROM crm_delivery_projects d
  JOIN crm_b2b_projects b ON b.id = d.b2b_project_id
 WHERE b.agency_client_id::text = $1 OR b.client_id::text = $1
```

Wrap delivery query in `try/catch` for `42P01` / missing column → `delivery: []`.

UI `AmAccountProjects`: two tables. Empty → `—`. Deep-link contract + delivery. No create button.

Flip `projects.implemented = true`. Wire tab in `AmAccount360`.

- [ ] **Step 4: Run tests**

```bash
cd services/ptt-crm-api && npx jest --config jest.config.js src/am/am-accounts-projects.spec.ts
cd services/ops-web && npx vitest run src/lib/crm/am-account-360.util.spec.ts
```

Expected: PASS. Update implemented list to include `'projects'` before `'work'`.

- [ ] **Step 5: Commit**

```bash
git add services/ptt-crm-api/src/am/am-accounts.service.ts \
  services/ptt-crm-api/src/am/am-accounts-projects.spec.ts \
  services/ptt-crm-api/src/am/am.controller.ts \
  services/ops-web/src/lib/crm/am-api.ts \
  services/ops-web/src/lib/crm/am-account-360.util.ts \
  services/ops-web/src/lib/crm/am-account-360.util.spec.ts \
  services/ops-web/src/components/crm/am/AmAccountProjects.tsx \
  services/ops-web/src/components/crm/am/AmAccount360.tsx
git commit -m "$(cat <<'EOF'
feat(am): list contracts and delivery links on 360 projects tab

EOF
)"
```

---

### Task 4: Documents (360 + onboarding + contract)

**Files:**
- Create: `docs/specs/2026-09-05-postgresql-ddl-am-g1.sql`
- Create: `scripts/apply_pg_ddl_am_g1.sh` (copy `scripts/apply_pg_ddl_am_w4.sh` structure)
- Create: `services/ptt-crm-api/src/am/am-documents.service.ts`
- Create: `services/ptt-crm-api/src/am/am-documents.service.spec.ts`
- Modify: `am.controller.ts`, `am.module.ts`
- Modify: `am-contracts.service.ts` — `documents` is no longer `[]` typed as empty; load via documents service
- Modify: `am-onboarding.service.ts` — `documents` currently `[]`; fill from same table by `onboarding_case_id`
- Create: `services/ops-web/src/components/crm/am/AmDocumentsPanel.tsx`
- Modify: `AmAccount360.tsx`, `AmOnboarding.tsx`, `AmContractDetail.tsx`
- Modify: `am-account-360.util.ts` + spec — `documents.implemented = true`; implemented IDs become all 10

**Interfaces:**
- Consumes: `resolveAmScope` + `amScopeSql` (same as interactions)
- Produces:

```ts
export type AmDocument = {
  id: string;
  agency_client_id: string;
  contract_id: number | null;
  onboarding_case_id: string | null;
  interaction_id: string | null;
  title: string;
  kind: 'link';
  href: string;
  created_by_staff_id: number | null;
  created_at: string;
};

export type AmCreateDocumentInput = {
  agency_client_id: string;
  title?: string;
  href?: string;
  contract_id?: number;
  onboarding_case_id?: string;
  interaction_id?: string;
};
```

Routes:
- `GET /documents?agency_client_id=&contract_id=&onboarding_case_id=` — `view`
- `POST /documents` — `edit`

DDL (`docs/specs/2026-09-05-postgresql-ddl-am-g1.sql`) — include **both** G1 documents and G3 delegations now so apply is once:

```sql
CREATE TABLE IF NOT EXISTS crm_am_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  agency_client_id UUID NOT NULL,
  contract_id BIGINT,
  onboarding_case_id UUID,
  interaction_id UUID,
  title TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'link',
  href TEXT NOT NULL,
  created_by_staff_id INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT crm_am_documents_kind_chk CHECK (kind IN ('link'))
);

CREATE INDEX IF NOT EXISTS crm_am_documents_account_idx
  ON crm_am_documents (tenant_id, agency_client_id);

CREATE TABLE IF NOT EXISTS crm_am_delegations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  from_staff_id INTEGER NOT NULL,
  to_staff_id INTEGER NOT NULL,
  starts_on DATE NOT NULL,
  ends_on DATE NOT NULL,
  reason TEXT,
  created_by_staff_id INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT crm_am_delegations_range_chk CHECK (ends_on >= starts_on),
  CONSTRAINT crm_am_delegations_self_chk CHECK (from_staff_id <> to_staff_id)
);

CREATE INDEX IF NOT EXISTS crm_am_delegations_to_idx
  ON crm_am_delegations (tenant_id, to_staff_id, starts_on, ends_on);
CREATE INDEX IF NOT EXISTS crm_am_delegations_from_idx
  ON crm_am_delegations (tenant_id, from_staff_id, starts_on, ends_on);
```

Do **not** write a service for delegations in this task — table only.

- [ ] **Step 1: Write the failing documents test**

```ts
import { AmDocumentsService } from './am-documents.service';

const CLIENT_ID = '19d722af-0000-4000-8000-000000000001';

describe('AmDocumentsService', () => {
  const db = { query: jest.fn() };
  const staffAuth = {
    resolveCrmStaffUserId: jest.fn(async () => 7),
    me: jest.fn(async () => ({ caps: [{ section: 'crm_am', action: 'edit' }] })),
    hasCap: jest.fn(() => true),
  };

  it('rejects non-http(s) and non-root-relative href', async () => {
    const svc = new AmDocumentsService(db as never, staffAuth as never);
    await expect(
      svc.create({ agency_client_id: CLIENT_ID, title: 'X', href: 'javascript:alert(1)' }, 7),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('inserts a link scoped to the account', async () => {
    db.query.mockResolvedValue({
      rows: [{
        id: '19d722af-0000-4000-8000-0000000000aa',
        agency_client_id: CLIENT_ID,
        contract_id: null,
        onboarding_case_id: null,
        interaction_id: null,
        title: 'Kickoff',
        kind: 'link',
        href: 'https://docs.ptt.example/kickoff',
        created_by_staff_id: 7,
        created_at: '2026-09-05T00:00:00.000Z',
      }],
      rowCount: 1,
    });
    const svc = new AmDocumentsService(db as never, staffAuth as never);
    const row = await svc.create(
      { agency_client_id: CLIENT_ID, title: 'Kickoff', href: 'https://docs.ptt.example/kickoff' },
      7,
    );
    expect(row.kind).toBe('link');
    expect(String(db.query.mock.calls[0][0])).toMatch(/insert into crm_am_documents/i);
  });
});
```

Also add a static DDL test in `apply_pg_ddl_am_g1.sh` (same `grep CREATE TABLE` pattern as W4).

- [ ] **Step 2: Run test to verify it fails**

```bash
cd services/ptt-crm-api && npx jest --config jest.config.js src/am/am-documents.service.spec.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`href` allow-list:

```ts
export function isSafeAmDocumentHref(raw: string): boolean {
  const href = raw.trim();
  if (href.startsWith('/') && !href.startsWith('//')) return href.length > 1;
  try {
    const u = new URL(href);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}
```

Title required (trim, 1–200 chars). Missing table (`42P01`) → list returns `{ items: [] }`; create throws 503 `{ error: 'documents_table_missing' }`.

`AmDocumentsPanel` props:

```ts
{
  agencyClientId: string;
  contractId?: number;
  onboardingCaseId?: string;
  canEdit: boolean;
}
```

Add-link form: title + URL. Empty list → `—`.

360 tab `documents` → panel. Onboarding tabs `documents` → same panel with `onboardingCaseId`. Contract tab `documents` → panel with `contractId`. Replace `AmPlaceholder` payments is **Task 5**, not this task.

Flip `documents.implemented = true`. Spec implemented IDs = all ten in `AM_360_TABS` order:

```ts
expect(AM_360_TABS.filter((t) => t.implemented).map((t) => t.id)).toEqual(
  AM_360_TABS.map((t) => t.id),
);
```

- [ ] **Step 4: Run tests + DDL static verify**

```bash
bash scripts/apply_pg_ddl_am_g1.sh   # OK static verify when DATABASE_URL unset
cd services/ptt-crm-api && npx jest --config jest.config.js src/am/am-documents.service.spec.ts
cd services/ops-web && npx vitest run src/lib/crm/am-account-360.util.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add docs/specs/2026-09-05-postgresql-ddl-am-g1.sql \
  scripts/apply_pg_ddl_am_g1.sh \
  services/ptt-crm-api/src/am/am-documents.service.ts \
  services/ptt-crm-api/src/am/am-documents.service.spec.ts \
  services/ptt-crm-api/src/am/am.controller.ts \
  services/ptt-crm-api/src/am/am.module.ts \
  services/ptt-crm-api/src/am/am-contracts.service.ts \
  services/ptt-crm-api/src/am/am-onboarding.service.ts \
  services/ops-web/src/lib/crm/am-api.ts \
  services/ops-web/src/lib/crm/am-account-360.util.ts \
  services/ops-web/src/lib/crm/am-account-360.util.spec.ts \
  services/ops-web/src/components/crm/am/AmDocumentsPanel.tsx \
  services/ops-web/src/components/crm/am/AmAccount360.tsx \
  services/ops-web/src/components/crm/am/AmOnboarding.tsx \
  services/ops-web/src/components/crm/am/AmContractDetail.tsx
git commit -m "$(cat <<'EOF'
feat(am): add document link catalog for 360, onboarding, and contracts

EOF
)"
```

---

## Wave G2 — Contract payments + timeline actions

### Task 5: Lịch thanh toán derived (read-only)

**Files:**
- Create: `services/ptt-crm-api/src/am/am-payment-schedule.util.ts`
- Create: `services/ptt-crm-api/src/am/am-payment-schedule.util.spec.ts`
- Modify: `services/ptt-crm-api/src/am/am-contracts.service.ts` (`AmContractDetail.payment_schedule`)
- Modify: `services/ptt-crm-api/src/am/am-contracts.service.spec.ts`
- Create: `services/ops-web/src/lib/crm/am-payment-schedule.util.ts`
- Create: `services/ops-web/src/lib/crm/am-payment-schedule.util.spec.ts`
- Modify: `services/ops-web/src/components/crm/am/AmContractDetail.tsx` (replace payments `AmPlaceholder`)
- Modify: `services/ops-web/src/lib/crm/am-api.ts` (`payment_schedule` type)

**Interfaces:**
- Consumes: `monthlyRecurringVnd` from `am-money.util.ts`; contract row fields `billing_type`, `amount_vnd`, `starts_on`, `ends_on`, `signed_on`
- Produces:

```ts
export type AmPaymentRow = {
  due_on: string;
  amount_vnd: number | null;
  status: 'upcoming' | 'overdue';
  source: 'derived';
};

export function derivePaymentSchedule(input: {
  billing_type: string;
  amount_vnd: number | null;
  starts_on: string | null;
  ends_on: string | null;
  signed_on: string | null;
  as_of: string;
}): AmPaymentRow[]
```

Rules:
- Missing `starts_on` and `signed_on` → `[]`.
- `billing_type` in `media | media_spend | project | one_off` (same set as `monthlyRecurringVnd` null) → **one** row, `due_on = starts_on ?? signed_on`, `amount_vnd = amount_vnd` (may be hidden later).
- Else recurring → one row per calendar month from `starts_on` through `ends_on` inclusive, amount = `monthlyRecurringVnd(...)`. If `ends_on` is null, emit **one** row on `starts_on` only (do not invent a 12-month year).
- Hard cap **36** rows. If more months exist, return first 36 and the API adds `payment_schedule_truncated: true` on detail (UI shows muted “Chỉ hiện 36 kỳ đầu”).
- `status = due_on < as_of ? 'overdue' : 'upcoming'`. Never `'paid'`.
- Amounts already gated by `hide_amounts` on contract detail — reuse that. UI uses existing `amContractAmountDisplay`.

- [ ] **Step 1: Write the failing util test**

```ts
import { derivePaymentSchedule } from './am-payment-schedule.util';

describe('derivePaymentSchedule', () => {
  it('returns empty when no start or signed date', () => {
    expect(
      derivePaymentSchedule({
        billing_type: 'retainer',
        amount_vnd: 12_000_000,
        starts_on: null,
        ends_on: null,
        signed_on: null,
        as_of: '2026-09-05',
      }),
    ).toEqual([]);
  });

  it('emits one row for one_off and never marks paid', () => {
    const rows = derivePaymentSchedule({
      billing_type: 'one_off',
      amount_vnd: 50_000_000,
      starts_on: '2026-08-01',
      ends_on: null,
      signed_on: '2026-07-15',
      as_of: '2026-09-05',
    });
    expect(rows).toEqual([
      { due_on: '2026-08-01', amount_vnd: 50_000_000, status: 'overdue', source: 'derived' },
    ]);
    expect(rows[0]).not.toHaveProperty('paid');
  });

  it('caps recurring months at 36', () => {
    const rows = derivePaymentSchedule({
      billing_type: 'retainer',
      amount_vnd: 12_000_000,
      starts_on: '2024-01-01',
      ends_on: '2028-12-01',
      signed_on: null,
      as_of: '2026-09-05',
    });
    expect(rows.length).toBe(36);
  });
});
```

Use the real `monthlyRecurringVnd` result for retainer amount — if the util returns null for the fixture `billing_type`, pick a `billing_type` that **does** produce MRR in `am-money.util.ts` (read that file; do not guess `retainer` if it is treated as project). If retainer is not MRR, use the slug the money util already treats as recurring (e.g. `monthly` / `seo` — copy the exact branch).

- [ ] **Step 2: Run test to verify it fails**

```bash
cd services/ptt-crm-api && npx jest --config jest.config.js src/am/am-payment-schedule.util.spec.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement util + wire detail + UI**

In `am-contracts.service.ts` change

```ts
payment_schedule: [];
```

to `payment_schedule: AmPaymentRow[]` and fill with `derivePaymentSchedule(...)`. `as_of` = ICT today (same helper already in this file).

Replace in `AmContractDetail.tsx`:

```tsx
{tab === 'payments' ? <PaymentsPanel data={data} /> : null}
```

`PaymentsPanel`: table Ngày / Số tiền / Trạng thái. Empty → `—`. No “Đánh dấu đã thu”. Amendments tab stays `—` with copy `SoR hợp đồng chưa có phụ lục.`

Frontend util only maps status → copy (`Sắp tới` / `Quá hạn`).

- [ ] **Step 4: Run tests**

```bash
cd services/ptt-crm-api && npx jest --config jest.config.js src/am/am-payment-schedule.util.spec.ts src/am/am-contracts.service.spec.ts
cd services/ops-web && npx vitest run src/lib/crm/am-payment-schedule.util.spec.ts src/lib/crm/am-contract.util.spec.ts
```

Expected: PASS. Existing contract spec that expects `payment_schedule: []` must be updated to the derived fixture — do not delete the spec.

- [ ] **Step 5: Commit**

```bash
git add services/ptt-crm-api/src/am/am-payment-schedule.util.ts \
  services/ptt-crm-api/src/am/am-payment-schedule.util.spec.ts \
  services/ptt-crm-api/src/am/am-contracts.service.ts \
  services/ptt-crm-api/src/am/am-contracts.service.spec.ts \
  services/ops-web/src/lib/crm/am-payment-schedule.util.ts \
  services/ops-web/src/lib/crm/am-payment-schedule.util.spec.ts \
  services/ops-web/src/lib/crm/am-api.ts \
  services/ops-web/src/components/crm/am/AmContractDetail.tsx
git commit -m "$(cat <<'EOF'
feat(am): derive read-only contract payment schedule

EOF
)"
```

---

### Task 6: Tick action item → AM task

**Files:**
- Modify: `services/ptt-crm-api/src/am/am-interactions.service.ts`
- Modify: `services/ptt-crm-api/src/am/am-interactions.service.spec.ts`
- Modify: `services/ptt-crm-api/src/am/am.controller.ts`
- Modify: `services/ops-web/src/lib/crm/am-timeline.util.ts` + spec
- Modify: `services/ops-web/src/components/crm/am/AmTimeline.tsx`
- Modify: `services/ops-web/src/lib/crm/am-api.ts`

**Interfaces:**
- Consumes: `AmTasksService.create`, unique index `crm_am_tasks_source_ref_uq`
- Produces:

```ts
export type AmInteractionActionItem = {
  title: string;
  done?: boolean;
  due_at?: string;
  task_id?: string;
};

export type AmActionItemToTaskResult = {
  task_id: string;
  created: boolean;
  action_items: AmInteractionActionItem[];
};
```

Route: `POST /interactions/:id/action-items/:index/to-task` — `edit`.

`source = 'interaction'`, `source_ref = `${interactionId}:${index}``. If an open task already exists for that `source_ref`, return `{ created: false, task_id }` and still set `task_id` + `done: true` on the JSON item. Never create a second task.

- [ ] **Step 1: Write the failing API test**

```ts
it('creates one AM task from an action item and is idempotent', async () => {
  const interactionId = '19d722af-0000-4000-8000-0000000000aa';
  // mock find interaction with action_items [{ title: 'Gửi QBR' }]
  // first create() returns task id cc
  const first = await service.toTask(editReq, interactionId, 0);
  expect(first.created).toBe(true);
  expect(first.action_items[0].task_id).toBeTruthy();
  const second = await service.toTask(editReq, interactionId, 0);
  expect(second.created).toBe(false);
  expect(second.task_id).toBe(first.task_id);
});

it('returns 400 for out-of-range index', async () => {
  await expect(service.toTask(editReq, interactionId, 9)).rejects.toMatchObject({
    status: 400,
  });
});
```

Follow the existing constructor in `am-interactions.service.spec.ts` (inject `AmTasksService` mock).

- [ ] **Step 2: Run test to verify it fails**

```bash
cd services/ptt-crm-api && npx jest --config jest.config.js src/am/am-interactions.service.spec.ts -t "creates one AM task from an action item"
```

Expected: FAIL — `toTask` is not a function.

- [ ] **Step 3: Implement**

`toTask`:
1. Load interaction (scope 404).
2. Parse index as integer `>= 0`.
3. If missing item → 400 `{ error: 'action_item_not_found' }`.
4. `tasks.create({ agency_client_id, title: item.title, kind: 'task', due_at: item.due_at, source: 'interaction', source_ref })`.
5. Patch `action_items_json` with `done: true`, `task_id`.
6. Audit `interaction.action_item_to_task`.

UI: checkbox on each action item. Disabled when `task_id` is set (show link to `/crm/account-management/work/{task_id}`). `amTimelineErrorCopy` adds `action_item_not_found` → `Không thấy action item`.

- [ ] **Step 4: Run tests**

```bash
cd services/ptt-crm-api && npx jest --config jest.config.js src/am/am-interactions.service.spec.ts
cd services/ops-web && npx vitest run src/lib/crm/am-timeline.util.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/ptt-crm-api/src/am/am-interactions.service.ts \
  services/ptt-crm-api/src/am/am-interactions.service.spec.ts \
  services/ptt-crm-api/src/am/am.controller.ts \
  services/ops-web/src/lib/crm/am-timeline.util.ts \
  services/ops-web/src/lib/crm/am-timeline.util.spec.ts \
  services/ops-web/src/lib/crm/am-api.ts \
  services/ops-web/src/components/crm/am/AmTimeline.tsx
git commit -m "$(cat <<'EOF'
feat(am): turn timeline action items into tasks once

EOF
)"
```

---

### Task 7: Timeline + onboarding activity attachments

**Files:**
- Modify: `AmTimeline.tsx` composer — optional title+href that `POST /documents` with `interaction_id` after the interaction is created
- Modify: `AmOnboarding.tsx` activity tab — `GET /interactions?agency_client_id=` (already exists). Empty → `—`
- Modify: `am-timeline.util.ts` + spec for attach validation (reuse `isSafeAmDocumentHref` via a shared copy in `services/ops-web/src/lib/crm/am-document-href.ts` **or** duplicate the 8-line helper — do not import Nest code into ops-web)

**Interfaces:**
- Consumes: Task 4 `POST /documents`, `GET /interactions`
- Produces: composer field `attachment_href?: string`; activity list on onboarding

- [ ] **Step 1: Write the failing util test**

```ts
import { amTimelineAttachError } from './am-timeline.util';

it('rejects javascript href on composer attach', () => {
  expect(amTimelineAttachError({ href: 'javascript:alert(1)', title: 'x' })).toMatch(/http/i);
});

it('allows empty attach (optional)', () => {
  expect(amTimelineAttachError({ href: '', title: '' })).toBe('');
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd services/ops-web && npx vitest run src/lib/crm/am-timeline.util.spec.ts
```

Expected: FAIL — `amTimelineAttachError` is not exported.

- [ ] **Step 3: Implement**

```ts
export function amTimelineAttachError(input: { href?: string; title?: string }): string {
  const href = String(input.href ?? '').trim();
  const title = String(input.title ?? '').trim();
  if (!href && !title) return '';
  if (!title) return 'Cần tiêu đề tài liệu';
  if (!isSafeAmDocumentHref(href)) return 'Link phải là http(s) hoặc đường dẫn /';
  return '';
}
```

After `POST /interactions` succeeds, if href present, `POST /documents` with that `interaction_id`. Failure on attach must **not** roll back the interaction — toast info `Đã ghi tương tác — không lưu được link`.

Onboarding `activity` tab: reuse a slim list of interactions (kind, occurred_at, summary). No second activity SoR.

- [ ] **Step 4: Run tests**

```bash
cd services/ops-web && npx vitest run src/lib/crm/am-timeline.util.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/ops-web/src/lib/crm/am-timeline.util.ts \
  services/ops-web/src/lib/crm/am-timeline.util.spec.ts \
  services/ops-web/src/lib/crm/am-document-href.ts \
  services/ops-web/src/lib/crm/am-api.ts \
  services/ops-web/src/components/crm/am/AmTimeline.tsx \
  services/ops-web/src/components/crm/am/AmOnboarding.tsx
git commit -m "$(cat <<'EOF'
feat(am): attach document links on timeline and show onboarding activity

EOF
)"
```

---

## Wave G3 — Jobs + ủy quyền + CS Health strip

### Task 8: Nightly health worker + systemd timer

**Files:**
- Create: `services/ptt-crm-api/src/am/am-health.worker.ts`
- Create: `services/ptt-crm-api/src/am/am-health.worker.spec.ts`
- Create: `scripts/run_am_job.ts`
- Create: `deploy/systemd/ptt-crm-am-health.service`
- Create: `deploy/systemd/ptt-crm-am-health.timer`
- Modify: `am.module.ts` — provide `AmHealthWorker`

**Interfaces:**
- Consumes: `AmHealthService.recompute({ asOf?, actorStaffId?: number })`
- Produces:

```ts
export class AmHealthWorker {
  constructor(private readonly health: AmHealthService) {}
  run(opts?: { asOf?: string }): Promise<AmHealthRecomputeResult> {
    return this.health.recompute({ asOf: opts?.asOf });
  }
}
```

`scripts/run_am_job.ts`:

```ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { AmHealthWorker } from '../src/am/am-health.worker';
import { AmRenewalWorker } from '../src/am/am-renewal.worker';

async function main() {
  const cmd = process.argv[2];
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  try {
    if (cmd === 'health') {
      const out = await app.get(AmHealthWorker).run();
      process.stdout.write(JSON.stringify(out) + '\n');
      return;
    }
    if (cmd === 'renewal') {
      const out = await app.get(AmRenewalWorker).run();
      process.stdout.write(JSON.stringify(out) + '\n');
      return;
    }
    process.stderr.write('usage: run_am_job.ts health|renewal\n');
    process.exitCode = 2;
  } finally {
    await app.close();
  }
}

void main();
```

If `AppModule` path or ts-node style in this repo differs, follow **existing** nest scripts under `services/ptt-crm-api` (do not add ts-node as a new dependency). Prefer compiling with the existing nest build and running `node dist/scripts/run_am_job.js` from the API working directory already used by `ptt-crm-api.service`.

systemd **oneshot** (paths must match the live unit — read `/etc/systemd/system/ptt-crm-api.service` on VPS before installing; default WorkingDirectory is the API release dir):

```ini
# deploy/systemd/ptt-crm-am-health.service
[Unit]
Description=RNOSAI AM health recompute
After=ptt-crm-api.service

[Service]
Type=oneshot
WorkingDirectory=/var/www/rnosai/services/ptt-crm-api
EnvironmentFile=-/var/www/rnosai/services/ptt-crm-api/.env
ExecStart=/usr/bin/node dist/scripts/run_am_job.js health
User=www-data
```

```ini
# deploy/systemd/ptt-crm-am-health.timer
[Unit]
Description=AM health at 02:00 ICT

[Timer]
OnCalendar=*-*-* 19:00:00
Persistent=true
Unit=ptt-crm-am-health.service

[Install]
WantedBy=timers.target
```

`OnCalendar=*-*-* 19:00:00` is **02:00 ICT** when the host clock is UTC. If the VPS timezone is already `Asia/Ho_Chi_Minh`, use `OnCalendar=*-*-* 02:00:00` instead. The install notes in the unit comment must say: detect `timedatectl` and pick one. Do not enable both.

Do **not** add `@nestjs/schedule`. Do not set `AM_AI_ENABLED`.

- [ ] **Step 1: Write the failing worker test**

```ts
import { AmHealthWorker } from './am-health.worker';

it('delegates to health.recompute', async () => {
  const health = { recompute: jest.fn(async () => ({ as_of: '2026-09-05', computed: 2, skipped: 0, dist: {} })) };
  const worker = new AmHealthWorker(health as never);
  const out = await worker.run({ asOf: '2026-09-05' });
  expect(health.recompute).toHaveBeenCalledWith({ asOf: '2026-09-05' });
  expect(out.computed).toBe(2);
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd services/ptt-crm-api && npx jest --config jest.config.js src/am/am-health.worker.spec.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement worker + CLI + unit files**

Register `AmHealthWorker` in `am.module.ts` providers/exports.

- [ ] **Step 4: Run tests**

```bash
cd services/ptt-crm-api && npx jest --config jest.config.js src/am/am-health.worker.spec.ts src/am/am-health.service.spec.ts
```

Expected: PASS. Do not enable the timer on VPS in this task unless the user asks to deploy.

- [ ] **Step 5: Commit**

```bash
git add services/ptt-crm-api/src/am/am-health.worker.ts \
  services/ptt-crm-api/src/am/am-health.worker.spec.ts \
  services/ptt-crm-api/src/am/am.module.ts \
  scripts/run_am_job.ts \
  deploy/systemd/ptt-crm-am-health.service \
  deploy/systemd/ptt-crm-am-health.timer
git commit -m "$(cat <<'EOF'
feat(am): add nightly health recompute worker

EOF
)"
```

---

### Task 9: Renewal window-job systemd timer

**Files:**
- Create: `deploy/systemd/ptt-crm-am-renewal.service`
- Create: `deploy/systemd/ptt-crm-am-renewal.timer`
- Reuse: `scripts/run_am_job.ts` `renewal` branch from Task 8
- Test: `services/ptt-crm-api/src/am/am-renewal.worker.spec.ts` (already exists — do not rewrite)

**Interfaces:**
- Consumes: `AmRenewalWorker.run`
- Produces: timer at 06:00 ICT (after health 02:00). Same timezone rule as Task 8.

```ini
# ptt-crm-am-renewal.service — ExecStart=... run_am_job.js renewal
# ptt-crm-am-renewal.timer — OnCalendar 23:00 UTC (= 06:00 ICT) or 06:00 if host is ICT
```

- [ ] **Step 1: Write a failing file-presence test**

Add `scripts/check_am_job_units.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
for f in deploy/systemd/ptt-crm-am-renewal.service deploy/systemd/ptt-crm-am-renewal.timer; do
  test -f "$root/$f" || { echo "MISSING $f" >&2; exit 1; }
done
grep -q 'run_am_job.js renewal' "$root/deploy/systemd/ptt-crm-am-renewal.service"
echo OK
```

- [ ] **Step 2: Run to verify it fails**

```bash
bash scripts/check_am_job_units.sh
```

Expected: FAIL — files missing.

- [ ] **Step 3: Add the unit files**

Copy Task 8 service, change description + `ExecStart` argument to `renewal`. Re-run existing:

```bash
cd services/ptt-crm-api && npx jest --config jest.config.js src/am/am-renewal.worker.spec.ts
```

- [ ] **Step 4: Run the presence check**

```bash
bash scripts/check_am_job_units.sh
```

Expected: `OK`.

- [ ] **Step 5: Commit**

```bash
git add deploy/systemd/ptt-crm-am-renewal.service \
  deploy/systemd/ptt-crm-am-renewal.timer \
  scripts/check_am_job_units.sh
git commit -m "$(cat <<'EOF'
chore(am): add systemd timer for renewal window job

EOF
)"
```

---

### Task 10: Ủy quyền (delegations)

**Files:**
- DDL already in Task 4 `crm_am_delegations`
- Modify: `services/ptt-crm-api/src/am/am-scope.util.ts` + spec
- Create: `services/ptt-crm-api/src/am/am-delegations.service.ts` + spec
- Modify: `am-accounts.service.ts` — fill `delegated_until` from active delegation (`MAX(ends_on)` where `from_staff_id = account_owner_staff_id`)
- Modify: `am-dashboard.service.ts` — `coverage.delegated` = count of **active-book** accounts whose owner has an active outbound delegation (not `backup_staff_id != null`)
- Modify: `am-dashboard.service.spec.ts` — update the delegated fixture
- Modify: `am.controller.ts` — `GET/POST /delegations`
- Create: `services/ops-web/src/lib/crm/am-delegation.util.ts` + spec
- Modify: `AmSettings.tsx` — form “Ủy quyền khi nghỉ”
- Modify: `AmAccountsList.tsx` — owner cell already has `delegated_until`; show `ủy quyền đến {ngày}` when non-null

**Interfaces:**
- Consumes: `amScopeSql` `me` fragment
- Produces:

```ts
export type AmDelegation = {
  id: string;
  from_staff_id: number;
  to_staff_id: number;
  starts_on: string;
  ends_on: string;
  reason: string | null;
};

export type AmCreateDelegationInput = {
  from_staff_id?: number;
  to_staff_id: number;
  starts_on: string;
  ends_on: string;
  reason?: string;
};
```

Scope `me` SQL **replace** the current fragment with:

```ts
sql: `(e.account_owner_staff_id = $staff
   OR EXISTS (
        SELECT 1 FROM crm_am_tasks t
         WHERE t.agency_client_id = e.agency_client_id
           AND t.assignee_staff_id = $staff
           AND t.status NOT IN ('closed','cancelled')
      )
   OR EXISTS (
        SELECT 1 FROM crm_am_delegations d
         WHERE d.tenant_id = e.tenant_id
           AND d.to_staff_id = $staff
           AND d.from_staff_id = e.account_owner_staff_id
           AND CURRENT_DATE BETWEEN d.starts_on AND d.ends_on
      ))`,
params: [opts.staffId],
```

If `crm_am_delegations` is missing (`42P01`), callers already swallow missing relations in several services — keep `amScopeSql` as SQL only; the `EXISTS` on a missing table will fail. Apply G1 DDL **before** deploying this task.

Caps:
- `edit`: create where `from_staff_id === actor` (default).
- `manage`: may set `from_staff_id` to another staff.
- `to_staff_id` must be a real `crm_staff.id` (reuse `requireCrmStaffId` pattern from accounts transfer).
- `ends_on >= starts_on`. Reject `from === to` with `400 { error: 'delegation_self' }`.

Dashboard `me` for the **delegate** already uses `amScopeSql` — after this change, command-center `me` includes delegated accounts. List owner label: `ủy quyền đến {YYYY-MM-DD}` when `delegated_until` is set.

- [ ] **Step 1: Write failing scope + service tests**

```ts
// am-scope.util.spec.ts
it('includes active delegations in me scope', () => {
  const { sql } = amScopeSql({ scope: 'me', staffId: 3, teamIds: [] });
  expect(sql).toMatch(/crm_am_delegations/);
  expect(sql).toMatch(/d\.to_staff_id = \$staff/);
});
```

```ts
// am-delegations.service.spec.ts
it('rejects self-delegation', async () => {
  await expect(
    service.create({ to_staff_id: 7, starts_on: '2026-09-05', ends_on: '2026-09-10' }, 7),
  ).rejects.toMatchObject({ response: { error: 'delegation_self' } });
});
```

Match the actual `amThrow` shape used in this module (`{ error: 'delegation_self' }`).

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd services/ptt-crm-api && npx jest --config jest.config.js src/am/am-scope.util.spec.ts src/am/am-delegations.service.spec.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement**

Settings UI: from (readonly me unless manage), to (staff roster already loaded in settings/list), starts_on, ends_on, reason. List active delegations. No delete in this task — add `POST /delegations/:id/cancel` (`edit` own / `manage` any) that sets `ends_on = CURRENT_DATE - 1` only if `ends_on >= CURRENT_DATE` (so the row remains for audit). If you implement cancel, test it. If you skip cancel, the form copy must say “Hết hạn theo ngày kết thúc — không xóa.”

Do not change `backup_staff_id` semantics.

- [ ] **Step 4: Run tests**

```bash
cd services/ptt-crm-api && npx jest --config jest.config.js \
  src/am/am-scope.util.spec.ts \
  src/am/am-delegations.service.spec.ts \
  src/am/am-dashboard.service.spec.ts \
  src/am/am-accounts-list.spec.ts
cd services/ops-web && npx vitest run src/lib/crm/am-delegation.util.spec.ts
```

Expected: PASS. Fix any dashboard test that counted `backup_staff_id` as delegated.

- [ ] **Step 5: Commit**

```bash
git add services/ptt-crm-api/src/am/am-scope.util.ts \
  services/ptt-crm-api/src/am/am-scope.util.spec.ts \
  services/ptt-crm-api/src/am/am-delegations.service.ts \
  services/ptt-crm-api/src/am/am-delegations.service.spec.ts \
  services/ptt-crm-api/src/am/am-accounts.service.ts \
  services/ptt-crm-api/src/am/am-dashboard.service.ts \
  services/ptt-crm-api/src/am/am-dashboard.service.spec.ts \
  services/ptt-crm-api/src/am/am.controller.ts \
  services/ptt-crm-api/src/am/am.module.ts \
  services/ops-web/src/lib/crm/am-delegation.util.ts \
  services/ops-web/src/lib/crm/am-delegation.util.spec.ts \
  services/ops-web/src/lib/crm/am-api.ts \
  services/ops-web/src/components/crm/am/AmSettings.tsx \
  services/ops-web/src/components/crm/am/AmAccountsList.tsx
git commit -m "$(cat <<'EOF'
feat(am): honor leave delegations in me scope and coverage

EOF
)"
```

---

### Task 11: `/crm/health` AM snapshot strip

**Files:**
- Create: `services/ops-web/src/lib/crm/am-cs-health-strip.util.ts`
- Create: `services/ops-web/src/lib/crm/am-cs-health-strip.util.spec.ts`
- Create: `services/ops-web/src/components/crm/health/AmCsHealthStrip.tsx`
- Modify: `services/ops-web/src/app/crm/health/page.tsx`

**Interfaces:**
- Consumes: `hasCap(user, 'crm_am', 'view')`, `GET /api/crm/am/health` (`fetchAmHealthCenter`)
- Produces:

```ts
export function canSeeAmHealthStrip(user: StoredStaffUser | null | undefined): boolean {
  return hasCap(user ?? null, 'crm_am', 'view');
}
```

Strip shows 4 band counts + avg or `—` + link `Xem AM Health` → `/crm/account-management/health`. On 401/403/error: hide numbers, show `—` and Retry. **Do not** mount `AmShell`. **Do not** replace `CsHealthDashboardPanel`.

- [ ] **Step 1: Write the failing util test**

```ts
it('shows the strip only with crm_am.view', () => {
  expect(canSeeAmHealthStrip(user([{ section: 'crm_agency', action: 'view' }]))).toBe(false);
  expect(canSeeAmHealthStrip(user([{ section: 'crm_am', action: 'view' }]))).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd services/ops-web && npx vitest run src/lib/crm/am-cs-health-strip.util.spec.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement strip + mount**

In `page.tsx`, after auth, if `canSeeAmHealthStrip(user)` render `<AmCsHealthStrip token={token} />` above `CsHealthDashboardPanel`.

- [ ] **Step 4: Run test**

```bash
cd services/ops-web && npx vitest run src/lib/crm/am-cs-health-strip.util.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/ops-web/src/lib/crm/am-cs-health-strip.util.ts \
  services/ops-web/src/lib/crm/am-cs-health-strip.util.spec.ts \
  services/ops-web/src/components/crm/health/AmCsHealthStrip.tsx \
  services/ops-web/src/app/crm/health/page.tsx
git commit -m "$(cat <<'EOF'
feat(am): show AM health strip on shared CRM health page

EOF
)"
```

---

## Wave G4 — Polish + UAT

### Task 12: Dashboard Lưu view

**Files:**
- Modify: `services/ops-web/src/components/crm/am/AmDashboard.tsx`
- Modify: `services/ops-web/src/lib/crm/am-dashboard.util.ts` + spec
- Reuse: `createAmView` / `fetchAmViews` (`page: 'dashboard'`)

**Interfaces:**
- Consumes: `AmSavedView`, `canShareAmView` from `am-accounts-views.util.ts`
- Produces:

```ts
export function dashboardViewQuery(search: URLSearchParams): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of ['scope', 'from', 'to', 'period'] as const) {
    const value = search.get(key);
    if (value) out[key] = value;
  }
  return out;
}
```

Header buttons next to the title (SRS UI-AM-01): `[Lưu view]`. Name input + optional Chia sẻ (same cap as list). `createAmView(token, { name, shared, page: 'dashboard', query_json })`. Load saved dashboard views as links that `router.replace` the query. Cap 10 is already enforced by API (`view_limit`).

- [ ] **Step 1: Write the failing util test**

```ts
it('keeps only dashboard query keys', () => {
  const qs = new URLSearchParams('scope=team&from=2026-09-01&ads=1');
  expect(dashboardViewQuery(qs)).toEqual({ scope: 'team', from: '2026-09-01' });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd services/ops-web && npx vitest run src/lib/crm/am-dashboard.util.spec.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement head actions on `AmDashboard`**

Do not add a 7th KPI tile. Do not add nav items.

- [ ] **Step 4: Run tests**

```bash
cd services/ops-web && npx vitest run src/lib/crm/am-dashboard.util.spec.ts
cd services/ptt-crm-api && npx jest --config jest.config.js src/am/am-views.service.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/ops-web/src/lib/crm/am-dashboard.util.ts \
  services/ops-web/src/lib/crm/am-dashboard.util.spec.ts \
  services/ops-web/src/components/crm/am/AmDashboard.tsx
git commit -m "$(cat <<'EOF'
feat(am): save dashboard views with the existing views API

EOF
)"
```

---

### Task 13: Bulk tag + CSV export (<10k)

**Files:**
- Modify: `services/ptt-crm-api/src/am/am-accounts.service.ts`
- Create: `services/ptt-crm-api/src/am/am-accounts-export.spec.ts`
- Modify: `am.controller.ts`
- Create: `services/ops-web/src/lib/crm/am-export.util.ts` + spec
- Modify: `AmAccountsList.tsx` bulk bar
- Modify: `services/ops-web/src/lib/crm/am-api.ts`

**Interfaces:**
- Consumes: existing list filters + `PATCH` tags on a single account
- Produces:

```ts
export type AmBulkTagInput = {
  agency_client_ids: string[];
  tags: string[];
  mode: 'add';
};

export type AmBulkTagResult = { updated: number };

export type AmAccountsExportResult =
  | { csv: string; rows: number }
  | never;
```

Routes:
- `POST /accounts/bulk-tag` — `edit`. Max 200 IDs. Each id must pass the same scope as list. `mode` only `'add'` (union with existing tags, de-dupe, trim). Audit `account.bulk_tag`.
- `GET /accounts/export` — `view`. Same query string as `GET /accounts`. Count first. If `count >= 10000` → `400 { error: 'export_too_large', max: 10000 }`. Else return `text/csv`. Columns: `agency_client_id,code,name,owner_staff_id,team_id,am_status,health_band,mrr_vnd,ends_on`. `mrr_vnd` column is empty when caller lacks `crm_am.finance`. Never export churned unless `lifecycle=churned` is explicitly in the query.

```ts
export function amExportTooLargeCopy(code: string): string {
  if (code === 'export_too_large') return 'Export quá 10.000 dòng — thu hẹp bộ lọc.';
  return code;
}

export function escapeAmCsvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}
```

- [ ] **Step 1: Write failing tests**

```ts
it('rejects export at 10000 rows', async () => {
  db.query.mockResolvedValueOnce({ rows: [{ count: 10000 }], rowCount: 1 });
  await expect(service.exportCsv(viewReq, {})).rejects.toMatchObject({
    response: { error: 'export_too_large', max: 10000 },
  });
});

it('adds tags without dropping existing ones', async () => {
  const CLIENT_ID = '19d722af-0000-4000-8000-000000000001';
  db.query.mockImplementation(async (sql: string) => {
    const text = String(sql);
    if (/select/i.test(text) && /tags/i.test(text)) {
      return { rows: [{ agency_client_id: CLIENT_ID, tags: ['a'] }], rowCount: 1 };
    }
    if (/update/i.test(text)) {
      expect(JSON.stringify(arguments[1])).toMatch(/a/);
      expect(JSON.stringify(arguments[1])).toMatch(/b/);
      return { rows: [], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  });
  const out = await service.bulkTag(editReq, {
    agency_client_ids: [CLIENT_ID],
    tags: ['b'],
    mode: 'add',
  });
  expect(out.updated).toBe(1);
});
```

Use the same constructor/mocks as `am-accounts-list.spec.ts`. If tags live on `clients` vs `crm_am_account_ext`, read the existing PATCH tags path in `am-accounts.service.ts` and write to **that same column**. Do not add a second tags table.

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd services/ptt-crm-api && npx jest --config jest.config.js src/am/am-accounts-export.spec.ts
cd services/ops-web && npx vitest run src/lib/crm/am-export.util.spec.ts
```

Expected: FAIL — `exportCsv` / `bulkTag` / `amExportTooLargeCopy` are missing.

- [ ] **Step 3: Implement API + bulk bar**

Controller:

```ts
@Post('accounts/bulk-tag')
@RequireAmAction('edit')
async bulkTag(@Req() req: AuthedReq, @Body() body: AmBulkTagInput) {
  return this.accounts.bulkTag(req, body ?? {});
}

@Get('accounts/export')
@RequireAmAction('view')
async exportAccounts(@Req() req: AuthedReq, @Res() res: Response, @Query() q: AmAccountsListQuery) {
  const out = await this.accounts.exportCsv(req, q);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="am-accounts.csv"');
  res.send(out.csv);
}
```

If this controller file does not already import `@Res()` / Express `Response`, follow the existing Nest pattern in `ptt-crm-api` (search `@Res(`). Prefer returning `{ csv }` as JSON only if `@Res()` would break the global interceptor — in that case return `{ csv, rows }` and let the UI build the blob. Either way the too-large path is `400`.

`AmAccountsList` bulk bar (already has Đổi Owner / Bỏ chọn) add:

```tsx
<button type="button" className="am-btn" onClick={() => void onBulkTag()}>Gắn tag</button>
<button type="button" className="am-btn" onClick={() => void onExport()}>Export</button>
```

`onExport` calls `GET /accounts/export` with **current URL filters**, not only selected IDs (SRS export is the filtered book). If the user has a selection, still export the filter — do not silently export 3 rows and call it the book. Selected-only export is out of scope.

`onBulkTag` prompts a single tag string (comma-split), posts selected IDs. Empty selection → no-op.

- [ ] **Step 4: Run tests**

```bash
cd services/ptt-crm-api && npx jest --config jest.config.js src/am/am-accounts-export.spec.ts src/am/am-accounts-list.spec.ts
cd services/ops-web && npx vitest run src/lib/crm/am-export.util.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/ptt-crm-api/src/am/am-accounts.service.ts \
  services/ptt-crm-api/src/am/am-accounts-export.spec.ts \
  services/ptt-crm-api/src/am/am.controller.ts \
  services/ops-web/src/lib/crm/am-export.util.ts \
  services/ops-web/src/lib/crm/am-export.util.spec.ts \
  services/ops-web/src/lib/crm/am-api.ts \
  services/ops-web/src/components/crm/am/AmAccountsList.tsx
git commit -m "$(cat <<'EOF'
feat(am): add bulk tags and sync CSV export under 10k rows

EOF
)"
```

---

### Task 14: Help / SOP topbar

**Files:**
- Create: `services/ops-web/src/lib/crm/am-help.util.ts`
- Create: `services/ops-web/src/lib/crm/am-help.util.spec.ts`
- Create: `services/ops-web/src/components/crm/am/AmHelpDrawer.tsx`
- Modify: `services/ops-web/src/components/crm/am/AmShell.tsx` (header after 🔔, before `AmCreateMenu`)

**Interfaces:**
- Consumes: none (static copy)
- Produces:

```ts
export const AM_HELP_LINKS = [
  { href: '/crm/account-management', label: 'Bàn làm việc' },
  { href: '/crm/account-management/clients', label: 'Sổ khách 360' },
  { href: '/crm/account-management/work', label: 'Hàng đợi việc' },
  { href: '/crm/account-management/renewals', label: 'Gia hạn' },
  { href: '/crm/account-management/health', label: 'Health & Risk' },
] as const;

export function amHelpTitle(): string {
  return 'Hướng dẫn Account Management';
}
```

Drawer body (fixed copy, no mockup numbers):

```text
AM giữ khách sau hợp đồng: retain / renew / expand / health.
Sổ mặc định ẩn churned. Health 4 band. Việc CSD chỉ liên kết — không Resolve.
```

Do not link to `docs/superpowers/*` (not a user route). Do not add a 9th nav item.

- [ ] **Step 1: Write the failing util test**

```ts
it('lists five in-app SOP links and no portal/ads', () => {
  expect(amHelpTitle()).toMatch(/Account Management/i);
  expect(AM_HELP_LINKS).toHaveLength(5);
  expect(AM_HELP_LINKS.some((l) => /portal|ads/i.test(`${l.href} ${l.label}`))).toBe(false);
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd services/ops-web && npx vitest run src/lib/crm/am-help.util.spec.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement drawer + topbar button**

```tsx
<button type="button" className="am-help" aria-label="Hướng dẫn" onClick={() => setHelpOpen(true)}>
  ❔
</button>
```

Place it after the bell, before `AmCreateMenu`. Reuse drawer chrome classes already used by `AmNotifyDrawer` (`am-drawer`). Empty/error N/A — static.

- [ ] **Step 4: Run test**

```bash
cd services/ops-web && npx vitest run src/lib/crm/am-help.util.spec.ts src/lib/crm/am-nav.util.spec.ts
```

Expected: PASS. Nav spec still has exactly 8 items.

- [ ] **Step 5: Commit**

```bash
git add services/ops-web/src/lib/crm/am-help.util.ts \
  services/ops-web/src/lib/crm/am-help.util.spec.ts \
  services/ops-web/src/components/crm/am/AmHelpDrawer.tsx \
  services/ops-web/src/components/crm/am/AmShell.tsx
git commit -m "$(cat <<'EOF'
feat(am): add help SOP drawer on the AM topbar

EOF
)"
```

---

### Task 15: UAT gate (no product code)

**Files:**
- Create: `.local-dev/am-gap-close-uat.md` (local only — **do not commit** if the repo ignores `.local-dev/`; if it is tracked, write `docs/superpowers/plans/2026-09-05-account-management-gap-close-uat.md` instead)

**Interfaces:**
- Consumes: all G1–G4 routes on the implementation branch
- Produces: a checked list. Do not claim done until every line is evidenced.

- [ ] **Step 1: Run the automated suite**

```bash
cd services/ptt-crm-api && npx jest --config jest.config.js src/am --forceExit
cd services/ops-web && npx vitest run src/lib/crm/am-*.spec.ts src/lib/crm/am-*.util.spec.ts
```

Expected: all AM Jest + Vitest PASS. Record counts in the UAT note.

- [ ] **Step 2: Manual UI checklist (logged-in staff with `crm_am.view` + `edit`)**

On `/crm/account-management`:

1. Dashboard still has **exactly 6** tiles. Lưu view writes `page=dashboard` and reloads.
2. Open a 360. All **10** tabs render real panels — zero `AmPlaceholder` / “mở ở Wave”.
3. Công việc lists only that account. Health embeds the existing detail (recompute still `manage`).
4. Dự án & dịch vụ shows contracts or `—`. No create-delivery control.
5. Tài liệu: add `https://example.com/x` succeeds; `javascript:alert(1)` fails.
6. Contract → Lịch thanh toán shows derived rows or `—`. No Paid button. Phụ lục is `—`.
7. Timeline: tick one action item → one work item; tick again does not duplicate.
8. Onboarding Tài liệu + Activity are not `—` once data exists.
9. Settings: create a delegation; delegate’s Dashboard `me` includes the owner’s account; list shows `ủy quyền đến {ngày}`.
10. `/crm/health` keeps CS Health and, with `crm_am.view`, shows the AM strip.
11. List: bulk tag updates selected rows; Export downloads CSV; a filter that would exceed 10k shows the too-large copy (force in API test if prod book is small).
12. Topbar ❔ opens the SOP drawer. Sidebar still **8** items, no count badges, no nested `<main>`.
13. Out-of-scope GET (`/api/crm/am/portal`) still **404**. CSD ticket is link-only.

- [ ] **Step 3: Fix any miss — do not skip**

If a checkbox fails, return to that task and add a regression test before re-checking UAT.

- [ ] **Step 4: Do not deploy or push unless the user asks**

Apply G1 DDL on the target DB with `bash scripts/apply_pg_ddl_am_g1.sh` only when asked. Enable systemd timers only when asked. Restart `ptt-crm-api` and `ptt-ops-web` **separately**.

- [ ] **Step 5: Commit UAT note only if it lives under `docs/`**

```bash
git add docs/superpowers/plans/2026-09-05-account-management-gap-close-uat.md
git commit -m "$(cat <<'EOF'
docs(am): record gap-close UAT evidence

EOF
)"
```

Skip this commit when the note is only under `.local-dev/`.

---

## Self-review (plan vs SRS)

| SRS / mockup | Task |
|---|---|
| UI-AM-03 10 tabs, no Ads/Portal (FR-016) | 1–4 |
| UI-AM-04 tick action item → task + attach | 6, 7 |
| UI-AM-08 onboarding Tài liệu / Activity | 4, 7 |
| UI-AM-10 Lịch TT / Tài liệu; Phụ lục honest empty | 4, 5 (amendments explicitly empty) |
| UI-AM-14 work on the account | 1 |
| UI-AM-17 / UI-AM-20 health on 360 | 2 |
| §4.3 ủy quyền + dashboard `me` + label đến ngày | 10 |
| §6.4 job 02:00 ICT + `POST /health/recompute` | 8 (recompute already shipped) |
| Renewal window job cadence | 9 (`AmRenewalWorker` already shipped) |
| ACT-009 Lưu view on dashboard | 12 (list already shipped) |
| ACT-010 Export; >10k rejected sync | 13 |
| Topbar ❔ Help/SOP | 14 |
| `/crm/health` must not drop CS Health | 11 |

**Intentionally not in this plan**

| Item | Why |
|---|---|
| Client portal / FX / bubble / AI auto-write | Locked out of AM plan |
| Import CSV (ACT-011) | Separate risk; list attach already exists |
| Async export job | No AM job queue; 400 over 10k |
| File blob store | Links only |
| Contract amendments SoR | `crm_contracts` has no parent/appendix |
| New delivery SoR | Deep-link or `—` |
| Product nav count badges / 7th KPI / 9th nav | Locked |
| Granting `staff_section_permissions` from scripts | Catalog-only; Admin RBAC |

**Placeholder scan:** no TBD/TODO/implement-later. Amendments stay empty **by decision**, with UI copy in Task 5.

**Type names reused later**

- `AmAccountProjects` / `AmAccountProjectContract` / `AmAccountDeliveryLink` — Task 3
- `AmDocument` / `AmCreateDocumentInput` / `isSafeAmDocumentHref` — Task 4, reused Task 7
- `AmPaymentRow` / `derivePaymentSchedule` — Task 5
- `AmActionItemToTaskResult` — Task 6
- `AmDelegation` / `AmCreateDelegationInput` — Task 10
- `canSeeAmHealthStrip` — Task 11
- `dashboardViewQuery` — Task 12
- `AmBulkTagInput` / `escapeAmCsvCell` / `amExportTooLargeCopy` — Task 13
- `AM_HELP_LINKS` — Task 14
