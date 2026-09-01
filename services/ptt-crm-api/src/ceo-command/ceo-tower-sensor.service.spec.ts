import { CeoTowerSensorService } from './ceo-tower-sensor.service';
import type { CeoTowerRepository } from './ceo-tower.repository';
import type { OwnerWeeklyPgRepository } from '../owner-weekly/owner-weekly-pg.repository';
import type { CeoActor } from './ceo-command.types';
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
    valueVnd: 5_000_000,
    opsAlertId: null,
    clientUuid: null,
    ...over,
  };
}

const s1NoOwner = candidate({
  leadId: 1,
  ownerId: null,
  ownerName: '',
  createdAtMs: NOW - 5 * H,
  lastActivityMs: NOW - 5 * H,
  valueVnd: 1_000_000,
});

const s7OpsOverdue = candidate({
  leadId: 70,
  lifecycleId: 700,
  status: 'won',
  won: true,
  hasLifecycle: true,
  clientActive: false,
  b2Done: true,
  intakeGo: true,
  createdAtMs: NOW - 20 * D,
  lastActivityMs: NOW - 2 * D,
  promoteAtMs: NOW - 3 * D,
  tmmtGatePass: true,
  opsOverdue: true,
  opsAlertId: 88,
  valueVnd: 20_000_000,
});

const spaB = candidate({
  leadId: 200,
  clientId: 'spa-1',
  channel: 'facebook',
  source: 'meta',
  status: 'moi',
  metaJson: { lead_flow_kind: 'spa_operational' },
  hasPresales: false,
  spaOnBoard: true,
  firstCallDone: false,
  spaFirstCallBreach: true,
  lastActivityMs: NOW - 2 * H,
  valueVnd: null,
});

function actor(caps: Array<{ section: string; action: string }>): CeoActor {
  return { staffId: 9, staffLabel: 'ceo', caps };
}

const CEO_VIEW = [{ section: 'ceo_command', action: 'view' }];
const OPS_AND_K = [
  ...CEO_VIEW,
  { section: 'crm_leads', action: 'view' },
  { section: 'crm_owner_weekly_dashboard', action: 'view' },
];

function makeSvc(opts?: {
  candidates?: TowerCandidate[];
  loadCandidates?: jest.Mock;
  kStrip?: Array<{ key: 'k1' | 'k2' | 'k3' | 'k4'; value: number | null; status: 'green' | 'amber' | 'red' | 'neutral' }>;
  nowMs?: number;
}) {
  const repo = {
    loadCandidates: opts?.loadCandidates
      ?? jest.fn().mockResolvedValue(opts?.candidates ?? [s1NoOwner]),
  };
  const ownerWeekly = {
    loadLifecycleKpiStrip: jest.fn().mockResolvedValue(opts?.kStrip ?? [
      { key: 'k1', value: 120, status: 'green' },
      { key: 'k2', value: 3, status: 'amber' },
      { key: 'k3', value: null, status: 'neutral' },
      { key: 'k4', value: 90, status: 'green' },
    ]),
  };
  const svc = new CeoTowerSensorService(
    repo as unknown as CeoTowerRepository,
    ownerWeekly as unknown as OwnerWeeklyPgRepository,
    { nowMs: opts?.nowMs ?? NOW },
  );
  return { svc, repo, ownerWeekly };
}

describe('CeoTowerSensorService.buildPayload', () => {
  it('thiếu ops cap → S7 degraded, S1 vẫn fail', async () => {
    const { svc } = makeSvc({ candidates: [s1NoOwner, s7OpsOverdue] });
    const out = await svc.buildPayload(actor(CEO_VIEW), {});

    expect(out.ok).toBe(true);
    expect(out.sensors_ok.S7).toBe('degraded');
    expect(out.sensors_ok.S1).toBe('fail');
    expect(out.exceptions.some((row) => row.sensor_ids.includes('S7'))).toBe(false);
    expect(out.exceptions.some((row) => row.sensor_ids.includes('S1'))).toBe(true);
  });

  it('có ops cap → S7 fail khi overdue, S1 vẫn fail', async () => {
    const { svc } = makeSvc({ candidates: [s1NoOwner, s7OpsOverdue] });
    const out = await svc.buildPayload(actor(OPS_AND_K), {});

    expect(out.sensors_ok.S7).toBe('fail');
    expect(out.sensors_ok.S1).toBe('fail');
    expect(out.exceptions.some((row) => row.sensor_ids.includes('S7'))).toBe(true);
  });

  it('thiếu crm_owner_weekly_dashboard.view → ẩn k_strip + degraded k_strip', async () => {
    const { svc, ownerWeekly } = makeSvc({ candidates: [s1NoOwner] });
    const out = await svc.buildPayload(actor(CEO_VIEW), {});

    expect(out.k_strip).toEqual([]);
    expect(out.degraded.some((d) => d.source === 'k_strip')).toBe(true);
    expect(ownerWeekly.loadLifecycleKpiStrip).not.toHaveBeenCalled();
  });

  it('có Owner Weekly cap → k_strip từ loadLifecycleKpiStrip, không bịa 0', async () => {
    const { svc } = makeSvc({
      candidates: [s1NoOwner],
      kStrip: [
        { key: 'k1', value: 480, status: 'red' },
        { key: 'k2', value: null, status: 'neutral' },
        { key: 'k3', value: 10, status: 'green' },
        { key: 'k4', value: 70, status: 'amber' },
      ],
    });
    const out = await svc.buildPayload(actor(OPS_AND_K), {});

    expect(out.k_strip).toEqual([
      { key: 'k1', value: 480, status: 'red', href: '/crm/owner-weekly' },
      { key: 'k2', value: null, status: 'neutral', href: '/crm/owner-weekly' },
      { key: 'k3', value: 10, status: 'green', href: '/crm/owner-weekly' },
      { key: 'k4', value: 70, status: 'amber', href: '/crm/owner-weekly' },
    ]);
  });

  it('sort exceptions: red trước → age desc → value desc', async () => {
    const olderRedCheap = candidate({
      leadId: 11,
      ownerId: null,
      createdAtMs: NOW - 20 * H,
      lastActivityMs: NOW - 20 * H,
      valueVnd: 1,
    });
    const newerRedExpensive = candidate({
      leadId: 12,
      ownerId: null,
      createdAtMs: NOW - 10 * H,
      lastActivityMs: NOW - 10 * H,
      valueVnd: 99,
    });
    const newerRedCheap = candidate({
      leadId: 13,
      ownerId: null,
      createdAtMs: NOW - 10 * H,
      lastActivityMs: NOW - 10 * H,
      valueVnd: 2,
    });
    const amberOld = candidate({
      leadId: 14,
      ownerId: null,
      createdAtMs: NOW - 3 * H,
      lastActivityMs: NOW - 3 * H,
      valueVnd: 9_000_000,
    });
    const { svc } = makeSvc({
      candidates: [amberOld, newerRedCheap, olderRedCheap, newerRedExpensive],
    });
    const out = await svc.buildPayload(actor(OPS_AND_K), {});
    const ids = out.exceptions.map((row) => row.entity_id);
    expect(ids.slice(0, 4)).toEqual([11, 12, 13, 14]);
  });

  it('ẩn xanh khỏi exceptions mặc định', async () => {
    const green = candidate({
      leadId: 50,
      ownerId: 3,
      createdAtMs: NOW - 30 * 60_000,
      lastActivityMs: NOW - 10 * 60_000,
    });
    const { svc } = makeSvc({ candidates: [green, s1NoOwner] });
    const out = await svc.buildPayload(actor(OPS_AND_K), {});
    expect(out.exceptions.every((row) => row.severity !== 'ok' as string)).toBe(true);
    expect(out.exceptions.some((row) => row.entity_id === 50)).toBe(false);
    expect(out.columns.find((c) => c.column_id === 'lead_b2')?.ok_count).toBeGreaterThanOrEqual(1);
  });

  it('drop isTowerUatSeed', async () => {
    const seed = candidate({ leadId: 900000901, ownerId: null, createdAtMs: NOW - 5 * H });
    const { svc } = makeSvc({ candidates: [seed, s1NoOwner] });
    const out = await svc.buildPayload(actor(OPS_AND_K), {});
    expect(out.exceptions.some((row) => row.entity_id === 900000901)).toBe(false);
  });

  it('Factory A = b2b_prospect, B = spa_operational', async () => {
    const { svc } = makeSvc({ candidates: [s1NoOwner, spaB] });
    const both = await svc.buildPayload(actor(OPS_AND_K), { factory: 'both' });
    expect(both.exceptions.some((row) => row.factory === 'A' && row.entity_id === 1)).toBe(true);
    expect(both.exceptions.some((row) => row.factory === 'B' && row.entity_id === 200)).toBe(true);

    const onlyA = await svc.buildPayload(actor(OPS_AND_K), { factory: 'A' });
    expect(onlyA.exceptions.every((row) => row.factory === 'A')).toBe(true);
  });

  it('post-won A: một hàng lifecycle, không nhân lead+LC', async () => {
    const leadDup = candidate({
      leadId: 80,
      lifecycleId: null,
      won: true,
      hasLifecycle: false,
      status: 'won',
      lastActivityMs: NOW - D,
    });
    const lc = candidate({
      leadId: 80,
      lifecycleId: 808,
      won: true,
      hasLifecycle: true,
      clientActive: false,
      status: 'won',
      lastActivityMs: NOW - D,
      promoteAtMs: NOW - 15 * D,
    });
    const { svc } = makeSvc({ candidates: [leadDup, lc] });
    const out = await svc.buildPayload(actor(OPS_AND_K), {});
    const rows = out.exceptions.filter((row) => row.entity_id === 808 || (row.entity_type === 'lead' && row.entity_id === 80));
    expect(rows).toHaveLength(1);
    expect(rows[0].entity_type).toBe('lifecycle');
    expect(rows[0].entity_id).toBe(808);
  });

  it('source timeout → degraded, không 500, không bịa k_strip', async () => {
    jest.useFakeTimers();
    const loadCandidates = jest.fn().mockImplementation(() => new Promise(() => undefined));
    const { svc } = makeSvc({ loadCandidates });
    const pending = svc.buildPayload(actor(OPS_AND_K), {});
    await jest.advanceTimersByTimeAsync(2500);
    const out = await pending;
    expect(out.ok).toBe(true);
    expect(out.degraded.some((d) => d.source === 'candidates')).toBe(true);
    expect(out.exceptions).toEqual([]);
    jest.useRealTimers();
  });

  it('limit default 40 max 80; cursor opaque entity_type:id', async () => {
    const many = Array.from({ length: 45 }, (_, i) =>
      candidate({
        leadId: i + 1,
        ownerId: null,
        createdAtMs: NOW - 5 * H - i * 1000,
        lastActivityMs: NOW - 5 * H,
        valueVnd: 1000 - i,
      }),
    );
    const { svc } = makeSvc({ candidates: many });
    const page1 = await svc.buildPayload(actor(OPS_AND_K), {});
    expect(page1.exceptions).toHaveLength(40);
    expect(page1.next_cursor).toMatch(/^lead:\d+$/);

    const page2 = await svc.buildPayload(actor(OPS_AND_K), { cursor: page1.next_cursor! });
    expect(page2.exceptions[0].entity_id).not.toBe(page1.exceptions[0].entity_id);
    expect(page1.exceptions.some((row) => row.entity_id === page2.exceptions[0].entity_id)).toBe(false);

    const capped = await svc.buildPayload(actor(OPS_AND_K), { limit: '999' });
    expect(capped.exceptions).toHaveLength(45);
  });

  it('T1 org_rollup company PTT; omit finance_strip và capacity_top', async () => {
    const { svc } = makeSvc({ candidates: [s1NoOwner] });
    const out = await svc.buildPayload(actor(OPS_AND_K), {});
    expect(out.org_rollup[0]).toMatchObject({ level: 'company', code: 'PTT' });
    expect(out.org_rollup[0].red_count).toBeGreaterThanOrEqual(1);
    expect(out).not.toHaveProperty('finance_strip');
    expect(out).not.toHaveProperty('capacity_top');
    expect(out.window_exception_days).toBe(7);
    expect(out.exceptions[0].title_vi).toMatch(/[A-Za-zÀ-ỹ#]/);
  });

  it('cache theo staffId|factory|dept|team|pos|staff TTL 60s', async () => {
    const loadCandidates = jest.fn().mockResolvedValue([s1NoOwner]);
    const { svc } = makeSvc({ loadCandidates });
    await svc.buildPayload(actor(OPS_AND_K), { factory: 'A', department: 'DEPT-SALES' });
    await svc.buildPayload(actor(OPS_AND_K), { factory: 'A', department: 'DEPT-SALES' });
    expect(loadCandidates).toHaveBeenCalledTimes(1);
    await svc.buildPayload(actor(OPS_AND_K), { factory: 'B', department: 'DEPT-SALES' });
    expect(loadCandidates).toHaveBeenCalledTimes(2);
  });

  it('red/amber cũ hơn 7 ngày vẫn vào hàng chờ', async () => {
    const oldRed = candidate({
      leadId: 99,
      ownerId: null,
      createdAtMs: NOW - 20 * D,
      lastActivityMs: NOW - 20 * D,
    });
    const { svc } = makeSvc({ candidates: [oldRed] });
    const out = await svc.buildPayload(actor(OPS_AND_K), {});
    expect(out.exceptions.some((row) => row.entity_id === 99)).toBe(true);
  });
});
