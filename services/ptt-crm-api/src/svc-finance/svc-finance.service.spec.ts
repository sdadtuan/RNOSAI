import { MODULE_METADATA } from '@nestjs/common/constants';
import { SvcFinanceModule } from './svc-finance.module';
import { SvcFinancePgRepository } from './svc-finance-pg.repository';
import { SvcFinanceService } from './svc-finance.service';

describe('SvcFinanceService PostgreSQL-only wiring', () => {
  const pg = {
    lifecycleExists: jest.fn(),
    contractAmountVnd: jest.fn(),
    getSummary: jest.fn(),
    listPayments: jest.fn(),
    createPayment: jest.fn(),
    patchPayment: jest.fn(),
    deletePayment: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('serves lifecycle billing from PostgreSQL', async () => {
    pg.lifecycleExists.mockResolvedValue(true);
    pg.contractAmountVnd.mockResolvedValue(5_000_000);
    pg.getSummary.mockResolvedValue({ lifecycle_id: 12 });
    pg.listPayments.mockResolvedValue([{ id: 21 }]);
    pg.createPayment.mockResolvedValue({ id: 22 });
    pg.patchPayment.mockResolvedValue({ id: 22, notes: 'updated' });
    pg.deletePayment.mockResolvedValue(true);
    const service = new SvcFinanceService(pg as unknown as SvcFinancePgRepository);

    await expect(service.summary(12)).resolves.toEqual({ lifecycle_id: 12 });
    await expect(service.listPayments(12)).resolves.toEqual({ payments: [{ id: 21 }] });
    await expect(
      service.createPayment({
        lifecycle_id: 12,
        amount_vnd: 1_000_000,
        received_on: '2026-08-27',
      }),
    ).resolves.toEqual({ id: 22 });
    await expect(service.patchPayment(22, { notes: 'updated' })).resolves.toEqual({
      id: 22,
      notes: 'updated',
    });
    await expect(service.deletePayment(22)).resolves.toEqual({ ok: true });

    expect(pg.lifecycleExists).toHaveBeenCalledTimes(3);
    expect(pg.contractAmountVnd).toHaveBeenCalledWith(12);
    expect(pg.getSummary).toHaveBeenCalledWith(12, 5_000_000);
    expect(pg.listPayments).toHaveBeenCalledWith(12);
    expect(pg.createPayment).toHaveBeenCalledWith({
      lifecycle_id: 12,
      amount_vnd: 1_000_000,
      received_on: '2026-08-27',
    });
    expect(pg.patchPayment).toHaveBeenCalledWith(22, { notes: 'updated' });
    expect(pg.deletePayment).toHaveBeenCalledWith(22);
  });

  it('registers only the PostgreSQL service-finance repository', () => {
    const providers = Reflect.getMetadata(
      MODULE_METADATA.PROVIDERS,
      SvcFinanceModule,
    ) as unknown[];

    expect(providers).toContain(SvcFinancePgRepository);
    expect(providers.map((provider) => String(provider))).not.toEqual(
      expect.arrayContaining([expect.stringContaining('SvcFinanceSqliteRepository')]),
    );
  });
});
