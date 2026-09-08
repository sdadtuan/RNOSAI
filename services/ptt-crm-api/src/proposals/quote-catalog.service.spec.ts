import 'reflect-metadata';
import { readFileSync } from 'fs';
import { join } from 'path';
import { SpcService } from '../spc/spc.service';
import { DEFAULT_QUOTE_TIER_PRICING } from './quote-pricing.util';
import { QT_CATALOG_NAV_GROUPS, QuoteCatalogService } from './quote-catalog.service';

const STANDARD_RATE = {
  basic: { price_vnd: 12_000_000, min_vnd: 10_000_000, max_vnd: 14_000_000 },
  standard: { price_vnd: 16_000_000, min_vnd: 14_000_000, max_vnd: 18_000_000 },
  premium: { price_vnd: 22_000_000, min_vnd: 20_000_000, max_vnd: 26_000_000 },
};

type CatalogRow = {
  dv_code: string;
  slug: string;
  name: string;
  active: boolean;
  status: string;
  service_slug: string;
  tier_pricing: Record<string, unknown>;
};

class CatalogMemory {
  rows: CatalogRow[] = [];
  sqls: string[] = [];

  async query(sql: string) {
    this.sqls.push(sql);
    if (/FROM crm_catalog_services/i.test(sql) || /FROM ops_service_profile/i.test(sql)) {
      return { rows: this.rows };
    }
    return { rows: [] };
  }
}

function family(dv: string, name: string) {
  return {
    dv_code: dv,
    name_vi: name,
    readiness: 'ready',
    depends_on_dv: [],
    service_slug: dv.toLowerCase(),
    default_sku_code: `${dv}-TC`,
    offers: [{ sku_code: `${dv}-TC`, tier: 'standard' }],
  };
}

function load(
  rows: CatalogRow[],
  spcFamilies: ReturnType<typeof family>[] = [],
  spcImpl?: { getQuoteCatalog: jest.Mock },
) {
  const db = new CatalogMemory();
  db.rows = rows;
  const spc = {
    getQuoteCatalog:
      spcImpl?.getQuoteCatalog ??
      jest.fn().mockResolvedValue({
        schema_version: '1.0.0',
        package_tiers: ['basic', 'standard', 'premium'],
        primary_dv: null,
        primary_sku: null,
        suggested_bundle: [],
        combo_warnings: [],
        families: spcFamilies,
      }),
  };
  return { db, spc, svc: new QuoteCatalogService(db, spc as never) };
}

function row(partial: Partial<CatalogRow> & Pick<CatalogRow, 'dv_code' | 'name'>): CatalogRow {
  const active = partial.active !== false;
  return {
    slug: partial.slug ?? partial.dv_code.toLowerCase(),
    service_slug: partial.service_slug ?? partial.dv_code.toLowerCase(),
    active,
    status: partial.status ?? (active ? 'active' : 'draft'),
    tier_pricing: partial.tier_pricing ?? {},
    ...partial,
  };
}

function itemOf(out: { families?: Array<Record<string, unknown>>; services?: Array<Record<string, unknown>> }, dv: string) {
  const lists = [...(out.families ?? []), ...(out.services ?? [])];
  const found = lists.find((item) => String(item.dv_code).toUpperCase() === dv.toUpperCase());
  if (!found) throw new Error(`missing catalog item ${dv}`);
  return found;
}

describe('QuoteCatalogService CAT-01 add rules', () => {
  it('keeps SpcService as the Nest design:type so ProposalsModule can boot', () => {
    const types = Reflect.getMetadata('design:paramtypes', QuoteCatalogService) as unknown[];
    expect(types[1]).toBe(SpcService);
  });

  it('Draft cannot add to client-facing quote', async () => {
    const { svc } = load([
      row({
        dv_code: 'DV11',
        name: 'CRM, Automation & AI',
        active: false,
        status: 'draft',
        tier_pricing: STANDARD_RATE,
      }),
    ]);

    const out = await svc.get();
    const item = itemOf(out, 'DV11');

    expect(item.status).toBe('draft');
    expect(item.can_add_to_client_quote).toBe(false);
    expect(item.group).toBe('crm');
  });

  it('Active + valid rate can add to client-facing quote', async () => {
    const { svc } = load(
      [
        row({
          dv_code: 'DV08',
          name: 'Meta Ads Performance',
          active: true,
          tier_pricing: STANDARD_RATE,
        }),
      ],
      [family('DV08', 'Meta Ads Performance')],
    );

    const out = await svc.get();
    const item = itemOf(out, 'DV08');

    expect(item.status).toBe('active');
    expect(item.can_add_to_client_quote).toBe(true);
    expect(item.rate_missing).toBe(false);
    expect(item.group).toBe('performance');
    expect(item.dv_code).toBe('DV08');
    expect(Array.isArray(item.package_tiers)).toBe(true);
    expect((item.package_tiers as Array<{ tier: string }>).map((t) => t.tier)).toEqual([
      'basic',
      'standard',
      'premium',
    ]);
  });

  it('missing rate sets rate_missing and does not invent 10tr', async () => {
    const { svc } = load([
      row({
        dv_code: 'DV03',
        name: 'Website & Landing Page',
        active: true,
        tier_pricing: {},
      }),
    ]);

    const out = await svc.get();
    const item = itemOf(out, 'DV03');

    expect(item.status).toBe('active');
    expect(item.rate_missing).toBe(true);
    expect(item.can_add_to_client_quote).toBe(false);
    expect(item.group).toBe('web');
    const tiers = item.package_tiers as Array<{
      suggested_vnd: number | null;
      rate_missing: boolean;
    }>;
    expect(tiers.every((tier) => tier.rate_missing)).toBe(true);
    expect(tiers.every((tier) => tier.suggested_vnd !== 10_000_000)).toBe(true);
    expect(tiers.every((tier) => tier.suggested_vnd !== DEFAULT_QUOTE_TIER_PRICING.basic.price_vnd)).toBe(
      true,
    );
  });

  it('exposes exactly the 13 CAT-01 nav groups; package is extra', async () => {
    const { svc } = load([
      row({ dv_code: 'PKG01', name: 'Package ngành BĐS', slug: 'package-bds', active: true }),
    ]);

    const out = await svc.get();

    expect(QT_CATALOG_NAV_GROUPS).toEqual([
      'strategy',
      'branding',
      'content',
      'production',
      'performance',
      'web',
      'seo',
      'crm',
      'retention',
      'pr',
      'event',
      'sales',
      'data',
    ]);
    expect(out.groups).toEqual([...QT_CATALOG_NAV_GROUPS]);
    expect(out.groups).toHaveLength(13);
    expect(out.groups).not.toContain('package');
    expect(itemOf(out, 'PKG01').group).toBe('package');
  });

  it('CAT-05 returns VID-TPL-01 on DV12 / brand-film and no video binary', async () => {
    const { svc } = load([
      row({
        dv_code: 'DV12',
        name: 'Brand Film / Reels',
        slug: 'brand-film',
        active: true,
        tier_pricing: STANDARD_RATE,
      }),
    ]);

    const out = await svc.get();
    const item = itemOf(out, 'DV12');

    expect(item.group).toBe('production');
    expect(item.template_key).toBe('VID-TPL-01');
    expect(item).not.toHaveProperty('video');
    expect(item).not.toHaveProperty('video_binary');
    expect(item).not.toHaveProperty('video_url');
    expect(JSON.stringify(item)).not.toMatch(/data:video|video\/mp4/);
  });

  it('groups live DV12 market research from SoR name and does not attach VID-TPL-01', async () => {
    const { svc } = load([
      row({
        dv_code: 'DV12',
        name: 'Báo cáo phân tích thị trường',
        slug: 'phan-tich-thi-truong',
        active: true,
        tier_pricing: STANDARD_RATE,
      }),
    ]);

    const out = await svc.get();
    const item = itemOf(out, 'DV12');

    expect(item.group).toBe('strategy');
    expect(item.dv_code).toBe('DV12');
    expect(item).not.toHaveProperty('template_key');
    expect(item.template_key).not.toBe('VID-TPL-01');
  });

  it('attaches VID-TPL-01 for brand-film / reels / video storyboard regardless of dv_code', async () => {
    const { svc } = load([
      row({
        dv_code: 'DV05',
        name: 'Video storyboard',
        slug: 'video-storyboard',
        active: true,
        tier_pricing: STANDARD_RATE,
      }),
    ]);

    const out = await svc.get();
    const item = itemOf(out, 'DV05');

    expect(item.template_key).toBe('VID-TPL-01');
    expect(item.group).toBe('production');
  });

  it('SPC-only family with no SoR row is draft and cannot add', async () => {
    const { svc } = load([], [family('DV08', 'CRM Automation')]);

    const out = await svc.get();
    const item = itemOf(out, 'DV08');

    expect(item.status).toBe('draft');
    expect(item.can_add_to_client_quote).toBe(false);
  });

  it('wraps SPC getQuoteCatalog and keeps family offers', async () => {
    const { svc, spc } = load(
      [
        row({
          dv_code: 'DV05',
          name: 'Content & Social retainer',
          active: true,
          tier_pricing: STANDARD_RATE,
        }),
      ],
      [family('DV05', 'Content & Social retainer')],
    );

    const out = await svc.get('tiep-thi-noi-dung');

    expect(spc.getQuoteCatalog).toHaveBeenCalledWith('tiep-thi-noi-dung');
    const item = itemOf(out, 'DV05');
    expect(item.group).toBe('content');
    expect(item.offers).toEqual([{ sku_code: 'DV05-TC', tier: 'standard' }]);
    expect(out.schema_version).toBe('1.0.0');
  });

  it('product catalog does not fall back to DEFAULT_QUOTE_TIER_PRICING', () => {
    expect(DEFAULT_QUOTE_TIER_PRICING.basic.price_vnd).toBe(10_000_000);
    const src = readFileSync(join(__dirname, 'quote-catalog.service.ts'), 'utf8');
    expect(src).toMatch(/resolveProductTierPricing/);
    expect(src).not.toMatch(/DEFAULT_QUOTE_TIER_PRICING/);
  });

  it('GET quote-catalog path stays on proposals controller with view guard', () => {
    const src = readFileSync(join(__dirname, 'proposals.controller.ts'), 'utf8');
    expect(src).toMatch(/@Get\('quote-catalog'\)/);
    expect(src.indexOf("@Get('quote-catalog')")).toBeLessThan(src.indexOf("@Get(':id')"));
    expect(src).toMatch(/StaffProposalsViewGuard/);
  });
});
