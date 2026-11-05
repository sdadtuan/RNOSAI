import { ForbiddenException, UnprocessableEntityException } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { MsosRepository } from './msos.repository';
import { MsosService } from './msos.service';

describe('MsosService media lines', () => {
  const enabledConfig = {
    mediaOsEnabled: true,
    mediaOsReseller: false,
    mediaOsConnectorWrite: false,
  } as AppConfigService;

  const clientId = '00000000-0000-4000-8000-000000000001';
  const packageId = '00000000-0000-4000-8000-000000000030';
  const ioId = '00000000-0000-4000-8000-000000000040';
  const lineId = '00000000-0000-4000-8000-000000000060';

  const makeRepo = (overrides: Partial<MsosRepository> = {}): MsosRepository =>
    ({
      db: {
        query: jest.fn().mockImplementation(async (sql: string) => {
          if (/FROM clients/i.test(sql)) return { rows: [{ id: clientId }] };
          return { rows: [] };
        }),
      },
      listMediaLines: jest.fn().mockResolvedValue([]),
      createMediaLine: jest.fn(),
      getMediaLine: jest.fn(),
      getInsertionOrder: jest.fn(),
      getRateVersionById: jest.fn(),
      hasValidReserve: jest.fn(),
      getTrafficPack: jest.fn(),
      setMediaLineLive: jest.fn(),
      setP03Override: jest.fn(),
      ...overrides,
    }) as unknown as MsosRepository;

  it('lists empty media lines', async () => {
    const svc = new MsosService(enabledConfig, makeRepo());
    expect(await svc.listMediaLines()).toEqual([]);
  });

  it('creates media line linked to package and IO', async () => {
    const row = {
      id: lineId,
      display_code: 'ML-20260912-A1B2',
      package_id: packageId,
      io_id: ioId,
      client_id: clientId,
      status: 'draft',
    };
    const createMediaLine = jest.fn().mockResolvedValue(row);
    const repo = makeRepo({
      getPackage: jest.fn().mockResolvedValue({ id: packageId, client_id: clientId }),
      getInsertionOrder: jest.fn().mockResolvedValue({ id: ioId, package_id: packageId, client_id: clientId }),
      createMediaLine,
    });
    const svc = new MsosService(enabledConfig, repo);
    const out = await svc.createMediaLine({
      package_id: packageId,
      io_id: ioId,
      tracking_owner_staff_id: 9,
    });
    expect(out.display_code).toMatch(/^ML-\d{8}-[A-F0-9]{4}$/);
  });

  it('live requires human confirm', async () => {
    const repo = makeRepo({
      getMediaLine: jest.fn().mockResolvedValue({ id: lineId, status: 'ready' }),
    });
    const svc = new MsosService(enabledConfig, repo);
    await expect(
      svc.goLive(lineId, { confirm: false, actor: 'human' }, 9),
    ).rejects.toMatchObject({ response: { error: 'human_confirm_required' } });
  });

  it('live forbids AI actor', async () => {
    const repo = makeRepo({
      getMediaLine: jest.fn().mockResolvedValue({ id: lineId, status: 'ready' }),
    });
    const svc = new MsosService(enabledConfig, repo);
    await expect(
      svc.goLive(lineId, { confirm: true, actor: 'ai' }, null),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      svc.goLive(lineId, { confirm: true, actor: 'ai' }, null),
    ).rejects.toMatchObject({ response: { error: 'ai_action_forbidden' } });
  });

  it('live succeeds when gates pass', async () => {
    const setMediaLineLive = jest.fn().mockResolvedValue({
      id: lineId,
      status: 'live',
      live_at: '2026-09-12T00:00:00Z',
    });
    const repo = makeRepo({
      getMediaLine: jest.fn().mockResolvedValue({
        id: lineId,
        package_id: packageId,
        io_id: ioId,
        client_id: clientId,
        status: 'ready',
        tracking_owner_staff_id: 9,
        p03_override_by: null,
      }),
      getInsertionOrder: jest.fn().mockResolvedValue({
        id: ioId,
        package_id: packageId,
        client_id: clientId,
        rate_version_id: 'rv1',
        safety_snapshot_id: 'snap1',
        status: 'issued',
        partner_confirmed_at: '2026-09-12T00:00:00Z',
      }),
      getRateVersionById: jest.fn().mockResolvedValue({ status: 'published' }),
      hasValidReserve: jest.fn().mockResolvedValue(true),
      getTrafficPack: jest.fn().mockResolvedValue({
        status: 'approved_by_partner',
        creative_id: 'c1',
        width_px: 300,
        height_px: 250,
        weight_kb: 100,
        click_url: 'https://example.com',
        backup_attached: true,
      }),
      getPlacementForLine: jest.fn().mockResolvedValue({ backup_required: false, max_weight_kb: 200 }),
      setMediaLineLive,
    });
    const svc = new MsosService(enabledConfig, repo);
    const out = await svc.goLive(lineId, { confirm: true, actor: 'human' }, 9);
    expect(out.status).toBe('live');
    expect(setMediaLineLive).toHaveBeenCalledWith(lineId, 9);
  });

  it('p03 override records staff and timestamp', async () => {
    const setP03Override = jest.fn().mockResolvedValue({
      id: lineId,
      p03_override_by: 9,
    });
    const repo = makeRepo({
      getMediaLine: jest.fn().mockResolvedValue({ id: lineId }),
      setP03Override,
    });
    const svc = new MsosService(enabledConfig, repo);
    await svc.setP03Override(lineId, 9);
    expect(setP03Override).toHaveBeenCalledWith(lineId, 9);
  });

  it('getLiveGates returns gate checklist', async () => {
    const repo = makeRepo({
      getMediaLine: jest.fn().mockResolvedValue({
        id: lineId,
        package_id: packageId,
        io_id: ioId,
        client_id: clientId,
        tracking_owner_staff_id: 9,
        p03_override_by: null,
      }),
      getInsertionOrder: jest.fn().mockResolvedValue({
        id: ioId,
        package_id: packageId,
        client_id: clientId,
        rate_version_id: 'rv1',
        safety_snapshot_id: 'snap1',
        status: 'issued',
        partner_confirmed_at: null,
      }),
      getRateVersionById: jest.fn().mockResolvedValue({ status: 'published' }),
      hasValidReserve: jest.fn().mockResolvedValue(true),
      getTrafficPack: jest.fn().mockResolvedValue({ status: 'draft' }),
      getPlacementForLine: jest.fn().mockResolvedValue({ backup_required: false, max_weight_kb: null }),
    });
    const svc = new MsosService(enabledConfig, repo);
    const out = await svc.getLiveGates(lineId);
    expect(out.canLive).toBe(false);
    expect(out.gates.length).toBeGreaterThan(0);
  });
});
