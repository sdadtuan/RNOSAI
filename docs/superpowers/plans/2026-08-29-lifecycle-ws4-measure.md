# Lifecycle WS4 — Measure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** GDKD sees K1–K4 on `/crm/owner-weekly`; lifecycle milestones are recorded at B2 / Intake Go / HĐ active / Client active; B2B `won` triggers NBA debrief (rule 9); dead stepper TSX removed.

**Architecture:** Idempotent PG table `crm_lifecycle_milestones` + `LifecycleMilestonePgUtil.record()` called from existing write paths (care complete, intake complete, promote, client active). Pure `lifecycle-kpi.util.ts` computes medians; `OwnerWeeklyPgRepository.dashboard` adds `blocks.lifecycle`. ops-web renders lifecycle strip above the 4-block grid. Debrief: extend `terminal()` in FE + LMP BE.

**Tech Stack:** NestJS `ptt-crm-api`, PostgreSQL, Jest; Next.js ops-web, Vitest; Playwright e2e `kpi-rnos42.spec.ts`.

**Spec:** [`docs/superpowers/specs/2026-08-29-lifecycle-ws4-measure-design.md`](../specs/2026-08-29-lifecycle-ws4-measure-design.md) (LIFE-WS4-20260829). Parent: [`2026-08-28-lifecycle-absolute-win-design.md`](../specs/2026-08-28-lifecycle-absolute-win-design.md) §6 WS4. **WS3 shipped:** `2a06affa`.

## Global Constraints

- WS4 only. Do not implement new journey steps, NBA post-won kinds, promote/client logic changes, or a new dashboard route.
- PG only — no SQLite dual-write.
- Milestone insert: `ON CONFLICT (lead_id, milestone_key) DO NOTHING` (first timestamp wins).
- K1–K3 window: **90 calendar days** ending at owner-weekly `week.end`.
- K4: reuse CSKH `first_call_15m` compliance — default target **85%**.
- Do not redesign cash/sales/efficiency/risk blocks.
- Move `LeadContractFlowSummary` **before** deleting `LeadB2bSalesFlowBar.tsx`.
- Do not `next build` ad-hoc on VPS.
- Branch: `feat/lifecycle-ws4-measure` from `main`.

## File map

| File | Role |
|------|------|
| Create `docs/specs/2026-08-29-lifecycle-milestones-ddl.sql` | Idempotent DDL |
| Create `scripts/backfill_lifecycle_milestones.sql` | One-shot backfill |
| Create `services/ptt-crm-api/src/lifecycle-milestone/lifecycle-milestone.types.ts` | Keys + record input |
| Create `services/ptt-crm-api/src/lifecycle-milestone/lifecycle-milestone.pg.util.ts` | `ensureSchema`, `record` |
| Create `services/ptt-crm-api/src/lifecycle-milestone/lifecycle-milestone.pg.util.spec.ts` | Mock client tests |
| Create `services/ptt-crm-api/src/lifecycle-milestone/lifecycle-kpi.util.ts` | median K1–K3 pure |
| Create `services/ptt-crm-api/src/lifecycle-milestone/lifecycle-kpi.util.spec.ts` | Unit tests |
| Modify `services/ptt-crm-api/src/owner-weekly/owner-weekly-pg.repository.ts` | schema bootstrap, lifecycle block, K4 query, targets |
| Modify `services/ptt-crm-api/src/owner-weekly/owner-weekly-pg.repository.spec.ts` | lifecycle dashboard fixture |
| Modify `services/ptt-crm-api/src/leads-funnel/leads-funnel-pg.repository.ts` | hook `b2_done` in `completeCareStage` when pipeline all complete |
| Modify `services/ptt-crm-api/src/intake/intake-pg.repository.ts` | hook `intake_go` when `decision=go` on complete |
| Modify `services/ptt-crm-api/src/leads-contract/contract-promote-pg.util.ts` | hook `contract_active` after promote |
| Modify `services/ptt-crm-api/src/agency/agency.service.ts` | hook `client_active` when status → active |
| Modify `services/ptt-crm-api/src/lead-meeting-prep/lead-meeting-prep.service.ts` | terminal includes `won` |
| Modify `services/ptt-crm-api/src/lead-meeting-prep/lmp-win-outcome.util.ts` | outcome `won` for status `won` |
| Modify `services/ptt-crm-api/src/lead-meeting-prep/lmp-win-outcome.util.spec.ts` | won status case |
| Create `services/ops-web/src/lib/crm/lead-contract-flow.ts` | `LeadContractFlowSummary` |
| Modify `services/ops-web/src/lib/crm/lead-next-action.ts` | `terminal()` + `won` |
| Modify `services/ops-web/src/lib/crm/lead-next-action.spec.ts` | rule 9 won |
| Modify `services/ops-web/src/components/kpi/KpiDashboardUi.tsx` | `OwnerWeeklyLifecycleStrip` |
| Modify `services/ops-web/src/app/crm/owner-weekly/page.tsx` | render lifecycle strip |
| Modify `services/ops-web/src/app/globals.css` | `.owner-weekly-lifecycle` |
| Modify `services/ops-web/e2e/kpi-rnos42.spec.ts` | lifecycle block assertions |
| Modify imports in `LeadJourneyStepper.tsx`, `LeadContractPanel.tsx`, `leads/[id]/page.tsx` | type path |
| Delete `services/ops-web/src/components/LeadB2bSalesFlowBar.tsx` | dead component |
| Delete `services/ops-web/src/components/crm/funnel-stepper/LeadPresalesFunnelStepper.tsx` | dead component |
| Modify `services/ops-web/src/components/crm/funnel-stepper/index.ts` | remove export |

## Out of scope (reject if a task adds them)

- WS5+, journey/delivery CTA changes, WS2 promote changes.
- New REST routes (extend existing owner-weekly GET only).
- Redesign owner-weekly 4-block layout internals.
- Auto-open debrief modal on `won`.
- Playwright suite beyond updating `kpi-rnos42.spec.ts`.

---

### Task 0: DDL + backfill script

**Files:**
- Create: `docs/specs/2026-08-29-lifecycle-milestones-ddl.sql`
- Create: `scripts/backfill_lifecycle_milestones.sql`

- [ ] **Step 1: Write DDL** (copy from spec §6.1)

```sql
CREATE TABLE IF NOT EXISTS crm_lifecycle_milestones (
  id BIGSERIAL PRIMARY KEY,
  lead_id INTEGER NOT NULL,
  milestone_key VARCHAR(32) NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  source VARCHAR(40) NOT NULL,
  ref_id TEXT NOT NULL DEFAULT '',
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (lead_id, milestone_key)
);
CREATE INDEX IF NOT EXISTS idx_lifecycle_milestones_key_at
  ON crm_lifecycle_milestones (milestone_key, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_lifecycle_milestones_lead
  ON crm_lifecycle_milestones (lead_id);
```

- [ ] **Step 2: Wire DDL into owner-weekly bootstrap**

In `OwnerWeeklyPgRepository.bootstrapSchema()`, append the same `CREATE TABLE IF NOT EXISTS` + indexes (or call shared SQL string). **Do not** require manual migration for local dev.

- [ ] **Step 3: Backfill script**

`scripts/backfill_lifecycle_milestones.sql` — four `INSERT … SELECT … ON CONFLICT DO NOTHING`:

1. **b2_done** — leads with `care_stages_done_json->>'first_contact'` parseable timestamp (use `::timestamptz` if ISO, else skip row).
2. **intake_go** — latest `crm_lead_intake_sessions` per `lead_id` where `decision='go'` AND `status='completed'`.
3. **contract_active** — `crm_contracts` where `status='active'`, `lead_id` not null; `occurred_at = updated_at`.
4. **client_active** — `clients` where `status='active'` JOIN `crm_leads` ON `agency_client_id = clients.id`.

- [ ] **Step 4: Local smoke**

```bash
psql "$DATABASE_URL" -f docs/specs/2026-08-29-lifecycle-milestones-ddl.sql
psql "$DATABASE_URL" -f scripts/backfill_lifecycle_milestones.sql
psql "$DATABASE_URL" -c "SELECT milestone_key, COUNT(*) FROM crm_lifecycle_milestones GROUP BY 1;"
```

Expected: counts ≥ 0; no error.

---

### Task 1: Pure KPI utils

**Files:**
- Create: `services/ptt-crm-api/src/lifecycle-milestone/lifecycle-kpi.util.ts`
- Create: `services/ptt-crm-api/src/lifecycle-milestone/lifecycle-kpi.util.spec.ts`

**Exports:**

```ts
export function median(values: number[]): number | null;
export function computeK1(rows: { created_at: string; b2_at: string }[]): { median_minutes: number | null; n: number };
export function computeK2(rows: { b2_at: string; intake_at: string }[]): { median_days: number | null; n: number };
export function computeK3(rows: { contract_at: string; client_at: string }[]): { median_days: number | null; n: number };
export function businessMinutesBetween(startIso: string, endIso: string): number; // Mon–Fri 8–18 ICT simplified OR calendar minutes/60*8 — **lock: calendar minutes for v1** (spec says business minutes — implement simple: skip weekends, 9h/day cap per day)
```

**Lock v1 K1:** use **calendar minutes** divided by 1 if PO hasn't signed business-day algo — document in util comment; spec Q2 says business minutes — implement:

```ts
// businessMinutesBetween: exclude Sat/Sun; count only 08:00–18:00 Asia/Ho_Chi_Minh per day
```

- [ ] **Step 1: Write failing tests**

Cases: empty → null median; 3 values → middle; K1 rejects negative duration; K2/K3 calendar day diff.

- [ ] **Step 2: Implement + run**

```bash
cd services/ptt-crm-api && npm test -- lifecycle-kpi.util.spec.ts
```

Expected: PASS.

---

### Task 2: Milestone PG util

**Files:**
- Create: `services/ptt-crm-api/src/lifecycle-milestone/lifecycle-milestone.types.ts`
- Create: `services/ptt-crm-api/src/lifecycle-milestone/lifecycle-milestone.pg.util.ts`
- Create: `services/ptt-crm-api/src/lifecycle-milestone/lifecycle-milestone.pg.util.spec.ts`

**Types:**

```ts
export type LifecycleMilestoneKey = 'b2_done' | 'intake_go' | 'contract_active' | 'client_active';

export type RecordMilestoneInput = {
  leadId: number;
  key: LifecycleMilestoneKey;
  occurredAt: Date | string;
  source: string;
  refId?: string;
  payload?: Record<string, unknown>;
};
```

**Util:**

```ts
export async function ensureLifecycleMilestoneSchema(db: Pool): Promise<void>;
export async function recordLifecycleMilestone(
  client: Pool | PoolClient,
  input: RecordMilestoneInput,
): Promise<void>;
```

SQL:

```sql
INSERT INTO crm_lifecycle_milestones (lead_id, milestone_key, occurred_at, source, ref_id, payload_json)
VALUES ($1, $2, $3::timestamptz, $4, $5, $6::jsonb)
ON CONFLICT (lead_id, milestone_key) DO NOTHING
```

- [ ] **Step 1: Jest mock PoolClient** — insert called once; conflict no throw.

- [ ] **Step 2: Run tests**

```bash
cd services/ptt-crm-api && npm test -- lifecycle-milestone.pg.util.spec.ts
```

---

### Task 3: Write hooks (4 milestone keys)

**Files:**
- Modify: `leads-funnel-pg.repository.ts`
- Modify: `intake-pg.repository.ts`
- Modify: `contract-promote-pg.util.ts`
- Modify: `agency.service.ts`

- [ ] **Step 3a: `b2_done`**

In `completeCareStage`, after successful UPDATE when `care_pipeline` becomes all complete (`all_complete` — check returned row / `carePipelineState`):

```ts
if (key === 'first_contact' && allB2Complete) {
  await recordLifecycleMilestone(this.db, {
    leadId,
    key: 'b2_done',
    occurredAt: done.first_contact ?? new Date(),
    source: 'care_pipeline',
  });
}
```

Use timestamp from `done[key]` string in `care_stages_done_json`.

- [ ] **Step 3b: `intake_go`**

In `completeSession`, after reload session:

```ts
if (String(completed.decision).trim().toLowerCase() === 'go' && completed.lead_id) {
  await recordLifecycleMilestone(this.db, {
    leadId: Number(completed.lead_id),
    key: 'intake_go',
    occurredAt: completed.completed_at ?? new Date(),
    source: 'intake_session',
    refId: String(sessionId),
  });
}
```

- [ ] **Step 3c: `contract_active`**

In `ContractPromotePgUtil.run` after contract set active (same transaction client):

```ts
await recordLifecycleMilestone(client, {
  leadId,
  key: 'contract_active',
  occurredAt: new Date(),
  source: 'contract_promote',
  refId: String(contractId),
  payload: { lifecycle_id: lifecycleId },
});
```

- [ ] **Step 3d: `client_active`**

In `agency.service.ts` where `updateClient(clientId, { status: 'active' })` succeeds:

```ts
const leadId = await this.repo.findLeadIdByAgencyClientId(clientId); // add small repo helper if missing
if (leadId) {
  await recordLifecycleMilestone(this.repo.db, { leadId, key: 'client_active', occurredAt: new Date(), source: 'agency_client', refId: clientId });
}
```

Fail-soft: no lead → skip.

- [ ] **Step 3e: Manual / integration note**

No new public API test required if unit tests cover util; optional Jest on hook with mocked `recordLifecycleMilestone`.

---

### Task 4: Owner-weekly lifecycle block (backend)

**Files:**
- Modify: `owner-weekly-pg.repository.ts`
- Modify: `owner-weekly-pg.repository.spec.ts`

- [ ] **Step 1: Add target defaults**

```ts
k1_b2_median_max_minutes: 480,
k2_intake_median_max_days: 5,
k3_client_active_max_days: 14,
k4_first_call_min_pct: 85,
```

Add labels + `OWNER_WEEKLY_TARGET_GROUPS` entry `['lifecycle', 'Lifecycle', [...keys]]`.

- [ ] **Step 2: `loadLifecycleKpis(windowEnd: string)`**

Private method — window start = `addDays(windowEnd, -89)`.

SQL sketches:

**K1 rows:**

```sql
SELECT l.created_at, b.occurred_at AS b2_at
FROM crm_lifecycle_milestones b
JOIN crm_leads l ON l.sqlite_lead_id = b.lead_id
WHERE b.milestone_key = 'b2_done'
  AND b.occurred_at::date BETWEEN $start AND $end
  AND EXISTS (SELECT 1 FROM crm_lead_presales ps WHERE ps.lead_id = b.lead_id)
```

**K2:** self-join milestones `b2_done` + `intake_go` same lead_id.

**K3:** self-join `contract_active` + `client_active`.

Pass rows to `computeK1/K2/K3`. If `n < 3`, set `note: 'Chưa đủ mẫu (n={n})'`, `value: null`, `status: neutral`.

- [ ] **Step 3: K4 query**

Reuse pattern from `cskh-board.service.ts` — filter leads with `client_id` / spa in 90d window; compute tier `first_call_15m` compliance pct (import `aggregateSlaCompliancePct` from `home-summary.util.ts` or duplicate minimal count query).

If too heavy, add `CskhBoardService.computeFirstCallCompliance(windowStart, windowEnd)` thin wrapper — **prefer inline SQL in owner-weekly repo** to avoid circular module deps.

- [ ] **Step 4: Attach to `dashboard()`**

```ts
const lifecycleMetrics = await this.loadLifecycleKpis(bounds.end);
blocks.lifecycle = {
  key: 'lifecycle',
  label: 'Lifecycle (Factory A/B)',
  metrics: lifecycleMetrics,
};
```

Include lifecycle metrics in `preExecution()` action list (optional — yellow/red only).

- [ ] **Step 5: Repository spec**

Mock query results → expect 4 metrics keys `k1_b2_minutes` … `k4_first_call_pct`.

```bash
cd services/ptt-crm-api && npm test -- owner-weekly-pg.repository.spec.ts
```

---

### Task 5: Owner-weekly UI

**Files:**
- Modify: `KpiDashboardUi.tsx`
- Modify: `owner-weekly/page.tsx`
- Modify: `globals.css`
- Modify: `e2e/kpi-rnos42.spec.ts`

- [ ] **Step 1: `OwnerWeeklyLifecycleStrip` component**

New export in `KpiDashboardUi.tsx`:

```tsx
export function OwnerWeeklyLifecycleStrip({ dashboard }: { dashboard: Record<string, unknown> | null }) {
  const block = (dashboard?.blocks as Record<string, unknown>)?.lifecycle as Record<string, unknown> | undefined;
  if (!block) return null;
  // Reuse metric row markup from OwnerWeeklyBlockGrid — 4 columns desktop, scroll mobile
}
```

- [ ] **Step 2: `owner-weekly/page.tsx`**

Render `<OwnerWeeklyLifecycleStrip dashboard={dashboard} />` **above** `<OwnerWeeklyBlockGrid />`.

- [ ] **Step 3: CSS**

```css
.owner-weekly-lifecycle { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.75rem; margin-bottom: 1rem; }
@media (max-width: 900px) { .owner-weekly-lifecycle { grid-template-columns: repeat(2, 1fr); } }
```

Add `formatOwnerMetric` support for `minutes` and `days` if missing.

- [ ] **Step 4: E2E**

Update `kpi-rnos42.spec.ts`:

```ts
await expect(page.locator('.owner-weekly-lifecycle, .owner-weekly-lifecycle .owner-weekly-metric')).toHaveCount(4);
await expect(page.locator('.owner-weekly-grid .owner-weekly-block')).toHaveCount(4);
```

- [ ] **Step 5: Vitest/format check** (if format helper touched)

---

### Task 6: Debrief `won`

**Files:**
- Modify: `lead-next-action.ts` + spec
- Modify: `lead-meeting-prep.service.ts`
- Modify: `lmp-win-outcome.util.ts` + spec

- [ ] **Step 1: FE `terminal()`**

```ts
return s === 'chot' || s === 'lost' || s === 'won';
```

Optional body: `'Lead đã Won/Chốt/Lost — gửi debrief để win loop học objection.'`

- [ ] **Step 2: Vitest**

```ts
it('WS4-08 won + debrief_pending → rule 9', () => {
  const out = resolveLeadNextAction({ ...base, leadStatus: 'won', debriefPending: true, b2Complete: true, presalesStage: 'proposal' });
  expect(out.rule).toBe(9);
  expect(out.primary.action).toBe('submit_debrief');
});
```

- [ ] **Step 3: LMP service**

Replace `['chot', 'lost']` with `['chot', 'lost', 'won']` (both empty-prep and existing-prep paths).

- [ ] **Step 4: Win outcome util**

```ts
const outcome = status === 'chot' || status === 'won' ? 'won' : 'lost';
```

Add spec for `buildWinOutcomeFromDebrief` with `leadStatus: 'won'`.

```bash
cd services/ptt-crm-api && npm test -- lmp-win-outcome
cd services/ops-web && npx vitest run src/lib/crm/lead-next-action.spec.ts
```

---

### Task 7: Dead code cleanup

**Files:**
- Create: `lead-contract-flow.ts`
- Update imports (3 files)
- Delete: `LeadB2bSalesFlowBar.tsx`, `LeadPresalesFunnelStepper.tsx`
- Modify: `funnel-stepper/index.ts`

- [ ] **Step 1: Create shared type**

Move `LeadContractFlowSummary` interface exactly as in WS3 (include `lifecycleStage`, `agencyClientId`).

- [ ] **Step 2: Update imports**

```ts
import type { LeadContractFlowSummary } from '@/lib/crm/lead-contract-flow';
```

Files: `LeadJourneyStepper.tsx`, `LeadContractPanel.tsx`, `leads/[id]/page.tsx`.

- [ ] **Step 3: Delete dead files**

```bash
rm services/ops-web/src/components/LeadB2bSalesFlowBar.tsx
rm services/ops-web/src/components/crm/funnel-stepper/LeadPresalesFunnelStepper.tsx
```

Remove export from `funnel-stepper/index.ts`.

- [ ] **Step 4: Grep guard**

```bash
rg "LeadB2bSalesFlowBar|LeadPresalesFunnelStepper" services/ops-web
```

Expected: no runtime imports.

- [ ] **Step 5: Typecheck**

```bash
cd services/ops-web && npx tsc --noEmit
```

---

### Task 8: Verification, deploy, VPS backfill

- [ ] **Step 1: Backend tests**

```bash
cd services/ptt-crm-api && npm test -- lifecycle-kpi lifecycle-milestone owner-weekly-pg lmp-win-outcome
```

- [ ] **Step 2: Frontend tests**

```bash
cd services/ops-web && npx vitest run src/lib/crm/lead-next-action.spec.ts
```

- [ ] **Step 3: Acceptance checklist (manual)**

| ID | Check |
|----|-------|
| WS4-01 | `/crm/owner-weekly` shows Lifecycle block with 4 metrics |
| WS4-04–07 | Milestone rows after B2 / intake / promote / client active |
| WS4-08 | Lead `won` + debrief_pending → NBA rule 9 |
| WS4-11 | No `LeadB2bSalesFlowBar` import |

- [ ] **Step 4: Commit**

```bash
git checkout -b feat/lifecycle-ws4-measure
# stage WS4 files only
git commit -m "$(cat <<'EOF'
feat(crm): WS4 lifecycle KPIs, milestones, and debrief won

Add owner-weekly K1–K4 block with milestone instrumentation and enable B2B won debrief while removing dead journey stepper components.
EOF
)"
```

- [ ] **Step 5: Merge, push, deploy**

```bash
git checkout main && git merge feat/lifecycle-ws4-measure --no-edit
git push origin main
APPLY=1 ./scripts/deploy_lmp_s2_vps.sh
```

- [ ] **Step 6: VPS backfill (once)**

```bash
psql "$DATABASE_URL" -f scripts/backfill_lifecycle_milestones.sql
```

Verify owner-weekly K1–K3 show numbers when n ≥ 3.

---

## Spec cross-link

After plan approved, update spec §15:

```markdown
2. Plan WS4: [2026-08-29-lifecycle-ws4-measure.md](../plans/2026-08-29-lifecycle-ws4-measure.md) — ready for implementation.
```

---

## Task dependency graph

```
Task 0 (DDL)
    ↓
Task 1 (KPI pure) ──→ Task 4 (owner-weekly BE)
Task 2 (milestone util) ──→ Task 3 (hooks) ──→ Task 4
Task 4 ──→ Task 5 (UI)
Task 6 (debrief) — parallel
Task 7 (cleanup) — parallel after Task 5 or anytime
Task 8 — last
```

**Parallelizable:** Task 6 + Task 7 while Task 4–5 in progress.
