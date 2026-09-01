import { assignTowerColumn } from './ceo-tower-column.util';
import { classifyTowerRow, type TowerSensorRow } from './ceo-tower-sensors.util';
import type { TowerEntityInput } from './ceo-tower.types';

const H = 3600_000;
const D = 24 * H;
const NOW = Date.UTC(2026, 8, 1, 12, 0, 0);

const entityA = (): TowerEntityInput => ({
  factory: 'A',
  leadId: 100,
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

function row(over: Partial<TowerSensorRow> & Partial<TowerEntityInput> = {}): TowerSensorRow {
  return {
    ...entityA(),
    ownerId: 1,
    createdAtMs: NOW,
    b2DoneAtMs: null,
    intakeGoAtMs: null,
    contractSubmittedAtMs: null,
    promoteAtMs: null,
    nowMs: NOW,
    tmmtGatePass: false,
    qualityScore: null,
    launchQaFail: false,
    stageDeliver: false,
    opsOverdue: false,
    opsDueToday: false,
    cplWorse40: false,
    contractEndInDays: null,
    kpiRetainRed: false,
    spaFirstCallBreach: false,
    spaB2Breach: false,
    spaCloseBreach: false,
    hasConsultHandoff: false,
    valueVnd: 10_000_000,
    opsAlertId: null,
    ...over,
  };
}

const fixtureS1 = row({
  leadId: 1,
  ownerId: null,
  createdAtMs: NOW - 4 * H,
});

const fixtureS2 = row({
  leadId: 2,
  ownerId: 7,
  b2Done: false,
  createdAtMs: NOW - 8 * H,
});

const fixtureS3 = row({
  leadId: 3,
  b2Done: true,
  intakeGo: true,
  hasConsultHandoff: false,
  createdAtMs: NOW - 3 * D,
  b2DoneAtMs: NOW - 2 * D,
  intakeGoAtMs: NOW - 24 * H,
});

const fixtureS4 = row({
  leadId: 4,
  b2Done: true,
  intakeGo: true,
  contractPendingOrActive: true,
  createdAtMs: NOW - 5 * D,
  b2DoneAtMs: NOW - 4 * D,
  intakeGoAtMs: NOW - 3 * D,
  contractSubmittedAtMs: NOW - 48 * H,
});

const fixtureS5 = row({
  leadId: 5,
  lifecycleId: 50,
  won: true,
  hasLifecycle: true,
  clientActive: false,
  tmmtGatePass: false,
  tmmtGateKnown: true,
  qualityScore: 80,
  createdAtMs: NOW - 20 * D,
  promoteAtMs: NOW - 7 * D,
});

const fixtureS6 = row({
  leadId: 6,
  lifecycleId: 60,
  won: true,
  hasLifecycle: true,
  clientActive: false,
  tmmtGatePass: true,
  qualityScore: 90,
  launchQaFail: true,
  launchQaKnown: true,
  stageDeliver: true,
  createdAtMs: NOW - 10 * D,
  promoteAtMs: NOW - 2 * D,
});

const fixtureS7 = row({
  leadId: 7,
  lifecycleId: 70,
  won: true,
  hasLifecycle: true,
  clientActive: false,
  tmmtGatePass: true,
  qualityScore: 85,
  opsOverdue: true,
  opsAlertId: 42,
  createdAtMs: NOW - 10 * D,
  promoteAtMs: NOW - 2 * D,
});

const fixtureS8 = row({
  leadId: 8,
  lifecycleId: 80,
  won: true,
  hasLifecycle: true,
  clientActive: false,
  tmmtGatePass: true,
  qualityScore: 88,
  createdAtMs: NOW - 30 * D,
  promoteAtMs: NOW - 14 * D,
});

const fixtureS9 = row({
  factory: 'B',
  leadId: 9,
  spaOnBoard: true,
  firstCallDone: false,
  spaFirstCallBreach: true,
  createdAtMs: NOW - H,
});

const fixtureS10 = row({
  leadId: 10,
  lifecycleId: 110,
  won: true,
  hasLifecycle: true,
  clientActive: true,
  retain: true,
  tmmtGatePass: true,
  contractEndInDays: 30,
  createdAtMs: NOW - 60 * D,
  promoteAtMs: NOW - 20 * D,
});

const FIXTURES: TowerSensorRow[] = [
  fixtureS1, fixtureS2, fixtureS3, fixtureS4, fixtureS5,
  fixtureS6, fixtureS7, fixtureS8, fixtureS9, fixtureS10,
];

describe('classifyTowerRow S1–S10', () => {
  it('S1: A no owner ≥4h → red lead_b2 assign_lead', () => {
    const out = classifyTowerRow(fixtureS1);
    expect(out.column_id).toBe('lead_b2');
    expect(out.severity).toBe('red');
    expect(out.sensor_ids).toEqual(expect.arrayContaining(['S1']));
    expect(out.suggest_action).toBe('assign_lead');
  });

  it('S2: A no B2 ≥8h → red remind_staff', () => {
    const out = classifyTowerRow(fixtureS2);
    expect(out.column_id).toBe('lead_b2');
    expect(out.severity).toBe('red');
    expect(out.sensor_ids).toEqual(expect.arrayContaining(['S2']));
    expect(out.sensor_ids).not.toContain('S1');
    expect(out.suggest_action).toBe('remind_staff');
  });

  it('S3: intake_go no handoff ≥24h → consult prioritize_solution_queue', () => {
    const out = classifyTowerRow(fixtureS3);
    expect(out.column_id).toBe('consult');
    expect(out.severity).toBe('red');
    expect(out.sensor_ids).toEqual(expect.arrayContaining(['S3']));
    expect(out.suggest_action).toBe('prioritize_solution_queue');
  });

  it('S4: contract pending ≥48h → remind_contract_approval', () => {
    const out = classifyTowerRow(fixtureS4);
    expect(out.column_id).toBe('contract');
    expect(out.severity).toBe('red');
    expect(out.sensor_ids).toEqual(expect.arrayContaining(['S4']));
    expect(out.suggest_action).toBe('remind_contract_approval');
  });

  it('S5: promote ≥7d no TMMT gate → remind_staff', () => {
    const out = classifyTowerRow(fixtureS5);
    expect(out.column_id).toBe('tmmt_deliver');
    expect(out.severity).toBe('red');
    expect(out.sensor_ids).toEqual(expect.arrayContaining(['S5']));
    expect(out.sensor_ids).not.toContain('S8');
    expect(out.suggest_action).toBe('remind_staff');
  });

  it('S5 does not fire when tmmtGateKnown is false even if promote ≥7d and tmmtGatePass false', () => {
    const out = classifyTowerRow(row({
      leadId: 505,
      lifecycleId: 505,
      won: true,
      hasLifecycle: true,
      clientActive: false,
      tmmtGatePass: false,
      tmmtGateKnown: false,
      qualityScore: 80,
      createdAtMs: NOW - 20 * D,
      promoteAtMs: NOW - 7 * D,
    }));
    expect(out.column_id).toBe('tmmt_deliver');
    expect(out.sensor_ids).not.toContain('S5');
  });

  it('S6 does not fire when launchQaKnown is false even if deliver + QA fail', () => {
    const out = classifyTowerRow(row({
      ...fixtureS6,
      launchQaKnown: false,
    }));
    expect(out.column_id).toBe('tmmt_deliver');
    expect(out.sensor_ids).not.toContain('S6');
  });

  it('S10 KPI path does not fire when kpiRetainKnown is false', () => {
    const out = classifyTowerRow(row({
      leadId: 102,
      lifecycleId: 102,
      won: true,
      hasLifecycle: true,
      clientActive: true,
      kpiRetainRed: true,
      kpiRetainKnown: false,
      contractEndInDays: 90,
    }));
    expect(out.column_id).toBe('care');
    expect(out.sensor_ids).not.toContain('S10');
  });

  it('S6: deliver + QA fail → red', () => {
    const out = classifyTowerRow(fixtureS6);
    expect(out.column_id).toBe('tmmt_deliver');
    expect(out.severity).toBe('red');
    expect(out.sensor_ids).toEqual(expect.arrayContaining(['S6']));
    expect(out.suggest_action).toBe('remind_staff');
  });

  it('S7: ops overdue → red ack_ops_alert if alert_id', () => {
    const out = classifyTowerRow(fixtureS7);
    expect(out.column_id).toBe('tmmt_deliver');
    expect(out.severity).toBe('red');
    expect(out.sensor_ids).toEqual(expect.arrayContaining(['S7']));
    expect(out.suggest_action).toBe('ack_ops_alert');
  });

  it('S8: promote ≥14d !client_active → red', () => {
    const out = classifyTowerRow(fixtureS8);
    expect(out.column_id).toBe('tmmt_deliver');
    expect(out.severity).toBe('red');
    expect(out.sensor_ids).toEqual(expect.arrayContaining(['S8']));
    expect(out.sensor_ids).not.toContain('S5');
    expect(out.suggest_action).toBe('remind_staff');
  });

  it('S9: B first_call breach → sla_remind_lead', () => {
    const out = classifyTowerRow(fixtureS9, { factoryFilter: 'B' });
    expect(out.column_id).toBe('lead_b2');
    expect(out.severity).toBe('red');
    expect(out.sensor_ids).toEqual(expect.arrayContaining(['S9']));
    expect(out.suggest_action).toBe('sla_remind_lead');
  });

  it('S10: contract end ≤30d → remind_staff', () => {
    const out = classifyTowerRow(fixtureS10);
    expect(out.column_id).toBe('care');
    expect(out.severity).toBe('red');
    expect(out.sensor_ids).toEqual(expect.arrayContaining(['S10']));
    expect(out.suggest_action).toBe('remind_staff');
  });

  it('every fixture has a column (no null)', () => {
    for (const fixture of FIXTURES) {
      expect(assignTowerColumn(fixture)).toBeTruthy();
      expect(classifyTowerRow(fixture).column_id).toBeTruthy();
    }
  });
});

describe('classifyTowerRow §5.1 / §5.2 extras', () => {
  it('S2 intake ≥5d from b2_done → red remind_staff', () => {
    const out = classifyTowerRow(row({
      leadId: 22,
      b2Done: true,
      intakeGo: false,
      createdAtMs: NOW - 8 * D,
      b2DoneAtMs: NOW - 5 * D,
    }));
    expect(out.column_id).toBe('intake');
    expect(out.severity).toBe('red');
    expect(out.sensor_ids).toEqual(expect.arrayContaining(['S2']));
    expect(out.suggest_action).toBe('remind_staff');
  });

  it('S3 is a 24h intake_go clock, not consult 5d/10d SLA', () => {
    const underConsultAmber = classifyTowerRow(fixtureS3);
    expect(underConsultAmber.sensor_ids).toContain('S3');
    expect(underConsultAmber.severity).toBe('red');

    const justUnder = classifyTowerRow(row({
      ...fixtureS3,
      intakeGoAtMs: NOW - 24 * H + 1,
    }));
    expect(justUnder.column_id).toBe('consult');
    expect(justUnder.sensor_ids).not.toContain('S3');
  });

  it('S4 won no lifecycle ≥24h → red remind_contract_approval', () => {
    const out = classifyTowerRow(row({
      leadId: 44,
      b2Done: true,
      intakeGo: true,
      won: true,
      hasLifecycle: false,
      createdAtMs: NOW - 3 * D,
      contractSubmittedAtMs: NOW - 24 * H,
    }));
    expect(out.column_id).toBe('contract');
    expect(out.severity).toBe('red');
    expect(out.sensor_ids).toEqual(expect.arrayContaining(['S4']));
    expect(out.suggest_action).toBe('remind_contract_approval');
  });

  it('S5 qualityScore < 60 + stageDeliver → red', () => {
    const out = classifyTowerRow(row({
      leadId: 55,
      lifecycleId: 55,
      won: true,
      hasLifecycle: true,
      clientActive: false,
      tmmtGatePass: true,
      tmmtGateKnown: true,
      qualityScore: 59,
      stageDeliver: true,
      promoteAtMs: NOW - 2 * D,
    }));
    expect(out.column_id).toBe('tmmt_deliver');
    expect(out.severity).toBe('red');
    expect(out.sensor_ids).toEqual(expect.arrayContaining(['S5']));
    expect(out.suggest_action).toBe('remind_staff');
  });

  it('S7 ops overdue without opsAlertId → remind_staff', () => {
    const out = classifyTowerRow(row({
      ...fixtureS7,
      opsAlertId: null,
    }));
    expect(out.sensor_ids).toEqual(expect.arrayContaining(['S7']));
    expect(out.severity).toBe('red');
    expect(out.suggest_action).toBe('remind_staff');
  });

  it('S7 opsDueToday → amber; cplWorse40 observe-only amber', () => {
    const dueToday = classifyTowerRow(row({
      leadId: 71,
      lifecycleId: 71,
      won: true,
      hasLifecycle: true,
      tmmtGatePass: true,
      opsDueToday: true,
      promoteAtMs: NOW - D,
    }));
    expect(dueToday.column_id).toBe('tmmt_deliver');
    expect(dueToday.severity).toBe('amber');
    expect(dueToday.sensor_ids).toEqual(expect.arrayContaining(['S7']));
    expect(dueToday.suggest_action).toBe('remind_staff');

    const cpl = classifyTowerRow(row({
      leadId: 72,
      lifecycleId: 72,
      won: true,
      hasLifecycle: true,
      tmmtGatePass: true,
      cplWorse40: true,
      promoteAtMs: NOW - D,
    }));
    expect(cpl.severity).toBe('amber');
    expect(cpl.sensor_ids).toEqual(expect.arrayContaining(['S7']));
    expect(cpl.suggest_action).toBe('remind_staff');
  });

  it('S8 14d clock is independent of the 7d TMMT gate clock', () => {
    const at7dGatePass = classifyTowerRow(row({
      leadId: 88,
      lifecycleId: 88,
      won: true,
      hasLifecycle: true,
      tmmtGatePass: true,
      promoteAtMs: NOW - 7 * D,
    }));
    expect(at7dGatePass.column_id).toBe('tmmt_deliver');
    expect(at7dGatePass.sensor_ids).not.toContain('S5');
    expect(at7dGatePass.sensor_ids).not.toContain('S8');
  });

  it('S9 b2 / close breach on care (filter both) → sla_remind_lead', () => {
    const out = classifyTowerRow(row({
      factory: 'B',
      leadId: 99,
      spaOnBoard: true,
      firstCallDone: true,
      spaB2Breach: true,
      spaCloseBreach: true,
    }));
    expect(out.column_id).toBe('care');
    expect(out.severity).toBe('red');
    expect(out.sensor_ids).toEqual(expect.arrayContaining(['S9']));
    expect(out.suggest_action).toBe('sla_remind_lead');
  });

  it('S10 kpiRetainRed → red remind_staff', () => {
    const out = classifyTowerRow(row({
      leadId: 101,
      lifecycleId: 101,
      won: true,
      hasLifecycle: true,
      clientActive: true,
      kpiRetainRed: true,
      kpiRetainKnown: true,
      contractEndInDays: 90,
    }));
    expect(out.column_id).toBe('care');
    expect(out.severity).toBe('red');
    expect(out.sensor_ids).toEqual(expect.arrayContaining(['S10']));
    expect(out.suggest_action).toBe('remind_staff');
  });

  it('lead_b2 A noOwner + noB2: evaluate separately and merge via worseSeverity', () => {
    const out = classifyTowerRow(row({
      leadId: 12,
      ownerId: null,
      b2Done: false,
      createdAtMs: NOW - 8 * H,
    }));
    expect(out.column_id).toBe('lead_b2');
    expect(out.severity).toBe('red');
    expect(out.sensor_ids).toEqual(expect.arrayContaining(['S1', 'S2']));
    expect(out.suggest_action).toBe('assign_lead');
  });
});
