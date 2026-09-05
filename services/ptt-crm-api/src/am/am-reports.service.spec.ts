import { AmReportsService } from './am-reports.service';

const FROM = '2026-01-01';
const TO = '2026-09-05';

describe('AmReportsService', () => {
  const repo = {
    loadBook: jest.fn(),
    loadWonExpandOpps: jest.fn(),
    loadLostRenewals: jest.fn(),
    loadForecast: jest.fn(),
    loadFreshnessAsOf: jest.fn(),
    loadTeamIds: jest.fn(),
  };
  const staffAuth = {
    resolveCrmStaffUserId: jest.fn(),
    me: jest.fn(),
    hasCap: jest.fn(),
  };

  let service: AmReportsService;

  beforeEach(() => {
    jest.clearAllMocks();
    staffAuth.resolveCrmStaffUserId.mockResolvedValue(1);
    staffAuth.me.mockResolvedValue({ caps: [{ section: 'crm_am', action: 'view_all' }] });
    staffAuth.hasCap.mockReturnValue(true);
    repo.loadWonExpandOpps.mockResolvedValue([]);
    repo.loadLostRenewals.mockResolvedValue([]);
    repo.loadForecast.mockResolvedValue([]);
    repo.loadFreshnessAsOf.mockResolvedValue(null);
    repo.loadTeamIds.mockResolvedValue([]);
    service = new AmReportsService(repo as never, staffAuth as never);
  });

  it('excludes media billing from Start in a mocked query', async () => {
    repo.loadBook.mockResolvedValue([
      {
        agency_client_id: '19d722af-0000-4000-8000-000000000001',
        owner_staff_id: 1,
        am_status: 'active',
        churned_at: null,
        churn_reason: null,
        contracts: [
          {
            billing_type: 'media',
            amount_vnd: 50_000_000,
            starts_on: '2025-01-01',
            ends_on: null,
            status: 'active',
          },
          {
            billing_type: 'monthly',
            amount_vnd: 100,
            starts_on: '2025-01-01',
            ends_on: null,
            status: 'active',
          },
        ],
      },
    ]);

    const out = await service.retention(
      { staffUser: { sub: 'u' } as never, staffAuthVia: 'jwt' },
      { from: FROM, to: TO, scope: 'all' },
    );

    expect(out.kpis.grr).toBe(1);
    expect(out.kpis.nrr).toBeNull();
    expect(out.nrr_hidden).toBe(true);
    expect(out.kpis.churned_mrr).toBeNull();
    expect(out.kpis.expansion_mrr).toBeNull();
    expect(out.kpis.logo).toBe(1);
    expect(out.formulas.grr).toContain('GRR');
  });
});
