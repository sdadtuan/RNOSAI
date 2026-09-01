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

function actor(caps: Array<{ section: string; action: string }>, staffId = 9): CeoActor {
  return { staffId, staffLabel: staffId <= 0 ? 'system' : 'ceo', caps };
}

const CEO_VIEW = [{ section: 'ceo_command', action: 'view' }];
const OPS_AND_K = [
  ...CEO_VIEW,
  { section: 'crm_leads', action: 'view' },
  { section: 'crm_board', action: 'view' },
  { section: 'crm_owner_weekly_dashboard', action: 'view' },
];
const OPS_AND_K_FINANCE = [
  ...OPS_AND_K,
  { section: 'crm_business_dashboard', action: 'view' },
];

function makeSvc(opts?: {
  candidates?: TowerCandidate[];
  loadCandidates?: jest.Mock;
  kStrip?: Array<{ key: 'k1' | 'k2' | 'k3' | 'k4'; value: number | null; status: 'green' | 'amber' | 'red' | 'neutral' }>;
  financeMetrics?: Record<string, number>;
  loadFinanceMetrics?: jest.Mock;
  nlQuery?: { runQuery: jest.Mock } | false;
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
    loadFinanceMetrics: opts?.loadFinanceMetrics
      ?? jest.fn().mockResolvedValue(opts?.financeMetrics ?? {
        cash_close: 60_000_000,
        cash_safe_min_vnd: 50_000_000,
        ar_overdue: 20_000_000,
        ar_overdue_max_vnd: 30_000_000,
        gross_margin: 32,
        gross_margin_target_pct: 30,
        top1_share_pct: 35,
        top1_share_max_pct: 40,
      }),
  };
  const nlQuery = opts?.nlQuery === false
    ? undefined
    : (opts?.nlQuery ?? {
      runQuery: jest.fn().mockResolvedValue({
        data: { rows: [{ amount_vnd: 15_000_000 }] },
      }),
    });
  const svc = new CeoTowerSensorService(
    repo as unknown as CeoTowerRepository,
    ownerWeekly as unknown as OwnerWeeklyPgRepository,
    nlQuery as never,
    { nowMs: opts?.nowMs ?? NOW },
  );
  return { svc, repo, ownerWeekly, nlQuery };
}

describe('CeoTowerSensorService.buildPayload', () => {
  it('thiếu crm_leads.view → lead_b2/intake/consult degraded, tower vẫn ok', async () => {
    const intakeRow = candidate({
      leadId: 30,
      b2Done: true,
      b2DoneAtMs: NOW - 6 * H,
      lastActivityMs: NOW - 6 * H,
    });
    const consultRow = candidate({
      leadId: 31,
      b2Done: true,
      intakeGo: true,
      intakeGoAtMs: NOW - 8 * H,
      lastActivityMs: NOW - 8 * H,
    });
    const { svc } = makeSvc({ candidates: [s1NoOwner, intakeRow, consultRow] });
    const out = await svc.buildPayload(actor(CEO_VIEW), {});

    expect(out.ok).toBe(true);
    for (const id of ['lead_b2', 'intake', 'consult'] as const) {
      const col = out.columns.find((c) => c.column_id === id);
      expect(col?.degraded).toEqual({ reason: expect.any(String) });
    }
    expect(out.exceptions.filter((e) =>
      e.column_id === 'lead_b2' || e.column_id === 'intake' || e.column_id === 'consult',
    )).toEqual([]);
  });

  it('staffId 0 không dump unscoped exceptions', async () => {
    const loadCandidates = jest.fn().mockResolvedValue([s1NoOwner, s7OpsOverdue, spaB]);
    const { svc } = makeSvc({ loadCandidates });
    const out = await svc.buildPayload(actor(OPS_AND_K, 0), {});

    expect(out.ok).toBe(true);
    expect(out.exceptions).toEqual([]);
    expect(loadCandidates).not.toHaveBeenCalled();
    expect(out.degraded.some((d) =>
      d.source === 'candidates' || /unresolved|staff/i.test(d.reason),
    )).toBe(true);
  });

  it('thiếu ops cap → S7 degraded; thiếu crm_leads.view → S1 degraded', async () => {
    const { svc } = makeSvc({ candidates: [s1NoOwner, s7OpsOverdue] });
    const out = await svc.buildPayload(actor(CEO_VIEW), {});

    expect(out.ok).toBe(true);
    expect(out.sensors_ok.S7).toBe('degraded');
    expect(out.sensors_ok.S1).toBe('degraded');
    expect(out.exceptions.some((row) => row.sensor_ids.includes('S7'))).toBe(false);
    expect(out.exceptions.some((row) => row.sensor_ids.includes('S1'))).toBe(false);
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

  it('T1 org_rollup company PTT + 6 departments; omit finance_strip và capacity_top', async () => {
    const { svc } = makeSvc({ candidates: [s1NoOwner] });
    const out = await svc.buildPayload(actor(OPS_AND_K), {});
    expect(out.org_rollup[0]).toMatchObject({ level: 'company', code: 'PTT' });
    expect(out.org_rollup[0].red_count).toBeGreaterThanOrEqual(1);
    const departments = out.org_rollup.filter((row) => row.level === 'department');
    expect(departments).toHaveLength(6);
    expect(departments.map((d) => d.code)).toEqual([
      'DEPT-SALES',
      'DEPT-SOLUTION',
      'DEPT-CSKH',
      'DEPT-AGENCY',
      'DEPT-HR',
      'DEPT-IT',
    ]);
    expect(out).not.toHaveProperty('finance_strip');
    expect(out).not.toHaveProperty('capacity_top');
    expect(out.window_exception_days).toBe(7);
    expect(out.exceptions[0].title_vi).toMatch(/[A-Za-zÀ-ỹ#]/);
  });

  it('ceo_command.view + crm_leads.view only → lead_b2 fills; tmmt_deliver missing_board_cap; S5/S6/S8 degraded', async () => {
    const { svc } = makeSvc({ candidates: [s1NoOwner, s7OpsOverdue] });
    const out = await svc.buildPayload(actor([
      ...CEO_VIEW,
      { section: 'crm_leads', action: 'view' },
    ]), {});

    const leadB2 = out.columns.find((c) => c.column_id === 'lead_b2');
    expect(leadB2?.degraded).toBeUndefined();
    expect(leadB2?.red_count).toBeGreaterThanOrEqual(1);
    expect(out.exceptions.some((e) => e.column_id === 'lead_b2' && e.entity_id === 1)).toBe(true);

    expect(out.columns.find((c) => c.column_id === 'tmmt_deliver')?.degraded?.reason).toBe('missing_board_cap');
    expect(out.degraded.some((d) => d.source === 'board' && d.reason === 'missing_board_cap')).toBe(true);
    expect(out.sensors_ok.S5).toBe('degraded');
    expect(out.sensors_ok.S6).toBe('degraded');
    expect(out.sensors_ok.S8).toBe('degraded');
  });

  it('ceo_command.view + crm_board.view only → tmmt_deliver not degraded; lead_b2/intake/consult degraded', async () => {
    const intakeRow = candidate({
      leadId: 30,
      b2Done: true,
      b2DoneAtMs: NOW - 6 * H,
      lastActivityMs: NOW - 6 * H,
    });
    const consultRow = candidate({
      leadId: 31,
      b2Done: true,
      intakeGo: true,
      intakeGoAtMs: NOW - 8 * H,
      lastActivityMs: NOW - 8 * H,
    });
    const { svc } = makeSvc({ candidates: [s1NoOwner, intakeRow, consultRow, s7OpsOverdue] });
    const out = await svc.buildPayload(actor([
      ...CEO_VIEW,
      { section: 'crm_board', action: 'view' },
    ]), {});

    expect(out.columns.find((c) => c.column_id === 'tmmt_deliver')?.degraded).toBeUndefined();
    for (const id of ['lead_b2', 'intake', 'consult'] as const) {
      const col = out.columns.find((c) => c.column_id === id);
      expect(col?.degraded).toEqual({ reason: expect.any(String) });
    }
  });

  it('Owner-Weekly-only: org_rollup red/amber = 0 when all columns degraded', async () => {
    const amberLead = candidate({
      leadId: 14,
      ownerId: null,
      createdAtMs: NOW - 3 * H,
      lastActivityMs: NOW - 3 * H,
      valueVnd: 9_000_000,
    });
    const { svc } = makeSvc({ candidates: [s1NoOwner, amberLead, s7OpsOverdue] });
    const out = await svc.buildPayload(actor([
      { section: 'crm_owner_weekly_dashboard', action: 'view' },
    ]), {});

    expect(out.columns.every((c) => c.degraded)).toBe(true);
    expect(out.org_rollup[0]).toMatchObject({
      level: 'company',
      code: 'PTT',
      red_count: 0,
      amber_count: 0,
    });
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

  it('care row with only signed_on (contractEndInDays null) does not get S10 red', async () => {
    const careSignedOnOnly = candidate({
      leadId: 510,
      lifecycleId: 5100,
      status: 'won',
      won: true,
      hasLifecycle: true,
      clientActive: true,
      retain: true,
      b2Done: true,
      intakeGo: true,
      contractEndInDays: null,
      lastActivityMs: NOW - D,
    });
    const { svc } = makeSvc({ candidates: [careSignedOnOnly] });
    const out = await svc.buildPayload(actor(OPS_AND_K), {});
    expect(out.exceptions.some((row) => row.sensor_ids.includes('S10'))).toBe(false);
    expect(out.sensors_ok.S10).toBe('ok');
  });

  it('care row with ends_on within 30 days gets S10', async () => {
    const careEndingSoon = candidate({
      leadId: 511,
      lifecycleId: 5110,
      status: 'won',
      won: true,
      hasLifecycle: true,
      clientActive: true,
      retain: true,
      b2Done: true,
      intakeGo: true,
      contractEndInDays: 15,
      lastActivityMs: NOW - D,
    });
    const { svc } = makeSvc({ candidates: [careEndingSoon] });
    const out = await svc.buildPayload(actor(OPS_AND_K), {});
    const s10 = out.exceptions.find((row) => row.sensor_ids.includes('S10'));
    expect(s10).toBeDefined();
    expect(s10!.severity).toBe('red');
    expect(out.sensors_ok.S10).toBe('fail');
  });

  it('severity=ok keeps healthy rows as ok, not amber', async () => {
    const green = candidate({
      leadId: 50,
      ownerId: 3,
      createdAtMs: NOW - 30 * 60_000,
      lastActivityMs: NOW - 10 * 60_000,
    });
    const { svc } = makeSvc({ candidates: [green] });
    const out = await svc.buildPayload(actor(OPS_AND_K), { severity: 'ok' });
    const row = out.exceptions.find((r) => r.entity_id === 50);
    expect(row).toBeDefined();
    expect(row!.severity).toBe('ok');
  });

  it('suggest_params includes owner_staff_id/staff_id when owner exists', async () => {
    const { svc } = makeSvc({ candidates: [s1NoOwner, s7OpsOverdue, spaB] });
    const out = await svc.buildPayload(actor(OPS_AND_K), { factory: 'both' });

    const s1 = out.exceptions.find((row) => row.entity_id === 1);
    expect(s1?.suggest_action).toBe('assign_lead');
    expect(s1?.suggest_params).toEqual(
      expect.objectContaining({ lead_id: 1 }),
    );
    expect(s1?.suggest_params).not.toHaveProperty('owner_staff_id');
    expect(s1?.suggest_params).not.toHaveProperty('staff_id');

    const s7 = out.exceptions.find((row) => row.sensor_ids.includes('S7'));
    expect(s7?.suggest_action).toBe('ack_ops_alert');
    expect(s7?.suggest_params).toEqual(
      expect.objectContaining({
        lead_id: 70,
        lifecycle_id: 700,
        alert_id: 88,
        owner_staff_id: 1,
        staff_id: 1,
      }),
    );

    const s9 = out.exceptions.find((row) => row.entity_id === 200);
    expect(s9?.suggest_action).toBe('sla_remind_lead');
    expect(s9?.suggest_params).toEqual(
      expect.objectContaining({
        lead_id: 200,
        owner_staff_id: 1,
        staff_id: 1,
        tier: 'first_call_15m',
        suggested_action: 'log_call',
      }),
    );
  });

  it('S5/S6 sensors_ok degraded when TMMT/QA unwired', async () => {
    const deliverUnwired = candidate({
      leadId: 80,
      lifecycleId: 808,
      status: 'won',
      won: true,
      hasLifecycle: true,
      clientActive: false,
      b2Done: true,
      intakeGo: true,
      lastActivityMs: NOW - D,
      promoteAtMs: NOW - 8 * D,
      tmmtGatePass: false,
      launchQaFail: false,
    });
    const { svc } = makeSvc({ candidates: [s1NoOwner, deliverUnwired] });
    const out = await svc.buildPayload(actor(OPS_AND_K), {});
    expect(out.sensors_ok.S5).toBe('degraded');
    expect(out.sensors_ok.S6).toBe('degraded');
    expect(out.exceptions.some((row) => row.sensor_ids.includes('S5'))).toBe(false);
    expect(out.exceptions.some((row) => row.sensor_ids.includes('S6'))).toBe(false);
  });

  it('passes lead-list visibility + bound to loadCandidates', async () => {
    const scoped = jest.fn().mockResolvedValue([s1NoOwner]);
    const { svc } = makeSvc({ loadCandidates: scoped });
    await svc.buildPayload(actor(OPS_AND_K), {});
    expect(scoped).toHaveBeenCalledWith(
      NOW,
      expect.objectContaining({ staffId: 9, viewAll: false }),
    );

    const viewAll = jest.fn().mockResolvedValue([s1NoOwner]);
    const { svc: svcAll } = makeSvc({ loadCandidates: viewAll });
    await svcAll.buildPayload(actor([
      ...OPS_AND_K,
      { section: 'crm_gdkd', action: 'view_all_leads' },
    ]), {});
    expect(viewAll).toHaveBeenCalledWith(
      NOW,
      expect.objectContaining({ staffId: 9, viewAll: true }),
    );
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

  it('thiếu finance cap → không finance_strip + degraded finance', async () => {
    const { svc, ownerWeekly } = makeSvc({ candidates: [s1NoOwner] });
    const out = await svc.buildPayload(actor(OPS_AND_K), {});

    expect(out.finance_strip).toBeUndefined();
    expect(out.degraded.some((d) => d.source === 'finance' && d.reason === 'missing_cap')).toBe(true);
    expect(out.sensors_ok.S11).toBe('degraded');
    expect(ownerWeekly.loadFinanceMetrics).not.toHaveBeenCalled();
  });

  it('có Owner Weekly + finance cap → finance_strip từ metrics, S11 khi top1 > 40', async () => {
    const { svc } = makeSvc({
      candidates: [s1NoOwner],
      financeMetrics: {
        cash_close: 60_000_000,
        cash_safe_min_vnd: 50_000_000,
        ar_overdue: 20_000_000,
        ar_overdue_max_vnd: 30_000_000,
        gross_margin: 32,
        gross_margin_target_pct: 30,
        top1_share_pct: 55,
        top1_share_max_pct: 40,
      },
    });
    const out = await svc.buildPayload(actor(OPS_AND_K_FINANCE), {});

    expect(out.finance_strip?.length).toBe(5);
    expect(out.finance_strip?.[0]?.key).toBe('cash');
    expect(out.sensors_ok.S11).toBe('fail');
    expect(out.exceptions[0]?.sensor_ids).toContain('S11');
    expect(out.exceptions[0]?.title_vi).toBe('Top-1 khách > 40% DT');
  });
});
