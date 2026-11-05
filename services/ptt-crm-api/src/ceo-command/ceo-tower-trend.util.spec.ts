import { buildTowerTrends } from './ceo-tower-trend.util';
import type { TowerCandidate } from './ceo-tower.types';

const H = 3600_000;
const D = 24 * H;
const NOW = Date.UTC(2026, 8, 1, 12, 0, 0);

function candidate(over: Partial<TowerCandidate> = {}): TowerCandidate {
  return {
    leadId: 10,
    lifecycleId: null,
    tags: [],
    clientId: null,
    channel: 'agency',
    source: 'manual',
    status: 'moi',
    metaJson: { lead_flow_kind: 'b2b_prospect' },
    hasPresales: true,
    ownerId: 1,
    ownerName: 'AM An',
    departmentCode: 'DEPT-SALES',
    teamCode: 'TEAM-SALES-AM',
    positionCode: 'KD-01',
    jobFunction: 'sales',
    createdAtMs: NOW - 2 * H,
    lastActivityMs: NOW - 1 * H,
    b2Done: false,
    b2DoneAtMs: null,
    intakeGo: false,
    intakeGoAtMs: null,
    contractPendingOrActive: false,
    contractSubmittedAtMs: null,
    won: false,
    hasLifecycle: false,
    clientActive: false,
    retain: false,
    spaOnBoard: false,
    firstCallDone: false,
    promoteAtMs: null,
    tmmtGatePass: false,
    tmmtGateKnown: false,
    qualityScore: null,
    launchQaFail: false,
    launchQaKnown: false,
    stageDeliver: false,
    opsOverdue: false,
    opsDueToday: false,
    cplWorse40: false,
    contractEndInDays: null,
    kpiRetainRed: false,
    kpiRetainKnown: false,
    spaFirstCallBreach: false,
    spaB2Breach: false,
    spaCloseBreach: false,
    hasConsultHandoff: false,
    valueVnd: 5_000_000,
    opsAlertId: null,
    clientUuid: null,
    ...over,
  };
}

describe('buildTowerTrends', () => {
  it('returns 7 labels and series aligned with open issues', () => {
    const noOwner = candidate({
      leadId: 1,
      ownerId: null,
      ownerName: '',
      createdAtMs: NOW - 5 * H,
      lastActivityMs: NOW - 5 * H,
    });
    const out = buildTowerTrends([noOwner], {
      factoryFilter: 'both',
      nowMs: NOW,
      hasOps: true,
      columnDegraded: {},
    });
    expect(out.series.labels).toHaveLength(7);
    expect(out.series.total_issues).toHaveLength(7);
    expect(out.series.red_issues).toHaveLength(7);
    expect(out.wow.current_total).toBe(out.series.total_issues[6]);
    expect(out.wow.prev_week_total).toBe(out.series.total_issues[0]);
  });

  it('respects factory filter and degraded columns', () => {
    const noOwner = candidate({
      leadId: 1,
      ownerId: null,
      ownerName: '',
      createdAtMs: NOW - 5 * H,
      lastActivityMs: NOW - 5 * H,
    });
    const spa = candidate({
      leadId: 2,
      channel: 'spa',
      metaJson: { lead_flow_kind: 'spa_operational' },
      spaFirstCallBreach: true,
      spaOnBoard: true,
      firstCallDone: false,
      createdAtMs: NOW - 3 * H,
      lastActivityMs: NOW - 3 * H,
    });
    const both = buildTowerTrends([noOwner, spa], {
      factoryFilter: 'both',
      nowMs: NOW,
      hasOps: true,
      columnDegraded: {},
    });
    const factoryB = buildTowerTrends([noOwner, spa], {
      factoryFilter: 'B',
      nowMs: NOW,
      hasOps: true,
      columnDegraded: {},
    });
    expect(both.wow.current_total).toBeGreaterThanOrEqual(factoryB.wow.current_total);
  });
});
