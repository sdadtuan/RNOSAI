# Task 4 Report — Sensor classify S1–S10 on fixtures (T0)

**Branch:** `feat/ceo-lifecycle-tower`  
**Commit:** (see git) — `feat(ceo-tower): classify S1–S10 on fixtures`  
**Date:** 2026-09-01

---

## Summary

Implemented pure `classifyTowerRow` for CEO Lifecycle Tower. Given a `TowerSensorRow` (entity + clocks + quality flags), it assigns a column via `assignTowerColumn`, evaluates sensors S1–S10 from spec §6 + SLA §5.1 + quality §5.2, merges severity with `worseSeverity`, and returns `{ column_id, severity, sensor_ids, suggest_action }`.

No Nest wiring (Task 5). Task 1–3 files were not modified. Optional `opsAlertId` lives only on `TowerSensorRow`.

---

## TDD Steps

| Step | Action | Result |
|------|--------|--------|
| 1 | Wrote full Jest cases (not `/* ... */`) from §6 + §4 + §5.1/§5.2 | — |
| 2 | Ran Jest (RED) | FAIL — `Cannot find module './ceo-tower-sensors.util'` |
| 3 | Implemented `classifyTowerRow` + `TowerSensorRow` | — |
| 4 | Ran Jest (GREEN) | **21/21 PASS** |
| 5 | Re-ran Task 1–4 tower specs | **45/45 PASS** |
| 6 | Committed | `feat(ceo-tower): classify S1–S10 on fixtures` |

### Test command

```bash
cd services/ptt-crm-api && npx jest src/ceo-command/ceo-tower-sensors.util.spec.ts --no-coverage
```

(local binary: `./node_modules/.bin/jest` — same suite)

### Output

```
PASS src/ceo-command/ceo-tower-sensors.util.spec.ts
  classifyTowerRow S1–S10
    ✓ S1: A no owner ≥4h → red lead_b2 assign_lead
    ✓ S2: A no B2 ≥8h → red remind_staff
    ✓ S3: intake_go no handoff ≥24h → consult prioritize_solution_queue
    ✓ S4: contract pending ≥48h → remind_contract_approval
    ✓ S5: promote ≥7d no TMMT gate → remind_staff
    ✓ S6: deliver + QA fail → red
    ✓ S7: ops overdue → red ack_ops_alert if alert_id
    ✓ S8: promote ≥14d !client_active → red
    ✓ S9: B first_call breach → sla_remind_lead
    ✓ S10: contract end ≤30d → remind_staff
    ✓ every fixture has a column (no null)
  classifyTowerRow §5.1 / §5.2 extras
    ✓ S2 intake ≥5d from b2_done → red remind_staff
    ✓ S3 is a 24h intake_go clock, not consult 5d/10d SLA
    ✓ S4 won no lifecycle ≥24h → red remind_contract_approval
    ✓ S5 qualityScore < 60 + stageDeliver → red
    ✓ S7 ops overdue without opsAlertId → remind_staff
    ✓ S7 opsDueToday → amber; cplWorse40 observe-only amber
    ✓ S8 14d clock is independent of the 7d TMMT gate clock
    ✓ S9 b2 / close breach on care (filter both) → sla_remind_lead
    ✓ S10 kpiRetainRed → red remind_staff
    ✓ lead_b2 A noOwner + noB2: evaluate separately and merge via worseSeverity

Test Suites: 1 passed, 1 total
Tests:       21 passed, 21 total
```

---

## Files Created

| File | Purpose |
|------|---------|
| `services/ptt-crm-api/src/ceo-command/ceo-tower-sensors.util.ts` | `TowerSensorRow`, `classifyTowerRow` |
| `services/ptt-crm-api/src/ceo-command/ceo-tower-sensors.util.spec.ts` | Full S1–S10 fixtures + §5 extras |

---

## API Surface

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
  opsAlertId?: number | null; // added so S7 can return ack_ops_alert
};

export function classifyTowerRow(row: TowerSensorRow, opts?: TowerColumnOpts): {
  column_id: TowerColumnId;
  severity: TowerSeverity;
  sensor_ids: TowerSensorId[];
  suggest_action: string | null;
}
```

Reused (not rewritten): `assignTowerColumn`, `clockSeverity`, `worseSeverity`, Task 1 types.

---

## Spec §6 mapping (implemented)

| ID | Column | Fail when | suggest_action |
|----|--------|-----------|----------------|
| S1 | `lead_b2` | A, `ownerId` null, age ≥ 4h | `assign_lead` |
| S2 | `lead_b2` / `intake` | A, clock ≥ red §5.1 (noB2 8h **or** intake 5d) | `remind_staff` |
| S3 | `consult` | A, `intake_go`, no handoff, **separate 24h** from `intakeGoAtMs` | `prioritize_solution_queue` |
| S4 | `contract` | §5.1 red: pending ≥48h **or** won no LC ≥24h | `remind_contract_approval` |
| S5 | `tmmt_deliver` | Promote ≥7d + gate not pass (amber 5–7d); **or** `qualityScore < 60` + `stageDeliver` | `remind_staff` |
| S6 | `tmmt_deliver` | `launchQaFail` + `stageDeliver` | `remind_staff` |
| S7 | `tmmt_deliver` / `care` | `opsOverdue` → red; `opsDueToday` / `cplWorse40` → amber | `ack_ops_alert` if `opsAlertId`, else `remind_staff` |
| S8 | `tmmt_deliver` | **Separate 14d** from promote, not client_active | `remind_staff` |
| S9 | `care` (or `lead_b2` if filter B + 15p) | B first_call / b2 / close breach | `sla_remind_lead` |
| S10 | `care` | `contractEndInDays ≤ 30` **or** `kpiRetainRed` | `remind_staff` |

Controller decisions locked in extras:

- `noOwner` and `noB2` are **two** `clockSeverity` calls, merged with `worseSeverity`.
- S3 is **not** the consult 5d/10d SLA.
- S8 is **not** the 7d TMMT gate clock (gate-pass at 7d fires neither S5 nor S8).
- S3/S4 `suggest_action` ids are strings even though execute is not wired.

---

## Self-Review

### Correctness vs brief + spec

- Each of S1–S10 asserts real `column_id`, `severity`, `sensor_ids` (includes that sensor), and `suggest_action`.
- Invariant: all 10 fixtures have a column from `assignTowerColumn` and from `classifyTowerRow`.
- S1 does not also fire S2 at 4h (noB2 red is 8h).
- S5 at 7d does not fire S8 (14d).
- S8 at 14d with gate pass does not fire S5.
- S7 with `opsAlertId: 42` → `ack_ops_alert`; without → `remind_staff`.
- S9 first_call + `factoryFilter: 'B'` → `lead_b2`; b2/close without filter → `care`.

### Intentionally out of scope (T0)

| Gap | Reason |
|-----|--------|
| Nest `GET /tower` wiring | Task 5 |
| S11 / S12 | Spec §6 later rows; not in Task 4 brief |
| `suggest_params` / `href` | Drill is Task 3; assemble is Task 5 |
| Consult 10d SLA without S3 (has handoff) | Clock-only severity; no named sensor |
| Care A amber “KPI Cần chú ý” | No input flag; only `kpiRetainRed` (red) |

### Edge cases for Task 5

1. **suggest_action priority** when multiple sensors fire: S1 → S9 → S3 → S4 → S7+alert → generic `remind_staff`. Wiring should pass `opsAlertId` when an open alert exists.
2. **S2 amber** (noB2 4h / intake 3d) raises column clock severity but does **not** add `S2` (fail = red only). Queue filter in Task 5 must decide whether amber-without-sensor still lists.
3. **S5 amber 5–7d** (gate not pass) **does** add `S5` — unlike S2.
4. **Contract clock fallback:** `contractSubmittedAtMs ?? createdAtMs`.
5. **Factory B default column is `care`** unless `factoryFilter === 'B'` and no first call.

### Code quality

- Reuses Task 1–2 utils; no SLA rewrite.
- Brief `TowerSensorRow` kept exact plus optional `opsAlertId`.
- No linter errors on new files.

---

## Concerns / Follow-ups

1. **Amber S2 vs red S2:** only red adds `S2`. If Task 5 queue wants “B2 chậm” amber chips, extend the fail threshold or add a warning-tier sensor.
2. **S7 vs S10 KPI overlap:** `kpiRetainRed` is S10 only; S7 uses ops/CPL flags. Wiring must not map retain KPI onto `opsOverdue`.
3. **S7 `cplWorse40`** is observe-only amber + `remind_staff` (never pause ads) — confirm chip copy in UI.
4. **S11/S12** not classified here.
5. **`valueVnd`** is on the row for later sort; unused by classify.

---

## Status

**COMPLETE** — TDD RED → GREEN, committed, self-reviewed.
