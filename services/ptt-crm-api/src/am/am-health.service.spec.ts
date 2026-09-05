import { DEFAULT_WEIGHTS } from './am.types';
import { AM_TENANT_ID } from './am-audit.repository';
import { AmHealthRepository, AmHealthService, HEALTH_SNAPSHOT_UPSERT } from './am-health.service';

const ACTIVE_ID = '19d722af-0000-4000-8000-000000000001';
const CHURNED_ID = '19d722af-0000-4000-8000-000000000099';
const ICT = 'Asia/Ho_Chi_Minh';

function ictYmd(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ICT,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

function addDaysYmd(ymd: string, days: number): string {
  const [year, month, day] = ymd.split('-').map((part) => Number(part));
  const dt = new Date(Date.UTC(year || 1970, (month || 1) - 1, (day || 1) + days));
  return dt.toISOString().slice(0, 10);
}

describe('AmHealthService', () => {
  const repo = {
    listAccounts: jest.fn(),
    upsertSnapshot: jest.fn(),
    loadWeights: jest.fn(),
    applyOverride: jest.fn(),
    findAccount: jest.fn(),
  };
  const audit = { insert: jest.fn() };
  const dashboard = { dropCache: jest.fn() };

  let service: AmHealthService;

  beforeEach(() => {
    jest.clearAllMocks();
    repo.loadWeights.mockResolvedValue({ ...DEFAULT_WEIGHTS });
    repo.upsertSnapshot.mockResolvedValue(undefined);
    service = new AmHealthService(repo as never, audit as never, dashboard as never);
  });

  it('uses weights 30/20/20/15/15 and scores 72 as watch', async () => {
    expect(DEFAULT_WEIGHTS).toEqual({
      kpi_delivery: 30,
      engagement: 20,
      financial: 20,
      satisfaction: 15,
      contract_support: 15,
    });
    repo.listAccounts.mockResolvedValue([
      {
        agency_client_id: ACTIVE_ID,
        am_status: 'active',
        created_at: '2025-01-01T00:00:00.000Z',
        has_active_contract: true,
        csd_breached: false,
      },
    ]);

    const out = await service.recompute({ asOf: '2026-09-05' });

    expect(out.as_of).toBe('2026-09-05');
    expect(out.computed).toBe(1);
    expect(repo.upsertSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        agency_client_id: ACTIVE_ID,
        as_of: '2026-09-05',
        score: 72,
        band: 'watch',
        thin_data: true,
        components: {
          kpi_delivery: 70,
          engagement: 70,
          financial: 80,
          satisfaction: 70,
          contract_support: 70,
        },
      }),
    );
    expect(out.dist).toEqual({
      healthy: 0,
      watch: 1,
      at_risk: 0,
      critical: 0,
      avg: 72,
    });
  });

  it('excludes churned clients from snapshots and dist', async () => {
    repo.listAccounts.mockResolvedValue([
      {
        agency_client_id: ACTIVE_ID,
        am_status: 'active',
        created_at: '2025-01-01T00:00:00.000Z',
        has_active_contract: true,
        csd_breached: false,
      },
      {
        agency_client_id: CHURNED_ID,
        am_status: 'churned',
        created_at: '2024-01-01T00:00:00.000Z',
        has_active_contract: false,
        csd_breached: true,
      },
    ]);

    const out = await service.recompute({ asOf: '2026-09-05' });

    expect(out.computed).toBe(1);
    expect(out.skipped).toBe(1);
    expect(repo.upsertSnapshot).toHaveBeenCalledTimes(1);
    expect(repo.upsertSnapshot.mock.calls[0][0].agency_client_id).toBe(ACTIVE_ID);
    expect(out.dist).toEqual({
      healthy: 0,
      watch: 1,
      at_risk: 0,
      critical: 0,
      avg: 72,
    });
  });

  it('upserts snapshots on conflict of tenant, client, and as_of', () => {
    expect(HEALTH_SNAPSHOT_UPSERT).toMatch(
      /ON CONFLICT\s*\(\s*tenant_id\s*,\s*agency_client_id\s*,\s*as_of\s*\)/i,
    );
    expect(HEALTH_SNAPSHOT_UPSERT).not.toMatch(
      /DO UPDATE SET[\s\S]*scorecard_version\s*=\s*EXCLUDED\.scorecard_version/i,
    );
  });

  it('copies an active override onto a new as_of INSERT and does not overwrite scorecard_version', async () => {
    const today = ictYmd();
    const until = addDaysYmd(today, 7);
    const asOf = today;
    const query = jest.fn();
    query.mockImplementation(async (sql: string) => {
      if (/select/i.test(sql) && /crm_am_health_snapshots/i.test(sql)) {
        return {
          rows: [
            {
              as_of: addDaysYmd(today, -1),
              override_band: 'watch',
              override_reason: 'temp hold',
              override_until: until,
            },
          ],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 1 };
    });
    const store = new AmHealthRepository({ databaseUrl: 'postgres://x' } as never);
    (store as unknown as { pool: { query: typeof query } }).pool = { query };

    await store.upsertSnapshot({
      agency_client_id: ACTIVE_ID,
      as_of: asOf,
      score: 72,
      band: 'watch',
      components: {
        kpi_delivery: 70,
        engagement: 70,
        financial: 80,
        satisfaction: 70,
        contract_support: 70,
      },
      scorecard_version: 2,
      thin_data: true,
    });

    const insert = query.mock.calls.find(([sql]) =>
      /insert\s+into\s+crm_am_health_snapshots/i.test(String(sql)),
    ) as [string, unknown[]] | undefined;
    expect(insert).toBeDefined();
    expect(insert![0]).toMatch(/override_band/i);
    expect(insert![0]).toMatch(/override_reason/i);
    expect(insert![0]).toMatch(/override_until/i);
    expect(insert![0]).not.toMatch(
      /DO UPDATE SET[\s\S]*scorecard_version\s*=\s*EXCLUDED\.scorecard_version/i,
    );
    expect(insert![1]).toEqual(
      expect.arrayContaining([AM_TENANT_ID, ACTIVE_ID, asOf, 'watch', 'temp hold', until]),
    );
  });

  it('rejects override until today+31 ICT with 400 override_until_invalid and does not write', async () => {
    const until = addDaysYmd(ictYmd(), 31);
    await expect(
      service.override(
        { staffUser: { sub: '7' }, staffAuthVia: 'jwt' } as never,
        ACTIVE_ID,
        { band: 'watch', reason: 'temp hold', until },
        7,
      ),
    ).rejects.toMatchObject({ status: 400, error: 'override_until_invalid' });
    expect(repo.upsertSnapshot).not.toHaveBeenCalled();
    expect(repo.applyOverride).not.toHaveBeenCalled();
  });
});

const CENTER_A = '19d722af-0000-4000-8000-000000000001';
const CENTER_B = '19d722af-0000-4000-8000-000000000002';
const CENTER_C = '19d722af-0000-4000-8000-000000000003';
const CENTER_D = '19d722af-0000-4000-8000-000000000004';

describe('AmHealthService center', () => {
  const repo = {
    listAccounts: jest.fn(),
    upsertSnapshot: jest.fn(),
    loadWeights: jest.fn(),
    applyOverride: jest.fn(),
    findAccount: jest.fn(),
    loadCenterRows: jest.fn(),
    loadSparkline: jest.fn(),
    countOpenRisks: jest.fn(),
    loadTeamIds: jest.fn(),
    loadDetail: jest.fn(),
    loadTrend: jest.fn(),
  };
  const audit = { insert: jest.fn() };
  const dashboard = { dropCache: jest.fn() };
  const staffAuth = {
    resolveCrmStaffUserId: jest.fn(async () => 7),
    me: jest.fn(async () => ({
      caps: [
        { section: 'crm_am', action: 'view' },
        { section: 'crm_am', action: 'view_all' },
        { section: 'crm_am.finance', action: 'view' },
      ],
    })),
    hasCap: jest.fn((caps: Array<{ section: string; action: string }>, section: string, action: string) =>
      caps.some((c) => c.section === section && c.action === action),
    ),
  };
  const req = {
    staffUser: { sub: '7' },
    staffAuthVia: 'jwt' as const,
  } as never;

  let service: AmHealthService;

  beforeEach(() => {
    jest.clearAllMocks();
    repo.loadTeamIds.mockResolvedValue([]);
    repo.loadSparkline.mockResolvedValue([]);
    repo.countOpenRisks.mockResolvedValue(0);
    service = new AmHealthService(
      repo as never,
      audit as never,
      dashboard as never,
      undefined,
      staffAuth as never,
    );
  });

  it('center tiles has exactly four band keys plus money and open risks', async () => {
    repo.loadCenterRows.mockResolvedValue([
      {
        agency_client_id: CENTER_A,
        name: 'Healthy Co',
        am_status: 'active',
        score: 90,
        band: 'healthy',
        override_band: null,
        override_until: null,
        owner_label: 'Minh',
        open_risks: 0,
        recovery_status: null,
        prior_score: 88,
        mrr_vnd: 10_000_000,
      },
      {
        agency_client_id: CENTER_B,
        name: 'Watch Co',
        am_status: 'active',
        score: 70,
        band: 'watch',
        override_band: null,
        override_until: null,
        owner_label: 'Anh',
        open_risks: 0,
        recovery_status: null,
        prior_score: 72,
        mrr_vnd: 20_000_000,
      },
      {
        agency_client_id: CENTER_C,
        name: 'Risk Co',
        am_status: 'active',
        score: 50,
        band: 'at_risk',
        override_band: null,
        override_until: null,
        owner_label: 'Hương',
        open_risks: 1,
        recovery_status: 'open',
        prior_score: 60,
        mrr_vnd: 30_000_000,
      },
      {
        agency_client_id: CENTER_D,
        name: 'Crit Co',
        am_status: 'active',
        score: 20,
        band: 'critical',
        override_band: null,
        override_until: null,
        owner_label: 'Lan',
        open_risks: 2,
        recovery_status: 'open',
        prior_score: 40,
        mrr_vnd: 40_000_000,
      },
    ]);
    repo.countOpenRisks.mockResolvedValue(3);

    const out = await service.center(req, { scope: 'all' });

    expect(Object.keys(out.tiles)).toEqual([
      'healthy',
      'watch',
      'at_risk',
      'critical',
      'revenue_at_risk_vnd',
      'open_risks',
    ]);
    expect(out.tiles).not.toHaveProperty('churned');
    expect(out.tiles.healthy).toBe(1);
    expect(out.tiles.watch).toBe(1);
    expect(out.tiles.at_risk).toBe(1);
    expect(out.tiles.critical).toBe(1);
    expect(out.tiles.open_risks).toBe(3);
    expect(out.tiles.revenue_at_risk_vnd).toBe(70_000_000);
  });

  it('does not count a churned account in any band tile', async () => {
    repo.loadCenterRows.mockResolvedValue([
      {
        agency_client_id: CENTER_A,
        name: 'Healthy Co',
        am_status: 'active',
        score: 90,
        band: 'healthy',
        override_band: null,
        override_until: null,
        owner_label: 'Minh',
        open_risks: 0,
        recovery_status: null,
        prior_score: null,
        mrr_vnd: 10_000_000,
      },
      {
        agency_client_id: CHURNED_ID,
        name: 'Gone Co',
        am_status: 'churned',
        score: 10,
        band: 'critical',
        override_band: null,
        override_until: null,
        owner_label: 'Minh',
        open_risks: 9,
        recovery_status: null,
        prior_score: 12,
        mrr_vnd: 999_000_000,
      },
    ]);
    repo.countOpenRisks.mockResolvedValue(0);

    const out = await service.center(req, { scope: 'all' });

    expect(out.tiles.healthy).toBe(1);
    expect(out.tiles.watch).toBe(0);
    expect(out.tiles.at_risk).toBe(0);
    expect(out.tiles.critical).toBe(0);
    expect(out.tiles.revenue_at_risk_vnd).toBeNull();
    expect(out.risky).toEqual([]);
    expect(out.risky.some((row) => row.agency_client_id === CHURNED_ID)).toBe(false);
  });
});

