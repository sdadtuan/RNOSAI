# Performance OS (KPI Hub) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Supersedes** skeleton plan cùng ngày (23 task rút gọn). Bản này khóa type, test, SQL, API, copy UI — agent không được tự suy diễn.

**Goal:** Đưa SRS v3.0 Performance Operating System và 11 màn `docs/design/rnosai-performance-management-mockup.html` lên KPI Hub nhóm HIỆU SUẤT — 3 sổ Quoted/Assigned/Verified, scoring đúng chiều, check-in ritual, quality cascade, period snapshot, field ACL, UI khớp mockup.

**Architecture:** Domain thuần trong `services/ptt-crm-api/src/kpi-hub/performance/*` (không đụng `src/performance/` Ads). Service + repository (memory, rồi Postgres) expose `/api/crm/kpi-hub/performance`. Ops-web 11 route `/crm/kpi-hub/performance*` dùng `KpiHubShell` + nav HIỆU SUẤT đã có. Actual/quality inherit Service KPI Tracking khi assignment có `instance_id`.

**Tech Stack:** NestJS + Jest (`services/ptt-crm-api`), Next.js App Router + Vitest + Playwright (`services/ops-web`), PostgreSQL (pattern `docs/specs/2026-09-09-postgresql-ddl-service-kpi.sql` + `withDbFallback` trong `kpi-hub.memory-store`). Cap: `crm_kpi_hub.view` (đọc), `crm_kpi_dictionary.manage` (ghi Phase 2).

## Global Constraints

- Không cạnh tranh Lattice/AgencyAnalytics bằng dashboard generic; mỗi màn phải hiện moat (3 sổ, quality, readiness, snapshot).
- Cùng definition không trộn ledger: Quoted ≠ Assigned ≠ Verified Actual.
- Lower-is-better: Green nếu `actual ≤ target`; Yellow nếu overrun ≤10%; Red nếu >10%. Không dùng `actual/target` cho CPL/CPA.
- Check-in không ghi đè actual `quality=verified` từ `collection_method` `api|connector`. Correction = record mới (`superseded`).
- Period close không đọc actual `pending` / `stale`; client report chỉ field `client_visible`.
- Scorecard Active: tổng weight đúng 100%. Draft được lệch, không được >100% khi add item (đã có `weight_exceeds_100`).
- AI insight không render nếu `evidence_ids.length === 0`.
- ROAS thiếu attribution → `{ value: null, display: 'N/A', reason: '...' }`, không bịa số.
- PII lead-level không xuống Performance UI.
- Không sửa `services/ptt-crm-api/src/performance/` (module Ads khác).
- Copy tiếng Việt trên UI **khớp mockup** (Operating Dashboard, Assignment Registry, Check-in Ritual, Marketing OS, …) — không giữ nhãn Phase 1.
- Quoted Δ trên Registry = **quoted vs actual** (cột mockup). Flag Change Order = **quoted vs assigned** material (AC-PM-07). Hai số khác nhau — không trộn.
- Test trước khi code (TDD). Commit sau mỗi task. Không `--no-verify`.
- Không làm Phase 3: forecast engine, AI sinh insight, calibration HR/payroll, warehouse semantic, email SMTP (chỉ in-app event payload).

---

## Chẩn đoán plan skeleton (vì sao chưa đủ)

| Lỗ | Hệ quả nếu agent chạy bản cũ |
|---|---|
| Task 2–6, 11–21 chỉ “Implement + commit” | Thiếu code, type lệch, AC miss |
| `quotedDeltaPct` `signed = raw` no-op | Không khóa công thức |
| Chỉ 1 loại Quoted Δ | Trộn AC-PM-07 (vs assigned) với cột mockup (vs actual) |
| Thiếu target band / duplicate key / review / correction | Activate và ritual không đủ SRS §4 §8 |
| Thiếu field ACL Finance/HR | Chỉ filter client — DoD fail |
| Thiếu assumption_open → tile Theo dõi | Tile 2 sai công thức FR |
| Catalog ROAS = `4.52` | AC-PM-09 fail trên UI |
| Campaign `budget` một cột | Mockup tách Media / Fee; Booking bịa số |
| Nav vẫn “Dashboard hiệu suất / Quản lý KPI” | Không khớp mockup |
| Thiếu GET `/assignments/:id`, review, export, idempotency, `row_version` | SRS §10 + DoD |
| `PmScopeType` thiếu `service` | SRS §4 |
| DoD states (empty/denied/closed) không có primitive | 11 màn không đồng nhất |

---

## File map (khóa trước khi code)

| File | Trách nhiệm |
|---|---|
| `performance-score.ts` | progress / health / weight — **đã có, không đổi công thức** |
| `performance-ledgers.ts` | 3 sổ + 2 delta + material CO |
| `performance-quality.ts` | cascade stale → dependents; block close/report |
| `performance-readiness.ts` | 5 gate activate + target band |
| `performance-snapshot.ts` | canonical hash, reopen guard, optimistic lock |
| `performance-acl.ts` | field filter theo role (thay tên `visibility`) |
| `performance-insight.ts` | evidence gate + forecast disclaimer |
| `performance-assignment-key.ts` | unique definition+scope+period |
| `performance-dashboard.ts` | 6 tile + rhythm 5 câu |
| `performance-ritual.ts` | lock actual, review, correction |
| `performance-notify.ts` | in-app event payload |
| `performance-marketing.ts` | ROAS N/A + funnel empty stage |
| `docs/specs/2026-09-10-postgresql-ddl-performance-os.sql` | persist |
| `scripts/apply_pg_ddl_performance_os.sh` | apply DDL |
| `performance.repository.ts` | memory + Postgres |
| `performance.types.ts` / `.catalog.ts` / `.service.ts` / `.controller.ts` | API v3 |
| `services/ops-web/src/lib/performance-types.ts` + `performance-api.ts` | client |
| `services/ops-web/src/lib/kpi-hub-nav.ts` | 11 nhãn mockup |
| `components/kpi-hub/performance/Pm*.tsx` | primitive |
| 11 `page.tsx` dưới `app/crm/kpi-hub/performance/` | UI mockup |
| `e2e/performance-os-hub.spec.ts` | sidebar + ritual + ROAS N/A |

---

## Shared contracts (mọi task sau Task 1 phải dùng đúng tên này)

Thêm vào `services/ptt-crm-api/src/kpi-hub/performance/performance.types.ts` **trong Task 14** (domain file tự export type riêng; service import và gắn vào `PmAssignment`). Không đổi tên giữa các task.

```ts
export type LedgerQuality = 'verified' | 'pending' | 'stale';
export type CollectionMethod = 'manual' | 'api' | 'connector';
export type AssignmentLifecycle = 'draft' | 'active' | 'tracking' | 'closed';
export type ReviewState = 'submitted' | 'approved' | 'returned' | 'escalated';
export type PmScopeType =
  | 'individual' | 'team' | 'department' | 'project'
  | 'client' | 'campaign' | 'service';
export type PmViewerRole =
  | 'owner' | 'lead' | 'dept_head' | 'finance' | 'hr'
  | 'account' | 'data_owner' | 'auditor' | 'client_viewer';
export type GateId = 'definition' | 'owner' | 'band' | 'source' | 'visibility';
export type GateStatus = 'pass' | 'pending' | 'fail';

export type LedgerCell = { value: number | null; label: 'Quoted' | 'Assigned' | 'Verified' | 'Pending' };
export type ThreeLedgers = { quoted: LedgerCell; assigned: LedgerCell; verified: LedgerCell };

export type ReadinessGate = { id: GateId; status: GateStatus; detail: string };
export type ReadinessResult = { gates: ReadinessGate[]; can_activate: boolean };

export type PmNotifyEvent = {
  type:
    | 'assignment_activated'
    | 'checkin_due'
    | 'checkin_overdue'
    | 'health_yellow'
    | 'health_red'
    | 'quality_stale'
    | 'action_due'
    | 'scorecard_pending'
    | 'period_closed';
  audience: string[];
  severity: 'info' | 'high' | 'critical';
  href: string;
  title: string;
};
```

`PmAssignment` sau Task 14 **bắt buộc** có thêm (giữ field cũ):

```ts
quoted_target: number | null;
assigned_target: number;          // alias của target hiện tại
source_id: string | null;         // QT-0089
instance_id: string | null;
collection_method: CollectionMethod;
lifecycle: AssignmentLifecycle;
client_visible: boolean;
disclaimer: string;
assumption_open: boolean;
target_min: number | null;
target_stretch: number | null;
quoted_vs_assigned_pct: number | null;
quoted_vs_actual_pct: number | null;
quoted_delta_material: boolean;
actual_locked: boolean;
row_version: number;
```

Error codes (string trong `BadRequestException({ error })`) — dùng nguyên văn:

`name_required` · `target_required` · `weight_exceeds_100` · `blocker_required_when_red` · `action_required_when_red` · `actual_locked` · `readiness_blocked` · `quality_blocks_close` · `reopen_required` · `reopen_reason_required` · `duplicate_assignment` · `band_invalid` · `forecast_disclaimer_required` · `return_comment_required` · `stale_version` · `idempotency_replay` · `assignment_not_found` · `scorecard_not_found`

---

## Wave A — Domain thuần (Task 1–11)

Chạy Jest từ `services/ptt-crm-api`. Không đụng Nest HTTP ở wave này.

### Task 1: Three ledgers + hai delta (AC-PM-07)

**Files:**
- Create: `services/ptt-crm-api/src/kpi-hub/performance/performance-ledgers.ts`
- Test: `services/ptt-crm-api/src/kpi-hub/performance/performance-ledgers.spec.ts`

**Interfaces:**
- Consumes: không
- Produces: `quotedDeltaPct()`, `isMaterialQuotedDelta()`, `buildLedgers()`

- [ ] **Step 1: Write the failing test**

```ts
import { buildLedgers, isMaterialQuotedDelta, quotedDeltaPct } from './performance-ledgers';

describe('performance-ledgers', () => {
  it('keeps Quoted / Assigned / Verified separate and never promotes pending (AC-PM-07)', () => {
    const ledgers = buildLedgers({
      quoted_target: 100000,
      assigned_target: 85000,
      verified_actual: null,
      pending_actual: 128000,
      quality: 'stale',
    });
    expect(ledgers.quoted).toEqual({ value: 100000, label: 'Quoted' });
    expect(ledgers.assigned).toEqual({ value: 85000, label: 'Assigned' });
    expect(ledgers.verified).toEqual({ value: null, label: 'Pending' });
  });

  it('quoted vs assigned is material CO; quoted vs actual is registry column', () => {
    expect(quotedDeltaPct(100000, 85000)).toBe(-15);
    expect(quotedDeltaPct(100000, 128000)).toBe(28);
    expect(isMaterialQuotedDelta(-15, 10)).toBe(true);
    expect(isMaterialQuotedDelta(8, 10)).toBe(false);
    expect(quotedDeltaPct(0, 100)).toBeNull();
    expect(quotedDeltaPct(null, 100)).toBeNull();
  });

  it('verified quality exposes actual on verified ledger only', () => {
    const ledgers = buildLedgers({
      quoted_target: 160000,
      assigned_target: 160000,
      verified_actual: 149000,
      quality: 'verified',
    });
    expect(ledgers.verified).toEqual({ value: 149000, label: 'Verified' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/ptt-crm-api && npx jest src/kpi-hub/performance/performance-ledgers.spec.ts --no-coverage`

Expected: FAIL — `Cannot find module './performance-ledgers'`

- [ ] **Step 3: Write minimal implementation**

```ts
export type LedgerQuality = 'verified' | 'pending' | 'stale';

export type LedgerCell = {
  value: number | null;
  label: 'Quoted' | 'Assigned' | 'Verified' | 'Pending';
};

export function quotedDeltaPct(
  quoted: number | null,
  compare: number | null,
): number | null {
  if (quoted == null || compare == null || quoted === 0) return null;
  return Math.round(((compare - quoted) / quoted) * 1000) / 10;
}

export function isMaterialQuotedDelta(deltaPct: number | null, threshold = 10): boolean {
  return deltaPct != null && Math.abs(deltaPct) > threshold;
}

export function buildLedgers(input: {
  quoted_target: number | null;
  assigned_target: number | null;
  verified_actual: number | null;
  pending_actual?: number | null;
  quality: LedgerQuality;
}): { quoted: LedgerCell; assigned: LedgerCell; verified: LedgerCell } {
  const isVerified = input.quality === 'verified';
  return {
    quoted: { value: input.quoted_target, label: 'Quoted' },
    assigned: { value: input.assigned_target, label: 'Assigned' },
    verified: {
      value: isVerified ? input.verified_actual : null,
      label: isVerified ? 'Verified' : 'Pending',
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd services/ptt-crm-api && npx jest src/kpi-hub/performance/performance-ledgers.spec.ts --no-coverage`

Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add services/ptt-crm-api/src/kpi-hub/performance/performance-ledgers.ts \
        services/ptt-crm-api/src/kpi-hub/performance/performance-ledgers.spec.ts
git commit -m "$(cat <<'EOF'
feat(performance-os): keep quoted assigned and verified ledgers separate

EOF
)"
```

---

### Task 2: Quality cascade + block close/report (AC-PM-04)

**Files:**
- Create: `services/ptt-crm-api/src/kpi-hub/performance/performance-quality.ts`
- Test: `services/ptt-crm-api/src/kpi-hub/performance/performance-quality.spec.ts`

**Interfaces:**
- Consumes: `LedgerQuality`
- Produces: `cascadeQuality()`, `canClosePeriod()`, `canPublishClientReport()`

- [ ] **Step 1: Write the failing test**

```ts
import { canClosePeriod, canPublishClientReport, cascadeQuality } from './performance-quality';

describe('performance-quality', () => {
  it('stale Valid Lead cascades to CPL and MQL Rate and blocks close (AC-PM-04)', () => {
    const out = cascadeQuality([
      { kpi: 'Valid Lead', quality: 'stale', dependents: ['CPL Valid Lead', 'MQL Rate'] },
      { kpi: 'CPL Valid Lead', quality: 'verified', dependents: [] },
      { kpi: 'MQL Rate', quality: 'verified', dependents: [] },
      { kpi: 'CPA Meta', quality: 'verified', dependents: [] },
    ]);
    expect(out.find((x) => x.kpi === 'CPL Valid Lead')?.quality).toBe('pending');
    expect(out.find((x) => x.kpi === 'MQL Rate')?.quality).toBe('pending');
    expect(out.find((x) => x.kpi === 'CPA Meta')?.quality).toBe('verified');
    expect(canClosePeriod(out)).toBe(false);
  });

  it('does not upgrade stale dependents to verified', () => {
    const out = cascadeQuality([
      { kpi: 'Valid Lead', quality: 'pending', dependents: ['CPL Valid Lead'] },
      { kpi: 'CPL Valid Lead', quality: 'stale', dependents: [] },
    ]);
    expect(out.find((x) => x.kpi === 'CPL Valid Lead')?.quality).toBe('stale');
  });

  it('client report requires verified + client_visible', () => {
    expect(canPublishClientReport({ quality: 'pending', client_visible: true })).toBe(false);
    expect(canPublishClientReport({ quality: 'verified', client_visible: false })).toBe(false);
    expect(canPublishClientReport({ quality: 'verified', client_visible: true })).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd services/ptt-crm-api && npx jest src/kpi-hub/performance/performance-quality.spec.ts --no-coverage`

Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

```ts
export type Quality = 'verified' | 'pending' | 'stale';

export function cascadeQuality(
  rows: Array<{ kpi: string; quality: Quality; dependents: string[] }>,
): Array<{ kpi: string; quality: Quality }> {
  const map = new Map(rows.map((r) => [r.kpi, r.quality]));
  for (const row of rows) {
    if (row.quality !== 'stale' && row.quality !== 'pending') continue;
    for (const dep of row.dependents) {
      if (map.get(dep) === 'verified') map.set(dep, 'pending');
    }
  }
  return [...map.entries()].map(([kpi, quality]) => ({ kpi, quality }));
}

export function canClosePeriod(rows: Array<{ quality: Quality }>): boolean {
  return rows.length > 0 && rows.every((r) => r.quality === 'verified');
}

export function canPublishClientReport(input: {
  quality: Quality;
  client_visible: boolean;
}): boolean {
  return input.client_visible && input.quality === 'verified';
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd services/ptt-crm-api && npx jest src/kpi-hub/performance/performance-quality.spec.ts --no-coverage`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add services/ptt-crm-api/src/kpi-hub/performance/performance-quality.ts \
        services/ptt-crm-api/src/kpi-hub/performance/performance-quality.spec.ts
git commit -m "$(cat <<'EOF'
feat(performance-os): cascade stale quality and block unverified close

EOF
)"
```

---

### Task 3: Target band + readiness gates (PM-03)

**Files:**
- Create: `services/ptt-crm-api/src/kpi-hub/performance/performance-readiness.ts`
- Test: `services/ptt-crm-api/src/kpi-hub/performance/performance-readiness.spec.ts`

**Interfaces:**
- Consumes: `KpiDirection` từ `performance-score.ts`
- Produces: `validateTargetBand()`, `evaluateReadiness()`

- [ ] **Step 1: Write the failing test**

```ts
import { evaluateReadiness, validateTargetBand } from './performance-readiness';

describe('performance-readiness', () => {
  it('lower-is-better requires stretch ≤ target ≤ min (AC band)', () => {
    expect(validateTargetBand({ direction: 'lower', min: 85000, target: 100000, stretch: 70000 }).ok).toBe(true);
    expect(validateTargetBand({ direction: 'lower', min: 70000, target: 100000, stretch: 85000 }).ok).toBe(false);
    expect(validateTargetBand({ direction: 'higher', min: 800, target: 1000, stretch: 1200 }).ok).toBe(true);
    expect(validateTargetBand({ direction: 'higher', min: 1200, target: 1000, stretch: 1500 }).ok).toBe(false);
  });

  it('blocks activate when measurement plan missing on auto KPI', () => {
    const r = evaluateReadiness({
      definition_active: true,
      owner_active: true,
      band_valid: true,
      has_measurement_plan: false,
      auto_tracked: true,
      client_visible: true,
      has_disclaimer: true,
    });
    expect(r.can_activate).toBe(false);
    expect(r.gates.find((g) => g.id === 'source')?.status).toBe('pending');
  });

  it('fails visibility when client-visible without disclaimer', () => {
    const r = evaluateReadiness({
      definition_active: true,
      owner_active: true,
      band_valid: true,
      has_measurement_plan: true,
      auto_tracked: true,
      client_visible: true,
      has_disclaimer: false,
    });
    expect(r.gates.find((g) => g.id === 'visibility')?.status).toBe('fail');
    expect(r.can_activate).toBe(false);
  });

  it('passes all five gates', () => {
    const r = evaluateReadiness({
      definition_active: true,
      owner_active: true,
      band_valid: true,
      has_measurement_plan: true,
      auto_tracked: true,
      client_visible: false,
      has_disclaimer: false,
    });
    expect(r.can_activate).toBe(true);
    expect(r.gates.every((g) => g.status === 'pass')).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd services/ptt-crm-api && npx jest src/kpi-hub/performance/performance-readiness.spec.ts --no-coverage`

Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

```ts
import type { KpiDirection } from './performance-score';

export type GateId = 'definition' | 'owner' | 'band' | 'source' | 'visibility';
export type GateStatus = 'pass' | 'pending' | 'fail';

export function validateTargetBand(input: {
  direction: KpiDirection | string;
  min: number | null;
  target: number;
  stretch: number | null;
}): { ok: boolean; error?: 'band_invalid' } {
  if (!Number.isFinite(input.target)) return { ok: false, error: 'band_invalid' };
  if (input.min == null && input.stretch == null) return { ok: true };
  if (input.direction === 'lower') {
    const stretchOk = input.stretch == null || input.stretch <= input.target;
    const minOk = input.min == null || input.target <= input.min;
    return stretchOk && minOk ? { ok: true } : { ok: false, error: 'band_invalid' };
  }
  const minOk = input.min == null || input.min <= input.target;
  const stretchOk = input.stretch == null || input.target <= input.stretch;
  return minOk && stretchOk ? { ok: true } : { ok: false, error: 'band_invalid' };
}

export function evaluateReadiness(i: {
  definition_active: boolean;
  owner_active: boolean;
  band_valid: boolean;
  has_measurement_plan: boolean;
  auto_tracked: boolean;
  client_visible: boolean;
  has_disclaimer: boolean;
}): { gates: Array<{ id: GateId; status: GateStatus; detail: string }>; can_activate: boolean } {
  const gates: Array<{ id: GateId; status: GateStatus; detail: string }> = [
    { id: 'definition', status: i.definition_active ? 'pass' : 'fail', detail: 'Dictionary Active' },
    { id: 'owner', status: i.owner_active ? 'pass' : 'fail', detail: 'Owner active' },
    { id: 'band', status: i.band_valid ? 'pass' : 'fail', detail: 'Direction / band' },
    {
      id: 'source',
      status: !i.auto_tracked || i.has_measurement_plan ? 'pass' : 'pending',
      detail: 'Measurement Plan',
    },
    {
      id: 'visibility',
      status: !i.client_visible || i.has_disclaimer ? 'pass' : 'fail',
      detail: 'Client disclaimer',
    },
  ];
  return { gates, can_activate: gates.every((g) => g.status === 'pass') };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd services/ptt-crm-api && npx jest src/kpi-hub/performance/performance-readiness.spec.ts --no-coverage`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add services/ptt-crm-api/src/kpi-hub/performance/performance-readiness.ts \
        services/ptt-crm-api/src/kpi-hub/performance/performance-readiness.spec.ts
git commit -m "$(cat <<'EOF'
feat(performance-os): validate target band and assignment readiness gates

EOF
)"
```

---

### Task 4: Snapshot hash + reopen + optimistic lock (AC-PM-06)

**Files:**
- Create: `services/ptt-crm-api/src/kpi-hub/performance/performance-snapshot.ts`
- Test: `services/ptt-crm-api/src/kpi-hub/performance/performance-snapshot.spec.ts`

**Interfaces:**
- Produces: `canonicalJson()`, `freezeSnapshot()`, `assertNotClosed()`, `assertRowVersion()`

- [ ] **Step 1: Write the failing test**

```ts
import { assertNotClosed, assertRowVersion, freezeSnapshot } from './performance-snapshot';

describe('performance-snapshot', () => {
  it('hash is stable across key order and ignores closed_at (AC-PM-06)', () => {
    const a = freezeSnapshot({ scorecard_id: 'sc-1', period: 'Q4-2026', items: [{ id: 'a', score: 80, weight: 100 }] });
    const b = freezeSnapshot({ items: [{ weight: 100, score: 80, id: 'a' }], period: 'Q4-2026', scorecard_id: 'sc-1' });
    expect(a.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(a.hash).toBe(b.hash);
    expect(a.hash).toBe(freezeSnapshot(a.payload).hash);
    expect(a.closed_at).toMatch(/T/);
  });

  it('mutate after close requires reopen; stale row_version throws', () => {
    expect(() => assertNotClosed('closed')).toThrow(/reopen_required/);
    expect(() => assertNotClosed('open')).not.toThrow();
    expect(() => assertRowVersion(3, 2)).toThrow(/stale_version/);
    expect(() => assertRowVersion(3, 3)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd services/ptt-crm-api && npx jest src/kpi-hub/performance/performance-snapshot.spec.ts --no-coverage`

Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

```ts
import { createHash } from 'crypto';

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((v) => canonicalJson(v)).join(',')}]`;
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson((value as Record<string, unknown>)[k])}`).join(',')}}`;
}

export function freezeSnapshot(payload: unknown) {
  return {
    payload,
    hash: createHash('sha256').update(canonicalJson(payload)).digest('hex'),
    closed_at: new Date().toISOString(),
  };
}

export function assertNotClosed(state: string) {
  if (state === 'closed') throw new Error('reopen_required');
}

export function assertRowVersion(expected: number, actual: number) {
  if (expected !== actual) throw new Error('stale_version');
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd services/ptt-crm-api && npx jest src/kpi-hub/performance/performance-snapshot.spec.ts --no-coverage`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add services/ptt-crm-api/src/kpi-hub/performance/performance-snapshot.ts \
        services/ptt-crm-api/src/kpi-hub/performance/performance-snapshot.spec.ts
git commit -m "$(cat <<'EOF'
feat(performance-os): freeze period snapshot with stable sha256 hash

EOF
)"
```

---

### Task 5: Field ACL — client / finance / hr (AC-PM-05 + SRS §5)

**Files:**
- Create: `services/ptt-crm-api/src/kpi-hub/performance/performance-acl.ts`
- Test: `services/ptt-crm-api/src/kpi-hub/performance/performance-acl.spec.ts`

**Interfaces:**
- Produces: `filterFieldsForRole()`

- [ ] **Step 1: Write the failing test**

```ts
import { filterFieldsForRole } from './performance-acl';

const row = {
  target: 100000,
  actual: 99000,
  disclaimer: 'Dự kiến theo budget 120tr',
  margin: 0.224,
  reviewer_comment: 'internal',
  agency_fee: 18_000_000,
  hr_note: 'calibration private',
  client_visible: true,
};

describe('performance-acl', () => {
  it('client viewer only gets target actual disclaimer (AC-PM-05)', () => {
    expect(filterFieldsForRole(row, 'client_viewer')).toEqual({
      target: 100000,
      actual: 99000,
      disclaimer: 'Dự kiến theo budget 120tr',
    });
  });

  it('finance sees margin and fee but not hr_note', () => {
    const out = filterFieldsForRole(row, 'finance');
    expect(out).toMatchObject({ margin: 0.224, agency_fee: 18_000_000, target: 100000 });
    expect(out).not.toHaveProperty('hr_note');
  });

  it('hr sees hr_note but not margin', () => {
    const out = filterFieldsForRole(row, 'hr');
    expect(out).toMatchObject({ hr_note: 'calibration private', target: 100000 });
    expect(out).not.toHaveProperty('margin');
  });

  it('auditor sees all fields', () => {
    expect(filterFieldsForRole(row, 'auditor')).toEqual(row);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd services/ptt-crm-api && npx jest src/kpi-hub/performance/performance-acl.spec.ts --no-coverage`

Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

```ts
export type PmViewerRole =
  | 'owner' | 'lead' | 'dept_head' | 'finance' | 'hr'
  | 'account' | 'data_owner' | 'auditor' | 'client_viewer';

const CLIENT_FIELDS = ['target', 'actual', 'disclaimer'] as const;
const FINANCE_HIDE = ['hr_note', 'reviewer_comment'];
const HR_HIDE = ['margin', 'agency_fee', 'reviewer_comment'];

export function filterFieldsForRole<T extends Record<string, unknown>>(
  row: T,
  role: PmViewerRole,
): Partial<T> {
  if (role === 'auditor' || role === 'data_owner' || role === 'dept_head') return { ...row };
  if (role === 'client_viewer' || role === 'account') {
    const out: Record<string, unknown> = {};
    for (const key of CLIENT_FIELDS) if (key in row) out[key] = row[key];
    return out as Partial<T>;
  }
  const hide = role === 'finance' ? FINANCE_HIDE : role === 'hr' ? HR_HIDE : [];
  const out = { ...row };
  for (const key of hide) delete (out as Record<string, unknown>)[key];
  return out;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd services/ptt-crm-api && npx jest src/kpi-hub/performance/performance-acl.spec.ts --no-coverage`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add services/ptt-crm-api/src/kpi-hub/performance/performance-acl.ts \
        services/ptt-crm-api/src/kpi-hub/performance/performance-acl.spec.ts
git commit -m "$(cat <<'EOF'
feat(performance-os): filter report fields by viewer role

EOF
)"
```

---

### Task 6: AI evidence + forecast disclaimer (AC-PM-10 + SRS §8)

**Files:**
- Create: `services/ptt-crm-api/src/kpi-hub/performance/performance-insight.ts`
- Test: `services/ptt-crm-api/src/kpi-hub/performance/performance-insight.spec.ts`

**Interfaces:**
- Produces: `visibleInsights()`, `assertForecastPublishable()`

- [ ] **Step 1: Write the failing test**

```ts
import { assertForecastPublishable, visibleInsights } from './performance-insight';

describe('performance-insight', () => {
  it('hides insight without evidence_ids (AC-PM-10)', () => {
    expect(
      visibleInsights([
        { text: 'CPL sẽ về 90K', evidence_ids: [] },
        { text: 'P1 root cause #4412', evidence_ids: ['inc-4412'] },
      ]),
    ).toEqual([{ text: 'P1 root cause #4412', evidence_ids: ['inc-4412'] }]);
  });

  it('blocks client forecast publish without disclaimer', () => {
    expect(() =>
      assertForecastPublishable({ client_facing: true, disclaimer: '' }),
    ).toThrow(/forecast_disclaimer_required/);
    expect(() =>
      assertForecastPublishable({ client_facing: true, disclaimer: 'Theo budget 120tr' }),
    ).not.toThrow();
    expect(() =>
      assertForecastPublishable({ client_facing: false, disclaimer: '' }),
    ).not.toThrow();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd services/ptt-crm-api && npx jest src/kpi-hub/performance/performance-insight.spec.ts --no-coverage`

Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

```ts
export function visibleInsights<T extends { evidence_ids: string[] }>(items: T[]): T[] {
  return items.filter((i) => i.evidence_ids.length > 0);
}

export function assertForecastPublishable(input: {
  client_facing: boolean;
  disclaimer: string;
}) {
  if (input.client_facing && !input.disclaimer.trim()) {
    throw new Error('forecast_disclaimer_required');
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd services/ptt-crm-api && npx jest src/kpi-hub/performance/performance-insight.spec.ts --no-coverage`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add services/ptt-crm-api/src/kpi-hub/performance/performance-insight.ts \
        services/ptt-crm-api/src/kpi-hub/performance/performance-insight.spec.ts
git commit -m "$(cat <<'EOF'
feat(performance-os): hide unevidenced insight and require forecast disclaimer

EOF
)"
```

---

### Task 7: Duplicate assignment key (SRS §7 PM-04)

**Files:**
- Create: `services/ptt-crm-api/src/kpi-hub/performance/performance-assignment-key.ts`
- Test: `services/ptt-crm-api/src/kpi-hub/performance/performance-assignment-key.spec.ts`

**Interfaces:**
- Produces: `assignmentKey()`, `assertUniqueAssignment()`

- [ ] **Step 1: Write the failing test**

```ts
import { assertUniqueAssignment, assignmentKey } from './performance-assignment-key';

describe('performance-assignment-key', () => {
  it('blocks duplicate definition + scope + period', () => {
    const existing = [
      { definition_code: 'MKT_006', scope_type: 'campaign', scope_id: 'an-phat', period: '09/2026' },
    ];
    expect(assignmentKey(existing[0])).toBe('MKT_006|campaign|an-phat|09/2026');
    expect(() =>
      assertUniqueAssignment(existing, {
        definition_code: 'MKT_006',
        scope_type: 'campaign',
        scope_id: 'an-phat',
        period: '09/2026',
      }),
    ).toThrow(/duplicate_assignment/);
    expect(() =>
      assertUniqueAssignment(existing, {
        definition_code: 'MKT_006',
        scope_type: 'campaign',
        scope_id: 'spa-abc',
        period: '09/2026',
      }),
    ).not.toThrow();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd services/ptt-crm-api && npx jest src/kpi-hub/performance/performance-assignment-key.spec.ts --no-coverage`

Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

```ts
export type AssignmentKeyInput = {
  definition_code: string;
  scope_type: string;
  scope_id: string;
  period: string;
};

export function assignmentKey(input: AssignmentKeyInput): string {
  return [input.definition_code, input.scope_type, input.scope_id, input.period].join('|');
}

export function assertUniqueAssignment(
  existing: AssignmentKeyInput[],
  next: AssignmentKeyInput,
) {
  const key = assignmentKey(next);
  if (existing.some((row) => assignmentKey(row) === key)) {
    throw new Error('duplicate_assignment');
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd services/ptt-crm-api && npx jest src/kpi-hub/performance/performance-assignment-key.spec.ts --no-coverage`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add services/ptt-crm-api/src/kpi-hub/performance/performance-assignment-key.ts \
        services/ptt-crm-api/src/kpi-hub/performance/performance-assignment-key.spec.ts
git commit -m "$(cat <<'EOF'
feat(performance-os): reject duplicate definition scope period assignment

EOF
)"
```

---

### Task 8: Six dashboard tiles + weekly rhythm (PM-01 / FR-PM-DASH-007)

**Files:**
- Create: `services/ptt-crm-api/src/kpi-hub/performance/performance-dashboard.ts`
- Test: `services/ptt-crm-api/src/kpi-hub/performance/performance-dashboard.spec.ts`

**Interfaces:**
- Produces: `computeDashboardTiles()`, `buildWeeklyRhythm()`

Tile rules (khóa):

1. `on_track` = lifecycle `active|tracking` AND health `green` AND quality ≠ `stale`
2. `watch` = health `yellow` **OR** `assumption_open`
3. `off_track` = health `red`
4. `completion_pct` = mean `item_score` (bỏ null), 1 decimal
5. `checkin_on_time_pct` = completed_on_time / expected * 100
6. `data_blocked` = lifecycle `active|tracking` AND quality ∈ `pending|stale` — **không đếm `verified`**

- [ ] **Step 1: Write the failing test**

```ts
import { buildWeeklyRhythm, computeDashboardTiles } from './performance-dashboard';

describe('performance-dashboard', () => {
  it('computes six tiles including data_blocked and assumption watch', () => {
    const tiles = computeDashboardTiles({
      rows: [
        { lifecycle: 'tracking', status: 'green', quality: 'verified', assumption_open: false },
        { lifecycle: 'tracking', status: 'green', quality: 'stale', assumption_open: false },
        { lifecycle: 'tracking', status: 'yellow', quality: 'verified', assumption_open: false },
        { lifecycle: 'tracking', status: 'green', quality: 'verified', assumption_open: true },
        { lifecycle: 'tracking', status: 'red', quality: 'pending', assumption_open: false },
        { lifecycle: 'draft', status: 'green', quality: 'verified', assumption_open: false },
      ],
      item_scores: [80, 84.8],
      checkins_expected: 10,
      checkins_on_time: 9,
    });
    expect(tiles.on_track).toBe(1);
    expect(tiles.watch).toBe(2);
    expect(tiles.off_track).toBe(1);
    expect(tiles.total).toBe(5);
    expect(tiles.data_blocked).toBe(2);
    expect(tiles.completion_pct).toBe(82.4);
    expect(tiles.checkin_on_time_pct).toBe(90);
  });

  it('builds five weekly rhythm rows with hrefs', () => {
    const rhythm = buildWeeklyRhythm({
      open_assumptions: ['Budget An Phát 120tr'],
      at_risk: ['CPL An Phát Critical'],
      stale_label: 'CRM Valid Lead 29h',
      gm_miss: 'DV04 Meta · GM 22,4%',
      pending_scorecard: 'Q4 Marketing Lead',
    });
    expect(rhythm).toHaveLength(5);
    expect(rhythm.map((r) => r.id)).toEqual([
      'assumption',
      'at_risk',
      'stale',
      'gm',
      'scorecard',
    ]);
    expect(rhythm[2].href).toBe('/crm/kpi-hub/performance/crm-source');
    expect(rhythm[3].href).toBe('/crm/kpi-hub/kpi-contracts');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd services/ptt-crm-api && npx jest src/kpi-hub/performance/performance-dashboard.spec.ts --no-coverage`

Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

```ts
export type DashRow = {
  lifecycle: 'draft' | 'active' | 'tracking' | 'closed';
  status: 'green' | 'yellow' | 'red' | 'no_data';
  quality: 'verified' | 'pending' | 'stale';
  assumption_open: boolean;
};

export function computeDashboardTiles(input: {
  rows: DashRow[];
  item_scores: Array<number | null>;
  checkins_expected: number;
  checkins_on_time: number;
}) {
  const live = input.rows.filter((r) => r.lifecycle === 'active' || r.lifecycle === 'tracking');
  const scores = input.item_scores.filter((s): s is number => s != null);
  const completion =
    scores.length === 0 ? 0 : Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
  return {
    on_track: live.filter((r) => r.status === 'green' && r.quality !== 'stale').length,
    watch: live.filter((r) => r.status === 'yellow' || r.assumption_open).length,
    off_track: live.filter((r) => r.status === 'red').length,
    total: live.length,
    data_blocked: live.filter((r) => r.quality === 'pending' || r.quality === 'stale').length,
    completion_pct: completion,
    checkin_on_time_pct:
      input.checkins_expected === 0
        ? 0
        : Math.round((input.checkins_on_time / input.checkins_expected) * 1000) / 10,
  };
}

export function buildWeeklyRhythm(input: {
  open_assumptions: string[];
  at_risk: string[];
  stale_label: string;
  gm_miss: string;
  pending_scorecard: string;
}) {
  return [
    { id: 'assumption', title: 'Assumption chưa confirm', body: input.open_assumptions.join(' · '), href: '/crm/kpi-hub/performance/check-ins' },
    { id: 'at_risk', title: 'At-risk + action quá hạn', body: input.at_risk.join(' · '), href: '/crm/kpi-hub/performance/assignments' },
    { id: 'stale', title: 'Data stale → cấm báo cáo khách', body: input.stale_label, href: '/crm/kpi-hub/performance/crm-source' },
    { id: 'gm', title: 'Lệch KPI + GM', body: input.gm_miss, href: '/crm/kpi-hub/kpi-contracts' },
    { id: 'scorecard', title: 'Scorecard pending', body: input.pending_scorecard, href: '/crm/kpi-hub/performance/scorecards' },
  ];
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd services/ptt-crm-api && npx jest src/kpi-hub/performance/performance-dashboard.spec.ts --no-coverage`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add services/ptt-crm-api/src/kpi-hub/performance/performance-dashboard.ts \
        services/ptt-crm-api/src/kpi-hub/performance/performance-dashboard.spec.ts
git commit -m "$(cat <<'EOF'
feat(performance-os): compute operating tiles and weekly rhythm

EOF
)"
```

---

### Task 9: Check-in ritual domain (AC-PM-03 / AC-PM-08)

**Files:**
- Create: `services/ptt-crm-api/src/kpi-hub/performance/performance-ritual.ts`
- Test: `services/ptt-crm-api/src/kpi-hub/performance/performance-ritual.spec.ts`

**Interfaces:**
- Produces: `assertActualWritable()`, `assertRedRitual()`, `assertReviewTransition()`, `nextCorrection()`

- [ ] **Step 1: Write the failing test**

```ts
import {
  assertActualWritable,
  assertRedRitual,
  assertReviewTransition,
  nextCorrection,
} from './performance-ritual';

describe('performance-ritual', () => {
  it('locks verified auto actual (AC-PM-08)', () => {
    expect(() =>
      assertActualWritable({ quality: 'verified', collection_method: 'api', incoming_actual: 1 }),
    ).toThrow(/actual_locked/);
    expect(() =>
      assertActualWritable({ quality: 'pending', collection_method: 'api', incoming_actual: 1 }),
    ).not.toThrow();
    expect(() =>
      assertActualWritable({ quality: 'verified', collection_method: 'manual', incoming_actual: 1 }),
    ).not.toThrow();
  });

  it('red requires blocker and action (AC-PM-03)', () => {
    expect(() => assertRedRitual({ health: 'red', blocker: '', action_title: 'Fix P1' })).toThrow(
      /blocker_required_when_red/,
    );
    expect(() => assertRedRitual({ health: 'red', blocker: '03 P1', action_title: '' })).toThrow(
      /action_required_when_red/,
    );
    expect(() => assertRedRitual({ health: 'red', blocker: '03 P1', action_title: 'Fix P1' })).not.toThrow();
    expect(() => assertRedRitual({ health: 'green', blocker: '', action_title: '' })).not.toThrow();
  });

  it('return requires comment; correction is a new record', () => {
    expect(() => assertReviewTransition('submitted', 'returned', '')).toThrow(/return_comment_required/);
    expect(assertReviewTransition('submitted', 'approved', '')).toBe('approved');
    expect(assertReviewTransition('submitted', 'escalated', 'need head')).toBe('escalated');
    const next = nextCorrection({ id: 'act-1', value: 5.2, quality: 'verified' }, 4.9);
    expect(next).toMatchObject({ value: 4.9, supersedes: 'act-1', quality: 'pending' });
    expect(next.id).not.toBe('act-1');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd services/ptt-crm-api && npx jest src/kpi-hub/performance/performance-ritual.spec.ts --no-coverage`

Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

```ts
export function assertActualWritable(input: {
  quality: string;
  collection_method: string;
  incoming_actual?: number;
}) {
  const auto = input.collection_method === 'api' || input.collection_method === 'connector';
  if (input.incoming_actual != null && input.quality === 'verified' && auto) {
    throw new Error('actual_locked');
  }
}

export function assertRedRitual(input: { health: string; blocker: string; action_title: string }) {
  if (input.health !== 'red') return;
  if (!input.blocker.trim()) throw new Error('blocker_required_when_red');
  if (!input.action_title.trim()) throw new Error('action_required_when_red');
}

export function assertReviewTransition(
  from: string,
  to: 'approved' | 'returned' | 'escalated',
  comment: string,
): 'approved' | 'returned' | 'escalated' {
  if (from !== 'submitted') throw new Error('invalid_review_state');
  if (to === 'returned' && !comment.trim()) throw new Error('return_comment_required');
  return to;
}

export function nextCorrection(
  current: { id: string; value: number; quality: string },
  value: number,
) {
  return {
    id: `act-corr-${current.id}`,
    value,
    quality: 'pending' as const,
    supersedes: current.id,
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd services/ptt-crm-api && npx jest src/kpi-hub/performance/performance-ritual.spec.ts --no-coverage`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add services/ptt-crm-api/src/kpi-hub/performance/performance-ritual.ts \
        services/ptt-crm-api/src/kpi-hub/performance/performance-ritual.spec.ts
git commit -m "$(cat <<'EOF'
feat(performance-os): lock verified auto actual and require red ritual

EOF
)"
```

---

### Task 10: In-app notify payloads (SRS §9)

**Files:**
- Create: `services/ptt-crm-api/src/kpi-hub/performance/performance-notify.ts`
- Test: `services/ptt-crm-api/src/kpi-hub/performance/performance-notify.spec.ts`

**Interfaces:**
- Produces: `buildNotifyEvent()` — **không gửi email**

- [ ] **Step 1: Write the failing test**

```ts
import { buildNotifyEvent } from './performance-notify';

describe('performance-notify', () => {
  it('red health notifies owner + lead + account when client-scoped', () => {
    const ev = buildNotifyEvent({
      type: 'health_red',
      owner: 'Trần Văn Nam',
      lead: 'Team Lead Tech',
      account: 'AM An Phát',
      client_scoped: true,
      href: '/crm/kpi-hub/performance/check-ins?assignment=asg-p1',
      title: 'P1 resolution Red',
    });
    expect(ev.audience).toEqual(['Trần Văn Nam', 'Team Lead Tech', 'AM An Phát']);
    expect(ev.severity).toBe('critical');
  });

  it('stale notifies data owner + owner + pm', () => {
    const ev = buildNotifyEvent({
      type: 'quality_stale',
      owner: 'Lê Hoàng',
      lead: 'PM Ads',
      data_owner: 'Data CRM',
      href: '/crm/kpi-hub/performance/crm-source',
      title: 'Valid Lead stale 29h',
    });
    expect(ev.audience).toEqual(['Data CRM', 'Lê Hoàng', 'PM Ads']);
    expect(ev.severity).toBe('high');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd services/ptt-crm-api && npx jest src/kpi-hub/performance/performance-notify.spec.ts --no-coverage`

Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

```ts
export type NotifyType =
  | 'assignment_activated'
  | 'checkin_due'
  | 'checkin_overdue'
  | 'health_yellow'
  | 'health_red'
  | 'quality_stale'
  | 'action_due'
  | 'scorecard_pending'
  | 'period_closed';

export function buildNotifyEvent(input: {
  type: NotifyType;
  owner?: string;
  lead?: string;
  account?: string;
  data_owner?: string;
  client_scoped?: boolean;
  href: string;
  title: string;
}) {
  const audience: string[] = [];
  if (input.type === 'quality_stale') {
    if (input.data_owner) audience.push(input.data_owner);
    if (input.owner) audience.push(input.owner);
    if (input.lead) audience.push(input.lead);
  } else if (input.type === 'health_red') {
    if (input.owner) audience.push(input.owner);
    if (input.lead) audience.push(input.lead);
    if (input.client_scoped && input.account) audience.push(input.account);
  } else if (input.type === 'health_yellow') {
    if (input.owner) audience.push(input.owner);
  } else {
    if (input.owner) audience.push(input.owner);
    if (input.lead) audience.push(input.lead);
  }
  const severity =
    input.type === 'health_red' ? 'critical' : input.type === 'quality_stale' || input.type === 'checkin_overdue' ? 'high' : 'info';
  return { type: input.type, audience, severity, href: input.href, title: input.title };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd services/ptt-crm-api && npx jest src/kpi-hub/performance/performance-notify.spec.ts --no-coverage`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add services/ptt-crm-api/src/kpi-hub/performance/performance-notify.ts \
        services/ptt-crm-api/src/kpi-hub/performance/performance-notify.spec.ts
git commit -m "$(cat <<'EOF'
feat(performance-os): build in-app notify audiences for ritual events

EOF
)"
```

---

### Task 11: ROAS N/A + funnel empty stage (AC-PM-09 / PM-08)

**Files:**
- Create: `services/ptt-crm-api/src/kpi-hub/performance/performance-marketing.ts`
- Test: `services/ptt-crm-api/src/kpi-hub/performance/performance-marketing.spec.ts`

**Interfaces:**
- Produces: `roasDisplay()`, `funnelStage()`

- [ ] **Step 1: Write the failing test**

```ts
import { funnelStage, roasDisplay } from './performance-marketing';

describe('performance-marketing', () => {
  it('hides ROAS without attribution (AC-PM-09)', () => {
    expect(roasDisplay({ attribution_ready: false, value: 4.52 })).toEqual({
      value: null,
      display: 'N/A',
      reason: 'Thiếu attribution model',
    });
    expect(roasDisplay({ attribution_ready: true, value: 4.52 })).toEqual({
      value: 4.52,
      display: '4.52',
      reason: null,
    });
  });

  it('unmapped funnel stage is empty not invented', () => {
    expect(funnelStage({ label: 'BOOKING', mapped: false, value: 12 })).toEqual({
      label: 'BOOKING',
      value: null,
      display: '—',
      hint: 'Chưa map Sales CRM',
    });
    expect(funnelStage({ label: 'VALID LEAD', mapped: true, value: 250, hint: 'Pending CRM' })).toEqual({
      label: 'VALID LEAD',
      value: 250,
      display: '250',
      hint: 'Pending CRM',
    });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd services/ptt-crm-api && npx jest src/kpi-hub/performance/performance-marketing.spec.ts --no-coverage`

Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

```ts
export function roasDisplay(input: { attribution_ready: boolean; value: number | null }) {
  if (!input.attribution_ready) {
    return { value: null, display: 'N/A', reason: 'Thiếu attribution model' };
  }
  return { value: input.value, display: input.value == null ? '—' : String(input.value), reason: null };
}

export function funnelStage(input: {
  label: string;
  mapped: boolean;
  value?: number | null;
  hint?: string;
}) {
  if (!input.mapped) {
    return { label: input.label, value: null, display: '—', hint: 'Chưa map Sales CRM' };
  }
  return {
    label: input.label,
    value: input.value ?? null,
    display: input.value == null ? '—' : String(input.value),
    hint: input.hint ?? '',
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd services/ptt-crm-api && npx jest src/kpi-hub/performance/performance-marketing.spec.ts --no-coverage`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add services/ptt-crm-api/src/kpi-hub/performance/performance-marketing.ts \
        services/ptt-crm-api/src/kpi-hub/performance/performance-marketing.spec.ts
git commit -m "$(cat <<'EOF'
feat(performance-os): hide unattributed roas and unmapped funnel stages

EOF
)"
```

---

## Wave B — Persist + API (Task 12–16)

### Task 12: Postgres DDL + apply script

**Files:**
- Create: `docs/specs/2026-09-10-postgresql-ddl-performance-os.sql`
- Create: `scripts/apply_pg_ddl_performance_os.sh`

**Interfaces:**
- Produces: 8 bảng `crm_pm_*` — IF NOT EXISTS, tenant default `PTT`

- [ ] **Step 1: Write the DDL file** (nguyên văn — không rút)

```sql
-- Performance OS — assignments, scorecards, check-ins, snapshots
-- Migration: 2026-09-10-performance-os

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
BEGIN;

CREATE TABLE IF NOT EXISTS crm_pm_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  definition_code TEXT NOT NULL,
  name TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  scope_type TEXT NOT NULL,
  scope_id TEXT NOT NULL DEFAULT '',
  scope_name TEXT NOT NULL DEFAULT '',
  department TEXT NOT NULL DEFAULT '',
  direction TEXT NOT NULL,
  target NUMERIC NOT NULL,
  target_min NUMERIC,
  target_stretch NUMERIC,
  assigned_target NUMERIC NOT NULL,
  quoted_target NUMERIC,
  source_id TEXT,
  instance_id TEXT,
  collection_method TEXT NOT NULL DEFAULT 'manual',
  quality TEXT NOT NULL DEFAULT 'pending',
  lifecycle TEXT NOT NULL DEFAULT 'draft',
  client_visible BOOLEAN NOT NULL DEFAULT FALSE,
  disclaimer TEXT NOT NULL DEFAULT '',
  assumption_open BOOLEAN NOT NULL DEFAULT FALSE,
  period_start DATE,
  period_end DATE,
  period_label TEXT NOT NULL DEFAULT '',
  cycle TEXT NOT NULL DEFAULT 'Tháng',
  row_version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT crm_pm_asg_scope_chk CHECK (
    scope_type IN ('individual','team','department','project','client','campaign','service')
  ),
  CONSTRAINT crm_pm_asg_quality_chk CHECK (quality IN ('verified','pending','stale')),
  CONSTRAINT crm_pm_asg_life_chk CHECK (lifecycle IN ('draft','active','tracking','closed')),
  CONSTRAINT crm_pm_asg_method_chk CHECK (collection_method IN ('manual','api','connector'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_pm_asg_key
  ON crm_pm_assignments (tenant_id, definition_code, scope_type, scope_id, period_label)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS crm_pm_scorecards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  title TEXT NOT NULL,
  card_type TEXT NOT NULL DEFAULT 'role',
  owner_name TEXT NOT NULL,
  period_label TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  weight_total NUMERIC NOT NULL DEFAULT 0,
  inherit_ref TEXT,
  approver TEXT NOT NULL DEFAULT '',
  row_version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT crm_pm_sc_status_chk CHECK (status IN ('draft','pending','active','closed'))
);

CREATE TABLE IF NOT EXISTS crm_pm_scorecard_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  scorecard_id UUID NOT NULL REFERENCES crm_pm_scorecards(id),
  assignment_id UUID REFERENCES crm_pm_assignments(id),
  definition_code TEXT NOT NULL,
  name TEXT NOT NULL,
  weight NUMERIC NOT NULL,
  formula_snapshot TEXT NOT NULL DEFAULT '',
  target_label TEXT NOT NULL DEFAULT '',
  sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS crm_pm_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  assignment_id UUID NOT NULL REFERENCES crm_pm_assignments(id),
  forecast TEXT,
  blocker TEXT,
  evidence TEXT,
  note TEXT NOT NULL DEFAULT '',
  review_state TEXT NOT NULL DEFAULT 'submitted',
  review_comment TEXT,
  created_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT crm_pm_ck_review_chk CHECK (
    review_state IN ('submitted','approved','returned','escalated')
  )
);

CREATE TABLE IF NOT EXISTS crm_pm_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  assignment_id UUID NOT NULL REFERENCES crm_pm_assignments(id),
  title TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  due_at TIMESTAMPTZ,
  impact TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_pm_actuals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  assignment_id UUID NOT NULL REFERENCES crm_pm_assignments(id),
  value NUMERIC NOT NULL,
  quality TEXT NOT NULL,
  collection_method TEXT NOT NULL,
  supersedes UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_pm_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  scorecard_id UUID NOT NULL REFERENCES crm_pm_scorecards(id),
  period_label TEXT NOT NULL,
  hash TEXT NOT NULL,
  payload_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (scorecard_id, period_label)
);

CREATE TABLE IF NOT EXISTS crm_pm_policy (
  tenant_id TEXT PRIMARY KEY,
  score_cap TEXT NOT NULL DEFAULT '100',
  green_min NUMERIC NOT NULL DEFAULT 90,
  yellow_min NUMERIC NOT NULL DEFAULT 70,
  effective_at DATE,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_pm_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_pm_idempotency (
  key TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  response_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMIT;
```

- [ ] **Step 2: Write apply script**

```bash
#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export DATABASE_URL="${DATABASE_URL:-postgresql://ptt:ptt_dev@127.0.0.1:5433/rnosaidb}"
DDL="$ROOT/docs/specs/2026-09-10-postgresql-ddl-performance-os.sql"
echo "==> Apply Performance OS DDL"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$DDL"
echo "OK  Performance OS DDL applied"
```

`chmod +x scripts/apply_pg_ddl_performance_os.sh`

- [ ] **Step 3: Dry-run nếu có Postgres**

Run: `bash scripts/apply_pg_ddl_performance_os.sh`

Expected: `OK  Performance OS DDL applied` — hoặc skip nếu không có `psql`/DB; vẫn commit file.

- [ ] **Step 4: Commit**

```bash
git add docs/specs/2026-09-10-postgresql-ddl-performance-os.sql \
        scripts/apply_pg_ddl_performance_os.sh
git commit -m "$(cat <<'EOF'
feat(performance-os): add postgres ddl for assignments and snapshots

EOF
)"
```

---

### Task 13: Repository memory fallback

**Files:**
- Create: `services/ptt-crm-api/src/kpi-hub/performance/performance.repository.ts`
- Test: `services/ptt-crm-api/src/kpi-hub/performance/performance.repository.spec.ts`

**Interfaces:**
- Consumes: `AppConfigService.databaseUrl` + `withDbFallback` (`../kpi-hub.memory-store`)
- Produces: `insertAssignment`, `getAssignment`, `listAssignments`, `insertCheckIn`, `insertActual`, `insertSnapshot`, `getSnapshot`, `insertAudit`, `getIdempotency`, `putIdempotency`

Pattern copy từ `service-kpi.repository.ts`: constructor nhận config; khi URL invalid / missing relation → memory maps.

- [ ] **Step 1: Write the failing test**

```ts
import { PerformanceRepository } from './performance.repository';

describe('PerformanceRepository', () => {
  it('round-trips assignment in memory when postgres url invalid', async () => {
    const repo = new PerformanceRepository({ databaseUrl: 'postgres://invalid' } as never);
    const row = await repo.insertAssignment({
      name: 'CPL Valid Lead',
      definition_code: 'MKT_006',
      owner_name: 'Lê Hoàng',
      scope_type: 'campaign',
      scope_id: 'an-phat',
      scope_name: 'An Phát',
      direction: 'lower',
      target: 100000,
      assigned_target: 100000,
      quoted_target: 100000,
      period_label: '09/2026',
    });
    expect((await repo.getAssignment(row.id))?.definition_code).toBe('MKT_006');
    expect((await repo.listAssignments()).some((a) => a.id === row.id)).toBe(true);
  });

  it('stores snapshot by scorecard + period', async () => {
    const repo = new PerformanceRepository({ databaseUrl: 'postgres://invalid' } as never);
    await repo.insertSnapshot({
      scorecard_id: 'sc-mkt-lead-q4',
      period_label: 'Q4-2026',
      hash: 'abc',
      payload_json: { ok: true },
    });
    expect((await repo.getSnapshot('sc-mkt-lead-q4', 'Q4-2026'))?.hash).toBe('abc');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd services/ptt-crm-api && npx jest src/kpi-hub/performance/performance.repository.spec.ts --no-coverage`

Expected: FAIL — module not found

- [ ] **Step 3: Write memory-first repository**

Implement class `PerformanceRepository` với:

- `private memory` maps: assignments, checkins, actuals, snapshots, audits, idempotency
- `insertAssignment` gán `id = randomUUID()`, `lifecycle='draft'`, `quality='pending'`, `row_version=1`
- `getAssignment` / `listAssignments` đọc memory (Postgres path: `SELECT` khi `this.config.databaseUrl` bắt đầu `postgres` **và** query không throw — dùng `withDbFallback`; URL `postgres://invalid` phải rơi memory)
- `insertSnapshot` key `${scorecard_id}:${period_label}`
- `insertAudit({ actor, action, entity, payload_json })`
- `getIdempotency(key)` / `putIdempotency(key, response)`

Không cần implement hết Postgres SQL trong task này — memory path phải PASS. Postgres SQL có thể là stub `throw` để fallback.

- [ ] **Step 4: Run to verify it passes**

Run: `cd services/ptt-crm-api && npx jest src/kpi-hub/performance/performance.repository.spec.ts --no-coverage`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add services/ptt-crm-api/src/kpi-hub/performance/performance.repository.ts \
        services/ptt-crm-api/src/kpi-hub/performance/performance.repository.spec.ts
git commit -m "$(cat <<'EOF'
feat(performance-os): add assignment repository with memory fallback

EOF
)"
```

---

### Task 14: Service + types v3 (activate, lock, close, review)

**Files:**
- Modify: `services/ptt-crm-api/src/kpi-hub/performance/performance.types.ts`
- Modify: `services/ptt-crm-api/src/kpi-hub/performance/performance.catalog.ts` — thêm field mới trên seed (`asg-cpa.collection_method='api'`, `asg-cpl.quoted_target=100000`, `asg-cpl.assumption_open=true`, `marketing.attribution_ready=false`, bỏ `roas: 4.52` số trần)
- Modify: `services/ptt-crm-api/src/kpi-hub/performance/performance.service.ts`
- Test: `services/ptt-crm-api/src/kpi-hub/performance/performance.service.spec.ts` — **thêm** case, giữ 3 test cũ

**Interfaces:**
- Consumes: mọi domain function Wave A + catalog seed
- Produces methods:

```ts
getAssignment(id: string): PmAssignment
activateAssignment(id: string): PmAssignment
createCheckIn(body): PmCheckIn   // gọi assertActualWritable + assertRedRitual
reviewCheckIn(id, { to, comment })
closePeriod({ scorecard_id, period })
reopenPeriod({ scorecard_id, period, reason })
listSnapshots(scorecard_id?, period?)
listAuditLogs()
exportReport({ actor, role })
updateSettings(patch)            // nhận effective_at; impact không đụng snapshot
```

`getDashboard()` phải gọi `computeDashboardTiles` + `buildLedgers` (CPL An Phát) + `buildWeeklyRhythm`. Không hardcode `data_blocked` nếu catalog có stale.

`getMarketing()` gọi `roasDisplay({ attribution_ready: false, value: 4.52 })`.

`getCampaigns()` tách `media_budget` / `agency_fee`; funnel BOOKING = `funnelStage({ label:'BOOKING', mapped:false })`.

- [ ] **Step 1: Write failing tests (append)**

```ts
it('refuses overwrite of verified auto actual (AC-PM-08)', async () => {
  const svc = new PerformanceService();
  await expect(svc.createCheckIn({ assignment_id: 'asg-cpa', note: 'ok', actual: 1 })).rejects.toMatchObject({
    response: { error: 'actual_locked' },
  });
});

it('activate blocked without measurement plan', () => {
  const svc = new PerformanceService();
  const draft = svc.createAssignment({
    name: 'CPL custom orphan',
    definition_code: 'MKT_006',
    owner: 'Lê Hoàng',
    scope_type: 'campaign',
    scope_name: 'Orphan',
    target: 100000,
    direction: 'lower',
    collection_method: 'api',
  });
  try {
    svc.activateAssignment(draft.id);
    throw new Error('expected block');
  } catch (err) {
    expect((err as BadRequestException).getResponse()).toMatchObject({ error: 'readiness_blocked' });
  }
});

it('close refused when quality pending (AC-PM-04)', () => {
  const svc = new PerformanceService();
  try {
    svc.closePeriod({ scorecard_id: 'sc-mkt-lead-q4', period: 'Q4-2026' });
    throw new Error('expected quality block');
  } catch (err) {
    expect((err as BadRequestException).getResponse()).toMatchObject({ error: 'quality_blocks_close' });
  }
});

it('marketing roas is N/A without attribution (AC-PM-09)', () => {
  const svc = new PerformanceService();
  expect(svc.getMarketing().roas).toEqual({
    value: null,
    display: 'N/A',
    reason: 'Thiếu attribution model',
  });
});
```

Gắn seed: `asg-cpa.collection_method = 'api'`, `asg-cpa.quality = 'verified'`. Scorecard Q4 vẫn có item CPL quality stale qua mapping catalog `crm_mappings[0]`.

`closePeriod` lấy quality từ assignments linked scorecard **hoặc** từ `cascadeQuality(crm_mappings)`. Seed: Valid Lead stale → CPL pending → `canClosePeriod` false.

- [ ] **Step 2: Run to verify new tests fail**

Run: `cd services/ptt-crm-api && npx jest src/kpi-hub/performance/performance.service.spec.ts --no-coverage`

Expected: FAIL — `activateAssignment` / `closePeriod` / `roas` object missing

- [ ] **Step 3: Wire service**

Trong `createCheckIn`:

```ts
try {
  assertActualWritable({
    quality: asg.quality,
    collection_method: asg.collection_method ?? 'manual',
    incoming_actual: body.actual,
  });
} catch (e) {
  throw new BadRequestException({ error: (e as Error).message });
}
if (body.actual != null && asg.quality === 'verified' && (asg.collection_method === 'api' || asg.collection_method === 'connector')) {
  throw new BadRequestException({ error: 'actual_locked' });
}
```

Không gán `asg.actual = body.actual` khi locked. Red: `assertRedRitual` — nếu thiếu action, nhận `body.action_title`.

`activateAssignment`: `evaluateReadiness` từ assignment fields; fail `readiness_blocked` kèm `gates`.

`closePeriod`: `cascadeQuality` trên catalog mappings; `canClosePeriod`; else `freezeSnapshot` + repo/catalog snapshots array; set scorecard `status='closed'`.

`reopenPeriod`: `reason.trim()` bắt buộc; `assertNotClosed` đảo state về `active`; audit `period_reopen`.

`exportReport`: `filterFieldsForRole` + audit `export`.

Map domain `Error.message` → `BadRequestException({ error: message })` khi message ∈ danh sách error codes.

Mở rộng `PmAssignment` / `PmDashboard` / `PmMarketing` / `PmCampaignRow` trong `performance.types.ts` đúng Shared contracts. Seed catalog: điền default cho assignment cũ (`quoted_target: null`, `collection_method: 'manual'`, `lifecycle: 'tracking'`, `assumption_open: false`, `row_version: 1`) trừ các fixture nêu trên.

- [ ] **Step 4: Run to verify it passes**

Run: `cd services/ptt-crm-api && npx jest src/kpi-hub/performance --no-coverage`

Expected: PASS toàn bộ performance unit (domain + service cũ + mới)

- [ ] **Step 5: Commit**

```bash
git add services/ptt-crm-api/src/kpi-hub/performance/performance.types.ts \
        services/ptt-crm-api/src/kpi-hub/performance/performance.catalog.ts \
        services/ptt-crm-api/src/kpi-hub/performance/performance.service.ts \
        services/ptt-crm-api/src/kpi-hub/performance/performance.service.spec.ts
git commit -m "$(cat <<'EOF'
feat(performance-os): activate lock actual and close period on service

EOF
)"
```

---

### Task 15: Hydrate actuals from Service KPI Tracking

**Files:**
- Modify: `services/ptt-crm-api/src/kpi-hub/performance/performance.service.ts`
- Modify: `services/ptt-crm-api/src/kpi-hub/kpi-hub.module.ts` — inject `ServiceKpiRepository` vào `PerformanceService` (optional constructor)
- Test: `services/ptt-crm-api/src/kpi-hub/performance/performance.service.spec.ts`

**Interfaces:**
- Consumes: `ServiceKpiRepository.listRecentActuals` hoặc `listActuals(instance_id)` — dùng method **đã có** trên repo Service KPI. Nếu constructor không nhận repo (test `new PerformanceService()`), hydrate no-op.
- Produces: `hydrateFromInstance(asg)` set `actual`, `quality` từ actual mới nhất `quality=valid` → `verified`; `pending`/`stale` giữ nguyên enum Performance.

- [ ] **Step 1: Write the failing test**

```ts
it('hydrates assignment actual from service kpi instance when repo provided', async () => {
  const repo = {
    listRecentActuals: async () => [{ instance_id: 'inst-1', value: 99000, quality: 'valid' }],
  };
  const svc = new PerformanceService(repo as never);
  svc.createAssignment({
    name: 'CPL hydrated',
    definition_code: 'MKT_006',
    owner: 'Lê Hoàng',
    scope_type: 'campaign',
    scope_name: 'An Phát',
    target: 100000,
    direction: 'lower',
    instance_id: 'inst-1',
  });
  const items = (await svc.listAssignments()).items;
  const row = items.find((a) => a.instance_id === 'inst-1');
  expect(row?.actual).toBe(99000);
  expect(row?.quality).toBe('verified');
});
```

Nếu `listRecentActuals` không tồn tại đúng chữ ký, đọc `service-kpi.repository.ts` và gọi method list actual theo `instance_id` thật — **đổi test cho khớp method có sẵn**, không invent method mới trên Service KPI.

- [ ] **Step 2: Run to verify it fails**

Expected: FAIL — constructor / hydrate missing

- [ ] **Step 3: Implement optional inject + map `valid`→`verified`**

- [ ] **Step 4: Run `npx jest src/kpi-hub/performance/performance.service.spec.ts --no-coverage`** — PASS

- [ ] **Step 5: Commit**

```bash
git add services/ptt-crm-api/src/kpi-hub/performance/performance.service.ts \
        services/ptt-crm-api/src/kpi-hub/performance/performance.service.spec.ts \
        services/ptt-crm-api/src/kpi-hub/kpi-hub.module.ts
git commit -m "$(cat <<'EOF'
feat(performance-os): hydrate assignment actuals from service kpi tracking

EOF
)"
```

---

### Task 16: Controller routes + Idempotency-Key

**Files:**
- Modify: `services/ptt-crm-api/src/kpi-hub/performance/performance.controller.ts`

**Interfaces:**
- Prefix giữ `@Controller('api/crm/kpi-hub/performance')`
- Guard giữ `StaffOrInternalKeyGuard, StaffKpiHubViewGuard`

Thêm route (không xóa route cũ):

| Method | Path | Service |
|---|---|---|
| GET | `/assignments/:id` | `getAssignment` |
| POST | `/assignments/:id/activate` | `activateAssignment` |
| POST | `/check-ins/:id/review` | `reviewCheckIn` |
| POST | `/period-close` | `closePeriod` |
| POST | `/period-reopen` | `reopenPeriod` |
| GET | `/snapshots` | `listSnapshots` |
| GET | `/audit-logs` | `listAuditLogs` |
| POST | `/reports/export` | `exportReport` |

Header `Idempotency-Key` trên POST create/activate/check-in/close: nếu key đã có → trả response cũ, không tạo bản ghi mới.

- [ ] **Step 1: Write a thin controller spec** `performance.controller.spec.ts`

```ts
import { PerformanceController } from './performance.controller';

describe('PerformanceController', () => {
  it('exposes activate close reopen snapshot audit export', () => {
    const proto = PerformanceController.prototype;
    expect(typeof proto.activateAssignment).toBe('function');
    expect(typeof proto.closePeriod).toBe('function');
    expect(typeof proto.reopenPeriod).toBe('function');
    expect(typeof proto.snapshots).toBe('function');
    expect(typeof proto.auditLogs).toBe('function');
    expect(typeof proto.exportReport).toBe('function');
    expect(typeof proto.getAssignment).toBe('function');
    expect(typeof proto.reviewCheckIn).toBe('function');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd services/ptt-crm-api && npx jest src/kpi-hub/performance/performance.controller.spec.ts --no-coverage`

Expected: FAIL — methods missing

- [ ] **Step 3: Add controller methods**

```ts
@Get('assignments/:id')
getAssignment(@Param('id') id: string) {
  return this.performance.getAssignment(id);
}

@Post('assignments/:id/activate')
activateAssignment(@Param('id') id: string) {
  return this.performance.activateAssignment(id);
}

@Post('check-ins/:id/review')
reviewCheckIn(
  @Param('id') id: string,
  @Body() body: { to: 'approved' | 'returned' | 'escalated'; comment?: string },
) {
  return this.performance.reviewCheckIn(id, body);
}

@Post('period-close')
closePeriod(@Body() body: { scorecard_id: string; period: string }) {
  return this.performance.closePeriod(body);
}

@Post('period-reopen')
reopenPeriod(@Body() body: { scorecard_id: string; period: string; reason: string }) {
  return this.performance.reopenPeriod(body);
}

@Get('snapshots')
snapshots(@Query('scorecard_id') scorecardId?: string, @Query('period') period?: string) {
  return this.performance.listSnapshots(scorecardId, period);
}

@Get('audit-logs')
auditLogs() {
  return this.performance.listAuditLogs();
}

@Post('reports/export')
exportReport(@Body() body: { actor?: string; role?: string }) {
  return this.performance.exportReport({ actor: body.actor ?? 'staff', role: body.role ?? 'lead' });
}
```

Idempotency: đọc header trong từng POST đã liệt kê; gọi `repo.getIdempotency` / `putIdempotency`. Nếu repo chưa inject, dùng `Map` private trên service.

- [ ] **Step 4: Run** `npx jest src/kpi-hub/performance --no-coverage` — PASS

- [ ] **Step 5: Commit**

```bash
git add services/ptt-crm-api/src/kpi-hub/performance/performance.controller.ts \
        services/ptt-crm-api/src/kpi-hub/performance/performance.controller.spec.ts \
        services/ptt-crm-api/src/kpi-hub/performance/performance.service.ts
git commit -m "$(cat <<'EOF'
feat(performance-os): expose activate close snapshot and export routes

EOF
)"
```

---

## Wave C — Client types + UI khớp mockup (Task 17–30)

Đọc mockup `docs/design/rnosai-performance-management-mockup.html` section tương ứng trước khi sửa page. Copy nhãn **nguyên văn**.

### Task 17: Frontend types + API client

**Files:**
- Modify: `services/ops-web/src/lib/performance-types.ts`
- Modify: `services/ops-web/src/lib/performance-api.ts`

**Interfaces:**
- Mirror Shared contracts. `PmMarketing.roas` đổi thành `{ value: number | null; display: string; reason: string | null }` — **breaking** với page cũ, Task 26 sửa cùng lúc nếu type-check fail; Task 17 được phép update import type only, chưa đổi JSX.

```ts
export type PmDashboard = {
  on_track: number;
  watch: number;
  off_track: number;
  total: number;
  completion_pct: number;
  checkin_on_time_pct: number;
  data_blocked: number;
  ledgers: {
    quoted: { value: number | null; label: string; hint: string };
    assigned: { value: number | null; label: string; hint: string };
    verified: { value: number | null; label: string; hint: string };
  };
  rhythm: Array<{ id: string; title: string; body: string; href: string }>;
  dept_scores: Array<{ department: string; score: number; status: PmHealth }>;
  queue: Array<{ title: string; badge: string; href: string }>;
};

export type PmAssignment = {
  /* field cũ giữ nguyên */
  quoted_target: number | null;
  source_id: string | null;
  instance_id: string | null;
  collection_method: string;
  lifecycle: string;
  quoted_vs_assigned_pct: number | null;
  quoted_vs_actual_pct: number | null;
  quoted_delta_material: boolean;
  actual_locked: boolean;
  assumption_open: boolean;
  client_visible: boolean;
  disclaimer: string;
};

export type PmCampaigns = {
  items: Array<{
    campaign: string;
    client: string;
    quote_wo: string;
    kpi: string;
    quoted: string;
    actual: string;
    media_budget: string;
    agency_fee: string;
    status: PmHealth;
  }>;
  funnel: Array<{ label: string; value: number | null; display: string; hint: string }>;
};

export type PmReports = {
  completion_pct: number;
  compliance_pct: number;
  at_risk_pct: number;
  overdue_checkins: number;
  snapshots: number;
  scorecards_active: number;
  period_state: 'open' | 'closed';
  by_scope: Array<{ scope: string; healthy_pct: number; green?: number; yellow?: number; red?: number }>;
};

export type PmSettings = {
  score_cap: string;
  weight_must_100: boolean;
  green_min: number;
  yellow_min: number;
  lower_red_rule: string;
  reminder: string;
  escalation: string;
  stale_action: string;
  period_close: string;
  default_source: string;
  client_visibility: string;
  effective_at: string;
  impact: { scorecards: number; assignments: number; snapshots_untouched: boolean };
};
```

Thêm client functions:

```ts
export const fetchPmAssignment = (token: string, id: string) =>
  pmFetch<PmAssignment>(token, `${BASE}/assignments/${id}`);
export const activatePmAssignment = (token: string, id: string) =>
  pmFetch<PmAssignment>(token, `${BASE}/assignments/${id}/activate`, { method: 'POST' });
export const reviewPmCheckIn = (token: string, id: string, body: { to: string; comment?: string }) =>
  pmFetch(token, `${BASE}/check-ins/${id}/review`, { method: 'POST', body: JSON.stringify(body) });
export const closePmPeriod = (token: string, body: { scorecard_id: string; period: string }) =>
  pmFetch(token, `${BASE}/period-close`, { method: 'POST', body: JSON.stringify(body) });
export const reopenPmPeriod = (token: string, body: { scorecard_id: string; period: string; reason: string }) =>
  pmFetch(token, `${BASE}/period-reopen`, { method: 'POST', body: JSON.stringify(body) });
export const exportPmReport = (token: string, body: Record<string, unknown>) =>
  pmFetch(token, `${BASE}/reports/export`, { method: 'POST', body: JSON.stringify(body) });
```

- [ ] **Step 1–2:** Cập nhật type. `cd services/ops-web && npx tsc --noEmit` có thể FAIL ở page cũ — chấp nhận đến Task 20–26 sửa page. Nếu muốn type-check xanh ngay: thêm field optional (`data_blocked?: number`) rồi siết required ở Task 20.

- [ ] **Step 3: Commit**

```bash
git add services/ops-web/src/lib/performance-types.ts services/ops-web/src/lib/performance-api.ts
git commit -m "$(cat <<'EOF'
feat(performance-os): extend client types for ledgers close and roas na

EOF
)"
```

---

### Task 18: Shared UI primitives + CSS

**Files:**
- Create: `services/ops-web/src/components/kpi-hub/performance/PmMoatNotice.tsx`
- Create: `services/ops-web/src/components/kpi-hub/performance/PmLedgers.tsx`
- Create: `services/ops-web/src/components/kpi-hub/performance/PmQualityChip.tsx`
- Create: `services/ops-web/src/components/kpi-hub/performance/PmReadinessRail.tsx`
- Create: `services/ops-web/src/components/kpi-hub/performance/PmWeeklyRhythm.tsx`
- Create: `services/ops-web/src/components/kpi-hub/performance/PmPageState.tsx`
- Create: `services/ops-web/src/components/kpi-hub/performance/PmQualityChip.spec.tsx` (Vitest)
- Modify: `services/ops-web/src/app/globals.css` — append block dưới `.kpi-hub-pm-list`

**Interfaces:**
- Produces đúng JSX dưới đây — page sau chỉ import, không copy markup.

```tsx
// PmMoatNotice.tsx
export function PmMoatNotice({ children }: { children: React.ReactNode }) {
  return <p className="kpi-hub-pm-moat">{children}</p>;
}

export function PmAmberNotice({ children }: { children: React.ReactNode }) {
  return <p className="kpi-hub-pm-notice">{children}</p>;
}

// PmQualityChip.tsx
export function PmQualityChip({ quality }: { quality: string }) {
  const q = quality.toLowerCase();
  const label = q === 'verified' ? 'Verified' : q === 'stale' ? 'Stale' : 'Pending';
  const cls =
    q === 'verified'
      ? 'kpi-hub-badge kpi-hub-badge--pass'
      : 'kpi-hub-badge kpi-hub-badge--amber';
  return <span className={cls}>{label}</span>;
}

// PmLedgers.tsx
type Cell = { value: number | null; label: string; hint: string };
export function PmLedgers({
  quoted,
  assigned,
  verified,
}: {
  quoted: Cell;
  assigned: Cell;
  verified: Cell;
}) {
  const fmt = (n: number | null) => (n == null ? 'Pending' : n.toLocaleString('vi-VN'));
  return (
    <div className="kpi-hub-pm-ledgers">
      <article className="kpi-hub-card kpi-hub-pm-ledger"><label>SỔ QUOTED</label><b>{fmt(quoted.value)}</b><span>{quoted.hint}</span></article>
      <article className="kpi-hub-card kpi-hub-pm-ledger"><label>SỔ ASSIGNED</label><b>{fmt(assigned.value)}</b><span>{assigned.hint}</span></article>
      <article className="kpi-hub-card kpi-hub-pm-ledger"><label>SỔ VERIFIED</label><b>{fmt(verified.value)}</b><span>{verified.hint}</span></article>
    </div>
  );
}

// PmReadinessRail.tsx
export function PmReadinessRail({
  gates,
}: {
  gates: Array<{ id: string; status: string; detail: string }>;
}) {
  return (
    <div className="kpi-hub-pm-gate">
      {gates.map((g) => (
        <div className="kpi-hub-pm-gate__row" key={g.id}>
          <span>{g.detail}</span>
          <b className={`is-${g.status}`}>{g.status === 'pass' ? 'Pass' : g.status === 'pending' ? 'Pending map' : 'Fail'}</b>
        </div>
      ))}
    </div>
  );
}

// PmWeeklyRhythm.tsx
import Link from 'next/link';
export function PmWeeklyRhythm({
  items,
}: {
  items: Array<{ id: string; title: string; body: string; href: string }>;
}) {
  return (
    <div className="kpi-hub-pm-rhythm">
      {items.map((row, i) => (
        <div className="kpi-hub-pm-rhythm__row" key={row.id}>
          <i>{i + 1}</i>
          <div>
            <b>{row.title}</b>
            <p>{row.body}</p>
          </div>
          <Link href={row.href} className="kpi-hub-btn kpi-hub-btn--ghost">Mở</Link>
        </div>
      ))}
    </div>
  );
}

// PmPageState.tsx — DoD states
export function PmPageState({
  loading,
  error,
  empty,
  denied,
}: {
  loading?: boolean;
  error?: string | null;
  empty?: boolean;
  denied?: boolean;
}) {
  if (denied) return <p className="kpi-hub-form-error">Không có quyền xem màn này.</p>;
  if (loading) return <p className="kpi-hub-muted">Đang tải…</p>;
  if (error) return <p className="kpi-hub-form-error">{error}</p>;
  if (empty) return <p className="kpi-hub-muted">Chưa có dữ liệu kỳ này.</p>;
  return null;
}
```

CSS append (`globals.css`):

```css
.kpi-hub-pm-moat { padding: 10px 12px; border-radius: 8px; background: #f5f3ff; color: #4c1d95; font-size: 0.78rem; margin-bottom: 14px; }
.kpi-hub-pm-notice { padding: 10px 12px; border-radius: 8px; background: #fff7e8; color: #854d0e; font-size: 0.78rem; margin-bottom: 14px; }
.kpi-hub-pm-ledgers { display: grid; grid-template-columns: repeat(3, 1fr); gap: 11px; margin: 14px 0; }
.kpi-hub-pm-ledger { padding: 13px 16px; }
.kpi-hub-pm-ledger label { display: block; font-size: 0.68rem; font-weight: 800; letter-spacing: .06em; color: #68778e; }
.kpi-hub-pm-ledger b { display: block; margin: 6px 0 4px; font-size: 1.05rem; }
.kpi-hub-pm-ledger span { font-size: 0.75rem; color: #68778e; }
.kpi-hub-pm-gate { display: grid; gap: 8px; }
.kpi-hub-pm-gate__row { display: flex; justify-content: space-between; gap: 10px; font-size: 0.8rem; }
.kpi-hub-pm-gate__row b.is-pass { color: #15803d; }
.kpi-hub-pm-gate__row b.is-pending { color: #b45309; }
.kpi-hub-pm-gate__row b.is-fail { color: #dc2626; }
.kpi-hub-pm-rhythm { display: grid; gap: 11px; }
.kpi-hub-pm-rhythm__row { display: flex; gap: 9px; align-items: flex-start; }
.kpi-hub-pm-rhythm__row i { display: grid; place-items: center; width: 23px; height: 23px; border-radius: 50%; background: #eaf0ff; color: #2563eb; font-size: 0.7rem; font-weight: 800; font-style: normal; flex: 0 0 auto; }
.kpi-hub-pm-rhythm__row p { margin: 0.2rem 0 0; color: #64748b; font-size: 0.78rem; }
.kpi-hub-pm-metricgrid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 9px; }
.kpi-hub-pm-metric { padding: 10px; border: 1px solid #e6edf8; border-radius: 9px; background: #fbfcff; }
.kpi-hub-pm-metric span { display: block; color: #68778e; font-size: 0.68rem; font-weight: 700; }
.kpi-hub-pm-metric b { display: block; margin-top: 6px; font-size: 0.95rem; }
.kpi-hub-pm-tile-blocked { background: #fff1f2; border-color: #fecaca; }
@media (max-width: 1200px) {
  .kpi-hub-pm-ledgers { grid-template-columns: 1fr; }
  .kpi-hub-pm-metricgrid { grid-template-columns: 1fr; }
}
```

- [ ] **Step 1: Vitest**

```tsx
import { renderToStaticMarkup } from 'react-dom/server';
import { PmQualityChip } from './PmQualityChip';

it('renders Stale not Verified', () => {
  expect(renderToStaticMarkup(<PmQualityChip quality="stale" />)).toContain('Stale');
  expect(renderToStaticMarkup(<PmQualityChip quality="verified" />)).toContain('Verified');
});
```

Run: `cd services/ops-web && npx vitest run src/components/kpi-hub/performance/PmQualityChip.spec.tsx`

Expected: PASS (nếu project chưa resolve JSX, đổi sang test thuần map label function export `qualityLabel`)

- [ ] **Step 2–5: Commit**

```bash
git add services/ops-web/src/components/kpi-hub/performance \
        services/ops-web/src/app/globals.css
git commit -m "$(cat <<'EOF'
feat(performance-os): add ledger strip readiness rail and page states

EOF
)"
```

---

### Task 19: Nav copy khớp mockup

**Files:**
- Modify: `services/ops-web/src/lib/kpi-hub-nav.ts` nhóm `id: 'performance'`
- Modify: `services/ops-web/src/lib/kpi-hub-nav.spec.ts` — thêm assert 11 label
- Modify OpsNav / nav-icons nếu duplicate label (search `Dashboard hiệu suất`)

Nhãn **đúng mockup**:

```ts
{ href: '/crm/kpi-hub/performance', label: 'Operating Dashboard', icon: 'dashboard' },
{ href: '/crm/kpi-hub/performance/assignments', label: 'Assignment Registry', icon: 'list' },
{ href: '/crm/kpi-hub/performance/assignments/new', label: 'Tạo Assignment', icon: 'layers' },
{ href: '/crm/kpi-hub/performance/scorecards', label: 'Scorecard Builder', icon: 'template' },
{ href: '/crm/kpi-hub/performance/scorecards/items', label: 'Thêm chỉ tiêu', icon: 'target' },
{ href: '/crm/kpi-hub/performance/check-ins', label: 'Check-in Ritual', icon: 'check' },
{ href: '/crm/kpi-hub/performance/marketing', label: 'Marketing OS', icon: 'chart' },
{ href: '/crm/kpi-hub/performance/campaigns', label: 'Campaign Control', icon: 'track' },
{ href: '/crm/kpi-hub/performance/crm-source', label: 'CRM Source Map', icon: 'database' },
{ href: '/crm/kpi-hub/performance/reports', label: 'Snapshot Report', icon: 'chart' },
{ href: '/crm/kpi-hub/performance/settings', label: 'Policy', icon: 'gear' },
```

- [ ] **Step 1: Failing nav spec**

```ts
expect(KPI_HUB_NAV_GROUPS[3].items.map((i) => i.label)).toEqual([
  'Operating Dashboard',
  'Assignment Registry',
  'Tạo Assignment',
  'Scorecard Builder',
  'Thêm chỉ tiêu',
  'Check-in Ritual',
  'Marketing OS',
  'Campaign Control',
  'CRM Source Map',
  'Snapshot Report',
  'Policy',
]);
```

Run: `cd services/ops-web && npx vitest run src/lib/kpi-hub-nav.spec.ts`

Expected: FAIL — labels Phase 1

- [ ] **Step 2: Đổi label. Run lại — PASS**

- [ ] **Step 3: Commit**

```bash
git add services/ops-web/src/lib/kpi-hub-nav.ts services/ops-web/src/lib/kpi-hub-nav.spec.ts
git commit -m "$(cat <<'EOF'
feat(performance-os): align hieu suat nav labels with mockup

EOF
)"
```

---

### Task 20: PM-01 Operating Dashboard

**Files:**
- Modify: `services/ops-web/src/app/crm/kpi-hub/performance/page.tsx`

Khớp `#dashboard` mockup:

- Title `Operating Dashboard`
- Subtitle `PM-01 · Nhịp tuần agency — không phải dashboard OKR generic.`
- Actions: Snapshot Report + `＋ Assignment`
- `PmMoatNotice`: đúng câu *Khác Lattice / 15Five* + *Khác AgencyAnalytics*
- 6 tile qua `ServiceKpiSummaryTiles`: ĐÚNG TIẾN ĐỘ, THEO DÕI, KHÔNG ĐẠT, COMPLETION, CHECK-IN ĐÚNG HẠN, **DATA BLOCKED** (tile cuối class `kpi-hub-pm-tile-blocked` nếu `ServiceKpiSummaryTiles` hỗ trợ `className`/`tone: 'critical'`)
- `PmLedgers` từ `data.ledgers`
- `PmWeeklyRhythm` 5 câu
- Chart phòng ban giữ
- Queue: item “06 check-in quá hạn” href **phải** `/crm/kpi-hub/performance/check-ins?overdue=1` (FR-PM-DASH-008)
- `PmPageState` cho loading/error/empty

- [ ] **Step 1:** Đổi title/subtitle/actions/moat/6 tile/ledgers/rhythm. Xóa block “Đường đi dữ liệu Performance Management” (generic — không có trên mockup).

- [ ] **Step 2:** `npx tsc --noEmit` trong ops-web — page này type-ok.

- [ ] **Step 3: Commit**

```bash
git add services/ops-web/src/app/crm/kpi-hub/performance/page.tsx
git commit -m "$(cat <<'EOF'
feat(performance-os): operating dashboard with ledgers and weekly rhythm

EOF
)"
```

---

### Task 21: PM-02 Assignment Registry

**Files:**
- Modify: `services/ops-web/src/app/crm/kpi-hub/performance/assignments/page.tsx`

Khớp `#manage`:

- Title `Assignment Registry`
- `PmAmberNotice` AC-PM-02 (CPA 149K Green)
- Filter chips (period / org / quality / direction) — state local, filter `items` phía client
- Tabs thêm **Campaign** (`scope_type === 'campaign'`)
- Cột: KPI+code, Owner, Scope, Dir (`↓ lower` / `↑ higher`), Target, Actual+`PmQualityChip`, Quoted Δ, Progress, Status, Ritual
- Quoted Δ: `quoted_vs_actual_pct`; nếu `quoted_delta_material` và `source_id` → `Link` `/crm/kpi-hub/reconcile?source=${source_id}`
- Lower-is-better: hiện `target_label` đã có `≤`
- Nút Ritual → `/crm/kpi-hub/performance/check-ins?assignment=${id}`
- Xóa 5 tile summary trùng dashboard (mockup registry không có)

- [ ] **Step 1–3: Implement + tsc + commit**

```bash
git add services/ops-web/src/app/crm/kpi-hub/performance/assignments/page.tsx
git commit -m "$(cat <<'EOF'
feat(performance-os): registry columns for direction quality and quoted delta

EOF
)"
```

---

### Task 22: PM-03 Tạo Assignment + readiness rail

**Files:**
- Modify: `services/ops-web/src/app/crm/kpi-hub/performance/assignments/new/page.tsx`

Khớp `#create` — 3 card + rail:

1. Metric chuẩn: select Definition (`MKT_006`, `SAL_014`), Classification disabled, Formula snapshot disabled
2. Scope & owner
3. Target band: Direction disabled inherit, Target / Minimum / Stretch
4. Aside `PmReadinessRail` — gọi local `evaluate` mirror: auto + chưa map → source pending
5. Lưu nháp = `POST /assignments`. Submit Activate = `POST /assignments/:id/activate`. Hiện `readiness_blocked` + gates.
6. Notice: Target = Quoted → đổi 85K material CO

Prefill Phase 2a hardcode 2 definition. Không fetch Dictionary (Phase 2b ngoài plan).

- [ ] **Commit**

```bash
git add services/ops-web/src/app/crm/kpi-hub/performance/assignments/new/page.tsx
git commit -m "$(cat <<'EOF'
feat(performance-os): create assignment readiness gate ui

EOF
)"
```

---

### Task 23: PM-04 Scorecard Builder

**Files:**
- Modify: `services/ops-web/src/app/crm/kpi-hub/performance/scorecards/page.tsx`

Khớp `#scorecard`:

- Title `Scorecard Builder — {title}`
- `PmMoatNotice` definition_version + formula_snapshot
- Form: Loại, Kỳ, Inherit từ, Approver
- Table: KPI, Weight, Target, Dir, Source
- Success: `Tổng trọng số 100% — hợp lệ`
- Aside phân bổ Outcome 50 / Efficiency 20 / Funnel 20 / Delivery 10
- CTA `＋ Thêm chỉ tiêu` → `/crm/kpi-hub/performance/scorecards/items`

- [ ] **Commit**

```bash
git add services/ops-web/src/app/crm/kpi-hub/performance/scorecards/page.tsx
git commit -m "$(cat <<'EOF'
feat(performance-os): scorecard inherit banner and weight preview

EOF
)"
```

---

### Task 24: PM-05 Thêm chỉ tiêu

**Files:**
- Modify: `services/ops-web/src/app/crm/kpi-hub/performance/scorecards/items/page.tsx`

Khớp `#item`:

- Preview aside: Hiện tại / Sau khi add
- Submit `addPmScorecardItem`; nếu API `weight_exceeds_100` hiện `AC-PM-01: Add bị block. Draft vẫn giữ scorecard cũ.`
- Formula snapshot read-only
- Simulated score không bắt buộc Wave này (Phase 3) — chỉ weight preview

- [ ] **Commit**

```bash
git add services/ops-web/src/app/crm/kpi-hub/performance/scorecards/items/page.tsx
git commit -m "$(cat <<'EOF'
feat(performance-os): scorecard item weight preview blocks 105 percent

EOF
)"
```

---

### Task 25: PM-06 Check-in Ritual

**Files:**
- Modify: `services/ops-web/src/app/crm/kpi-hub/performance/check-ins/page.tsx`

Khớp `#checkin` + modal mockup:

- Title `Check-in Ritual — {assignment.name}`
- `PmAmberNotice` khác 15Five
- Metricgrid: TARGET / ACTUAL · Verified / OVERRUN
- Timeline + review badges
- Aside Quality stamp: Source, Last sync, `PmQualityChip`
- Modal check-in: Actual `disabled={assignment.actual_locked}`; Forecast; Blocker `required` khi status red; Evidence
- POST thiếu blocker → hiện `blocker_required_when_red`
- Modal Corrective Action + `createPmAction`
- Query `?overdue=1` highlight hàng overdue; `?assignment=` chọn assignment

- [ ] **Commit**

```bash
git add services/ops-web/src/app/crm/kpi-hub/performance/check-ins/page.tsx
git commit -m "$(cat <<'EOF'
feat(performance-os): check-in ritual locks verified actual

EOF
)"
```

---

### Task 26: PM-07 Marketing OS

**Files:**
- Modify: `services/ops-web/src/app/crm/kpi-hub/performance/marketing/page.tsx`

Khớp `#marketing`:

- 5 tile: MEDIA SPEND, VALID LEADS (hint Pending nếu CRM stale), CPL VALID, MQL RATE, **ROAS = `data.roas.display`** + `data.roas.reason`
- At risk list + Source health
- CTA Command Center → `/crm/kpi-hub/marketing`

Cấm `toFixed` trên `roas` number cũ.

- [ ] **Commit**

```bash
git add services/ops-web/src/app/crm/kpi-hub/performance/marketing/page.tsx
git commit -m "$(cat <<'EOF'
feat(performance-os): marketing os hides roas without attribution

EOF
)"
```

---

### Task 27: PM-08 Campaign Control

**Files:**
- Modify: `services/ops-web/src/app/crm/kpi-hub/performance/campaigns/page.tsx`

Khớp `#campaign`:

- Cột: Campaign, Client, Quote/WO, KPI, Quoted, Actual, Media, Fee, Status
- Funnel 4 tile từ `funnel[].display` (BOOKING = `—`)
- Aside Dependencies copy mockup
- Không render `budget` một cột cũ

- [ ] **Commit**

```bash
git add services/ops-web/src/app/crm/kpi-hub/performance/campaigns/page.tsx
git commit -m "$(cat <<'EOF'
feat(performance-os): campaign table splits media fee and empty funnel stages

EOF
)"
```

---

### Task 28: PM-09 CRM Source Map

**Files:**
- Modify: `services/ops-web/src/app/crm/kpi-hub/performance/crm-source/page.tsx`

Khớp `#crm`:

- `PmMoatNotice` AC-PM-04
- 5 tile RAW / VALID / MQL / SQL / RESPONSE SLA
- Table: KPI, Rule (versioned), Field, Cadence, Quality, Dependent PM KPI
- Seed mapping `definition` phải hiện `v3` (sửa catalog `is_valid ∧ dedup · v3` nếu chưa)
- Không render tên lead / PII
- CTA Measurement Plan `/crm/kpi-hub/measurement` (nếu route tồn tại; không thì `/crm/kpi-hub/tracking`) + Check-in CPL `?assignment=asg-cpl`

- [ ] **Commit**

```bash
git add services/ops-web/src/app/crm/kpi-hub/performance/crm-source/page.tsx \
        services/ptt-crm-api/src/kpi-hub/performance/performance.catalog.ts
git commit -m "$(cat <<'EOF'
feat(performance-os): crm source map with versioned rules

EOF
)"
```

---

### Task 29: PM-10 Snapshot Report

**Files:**
- Modify: `services/ops-web/src/app/crm/kpi-hub/performance/reports/page.tsx`

Khớp `#reports`:

- 5 tile: COMPLETION, COMPLIANCE, AT RISK, OVERDUE, **SNAPSHOTS** (`data.snapshots`)
- Health by scope stack bars (dùng `green/yellow/red` nếu API có; không thì 1 bar `healthy_pct`)
- Aside Close policy — nếu `period_state==='closed'` copy “Tháng 08 đã close — report này đọc snapshot”
- Export → `exportPmReport` + toast “Export XLSX đã ghi audit”

- [ ] **Commit**

```bash
git add services/ops-web/src/app/crm/kpi-hub/performance/reports/page.tsx
git commit -m "$(cat <<'EOF'
feat(performance-os): report reads snapshot count and audits export

EOF
)"
```

---

### Task 30: PM-11 Performance Policy

**Files:**
- Modify: `services/ops-web/src/app/crm/kpi-hub/performance/settings/page.tsx`

Khớp `#settings`:

- Title `Performance Policy`
- Card Scoring: Score cap, Weight Active, Lower-is-better Red, **Effective**
- Card Ritual & close: Reminder, Escalation, Stale, Close
- Aside Impact: Scorecard Active, Assignment, Snapshot 08 **Không đụng**
- Save `PATCH` kèm `effective_at`

- [ ] **Commit**

```bash
git add services/ops-web/src/app/crm/kpi-hub/performance/settings/page.tsx
git commit -m "$(cat <<'EOF'
feat(performance-os): policy save with effective date and impact

EOF
)"
```

---

## Wave D — E2E + deploy (Task 31–32)

### Task 31: Playwright E2E (DoD)

**Files:**
- Create: `services/ops-web/e2e/performance-os-hub.spec.ts`

```ts
import { test, expect } from '@playwright/test';
import { apiReachable, loginAsStaff } from './helpers/ai-copilot-helpers';

const PERF_LABELS = [
  'Operating Dashboard',
  'Assignment Registry',
  'Tạo Assignment',
  'Scorecard Builder',
  'Thêm chỉ tiêu',
  'Check-in Ritual',
  'Marketing OS',
  'Campaign Control',
  'CRM Source Map',
  'Snapshot Report',
  'Policy',
];

test.describe('Performance OS Hub', () => {
  test.beforeEach(async ({ page, request }) => {
    test.skip(!(await apiReachable(request)), 'Nest API not reachable');
    await loginAsStaff(page);
  });

  test('sidebar HIỆU SUẤT and operating dashboard moat', async ({ page }) => {
    await page.goto('/crm/kpi-hub/performance');
    await expect(page.getByRole('heading', { level: 1, name: 'Operating Dashboard' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.locator('.kpi-hub-sidebar').getByText('HIỆU SUẤT', { exact: true })).toBeVisible();
    for (const label of PERF_LABELS) {
      await expect(page.locator('.kpi-hub-sidebar').getByText(label, { exact: true })).toBeVisible();
    }
    await expect(page.getByText('DATA BLOCKED')).toBeVisible();
    await expect(page.getByText('SỔ QUOTED')).toBeVisible();
  });

  test('check-in ritual locks verified P1 actual', async ({ page }) => {
    await page.goto('/crm/kpi-hub/performance/check-ins?assignment=asg-p1');
    await expect(page.getByRole('heading', { level: 1, name: /Check-in Ritual/ })).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole('button', { name: /Check-in/ }).click();
    const actual = page.locator('input').first();
    await expect(actual).toBeDisabled();
  });

  test('marketing hides ROAS without attribution', async ({ page }) => {
    await page.goto('/crm/kpi-hub/performance/marketing');
    await expect(page.getByRole('heading', { level: 1, name: 'Marketing OS' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText('N/A', { exact: true })).toBeVisible();
    await expect(page.getByText('Thiếu attribution model')).toBeVisible();
  });
});
```

Run: `cd services/ops-web && npx playwright test e2e/performance-os-hub.spec.ts`

Expected: 3 tests PASS khi API + login staff chạy được. Nếu modal selector khác, sửa locator theo DOM thật — không xóa assertion Actual disabled / ROAS N/A.

- [ ] **Commit**

```bash
git add services/ops-web/e2e/performance-os-hub.spec.ts
git commit -m "$(cat <<'EOF'
test(performance-os): add kpi hub e2e for dashboard ritual and roas

EOF
)"
```

---

### Task 32: Deploy hook + verification

**Files:**
- Modify: `scripts/deploy_service_kpi_vps.sh` — ngay sau `apply_pg_ddl_service_kpi.sh` thêm:

```bash
bash "$ROOT/scripts/apply_pg_ddl_performance_os.sh"
```

- [ ] **Step 1:** Confirm script vẫn `set -euo pipefail`; DDL IF NOT EXISTS → no-op an toàn.

- [ ] **Step 2: Chạy verification local**

```bash
cd services/ptt-crm-api && npx jest src/kpi-hub/performance --no-coverage
cd services/ops-web && npx vitest run src/lib/kpi-hub-nav.spec.ts src/components/kpi-hub/performance/PmQualityChip.spec.tsx
cd services/ops-web && npx playwright test e2e/performance-os-hub.spec.ts
```

Expected: Jest domain+service PASS; nav 11 nhãn mockup; e2e dashboard + ritual + ROAS.

- [ ] **Step 3: Commit**

```bash
git add scripts/deploy_service_kpi_vps.sh
git commit -m "$(cat <<'EOF'
chore(performance-os): apply performance ddl on vps deploy

EOF
)"
```

---

## Thứ tự chạy

```text
1–11  domain thuần (mỗi task 1 module + spec)
12–13 DDL + repository memory
14–16 service v3 + hydrate + controller
17–19 types/client + primitives + nav copy
20–30 11 màn mockup (một commit / màn)
31    Playwright
32    deploy hook + verify
```

Không gộp 11 màn một commit. Không skip test “để làm sau”.

---

## Spec coverage (tự rà sau khi viết)

| SRS / AC / UI | Task |
|---|---|
| §2.1 3 sổ, AC-PM-07 quoted vs assigned CO | 1, 14, 20, 21 |
| Registry Quoted Δ vs actual (mockup) | 1 (`quoted_vs_actual_pct`), 21 |
| §2.2 scoring AC-PM-02 | giữ `performance-score` + 21 notice |
| §2.3 ritual, AC-PM-03/08, review, correction | 9, 14, 16, 25 |
| §2.4 inherit template banner | 23 (API inherit Dictionary = Phase 2b, ngoài plan) |
| §2.5 cascade AC-PM-04 | 2, 14, 28 |
| §2.6 snapshot AC-PM-06, reopen, hash | 4, 14, 16, 29 |
| AC-PM-01 weight 105% | đã có service + 24 |
| AC-PM-05 client fields + §5 Finance/HR | 5, 14 export, 29 |
| AC-PM-09 ROAS N/A | 11, 14, 26, 31 |
| AC-PM-10 AI evidence | 6 |
| PM-01 tiles + rhythm + queue overdue | 8, 20 |
| PM-03 readiness + target band | 3, 22 |
| PM-04 duplicate key | 7, 14 `createAssignment` |
| PM-08 media≠fee, Booking — | 11, 14, 27 |
| PM-09 rule versioned, no PII | 28 |
| PM-11 effective_at + impact | 14, 30 |
| §8 forecast disclaimer | 6 (API assert; UI disclaimer field trên check-in client-facing) |
| §9 in-app notify | 10 (persist send = ngoài plan; payload sẵn) |
| §10 API + idempotency + row_version | 4, 13, 16 |
| DoD empty/denied/error | 18 `PmPageState` + 20–30 |
| Nav copy mockup | 19, 31 |
| Persist + deploy | 12, 13, 32 |
| E2E | 31 |

**Ngoài plan (không lách vào task):** Objective entity riêng, email SMTP, fetch Dictionary Active, simulated Min/Target/Stretch score, forecast engine, AI sinh text, calibration HR/payroll, warehouse, cap RBAC `crm_performance.*` riêng (dùng `crm_kpi_dictionary.manage` cho ghi).

---

## Kiểm tra trước khi coi xong

```bash
cd services/ptt-crm-api && npx jest src/kpi-hub/performance --no-coverage
cd services/ops-web && npx vitest run src/lib/kpi-hub-nav.spec.ts
cd services/ops-web && npx playwright test e2e/performance-os-hub.spec.ts
```

Expected: mọi AC-PM-01…10 có unit hoặc e2e; 11 heading mockup; DATA BLOCKED + SỔ QUOTED + ROAS N/A + Actual locked hiện trên UI.
