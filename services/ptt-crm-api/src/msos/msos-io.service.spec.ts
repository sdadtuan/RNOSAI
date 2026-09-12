import { UnprocessableEntityException } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { canIssueIo } from './msos-gates.util';
import { MsosRepository } from './msos.repository';
import { MsosService } from './msos.service';

describe('MsosService insertion orders', () => {
  const enabledConfig = {
    mediaOsEnabled: true,
    mediaOsReseller: false,
    mediaOsConnectorWrite: false,
  } as AppConfigService;

  const clientId = '00000000-0000-4000-8000-000000000001';
  const packageId = '00000000-0000-4000-8000-000000000030';
  const rateVersionId = '00000000-0000-4000-8000-000000000020';
  const ioId = '00000000-0000-4000-8000-000000000040';
  const snapshotId = '00000000-0000-4000-8000-000000000050';

  const sqls: string[] = [];

  const makeRepo = (overrides: Partial<MsosRepository> = {}): MsosRepository =>
    ({
      db: {
        query: jest.fn().mockImplementation(async (sql: string) => {
          sqls.push(sql);
          if (/FROM clients/i.test(sql)) return { rows: [{ id: clientId }] };
          return { rows: [] };
        }),
      },
      getPackage: jest.fn().mockResolvedValue({
        id: packageId,
        client_id: clientId,
        sell_vnd: 5000000,
        hide_buy_side: false,
      }),
      getRateVersionById: jest.fn().mockResolvedValue({
        id: rateVersionId,
        status: 'published',
        unit_price_vnd: 1000000,
      }),
      hasValidReserve: jest.fn().mockResolvedValue(true),
      createBrandSafetySnapshot: jest.fn().mockResolvedValue({
        id: snapshotId,
        tier: 'A',
        alcohol_pharma_banned: true,
        exclusions_json: [],
        locked_at: '2026-09-12T00:00:00Z',
      }),
      createInsertionOrder: jest.fn().mockResolvedValue({
        id: ioId,
        display_code: 'IO-20260912-A1B2',
        package_id: packageId,
        client_id: clientId,
        rate_version_id: rateVersionId,
        safety_snapshot_id: snapshotId,
        status: 'draft',
        qty: 100,
        sell_vnd: 5000000,
        buy_vnd: 3000000,
        period_start: '2026-09-12',
        period_end: '2026-09-18',
        media_line_id: null,
        partner_confirmed_at: null,
        partner_confirm_ref: null,
        issued_at: null,
        issued_by: null,
      }),
      getInsertionOrder: jest.fn(),
      issueInsertionOrder: jest.fn(),
      appendIoRevision: jest.fn(),
      ...overrides,
    }) as unknown as MsosRepository;

  beforeEach(() => {
    sqls.length = 0;
  });

  it('canIssueIo gate validates prerequisites', () => {
    expect(canIssueIo({
      rateStatus: 'published',
      clientOk: true,
      hasSafetySnapshot: true,
      hardOrValidSoft: true,
    }).pass).toBe(true);
  });

  it('creates draft IO with safety snapshot', async () => {
    const createInsertionOrder = jest.fn().mockResolvedValue({ id: ioId, status: 'draft' });
    const svc = new MsosService(enabledConfig, makeRepo({ createInsertionOrder }));
    const out = await svc.createIo(packageId, {
      rate_version_id: rateVersionId,
      period_start: '2026-09-12',
      period_end: '2026-09-18',
      qty: 100,
      sell_vnd: 5000000,
      buy_vnd: 3000000,
    });
    expect(out.status).toBe('draft');
    expect(createInsertionOrder).toHaveBeenCalled();
  });

  it('issue IO sets status issued and appends revision without invoice', async () => {
    const issueInsertionOrder = jest.fn().mockResolvedValue({
      id: ioId,
      status: 'issued',
      issued_at: '2026-09-12T00:00:00Z',
    });
    const appendIoRevision = jest.fn().mockResolvedValue(undefined);
    const repo = makeRepo({
      getInsertionOrder: jest.fn().mockResolvedValue({
        id: ioId,
        package_id: packageId,
        client_id: clientId,
        rate_version_id: rateVersionId,
        safety_snapshot_id: snapshotId,
        status: 'draft',
        qty: 100,
      }),
      getRateVersionById: jest.fn().mockResolvedValue({ id: rateVersionId, status: 'published' }),
      hasValidReserve: jest.fn().mockResolvedValue(true),
      issueInsertionOrder,
      appendIoRevision,
    });
    const svc = new MsosService(enabledConfig, repo);
    const out = await svc.issueIo(ioId, 9);
    expect(out.status).toBe('issued');
    expect(appendIoRevision).toHaveBeenCalled();
    expect(sqls.join(' ')).not.toMatch(/INSERT INTO crm_invoices/i);
  });

  it('issue IO fails GT-P01 when reserve missing', async () => {
    const repo = makeRepo({
      getInsertionOrder: jest.fn().mockResolvedValue({
        id: ioId,
        package_id: packageId,
        client_id: clientId,
        rate_version_id: rateVersionId,
        safety_snapshot_id: snapshotId,
        status: 'draft',
      }),
      getRateVersionById: jest.fn().mockResolvedValue({ id: rateVersionId, status: 'published' }),
      hasValidReserve: jest.fn().mockResolvedValue(false),
    });
    const svc = new MsosService(enabledConfig, repo);
    await expect(svc.issueIo(ioId, 9)).rejects.toMatchObject({
      response: { error: 'reserve_required' },
    });
  });

  it('safety change creates new snapshot and revision', async () => {
    const createBrandSafetySnapshot = jest.fn().mockResolvedValue({
      id: 'snap2',
      tier: 'B',
    });
    const appendIoRevision = jest.fn().mockResolvedValue(undefined);
    const updateIoSafetySnapshot = jest.fn().mockResolvedValue(undefined);
    const repo = makeRepo({
      getInsertionOrder: jest.fn().mockResolvedValue({
        id: ioId,
        status: 'issued',
        safety_snapshot_id: snapshotId,
      }),
      createBrandSafetySnapshot,
      appendIoRevision,
      updateIoSafetySnapshot,
    });
    const svc = new MsosService(enabledConfig, repo);
    await svc.changeIoSafety(ioId, { tier: 'B', staffId: 9 });
    expect(createBrandSafetySnapshot).toHaveBeenCalledWith(expect.objectContaining({ tier: 'B' }));
    expect(updateIoSafetySnapshot).toHaveBeenCalledWith(ioId, 'snap2');
    expect(appendIoRevision).toHaveBeenCalled();
  });

  it('export IO returns JSON payload', async () => {
    const io = {
      id: ioId,
      display_code: 'IO-20260912-A1B2',
      status: 'issued',
    };
    const repo = makeRepo({
      getInsertionOrder: jest.fn().mockResolvedValue(io),
    });
    const svc = new MsosService(enabledConfig, repo);
    const out = await svc.exportIo(ioId);
    expect(out.display_code).toBe('IO-20260912-A1B2');
  });
});
