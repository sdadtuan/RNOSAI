import { UnprocessableEntityException } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { MsosRepository } from './msos.repository';
import { MsosService } from './msos.service';

describe('MsosService discrepancy and make-good', () => {
  const enabledConfig = {
    mediaOsEnabled: true,
    mediaOsReseller: false,
    mediaOsConnectorWrite: false,
  } as AppConfigService;

  const lineId = '00000000-0000-4000-8000-000000000060';
  const dcId = '00000000-0000-4000-8000-000000000100';
  const mgId = '00000000-0000-4000-8000-000000000110';
  const placementId = '00000000-0000-4000-8000-000000000010';

  const makeRepo = (overrides: Partial<MsosRepository> = {}): MsosRepository =>
    ({
      getMediaLine: jest.fn().mockResolvedValue({ id: lineId, package_id: 'pkg1' }),
      getInsertionOrderForLine: jest.fn().mockResolvedValue({ qty: 300 }),
      createDiscrepancyCase: jest.fn(),
      createMakeGood: jest.fn(),
      getMakeGood: jest.fn(),
      reserveMakeGoodCapacity: jest.fn(),
      getCapacityBucket: jest.fn(),
      incrementCapacityReserved: jest.fn(),
      insertReservation: jest.fn(),
      getPartnerStatusForPlacement: jest.fn().mockResolvedValue('approved'),
      insertException: jest.fn(),
      ...overrides,
    }) as unknown as MsosRepository;

  it('creates discrepancy case from report qty', async () => {
    const createDiscrepancyCase = jest.fn().mockResolvedValue({
      id: dcId,
      display_code: 'DC-20260912-A1B2',
      io_qty: 300,
      report_qty: 282,
      material: true,
    });
    const svc = new MsosService(enabledConfig, makeRepo({ createDiscrepancyCase }));
    const out = await svc.createDiscrepancy(lineId, {
      report_qty: 282,
      tolerance_bps: 300,
    });
    expect(out.material).toBe(true);
  });

  it('blocks silent actual on shortfall', async () => {
    const svc = new MsosService(enabledConfig, makeRepo());
    await expect(
      svc.createDiscrepancy(lineId, {
        report_qty: 282,
        actual_qty: 300,
        tolerance_bps: 300,
      }),
    ).rejects.toMatchObject({ response: { error: 'actual_eq_plan_forbidden' } });
  });

  it('creates make-good linked to discrepancy', async () => {
    const createMakeGood = jest.fn().mockResolvedValue({
      id: mgId,
      display_code: 'MG-20260912-A1B2',
      qty: 18,
      capacity_reserved: false,
    });
    const repo = makeRepo({
      getDiscrepancyCase: jest.fn().mockResolvedValue({ id: dcId, media_line_id: lineId }),
      createMakeGood,
    });
    const svc = new MsosService(enabledConfig, repo);
    const out = await svc.createMakeGood(dcId, { qty: 18, value_vnd: 500000, staffId: 9 });
    expect(out.qty).toBe(18);
  });

  it('reserve-capacity hard reserves on different date', async () => {
    const reserveMakeGoodCapacity = jest.fn().mockResolvedValue({
      id: mgId,
      capacity_reserved: true,
    });
    const incrementCapacityReserved = jest.fn();
    const insertReservation = jest.fn();
    const repo = makeRepo({
      getMakeGood: jest.fn().mockResolvedValue({
        id: mgId,
        media_line_id: lineId,
        qty: 18,
        capacity_reserved: false,
      }),
      getPackageLineForLine: jest.fn().mockResolvedValue({ placement_id: placementId }),
      getCapacityBucket: jest.fn().mockResolvedValue({ total: 100, reserved_hard: 10, reserved_soft: 0 }),
      incrementCapacityReserved,
      insertReservation,
      reserveMakeGoodCapacity,
    });
    const svc = new MsosService(enabledConfig, repo);
    const out = await svc.reserveMakeGoodCapacity(mgId, {
      placement_id: placementId,
      bucket_date: '2026-09-20',
    });
    expect(out.capacity_reserved).toBe(true);
    expect(incrementCapacityReserved).toHaveBeenCalled();
  });

  it('reserve-capacity fails on hard overbook', async () => {
    const repo = makeRepo({
      getMakeGood: jest.fn().mockResolvedValue({
        id: mgId,
        media_line_id: lineId,
        qty: 18,
        capacity_reserved: false,
      }),
      getCapacityBucket: jest.fn().mockResolvedValue({ total: 10, reserved_hard: 9, reserved_soft: 0 }),
    });
    const svc = new MsosService(enabledConfig, repo);
    await expect(
      svc.reserveMakeGoodCapacity(mgId, {
        placement_id: placementId,
        bucket_date: '2026-09-20',
      }),
    ).rejects.toMatchObject({ response: { error: 'overbook_hard' } });
  });
});
