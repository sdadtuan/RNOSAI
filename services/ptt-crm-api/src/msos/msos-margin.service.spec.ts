import { ForbiddenException, UnprocessableEntityException } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { MsosRepository } from './msos.repository';
import { MsosService } from './msos.service';

describe('MsosService margin and finance request', () => {
  const enabledConfig = {
    mediaOsEnabled: true,
    mediaOsReseller: false,
    mediaOsConnectorWrite: false,
  } as AppConfigService;

  const lineId = '00000000-0000-4000-8000-000000000060';
  const packId = '00000000-0000-4000-8000-000000000080';

  const makeRepo = (overrides: Partial<MsosRepository> = {}): MsosRepository => {
    const sqls: string[] = [];
    const db = {
      query: jest.fn(async (sql: string) => {
        sqls.push(sql);
        return { rows: [] };
      }),
      sqls,
    };
    return {
      db,
      getMediaLine: jest.fn().mockResolvedValue({ id: lineId, package_id: 'pkg1' }),
      getMarginInputs: jest.fn().mockResolvedValue({
        gross_sell_vnd: 100_000_000,
        discount_vnd: 0,
        media_cost_vnd: 60_000_000,
        make_good_cost_vnd: 0,
        rebate_accrued_vnd: 0,
        service_cost_vnd: 5_000_000,
      }),
      getLatestMarginSnapshot: jest.fn().mockResolvedValue(null),
      getOfficialEvidencePack: jest.fn().mockResolvedValue(null),
      hasOpenMaterialDiscrepancy: jest.fn().mockResolvedValue(false),
      insertMarginSnapshot: jest.fn(),
      insertFinanceRequest: jest.fn(),
      ...overrides,
    } as unknown as MsosRepository;
  };

  it('computes margin waterfall from line facts', async () => {
    const repo = makeRepo();
    const svc = new MsosService(enabledConfig, repo);
    const out = await svc.getMargin(lineId);
    expect(out.contribution_bps).toBeGreaterThan(0);
    expect(out.gross_sell_vnd).toBe(100_000_000);
  });

  it('blocks margin submit below block threshold', async () => {
    const repo = makeRepo({
      getMarginInputs: jest.fn().mockResolvedValue({
        gross_sell_vnd: 100_000_000,
        discount_vnd: 0,
        media_cost_vnd: 90_000_000,
        make_good_cost_vnd: 5_000_000,
        rebate_accrued_vnd: 0,
        service_cost_vnd: 5_000_000,
      }),
    });
    const svc = new MsosService(enabledConfig, repo);
    await expect(svc.submitMargin(lineId, { isAdmin: false })).rejects.toMatchObject({
      response: { error: 'margin_blocked' },
    });
  });

  it('requires director approval below floor', async () => {
    const repo = makeRepo({
      getMarginInputs: jest.fn().mockResolvedValue({
        gross_sell_vnd: 100_000_000,
        discount_vnd: 0,
        media_cost_vnd: 75_000_000,
        make_good_cost_vnd: 0,
        rebate_accrued_vnd: 0,
        service_cost_vnd: 5_000_000,
      }),
    });
    const svc = new MsosService(enabledConfig, repo);
    await expect(svc.submitMargin(lineId, { isAdmin: false })).rejects.toMatchObject({
      response: { error: 'margin_needs_director' },
    });
  });

  it('closes snapshot only when pack is official', async () => {
    const insertMarginSnapshot = jest.fn().mockResolvedValue({ id: 'snap1', closed: true });
    const repo = makeRepo({
      getOfficialEvidencePack: jest.fn().mockResolvedValue({ id: packId, status: 'official' }),
      insertMarginSnapshot,
    });
    const svc = new MsosService(enabledConfig, repo);
    await svc.submitMargin(lineId, { isAdmin: true });
    expect(insertMarginSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ closed: true, media_line_id: lineId }),
    );
  });

  it('keeps snapshot open when pack not official', async () => {
    const insertMarginSnapshot = jest.fn().mockResolvedValue({ id: 'snap1', closed: false });
    const repo = makeRepo({
      getOfficialEvidencePack: jest.fn().mockResolvedValue(null),
      insertMarginSnapshot,
    });
    const svc = new MsosService(enabledConfig, repo);
    await svc.submitMargin(lineId, { isAdmin: true });
    expect(insertMarginSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ closed: false }),
    );
  });

  it('blocks finance request when pack not official', async () => {
    const repo = makeRepo({
      getOfficialEvidencePack: jest.fn().mockResolvedValue(null),
    });
    const svc = new MsosService(enabledConfig, repo);
    await expect(svc.createFinanceRequest(lineId, 9)).rejects.toMatchObject({
      response: { error: 'evidence_not_official' },
    });
  });

  it('blocks finance request on open material discrepancy', async () => {
    const repo = makeRepo({
      getOfficialEvidencePack: jest.fn().mockResolvedValue({ id: packId, status: 'official' }),
      hasOpenMaterialDiscrepancy: jest.fn().mockResolvedValue(true),
    });
    const svc = new MsosService(enabledConfig, repo);
    await expect(svc.createFinanceRequest(lineId, 9)).rejects.toMatchObject({
      response: { error: 'discrepancy_material_open' },
    });
  });

  it('creates finance request without invoice insert', async () => {
    const sqls: string[] = [];
    const db = {
      query: jest.fn(async (sql: string) => {
        sqls.push(sql);
        return { rows: [{ id: 'fr1' }] };
      }),
    };
    const insertFinanceRequest = jest.fn().mockResolvedValue({
      id: 'fr1',
      media_line_id: lineId,
      status: 'requested',
    });
    const repo = makeRepo({
      db: db as unknown as MsosRepository['db'],
      getOfficialEvidencePack: jest.fn().mockResolvedValue({ id: packId, status: 'official' }),
      hasOpenMaterialDiscrepancy: jest.fn().mockResolvedValue(false),
      insertFinanceRequest,
    });
    const svc = new MsosService(enabledConfig, repo);
    const out = await svc.createFinanceRequest(lineId, 9);
    expect(out.status).toBe('requested');
    expect(sqls.join(' ')).not.toMatch(/INSERT INTO crm_invoices/i);
    expect(insertFinanceRequest).toHaveBeenCalledWith(
      expect.objectContaining({ media_line_id: lineId, evidence_pack_id: packId }),
    );
  });
});
