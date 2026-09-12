import { UnprocessableEntityException } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { MsosRepository } from './msos.repository';
import { MsosService } from './msos.service';

describe('MsosService traffic pack', () => {
  const enabledConfig = {
    mediaOsEnabled: true,
    mediaOsReseller: false,
    mediaOsConnectorWrite: false,
  } as AppConfigService;

  const lineId = '00000000-0000-4000-8000-000000000060';
  const creativeId = '00000000-0000-4000-8000-000000000070';

  const makeRepo = (overrides: Partial<MsosRepository> = {}): MsosRepository =>
    ({
      db: {
        query: jest.fn().mockImplementation(async (sql: string) => {
          if (/FROM crm_cp_assets/i.test(sql)) return { rows: [{ id: creativeId }] };
          return { rows: [] };
        }),
      },
      getMediaLine: jest.fn().mockResolvedValue({ id: lineId }),
      getTrafficPack: jest.fn().mockResolvedValue(null),
      upsertTrafficPack: jest.fn(),
      submitTrafficPack: jest.fn(),
      getPlacementForLine: jest.fn().mockResolvedValue({ backup_required: false, max_weight_kb: 200 }),
      ...overrides,
    }) as unknown as MsosRepository;

  it('returns null traffic when none exists', async () => {
    const svc = new MsosService(enabledConfig, makeRepo());
    expect(await svc.getTraffic(lineId)).toBeNull();
  });

  it('upserts traffic pack with creative validation', async () => {
    const upsertTrafficPack = jest.fn().mockResolvedValue({
      id: 'tp1',
      status: 'draft',
      creative_id: creativeId,
    });
    const svc = new MsosService(enabledConfig, makeRepo({ upsertTrafficPack }));
    await svc.upsertTraffic(lineId, {
      creative_id: creativeId,
      width_px: 300,
      height_px: 250,
      weight_kb: 100,
      click_url: 'https://example.com',
    });
    expect(upsertTrafficPack).toHaveBeenCalled();
  });

  it('422 when creative not found', async () => {
    const repo = makeRepo({
      db: { query: jest.fn().mockResolvedValue({ rows: [] }) } as never,
    });
    const svc = new MsosService(enabledConfig, repo);
    await expect(
      svc.upsertTraffic(lineId, { creative_id: creativeId }),
    ).rejects.toMatchObject({ response: { error: 'creative_not_found' } });
  });

  it('submit sets status submitted', async () => {
    const submitTrafficPack = jest.fn().mockResolvedValue({ id: 'tp1', status: 'submitted' });
    const svc = new MsosService(enabledConfig, makeRepo({ submitTrafficPack }));
    const out = await svc.submitTraffic(lineId);
    expect(out.status).toBe('submitted');
  });

  it('evaluateTrafficReady returns gate result', async () => {
    const repo = makeRepo({
      getTrafficPack: jest.fn().mockResolvedValue({
        status: 'approved_by_partner',
        creative_id: creativeId,
        width_px: 300,
        height_px: 250,
        weight_kb: 100,
        click_url: 'https://example.com',
        backup_attached: true,
      }),
    });
    const svc = new MsosService(enabledConfig, repo);
    const out = await svc.evaluateTrafficReady(lineId);
    expect(out.ready).toBe(true);
  });
});
