import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { MsosRepository } from './msos.repository';
import { MsosService } from './msos.service';

describe('MsosService', () => {
  const enabledConfig = {
    mediaOsEnabled: true,
    mediaOsReseller: false,
    mediaOsConnectorWrite: false,
  } as AppConfigService;

  const makeRepo = (overrides: Partial<MsosRepository> = {}): MsosRepository =>
    ({
      listPartners: jest.fn().mockResolvedValue([]),
      createPartner: jest.fn(),
      listInventories: jest.fn().mockResolvedValue([]),
      createInventory: jest.fn(),
      listPlacements: jest.fn().mockResolvedValue([]),
      createPlacement: jest.fn(),
      ...overrides,
    }) as unknown as MsosRepository;

  it('throws media_os_disabled when flag off', () => {
    const svc = new MsosService({ mediaOsEnabled: false } as AppConfigService, makeRepo());
    expect(() => svc.assertEnabled()).toThrow(NotFoundException);
    try {
      svc.assertEnabled();
    } catch (e) {
      expect((e as NotFoundException).getResponse()).toEqual({ error: 'media_os_disabled' });
    }
  });

  it('passes when flag on', () => {
    const svc = new MsosService(enabledConfig, makeRepo());
    expect(() => svc.assertEnabled()).not.toThrow();
  });

  it('getHealth returns flags from config', () => {
    const svc = new MsosService(enabledConfig, makeRepo());
    expect(svc.getHealth()).toEqual({ ok: true, reseller: false, connector_write: false });
  });

  it('lists empty partners', async () => {
    const repo = makeRepo({ listPartners: jest.fn().mockResolvedValue([]) });
    const svc = new MsosService(enabledConfig, repo);
    expect(await svc.listPartners()).toEqual([]);
  });

  it('creates partner from staff legal_name only', async () => {
    const row = {
      id: 'p1',
      display_code: 'PTN-20260912-A1B2',
      legal_name: 'Cong ty TNHH ABC Truyen thong',
      status: 'draft',
      kyc_pass: false,
      created_at: '2026-09-12T00:00:00Z',
      created_by: 9,
    };
    const repo = makeRepo({ createPartner: jest.fn().mockResolvedValue(row) });
    const svc = new MsosService(enabledConfig, repo);
    const out = await svc.createPartner({ legal_name: 'Cong ty TNHH ABC Truyen thong', staffId: 9 });
    expect(out.legal_name).toBe('Cong ty TNHH ABC Truyen thong');
    expect(out.display_code).toMatch(/^PTN-\d{8}-[A-F0-9]{4}$/);
  });

  it('rejects forbidden demo names on partner create', async () => {
    const svc = new MsosService(enabledConfig, makeRepo());
    await expect(svc.createPartner({ legal_name: 'Sunlight Residence' })).rejects.toMatchObject({
      response: { error: 'forbidden_demo_name' },
    });
  });

  it('lists empty inventories and placements', async () => {
    const svc = new MsosService(enabledConfig, makeRepo());
    expect(await svc.listInventories()).toEqual([]);
    expect(await svc.listPlacements()).toEqual([]);
  });

  it('allows VnExpress as inventory name', async () => {
    const row = {
      id: 'i1',
      display_code: 'INV-20260912-B2C3',
      name: 'VnExpress',
      owner_kind: 'ptt' as const,
      partner_id: null,
      property_host: 'vnexpress.net',
      status: 'draft',
      created_at: '2026-09-12T00:00:00Z',
    };
    const repo = makeRepo({ createInventory: jest.fn().mockResolvedValue(row) });
    const svc = new MsosService(enabledConfig, repo);
    const out = await svc.createInventory({ name: 'VnExpress', owner_kind: 'ptt', property_host: 'vnexpress.net' });
    expect(out.name).toBe('VnExpress');
  });

  it('requires partner_id for partner inventory', async () => {
    const svc = new MsosService(enabledConfig, makeRepo());
    await expect(
      svc.createInventory({ name: 'Partner Site', owner_kind: 'partner' }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });
});
