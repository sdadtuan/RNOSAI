# Lifecycle S1 NBA Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give AM one Next Best Action at proposal / draft HĐ — Tạo HĐ, Gửi GDKD, or Chờ duyệt — plus clickable readiness gates and a softphone → B2 handoff, with no new APIs.

**Architecture:** Pure helpers (`contractCreateReady`, `contractSubmitReady`, `readinessCheckHref`) plus new NBA kinds on `resolveLeadNextAction`. The lead page maps S0’s existing `fetchLeadContractReadiness` into the new NBA inputs. NBA buttons only scroll / route; `LeadContractPanel` still owns create/submit APIs. Softphone callers fire `onCallPlaced`; the B2 card shows a banner and never auto-completes.

**Tech Stack:** Next.js 14 ops-web, React client components, Vitest, existing `fetchLeadContractReadiness` / `placeB2bSoftphoneCall`.

**Spec:** [`docs/superpowers/specs/2026-08-29-lifecycle-s1-nba-contract-design.md`](../specs/2026-08-29-lifecycle-s1-nba-contract-design.md) (LIFE-S1-20260829). Parent: [`2026-08-28-lifecycle-absolute-win-design.md`](../specs/2026-08-28-lifecycle-absolute-win-design.md) §5.

## Global Constraints

- S1 only. Do not implement WS2 Client, WS3 9-step journey, WS4 owner-weekly, or new REST endpoints / HĐ fields.
- Do not invent a “proposal accept” field. Deal Room stays primary when `proposal` and `!hasContract`.
- Do not call `createLeadContract` or `submitLeadContract` from `onNbaAction` (no 0đ draft, no double submit).
- Do not change NBA rule 1–7, 9–10 titles or primary actions (LEAD-WS lock).
- No new CSS file; overlay only in `services/ops-web/src/app/bitrix-theme.css` under `html.ops-shell-bitrix`.
- `spa_operational`: no B2B NBA/journey/contract/Deal Room; keep CSKH SLA + B2 outcome card. Softphone → B2 banner still allowed.
- Two factories stay separate. Do not merge SOPs.
- Do not `next build` ad-hoc on the VPS.
- Do not change Deal Room / Intake / CSKH board / `/crm/hub` internals.
- Keep `showContractForFlow` exported. Do not delete it.
- 「Chờ dọn」 stays in DB; it must not become NBA `title_vi`.
- Hero still **Gọi ngay** when phone exists. Rule 5 card primary stays **Copy script** / `add_activity`.
- One `btn-primary` on the NBA card. Contract panel keeps its own primary in a separate frame.
- Journey contract `current` stays S0 (`hasContract` only). Do not add “all proposal tasks done”.
- Keep `deriveS0IntakeGo`. Do not wire real Intake session decision.

## File map

| File | Role |
|------|------|
| Create `services/ops-web/src/lib/crm/lead-contract-ready.ts` | `contractCreateReady`, `contractSubmitReady`, `readinessCheckHref` |
| Create `services/ops-web/src/lib/crm/lead-contract-ready.spec.ts` | Helper unit tests |
| Modify `services/ops-web/src/lib/crm/lead-next-action.ts` | Four kinds + rule-8 HĐ order |
| Modify `services/ops-web/src/lib/crm/lead-next-action.spec.ts` | S1-N1…N5 |
| Modify `services/ops-web/src/components/crm/LeadNextActionCard.tsx` | Disable `wait_contract_approval` |
| Modify `services/ops-web/src/app/crm/leads/[id]/page.tsx` | NBA inputs, `onNbaAction`, softphone callback |
| Modify `services/ops-web/src/components/LeadContractPanel.tsx` | Gate links, `createReady`, amount/submit ids |
| Modify `services/ops-web/src/components/crm/LeadContactActions.tsx` | `onCallPlaced` |
| Modify `services/ops-web/src/components/crm/LeadMobileCallBar.tsx` | `onCallPlaced` |
| Modify `services/ops-web/src/components/crm/LeadB2OutcomeCard.tsx` | `highlightAfterCall` banner |
| Modify `services/ops-web/src/components/LeadFunnelPanel.tsx` | Pass `highlightAfterCall` |
| Modify `services/ops-web/src/app/bitrix-theme.css` | `.lead-b2-outcome__hint--after-call` |
| Modify `docs/superpowers/specs/2026-08-29-lifecycle-s1-nba-contract-design.md` | Point §14 at this plan |

## Out of scope (reject if a task adds them)

- Agency Client on promote (WS2).
- Owner-weekly / K1–K4 (WS4).
- Auto-complete B2 after call.
- New CSS file, Playwright, `next build` on VPS.

---

### Task 1: Contract ready helpers

**Files:**
- Create: `services/ops-web/src/lib/crm/lead-contract-ready.ts`
- Test: `services/ops-web/src/lib/crm/lead-contract-ready.spec.ts`

**Interfaces:**
- Consumes: check rows shaped `{ key: string; ok: boolean }` (same as `ContractReadinessCheck` in `services/ops-web/src/lib/api.ts` lines 1988–1993).
- Produces:
  - `contractCreateReady(checks): boolean`
  - `contractSubmitReady(checks): boolean`
  - `readinessCheckHref(key: string, leadId: number): string | null`

- [ ] **Step 1: Write the failing tests**

Create `services/ops-web/src/lib/crm/lead-contract-ready.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  contractCreateReady,
  contractSubmitReady,
  readinessCheckHref,
} from './lead-contract-ready';

const upstreamOk = [
  { key: 'b2_complete', ok: true },
  { key: 'presales_active', ok: true },
  { key: 'presales_lead', ok: true },
  { key: 'presales_consult', ok: true },
  { key: 'presales_proposal', ok: true },
  { key: 'marketing_plan', ok: true },
  { key: 'contract_draft', ok: false },
  { key: 'no_pending_approval', ok: true },
];

describe('contractCreateReady', () => {
  it('empty checks → false (not yet fetched)', () => {
    expect(contractCreateReady([])).toBe(false);
  });

  it('S1-G4 upstream ok + no draft → true', () => {
    expect(contractCreateReady(upstreamOk)).toBe(true);
  });

  it('S1-G4 missing B2 → false', () => {
    const checks = upstreamOk.map((c) =>
      c.key === 'b2_complete' ? { ...c, ok: false } : c,
    );
    expect(contractCreateReady(checks)).toBe(false);
  });

  it('ignores contract_draft and no_pending_approval', () => {
    expect(
      contractCreateReady([
        ...upstreamOk,
        { key: 'contract_draft', ok: false },
        { key: 'no_pending_approval', ok: false },
      ]),
    ).toBe(true);
  });
});

describe('contractSubmitReady', () => {
  it('false until every check except no_pending is ok', () => {
    expect(contractSubmitReady(upstreamOk)).toBe(false);
    expect(
      contractSubmitReady(upstreamOk.map((c) => ({ ...c, ok: true }))),
    ).toBe(true);
  });

  it('pending approval does not block submitReady', () => {
    const checks = upstreamOk.map((c) =>
      c.key === 'contract_draft'
        ? { ...c, ok: true }
        : c.key === 'no_pending_approval'
          ? { ...c, ok: false }
          : c,
    );
    expect(contractSubmitReady(checks)).toBe(true);
  });
});

describe('readinessCheckHref', () => {
  it('S1-G1…G3 + remaining keys', () => {
    expect(readinessCheckHref('b2_complete', 5)).toBe('#funnel-b2');
    expect(readinessCheckHref('presales_active', 5)).toBe('#funnel-presales');
    expect(readinessCheckHref('presales_lead', 5)).toBe('/crm/intake?lead_id=5');
    expect(readinessCheckHref('presales_consult', 5)).toBe('#funnel-presales');
    expect(readinessCheckHref('presales_proposal', 5)).toBe('/crm/leads/5/deal-room');
    expect(readinessCheckHref('marketing_plan', 5)).toBe('/crm/leads/5/deal-room');
    expect(readinessCheckHref('contract_draft', 5)).toBe('#lead-contract-amount');
    expect(readinessCheckHref('no_pending_approval', 5)).toBe('/crm/hub');
    expect(readinessCheckHref('unknown_key', 5)).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd services/ops-web && npx vitest run src/lib/crm/lead-contract-ready.spec.ts
```

Expected: FAIL — `Cannot find module './lead-contract-ready'`.

- [ ] **Step 3: Write minimal implementation**

Create `services/ops-web/src/lib/crm/lead-contract-ready.ts`:

```ts
const UPSTREAM_SKIP = new Set(['no_pending_approval', 'contract_draft']);

export function contractCreateReady(checks: Array<{ key: string; ok: boolean }>): boolean {
  const upstream = checks.filter((c) => !UPSTREAM_SKIP.has(c.key));
  return upstream.length > 0 && upstream.every((c) => c.ok);
}

export function contractSubmitReady(checks: Array<{ key: string; ok: boolean }>): boolean {
  return checks.filter((c) => c.key !== 'no_pending_approval').every((c) => c.ok);
}

export function readinessCheckHref(key: string, leadId: number): string | null {
  switch (key) {
    case 'b2_complete':
      return '#funnel-b2';
    case 'presales_active':
    case 'presales_consult':
      return '#funnel-presales';
    case 'presales_lead':
      return `/crm/intake?lead_id=${leadId}`;
    case 'presales_proposal':
    case 'marketing_plan':
      return `/crm/leads/${leadId}/deal-room`;
    case 'contract_draft':
      return '#lead-contract-amount';
    case 'no_pending_approval':
      return '/crm/hub';
    default:
      return null;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd services/ops-web && npx vitest run src/lib/crm/lead-contract-ready.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/ops-web/src/lib/crm/lead-contract-ready.ts \
  services/ops-web/src/lib/crm/lead-contract-ready.spec.ts
git commit -m "$(cat <<'EOF'
feat(crm): add S1 contract readiness helpers

Create/submit gates and checklist hrefs stay pure so NBA and the panel share one formula.
EOF
)"
```

---

### Task 2: NBA kinds and rule-8 order

**Files:**
- Modify: `services/ops-web/src/lib/crm/lead-next-action.ts`
- Test: `services/ops-web/src/lib/crm/lead-next-action.spec.ts`

**Interfaces:**
- Consumes: Task 1 booleans (`submitReady`, `createReady`) plus S0 contract facts. Does not import the helper file — the page will call the helpers.
- Produces: `NextActionKind` adds `create_contract` | `submit_contract` | `wait_contract_approval` | `open_contract_hub`. `LeadNextActionInput` adds the five fields below. All HĐ variants keep `rule: 8`.

- [ ] **Step 1: Extend the fixture and write failing tests**

In `services/ops-web/src/lib/crm/lead-next-action.spec.ts`, add to `base`:

```ts
  hasContract: false,
  contractStatus: null as string | null,
  pendingApproval: false,
  submitReady: false,
  createReady: false,
```

Replace the existing `proposal + deal room → rule 8` case with:

```ts
  it('S1-N1 proposal + deal room + no HĐ → Deal Room primary, Tạo HĐ secondary', () => {
    const out = resolveLeadNextAction({
      ...base,
      b2Complete: true,
      presalesStage: 'proposal',
      prepStatus: 'ready',
      prepStage: 'm2_qualify_win',
    });
    expect(out.rule).toBe(8);
    expect(out.title_vi).toBe('Chuẩn bị buổi chốt');
    expect(out.primary.action).toBe('open_deal_room');
    expect(out.secondary.map((s) => s.action)).toEqual(['create_contract']);
  });
```

Keep `prep_stage m3 also triggers rule 8` unchanged (consult + m3 must **not** get `create_contract`). Add after it:

```ts
  it('m3 at consult does not add Tạo HĐ', () => {
    const out = resolveLeadNextAction({
      ...base,
      b2Complete: true,
      presalesStage: 'consult',
      prepStage: 'm3_pre_close',
      prepStatus: 'ready',
    });
    expect(out.primary.action).toBe('open_deal_room');
    expect(out.secondary.map((s) => s.action)).toEqual(['apply_offer_ladder']);
  });

  it('S1-N2 proposal + Deal Room off + createReady → Tạo HĐ primary', () => {
    const out = resolveLeadNextAction({
      ...base,
      dealRoomEnabled: false,
      b2Complete: true,
      presalesStage: 'proposal',
      createReady: true,
    });
    expect(out.rule).toBe(8);
    expect(out.title_vi).toBe('Tạo HĐ draft');
    expect(out.primary.action).toBe('create_contract');
    expect(out.secondary).toEqual([]);
  });

  it('S1-N2 without createReady does not invent HĐ primary', () => {
    const out = resolveLeadNextAction({
      ...base,
      dealRoomEnabled: false,
      b2Complete: true,
      presalesStage: 'proposal',
      createReady: false,
    });
    expect(out.primary.action).not.toBe('create_contract');
  });

  it('S1-N3 draft + submitReady → Gửi GDKD', () => {
    const out = resolveLeadNextAction({
      ...base,
      b2Complete: true,
      presalesStage: 'proposal',
      hasContract: true,
      contractStatus: 'draft',
      submitReady: true,
    });
    expect(out.rule).toBe(8);
    expect(out.title_vi).toBe('Gửi GDKD duyệt');
    expect(out.primary).toEqual({ label_vi: 'Gửi GDKD duyệt', action: 'submit_contract' });
    expect(out.secondary.map((s) => s.action)).toEqual(['open_contract_hub']);
  });

  it('S1-N4 pending approval beats Deal Room and submit', () => {
    const out = resolveLeadNextAction({
      ...base,
      b2Complete: true,
      presalesStage: 'proposal',
      hasContract: true,
      contractStatus: 'draft',
      pendingApproval: true,
      submitReady: true,
    });
    expect(out.title_vi).toBe('Chờ GDKD duyệt');
    expect(out.primary.action).toBe('wait_contract_approval');
    expect(out.secondary.map((s) => s.action)).toEqual(['open_contract_hub']);
  });

  it('S1-N5 rule 5 title/action unchanged', () => {
    const out = resolveLeadNextAction(base);
    expect(out.rule).toBe(5);
    expect(out.title_vi).toBe('Gọi đầu trong 15 phút');
    expect(out.primary.action).toBe('add_activity');
  });
```

Do not edit the existing rule 1–4, 6, 7, 9, 10 cases except the `base` fields.

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd services/ops-web && npx vitest run src/lib/crm/lead-next-action.spec.ts
```

Expected: FAIL on S1-N1 (secondary still `apply_offer_ladder`) and the new cases (`hasContract` not in type / kinds missing).

- [ ] **Step 3: Write minimal implementation**

In `services/ops-web/src/lib/crm/lead-next-action.ts`:

1. Add the four kinds to `NextActionKind`.

2. Add to `LeadNextActionInput`:

```ts
  hasContract: boolean;
  contractStatus: string | null;
  pendingApproval: boolean;
  submitReady: boolean;
  createReady: boolean;
```

3. Immediately after the rule 9 `return` (debrief) and **before** the `const m3 =` block, insert:

```ts
  const contractStatus = (input.contractStatus ?? '').trim().toLowerCase();

  if (input.pendingApproval) {
    return {
      rule: 8,
      title_vi: 'Chờ GDKD duyệt',
      body_vi: 'Đã gửi — không submit lại.',
      primary: { label_vi: 'Chờ GDKD duyệt', action: 'wait_contract_approval' },
      secondary: [{ label_vi: 'Hub · HĐ chờ duyệt', action: 'open_contract_hub' }],
    };
  }

  if (input.hasContract && contractStatus === 'draft' && input.submitReady) {
    return {
      rule: 8,
      title_vi: 'Gửi GDKD duyệt',
      body_vi: 'Gate đủ — gửi HĐ, GDKD duyệt trên Hub.',
      primary: { label_vi: 'Gửi GDKD duyệt', action: 'submit_contract' },
      secondary: [{ label_vi: 'Hub · HĐ chờ duyệt', action: 'open_contract_hub' }],
    };
  }
```

4. Replace the existing `m3` / rule 8 return so secondary prefers `create_contract` at proposal without a contract:

```ts
  const m3 =
    input.dealRoomEnabled &&
    input.b2Complete &&
    (prepStage === 'm3_pre_close' || stage === 'proposal');
  if (m3) {
    const secondary: LeadNextAction['secondary'] =
      stage === 'proposal' && !input.hasContract
        ? [{ label_vi: 'Tạo HĐ draft', action: 'create_contract' }]
        : prep === 'ready'
          ? [{ label_vi: 'Tạo báo giá 3 gói', action: 'apply_offer_ladder' }]
          : [];
    return {
      rule: 8,
      title_vi: 'Chuẩn bị buổi chốt',
      body_vi: 'Mở Deal Room — narrative, 3 gói, close ask.',
      primary: { label_vi: 'Mở Deal Room', action: 'open_deal_room' },
      secondary,
    };
  }

  if (stage === 'proposal' && !input.hasContract && !input.dealRoomEnabled && input.createReady) {
    return {
      rule: 8,
      title_vi: 'Tạo HĐ draft',
      body_vi: 'Deal Room tắt — tạo draft trên panel HĐ.',
      primary: { label_vi: 'Tạo HĐ draft', action: 'create_contract' },
      secondary: [],
    };
  }
```

Leave rule 7 → 6 → 5 → 10 untouched.

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd services/ops-web && npx vitest run src/lib/crm/lead-next-action.spec.ts
```

Expected: PASS — previous cases plus S1-N1…N5.

- [ ] **Step 5: Commit**

```bash
git add services/ops-web/src/lib/crm/lead-next-action.ts \
  services/ops-web/src/lib/crm/lead-next-action.spec.ts
git commit -m "$(cat <<'EOF'
feat(crm): add S1 contract kinds to next-best-action

Deal Room stays primary until a draft exists; submit and wait beat rule 8 after that.
EOF
)"
```

---

### Task 3: Wire NBA on the lead page

**Files:**
- Modify: `services/ops-web/src/app/crm/leads/[id]/page.tsx`
- Modify: `services/ops-web/src/components/crm/LeadNextActionCard.tsx`

**Interfaces:**
- Consumes: `resolveLeadNextAction` fields from Task 2; `contractCreateReady` / `contractSubmitReady` from Task 1; S0 `fetchLeadContractReadiness` effect (~684–710).
- Produces: page-local `contractChecks`; NBA handlers for the four new kinds. Do not call create/submit APIs.

- [ ] **Step 1: Disable wait on the NBA card**

In `services/ops-web/src/components/crm/LeadNextActionCard.tsx`, extend the primary `disabled` condition (~80–84):

```tsx
            disabled={
              busy ||
              action.primary.action === 'wait_prep' ||
              action.primary.action === 'wait_handoff' ||
              action.primary.action === 'wait_contract_approval' ||
              (action.rule === 2 && !companyName.trim())
            }
```

- [ ] **Step 2: Store readiness checks on the page**

In `services/ops-web/src/app/crm/leads/[id]/page.tsx`:

1. Import:

```ts
import { contractCreateReady, contractSubmitReady } from '@/lib/crm/lead-contract-ready';
```

2. Next to `contractSummary` state add:

```ts
  const [contractChecks, setContractChecks] = useState<Array<{ key: string; ok: boolean }>>([]);
```

3. In the `leadId` reset effect, also `setContractChecks([])`.

4. In the readiness `.then`, after `setContractSummary(...)`:

```ts
        setContractChecks(data.checks ?? []);
```

In the `.catch` (and keep fail-closed):

```ts
        setContractChecks([]);
```

Do not add `submitReady` / `createReady` onto `LeadContractFlowSummary`.

- [ ] **Step 3: Pass HĐ fields into `resolveLeadNextAction`**

Replace the `nba` `useMemo` input with:

```ts
    return resolveLeadNextAction({
      lmpEnabled: showLmpTab,
      dealRoomEnabled: dealRoomEnabled(),
      phone: lead.phone ?? '',
      email: lead.email ?? '',
      leadStatus: lead.status ?? '',
      b2Complete: Boolean(funnelSnap?.care_pipeline.all_complete),
      presalesStage: funnelSnap?.presales?.presales.stage ?? null,
      prepStatus: prep?.status ?? null,
      prepStage: prep?.prep_stage ?? null,
      debriefPending: Boolean(prep?.debrief_pending),
      handoffStatus: funnelSnap?.presales?.handoff?.status ?? null,
      hasContract: Boolean(contractSummary?.hasContract),
      contractStatus: contractSummary?.contractStatus ?? null,
      pendingApproval: Boolean(contractSummary?.pendingApproval),
      submitReady: contractSubmitReady(contractChecks),
      createReady: contractCreateReady(contractChecks),
    });
```

Add `contractSummary` and `contractChecks` to the `useMemo` dependency array.

- [ ] **Step 4: Handle the four kinds in `onNbaAction`**

Inside the `switch (kind)` in `onNbaAction`, add **before** `default:`:

```ts
      case 'create_contract': {
        document.getElementById('lead-contract')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        document.getElementById('lead-contract-amount')?.focus();
        break;
      }
      case 'submit_contract': {
        document.getElementById('lead-contract')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        document.getElementById('lead-contract-submit')?.focus();
        break;
      }
      case 'wait_contract_approval':
        break;
      case 'open_contract_hub':
        router.push('/crm/hub');
        break;
```

Do **not** import or call `createLeadContract` / `submitLeadContract` here.

- [ ] **Step 5: Typecheck the touched files**

```bash
cd services/ops-web && npx tsc --noEmit --pretty false 2>&1 | rg "lead-next-action|LeadNextActionCard|leads/\[id\]/page" || true
```

Expected: no hits. `LeadContractPanel` ids land in Task 4 — missing ids are runtime-only, not a tsc error.

- [ ] **Step 6: Commit**

```bash
git add \
  services/ops-web/src/components/crm/LeadNextActionCard.tsx \
  services/ops-web/src/app/crm/leads/\[id\]/page.tsx
git commit -m "$(cat <<'EOF'
feat(crm): wire S1 contract NBA on lead detail

Page maps readiness checks into NBA; actions only scroll or open Hub.
EOF
)"
```

---

### Task 4: Contract panel gates and create lock

**Files:**
- Modify: `services/ops-web/src/components/LeadContractPanel.tsx`

**Interfaces:**
- Consumes: `contractCreateReady`, `contractSubmitReady`, `readinessCheckHref` from Task 1.
- Produces: clickable failed checks; `#lead-contract-amount` / `#lead-contract-submit`; create button disabled when `!createReady`. `onLoaded` summary shape unchanged.

- [ ] **Step 1: Import helpers and compute flags**

At the top of `LeadContractPanel.tsx` add:

```ts
import {
  contractCreateReady,
  contractSubmitReady,
  readinessCheckHref,
} from '@/lib/crm/lead-contract-ready';
```

Replace:

```ts
  const submitReady = checks.filter((c) => c.key !== 'no_pending_approval').every((c) => c.ok);
```

with:

```ts
  const submitReady = contractSubmitReady(checks);
  const createReady = contractCreateReady(checks);
```

- [ ] **Step 2: Link failed checks**

Replace the `<li>` body inside `checks.map` with:

```tsx
        {checks.map((c) => {
          const href = !c.ok ? readinessCheckHref(c.key, leadId) : null;
          return (
            <li key={c.key} style={{ color: c.ok ? 'var(--success, #16a34a)' : 'var(--error, #dc2626)' }}>
              {c.ok ? '✓' : '○'}{' '}
              {href ? (
                <Link href={href} className="nav-link">
                  {c.label}
                </Link>
              ) : (
                c.label
              )}
              {c.message && !c.ok ? ` — ${c.message}` : ''}
            </li>
          );
        })}
```

`Link` is already imported from `next/link`.

- [ ] **Step 3: Ids + disable create**

On **both** VND `<input>` elements (create block and draft block), add `id="lead-contract-amount"` to the first one only (create block). On the draft-block input add `id="lead-contract-amount"` as well — when both mount they never coexist (`!contract` vs `contract.status === 'draft'`). Duplicate ids in one render are forbidden; these branches are exclusive.

Create button:

```tsx
          <button
            type="button"
            className="btn btn-sm btn-primary"
            disabled={busy || !createReady}
            onClick={() => void onCreateDraft()}
          >
            Tạo HĐ draft
          </button>
```

Submit button — add `id="lead-contract-submit"`; keep `disabled={busy || !submitReady}`.

Do not remove the `/agency/clients/new` link in this task (WS2). Do not change backend checks.

- [ ] **Step 4: Run helper + NBA specs (no panel unit file exists)**

```bash
cd services/ops-web && npx vitest run \
  src/lib/crm/lead-contract-ready.spec.ts \
  src/lib/crm/lead-next-action.spec.ts
```

Expected: PASS.

```bash
cd services/ops-web && npx tsc --noEmit --pretty false 2>&1 | rg "LeadContractPanel|lead-contract-ready" || true
```

Expected: no hits.

- [ ] **Step 5: Commit**

```bash
git add services/ops-web/src/components/LeadContractPanel.tsx
git commit -m "$(cat <<'EOF'
feat(crm): link contract readiness gates and lock draft create

Failed checks jump to B2, Intake, or Deal Room; create stays disabled until upstream gates pass.
EOF
)"
```

---

### Task 5: Softphone → B2 banner

**Files:**
- Modify: `services/ops-web/src/components/crm/LeadContactActions.tsx`
- Modify: `services/ops-web/src/components/crm/LeadMobileCallBar.tsx`
- Modify: `services/ops-web/src/components/crm/LeadB2OutcomeCard.tsx`
- Modify: `services/ops-web/src/components/LeadFunnelPanel.tsx`
- Modify: `services/ops-web/src/app/crm/leads/[id]/page.tsx`
- Modify: `services/ops-web/src/app/bitrix-theme.css`

**Interfaces:**
- Consumes: `placeB2bSoftphoneCall` return `'webrtc' | 'server' | 'tel'` (do not edit `B2bSoftphone.tsx`).
- Produces: `onCallPlaced?: (mode: 'webrtc' | 'server' | 'tel') => void` on both call UIs; `highlightAfterCall?: boolean` on the B2 card. No B2 complete API from the callback.

- [ ] **Step 1: Add `onCallPlaced` to both call UIs**

`LeadContactActions.tsx` — add optional prop `onCallPlaced?: (mode: 'webrtc' | 'server' | 'tel') => void`. After `await placeB2bSoftphoneCall(...)` succeeds (inside the `try`, before catch), call `onCallPlaced?.(mode)` with the return value:

```ts
    try {
      const mode = await placeB2bSoftphoneCall({ accessToken, leadId, phone });
      onCallPlaced?.(mode);
    } catch (err) {
```

Do **not** call `onCallPlaced` in the catch (including `tel` fallback after throw). Spec: no banner when the helper throws.

`LeadMobileCallBar.tsx` — same prop and same `try` pattern. The existing catch still does `tel` fallback; that path does **not** fire `onCallPlaced`.

- [ ] **Step 2: Banner on `LeadB2OutcomeCard`**

Add `highlightAfterCall?: boolean` to props. After the chips, when true, render:

```tsx
      {highlightAfterCall ? (
        <p className="lead-b2-outcome__hint lead-b2-outcome__hint--after-call">
          Vừa gọi. Chọn kết quả rồi bấm Xong B2.
        </p>
      ) : null}
```

Do not call `onSubmit` from this prop. Chip default stays `talked`.

- [ ] **Step 3: Thread the flag through the funnel**

In `LeadFunnelPanel` `Props` add `highlightAfterCall?: boolean` (default false). Destructure it. Pass to `LeadB2OutcomeCard`:

```tsx
            highlightAfterCall={highlightAfterCall}
```

- [ ] **Step 4: Page callback**

In `page.tsx` add `const [b2CallJustPlaced, setB2CallJustPlaced] = useState(false);`. Reset it to `false` in the `leadId` reset effect.

```ts
  const onSoftphonePlaced = useCallback(() => {
    if (funnelSnap?.care_pipeline.all_complete) return;
    setB2CallJustPlaced(true);
    document.getElementById('funnel-b2')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [funnelSnap]);
```

Pass `onCallPlaced={onSoftphonePlaced}` to `LeadContactActions` and `LeadMobileCallBar`.

Pass `highlightAfterCall={b2CallJustPlaced}` to `LeadFunnelPanel`.

- [ ] **Step 5: Overlay CSS**

In `services/ops-web/src/app/bitrix-theme.css`, immediately after `.lead-b2-outcome__hint--warn`:

```css
html.ops-shell-bitrix .lead-b2-outcome__hint--after-call {
  color: #17692f;
  font-weight: 600;
}
```

- [ ] **Step 6: Run focused specs + tsc filter**

```bash
cd services/ops-web && npx vitest run \
  src/lib/crm/lead-contract-ready.spec.ts \
  src/lib/crm/lead-next-action.spec.ts \
  src/lib/crm/lead-b2-outcome.spec.ts \
  src/lib/crm/lead-stage-visibility.spec.ts \
  src/lib/crm/lead-journey.spec.ts
```

Expected: all PASS (b2-outcome file unchanged).

```bash
cd services/ops-web && npx tsc --noEmit --pretty false 2>&1 | rg "LeadContactActions|LeadMobileCallBar|LeadB2OutcomeCard|LeadFunnelPanel|leads/\[id\]/page" || true
```

Expected: no hits.

- [ ] **Step 7: Commit**

```bash
git add \
  services/ops-web/src/components/crm/LeadContactActions.tsx \
  services/ops-web/src/components/crm/LeadMobileCallBar.tsx \
  services/ops-web/src/components/crm/LeadB2OutcomeCard.tsx \
  services/ops-web/src/components/LeadFunnelPanel.tsx \
  services/ops-web/src/app/crm/leads/\[id\]/page.tsx \
  services/ops-web/src/app/bitrix-theme.css
git commit -m "$(cat <<'EOF'
feat(crm): focus B2 outcome after a successful softphone call

Scroll to the call-result card and hint AM to confirm; do not auto-complete B2.
EOF
)"
```

---

### Task 6: Spec pointer + verify

**Files:**
- Modify: `docs/superpowers/specs/2026-08-29-lifecycle-s1-nba-contract-design.md` §14

**Interfaces:** none.

- [ ] **Step 1: Point S1 spec §14 at this plan**

Replace:

`2. **writing-plans** → \`docs/superpowers/plans/2026-08-29-lifecycle-s1-nba-contract.md\`.`

with:

`2. Plan S1: [2026-08-29-lifecycle-s1-nba-contract.md](../plans/2026-08-29-lifecycle-s1-nba-contract.md).`

- [ ] **Step 2: Run the spec verify command**

```bash
cd services/ops-web && npx vitest run \
  src/lib/crm/lead-next-action.spec.ts \
  src/lib/crm/lead-contract-ready.spec.ts \
  src/lib/crm/lead-stage-visibility.spec.ts \
  src/lib/crm/lead-journey.spec.ts \
  src/lib/crm/lead-b2-outcome.spec.ts
```

Expected: all PASS.

Manual (if ops-web is logged in): proposal lead = S1-N1; lead #5 sidebar open = S0 VIS-01/02 still hold; one softphone attempt = banner, no B2 auto-complete. If no server, record unit-only in the commit message body is not required — note it in the implementer report.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs/2026-08-29-lifecycle-s1-nba-contract-design.md
git commit -m "$(cat <<'EOF'
docs: link LIFE-S1 spec to the NBA-contract plan
EOF
)"
```

---

## Spec coverage (self-review)

| Spec | Task |
|------|------|
| §4.1–4.2 kinds + evaluation order | Task 2 |
| §4.3 copy | Task 2 |
| §4.4 onNbaAction scroll / Hub | Task 3 |
| §5 createReady / submitReady | Task 1 + Task 4 |
| §6 gate href table | Task 1 + Task 4 |
| §7 softphone banner, no auto-B2 | Task 5 |
| §9 S1-N1…N5 | Task 2 |
| §9 S1-G1…G4 | Task 1 + Task 4 |
| §9 S1-P1/P2 | Task 5 (P2: no callback on throw) |
| §9 S1-S spa | Unchanged `showNbaB2b`; no page NBA kinds on spa |
| §2.2 out of scope | Global Constraints |

## Verify command (after all tasks)

```bash
cd services/ops-web && npx vitest run \
  src/lib/crm/lead-next-action.spec.ts \
  src/lib/crm/lead-contract-ready.spec.ts \
  src/lib/crm/lead-stage-visibility.spec.ts \
  src/lib/crm/lead-journey.spec.ts \
  src/lib/crm/lead-b2-outcome.spec.ts
```
