import { UnprocessableEntityException } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { MsosRepository } from './msos.repository';
import { MsosService } from './msos.service';

describe('MsosService capacity', () => {
  const enabledConfig = {
    mediaOsEnabled: true,
    mediaOsReseller: false,
    mediaOsConnectorWrite: false,
  } as AppConfigService;

  it('returns calendar with conflict flag', async () => {
    const days = [
      { date: '2026-09-12', total: 10, reserved_hard: 6, reserved_soft: 5, conflict: true },
    ];
    const insertException = jest.fn().mockResolvedValue(undefined);
    const repo = {
      getPlacementCalendar: jest.fn().mockResolvedValue(days),
      insertException,
    } as unknown as MsosRepository;
    const svc = new MsosService(enabledConfig, repo);
    const out = await svc.getPlacementCalendar('pl1', '2026-09-12', '2026-09-12');
    expect(out[0].conflict).toBe(true);
    expect(insertException).toHaveBeenCalledWith(
      expect.objectContaining({ priority: 'P0', kind: 'capacity_conflict', placement_id: 'pl1' }),
    );
  });

  it('soft conflict creates P0 exception but allows reserve', async () => {
    const insertException = jest.fn().mockResolvedValue(undefined);
    const repo = {
      getPartnerStatusForPlacement: jest.fn().mockResolvedValue('approved'),
      insertException,
    } as unknown as MsosRepository;
    const svc = new MsosService(enabledConfig, repo);
    const out = await svc.evaluateSoftReserve({
      placementId: 'pl1',
      total: 10,
      reservedHard: 8,
      reservedSoft: 2,
      addQty: 1,
    });
    expect(out).toEqual({ ok: true, kind: 'soft', conflict: true });
    expect(insertException).toHaveBeenCalledWith(
      expect.objectContaining({ priority: 'P0', kind: 'capacity_conflict' }),
    );
  });

  it('hard overbook throws overbook_hard', async () => {
    const repo = {
      getPartnerStatusForPlacement: jest.fn().mockResolvedValue('approved'),
    } as unknown as MsosRepository;
    const svc = new MsosService(enabledConfig, repo);
    await expect(
      svc.evaluateHardReserve({
        placementId: 'pl1',
        total: 10,
        reservedHard: 9,
        reservedSoft: 0,
        addQty: 2,
      }),
    ).rejects.toMatchObject({ response: { error: 'overbook_hard' } });
  });

  it('partner suspended throws partner_suspended', async () => {
    const repo = {
      getPartnerStatusForPlacement: jest.fn().mockResolvedValue('suspended'),
    } as unknown as MsosRepository;
    const svc = new MsosService(enabledConfig, repo);
    await expect(
      svc.evaluateHardReserve({
        placementId: 'pl1',
        total: 10,
        reservedHard: 0,
        reservedSoft: 0,
        addQty: 1,
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('setPlacementCapacity upserts buckets and syncs conflicts', async () => {
    const upsertCapacityBuckets = jest.fn().mockResolvedValue(undefined);
    const getPlacementCalendar = jest.fn().mockResolvedValue([
      { date: '2026-09-12', total: 5, reserved_hard: 6, reserved_soft: 0, conflict: true },
    ]);
    const insertException = jest.fn().mockResolvedValue(undefined);
    const repo = {
      upsertCapacityBuckets,
      getPlacementCalendar,
      insertException,
    } as unknown as MsosRepository;
    const svc = new MsosService(enabledConfig, repo);
    await svc.setPlacementCapacity('pl1', [{ date: '2026-09-12', total_qty: 5 }]);
    expect(upsertCapacityBuckets).toHaveBeenCalled();
    expect(insertException).toHaveBeenCalled();
  });
});
