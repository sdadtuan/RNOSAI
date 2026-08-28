# Lifecycle S0 Stage Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hide contract panel, Deal Room banner, and future-stage forms on `/crm/leads/{id}` until the lead is at the matching stage — VIS-01…05, no new APIs.

**Architecture:** One pure resolver `resolveLeadStageVisibility` is the single source of truth for six flags. The lead page fetches existing contract readiness (so VIS-05 works without mounting the panel first), then mounts `LeadContractPanel` / Deal Room banner / `#funnel-presales` from those flags. `resolveLeadJourney` stops marking HĐ `current` just because stage is `proposal`.

**Tech Stack:** Next.js 14 ops-web, React client components, Vitest, existing `fetchLeadContractReadiness` / `fetchLeadFunnel`.

**Spec:** [`docs/superpowers/specs/2026-08-28-lifecycle-absolute-win-design.md`](../specs/2026-08-28-lifecycle-absolute-win-design.md) §4 (LIFE-WIN-20260828). Parent workspace: [`2026-08-28-lead-detail-workspace-design.md`](../specs/2026-08-28-lead-detail-workspace-design.md).

## Global Constraints

- S0 only. Do not implement WS2 Client, NBA HĐ kinds (`create_contract` / `submit_contract`), owner-weekly, 9-step journey, dead-stepper delete, or new REST endpoints.
- No new CSS file; overlay only in `services/ops-web/src/app/bitrix-theme.css` under `html.ops-shell-bitrix` (this plan should not need new CSS).
- `spa_operational`: no B2B NBA/journey/contract/Deal Room; keep CSKH SLA + B2 outcome card.
- Two factories stay separate. Do not merge SOPs.
- Do not `next build` ad-hoc on the VPS.
- Do not change Deal Room / Intake / CSKH board internals.
- `showContractForFlow(kind)` (always true for B2B) must stop driving the panel. Keep the helper exported; do not delete it in this PR.
- 「Chờ dọn」 stays in DB; it must not become NBA `title_vi`.
- Hero still **Gọi ngay** when phone exists. Rule 5 card primary stays **Copy script**.

## File map

| File | Role |
|------|------|
| Create `services/ops-web/src/lib/crm/lead-stage-visibility.ts` | Pure VIS flags + `deriveS0IntakeGo` |
| Create `services/ops-web/src/lib/crm/lead-stage-visibility.spec.ts` | VIS-01…05 unit cases |
| Modify `services/ops-web/src/lib/crm/lead-journey.ts` | Contract step `current` only when proposal **and** `hasContract` |
| Modify `services/ops-web/src/lib/crm/lead-journey.spec.ts` | Add 3 contract-state cases |
| Modify `services/ops-web/src/app/crm/leads/[id]/page.tsx` | Fetch readiness; wire flags to banner + panel + NBA/journey |
| Modify `services/ops-web/src/components/LeadFunnelPanel.tsx` | Honor `showPresalesBlock`; no task dump at empty/`lead` stage |
| Modify `docs/superpowers/specs/2026-08-28-lifecycle-absolute-win-design.md` | Point §13 at this plan |

## Out of scope (reject if a task adds them)

- Agency Client on promote (WS2) — blocked on LIFE-WIN §11 PO answers.
- NBA kinds HĐ (S1 / LIFE-WIN §5).
- `intakeGo` from real Intake session decision (S1). S0 uses `deriveS0IntakeGo`.
- Redesign Deal Room, new stepper, new CSS file.

---

### Task 1: Visibility resolver (VIS-01…05)

**Files:**
- Create: `services/ops-web/src/lib/crm/lead-stage-visibility.ts`
- Test: `services/ops-web/src/lib/crm/lead-stage-visibility.spec.ts`

**Interfaces:**
- Consumes: funnel/page facts listed in `LeadStageVisibilityInput` below.
- Produces:
  - `deriveS0IntakeGo(presalesStage: string | null): boolean`
  - `resolveLeadStageVisibility(input: LeadStageVisibilityInput): LeadStageVisibility`

- [ ] **Step 1: Write the failing tests**

Create `services/ops-web/src/lib/crm/lead-stage-visibility.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { deriveS0IntakeGo, resolveLeadStageVisibility } from './lead-stage-visibility';

const b2bOpen = {
  flowKind: 'b2b_prospect' as const,
  b2Complete: false,
  presalesStage: null as string | null,
  intakeGo: false,
  hasContract: false,
  contractStatus: null as string | null,
  dealRoomEnabled: true,
};

describe('deriveS0IntakeGo', () => {
  it('true only for consult|proposal', () => {
    expect(deriveS0IntakeGo(null)).toBe(false);
    expect(deriveS0IntakeGo('')).toBe(false);
    expect(deriveS0IntakeGo('lead')).toBe(false);
    expect(deriveS0IntakeGo('consult')).toBe(true);
    expect(deriveS0IntakeGo('proposal')).toBe(true);
    expect(deriveS0IntakeGo('Proposal')).toBe(true);
  });
});

describe('resolveLeadStageVisibility', () => {
  it('VIS-01/02 lead #5 — B2B B2 mở: không HĐ, không Deal Room', () => {
    const out = resolveLeadStageVisibility(b2bOpen);
    expect(out).toEqual({
      showNbaB2b: true,
      showJourney: true,
      showB2Outcome: true,
      showPresalesBlock: false,
      showDealRoomBanner: false,
      showContractPanel: false,
    });
  });

  it('VIS-03 B2 xong, stage lead — ensure Pre-sales, Deal Room tắt', () => {
    const out = resolveLeadStageVisibility({
      ...b2bOpen,
      b2Complete: true,
      presalesStage: 'lead',
      intakeGo: deriveS0IntakeGo('lead'),
    });
    expect(out.showPresalesBlock).toBe(true);
    expect(out.showB2Outcome).toBe(false);
    expect(out.showDealRoomBanner).toBe(false);
    expect(out.showContractPanel).toBe(false);
  });

  it('Deal Room banner only after Intake Go', () => {
    const out = resolveLeadStageVisibility({
      ...b2bOpen,
      b2Complete: true,
      presalesStage: 'consult',
      intakeGo: deriveS0IntakeGo('consult'),
    });
    expect(out.showDealRoomBanner).toBe(true);
    expect(out.showContractPanel).toBe(false);
  });

  it('proposal without contract → show HĐ panel, Deal Room on', () => {
    const out = resolveLeadStageVisibility({
      ...b2bOpen,
      b2Complete: true,
      presalesStage: 'proposal',
      intakeGo: true,
    });
    expect(out.showContractPanel).toBe(true);
    expect(out.showDealRoomBanner).toBe(true);
  });

  it('VIS-05 draft HĐ lệch stage vẫn hiện panel', () => {
    const out = resolveLeadStageVisibility({
      ...b2bOpen,
      b2Complete: true,
      presalesStage: 'lead',
      intakeGo: false,
      hasContract: true,
      contractStatus: 'draft',
    });
    expect(out.showContractPanel).toBe(true);
    expect(out.showDealRoomBanner).toBe(false);
  });

  it('contractStatus pending/active hiện panel dù chưa proposal', () => {
    for (const contractStatus of ['pending', 'active'] as const) {
      const out = resolveLeadStageVisibility({
        ...b2bOpen,
        b2Complete: true,
        presalesStage: 'consult',
        intakeGo: true,
        hasContract: false,
        contractStatus,
      });
      expect(out.showContractPanel).toBe(true);
    }
  });

  it('VIS-04 spa_operational — tắt B2B chrome; B2 outcome nếu chưa xong', () => {
    const open = resolveLeadStageVisibility({
      ...b2bOpen,
      flowKind: 'spa_operational',
    });
    expect(open).toEqual({
      showNbaB2b: false,
      showJourney: false,
      showB2Outcome: true,
      showPresalesBlock: false,
      showDealRoomBanner: false,
      showContractPanel: false,
    });

    const done = resolveLeadStageVisibility({
      ...b2bOpen,
      flowKind: 'spa_operational',
      b2Complete: true,
      hasContract: true,
      contractStatus: 'draft',
      intakeGo: true,
    });
    expect(done.showB2Outcome).toBe(false);
    expect(done.showContractPanel).toBe(false);
    expect(done.showDealRoomBanner).toBe(false);
    expect(done.showNbaB2b).toBe(false);
  });

  it('Deal Room flag off → banner off even at consult', () => {
    const out = resolveLeadStageVisibility({
      ...b2bOpen,
      b2Complete: true,
      presalesStage: 'consult',
      intakeGo: true,
      dealRoomEnabled: false,
    });
    expect(out.showDealRoomBanner).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd services/ops-web && npx vitest run src/lib/crm/lead-stage-visibility.spec.ts
```

Expected: FAIL — `Cannot find module './lead-stage-visibility'` (or export missing).

- [ ] **Step 3: Write minimal implementation**

Create `services/ops-web/src/lib/crm/lead-stage-visibility.ts`:

```ts
export type LeadStageVisibilityInput = {
  flowKind: 'b2b_prospect' | 'spa_operational';
  b2Complete: boolean;
  presalesStage: string | null;
  intakeGo: boolean;
  hasContract: boolean;
  contractStatus: string | null;
  dealRoomEnabled: boolean;
};

export type LeadStageVisibility = {
  showNbaB2b: boolean;
  showJourney: boolean;
  showB2Outcome: boolean;
  showPresalesBlock: boolean;
  showDealRoomBanner: boolean;
  showContractPanel: boolean;
};

const LIVE_CONTRACT = new Set(['draft', 'pending', 'active']);

export function deriveS0IntakeGo(presalesStage: string | null): boolean {
  const stage = (presalesStage ?? '').trim().toLowerCase();
  return stage === 'consult' || stage === 'proposal';
}

export function resolveLeadStageVisibility(
  input: LeadStageVisibilityInput,
): LeadStageVisibility {
  if (input.flowKind === 'spa_operational') {
    return {
      showNbaB2b: false,
      showJourney: false,
      showB2Outcome: !input.b2Complete,
      showPresalesBlock: false,
      showDealRoomBanner: false,
      showContractPanel: false,
    };
  }

  const stage = (input.presalesStage ?? '').trim().toLowerCase();
  const status = (input.contractStatus ?? '').trim().toLowerCase();

  return {
    showNbaB2b: true,
    showJourney: true,
    showB2Outcome: !input.b2Complete,
    showPresalesBlock: input.b2Complete,
    showDealRoomBanner: input.dealRoomEnabled && input.b2Complete && input.intakeGo,
    showContractPanel:
      input.hasContract || stage === 'proposal' || LIVE_CONTRACT.has(status),
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd services/ops-web && npx vitest run src/lib/crm/lead-stage-visibility.spec.ts
```

Expected: PASS — all 8 tests.

- [ ] **Step 5: Commit**

```bash
git add services/ops-web/src/lib/crm/lead-stage-visibility.ts \
  services/ops-web/src/lib/crm/lead-stage-visibility.spec.ts
git commit -m "$(cat <<'EOF'
feat(crm): add S0 lead stage visibility resolver

Hide contract and Deal Room until the matching B2B stage; spa stays CSKH-only.
EOF
)"
```

---

### Task 2: Journey — HĐ không `current` chỉ vì proposal

**Files:**
- Modify: `services/ops-web/src/lib/crm/lead-journey.ts` (lines 60–67)
- Test: `services/ops-web/src/lib/crm/lead-journey.spec.ts`

**Interfaces:**
- Consumes: existing `LeadJourneyInput` (`hasContract`, `contractActive`, `lifecycleId`, `presalesStage`).
- Produces: same `resolveLeadJourney` return; contract step rules below.

As-is bug (must change):

```ts
contract:
  stage === 'proposal'
    ? input.contractActive
      ? 'done'
      : input.hasContract
        ? 'current'
        : 'current'   // always current at proposal
    : 'pending',
```

S0 rules (LIFE-WIN §4.3):

- `contractActive && lifecycleId != null` → `done` (any stage) + existing href `/crm/service-delivery/{id}`.
- else `stage === 'proposal' && hasContract` → `current`.
- else → `pending`.
- Do **not** use “mọi task proposal xong” in S0 (that is S1).

- [ ] **Step 1: Write the failing tests**

Append to `services/ops-web/src/lib/crm/lead-journey.spec.ts` (keep the three existing cases):

```ts
  it('proposal without contract → HĐ pending, proposal current', () => {
    const steps = resolveLeadJourney({
      reviewActive: false,
      b2Complete: true,
      presalesStage: 'proposal',
      hasContract: false,
      contractActive: false,
      lifecycleId: null,
    });
    expect(steps.find((s) => s.key === 'proposal')?.state).toBe('current');
    expect(steps.find((s) => s.key === 'contract')?.state).toBe('pending');
  });

  it('proposal + draft HĐ → HĐ current', () => {
    const steps = resolveLeadJourney({
      reviewActive: false,
      b2Complete: true,
      presalesStage: 'proposal',
      hasContract: true,
      contractActive: false,
      lifecycleId: null,
    });
    expect(steps.find((s) => s.key === 'contract')?.state).toBe('current');
  });

  it('active HĐ + lifecycle → HĐ done + service-delivery href', () => {
    const steps = resolveLeadJourney({
      reviewActive: false,
      b2Complete: true,
      presalesStage: 'proposal',
      hasContract: true,
      contractActive: true,
      lifecycleId: 88,
    });
    const contract = steps.find((s) => s.key === 'contract');
    expect(contract?.state).toBe('done');
    expect(contract?.href).toBe('/crm/service-delivery/88');
  });

  it('draft HĐ ở stage lead → HĐ vẫn pending trên journey', () => {
    const steps = resolveLeadJourney({
      reviewActive: false,
      b2Complete: true,
      presalesStage: 'lead',
      hasContract: true,
      contractActive: false,
      lifecycleId: null,
    });
    expect(steps.find((s) => s.key === 'contract')?.state).toBe('pending');
  });
```

- [ ] **Step 2: Run the new tests to verify they fail**

```bash
cd services/ops-web && npx vitest run src/lib/crm/lead-journey.spec.ts
```

Expected: FAIL on `proposal without contract → HĐ pending` (as-is marks `current`).

- [ ] **Step 3: Write minimal implementation**

In `services/ops-web/src/lib/crm/lead-journey.ts`, replace the `contract:` branch inside `state` with:

```ts
    contract:
      input.contractActive && input.lifecycleId != null
        ? 'done'
        : stage === 'proposal' && input.hasContract
          ? 'current'
          : 'pending',
```

Leave `href` for contract unchanged (`lifecycleId` → `/crm/service-delivery/{id}`).

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd services/ops-web && npx vitest run src/lib/crm/lead-journey.spec.ts
```

Expected: PASS — 3 old + 4 new.

- [ ] **Step 5: Commit**

```bash
git add services/ops-web/src/lib/crm/lead-journey.ts \
  services/ops-web/src/lib/crm/lead-journey.spec.ts
git commit -m "$(cat <<'EOF'
fix(crm): keep journey contract pending until a draft exists

Proposal without a contract must not light HĐ as the current step.
EOF
)"
```

---

### Task 3: Wire lead detail page

**Files:**
- Modify: `services/ops-web/src/app/crm/leads/[id]/page.tsx`
  - imports (~27–28, ~35)
  - `showContractPanel` (~221)
  - new `useMemo` + `useEffect` after `showB2bFlow`
  - NBA/journey gate (~994)
  - Deal Room banner (~1061)
  - `LeadFunnelPanel` props (~1088)
  - `LeadContractPanel` gate (~1112)

**Interfaces:**
- Consumes: `resolveLeadStageVisibility`, `deriveS0IntakeGo` from Task 1; `fetchLeadContractReadiness` from `services/ops-web/src/lib/api.ts` (already exported, GET `/api/v1/leads/:id/contract/readiness`).
- Produces: page-local `stageVis: LeadStageVisibility`; `contractSummary` filled **before** the panel mounts.

**Why a page-level fetch:** today `contractSummary` only arrives from `LeadContractPanel.onLoaded`. If we hide the panel until `hasContract`, VIS-05 never fires (chicken-egg). Fetch readiness on B2B leads; keep `onLoaded` as a refresh path.

Chicken-egg rule: treat fetch error as “no contract” (`hasContract: false`, `contractStatus: null`). Do not leave `contractSummary` stale from a previous lead id — reset when `leadId` changes.

- [ ] **Step 1: Add imports**

In `services/ops-web/src/app/crm/leads/[id]/page.tsx`:

1. Add `fetchLeadContractReadiness` to the existing `@/lib/api` import list.
2. Remove `showContractForFlow` from the `@/lib/crm/lead-flow-kind` import. Keep `showB2bSalesFlowBar` and `resolveLeadFlowKindFromLead`.
3. Add:

```ts
import {
  deriveS0IntakeGo,
  resolveLeadStageVisibility,
} from '@/lib/crm/lead-stage-visibility';
```

- [ ] **Step 2: Replace `showContractPanel` and add visibility + readiness load**

Delete:

```ts
  const showContractPanel = showContractForFlow(leadFlowKind);
```

Immediately after `const showB2bFlow = showB2bSalesFlowBar(leadFlowKind);` insert:

```ts
  const presalesStage = funnelSnap?.presales?.presales.stage ?? null;
  const intakeGo = deriveS0IntakeGo(presalesStage);
  const stageVis = useMemo(
    () =>
      resolveLeadStageVisibility({
        flowKind: leadFlowKind,
        b2Complete: Boolean(funnelSnap?.care_pipeline.all_complete),
        presalesStage,
        intakeGo,
        hasContract: Boolean(contractSummary?.hasContract),
        contractStatus: contractSummary?.contractStatus ?? null,
        dealRoomEnabled: dealRoomEnabled(),
      }),
    [leadFlowKind, funnelSnap, intakeGo, presalesStage, contractSummary],
  );
```

Find the existing `useEffect` that loads the lead (or add a sibling effect). Insert this effect next to other lead-id loaders. Reset summary when the id changes so lead #5 cannot inherit HĐ from another row:

```ts
  useEffect(() => {
    setContractSummary(null);
  }, [leadId]);

  useEffect(() => {
    const token = getAccessToken();
    if (!token || !showB2bFlow) return;
    let cancelled = false;
    void fetchLeadContractReadiness(token, leadId)
      .then((data) => {
        if (cancelled) return;
        setContractSummary({
          hasContract: Boolean(data.contract),
          contractStatus: data.contract?.status ?? null,
          pendingApproval: data.approval?.status === 'pending',
          lifecycleId: data.lifecycle_id ?? null,
        });
      })
      .catch(() => {
        if (cancelled) return;
        setContractSummary({
          hasContract: false,
          contractStatus: null,
          pendingApproval: false,
          lifecycleId: null,
        });
      });
    return () => {
      cancelled = true;
    };
  }, [leadId, showB2bFlow, contractRefresh]);
```

`LeadContractFlowSummary` is already imported via the existing `contractSummary` state type from `@/components/LeadB2bSalesFlowBar`. Do not add a new type.

- [ ] **Step 3: Gate chrome with `stageVis`**

NBA + journey wrapper — change `showB2bFlow && nba` to `stageVis.showNbaB2b && stageVis.showJourney && nba`:

```tsx
          {stageVis.showNbaB2b && stageVis.showJourney && nba ? (
            <div className="lead-workspace-stage">
              <LeadNextActionCard
                action={nba}
                prep={prep}
                busy={nbaBusy}
                companyName={companyName}
                websiteUrl={websiteUrl}
                onCompanyName={setCompanyName}
                onWebsiteUrl={setWebsiteUrl}
                onPickEntity={(id) => void onNbaSelectEntity(id)}
                onAction={onNbaAction}
              />
              <LeadJourneyStepper
                leadId={leadId}
                funnel={funnelSnap}
                contract={contractSummary}
                onOpenConsult={showConsultTab ? openConsultTab : undefined}
              />
            </div>
          ) : null}
```

Deal Room banner — replace the condition

`accessToken && showB2bFlow && dealRoomEnabled() && funnelSnap?.presales && funnelSnap?.care_pipeline.all_complete`

with `accessToken && stageVis.showDealRoomBanner`. Keep the same markup and `Link` to `/crm/leads/${leadId}/deal-room`.

`LeadFunnelPanel` — add prop (Task 4 implements it; wire now so the page compiles after Task 4):

```tsx
                showPresalesBlock={stageVis.showPresalesBlock}
```

`LeadContractPanel` — replace `showContractPanel` with `stageVis.showContractPanel`:

```tsx
            {accessToken && stageVis.showContractPanel ? (
              <LeadContractPanel
                token={accessToken}
                leadId={leadId}
                user={user}
                refreshToken={contractRefresh}
                onMessage={setMessage}
                onLoaded={setContractSummary}
              />
            ) : null}
```

Keep mounting `LeadFunnelPanel` whenever `accessToken` is set (B2 lives inside it). Do not hide the whole funnel on B2B.

Keep `showB2bFlow` for LMP tab, consult tab, spa banner, and `showSlaSciUnifiedPanel`. Those are not S0 visibility flags.

- [ ] **Step 4: Typecheck the page**

```bash
cd services/ops-web && npx tsc --noEmit --pretty false 2>&1 | rg "leads/\[id\]/page|lead-stage-visibility|LeadFunnelPanel" || true
```

Expected before Task 4: `LeadFunnelPanel` may error on unknown prop `showPresalesBlock`. After Task 4: no errors on those files.

If `showPresalesBlock` is the only error, that is OK — Task 4 removes it. Do not invent a local dummy type on the page.

- [ ] **Step 5: Commit** (after Task 4 if tsc is blocked; otherwise commit page + funnel together in Task 4 Step 5)

If committing here would leave a type error, **skip this commit** and finish Task 4 first.

---

### Task 4: Funnel — no `#funnel-presales` / task dump before B2

**Files:**
- Modify: `services/ops-web/src/components/LeadFunnelPanel.tsx`
  - `Props` (~32–48)
  - destructure (~74–94)
  - `#funnel-presales` gate (~499)
  - `funnel.presales` body (~537–568)

**Interfaces:**
- Consumes: `showPresalesBlock?: boolean` from the page (`stageVis.showPresalesBlock`). Default `true` only when omitted **and** existing `showPresalesForFlow` + care-gate still pass — but the page always passes the flag.
- Produces: `#funnel-presales` rendered iff B2B + B2 done + not in review; empty/`lead` stage does not dump consult/proposal tasks or R5.

As-is: `#funnel-presales` already requires `funnel.presales_care_gate.complete`. Keep that. Add the page flag as defense. When `funnel.presales` exists and stage is `lead` (or blank), **do not** call `renderPresalesTasks()` — that dumps consult/proposal task cards on the overview. Keep the stage line + Intake link only.

- [ ] **Step 1: Extend props**

In `interface Props` add:

```ts
  /** S0: B2B + B2 xong. Khi false, không render #funnel-presales. */
  showPresalesBlock?: boolean;
```

Add `showPresalesBlock = true` to the function destructure next to `hideM1Card`.

- [ ] **Step 2: Gate `#funnel-presales`**

Replace the opening condition:

```tsx
      {showPresales && funnel.presales_on_lead_enabled && funnel.presales_care_gate.complete && !inReview && (
```

with:

```tsx
      {showPresalesBlock &&
        showPresales &&
        funnel.presales_on_lead_enabled &&
        funnel.presales_care_gate.complete &&
        !inReview && (
```

- [ ] **Step 3: Stage `lead` / empty — ensure or intake only**

Inside `{funnel.presales && (` replace the `useConsultWorkspaceTab` / `renderPresalesTasks` branch with:

```tsx
          {funnel.presales && (
            <>
              <p>
                Giai đoạn: <strong>{funnel.presales.presales.stage}</strong> · Dịch vụ:{' '}
                {funnel.presales.presales.service_slug || '—'}
              </p>
              {presalesStage === 'consult' || presalesStage === 'proposal' ? (
                <div className="banner banner-info stack-gap" style={{ marginTop: '0.5rem' }}>
                  <p style={{ margin: 0 }}>
                    Workspace <strong>Tư vấn / Báo giá</strong> nằm trên tab{' '}
                    <strong>Tư vấn</strong>. Chỉnh sửa R5 (gate G4) tại form bên dưới.
                  </p>
                  {onOpenConsultTab ? (
                    <button type="button" className="btn btn-sm btn-primary" onClick={onOpenConsultTab}>
                      Mở tab Tư vấn →
                    </button>
                  ) : null}
                  {(presalesStage === 'consult' || presalesStage === 'proposal') && r5Form}
                </div>
              ) : (
                <>
                  {funnel.presales.presales.stage === 'lead' || !String(funnel.presales.presales.stage ?? '').trim() ? (
                    <p style={{ margin: '0.5rem 0' }}>
                      <Link href={intakeHref} className="nav-link">
                        Mở Lead Intake (BANT) →
                      </Link>
                    </p>
                  ) : (
                    renderPresalesTasks()
                  )}
                </>
              )}
            </>
          )}
```

Keep the `!funnel.presales && canEdit` slug + **Bắt đầu pre-sales** block unchanged (VIS-03 ensure).

Do not remove `LeadB2OutcomeCard`. Spa still uses it (`showB2Outcome` is informational; the card already hides when `care_pipeline.all_complete`).

- [ ] **Step 4: Run unit tests + tsc**

```bash
cd services/ops-web && npx vitest run \
  src/lib/crm/lead-stage-visibility.spec.ts \
  src/lib/crm/lead-journey.spec.ts \
  src/lib/crm/lead-next-action.spec.ts \
  src/lib/crm/lead-b2-outcome.spec.ts
```

Expected: PASS.

```bash
cd services/ops-web && npx tsc --noEmit --pretty false 2>&1 | rg "leads/\[id\]/page|LeadFunnelPanel|lead-stage-visibility|lead-journey" || true
```

Expected: no hits.

- [ ] **Step 5: Commit page + funnel together**

```bash
git add \
  services/ops-web/src/app/crm/leads/\[id\]/page.tsx \
  services/ops-web/src/components/LeadFunnelPanel.tsx
git commit -m "$(cat <<'EOF'
feat(crm): hide contract and Deal Room until the matching stage

Lead detail mounts HĐ and Deal Room from S0 visibility flags, not flow kind.
EOF
)"
```

---

### Task 5: Manual VIS checklist + spec pointer

**Files:**
- Modify: `docs/superpowers/specs/2026-08-28-lifecycle-absolute-win-design.md` §13
- Verify on local ops-web (or prod only after deploy — do not `next build` on VPS)

**Interfaces:** none. This task does not change runtime types.

- [ ] **Step 1: Point LIFE-WIN §13 at this plan**

In `docs/superpowers/specs/2026-08-28-lifecycle-absolute-win-design.md`, replace the “Next step” item 2 line:

`2. **writing-plans** → plan S0 (\`lead-stage-visibility\` + page + tests).`

with:

`2. Plan S0: [2026-08-28-lifecycle-s0-stage-visibility.md](../plans/2026-08-28-lifecycle-s0-stage-visibility.md).`

- [ ] **Step 2: Manual VIS against a running ops-web**

Use lead `/crm/leads/5` (B2B, B2 mở) with sidebar **expanded**:

| ID | Check |
|----|--------|
| VIS-01 | DOM has **no** `#lead-contract`. No red HĐ checklist. |
| VIS-02 | No `.deal-room-entry-banner`. |
| VIS-03 | After completing B2 on a test lead (or a lead already B2-done + stage `lead`): `#funnel-presales` shows slug/ensure or Intake link; still no Deal Room banner. |
| VIS-04 | Open a `spa_operational` lead: no `#lead-contract`, no `LeadNextActionCard` rules 5–8, no journey stepper. B2 outcome chips remain if B2 incomplete. |
| VIS-05 | On a B2B lead that already has `contract.status === 'draft'` at stage `lead` or `consult`: `#lead-contract` is present. |

If no local server: start `ops-web` the way this repo already does (do not invent a new start script). If you cannot log in, record which VIS ids were only unit-tested.

- [ ] **Step 3: Commit spec pointer**

```bash
git add docs/superpowers/specs/2026-08-28-lifecycle-absolute-win-design.md
git commit -m "$(cat <<'EOF'
docs: link LIFE-WIN S0 to the stage-visibility plan
EOF
)"
```

---

## Spec coverage (self-review)

| Spec | Task |
|------|------|
| §4.1–4.2 flags + spa all-false except B2 outcome | Task 1 |
| §4.2 Deal Room = `dealRoomEnabled ∧ b2Complete ∧ intakeGo` | Task 1 + Task 3 |
| §4.2 contract = hasContract ∨ proposal ∨ status draft/pending/active | Task 1 + Task 3 fetch |
| §4.2 funnel still mounts for B2; no `#funnel-presales` before B2 | Task 3 + Task 4 |
| §4.2 B2 done + empty/`lead` stage = ensure / Intake only | Task 4 |
| §4.3 journey HĐ not current on bare proposal | Task 2 |
| §4.3 active + lifecycleId → done + service-delivery href | Task 2 |
| §4.4 VIS-01…05 | Task 1 units + Task 5 manual |
| §3 no new API / no new CSS / spa CSKH | Global + Tasks 1–4 |
| §5 NBA HĐ / §6 WS2 / §11 PO | Explicitly out of scope |

## Verify command (after all tasks)

```bash
cd services/ops-web && npx vitest run \
  src/lib/crm/lead-stage-visibility.spec.ts \
  src/lib/crm/lead-journey.spec.ts \
  src/lib/crm/lead-next-action.spec.ts \
  src/lib/crm/lead-b2-outcome.spec.ts
```

Expected: all PASS.
