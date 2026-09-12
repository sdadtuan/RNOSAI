import { UnprocessableEntityException } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { MsosRepository } from './msos.repository';
import { MsosService } from './msos.service';

describe('MsosService rate cards', () => {
  const enabledConfig = {
    mediaOsEnabled: true,
    mediaOsReseller: false,
    mediaOsConnectorWrite: false,
  } as AppConfigService;

  const rateCard = {
    id: 'rc1',
    display_code: 'RC-20260912-C3D4',
    owner_kind: 'ptt' as const,
    partner_id: null,
    created_at: '2026-09-12T00:00:00Z',
  };

  it('append-only: new versions increment and start draft', async () => {
    const v1 = {
      id: 'rv1',
      rate_card_id: 'rc1',
      version: 1,
      status: 'draft' as const,
      published_at: null,
      published_by: null,
      unit_price_vnd: 1000000,
      currency: 'VND',
    };
    const repo = {
      appendRateVersion: jest.fn().mockResolvedValue(v1),
    } as unknown as MsosRepository;
    const svc = new MsosService(enabledConfig, repo);
    const out = await svc.appendRateVersion('rc1', { unit_price_vnd: 1000000 });
    expect(out.version).toBe(1);
    expect(out.status).toBe('draft');
  });

  it('publish sets published and GT-01 bindable', async () => {
    const published = {
      id: 'rv1',
      rate_card_id: 'rc1',
      version: 1,
      status: 'published' as const,
      published_at: '2026-09-12T00:00:00Z',
      published_by: 9,
      unit_price_vnd: 1000000,
      currency: 'VND',
    };
    const repo = {
      publishRateVersion: jest.fn().mockResolvedValue(published),
    } as unknown as MsosRepository;
    const svc = new MsosService(enabledConfig, repo);
    const out = await svc.publishRateVersion('rc1', 1, 9);
    expect(out.status).toBe('published');
  });

  it('update published price fails rate_version_immutable', async () => {
    const repo = {
      updateRateVersionPrice: jest.fn().mockRejectedValue(new Error('rate_version_immutable')),
    } as unknown as MsosRepository;
    const svc = new MsosService(enabledConfig, repo);
    await expect(svc.updateRateVersionPrice('rc1', 1, 2000000)).rejects.toMatchObject({
      response: { error: 'rate_version_immutable' },
    });
  });

  it('creates rate card for ptt owner', async () => {
    const repo = {
      createRateCard: jest.fn().mockResolvedValue(rateCard),
    } as unknown as MsosRepository;
    const svc = new MsosService(enabledConfig, repo);
    const out = await svc.createRateCard({ owner_kind: 'ptt' });
    expect(out.display_code).toMatch(/^RC-\d{8}-[A-F0-9]{4}$/);
  });

  it('rejects invalid unit price on append', async () => {
    const svc = new MsosService(enabledConfig, {} as MsosRepository);
    await expect(svc.appendRateVersion('rc1', { unit_price_vnd: -1 })).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
  });
});
