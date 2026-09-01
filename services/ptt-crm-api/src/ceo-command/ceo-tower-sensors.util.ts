import { assignTowerColumn } from './ceo-tower-column.util';
import { clockSeverity, worseSeverity } from './ceo-tower-sla.util';
import type {
  TowerColumnId,
  TowerColumnOpts,
  TowerEntityInput,
  TowerSensorId,
  TowerSeverity,
} from './ceo-tower.types';

const H = 3600_000;
const D = 24 * H;

export type TowerSensorRow = TowerEntityInput & {
  ownerId: number | null;
  createdAtMs: number;
  b2DoneAtMs: number | null;
  intakeGoAtMs: number | null;
  contractSubmittedAtMs: number | null;
  promoteAtMs: number | null;
  nowMs: number;
  tmmtGatePass: boolean;
  tmmtGateKnown?: boolean;
  qualityScore: number | null;
  launchQaFail: boolean;
  launchQaKnown?: boolean;
  stageDeliver: boolean;
  opsOverdue: boolean;
  opsDueToday: boolean;
  cplWorse40: boolean;
  contractEndInDays: number | null;
  kpiRetainRed: boolean;
  kpiRetainKnown?: boolean;
  spaFirstCallBreach: boolean;
  spaB2Breach: boolean;
  spaCloseBreach: boolean;
  hasConsultHandoff: boolean;
  valueVnd: number | null;
  opsAlertId?: number | null;
};

export type TowerClassifyResult = {
  column_id: TowerColumnId;
  severity: TowerSeverity;
  sensor_ids: TowerSensorId[];
  suggest_action: string | null;
};

function ageMs(fromMs: number | null | undefined, nowMs: number): number | null {
  if (fromMs == null) return null;
  return nowMs - fromMs;
}

function pickSuggestAction(sensorIds: TowerSensorId[], row: TowerSensorRow): string | null {
  if (sensorIds.includes('S1')) return 'assign_lead';
  if (sensorIds.includes('S9')) return 'sla_remind_lead';
  if (sensorIds.includes('S3')) return 'prioritize_solution_queue';
  if (sensorIds.includes('S4')) return 'remind_contract_approval';
  if (sensorIds.includes('S7') && row.opsAlertId != null) return 'ack_ops_alert';
  if (sensorIds.some((id) => id === 'S2' || id === 'S5' || id === 'S6' || id === 'S7' || id === 'S8' || id === 'S10')) {
    return 'remind_staff';
  }
  return null;
}

export function classifyTowerRow(
  row: TowerSensorRow,
  opts?: TowerColumnOpts,
): TowerClassifyResult {
  const column_id = assignTowerColumn(row, opts);
  const sensor_ids: TowerSensorId[] = [];
  let severity: TowerSeverity = 'ok';
  const bump = (s: TowerSeverity) => {
    severity = worseSeverity(severity, s);
  };

  const createdAge = ageMs(row.createdAtMs, row.nowMs) ?? 0;
  const b2Age = ageMs(row.b2DoneAtMs, row.nowMs);
  const intakeGoAge = ageMs(row.intakeGoAtMs, row.nowMs);
  const contractAge = ageMs(row.contractSubmittedAtMs, row.nowMs);
  const promoteAge = ageMs(row.promoteAtMs, row.nowMs);
  const contractClock = contractAge ?? createdAge;

  if (row.factory === 'A' && column_id === 'lead_b2') {
    if (row.ownerId == null) {
      bump(clockSeverity({
        columnId: 'lead_b2', factory: 'A', elapsedMs: createdAge, noOwner: true,
      }));
    }
    if (!row.b2Done) {
      bump(clockSeverity({
        columnId: 'lead_b2', factory: 'A', elapsedMs: createdAge, noB2: true,
      }));
    }
  }

  if (row.factory === 'A' && column_id === 'intake' && b2Age != null) {
    bump(clockSeverity({ columnId: 'intake', factory: 'A', elapsedMs: b2Age }));
  }

  if (row.factory === 'A' && column_id === 'consult' && intakeGoAge != null) {
    bump(clockSeverity({ columnId: 'consult', factory: 'A', elapsedMs: intakeGoAge }));
  }

  if (row.factory === 'A' && column_id === 'contract') {
    if (row.won && !row.hasLifecycle) {
      bump(clockSeverity({
        columnId: 'contract', factory: 'A', elapsedMs: contractClock, wonNoLifecycle: true,
      }));
    } else {
      bump(clockSeverity({
        columnId: 'contract', factory: 'A', elapsedMs: contractClock,
      }));
    }
  }

  // S1 — owner_id null AND age ≥ 4h
  if (row.factory === 'A' && column_id === 'lead_b2' && row.ownerId == null && createdAge >= 4 * H) {
    sensor_ids.push('S1');
    bump('red');
  }

  // S2 — lead_b2 / intake clock ≥ red §5.1
  if (row.factory === 'A' && column_id === 'lead_b2' && !row.b2Done) {
    const noB2 = clockSeverity({
      columnId: 'lead_b2', factory: 'A', elapsedMs: createdAge, noB2: true,
    });
    if (noB2 === 'red') {
      sensor_ids.push('S2');
      bump('red');
    }
  }
  if (row.factory === 'A' && column_id === 'intake' && b2Age != null) {
    const intake = clockSeverity({ columnId: 'intake', factory: 'A', elapsedMs: b2Age });
    if (intake === 'red') {
      sensor_ids.push('S2');
      bump('red');
    }
  }

  // S3 — separate 24h from intake_go (not consult 5d/10d SLA)
  if (
    row.factory === 'A'
    && column_id === 'consult'
    && row.intakeGo
    && !row.hasConsultHandoff
    && intakeGoAge != null
    && intakeGoAge >= 24 * H
  ) {
    sensor_ids.push('S3');
    bump('red');
  }

  // S4 — §5.1 red (pending ≥48h OR won no lifecycle ≥24h)
  if (row.factory === 'A' && column_id === 'contract') {
    const pendingRed = clockSeverity({
      columnId: 'contract', factory: 'A', elapsedMs: contractClock,
    }) === 'red';
    const wonRed = row.won && !row.hasLifecycle && clockSeverity({
      columnId: 'contract', factory: 'A', elapsedMs: contractClock, wonNoLifecycle: true,
    }) === 'red';
    if (pendingRed || wonRed) {
      sensor_ids.push('S4');
      bump('red');
    }
  }

  // S5 — 7d TMMT gate clock + qualityScore < 60 on deliver
  // Gate clock only when TMMT module is wired; missing data must not fake fail.
  if (row.factory === 'A' && column_id === 'tmmt_deliver') {
    const gateClock = row.tmmtGateKnown && !row.tmmtGatePass && promoteAge != null
      ? clockSeverity({ columnId: 'tmmt_deliver', factory: 'A', elapsedMs: promoteAge })
      : 'ok';
    const qualityRed = row.qualityScore != null && row.qualityScore < 60 && row.stageDeliver;
    if (gateClock === 'red' || gateClock === 'amber' || qualityRed) {
      sensor_ids.push('S5');
      bump(qualityRed ? 'red' : gateClock);
    }
  }

  // S6 — stage ≥ deliver + QA fail (skip unless Launch QA module is wired)
  if (
    row.factory === 'A'
    && column_id === 'tmmt_deliver'
    && row.launchQaKnown
    && row.launchQaFail
    && row.stageDeliver
  ) {
    sensor_ids.push('S6');
    bump('red');
  }

  // S7 — ops overdue red; due today / CPL worse amber
  if (row.factory === 'A' && (column_id === 'tmmt_deliver' || column_id === 'care')) {
    if (row.opsOverdue) {
      sensor_ids.push('S7');
      bump('red');
    } else if (row.opsDueToday || row.cplWorse40) {
      sensor_ids.push('S7');
      bump('amber');
    }
  }

  // S8 — separate 14-day clock from promote, not the 7d TMMT clock
  if (
    row.factory === 'A'
    && column_id === 'tmmt_deliver'
    && !row.clientActive
    && promoteAge != null
    && promoteAge >= 14 * D
  ) {
    sensor_ids.push('S8');
    bump('red');
  }

  // S9 — Factory B first_call / b2 / close breach
  if (row.factory === 'B' && (row.spaFirstCallBreach || row.spaB2Breach || row.spaCloseBreach)) {
    sensor_ids.push('S9');
    bump('red');
  }

  // S10 — end_date ≤30d OR KPI retain red (KPI path only when wired)
  if (row.factory === 'A' && column_id === 'care') {
    const endSoon = row.contractEndInDays != null && row.contractEndInDays <= 30;
    const kpiRed = Boolean(row.kpiRetainKnown && row.kpiRetainRed);
    if (endSoon || kpiRed) {
      sensor_ids.push('S10');
      bump('red');
    }
  }

  return {
    column_id,
    severity,
    sensor_ids,
    suggest_action: pickSuggestAction(sensor_ids, row),
  };
}
