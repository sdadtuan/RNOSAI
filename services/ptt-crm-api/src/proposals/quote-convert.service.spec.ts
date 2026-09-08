import { readFileSync } from 'fs';
import { join } from 'path';
import { ForbiddenException } from '@nestjs/common';
import { ProposalsController } from './proposals.controller';
import { ProposalsService } from './proposals.service';
import { QuoteConvertService } from './quote-convert.service';
import {
  QT_REQUIRED_ACTION_KEY,
  QT_REQUIRED_SECTION_KEY,
  StaffQuoteGuard,
} from './guards/staff-quote.guard';
import { Reflector } from '@nestjs/core';

const VID = '19d722af-0000-4000-8000-000000000010';
const LINE = {
  id: 11,
  proposal_id: 9,
  dv_code: 'DV02',
  sku_code: 'DV02-TC',
  package_tier: 'standard',
  service_slug: 'content',
  reference_price_min: 0,
  reference_price_max: 0,
  final_price_vnd: 20_000_000,
  scope_notes: '',
  lifecycle_id: null as number | null,
  sort_order: 0,
};

class ConvertMemory {
  sqls: string[] = [];
  txCalls = 0;
  conversions: Array<Record<string, unknown>> = [];
  invoices: Array<Record<string, unknown>> = [];
  payments: Array<Record<string, unknown>> = [
    {
      id: 'pay-1',
      version_id: VID,
      seq: 1,
      pct_bps: 5000,
      amount_vnd: 10_000_000,
      milestone: 'Kickoff',
    },
    {
      id: 'pay-2',
      version_id: VID,
      seq: 2,
      pct_bps: 5000,
      amount_vnd: 10_000_000,
      milestone: 'Handover',
    },
  ];
  versions = new Map<string, Record<string, unknown>>([
    [
      VID,
      {
        id: VID,
        proposal_id: 9,
        n: 1,
        state: 'accepted',
        payable_vnd: 20_000_000,
      },
    ],
  ]);
  nextConversion = 1;
  nextInvoice = 100;
  throwOnSecondInsert = false;

  async withTransaction<T>(
    fn: (query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>) => Promise<T>,
  ): Promise<T> {
    this.txCalls += 1;
    return fn(this.query.bind(this));
  }

  async query(sql: string, params: unknown[] = []) {
    this.sqls.push(sql);
    if (/INSERT INTO crm_csd|INTO csd_/i.test(sql)) {
      throw new Error('must_not_create_csd_tickets');
    }
    if (/INSERT INTO crm_cp_projects/i.test(sql)) {
      throw new Error('must_not_insert_crm_cp_projects');
    }
    if (/pg_advisory_xact_lock/i.test(sql)) {
      return { rows: [{}] };
    }
    if (/FROM crm_quote_versions/i.test(sql)) {
      const vid = String(params[0] ?? '');
      const row = this.versions.get(vid);
      return { rows: row ? [row] : [] };
    }
    if (/FROM crm_quote_payment_schedules/i.test(sql)) {
      const vid = String(params[0] ?? '');
      return { rows: this.payments.filter((row) => String(row.version_id) === vid) };
    }
    if (/FROM crm_quote_conversions/i.test(sql)) {
      const vid = String(params[0] ?? '');
      const target = params[1] != null ? String(params[1]) : null;
      const rows = this.conversions.filter((row) => {
        if (String(row.version_id) !== vid) return false;
        if (target && String(row.target_type) !== target) return false;
        return true;
      });
      return { rows };
    }
    if (/INSERT INTO crm_quote_conversions/i.test(sql)) {
      const versionId = String(params[0]);
      const targetType = String(params[1]);
      const exists = this.conversions.some(
        (row) => String(row.version_id) === versionId && String(row.target_type) === targetType,
      );
      if (exists || this.throwOnSecondInsert) {
        if (exists || this.conversions.length > 0) {
          const err = Object.assign(new Error('duplicate key value violates unique constraint'), {
            code: '23505',
          });
          throw err;
        }
      }
      const row = {
        id: `cvt-${this.nextConversion++}`,
        version_id: versionId,
        target_type: targetType,
        target_id: String(params[2] ?? ''),
        payload_json: params[3] ?? {},
      };
      this.conversions.push(row);
      return { rows: [row] };
    }
    if (/FROM crm_invoices/i.test(sql)) {
      const notes = String(params[0] ?? '');
      return {
        rows: this.invoices.filter((row) => String(row.notes ?? '') === notes),
      };
    }
    if (/INSERT INTO crm_invoices/i.test(sql)) {
      const row = {
        id: this.nextInvoice++,
        status: 'draft',
        customer_id: params[0],
        amount_vnd: params[1],
        notes: String(params[2] ?? ''),
      };
      this.invoices.push(row);
      return { rows: [row] };
    }
    return { rows: [] };
  }
}

function load(overrides?: {
  status?: string;
  quoteCode?: string | null;
  versionId?: string | null;
  lines?: typeof LINE[];
  db?: ConvertMemory;
}) {
  const db = overrides?.db ?? new ConvertMemory();
  const lines = overrides?.lines ?? [{ ...LINE }];
  const proposal = {
    id: 9,
    customer_id: 3,
    lead_id: 4,
    status: overrides?.status ?? 'accepted',
    quote_code: overrides?.quoteCode ?? 'QT-PTT-2026-000001',
    current_version_id: overrides?.versionId === undefined ? VID : overrides.versionId,
    total_vnd: 20_000_000,
  };
  const repo = {
    getById: jest.fn().mockResolvedValue(proposal),
    listLines: jest.fn().mockImplementation(async () => lines),
    setLineLifecycle: jest.fn().mockImplementation(async (lineId: number, lifecycleId: number) => {
      const line = lines.find((row) => row.id === lineId);
      if (line) line.lifecycle_id = lifecycleId;
    }),
    activateLifecycle: jest.fn().mockResolvedValue(undefined),
    setLifecycleSkuCode: jest.fn().mockResolvedValue(undefined),
    setProposalLifecycle: jest.fn().mockResolvedValue(undefined),
    patchStatus: jest.fn().mockImplementation(async (_id: number, status: string) => ({
      ...proposal,
      status,
    })),
  };
  let nextLc = 50;
  const lifecycle = {
    create: jest.fn().mockImplementation(async () => ({ id: nextLc++ })),
    setCommercialSku: jest.fn().mockResolvedValue(undefined),
  };
  const invoices = {
    create: jest.fn().mockImplementation(async (body: { amount_vnd?: number; notes?: string }) => {
      const row = {
        id: db.nextInvoice++,
        status: 'draft',
        amount_vnd: body.amount_vnd ?? 0,
        notes: body.notes ?? '',
      };
      db.invoices.push(row);
      return { invoice: row };
    }),
  };
  const svc = new QuoteConvertService(db, repo as never, lifecycle as never, invoices as never);
  return { db, repo, lifecycle, invoices, svc, lines, proposal };
}

const ACTOR = { staffId: 7, staffAuthVia: 'jwt' as const, idempotencyKey: 'cvt-01' };

describe('QuoteConvertService', () => {
  it('two converts return one lifecycle set and the same conversion ids (AC-08)', async () => {
    const { db, lifecycle, invoices, svc } = load();

    const first = await svc.convert(9, VID, ACTOR);
    const second = await svc.convert(9, VID, { ...ACTOR, idempotencyKey: 'cvt-01-replay' });

    expect(first.conversion_id).toBeTruthy();
    expect(second.conversion_id).toBe(first.conversion_id);
    expect(second.lifecycles).toEqual(first.lifecycles);
    expect(second.invoice_draft_ids).toEqual(first.invoice_draft_ids);
    expect(first.lifecycles).toEqual([
      { line_id: 11, lifecycle_id: 50, dv_code: 'DV02' },
    ]);
    expect(second.invoice_draft_ids).toHaveLength(2);
    expect(invoices.create).toHaveBeenCalledTimes(2);
    expect(lifecycle.create).toHaveBeenCalledTimes(1);
    expect(lifecycle.create).toHaveBeenCalledWith({
      customer_id: 3,
      service_slug: 'content',
    });
    expect(db.conversions.filter((row) => row.target_type === 'lifecycle_bundle')).toHaveLength(1);
    expect(db.conversions.filter((row) => row.target_type === 'invoice_schedule')).toHaveLength(1);
    expect(db.sqls.some((sql) => /UNIQUE|crm_quote_conversions/i.test(sql))).toBe(true);
    expect(db.txCalls).toBeGreaterThan(0);
  });

  it('does not multiply invoice drafts when invoices already exist for the version', async () => {
    const seeded = new ConvertMemory();
    seeded.invoices.push(
      { id: 201, notes: `Quote convert ${VID}` },
      { id: 202, notes: `Quote convert ${VID}` },
    );
    seeded.nextInvoice = 300;
    const { invoices, svc } = load({ db: seeded });

    const first = await svc.convert(9, VID, ACTOR);
    const second = await svc.convert(9, VID, { ...ACTOR, idempotencyKey: 'cvt-01-replay' });

    expect(first.invoice_draft_ids).toEqual([201, 202]);
    expect(second.invoice_draft_ids).toEqual([201, 202]);
    expect(invoices.create).not.toHaveBeenCalled();
    expect(seeded.invoices.map((row) => row.id)).toEqual([201, 202]);
  });

  it('unique violation on (version_id, target_type) replays the same ids', async () => {
    const seeded = new ConvertMemory();
    const payload = {
      conversion_id: 'cvt-seed',
      lifecycles: [{ line_id: 11, lifecycle_id: 77, dv_code: 'DV02' }],
      invoice_draft_ids: [201],
      optional_handoff: [],
    };
    seeded.conversions.push({
      id: 'cvt-seed',
      version_id: VID,
      target_type: 'lifecycle_bundle',
      target_id: '77',
      payload_json: payload,
    });
    seeded.conversions.push({
      id: 'cvt-inv',
      version_id: VID,
      target_type: 'invoice_schedule',
      target_id: '201',
      payload_json: { invoice_draft_ids: [201] },
    });
    const { lifecycle, svc } = load({ db: seeded });

    const out = await svc.convert(9, VID, ACTOR);

    expect(out).toEqual(payload);
    expect(lifecycle.create).not.toHaveBeenCalled();
  });

  it('requires Idempotency-Key', async () => {
    const { svc } = load();

    await expect(svc.convert(9, VID, { staffId: 7, idempotencyKey: '' })).rejects.toMatchObject({
      response: { error: 'idempotency_key_required' },
    });
  });

  it('does not create CSD tickets or crm_cp_projects and returns empty optional_handoff', async () => {
    const { db, svc } = load();

    const out = await svc.convert(9, VID, ACTOR);

    expect(out.optional_handoff).toEqual([]);
    expect(db.sqls.some((sql) => /crm_csd|csd_ticket|crm_cp_projects/i.test(sql))).toBe(false);
    expect(db.invoices.length).toBeGreaterThan(0);
  });

  it('explicit convert on draft is rejected with quote_not_accepted', async () => {
    const { svc, lifecycle, invoices } = load({ status: 'draft' });

    await expect(svc.convert(9, VID, ACTOR)).rejects.toMatchObject({
      response: { error: 'quote_not_accepted' },
    });
    expect(lifecycle.create).not.toHaveBeenCalled();
    expect(invoices.create).not.toHaveBeenCalled();
  });

  it('explicit convert on sent is rejected with quote_not_accepted', async () => {
    const { svc } = load({ status: 'sent' });

    await expect(svc.convert(9, VID, ACTOR)).rejects.toMatchObject({
      response: { error: 'quote_not_accepted' },
    });
  });

  it('JWT unresolved staff throws 403 qt_unresolved_staff', async () => {
    const { svc } = load();

    await expect(
      svc.convert(9, VID, { staffId: 0, staffAuthVia: 'jwt', idempotencyKey: 'k' }),
    ).rejects.toMatchObject({ response: { error: 'qt_unresolved_staff' } });
  });
});

describe('accept path vs convert', () => {
  function loadProposals(overrides: {
    quoteConvert?: { convert: jest.Mock };
    repo?: Record<string, jest.Mock>;
    lifecycle?: { create: jest.Mock; setCommercialSku?: jest.Mock };
    ops?: { spawnWeek: jest.Mock };
    config?: Record<string, unknown>;
  }) {
    const state = {
      proposal: {
        id: 9,
        customer_id: 3,
        status: 'sent' as string,
        quote_code: 'QT-PTT-2026-000001' as string | null,
        current_version_id: VID as string | null,
      },
    };
    const repo = {
      getById: jest.fn().mockImplementation(async () => ({ ...state.proposal })),
      listLines: jest.fn().mockResolvedValue([{ ...LINE }]),
      patchStatus: jest.fn().mockImplementation(async (_id: number, status: string) => {
        state.proposal = { ...state.proposal, status };
        return { ...state.proposal };
      }),
      setLineLifecycle: jest.fn(),
      activateLifecycle: jest.fn(),
      setLifecycleSkuCode: jest.fn(),
      setProposalLifecycle: jest.fn(),
      ...overrides.repo,
    };
    const quoteConvert = overrides.quoteConvert ?? {
      convert: jest.fn().mockResolvedValue({
        conversion_id: 'cvt-1',
        lifecycles: [{ line_id: 11, lifecycle_id: 50, dv_code: 'DV02' }],
        invoice_draft_ids: [100],
        optional_handoff: [],
      }),
    };
    const unused = {} as never;
    const funnel = {
      getFunnel: jest.fn(),
      getPresalesProposalHandoff: jest.fn(),
      getPresalesProposalGate: jest.fn(),
    };
    let nextLc = 80;
    const lifecycle = overrides.lifecycle ?? {
      create: jest.fn().mockImplementation(async () => ({ id: nextLc++ })),
      setCommercialSku: jest.fn().mockResolvedValue(undefined),
    };
    const ops = overrides.ops ?? { spawnWeek: jest.fn().mockResolvedValue(undefined) };
    const config = {
      dealRoomGateStrict: false,
      opsWeeklySpawnEnabled: true,
      opsDvEnabled: true,
      ...(overrides.config ?? {}),
    };
    const svc = new ProposalsService(
      repo as never,
      unused,
      unused,
      lifecycle as never,
      ops as never,
      config as never,
      funnel as never,
      unused,
      { create: jest.fn() } as never,
      { list: jest.fn() } as never,
      { putLines: jest.fn() } as never,
      unused,
      quoteConvert as never,
    );
    return { svc, repo, quoteConvert, lifecycle, ops, state };
  }

  it('Quote OS accept without explicit convert still one convert via legacy key', async () => {
    const { svc, repo, quoteConvert } = loadProposals({});

    const out = await svc.patchStatus(9, { status: 'accepted' });

    expect(repo.patchStatus).toHaveBeenCalledWith(9, 'accepted', undefined);
    expect(quoteConvert.convert).toHaveBeenCalledTimes(1);
    expect(quoteConvert.convert).toHaveBeenCalledWith(
      9,
      VID,
      expect.objectContaining({ idempotencyKey: 'legacy-accept:9' }),
    );
    expect(out.lifecycles).toEqual([{ line_id: 11, lifecycle_id: 50, dv_code: 'DV02' }]);
  });

  it('Quote OS PATCH accepted that fails convert rolls back accepted', async () => {
    const convert = jest.fn().mockRejectedValue({
      response: { error: 'version_not_found' },
    });
    const { svc, repo } = loadProposals({ quoteConvert: { convert } });

    await expect(svc.patchStatus(9, { status: 'accepted' })).rejects.toMatchObject({
      response: { error: 'version_not_found' },
    });
    expect(repo.patchStatus).toHaveBeenCalledWith(9, 'accepted', undefined);
    expect(repo.patchStatus).toHaveBeenCalledWith(9, 'sent');
    const after = await repo.getById(9);
    expect(after.status).toBe('sent');
  });

  it('Deal Room accept without current_version_id creates one lifecycle per line', async () => {
    const line2 = { ...LINE, id: 12, dv_code: 'DV03', service_slug: 'seo' };
    const { svc, repo, quoteConvert, lifecycle, ops } = loadProposals({
      repo: {
        getById: jest.fn().mockResolvedValue({
          id: 9,
          customer_id: 3,
          status: 'sent',
          quote_code: null,
          current_version_id: null,
        }),
        listLines: jest.fn().mockResolvedValue([{ ...LINE }, line2]),
        patchStatus: jest.fn().mockResolvedValue({
          id: 9,
          status: 'accepted',
          quote_code: null,
          current_version_id: null,
        }),
      },
    });

    const out = await svc.patchStatus(9, { status: 'accepted', spawn_week: true }, 'staff@ptt');

    expect(quoteConvert.convert).not.toHaveBeenCalled();
    expect(lifecycle.create).toHaveBeenCalledTimes(2);
    expect(lifecycle.create).toHaveBeenNthCalledWith(1, {
      customer_id: 3,
      service_slug: 'content',
    });
    expect(lifecycle.create).toHaveBeenNthCalledWith(2, {
      customer_id: 3,
      service_slug: 'seo',
    });
    expect(repo.setLineLifecycle).toHaveBeenCalledTimes(2);
    expect(ops.spawnWeek).toHaveBeenCalledTimes(2);
    expect(out.lifecycles).toEqual([
      { line_id: 11, lifecycle_id: 80, dv_code: 'DV02' },
      { line_id: 12, lifecycle_id: 81, dv_code: 'DV03' },
    ]);
  });

  it('legacy PATCH accepted calls convert once with legacy-accept key and replays same ids', async () => {
    const convert = jest.fn().mockResolvedValue({
      conversion_id: 'cvt-legacy',
      lifecycles: [{ line_id: 11, lifecycle_id: 50, dv_code: 'DV02' }],
      invoice_draft_ids: [100],
      optional_handoff: [],
    });
    const { svc, quoteConvert } = loadProposals({
      quoteConvert: { convert },
      repo: {
        getById: jest.fn().mockResolvedValue({
          id: 9,
          customer_id: 3,
          status: 'sent',
          quote_code: null,
          current_version_id: VID,
        }),
        patchStatus: jest.fn().mockResolvedValue({
          id: 9,
          status: 'accepted',
          quote_code: null,
          current_version_id: VID,
        }),
      },
    });

    const first = await svc.patchStatus(9, { status: 'accepted' });
    const second = await svc.patchStatus(9, { status: 'accepted' });

    expect(quoteConvert.convert).toHaveBeenCalledTimes(2);
    expect(quoteConvert.convert).toHaveBeenCalledWith(
      9,
      VID,
      expect.objectContaining({ idempotencyKey: 'legacy-accept:9' }),
    );
    expect(first.lifecycles).toEqual(second.lifecycles);
    expect(first.lifecycles).toEqual([{ line_id: 11, lifecycle_id: 50, dv_code: 'DV02' }]);
  });
});

describe('convert route and cap', () => {
  it('controller wires POST convert, StaffQuoteGuard, and required Idempotency-Key', () => {
    const src = readFileSync(join(__dirname, 'proposals.controller.ts'), 'utf8');
    expect(src).toMatch(/:id\/versions\/:vid\/convert/);
    expect(src).toMatch(/RequireQuoteSection\('crm_quote\.convert',\s*'execute'\)/);
    expect(src).toMatch(/StaffQuoteGuard/);
    const convertBlock = src.slice(src.indexOf("':id/versions/:vid/convert'"));
    expect(convertBlock).toMatch(/idempotency-key/i);
  });

  it('POST convert without Idempotency-Key returns 400', async () => {
    const proposals = { convert: jest.fn() };
    const staffAuth = { resolveCrmStaffUserId: jest.fn().mockResolvedValue(7), me: jest.fn() };
    const ctrl = new ProposalsController(
      proposals as never,
      {} as never,
      {} as never,
      staffAuth as never,
    );

    await expect(
      ctrl.convert(
        { staffAuthVia: 'internal' } as never,
        9,
        VID,
        undefined,
      ),
    ).rejects.toMatchObject({ response: { error: 'idempotency_key_required' } });
    expect(proposals.convert).not.toHaveBeenCalled();
  });

  it('missing crm_quote.convert execute returns 403 missing_cap', async () => {
    const staffAuth = {
      resolveCrmStaffUserId: jest.fn().mockResolvedValue(42),
      me: jest.fn().mockResolvedValue({ caps: [{ section: 'crm_quote', action: 'view' }] }),
      hasCap: jest.fn(
        (caps: Array<{ section: string; action: string }>, section: string, action: string) =>
          caps.some((c) => c.section === section && c.action === action),
      ),
    };
    const reflector = {
      get: jest.fn((key: string) => {
        if (key === QT_REQUIRED_SECTION_KEY) return 'crm_quote.convert';
        if (key === QT_REQUIRED_ACTION_KEY) return 'execute';
        return undefined;
      }),
    };
    const guard = new StaffQuoteGuard(staffAuth as never, reflector as unknown as Reflector);

    await expect(
      guard.canActivate({
        switchToHttp: () => ({ getRequest: () => ({ staffUser: { sub: '42' } }) }),
        getHandler: () => ({}),
      } as never),
    ).rejects.toMatchObject({
      response: { error: 'missing_cap', section: 'crm_quote.convert', action: 'execute' },
    });
    await expect(
      guard.canActivate({
        switchToHttp: () => ({ getRequest: () => ({ staffUser: { sub: '42' } }) }),
        getHandler: () => ({}),
      } as never),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
