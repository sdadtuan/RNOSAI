import { readFileSync } from 'fs';
import { join } from 'path';
import { ProposalsController } from './proposals.controller';
import { ProposalsService } from './proposals.service';
import { isQuoteOsCreate } from './quote-create.service';

function loadService(overrides: {
  quoteCreate?: { create: jest.Mock };
  quoteList?: { list: jest.Mock };
  quoteBuilder?: {
    putLines: jest.Mock;
    patchHeader?: jest.Mock;
    recalculate?: jest.Mock;
  };
  quoteConvert?: { convert: jest.Mock };
  lifecycle?: { create: jest.Mock; setCommercialSku?: jest.Mock };
  ops?: { spawnWeek: jest.Mock };
  config?: Record<string, unknown>;
  repo?: Partial<{
    listByLeadId: jest.Mock;
    listByCustomer: jest.Mock;
    listLines: jest.Mock;
    create: jest.Mock;
    getById: jest.Mock;
    replaceLines?: jest.Mock;
    patchStatus?: jest.Mock;
    setLineLifecycle?: jest.Mock;
    activateLifecycle?: jest.Mock;
    setLifecycleSkuCode?: jest.Mock;
    setProposalLifecycle?: jest.Mock;
  }>;
}) {
  const repo = {
    listByLeadId: jest.fn().mockResolvedValue([]),
    listByCustomer: jest.fn().mockResolvedValue([]),
    listLines: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockResolvedValue({ id: 9 }),
    replaceLines: jest.fn().mockResolvedValue([]),
    getById: jest.fn().mockResolvedValue({
      id: 9,
      customer_id: 3,
      status: 'draft',
      lines: [],
    }),
    patchStatus: jest.fn().mockImplementation(async (id: number, status: string) => ({
      id,
      status,
    })),
    setLineLifecycle: jest.fn(),
    activateLifecycle: jest.fn(),
    setLifecycleSkuCode: jest.fn(),
    setProposalLifecycle: jest.fn(),
    ...overrides.repo,
  };
  const quoteCreate = overrides.quoteCreate ?? {
    create: jest.fn().mockResolvedValue({
      proposal: {
        id: 1,
        quote_code: 'QT-PTT-2026-000089',
        status: 'draft',
        current_version_id: 'ver-1',
      },
    }),
  };
  const quoteList = overrides.quoteList ?? {
    list: jest.fn().mockResolvedValue({ items: [], page: 1, page_size: 25, total: 0 }),
  };
  const quoteBuilder = overrides.quoteBuilder ?? {
    putLines: jest.fn(),
    patchHeader: jest.fn(),
    recalculate: jest.fn(),
  };
  const unused = {} as never;
  const funnel = {
    getFunnel: jest.fn().mockResolvedValue({ presales: { presales: { id: 0, service_slug: '' } } }),
    getPresalesProposalHandoff: jest.fn().mockResolvedValue({ handoff: { customer_id: 3 } }),
    getPresalesProposalGate: jest.fn().mockResolvedValue({ gate: { ok: true, messages: [] } }),
  };
  let nextLc = 80;
  const lifecycle = overrides.lifecycle ?? {
    create: jest.fn().mockImplementation(async () => ({ id: nextLc++ })),
    setCommercialSku: jest.fn().mockResolvedValue(undefined),
  };
  const ops = overrides.ops ?? { spawnWeek: jest.fn().mockResolvedValue(undefined) };
  const quoteConvert = overrides.quoteConvert ?? { convert: jest.fn() };
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
    quoteCreate as never,
    quoteList as never,
    quoteBuilder as never,
    unused,
    quoteConvert as never,
  );
  return { svc, repo, quoteCreate, quoteList, quoteBuilder, quoteConvert, lifecycle, ops };
}

describe('ProposalsService quote-os wiring', () => {
  it('isQuoteOsCreate when title, agency_client_id, or source is present', () => {
    expect(isQuoteOsCreate({ title: 'An Phát Q3' })).toBe(true);
    expect(isQuoteOsCreate({ agency_client_id: '19d722af-0000-4000-8000-000000000002' })).toBe(true);
    expect(isQuoteOsCreate({ source: 'lead' })).toBe(true);
    expect(isQuoteOsCreate({ customer_id: 3, lead_id: 4 })).toBe(false);
  });

  it('create with title delegates to quote-create', async () => {
    const { svc, quoteCreate, repo } = loadService({});

    const out = await svc.create(
      { title: 'An Phát Q3', source: 'lead', lead_id: 12, quote_type: 'new_business' },
      { staffId: 7, idempotencyKey: 'k1' },
    );

    expect(quoteCreate.create).toHaveBeenCalled();
    expect(repo.create).not.toHaveBeenCalled();
    expect(out).toEqual({
      proposal: {
        id: 1,
        quote_code: 'QT-PTT-2026-000089',
        status: 'draft',
        current_version_id: 'ver-1',
      },
    });
  });

  it('Deal Room create without title still uses repo.create', async () => {
    const { svc, quoteCreate, repo } = loadService({});

    await svc.create({
      customer_id: 3,
      lead_id: 4,
      service_slugs: ['video-sop'],
    });

    expect(quoteCreate.create).not.toHaveBeenCalled();
    expect(repo.create).toHaveBeenCalled();
  });

  it('list with lead_id or customer_id keeps Deal Room repo path', async () => {
    const { svc, repo, quoteList } = loadService({});

    await svc.list('3', undefined);
    expect(repo.listByCustomer).toHaveBeenCalledWith(3);
    expect(quoteList.list).not.toHaveBeenCalled();

    await svc.list(undefined, '4');
    expect(repo.listByLeadId).toHaveBeenCalledWith(4);
  });

  it('list without customer/lead uses quote-list scope filters', async () => {
    const { svc, quoteList, repo } = loadService({});

    await svc.list(undefined, undefined, {
      scope: 'me',
      staffId: 7,
      teamIds: [],
      hasFinance: false,
      q: 'An Phát',
    });

    expect(quoteList.list).toHaveBeenCalled();
    expect(repo.listByCustomer).not.toHaveBeenCalled();
    expect(repo.listByLeadId).not.toHaveBeenCalled();
  });

  it('controller wires Idempotency-Key and scoped list query params', () => {
    const src = readFileSync(join(__dirname, 'proposals.controller.ts'), 'utf8');
    expect(src).toMatch(/idempotency-key/i);
    expect(src).toMatch(/scope/);
    expect(src).toMatch(/pending_my_approval/);
    expect(src).toMatch(/page_size/);
    expect(src).toMatch(/expiring/);
  });

  it('Quote OS create rejects unresolved JWT staff with 403 qt_unresolved_staff', async () => {
    const { svc, quoteCreate } = loadService({});

    await expect(
      svc.create(
        { title: 'An Phát Q3', source: 'lead', lead_id: 12, quote_type: 'new_business' },
        { staffId: 0, staffAuthVia: 'jwt', idempotencyKey: 'k-unresolved' },
      ),
    ).rejects.toMatchObject({ response: { error: 'qt_unresolved_staff' } });
    expect(quoteCreate.create).not.toHaveBeenCalled();
  });

  it('internal key still creates Quote OS with staffId 0', async () => {
    const { svc, quoteCreate } = loadService({});

    await svc.create(
      { title: 'Internal', source: 'blank', agency_client_id: '19d722af-0000-4000-8000-000000000002' },
      { staffId: 0, staffAuthVia: 'internal', idempotencyKey: 'k-internal' },
    );

    expect(quoteCreate.create).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ staffId: 0, staffAuthVia: 'internal' }),
    );
  });

  it('POST create throws qt_unresolved_staff when JWT staff cannot be resolved', async () => {
    const proposals = { create: jest.fn() };
    const staffAuth = { resolveCrmStaffUserId: jest.fn().mockResolvedValue(null) };
    const ctrl = new ProposalsController(
      proposals as never,
      {} as never,
      {} as never,
      {} as never,
      staffAuth as never,
      {} as never,
    );

    await expect(
      ctrl.create(
        { staffAuthVia: 'jwt', staffUser: { sub: 'uuid-1', email: 'a@b.c' } } as never,
        { title: 'An Phát Q3', source: 'lead' },
        'k-jwt',
      ),
    ).rejects.toMatchObject({ response: { error: 'qt_unresolved_staff' } });
    expect(proposals.create).not.toHaveBeenCalled();
  });

  it('POST create with internal key passes staffId 0', async () => {
    const proposals = { create: jest.fn().mockResolvedValue({ proposal: { id: 1 } }) };
    const staffAuth = { resolveCrmStaffUserId: jest.fn() };
    const ctrl = new ProposalsController(
      proposals as never,
      {} as never,
      {} as never,
      {} as never,
      staffAuth as never,
      {} as never,
    );

    await ctrl.create({ staffAuthVia: 'internal' } as never, { title: 'Internal' }, 'k-int');

    expect(staffAuth.resolveCrmStaffUserId).not.toHaveBeenCalled();
    expect(proposals.create).toHaveBeenCalledWith(
      { title: 'Internal' },
      expect.objectContaining({ staffId: 0, staffAuthVia: 'internal' }),
    );
  });

  it('POST create keeps StaffProposalsWriteGuard for Deal Room crm_board.edit', () => {
    const src = readFileSync(join(__dirname, 'proposals.controller.ts'), 'utf8');
    const createBlock = src.slice(src.indexOf('@Post()'), src.indexOf('@Put(\':id/lines\')'));
    expect(createBlock).toMatch(/StaffProposalsWriteGuard/);
    expect(createBlock).not.toMatch(/RequireQuoteAction\('edit'\)/);
  });

  it('Deal Room putLines stays on repo.replaceLines', async () => {
    const { svc, repo, quoteBuilder } = loadService({});
    (svc as unknown as { routeMap: unknown; profiles: unknown; spc: unknown }).routeMap = {
      getMap: () => ({
        services: [{ code: 'DV02', name_vi: 'Content', service_slugs: { primary: 'content' } }],
      }),
    };
    (svc as unknown as { profiles: { getByDvCode: () => Promise<unknown> } }).profiles = {
      getByDvCode: async () => ({ tier_pricing: { standard: { price_vnd: 25000000 } } }),
    };
    (svc as unknown as { spc: { resolveQuoteLineFromSku: () => Promise<never> } }).spc = {
      resolveQuoteLineFromSku: async () => {
        throw new Error('no-sku');
      },
    };
    repo.replaceLines.mockResolvedValue([{ id: 1, final_price_vnd: 25000000 }]);

    await svc.putLines(9, { lines: [{ dv_code: 'DV02', package_tier: 'standard' }] });

    expect(repo.replaceLines).toHaveBeenCalled();
    expect(quoteBuilder.putLines).not.toHaveBeenCalled();
  });

  it('PATCH Deal Room id without quote_code is rejected', async () => {
    const { svc, quoteBuilder, repo } = loadService({});

    await expect(
      svc.patchQuoteHeader(
        9,
        { title: 'Hacked' },
        '1',
        { staffId: 7, staffAuthVia: 'jwt', hasFinance: true },
      ),
    ).rejects.toMatchObject({ response: { error: 'not_a_quote' } });
    expect(quoteBuilder.patchHeader).not.toHaveBeenCalled();
    expect(repo.getById).toHaveBeenCalledWith(9);
  });

  it('Deal Room accept without current_version_id creates one lifecycle per line', async () => {
    const lines = [
      {
        id: 11,
        dv_code: 'DV02',
        sku_code: 'DV02-TC',
        package_tier: 'standard',
        service_slug: 'content',
        final_price_vnd: 20_000_000,
        lifecycle_id: null,
      },
      {
        id: 12,
        dv_code: 'DV03',
        sku_code: 'DV03-TC',
        package_tier: 'standard',
        service_slug: 'seo',
        final_price_vnd: 15_000_000,
        lifecycle_id: null,
      },
    ];
    const { svc, repo, quoteConvert, lifecycle } = loadService({
      repo: {
        getById: jest.fn().mockResolvedValue({
          id: 9,
          customer_id: 3,
          status: 'sent',
          quote_code: null,
          current_version_id: null,
        }),
        listLines: jest.fn().mockResolvedValue(lines),
        patchStatus: jest.fn().mockResolvedValue({ id: 9, status: 'accepted' }),
      },
    });

    const out = await svc.patchStatus(9, { status: 'accepted' });

    expect(quoteConvert.convert).not.toHaveBeenCalled();
    expect(lifecycle.create).toHaveBeenCalledTimes(2);
    expect(repo.setLineLifecycle).toHaveBeenCalledTimes(2);
    expect(out.lifecycles).toEqual([
      { line_id: 11, lifecycle_id: 80, dv_code: 'DV02' },
      { line_id: 12, lifecycle_id: 81, dv_code: 'DV03' },
    ]);
  });

  it('putLines with quote_code delegates to quote-builder', async () => {
    const { svc, repo, quoteBuilder } = loadService({
      repo: {
        getById: jest.fn().mockResolvedValue({
          id: 9,
          status: 'draft',
          quote_code: 'QT-PTT-2026-000001',
          current_version_id: 'ver-1',
        }),
      },
    });
    quoteBuilder.putLines.mockResolvedValue({ proposal_id: 9, lines: [] });

    await svc.putLines(9, { lines: [{ dv_code: 'DV02', package_tier: 'standard' }] });

    expect(quoteBuilder.putLines).toHaveBeenCalled();
    expect(repo.replaceLines).not.toHaveBeenCalled();
  });

  it('GET detail/lines request Quote OS line fields and keep raw status', async () => {
    const { svc, repo } = loadService({
      repo: {
        getById: jest.fn().mockResolvedValue({
          id: 9,
          status: 'pending_approval',
          quote_code: 'QT-PTT-2026-000001',
          current_version_id: 'ver-1',
          title: 'An Phát Q3',
          objective: 'Win',
          audience: 'CFO',
          campaign_period: '2026-Q3',
          agency_client_id: '19d722af-0000-4000-8000-000000000002',
          row_version: 3,
        }),
        listLines: jest.fn().mockResolvedValue([
          { dv_code: 'DV02', item_type: 'fee', qty: 1, package_tier: 'standard' },
        ]),
      },
    });

    const detail = await svc.detail(9);
    const lines = await svc.getLines(9);

    expect(detail.status).toBe('pending_approval');
    expect(detail.title).toBe('An Phát Q3');
    expect(detail.current_version_id).toBe('ver-1');
    expect(repo.listLines).toHaveBeenCalledWith(9, { quoteOs: true });
    expect(lines.lines[0]).toMatchObject({ item_type: 'fee', package_tier: 'standard' });
  });

  it('GET Deal Room detail does not request Quote OS line fields', async () => {
    const { svc, repo } = loadService({
      repo: {
        getById: jest.fn().mockResolvedValue({
          id: 9,
          status: 'draft',
          quote_code: null,
          current_version_id: null,
        }),
        listLines: jest.fn().mockResolvedValue([{ dv_code: 'DV02', package_tier: 'standard' }]),
      },
    });

    await svc.detail(9);
    await svc.getLines(9);

    expect(repo.listLines).toHaveBeenCalledWith(9);
    expect(repo.listLines).not.toHaveBeenCalledWith(9, { quoteOs: true });
  });

  it('reject without lost_reason → 400', async () => {
    const { svc, repo } = loadService({
      repo: {
        getById: jest.fn().mockResolvedValue({
          id: 9,
          status: 'sent',
          quote_code: 'QT-PTT-2026-000001',
        }),
      },
    });

    await expect(svc.patchStatus(9, { status: 'rejected' })).rejects.toMatchObject({
      response: { error: 'lost_reason_required' },
    });
    expect(repo.patchStatus).not.toHaveBeenCalled();
  });

  it('quote OS viewed → rejected stores lost_reason', async () => {
    const { svc, repo } = loadService({
      repo: {
        getById: jest.fn().mockResolvedValue({
          id: 9,
          status: 'viewed',
          quote_code: 'QT-PTT-2026-000001',
        }),
        patchStatus: jest.fn().mockResolvedValue({
          id: 9,
          status: 'rejected',
          lost_reason: 'budget',
        }),
        listLines: jest.fn().mockResolvedValue([]),
      },
    });

    const out = await svc.patchStatus(9, { status: 'rejected', lost_reason: 'budget' });
    expect(out.proposal?.status).toBe('rejected');
    expect(repo.patchStatus).toHaveBeenCalledWith(9, 'rejected', undefined, 'budget');
  });
});
