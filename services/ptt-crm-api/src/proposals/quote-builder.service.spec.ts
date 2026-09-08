import { readFileSync } from 'fs';
import { join } from 'path';
import { QuoteAuditRepository } from './quote-audit.repository';
import {
  isQuoteBuilderTarget,
  isQuoteHeaderComplete,
  parsePaymentTemplate,
  QuoteBuilderService,
} from './quote-builder.service';
import { DEFAULT_QUOTE_TIER_PRICING } from './quote-pricing.util';
import { QuoteVersionsRepository } from './quote-versions.repository';

const CLIENT_ID = '19d722af-0000-4000-8000-000000000002';
const FINANCE = { staffId: 7, staffAuthVia: 'jwt' as const, hasFinance: true };
const NO_FINANCE = { staffId: 7, staffAuthVia: 'jwt' as const, hasFinance: false };

class BuilderMemory {
  sqls: string[] = [];
  proposals = new Map<number, Record<string, unknown>>();
  versions = new Map<string, Record<string, unknown>>();
  lines: Record<string, unknown>[] = [];
  payments: Record<string, unknown>[] = [];
  activity: Record<string, unknown>[] = [];
  catalog = new Map<string, Record<string, unknown>>();
  settings: Record<string, unknown> = {
    tenant_id: 'PTT',
    vat_bps: 800,
    payment_template: '50/30/20',
  };
  nextLineId = 1;
  nextVersion = 1;

  seedQuote(overrides: Record<string, unknown> = {}) {
    const id = Number(overrides.id ?? 9);
    const vid = String(overrides.current_version_id ?? 'ver-1');
    this.proposals.set(id, {
      id,
      quote_code: 'QT-PTT-2026-000001',
      current_version_id: vid,
      row_version: 1,
      status: 'draft',
      title: 'An Phát Q3',
      objective: 'Win retainer',
      audience: 'CFO',
      campaign_period: '2026-Q3',
      agency_client_id: CLIENT_ID,
      customer_id: 44,
      owner_staff_id: 7,
      ...overrides,
    });
    this.versions.set(vid, {
      id: vid,
      proposal_id: id,
      n: 1,
      state: 'working',
      snapshot_json: {},
      fee_vnd: 0,
      media_vnd: 0,
      discount_vnd: 0,
      tax_vnd: 0,
      payable_vnd: 0,
      nsr_vnd: null,
      direct_cost_vnd: null,
      gm_bps: null,
      created_by: 7,
    });
    return { id, vid };
  }

  async withTransaction<T>(
    fn: (query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>) => Promise<T>,
  ): Promise<T> {
    return fn(this.query.bind(this));
  }

  async query(sql: string, params: unknown[] = []) {
    this.sqls.push(sql);
    if (/DELETE FROM crm_proposals/i.test(sql)) {
      throw new Error('must_not_hard_delete_proposals');
    }
    if (/INSERT INTO crm_quote_activity/i.test(sql)) {
      const row = {
        id: `act-${this.activity.length + 1}`,
        proposal_id: params[1],
        version_id: params[2],
        actor_staff_id: params[3],
        actor_kind: params[4],
        action: params[5],
        resource: params[6],
        snapshot_json: params[7] ?? {},
        created_at: new Date().toISOString(),
      };
      this.activity.push(row);
      return { rows: [row] };
    }
    if (/FROM crm_quote_settings/i.test(sql)) {
      return { rows: [this.settings] };
    }
    if (/FROM crm_catalog_services/i.test(sql) || /ops_service_profile/i.test(sql)) {
      const key = String(params[0] ?? '').toUpperCase();
      const row = this.catalog.get(key);
      return { rows: row ? [row] : [] };
    }
    if (/UPDATE crm_proposals/i.test(sql) && /row_version/i.test(sql)) {
      const expected = Number(params.find((p, i) => typeof p === 'number' && i > 0) ?? params[params.length - 2]);
      const id = Number(params[params.length - 1]);
      const row = this.proposals.get(id);
      if (!row || Number(row.row_version) !== expected) return { rows: [], rowCount: 0 };
      const patchKeys = ['title', 'objective', 'audience', 'campaign_period', 'valid_until'];
      let idx = 0;
      for (const key of patchKeys) {
        if (sql.includes(key) && idx < params.length - 2) {
          row[key] = params[idx];
          idx += 1;
        }
      }
      row.row_version = Number(row.row_version) + 1;
      return { rows: [row], rowCount: 1 };
    }
    if (/UPDATE crm_proposals/i.test(sql) && /total_vnd/i.test(sql)) {
      const id = Number(params[params.length - 1]);
      const row = this.proposals.get(id);
      if (row) row.total_vnd = params[0];
      return { rows: row ? [row] : [] };
    }
    if (/FROM crm_proposals/i.test(sql)) {
      const id = Number(params[0]);
      const row = this.proposals.get(id);
      return { rows: row ? [row] : [] };
    }
    if (/INSERT INTO crm_quote_versions/i.test(sql)) {
      const row = {
        id: `ver-${this.nextVersion++}`,
        proposal_id: params[0],
        n: params[1] ?? 1,
        state: 'working',
        snapshot_json: {},
        created_by: params[2],
        fee_vnd: 0,
        media_vnd: 0,
        discount_vnd: 0,
        tax_vnd: 0,
        payable_vnd: 0,
        nsr_vnd: null,
        direct_cost_vnd: null,
        gm_bps: null,
      };
      this.versions.set(String(row.id), row);
      return { rows: [row] };
    }
    if (/UPDATE crm_quote_versions/i.test(sql)) {
      const vid = String(params[params.length - 1] ?? '');
      const row = this.versions.get(vid);
      if (!row) return { rows: [] };
      Object.assign(row, {
        fee_vnd: params[0],
        media_vnd: params[1],
        discount_vnd: params[2],
        tax_vnd: params[3],
        payable_vnd: params[4],
        nsr_vnd: params[5],
        direct_cost_vnd: params[6],
        gm_bps: params[7],
        snapshot_json: params[8],
      });
      return { rows: [row] };
    }
    if (/FROM crm_quote_versions/i.test(sql)) {
      const vid = String(params[0] ?? '');
      const byId = this.versions.get(vid);
      if (byId) return { rows: [byId] };
      const byProposal = [...this.versions.values()].find((v) => Number(v.proposal_id) === Number(params[0]));
      return { rows: byProposal ? [byProposal] : [] };
    }
    if (/DELETE FROM crm_quote_payment_schedules/i.test(sql)) {
      const vid = String(params[0] ?? '');
      this.payments = this.payments.filter((p) => String(p.version_id) !== vid);
      return { rows: [] };
    }
    if (/INSERT INTO crm_quote_payment_schedules/i.test(sql)) {
      const row = {
        id: `pay-${this.payments.length + 1}`,
        version_id: params[0],
        seq: params[1],
        pct_bps: params[2],
        amount_vnd: params[3],
        milestone: params[4],
      };
      this.payments.push(row);
      return { rows: [row] };
    }
    if (/FROM crm_quote_payment_schedules/i.test(sql)) {
      const vid = String(params[0] ?? '');
      return { rows: this.payments.filter((p) => String(p.version_id) === vid) };
    }
    if (/DELETE FROM crm_quote_line_item/i.test(sql)) {
      const pid = Number(params[0]);
      this.lines = this.lines.filter((l) => Number(l.proposal_id) !== pid);
      return { rows: [] };
    }
    if (/INSERT INTO crm_quote_line_item/i.test(sql)) {
      const row = {
        id: this.nextLineId++,
        proposal_id: params[0],
        dv_code: params[1],
        sku_code: params[2],
        package_tier: params[3],
        service_slug: params[4],
        reference_price_min: params[5],
        reference_price_max: params[6],
        final_price_vnd: params[7],
        scope_notes: params[8],
        sort_order: params[9],
        item_type: params[10],
        qty: params[11],
        unit_price_vnd: params[12],
        discount_vnd: params[13],
        media_amount_vnd: params[14],
        tax_vnd: params[15],
        cost_labor_vnd: params[16],
        cost_outsource_vnd: params[17],
        cost_other_vnd: params[18],
        client_visible: params[19],
        catalog_snapshot_json: params[20],
      };
      this.lines.push(row);
      return { rows: [row] };
    }
    if (/FROM crm_quote_line_item/i.test(sql)) {
      const pid = Number(params[0]);
      return { rows: this.lines.filter((l) => Number(l.proposal_id) === pid) };
    }
    return { rows: [] };
  }
}

function load(db = new BuilderMemory()) {
  const versions = new QuoteVersionsRepository(db);
  const audit = new QuoteAuditRepository(db);
  return { db, versions, audit, svc: new QuoteBuilderService(versions, audit) };
}

function activeCatalog(price = 25000000, cost: number | null = 10000000) {
  return {
    dv_code: 'DV02',
    slug: 'content',
    name: 'Content',
    active: true,
    status: 'active',
    service_slug: 'content',
    tier_pricing: {
      standard: {
        price_vnd: price,
        min_vnd: price - 5000000,
        max_vnd: price + 5000000,
        ...(cost != null ? { cost_vnd: cost, cost_labor_vnd: cost } : {}),
      },
    },
  };
}

describe('quote-builder helpers', () => {
  it('delegates to builder when quote_code, current_version_id, or QT line fields exist', () => {
    expect(isQuoteBuilderTarget({ quote_code: 'QT-PTT-2026-000001' }, { lines: [] })).toBe(true);
    expect(isQuoteBuilderTarget({ current_version_id: 'ver-1' }, { lines: [] })).toBe(true);
    expect(
      isQuoteBuilderTarget({}, { lines: [{ dv_code: 'DV02', item_type: 'fee' }] }),
    ).toBe(true);
    expect(isQuoteBuilderTarget({}, { lines: [{ dv_code: 'DV02', package_tier: 'standard' }] })).toBe(
      false,
    );
  });

  it('parses settings payment template 50/30/20 as 10000 bps', () => {
    expect(parsePaymentTemplate('50/30/20')).toEqual([5000, 3000, 2000]);
  });

  it('header complete requires title, client, objective, audience, period', () => {
    expect(
      isQuoteHeaderComplete({
        title: 'An Phát Q3',
        agency_client_id: CLIENT_ID,
        objective: 'Win',
        audience: 'CFO',
        campaign_period: '2026-Q3',
      }),
    ).toBe(true);
    expect(
      isQuoteHeaderComplete({
        title: 'An Phát Q3',
        agency_client_id: CLIENT_ID,
        objective: '',
        audience: 'CFO',
        campaign_period: '2026-Q3',
      }),
    ).toBe(false);
  });
});

describe('QuoteBuilderService', () => {
  it('AC-09 Draft catalog add returns 400 catalog_not_active', async () => {
    const { db, svc } = load();
    db.seedQuote();
    db.catalog.set('DV02', { ...activeCatalog(), status: 'draft', active: false });

    await expect(
      svc.putLines(
        9,
        { lines: [{ dv_code: 'DV02', package_tier: 'TieuChuan', client_visible: true }] },
        FINANCE,
      ),
    ).rejects.toMatchObject({ response: { error: 'catalog_not_active' } });
  });

  it('missing catalog rate returns rate_missing and does not use default 10tr', async () => {
    const { db, svc } = load();
    db.seedQuote();
    db.catalog.set('DV02', { ...activeCatalog(), tier_pricing: {} });

    await expect(
      svc.putLines(9, { lines: [{ dv_code: 'DV02', package_tier: 'standard' }] }, FINANCE),
    ).rejects.toMatchObject({ response: { error: 'rate_missing' } });
  });

  it('AC-02 snapshot stays put after catalog price change', async () => {
    const { db, svc } = load();
    const { vid } = db.seedQuote();
    db.catalog.set('DV02', activeCatalog(25000000, 10000000));

    const written = await svc.putLines(
      9,
      { lines: [{ dv_code: 'DV02', package_tier: 'standard', qty: 1 }] },
      FINANCE,
    );
    expect(written.lines[0].package_tier).toBe('standard');
    expect(written.lines[0].catalog_snapshot_json).toMatchObject({
      dv_code: 'DV02',
      package_tier: 'standard',
      rate: expect.objectContaining({ suggested_vnd: 25000000 }),
    });

    db.catalog.set('DV02', activeCatalog(99900000, 10000000));
    const recalc = await svc.recalculate(9, vid, FINANCE);

    expect(recalc.fee_vnd).toBe(25000000);
    expect(recalc.snapshot.lines[0].catalog_snapshot_json.rate?.suggested_vnd).toBe(25000000);
    expect(recalc.snapshot.lines[0].catalog_snapshot_json.rate?.suggested_vnd).not.toBe(99900000);
  });

  it('flags missing catalog cost and never invents cost_* as 0', async () => {
    const { db, svc } = load();
    const { vid } = db.seedQuote();
    db.catalog.set('DV02', activeCatalog(25000000, null));

    const written = await svc.putLines(
      9,
      { lines: [{ dv_code: 'DV02', package_tier: 'standard' }] },
      FINANCE,
    );
    expect(written.flags?.cost_missing).toBe(true);
    expect(written.lines[0].cost_labor_vnd).toBeNull();
    expect(written.lines[0].cost_outsource_vnd).toBeNull();
    expect(written.lines[0].cost_other_vnd).toBeNull();

    const recalc = await svc.recalculate(9, vid, FINANCE);
    expect(recalc.flags?.cost_missing).toBe(true);
    expect(recalc.direct_cost_vnd).toBeNull();
    expect(recalc.gm_bps).toBeNull();
    expect(recalc.cost_labor_vnd).toBeNull();
    expect(JSON.stringify(recalc)).not.toMatch(/"cost_labor_vnd":0/);
  });

  it('BLD-05 cost fields 403 without crm_quote.finance', async () => {
    const { db, svc } = load();
    db.seedQuote();
    db.catalog.set('DV02', activeCatalog());

    await expect(
      svc.putLines(
        9,
        { lines: [{ dv_code: 'DV02', package_tier: 'standard', cost_labor_vnd: 1 }] },
        NO_FINANCE,
      ),
    ).rejects.toMatchObject({ response: { error: 'missing_cap', section: 'crm_quote.finance' } });

    await expect(svc.recalculate(9, 'ver-1', { ...NO_FINANCE, includeFinance: true })).rejects.toMatchObject({
      response: { error: 'missing_cap', section: 'crm_quote.finance' },
    });
  });

  it('recalc without finance omits cost_* instead of sending 0', async () => {
    const { db, svc } = load();
    const { vid } = db.seedQuote();
    db.catalog.set('DV02', activeCatalog());
    await svc.putLines(9, { lines: [{ dv_code: 'DV02', package_tier: 'standard' }] }, FINANCE);

    const out = await svc.recalculate(9, vid, NO_FINANCE);
    expect(out).not.toHaveProperty('cost_labor_vnd');
    expect(out).not.toHaveProperty('direct_cost_vnd');
    expect(out).not.toHaveProperty('gm_bps');
    expect(out).not.toHaveProperty('nsr_vnd');
    expect(JSON.stringify(out)).not.toMatch(/"cost_/);
  });

  it('AC-07 payable 265647600 with 50/30/20 remainder on last', async () => {
    const { db, svc } = load();
    const { vid } = db.seedQuote();
    db.catalog.set(
      'DV02',
      activeCatalog(125970000, null),
    );
    db.catalog.set('DV20', {
      dv_code: 'DV20',
      slug: 'media',
      name: 'Media',
      active: true,
      status: 'active',
      service_slug: 'media',
      tier_pricing: {
        standard: { price_vnd: 120000000, min_vnd: 120000000, max_vnd: 120000000 },
      },
    });

    await svc.putLines(
      9,
      {
        lines: [
          { dv_code: 'DV02', package_tier: 'standard', item_type: 'fee', qty: 1 },
          { dv_code: 'DV20', package_tier: 'standard', item_type: 'media', media_vnd: 120000000 },
        ],
      },
      FINANCE,
    );
    const payments = await svc.putPayments(
      vid,
      { items: [{ pct_bps: 5000 }, { pct_bps: 3000 }, { pct_bps: 2000 }] },
      FINANCE,
    );
    const recalc = await svc.recalculate(9, vid, FINANCE);

    expect(recalc.payable_vnd).toBe(265647600);
    expect(recalc.fee_vnd).toBe(125970000);
    expect(recalc.media_vnd).toBe(120000000);
    expect(recalc.nsr_vnd).toBe(125970000);
    expect(payments.items.map((p) => Number(p.amount_vnd))).toEqual([
      132823800, 79694280, 53129520,
    ]);
    expect(payments.items.reduce((s, p) => s + Number(p.amount_vnd), 0)).toBe(265647600);
    expect(recalc.payments.map((p) => Number(p.amount_vnd))).toEqual([
      132823800, 79694280, 53129520,
    ]);
  });

  it('If-Match stale header patch returns 409 and does not write', async () => {
    const { db, svc } = load();
    db.seedQuote({ row_version: 2 });

    await expect(svc.patchHeader(9, { title: 'Hacked' }, undefined, FINANCE)).rejects.toMatchObject({
      response: { error: 'if_match_required' },
    });
    await expect(
      svc.patchHeader(9, { title: 'Hacked' }, '1', FINANCE),
    ).rejects.toMatchObject({ status: 409 });
    expect(db.proposals.get(9)?.title).toBe('An Phát Q3');
    expect(db.proposals.get(9)?.row_version).toBe(2);
  });

  it('If-Match success bumps row_version', async () => {
    const { db, svc } = load();
    db.seedQuote({ row_version: 2 });

    const out = await svc.patchHeader(
      9,
      { title: 'An Phát Q3 revised', objective: 'Win', audience: 'CFO', campaign_period: '2026-Q3' },
      '2',
      FINANCE,
    );
    expect(out.row_version).toBe(3);
    expect(out.title).toBe('An Phát Q3 revised');
  });

  it('recalc rejects incomplete header, hidden-only lines, and payment pct != 10000', async () => {
    const { db, svc } = load();
    const { vid } = db.seedQuote({ objective: '' });
    db.catalog.set('DV02', activeCatalog());

    await expect(svc.recalculate(9, vid, FINANCE)).rejects.toMatchObject({
      response: { error: 'header_incomplete' },
    });

    db.proposals.get(9)!.objective = 'Win';
    await expect(svc.recalculate(9, vid, FINANCE)).rejects.toMatchObject({
      response: { error: 'client_visible_line_required' },
    });

    await svc.putLines(9, { lines: [{ dv_code: 'DV02', package_tier: 'standard' }] }, FINANCE);
    await expect(
      svc.putPayments(vid, { items: [{ pct_bps: 5000 }, { pct_bps: 3000 }, { pct_bps: 1000 }] }, FINANCE),
    ).rejects.toMatchObject({ response: { error: 'payment_pct_invalid' } });
  });

  it('NSR=0 yields GM null and media is excluded from NSR', async () => {
    const { db, svc } = load();
    const { vid } = db.seedQuote();
    db.catalog.set('DV20', {
      dv_code: 'DV20',
      slug: 'media',
      name: 'Media',
      active: true,
      status: 'active',
      service_slug: 'media',
      tier_pricing: {
        standard: { price_vnd: 120000000, min_vnd: 120000000, max_vnd: 120000000 },
      },
    });
    await svc.putLines(
      9,
      { lines: [{ dv_code: 'DV20', package_tier: 'standard', item_type: 'media', media_vnd: 120000000 }] },
      FINANCE,
    );
    const out = await svc.recalculate(9, vid, FINANCE);
    expect(out.nsr_vnd).toBe(0);
    expect(out.gm_bps).toBeNull();
    expect(out.media_vnd).toBe(120000000);
  });

  it('unresolved JWT staff is 403 qt_unresolved_staff; internal may use staffId 0', async () => {
    const { db, svc } = load();
    db.seedQuote();
    db.catalog.set('DV02', activeCatalog());

    await expect(
      svc.putLines(
        9,
        { lines: [{ dv_code: 'DV02', package_tier: 'standard' }] },
        { staffId: 0, staffAuthVia: 'jwt', hasFinance: true },
      ),
    ).rejects.toMatchObject({ response: { error: 'qt_unresolved_staff' } });

    await expect(
      svc.putLines(
        9,
        { lines: [{ dv_code: 'DV02', package_tier: 'standard' }] },
        { staffId: 0, staffAuthVia: 'internal', hasFinance: true },
      ),
    ).resolves.toMatchObject({ proposal_id: 9 });
  });

  it('product add does not fall back to DEFAULT_QUOTE_TIER_PRICING', async () => {
    expect(DEFAULT_QUOTE_TIER_PRICING.basic.price_vnd).toBe(10000000);
    const src = readFileSync(join(__dirname, 'quote-builder.service.ts'), 'utf8');
    expect(src).toMatch(/resolveProductTierPricing/);
    expect(src).not.toMatch(/DEFAULT_QUOTE_TIER_PRICING/);
    expect(src).toMatch(/allowDefaultFallback\s*=\s*false|resolveProductTierPricing/);
  });
});

describe('Quote OS HTTP wiring', () => {
  it('exposes PATCH If-Match, recalc, and quote-versions payments routes', () => {
    const proposals = readFileSync(join(__dirname, 'proposals.controller.ts'), 'utf8');
    const versions = readFileSync(join(__dirname, 'quote-versions.controller.ts'), 'utf8');
    const mod = readFileSync(join(__dirname, 'proposals.module.ts'), 'utf8');
    expect(proposals).toMatch(/@Patch\(':id'\)/);
    expect(proposals).toMatch(/if-match/i);
    expect(proposals).toMatch(/versions\/:vid\/recalculate/);
    expect(versions).toMatch(/@Controller\('api\/crm\/quote-versions'\)/);
    expect(versions).toMatch(/@Put\(':vid\/payments'\)/);
    expect(versions).toMatch(/StaffProposalsWriteGuard/);
    expect(mod).toMatch(/QuoteBuilderService/);
    expect(mod).toMatch(/QuoteVersionsRepository/);
    expect(mod).toMatch(/QuoteVersionsController/);
  });
});
