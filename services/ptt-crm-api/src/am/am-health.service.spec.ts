import { DEFAULT_WEIGHTS } from './am.types';
import { AmHealthService, HEALTH_SNAPSHOT_UPSERT } from './am-health.service';

const ACTIVE_ID = '19d722af-0000-4000-8000-000000000001';
const CHURNED_ID = '19d722af-0000-4000-8000-000000000099';

describe('AmHealthService', () => {
  const repo = {
    listAccounts: jest.fn(),
    upsertSnapshot: jest.fn(),
    loadWeights: jest.fn(),
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
  });
});
