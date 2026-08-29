# Lifecycle WS2 Promote → Agency Client Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When GDKD approves a B2B contract, the promote transaction creates or links an Agency Client draft (`onboarding`), writes `agency_client_id` on the contract and lead, and the lead panel shows **Mở Agency Client** instead of manual `/agency/clients/new`.

**Architecture:** Pure helpers in `contract-promote-client.util.ts` (name, code, dedup decisions) plus PG I/O in `ContractPromotePgUtil.ensureAgencyClientOnPromote` inside the existing approve transaction. `AgencySideEffectsService.onClientCreated` runs **after COMMIT** in `LeadsContractService.approve` only when `agency_client_link_mode === 'created'`. ops-web adds `agency_client_id` to `LeadContractRow` and switches the active-contract CTA.

**Tech Stack:** NestJS `ptt-crm-api`, PostgreSQL (`clients`, `crm_contracts`, `crm_leads`), Jest, Next.js ops-web `LeadContractPanel`.

**Spec:** [`docs/superpowers/specs/2026-08-29-lifecycle-ws2-promote-agency-client-design.md`](../specs/2026-08-29-lifecycle-ws2-promote-agency-client-design.md) (LIFE-WS2-20260829). Parent: [`2026-08-28-lifecycle-absolute-win-design.md`](../specs/2026-08-28-lifecycle-absolute-win-design.md) §6 WS2.

## Global Constraints

- WS2 only. Do not implement WS3 journey, WS4 owner-weekly, NBA post-won kinds, or new public REST routes.
- PG promote path only — no SQLite dual-write (LIFE-WIN §10).
- Do not auto-set client `status=active` on promote. Checklist SYS-UC-001 unchanged.
- Do not require MST / brand / Meta Page ID at promote time.
- Fail-soft on duplicate company name — never fail approve for dedup (WS2-03/04).
- Do not add a new card on `/crm/leads/[id]`. Panel change only.
- Do not change `lead-next-action.ts`.
- `onClientCreated` / workflow side effects **after COMMIT**, not inside the SQL transaction.
- Keep `/agency/clients/new` route; hide it on happy path when `agency_client_id` is set.
- Do not `next build` ad-hoc on VPS.
- Branch: `feat/lifecycle-ws2-promote-client` from `main`.

## File map

| File | Role |
|------|------|
| Create `services/ptt-crm-api/src/leads-contract/contract-promote-client.util.ts` | Pure: name, code, notes, link-mode types |
| Create `services/ptt-crm-api/src/leads-contract/contract-promote-client.util.spec.ts` | Unit tests WS2-03/04/05 pure logic |
| Modify `services/ptt-crm-api/src/leads-contract/contract.types.ts` | `AgencyClientLinkMode`, promote result types |
| Modify `services/ptt-crm-api/src/leads-contract/contract-promote-pg.util.ts` | `ensureAgencyClientOnPromote`, extend return |
| Create `services/ptt-crm-api/src/leads-contract/contract-promote-client-pg.util.ts` | PG queries: resolve, insert, link |
| Create `services/ptt-crm-api/src/leads-contract/contract-promote-client-pg.util.spec.ts` | Mock `PoolClient` integration tests |
| Modify `services/ptt-crm-api/src/leads-contract/leads-contract-pg.repository.ts` | Forward new fields from promote |
| Modify `services/ptt-crm-api/src/leads-contract/leads-contract.service.ts` | After-commit `onClientCreated` |
| Modify `services/ptt-crm-api/src/leads-contract/leads-contract.module.ts` | `forwardRef(() => AgencyModule)` |
| Modify `services/ops-web/src/lib/api.ts` | `LeadContractRow.agency_client_id`, approve response |
| Modify `services/ops-web/src/components/LeadContractPanel.tsx` | Mở Client CTA + ambiguous banner |
| Modify `docs/superpowers/specs/2026-08-29-lifecycle-ws2-promote-agency-client-design.md` | §14 → this plan |

## Out of scope (reject if a task adds them)

- WS3 / WS4 / NBA changes.
- Redesign Agency onboarding UI.
- DDL unless VPS probe proves missing column (Task 0).
- Playwright E2E.

---

### Task 0: PG column probe (VPS / local)

**Files:** None (read-only)

- [ ] **Step 1: Verify columns exist**

Run locally or on VPS:

```bash
psql "$DATABASE_URL" -c "\d crm_contracts" | rg agency_client_id
psql "$DATABASE_URL" -c "\d crm_leads" | rg agency_client_id
psql "$DATABASE_URL" -c "\d clients" | rg -E 'code|name|status'
```

Expected: `crm_contracts.agency_client_id` (TEXT), `crm_leads.agency_client_id` (UUID nullable), `clients` table with `code`, `name`, `status`, `owner_am_id`.

- [ ] **Step 2: If `crm_leads.agency_client_id` missing**

Add idempotent DDL script `docs/specs/2026-08-29-ws2-agency-client-id-bridge.sql` (ALTER IF NOT EXISTS only). **Do not** run on VPS unless probe fails.

---

### Task 1: Types + pure promote-client helpers

**Files:**
- Modify: `services/ptt-crm-api/src/leads-contract/contract.types.ts`
- Create: `services/ptt-crm-api/src/leads-contract/contract-promote-client.util.ts`
- Test: `services/ptt-crm-api/src/leads-contract/contract-promote-client.util.spec.ts`

**Interfaces:**
- Produces:
  - `AgencyClientLinkMode = 'created' | 'link_preexisting' | 'link_lead' | 'link_dedup_name' | 'link_ambiguous'`
  - `PromoteAgencyClientResult { agency_client_id: string; agency_client_link_mode: AgencyClientLinkMode }`
  - `resolvePromoteClientName(meta: Record<string, unknown>, fullName: string): string`
  - `generatePromoteClientCode(leadId: number, takenCodes: Set<string>): string`
  - `buildPromoteClientNotes(contractId: number, leadId: number, lifecycleId: number, needsMerge: boolean): string`
  - `pickDedupClientId(candidates: string[]): { mode: AgencyClientLinkMode; clientId: string | null; ambiguousIds: string[] }`

- [ ] **Step 1: Write the failing tests**

Create `contract-promote-client.util.spec.ts`:

```ts
import {
  buildPromoteClientNotes,
  generatePromoteClientCode,
  pickDedupClientId,
  resolvePromoteClientName,
} from './contract-promote-client.util';

describe('resolvePromoteClientName', () => {
  it('prefers meta.company then company_name then full_name', () => {
    expect(resolvePromoteClientName({ company: ' ACME ' }, 'Person')).toBe('ACME');
    expect(resolvePromoteClientName({ company_name: 'Beta Co' }, 'Person')).toBe('Beta Co');
    expect(resolvePromoteClientName({}, '  Nguyễn A  ')).toBe('Nguyễn A');
  });
});

describe('generatePromoteClientCode', () => {
  it('WS2: L{leadId} then suffix on collision', () => {
    const taken = new Set<string>(['L5']);
    expect(generatePromoteClientCode(5, new Set())).toBe('L5');
    expect(generatePromoteClientCode(5, taken)).toBe('L5A');
    expect(generatePromoteClientCode(5, new Set(['L5', 'L5A']))).toBe('L5B');
  });
});

describe('pickDedupClientId', () => {
  it('WS2-03 single candidate → link_dedup_name', () => {
    const out = pickDedupClientId(['uuid-1']);
    expect(out).toEqual({ mode: 'link_dedup_name', clientId: 'uuid-1', ambiguousIds: [] });
  });

  it('WS2-04 multiple candidates → link_ambiguous', () => {
    const out = pickDedupClientId(['a', 'b']);
    expect(out.mode).toBe('link_ambiguous');
    expect(out.clientId).toBeNull();
    expect(out.ambiguousIds).toEqual(['a', 'b']);
  });

  it('zero candidates → created path (null id)', () => {
    expect(pickDedupClientId([])).toEqual({ mode: 'created', clientId: null, ambiguousIds: [] });
  });
});

describe('buildPromoteClientNotes', () => {
  it('includes contract/lead/lifecycle and needs_merge tag', () => {
    expect(buildPromoteClientNotes(9, 5, 12, false)).toContain('Promote HĐ #9');
    expect(buildPromoteClientNotes(9, 5, 12, true)).toContain('[needs_merge]');
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd services/ptt-crm-api && npm test -- --testPathPattern=contract-promote-client.util.spec
```

- [ ] **Step 3: Implement helpers + types**

Add to `contract.types.ts`:

```ts
export type AgencyClientLinkMode =
  | 'created'
  | 'link_preexisting'
  | 'link_lead'
  | 'link_dedup_name'
  | 'link_ambiguous';

export interface PromoteAgencyClientResult {
  agency_client_id: string;
  agency_client_link_mode: AgencyClientLinkMode;
}
```

Create `contract-promote-client.util.ts` with the four exported functions (max name 240 chars; code regex `[A-Za-z0-9][A-Za-z0-9_-]{1,30}`).

- [ ] **Step 4: Run test — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add services/ptt-crm-api/src/leads-contract/contract.types.ts \
  services/ptt-crm-api/src/leads-contract/contract-promote-client.util.ts \
  services/ptt-crm-api/src/leads-contract/contract-promote-client.util.spec.ts
git commit -m "feat(crm): add pure helpers for promote agency client resolve"
```

---

### Task 2: PG ensure client on promote

**Files:**
- Create: `services/ptt-crm-api/src/leads-contract/contract-promote-client-pg.util.ts`
- Modify: `services/ptt-crm-api/src/leads-contract/contract-promote-pg.util.ts`
- Test: `services/ptt-crm-api/src/leads-contract/contract-promote-client-pg.util.spec.ts`

**Interfaces:**
- Consumes: Task 1 helpers + `PoolClient`
- Produces:
  - `ensureAgencyClientOnPromote(client, input): Promise<PromoteAgencyClientResult>`
  - Input shape:

```ts
export interface EnsureAgencyClientInput {
  contractId: number;
  leadId: number;
  lifecycleId: number;
  contractAgencyClientId: string;
  leadAgencyClientId: string;
  leadMeta: Record<string, unknown>;
  leadFullName: string;
  serviceSlug: string;
  assignedAmStaffId: number | null;
  leadOwnerStaffId: number | null;
  actorEmail: string;
}
```

- [ ] **Step 1: Write failing PG util spec (mock client)**

Create `contract-promote-client-pg.util.spec.ts` with a mock `PoolClient` whose `query` returns staged rows:

1. **WS2-05 preexisting:** `contractAgencyClientId` valid UUID → single `SELECT FROM clients` hit → mode `link_preexisting`, no INSERT.
2. **WS2-01 created:** empty ids, dedup returns 0 rows → INSERT clients, UPDATE contract + lead, event `client_linked`.
3. **WS2-03 dedup:** dedup query returns one id → link, no INSERT.

- [ ] **Step 2: Run — expect FAIL**

```bash
cd services/ptt-crm-api && npm test -- --testPathPattern=contract-promote-client-pg.util.spec
```

- [ ] **Step 3: Implement `contract-promote-client-pg.util.ts`**

Algorithm (spec §5.2):

1. `isValidUuid(s)` — reuse UUID regex from `facebook-hub.util.ts` pattern.
2. Preexisting contract id → verify exists → return.
3. Lead `agency_client_id` → verify exists → return.
4. Name dedup: `SELECT id::text FROM clients WHERE lower(trim(name)) = lower(trim($1)) AND status NOT IN ('offboarded','archived')`.
5. `pickDedupClientId` → if ambiguous, INSERT new with `[needs_merge]` notes + payload `ambiguous_ids` in event.
6. If create: resolve code via `generatePromoteClientCode(leadId, takenCodes from SELECT code WHERE code LIKE 'L{leadId}%')`.
7. Resolve `owner_am_id` email:

```sql
SELECT NULLIF(trim(email), '') FROM crm_staff WHERE id = $1 LIMIT 1
```

Fallback order: `assignedAmStaffId` → `leadOwnerStaffId` → `actorEmail`.

8. INSERT:

```sql
INSERT INTO clients (code, name, industry_slug, status, owner_am_id, notes)
VALUES ($1, $2, NULL, 'onboarding', $3, $4)
RETURNING id::text
```

9. `SELECT seed_client_onboarding($1::uuid)` in try/catch (mirror `agency.repository.ts`).

10. UPDATE:

```sql
UPDATE crm_contracts SET agency_client_id = $2, updated_at = NOW() WHERE id = $1
UPDATE crm_leads SET agency_client_id = $2::uuid, updated_at = NOW() WHERE sqlite_lead_id = $1
```

11. Log via injected callback or return payload for caller to `logContractEvent(..., 'client_linked', ...)`.

**Do not** call `AgencySideEffectsService` here.

- [ ] **Step 4: Wire into `ContractPromotePgUtil.run`**

After `promotePresalesToLifecycle`, before lead `won` update (or immediately after lifecycle id known):

```ts
const clientResult = await ensureAgencyClientOnPromote(client, {
  contractId,
  leadId,
  lifecycleId,
  contractAgencyClientId: String(contract.agency_client_id ?? ''),
  leadAgencyClientId: String(leadRow.agency_client_id ?? ''),
  // ...fetch lead meta/full_name in same util or pass from run()
});
```

Extend early-return path (already converted presales): if lifecycle exists but `agency_client_id` empty, still run ensure (backfill WS2 spec §5.4).

Extend return type of `run()`:

```ts
Promise<{
  lifecycle_id: number;
  customer_id: number;
  case_id: number | null;
  presales_id: number;
  agency_client_id: string;
  agency_client_link_mode: AgencyClientLinkMode;
}>
```

- [ ] **Step 5: Run tests — expect PASS**

```bash
cd services/ptt-crm-api && npm test -- --testPathPattern=contract-promote-client
```

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(crm): ensure agency client on contract promote (PG)"
```

---

### Task 3: Repository + service after-commit side effects

**Files:**
- Modify: `services/ptt-crm-api/src/leads-contract/leads-contract-pg.repository.ts`
- Modify: `services/ptt-crm-api/src/leads-contract/leads-contract.service.ts`
- Modify: `services/ptt-crm-api/src/leads-contract/leads-contract.module.ts`

**Interfaces:**
- Consumes: `PromoteAgencyClientResult` from Task 2
- Produces: Approve API response includes `agency_client_id`, `agency_client_link_mode`

- [ ] **Step 1: Extend `approveAndPromote` return**

In `leads-contract-pg.repository.ts`, add to return object:

```ts
agency_client_id: promote.agency_client_id,
agency_client_link_mode: promote.agency_client_link_mode,
```

Ensure `mapContract` after commit exposes `agency_client_id` on `contract` (already mapped at line 51).

- [ ] **Step 2: Wire side effects in service**

In `leads-contract.service.ts`:

```ts
constructor(
  private readonly pgRepo: LeadsContractPgRepository,
  private readonly sopAutoStart: SopAutoStartService,
  private readonly b2bCommissionLedger: B2bCommissionLedgerService,
  @Optional() private readonly agencySideEffects?: AgencySideEffectsService,
) {}

async approve(approvalId: number, actor: string) {
  const result = await this.pgRepo.approveAndPromote(approvalId, actor);
  // ... existing ledger + sop ...
  if (
    result.agency_client_link_mode === 'created' &&
    result.agency_client_id &&
    this.agencySideEffects
  ) {
    void this.agencySideEffects
      .onClientCreated(result.agency_client_id, actor)
      .catch(() => undefined);
  }
  return { ...result, sop_auto_start: sop };
}
```

- [ ] **Step 3: Module import**

```ts
// leads-contract.module.ts
import { AgencyModule } from '../agency/agency.module';

@Module({
  imports: [
    forwardRef(() => AgencyModule),
    // ...existing
  ],
})
```

Use `@Optional()` on side effects to keep unit tests simple if module not loaded.

- [ ] **Step 4: Run Nest build + existing tests**

```bash
cd services/ptt-crm-api && npm run build
cd services/ptt-crm-api && npm test -- --testPathPattern=contract-promote
```

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(crm): bubble agency_client_id on approve and run onboarding side effect"
```

---

### Task 4: ops-web types + LeadContractPanel CTA

**Files:**
- Modify: `services/ops-web/src/lib/api.ts`
- Modify: `services/ops-web/src/components/LeadContractPanel.tsx`

**Interfaces:**
- Consumes: API `contract.agency_client_id` string
- Produces: WS2-02 UI — **Mở Agency Client** link

- [ ] **Step 1: Extend `LeadContractRow`**

In `api.ts`:

```ts
export interface LeadContractRow {
  id: number;
  lead_id: number | null;
  title: string;
  status: string;
  amount_vnd: number;
  service_slug: string;
  signed_on: string;
  notes: string;
  agency_client_id?: string;
}
```

Extend `approveContractApproval` return type:

```ts
agency_client_id?: string;
agency_client_link_mode?: string;
```

- [ ] **Step 2: Update active-contract block in `LeadContractPanel.tsx`**

Replace lines ~258–288 (active HĐ section):

```tsx
{contract?.status === 'active' ? (
  <div className="lead-contract-active" /* keep existing inline styles */>
    <strong>HĐ đã ký Active</strong>
    {lifecycleId ? (
      <p style={{ margin: '0.35rem 0 0' }}>
        Lifecycle #{lifecycleId} ·{' '}
        <Link href={`/crm/service-delivery/${lifecycleId}`} className="nav-link">
          Mở workflow triển khai →
        </Link>
        {contract.agency_client_id?.trim() ? (
          <>
            {' · '}
            <Link
              href={`/agency/clients/${encodeURIComponent(contract.agency_client_id.trim())}`}
              className="nav-link"
            >
              Mở Agency Client →
            </Link>
          </>
        ) : (
          <>
            {' · '}
            <Link href="/agency/clients/new" className="nav-link">
              Tạo Agency Client →
            </Link>
            <span className="muted" style={{ display: 'block', marginTop: '0.25rem' }}>
              HĐ promote trước WS2 — tạo client thủ công nếu chưa có link tự động.
            </span>
          </>
        )}
      </p>
    ) : (
      /* existing loading copy */
    )}
    {contract.notes?.includes('[needs_merge]') ? (
      <p className="muted" style={{ marginTop: '0.35rem', color: 'var(--warning, #ca8a04)' }}>
        Trùng tên client — Ops review merge trên Agency Client.
      </p>
    ) : null}
  </div>
) : null}
```

No new CSS file. Reuse existing panel styles.

- [ ] **Step 3: Typecheck ops-web**

```bash
cd services/ops-web && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(crm): lead contract panel links auto-created agency client"
```

---

### Task 5: Verification gate + docs

**Files:**
- Modify: `docs/superpowers/specs/2026-08-29-lifecycle-ws2-promote-agency-client-design.md` §14

- [ ] **Step 1: Run full WS2 test bundle**

```bash
cd services/ptt-crm-api && npm test -- --testPathPattern=contract-promote-client
cd services/ops-web && npx tsc --noEmit
```

Expected: all PASS, no TS errors.

- [ ] **Step 2: Manual UAT checklist (pilot HĐ)**

| ID | Action |
|----|--------|
| WS2-01 | Approve B2B HĐ → `clients` row `onboarding`; contract + lead same UUID |
| WS2-02 | Lead panel → **Mở Agency Client**, not forced `/new` |
| WS2-07 | `/crm/service-delivery/{lifecycleId}` onboard widget — no missing client error |

- [ ] **Step 3: Update spec §14**

Point to this plan file; note ship commit hash when merged.

- [ ] **Step 4: Commit docs**

```bash
git add docs/superpowers/specs/2026-08-29-lifecycle-ws2-promote-agency-client-design.md
git commit -m "docs: link WS2 spec to promote agency client plan"
```

---

## Plan self-review

| Spec requirement | Task |
|------------------|------|
| §5.2 resolve algorithm | Task 2 |
| §5.3 return type | Tasks 2–3 |
| §5.4 idempotency / backfill | Task 2 early-return |
| §6 API payload | Task 3 |
| §7 UI panel | Task 4 |
| §8 WS2-01…08 | Tasks 2–5 |
| Side effect after COMMIT | Task 3 |
| PG only | Global constraints |
| No NBA / WS3 / WS4 | Out of scope |

No TBD placeholders in task steps.

---

## Execution handoff

Plan saved to `docs/superpowers/plans/2026-08-29-lifecycle-ws2-promote-agency-client.md`.

**1. Subagent-Driven (recommended)** — fresh subagent per task, review between tasks.

**2. Inline Execution** — run tasks in this session with checkpoints.

Which approach?
