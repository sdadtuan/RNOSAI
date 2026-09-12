import { UnprocessableEntityException } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { MsosRepository } from './msos.repository';
import { MsosService } from './msos.service';

describe('MsosService packages', () => {
  const enabledConfig = {
    mediaOsEnabled: true,
    mediaOsReseller: false,
    mediaOsConnectorWrite: false,
  } as AppConfigService;

  const clientId = '00000000-0000-4000-8000-000000000001';
  const placementId = '00000000-0000-4000-8000-000000000010';
  const rateVersionId = '00000000-0000-4000-8000-000000000020';

  const makeRepo = (overrides: Partial<MsosRepository> = {}): MsosRepository =>
    ({
      db: {
        query: jest.fn().mockImplementation(async (sql: string) => {
          if (/FROM clients/i.test(sql)) return { rows: [{ id: clientId }] };
          return { rows: [] };
        }),
      },
      listPackages: jest.fn().mockResolvedValue([]),
      getRateVersionById: jest.fn().mockResolvedValue({
        id: rateVersionId,
        status: 'published',
        unit_price_vnd: 1000000,
      }),
      createPackage: jest.fn(),
      getPackage: jest.fn(),
      getCapacityBucket: jest.fn(),
      insertReservation: jest.fn(),
      incrementCapacityReserved: jest.fn(),
      getPartnerStatusForPlacement: jest.fn().mockResolvedValue('approved'),
      insertException: jest.fn(),
      ...overrides,
    }) as unknown as MsosRepository;

  it('lists empty packages', async () => {
    const svc = new MsosService(enabledConfig, makeRepo());
    expect(await svc.listPackages()).toEqual([]);
  });

  it('422 when client missing on create', async () => {
    const repo = makeRepo({
      db: {
        query: jest.fn().mockResolvedValue({ rows: [] }),
      } as never,
    });
    const svc = new MsosService(enabledConfig, repo);
    await expect(
      svc.createPackage({
        client_id: clientId,
        lines: [
          {
            placement_id: placementId,
            rate_version_id: rateVersionId,
            qty: 1,
            period_start: '2026-09-12',
            period_end: '2026-09-12',
          },
        ],
      }),
    ).rejects.toMatchObject({ response: { error: 'client_not_found' } });
  });

  it('forces hide_buy_side false when reseller off', async () => {
    const pkg = {
      id: 'pkg1',
      display_code: 'PKG-20260912-A1B2',
      client_id: clientId,
      commercial_ref: null,
      sell_vnd: 1000000,
      hide_buy_side: false,
      created_at: '2026-09-12T00:00:00Z',
      created_by: 9,
      lines: [],
    };
    const createPackage = jest.fn().mockResolvedValue(pkg);
    const svc = new MsosService(enabledConfig, makeRepo({ createPackage }));
    const out = await svc.createPackage({
      client_id: clientId,
      hide_buy_side: true,
      lines: [
        {
          placement_id: placementId,
          rate_version_id: rateVersionId,
          qty: 1,
          period_start: '2026-09-12',
          period_end: '2026-09-12',
        },
      ],
      staffId: 9,
    });
    expect(out.hide_buy_side).toBe(false);
    expect(createPackage).toHaveBeenCalledWith(
      expect.objectContaining({ hide_buy_side: false }),
    );
  });

  it('rejects unpublished rate on create', async () => {
    const repo = makeRepo({
      getRateVersionById: jest.fn().mockResolvedValue({
        id: rateVersionId,
        status: 'draft',
        unit_price_vnd: 1000000,
      }),
    });
    const svc = new MsosService(enabledConfig, repo);
    await expect(
      svc.createPackage({
        client_id: clientId,
        lines: [
          {
            placement_id: placementId,
            rate_version_id: rateVersionId,
            qty: 1,
            period_start: '2026-09-12',
            period_end: '2026-09-12',
          },
        ],
      }),
    ).rejects.toMatchObject({ response: { error: 'rate_not_published' } });
  });

  it('soft reserve sets 24h expiry and allows conflict with P0', async () => {
    const insertReservation = jest.fn().mockResolvedValue({
      id: 'rsv1',
      kind: 'soft',
      expires_at: '2026-09-13T00:00:00Z',
    });
    const insertException = jest.fn().mockResolvedValue(undefined);
    const repo = makeRepo({
      getPackage: jest.fn().mockResolvedValue({ id: 'pkg1' }),
      getCapacityBucket: jest.fn().mockResolvedValue({
        total: 10,
        reserved_hard: 8,
        reserved_soft: 2,
      }),
      insertReservation,
      incrementCapacityReserved: jest.fn(),
      insertException,
    });
    const svc = new MsosService(enabledConfig, repo);
    const out = await svc.reservePackage('pkg1', {
      placement_id: placementId,
      bucket_date: '2026-09-12',
      kind: 'soft',
      qty: 1,
    });
    expect(out.kind).toBe('soft');
    expect(insertReservation).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'soft',
        expires_at: expect.any(String),
      }),
    );
    expect(insertException).toHaveBeenCalledWith(
      expect.objectContaining({ priority: 'P0', kind: 'capacity_conflict' }),
    );
  });

  it('hard overbook throws overbook_hard', async () => {
    const repo = makeRepo({
      getPackage: jest.fn().mockResolvedValue({ id: 'pkg1' }),
      getCapacityBucket: jest.fn().mockResolvedValue({
        total: 10,
        reserved_hard: 9,
        reserved_soft: 0,
      }),
    });
    const svc = new MsosService(enabledConfig, repo);
    await expect(
      svc.reservePackage('pkg1', {
        placement_id: placementId,
        bucket_date: '2026-09-12',
        kind: 'hard',
        qty: 2,
      }),
    ).rejects.toMatchObject({ response: { error: 'overbook_hard' } });
  });

  it('hard reserve succeeds and increments reserved_hard', async () => {
    const incrementCapacityReserved = jest.fn().mockResolvedValue(undefined);
    const insertReservation = jest.fn().mockResolvedValue({ id: 'rsv1', kind: 'hard' });
    const repo = makeRepo({
      getPackage: jest.fn().mockResolvedValue({ id: 'pkg1' }),
      getCapacityBucket: jest.fn().mockResolvedValue({
        total: 10,
        reserved_hard: 5,
        reserved_soft: 0,
      }),
      insertReservation,
      incrementCapacityReserved,
    });
    const svc = new MsosService(enabledConfig, repo);
    await svc.reservePackage('pkg1', {
      placement_id: placementId,
      bucket_date: '2026-09-12',
      kind: 'hard',
      qty: 3,
    });
    expect(incrementCapacityReserved).toHaveBeenCalledWith(
      placementId,
      '2026-09-12',
      'hard',
      3,
    );
  });
});
