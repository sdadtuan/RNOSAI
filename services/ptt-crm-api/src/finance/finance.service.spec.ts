import { MODULE_METADATA } from '@nestjs/common/constants';
import { FinanceModule } from './finance.module';
import { FinancePgRepository } from './finance-pg.repository';
import { FinanceService } from './finance.service';

describe('FinanceService PostgreSQL-only wiring', () => {
  const pg = {
    businessDashboard: jest.fn(),
    financials: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('delegates financials directly to FinancePgRepository', async () => {
    pg.financials.mockResolvedValue({ year: 2026, month: 8, rows: [] });
    const service = new FinanceService(pg as unknown as FinancePgRepository);

    await expect(service.financials('2026', '8')).resolves.toEqual({
      year: 2026,
      month: 8,
      rows: [],
    });
    expect(pg.financials).toHaveBeenCalledWith(2026, 8);
  });

  it('delegates business dashboard directly to FinancePgRepository', async () => {
    pg.businessDashboard.mockResolvedValue({ year: 2026, month: 8 });
    const service = new FinanceService(pg as unknown as FinancePgRepository);

    await service.businessDashboard('2026', '8', '9');

    expect(pg.businessDashboard).toHaveBeenCalledWith(2026, 8, 9);
  });

  it('registers only the PostgreSQL finance repository', () => {
    const providers = Reflect.getMetadata(MODULE_METADATA.PROVIDERS, FinanceModule) as unknown[];

    expect(providers).toContain(FinancePgRepository);
    expect(providers.map((provider) => String(provider))).not.toEqual(
      expect.arrayContaining([expect.stringContaining('FinanceSqliteRepository')]),
    );
  });
});
