# CEO Lifecycle Tower Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Isolated worktree: use superpowers:using-git-worktrees at execution time.

**Goal:** Panel tháp 6 cột + hàng chờ sót trên `/crm/ceo` (trên ChatBox), API `GET /api/crm/ceo/tower`, cảm biến S1–S12, zoom 5 lớp org, strip tiền, capacity, 2 lệnh C mới, board pack — CEO quan sát ngoại lệ, không inventory.

**Architecture:** Pure utils (cột + SLA + seed + drill) trước. Nest `CeoTowerSensorService` đọc milestone / lead / contract / ops / CSKH, ghép `TowerPayload`. Cache 60s per `(staffId, factory, department, team, position_code, staff_id)`. FE `CeoLifecycleTower` trên cùng `/crm/ceo`. Briefing Hôm nay gọi lại cùng sensor. Commit vẫn `POST /api/crm/ceo/actions/commit`. Không POST mutate trên `/tower`.

**Tech Stack:** NestJS `ptt-crm-api` (Jest), PostgreSQL (`crm_lifecycle_milestones`, leads, contracts, ops alerts, CSKH board), ops-web Next.js (Vitest + Playwright). Reuse Owner Weekly `loadLifecycleKpis` + `lifecycle-kpi.util`. Không LoRA / tool-call tự do.

**Spec:** [`docs/superpowers/specs/2026-09-01-ceo-lifecycle-tower-design.md`](../specs/2026-09-01-ceo-lifecycle-tower-design.md) v1.3 (CEO-TOWER-20260901).

## Global Constraints

- Một entity = đúng một `column_id`. Factory A và B **không trộn hàng**.
- Hàng chờ mặc định **ẩn xanh**; sort đỏ → tuổi giảm → `value_vnd` giảm.
- CEO **không** Apply TMMT / tick BANT / gửi khách / approve HĐ / pause ads / spawn week / complete Intake từ tháp.
- Catalog C: 6 action đã ship + **đúng 2** action §20. Confirm 2 bước. Idempotency 24h.
- Nguồn fail / thiếu cap → cột hoặc strip `degraded`, **không** 500 cả trang, **không** bịa `0 ₫`.
- Seed UAT `mkt-ai-smoke-seed` / `mkt-ai-seed-*` / `sqlite_lead_id >= 900000901` **cấm** vào tháp.
- K1–K4 **reuse** Owner Weekly (cùng query / `lifecycle-kpi.util`). Không KPI thứ hai.
- Cửa sổ exception **7 ngày** + mọi hàng đang red/amber dù cũ hơn.
- Timeout từng nguồn **2.5s**. Cache **60s**.
- `PTT_CEO_TOWER_LEGAL_ENTITY` default `0`. `PTT_CEO_BOARD_PACK_NOTIFY` default `0`.
- `PTT_CEO_COMMAND_LLM` giữ `0` trên VPS. Không LoRA.
- Slice: **T0 → T2** (ống + sót + C cũ) rồi T3–T8. Stop sau T2 nếu PO chỉ muốn tháp sót. T8 chỉ khi >1 MST.
- Branch: `feat/ceo-lifecycle-tower` from `main`.
- Copy UI tiếng Việt. Không `next build` ad-hoc trên VPS trong plan này.
- Không phá ChatBox: panel tháp **trên**, thread **dưới**. `/crm/ceo/learn` không đổi.

## File map

| File | Role | Slice |
|------|------|-------|
| Create `services/ptt-crm-api/src/ceo-command/ceo-tower.types.ts` | Types cột / exception / payload | T0 |
| Create `services/ptt-crm-api/src/ceo-command/ceo-tower-column.util.ts` | `assignTowerColumn`, `isTowerUatSeed` | T0 |
| Create `services/ptt-crm-api/src/ceo-command/ceo-tower-column.util.spec.ts` | Jest cột + seed | T0 |
| Create `services/ptt-crm-api/src/ceo-command/ceo-tower-sla.util.ts` | Amber/red từ đồng hồ §5.1 | T0 |
| Create `services/ptt-crm-api/src/ceo-command/ceo-tower-sla.util.spec.ts` | Jest SLA | T0 |
| Create `services/ptt-crm-api/src/ceo-command/ceo-tower-drill.util.ts` | `towerDrillHref` + cấm A/B | T0 |
| Create `services/ptt-crm-api/src/ceo-command/ceo-tower-drill.util.spec.ts` | Jest href | T0 |
| Create `services/ptt-crm-api/src/ceo-command/ceo-tower-sensor.service.ts` | S1–S12 + assemble payload | T0–T1 |
| Create `services/ptt-crm-api/src/ceo-command/ceo-tower-sensor.service.spec.ts` | Jest sensors fixture | T0 |
| Modify `ceo-command.controller.ts` | `GET tower`, `GET tower/board-pack` | T1/T7 |
| Modify `ceo-command.module.ts` | Provide sensor + OwnerWeekly | T1 |
| Modify `ceo-command-caps.util.ts` | `crm_owner_weekly_dashboard.view` vào view | T1 |
| Create `services/ops-web/src/lib/crm/ceo-tower-api.ts` | Client GET tower | T1 |
| Create `services/ops-web/src/components/crm/ceo/CeoLifecycleTower.tsx` | 6 cột + queue | T1 |
| Modify `services/ops-web/src/app/crm/ceo/page.tsx` | Panel trên ChatBox | T1 |
| Modify `ceo-command-action.catalog.ts` | 2 action §20 | T6 |
| Modify `ceo-command-actions.service.ts` | execute 2 C | T6 |
| Modify `ceo-command-briefing.service.ts` | Hôm nay ⊆ exception red | T3 |
| Create `services/ops-web/src/app/crm/ceo/board-pack/page.tsx` | Print A4 | T7 |
| Create `services/ops-web/e2e/ceo-lifecycle-tower.spec.ts` | Playwright | T1/T7 |
| Modify `docs/huong-dan-su-dung/28-ceo-command-chatbox.md` | Tháp | T1 |

## Out of scope (reject nếu task thêm)

- Kanban kéo thả, Approve HĐ từ tháp, Apply TMMT, auto-email/Zalo khách, gộp HR/lương, cron ping CEO mỗi phút, LoRA, P&L theo DV, migration `legal_entity_id` bắt buộc, rewrite ChatBox.

---

### Task 1: Pure `assignTowerColumn` + seed exclude (T0)

**Files:**
- Create: `services/ptt-crm-api/src/ceo-command/ceo-tower.types.ts`
- Create: `services/ptt-crm-api/src/ceo-command/ceo-tower-column.util.ts`
- Create: `services/ptt-crm-api/src/ceo-command/ceo-tower-column.util.spec.ts`

**Interfaces:**
- Consumes: `TowerEntityInput` (milestones + factory + won/lifecycle flags)
- Produces: `TowerColumnId`; `isTowerUatSeed(leadId, tags)`

- [ ] **Step 1: Write the failing test**

```ts
import { assignTowerColumn, isTowerUatSeed } from './ceo-tower-column.util';
import type { TowerEntityInput } from './ceo-tower.types';

const baseA = (): TowerEntityInput => ({
  factory: 'A',
  leadId: 10,
  lifecycleId: null,
  b2Done: false,
  intakeGo: false,
  contractPendingOrActive: false,
  won: false,
  hasLifecycle: false,
  clientActive: false,
  retain: false,
  spaOnBoard: false,
  firstCallDone: false,
});

describe('assignTowerColumn', () => {
  it('A !b2_done → lead_b2', () => {
    expect(assignTowerColumn(baseA())).toBe('lead_b2');
  });
  it('A b2_done && !intake_go → intake', () => {
    expect(assignTowerColumn({ ...baseA(), b2Done: true })).toBe('intake');
  });
  it('A intake_go && !contract → consult', () => {
    expect(assignTowerColumn({ ...baseA(), b2Done: true, intakeGo: true })).toBe('consult');
  });
  it('A contract pending → contract', () => {
    expect(assignTowerColumn({
      ...baseA(), b2Done: true, intakeGo: true, contractPendingOrActive: true,
    })).toBe('contract');
  });
  it('A won without lifecycle → contract (S4, not dropped)', () => {
    expect(assignTowerColumn({
      ...baseA(), b2Done: true, intakeGo: true, won: true, hasLifecycle: false,
    })).toBe('contract');
  });
  it('A post-won lifecycle !client_active → tmmt_deliver', () => {
    expect(assignTowerColumn({
      ...baseA(), won: true, hasLifecycle: true, lifecycleId: 99, clientActive: false,
    })).toBe('tmmt_deliver');
  });
  it('A client_active → care', () => {
    expect(assignTowerColumn({
      ...baseA(), won: true, hasLifecycle: true, lifecycleId: 99, clientActive: true,
    })).toBe('care');
  });
  it('B on board → care', () => {
    expect(assignTowerColumn({
      ...baseA(), factory: 'B', spaOnBoard: true, firstCallDone: true,
    })).toBe('care');
  });
  it('B no first call when filter B → lead_b2', () => {
    expect(assignTowerColumn({
      ...baseA(), factory: 'B', spaOnBoard: true, firstCallDone: false,
    }, { factoryFilter: 'B' })).toBe('lead_b2');
  });
});

describe('isTowerUatSeed', () => {
  it('excludes sqlite_lead_id >= 900000901', () => {
    expect(isTowerUatSeed(900000901, [])).toBe(true);
  });
  it('excludes mkt-ai-smoke-seed tag', () => {
    expect(isTowerUatSeed(12, ['mkt-ai-smoke-seed'])).toBe(true);
  });
  it('keeps real lead', () => {
    expect(isTowerUatSeed(12, [])).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/ptt-crm-api && npx jest src/ceo-command/ceo-tower-column.util.spec.ts --no-coverage`

Expected: FAIL cannot find module.

- [ ] **Step 3: Write minimal implementation**

```ts
// ceo-tower.types.ts
export type TowerFactory = 'A' | 'B';
export type TowerColumnId =
  | 'lead_b2' | 'intake' | 'consult' | 'contract' | 'tmmt_deliver' | 'care';
export type TowerSeverity = 'red' | 'amber' | 'ok';
export type TowerSensorId =
  | 'S1' | 'S2' | 'S3' | 'S4' | 'S5' | 'S6' | 'S7' | 'S8' | 'S9' | 'S10' | 'S11' | 'S12';

export type TowerEntityInput = {
  factory: TowerFactory;
  leadId: number;
  lifecycleId: number | null;
  b2Done: boolean;
  intakeGo: boolean;
  contractPendingOrActive: boolean;
  won: boolean;
  hasLifecycle: boolean;
  clientActive: boolean;
  retain: boolean;
  spaOnBoard: boolean;
  firstCallDone: boolean;
};

export type TowerColumnOpts = { factoryFilter?: 'A' | 'B' | 'both' };
```

```ts
// ceo-tower-column.util.ts
import type { TowerColumnId, TowerColumnOpts, TowerEntityInput } from './ceo-tower.types';

export function isTowerUatSeed(leadId: number | null | undefined, tags: string[] = []): boolean {
  const id = Number(leadId ?? 0);
  if (id >= 900000901) return true;
  return tags.some((t) => /mkt-ai-(smoke-seed|seed-)/i.test(String(t)));
}

export function assignTowerColumn(
  e: TowerEntityInput,
  opts: TowerColumnOpts = {},
): TowerColumnId {
  if (e.factory === 'B') {
    if (opts.factoryFilter === 'B' && e.spaOnBoard && !e.firstCallDone) return 'lead_b2';
    return 'care';
  }
  if (e.hasLifecycle || (e.won && e.hasLifecycle)) {
    if (e.clientActive || e.retain) return 'care';
    if (e.hasLifecycle) return 'tmmt_deliver';
  }
  if (e.won && !e.hasLifecycle) return 'contract';
  if (e.contractPendingOrActive) return 'contract';
  if (e.intakeGo) return 'consult';
  if (e.b2Done) return 'intake';
  return 'lead_b2';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: same jest. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/ptt-crm-api/src/ceo-command/ceo-tower.types.ts \
  services/ptt-crm-api/src/ceo-command/ceo-tower-column.util.ts \
  services/ptt-crm-api/src/ceo-command/ceo-tower-column.util.spec.ts
git commit -m "feat(ceo-tower): assignTowerColumn + UAT seed exclude"
```

---

### Task 2: Pure SLA clocks (T0)

**Files:**
- Create: `services/ptt-crm-api/src/ceo-command/ceo-tower-sla.util.ts`
- Create: `services/ptt-crm-api/src/ceo-command/ceo-tower-sla.util.spec.ts`

**Interfaces:**
- Consumes: `column_id`, factory, `clockStartMs`, `nowMs`, extra flags (`noOwner`, `wonNoLifecycle`, …)
- Produces: `TowerSeverity`

- [ ] **Step 1: Failing test**

```ts
import { clockSeverity } from './ceo-tower-sla.util';

const hour = 3600_000;
const day = 24 * hour;

describe('clockSeverity', () => {
  it('lead_b2 A no owner 2h → amber, 4h → red', () => {
    expect(clockSeverity({
      columnId: 'lead_b2', factory: 'A', elapsedMs: 2 * hour, noOwner: true,
    })).toBe('amber');
    expect(clockSeverity({
      columnId: 'lead_b2', factory: 'A', elapsedMs: 4 * hour, noOwner: true,
    })).toBe('red');
  });
  it('lead_b2 A no B2 4h amber, 8h red', () => {
    expect(clockSeverity({
      columnId: 'lead_b2', factory: 'A', elapsedMs: 4 * hour, noB2: true,
    })).toBe('amber');
    expect(clockSeverity({
      columnId: 'lead_b2', factory: 'A', elapsedMs: 8 * hour, noB2: true,
    })).toBe('red');
  });
  it('intake 3d amber, 5d red', () => {
    expect(clockSeverity({ columnId: 'intake', factory: 'A', elapsedMs: 3 * day })).toBe('amber');
    expect(clockSeverity({ columnId: 'intake', factory: 'A', elapsedMs: 5 * day })).toBe('red');
  });
  it('consult 5d amber, 10d red', () => {
    expect(clockSeverity({ columnId: 'consult', factory: 'A', elapsedMs: 5 * day })).toBe('amber');
    expect(clockSeverity({ columnId: 'consult', factory: 'A', elapsedMs: 10 * day })).toBe('red');
  });
  it('contract pending 24h amber, 48h red', () => {
    expect(clockSeverity({ columnId: 'contract', factory: 'A', elapsedMs: 24 * hour })).toBe('amber');
    expect(clockSeverity({ columnId: 'contract', factory: 'A', elapsedMs: 48 * hour })).toBe('red');
  });
  it('won no lifecycle 24h → red', () => {
    expect(clockSeverity({
      columnId: 'contract', factory: 'A', elapsedMs: 24 * hour, wonNoLifecycle: true,
    })).toBe('red');
  });
  it('tmmt 5d amber, 7d red', () => {
    expect(clockSeverity({ columnId: 'tmmt_deliver', factory: 'A', elapsedMs: 5 * day })).toBe('amber');
    expect(clockSeverity({ columnId: 'tmmt_deliver', factory: 'A', elapsedMs: 7 * day })).toBe('red');
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `cd services/ptt-crm-api && npx jest src/ceo-command/ceo-tower-sla.util.spec.ts --no-coverage`

- [ ] **Step 3: Minimal impl**

```ts
import type { TowerColumnId, TowerFactory, TowerSeverity } from './ceo-tower.types';

export type ClockInput = {
  columnId: TowerColumnId;
  factory: TowerFactory;
  elapsedMs: number;
  noOwner?: boolean;
  noB2?: boolean;
  wonNoLifecycle?: boolean;
  firstCallBreach?: boolean;
};

const H = 3600_000;
const D = 24 * H;

export function clockSeverity(input: ClockInput): TowerSeverity {
  const t = input.elapsedMs;
  if (input.columnId === 'lead_b2' && input.factory === 'A') {
    if (input.noOwner) {
      if (t >= 4 * H) return 'red';
      if (t >= 2 * H) return 'amber';
    }
    if (input.noB2) {
      if (t >= 8 * H) return 'red';
      if (t >= 4 * H) return 'amber';
    }
    return 'ok';
  }
  if (input.columnId === 'lead_b2' && input.factory === 'B') {
    return input.firstCallBreach ? 'red' : 'ok';
  }
  if (input.columnId === 'intake') {
    if (t >= 5 * D) return 'red';
    if (t >= 3 * D) return 'amber';
    return 'ok';
  }
  if (input.columnId === 'consult') {
    if (t >= 10 * D) return 'red';
    if (t >= 5 * D) return 'amber';
    return 'ok';
  }
  if (input.columnId === 'contract') {
    if (input.wonNoLifecycle && t >= 24 * H) return 'red';
    if (t >= 48 * H) return 'red';
    if (t >= 24 * H) return 'amber';
    return 'ok';
  }
  if (input.columnId === 'tmmt_deliver') {
    if (t >= 7 * D) return 'red';
    if (t >= 5 * D) return 'amber';
    return 'ok';
  }
  return 'ok';
}

export function worseSeverity(a: TowerSeverity, b: TowerSeverity): TowerSeverity {
  const rank = { red: 2, amber: 1, ok: 0 };
  return rank[a] >= rank[b] ? a : b;
}
```

- [ ] **Step 4: Jest PASS**
- [ ] **Step 5: Commit** `feat(ceo-tower): SLA amber/red clocks per column`

---

### Task 3: Drill href + factory ban (T0)

**Files:**
- Create: `services/ptt-crm-api/src/ceo-command/ceo-tower-drill.util.ts`
- Create: `services/ptt-crm-api/src/ceo-command/ceo-tower-drill.util.spec.ts`

**Interfaces:**
- Produces: `towerDrillHref(column, sensor, factory, ids)`

- [ ] **Step 1: Failing test**

```ts
import { towerDrillHref } from './ceo-tower-drill.util';

describe('towerDrillHref', () => {
  it('A lead → /crm/leads/:id', () => {
    expect(towerDrillHref({
      factory: 'A', columnId: 'lead_b2', sensorIds: ['S1'], leadId: 7,
    })).toBe('/crm/leads/7');
  });
  it('A contract → hub or lead#lead-contract', () => {
    expect(towerDrillHref({
      factory: 'A', columnId: 'contract', sensorIds: ['S4'], leadId: 7,
    })).toMatch(/\/crm\/(hub|leads\/7)/);
  });
  it('A S5 → service-delivery + tab=ai-planner', () => {
    expect(towerDrillHref({
      factory: 'A', columnId: 'tmmt_deliver', sensorIds: ['S5'], lifecycleId: 3,
    })).toBe('/crm/service-delivery/3?tab=ai-planner');
  });
  it('A never href cskh-board', () => {
    const href = towerDrillHref({
      factory: 'A', columnId: 'care', sensorIds: ['S10'], lifecycleId: 3,
    });
    expect(href).not.toContain('/crm/cskh-board');
  });
  it('B never href ai-planner', () => {
    const href = towerDrillHref({
      factory: 'B', columnId: 'care', sensorIds: ['S9'], leadId: 8,
    });
    expect(href).not.toContain('ai-planner');
    expect(href).toContain('/crm/cskh-board');
  });
});
```

- [ ] **Step 2–4: Impl**

```ts
export function towerDrillHref(args: {
  factory: 'A' | 'B';
  columnId: string;
  sensorIds: string[];
  leadId?: number;
  lifecycleId?: number;
  clientUuid?: string;
}): string {
  if (args.factory === 'B') {
    const lead = args.leadId != null ? `?lead_id=${args.leadId}` : '?sla=first_call_15m';
    return `/crm/cskh-board${lead}`;
  }
  if (args.sensorIds.includes('S5') && args.lifecycleId) {
    return `/crm/service-delivery/${args.lifecycleId}?tab=ai-planner`;
  }
  if (args.sensorIds.includes('S6') && args.lifecycleId) {
    return `/crm/service-delivery/${args.lifecycleId}?tab=launch-qa`;
  }
  if ((args.sensorIds.includes('S7') || args.sensorIds.includes('S10')) && args.lifecycleId) {
    return `/crm/service-delivery/${args.lifecycleId}?tab=ops-hub`;
  }
  if (args.sensorIds.includes('S8') && args.clientUuid) {
    return `/agency/clients/${args.clientUuid}`;
  }
  if (args.columnId === 'contract') {
    return args.leadId ? `/crm/leads/${args.leadId}#lead-contract` : '/crm/hub';
  }
  if (args.lifecycleId && (args.columnId === 'tmmt_deliver' || args.columnId === 'care')) {
    return `/crm/service-delivery/${args.lifecycleId}`;
  }
  if (args.leadId) return `/crm/leads/${args.leadId}`;
  return '/crm/leads';
}
```

- [ ] **Step 5: Commit** `feat(ceo-tower): drill href with factory A/B bans`

---

### Task 4: Sensor classify on fixtures S1–S10 (T0)

**Files:**
- Create: `services/ptt-crm-api/src/ceo-command/ceo-tower-sensors.util.ts`
- Create: `services/ptt-crm-api/src/ceo-command/ceo-tower-sensors.util.spec.ts`

**Interfaces:**
- Consumes: `TowerSensorRow` (entity + clocks + quality flags)
- Produces: `{ column_id, severity, sensor_ids, suggest_action }`

```ts
export type TowerSensorRow = TowerEntityInput & {
  ownerId: number | null;
  createdAtMs: number;
  b2DoneAtMs: number | null;
  intakeGoAtMs: number | null;
  contractSubmittedAtMs: number | null;
  promoteAtMs: number | null;
  nowMs: number;
  tmmtGatePass: boolean;
  qualityScore: number | null;
  launchQaFail: boolean;
  stageDeliver: boolean;
  opsOverdue: boolean;
  opsDueToday: boolean;
  cplWorse40: boolean;
  contractEndInDays: number | null;
  kpiRetainRed: boolean;
  spaFirstCallBreach: boolean;
  spaB2Breach: boolean;
  spaCloseBreach: boolean;
  hasConsultHandoff: boolean;
  valueVnd: number | null;
};

export function classifyTowerRow(row: TowerSensorRow, opts?: TowerColumnOpts): {
  column_id: TowerColumnId;
  severity: TowerSeverity;
  sensor_ids: TowerSensorId[];
  suggest_action: string | null;
}
```

- [ ] **Step 1: Tests — 10 cảm biến + invariant mọi fixture có cột**

```ts
it('S1: A no owner ≥4h → red lead_b2 assign_lead', () => { /* ... */ });
it('S2: A no B2 ≥8h → red remind_staff', () => { /* ... */ });
it('S3: intake_go no handoff ≥24h → consult prioritize_solution_queue', () => { /* ... */ });
it('S4: contract pending ≥48h → remind_contract_approval', () => { /* ... */ });
it('S5: promote ≥7d no TMMT gate → remind_staff', () => { /* ... */ });
it('S6: deliver + QA fail → red', () => { /* ... */ });
it('S7: ops overdue → red ack_ops_alert if alert_id', () => { /* ... */ });
it('S8: promote ≥14d !client_active → red', () => { /* ... */ });
it('S9: B first_call breach → sla_remind_lead', () => { /* ... */ });
it('S10: contract end ≤30d → remind_staff', () => { /* ... */ });
it('every fixture has a column (no null)', () => {
  for (const row of FIXTURES) {
    expect(assignTowerColumn(row)).toBeTruthy();
  }
});
```

`suggest_action` map đúng bảng spec §6. S3/S4 dùng id §20 dù execute chưa có (string id).

- [ ] **Step 2–4: Impl gọi `assignTowerColumn` + `clockSeverity` + quality gates §5.2**
- [ ] **Step 5: Commit** `feat(ceo-tower): classify S1–S10 on fixtures`

**T0 done khi:** 10 test cảm biến + 0 fixture “no column”.

---

### Task 5: `GET /api/crm/ceo/tower` assemble (T1)

**Files:**
- Create: `services/ptt-crm-api/src/ceo-command/ceo-tower-sensor.service.ts`
- Create: `services/ptt-crm-api/src/ceo-command/ceo-tower.repository.ts` (SQL load leads/milestones/contracts — Pool như `OwnerWeeklyPgRepository`)
- Modify: `ceo-command.controller.ts` — `GET tower`
- Modify: `ceo-command.module.ts` — provide + import `OwnerWeeklyModule` (hoặc inject repo hiện có)
- Create: `ceo-tower.controller.spec.ts` (mock service)

**Interfaces:**
- Consumes: query `factory`, `column_id`, `department`, `team`, `position_code`, `staff_id`, `severity`, `limit`, `cursor`
- Produces: `TowerPayload` (spec §10)

```ts
export type TowerException = {
  factory: TowerFactory;
  column_id: TowerColumnId;
  sensor_ids: TowerSensorId[];
  severity: 'red' | 'amber';
  title_vi: string;
  entity_type: 'lead' | 'lifecycle';
  entity_id: number;
  owner_name: string;
  age_label: string;
  value_vnd: number | null;
  department_code: string | null;
  team_code: string | null;
  position_code: string | null;
  job_function: string | null;
  href: string;
  suggest_action: string | null;
  suggest_params: Record<string, unknown> | null;
};

export type TowerPayload = {
  ok: true;
  generated_at: string;
  window_exception_days: 7;
  k_strip: Array<{
    key: 'k1' | 'k2' | 'k3' | 'k4';
    value: number | null;
    status: 'green' | 'amber' | 'red' | 'neutral';
    href: '/crm/owner-weekly';
  }>;
  columns: Array<{
    column_id: TowerColumnId;
    red_count: number;
    amber_count: number;
    ok_count: number;
    header_severity: TowerSeverity;
    degraded?: { reason: string };
  }>;
  exceptions: TowerException[];
  org_rollup: Array<{
    level: 'company' | 'factory' | 'department' | 'team' | 'position' | 'staff';
    code: string;
    label_vi: string;
    red_count: number;
    amber_count: number;
    outside_cycle?: boolean;
  }>;
  next_cursor: string | null;
  degraded: Array<{ source: string; reason: string }>;
  sensors_ok: Record<TowerSensorId, 'ok' | 'fail' | 'degraded'>;
  finance_strip?: unknown;
  capacity_top?: unknown;
  legal_entity_id?: string | null;
};
```

- [ ] **Step 1:** Controller test: `severity=ok` without `ceo_command.configure` → 403.
- [ ] **Step 2:** `CeoTowerSensorService.buildPayload(actor, query)`:
  - Load candidates (90 ngày activity **hoặc** đang red/amber).
  - Drop `isTowerUatSeed`.
  - Factory A = `b2b_prospect` (`resolveLeadFlowKind`); B = `spa_operational`.
  - Post-won A: **một hàng lifecycle** (không nhân lead+LC).
  - `withTimeout(source, 2500)` — catch → `degraded`.
  - Sort exceptions: red → age desc → value desc.
  - `limit` default 40, max 80; cursor opaque (`entity_type:id`).
  - Cache Map key `staffId|factory|dept|team|pos|staff` TTL 60s.
  - T1: `org_rollup` = `[{ level:'company', code:'PTT', ... }]` tối thiểu; 6 DEPT đủ ở Task 10.
  - T1: `finance_strip` / `capacity_top` omit.
- [ ] **Step 3:** K-strip: gọi `OwnerWeeklyPgRepository` (cùng `computeK1`…`K4`). Thiếu cap `crm_owner_weekly_dashboard.view` → ẩn 4 ô + `degraded` source `k_strip`.
- [ ] **Step 4:** Jest: thiếu ops cap → S7 `degraded`, S1 vẫn `ok`/`fail`.
- [ ] **Step 5: Commit** `feat(ceo-tower): GET /api/crm/ceo/tower`

---

### Task 6: Caps — Owner Weekly vào view + per-column degraded (T1)

**Files:**
- Modify: `ceo-command-caps.util.ts` + `.spec.ts`
- Modify: `services/ops-web/src/lib/crm/ceo-command-thread.util.ts` + `.spec.ts`

```ts
export function hasCeoView(caps: StaffCap[]): boolean {
  return (
    hasCap(caps, 'ceo_command', 'view') ||
    hasCap(caps, 'ai_analytics', 'query') ||
    hasCap(caps, 'crm_business_dashboard', 'view') ||
    hasCap(caps, 'ai_admin', 'view') ||
    hasCap(caps, 'crm_owner_weekly_dashboard', 'view')
  );
}
```

Per-source (spec §9.2) trong `buildPayload`:

| Thiếu | Hành vi |
|-------|---------|
| `crm_leads.view` | Cột `lead_b2`/`intake`/`consult` `degraded` |
| contract/hub | Cột `contract` degraded |
| `crm_board.view` | `tmmt_deliver` degraded |
| ops view | S7 degraded |
| CSKH view | `care` B + K4 degraded |

Không 403 cả tháp. Reuse visibility lead list hiện tại — **cấm** `staffId<=0` bypass.

- [ ] Tests: `hasCeoView` true với chỉ Owner Weekly cap.
- [ ] **Commit** `feat(ceo-tower): Owner Weekly cap can view tower`

---

### Task 7: FE panel 6 cột + hàng chờ trên `/crm/ceo` (T1)

**Files:**
- Create: `services/ops-web/src/lib/crm/ceo-tower-api.ts`
- Create: `services/ops-web/src/components/crm/ceo/CeoLifecycleTower.tsx`
- Create: `services/ops-web/src/lib/crm/ceo-tower-ui.util.ts` + `.spec.ts` (sort copy, empty state)
- Modify: `services/ops-web/src/app/crm/ceo/page.tsx` — tower **trên** `CeoCommandPanel`
- Create: `services/ops-web/e2e/ceo-lifecycle-tower.spec.ts`

**UI (spec §11):**

```
[ A | B | Cả hai ]  N sót · M đỏ
[ K1 ][ K2 ][ K3 ][ K4 ]
[ Lead/B2 ][ Intake ][ Tư vấn ][ HĐ ][ TMMT/QA ][ CSKH ]
[ Hàng chờ sót ]
[ ChatBox ]
```

- Toggle `factory` sync `?factory=` URL.
- Click cột header = filter `column_id` + `severity=red,amber` (không điều hướng).
- Hàng: badge A/B, title, tuổi, owner, **Mở** (`href`), **Gợi ý** (nút, chưa commit — Task 8).
- `degraded` chip xám. Empty: `Không sót trong cửa sổ — kiểm tra degraded`.
- Factory `B`: cột Intake/Tư vấn/HĐ/TMMT nhãn `Không dùng Factory B`.
- Mobile: K + list; 6 cột scroll ngang.
- Copy tiếng Việt. Không dump JSON thô.

Client:

```ts
export async function fetchCeoTower(token: string, q: Record<string, string>): Promise<TowerPayload> {
  const qs = new URLSearchParams(q).toString();
  const res = await fetch(`/api/crm/ceo/tower?${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`tower_${res.status}`);
  return res.json();
}
```

E2e: login staff view → `/crm/ceo` thấy 6 cột; click HĐ → Hub/lead-contract; không gọi commit khi chỉ xem.

- [ ] Vitest: empty-state copy; factory B hides unused columns.
- [ ] **Commit** `feat(ceo-tower): panel 6 columns + exception queue on /crm/ceo`

**T1 done khi:** CEO view đếm khớp fixture; drill 6 href.

---

### Task 8: Chip Gợi ý → confirm C hiện có (T2)

**Files:**
- Modify: `CeoLifecycleTower.tsx` + `CeoCommandPanel.tsx` (hoặc shared `proposeCeoAction` helper)
- Modify: `services/ops-web/src/lib/api.ts` — reuse `postCeoTurn` + `commitCeoAction`

Luồng: click **Gợi ý** → `POST /api/crm/ceo/turns` `{ intent: 'propose_action', action_id, params }` → modal confirm hiện có (`confirmCopy`) → `POST actions/commit`.

Map T2 (chỉ action **đã ship**):

| suggest_action | params |
|----------------|--------|
| `assign_lead` | `{ lead_id }` — owner picker tối thiểu staff_id từ hàng hoặc prompt |
| `remind_staff` | `{ staff_id, title, body, link_href: href }` |
| `sla_remind_lead` | `{ lead_id, tier, suggested_action }` từ S9 |
| `ack_ops_alert` | `{ alert_id }` từ `suggest_params` |

Ẩn nút nếu `!can_act` (`ceo_command.act`). Không “Xác nhận tất cả”.

S3/S4 chips **disabled** đến Task 12 (tooltip: `Sắp có — nhắc duyệt HĐ / ưu tiên queue`).

- [ ] E2e: không commit khi chỉ xem.
- [ ] **Commit** `feat(ceo-tower): exception chips confirm existing C actions`

**T2 done khi:** Assign / remind / SLA / ack từ hàng chờ.

---

### Task 9: Briefing Hôm nay dùng chung sensor (T3)

**Files:**
- Modify: `ceo-command-briefing.service.ts`
- Modify: `ceo-command-briefing.util.ts` — thêm source `'tower'`
- Modify: `ceo-command-briefing.util.spec.ts`

`compose('briefing_today')` gọi `tower.buildPayload(actor, { factory: 'both', severity: 'red,amber', limit: 8 })`.

Mỗi exception **red** → 1 card:

```ts
{
  severity: 'red',
  title: ex.title_vi,
  href: ex.href,
  source: 'tower',
  suggest_action: ex.suggest_action ?? undefined,
}
```

Invariant test: mọi card `source==='tower'` có `href` thuộc union exception red của cùng payload. Không invent KPI mới. Giữ max 8 cards (red tower ưu tiên, rồi ops/pipeline như cũ).

- [ ] **Commit** `feat(ceo-tower): briefing today shares tower sensors`

---

### Task 10: `org_rollup` + breadcrumb 5 lớp (T4)

**Files:**
- Create: `services/ptt-crm-api/src/ceo-command/ceo-tower-org.util.ts` + `.spec.ts`
- Modify: `ceo-tower-sensor.service.ts`
- Modify: `CeoLifecycleTower.tsx` — breadcrumb + ô phòng

```ts
export const TOWER_DEPT_CATALOG = [
  { code: 'DEPT-SALES', label_vi: 'Kinh doanh', outside_cycle: false },
  { code: 'DEPT-SOLUTION', label_vi: 'Solution / MKT', outside_cycle: false },
  { code: 'DEPT-CSKH', label_vi: 'CSKH', outside_cycle: false },
  { code: 'DEPT-AGENCY', label_vi: 'Agency', outside_cycle: false },
  { code: 'DEPT-HR', label_vi: 'Nhân sự', outside_cycle: true },
  { code: 'DEPT-IT', label_vi: 'IT / Admin', outside_cycle: true },
] as const;
```

`buildOrgRollup(exceptions)`: level `department` **bắt buộc đủ 6 code**. HR/IT: `outside_cycle=true`, `red_count=0`. Click phòng → `?department=` + breadcrumb. Click team → `team=`. Click người → `staff_id=`. **×** về L1.

Empty HR/IT: `Không theo dõi trên tháp — mở /crm/staff hoặc /admin`.

Sensor → phòng A (spec §16.4) khi gán `department_code` trên exception nếu owner thiếu roster.

- [ ] Unit: mọi `DEPT-*` có `outside_cycle` hoặc ≥1 sensor.
- [ ] E2e: Sales → TEAM-SALES-AM → chỉ hàng AM (mock API).
- [ ] **Commit** `feat(ceo-tower): 5-layer org rollup and breadcrumb`

---

### Task 11: Strip tiền + S11 + S12 (T5)

**Files:**
- Create: `ceo-tower-finance.util.ts` + `.spec.ts`
- Modify: `ceo-tower-sensors.util.ts` — S11/S12
- Modify: `ceo-tower-sensor.service.ts` — `finance_strip`
- Modify: `CeoLifecycleTower.tsx` — hàng 5 ô dưới K

Ô: `Tiền | AR | DT30 | Top-1% | GM%`. Nguồn **copy** metric Owner Weekly (`cash_close`/`cash_safe`, `ar_overdue`, `revenue_received_30d` nếu có, `top_customer_share`/`top1_share_pct`, `gross_margin`). Target `top1_share_max_pct` default **40**.

Thiếu `crm_owner_weekly_dashboard.view` **hoặc** finance view → `finance_strip` absent + `degraded: finance`, **không** `0 ₫`.

S11: **một hàng công ty** `entity_type='lead' entity_id=0` (hoặc `entity_type` document `company` nếu thêm union — **giữ** `lead` + `entity_id=0` + `title_vi='Top-1 khách > 40% DT'`), `suggest_action=null`, href `/crm/owner-weekly`.

S12: `client_active || retain` && `ownerId==null` → `assign_lead` / `remind_staff`.

- [ ] Unit: S11 fail khi top1 > 40%; S12 fail retain không owner.
- [ ] API: thiếu finance cap → strip absent.
- [ ] **Commit** `feat(ceo-tower): finance strip + S11 S12`

---

### Task 12: Hai lệnh C mới (T6)

**Files:**
- Modify: `ceo-command-action.catalog.ts` + `.spec.ts`
- Modify: `ceo-command-actions.service.ts`
- Modify: `ceo-command-action.catalog.ts` `FORBIDDEN_PATTERNS` — thêm `/duyet hop dong|approve contract/i` → `/crm/hub`

Thêm vào `CEO_ACTION_IDS`:

```ts
'remind_contract_approval',
'prioritize_solution_queue',
```

`validateActionParams`:

```ts
case 'remind_contract_approval': {
  const lead_id = Number(params.lead_id);
  const contract_id = params.contract_id != null ? Number(params.contract_id) : undefined;
  if (!Number.isFinite(lead_id) || lead_id <= 0) throw new Error('missing_lead_id');
  return { lead_id, contract_id };
}
case 'prioritize_solution_queue': {
  const lead_id = Number(params.lead_id);
  const note = String(params.note ?? '').trim().slice(0, 200);
  if (!Number.isFinite(lead_id) || lead_id <= 0) throw new Error('missing_lead_id');
  return { lead_id, note };
}
```

`requiredCapsForAction`: cả hai → `[{ section: 'ceo_command', action: 'act' }]`.

`executeAction`:
- `remind_contract_approval`: `notifications.create` tới GDKD-01 (resolve position) hoặc `submitted_to_staff_id`; `link_href=/crm/hub?lead_id=`. **Không** UPDATE contract status. Test assert không gọi contract repo mutate.
- `prioritize_solution_queue`: notify MKT-01 + patch lead `meta_json.priority_consult='ceo'` (merge JSON, **không** ADD COLUMN). Không claim / đổi owner.

Preview VI: `Nhắc GDKD duyệt HĐ lead #… ?` / `Ưu tiên queue Solution lead #… ?`

Bật chip S3/S4 trên UI.

- [ ] Jest: remind không đổi status HĐ.
- [ ] **Commit** `feat(ceo-tower): remind contract + prioritize solution queue`

---

### Task 13: Capacity top 5 (T6)

**Files:**
- Create: `ceo-tower-capacity.util.ts` + `.spec.ts`
- Modify: `ceo-tower-sensor.service.ts`
- Modify: `CeoLifecycleTower.tsx`

```ts
export type CapacityRow = {
  staff_id: number;
  name: string;
  department_code: string | null;
  position_code: string | null;
  red_owned: number;
  amber_owned: number;
  flag: 'amber' | 'red';
};

export function buildCapacityTop(
  exceptions: TowerException[],
  roster: Array<{ staff_id: number; name: string; department_code: string | null; position_code: string | null }>,
): CapacityRow[] {
  // count by owner staff_id; amber if red>=5 or red+amber>=10; red if red>=8 or sum>=15
  // omit ok; sort red_owned desc; slice 5
}
```

Click hàng → `staff_id=` (L5). Không tính giờ công.

- [ ] **Commit** `feat(ceo-tower): capacity top 5 overloaded owners`

---

### Task 14: Board pack 1 trang (T7)

**Files:**
- Modify: `ceo-command.controller.ts` — `GET tower/board-pack?week=YYYY-Www`
- Create: `ceo-tower-board-pack.util.ts` — ISO week ICT default
- Create: `services/ops-web/src/app/crm/ceo/board-pack/page.tsx`
- Modify: `CeoLifecycleTower.tsx` — link `In tuần`

Payload `facts_json` **bắt buộc** chứa mọi số trên trang: K1–K4, count red/amber theo 6 cột + 6 phòng, top 10 exception, finance 5 ô, capacity_top, S11/S12 fail?, `degraded[]`, `decisions_blank: ['','','']` — **không** AI điền.

FE: print CSS A4. Nút **In / PDF trình duyệt**. Không lib PDF.

`PTT_CEO_BOARD_PACK_NOTIFY` default 0 — **không** cron trong T7 (chỉ đọc flag; nếu 1, optional notify CEO+GDKD — skip nếu chưa có cron hook).

- [ ] E2e: trang in được; số có trong `facts_json`.
- [ ] **Commit** `feat(ceo-tower): weekly board pack print page`

---

### Task 15: Đa pháp nhân opt-in (T8)

**Files:**
- Modify: `ceo-tower-sensor.service.ts`
- Modify: `ai-intelligence.config.ts` hoặc `app-config.service.ts` — `PTT_CEO_TOWER_LEGAL_ENTITY` default `0`
- Modify: `deploy/env.ai.example` (comment)

Khi flag `0`: không hiện filter. Khi `1`: đọc `contracts.legal_entity_id` **nếu cột tồn tại** (`information_schema`); không có → `degraded: legal_entity_schema_missing`, ẩn filter, **không** migration.

- [ ] Test: flag off → `legal_entity_id` null, không query entity.
- [ ] **Commit** `feat(ceo-tower): legal entity filter opt-in`

---

### Task 16: Docs + e2e notes + VPS (T1–T7)

**Files:**
- Modify: `docs/huong-dan-su-dung/28-ceo-command-chatbox.md` — tháp trên chat, không approve HĐ
- Create: `docs/runbooks/ceo-lifecycle-tower-ops.md` — flags, cache, degraded
- Modify: spec header **Trạng thái:** Plan ready → Implemented khi xong
- Modify: `services/ops-web/e2e/ceo-lifecycle-tower.spec.ts` — 6 cột, Hub, không commit view-only
- Modify: `scripts/deploy_ceo_command_vps.sh` — không bật LLM; comment tower (không flag mới bắt buộc)

VPS:

```bash
cd /var/www/rnosai && git pull --ff-only origin main
cd services/ptt-crm-api && npm ci && npm run build
sudo systemctl restart ptt-crm-api
# ops-web: NEXT_PUBLIC_PTT_CEO_COMMAND=1 bash scripts/deploy_ops_web.sh
# PTT_CEO_TOWER_LEGAL_ENTITY=0  PTT_CEO_BOARD_PACK_NOTIFY=0  PTT_CEO_COMMAND_LLM=0
```

- [ ] **Commit** `docs(ceo-tower): ops guide and learn page note`

---

## Spec coverage (self-review)

| Spec | Task |
|------|------|
| G1 / §4 sáu cột | 1, 5, 7 |
| G2 invariant một cột | 1, 4 |
| G3 hàng chờ ẩn xanh + sort | 5, 7 |
| G4 drill A/B | 3, 7 |
| G5 catalog C + 2 action | 8, 12 |
| G6 ChatBox trên/dưới + degraded | 5, 7, 9 |
| G7 / §16–§18 org 5 lớp | 10 |
| G8 / §19–§22 tiền, S11/12, capacity, board pack | 11, 13, 14 |
| §23 entity | 15 |
| §5 SLA | 2, 4 |
| §6 S1–S12 | 4, 11 |
| §9 caps | 6 |
| §10 API | 5, 14 |
| §12 pha T0–T8 | 1–15 |
| §13 tests | từng task |
| Seed UAT | 1 |
| Docs | 16 |

## Type names (khóa)

`TowerFactory`, `TowerColumnId`, `TowerSeverity`, `TowerSensorId`, `TowerEntityInput`, `assignTowerColumn`, `isTowerUatSeed`, `clockSeverity`, `towerDrillHref`, `classifyTowerRow`, `TowerException`, `TowerPayload`, `CeoTowerSensorService.buildPayload`, `TOWER_DEPT_CATALOG`, `remind_contract_approval`, `prioritize_solution_queue`.

---

*Plan v1.0 — implement theo spec CEO Lifecycle Tower v1.3. Không gồm playbook learn. T8 không chặn merge T0–T7.*
