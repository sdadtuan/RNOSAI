import 'reflect-metadata';
import { readFileSync } from 'fs';
import { join } from 'path';
import { SpcService } from '../spc/spc.service';
import { DEFAULT_QUOTE_TIER_PRICING } from './quote-pricing.util';
import { ProposalsController } from './proposals.controller';
import {
  QT_CATALOG_NAV_GROUPS,
  QT_PORTFOLIO_DV_CODES,
  QT_RATE_SEED_EXTRA_DV,
  QuoteCatalogService,
  quoteIndustryPackageDvCodes,
} from './quote-catalog.service';

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

type RateCardRow = {
  id: string;
  tenant_id?: string;
  dv_code: string;
  package_tier: string;
  fee_vnd: number;
  cost_labor_vnd?: number | null;
  effective_from: string;
  effective_to: string | null;
  state: string;
};

class CatalogMemory {
  rows: CatalogRow[] = [];
  rateCards: RateCardRow[] = [];
  sqls: string[] = [];

  async query(sql: string) {
    this.sqls.push(sql);
    if (/FROM crm_quote_rate_cards/i.test(sql)) {
      return { rows: this.rateCards };
    }
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
  spcFamilies: Array<Record<string, unknown>> = [],
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
          dv_code: 'DV04',
          name: 'Meta Ads Performance',
          active: true,
          tier_pricing: STANDARD_RATE,
        }),
      ],
      [family('DV04', 'Meta Ads Performance')],
    );

    const out = await svc.get();
    const item = itemOf(out, 'DV04');

    expect(item.status).toBe('active');
    expect(item.can_add_to_client_quote).toBe(true);
    expect(item.rate_missing).toBe(false);
    expect(item.group).toBe('performance');
    expect(item.dv_code).toBe('DV04');
    expect(item.sku_codes).toEqual(['DV04-CB', 'DV04-TC', 'DV04-CS']);
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

  it('always returns Portfolio DV01–21 even when SoR and SPC are empty', async () => {
    const { svc } = load([]);
    const out = await svc.get();
    const codes = (out.families as Array<{ dv_code: string }>).map((item) => item.dv_code);
    expect(codes.filter((code) => /^DV\d{2}$/.test(code))).toEqual(QT_PORTFOLIO_DV_CODES);
    expect(itemOf(out, 'DV01').name_vi).toBe('Hệ thống nhận diện Thương hiệu');
    expect(itemOf(out, 'DV01').status).toBe('draft');
    expect(itemOf(out, 'DV19').group).toBe('performance');
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
          dv_code: 'DV02',
          name: 'Content & Social retainer',
          active: true,
          tier_pricing: STANDARD_RATE,
        }),
      ],
      [family('DV02', 'Content & Social retainer')],
    );

    const out = await svc.get('tiep-thi-noi-dung');

    expect(spc.getQuoteCatalog).toHaveBeenCalledWith('tiep-thi-noi-dung');
    const item = itemOf(out, 'DV02');
    expect(item.group).toBe('content');
    expect(item.offers).toEqual([{ sku_code: 'DV02-TC', tier: 'standard' }]);
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
    expect(src).toMatch(/@Get\('quote-catalog\/packages'\)/);
    expect(src).toMatch(/@Get\('quote-catalog\/rate-cards'\)/);
    expect(src).toMatch(/@RequireQuoteSection\('crm_quote.catalog', 'view'\)/);
    expect(src).toMatch(/StaffQuoteGuard/);
    expect(src.indexOf("@Get('quote-catalog/rate-cards')")).toBeLessThan(src.indexOf("@Get(':id')"));
  });
});

describe('QuoteCatalogService CAT-03 packages + CAT-04 rates', () => {
  function packageCatalogRows(): CatalogRow[] {
    return [
      row({ dv_code: 'DV12', name: 'Báo cáo phân tích thị trường', active: true, tier_pricing: STANDARD_RATE }),
      row({ dv_code: 'DV04', name: 'Quảng cáo tối ưu chuyển đổi', active: true, tier_pricing: STANDARD_RATE }),
      row({ dv_code: 'DV03', name: 'Website & Landing Page', active: true, tier_pricing: STANDARD_RATE }),
      row({ dv_code: 'DV02', name: 'Chiến lược nội dung & Mạng xã hội', active: true, tier_pricing: STANDARD_RATE }),
    ];
  }

  it('package add snapshots N lines', async () => {
    const { svc } = load(packageCatalogRows());

    const out = await svc.snapshotPackage('growth_launch', '2026-09-08');

    expect(out.package_key).toBe('growth_launch');
    expect(out.package_discount_bps).toBeGreaterThan(0);
    expect(out.lines.length).toBeGreaterThan(1);
    expect(out.lines.every((line) => line.catalog_snapshot_json?.dv_code)).toBe(true);
    expect(out.lines.every((line) => line.catalog_snapshot_json?.quoted_at)).toBe(true);
    expect(out.lines.map((line) => line.dv_code)).toEqual(
      expect.arrayContaining(['DV12', 'DV04', 'DV03', 'DV02']),
    );
    const frozen = structuredClone(out.lines[0].catalog_snapshot_json);
    const live = await svc.get();
    const item = itemOf(live, String(out.lines[0].dv_code));
    (item as { package_tiers: Array<{ suggested_vnd: number }> }).package_tiers[1].suggested_vnd =
      99_000_000;
    expect(out.lines[0].catalog_snapshot_json).toEqual(frozen);
    expect(out.lines[0].catalog_snapshot_json.rate?.suggested_vnd).not.toBe(99_000_000);
  });

  it('expired rate → rate_expired', async () => {
    const { db, svc } = load([
      row({ dv_code: 'DV04', name: 'Quảng cáo tối ưu chuyển đổi', active: true, tier_pricing: STANDARD_RATE }),
    ]);
    db.rateCards = [
      {
        id: 'rc-expired',
        tenant_id: 'PTT',
        dv_code: 'DV08',
        package_tier: 'standard',
        fee_vnd: 12_000_000,
        cost_labor_vnd: 7_000_000,
        effective_from: '2025-01-01',
        effective_to: '2025-12-31',
        state: 'retired',
      },
    ];

    await expect(svc.resolveRate('DV08', 'standard', '2026-09-08')).rejects.toMatchObject({
      response: { error: 'rate_expired' },
    });

    const listed = await svc.listRateCards('2026-09-08');
    expect(listed.items[0].rate_expired).toBe(true);
    expect(listed.items[0].state).toBe('retired');
  });

  it('retired pill vs date-expired: Retired stays Retired; rate_expired is date-only', async () => {
    const { db, svc } = load([
      row({ dv_code: 'DV04', name: 'Quảng cáo tối ưu chuyển đổi', active: true, tier_pricing: STANDARD_RATE }),
    ]);
    db.rateCards = [
      {
        id: 'rc-retired-live',
        tenant_id: 'PTT',
        dv_code: 'DV08',
        package_tier: 'standard',
        fee_vnd: 12_000_000,
        cost_labor_vnd: 7_000_000,
        effective_from: '2026-01-01',
        effective_to: '2026-12-31',
        state: 'retired',
      },
      {
        id: 'rc-active-expired',
        tenant_id: 'PTT',
        dv_code: 'DV05',
        package_tier: 'standard',
        fee_vnd: 18_000_000,
        cost_labor_vnd: 11_000_000,
        effective_from: '2025-01-01',
        effective_to: '2025-12-31',
        state: 'active',
      },
    ];

    const listed = await svc.listRateCards('2026-09-08');
    const retired = listed.items.find((item) => item.id === 'rc-retired-live');
    const expired = listed.items.find((item) => item.id === 'rc-active-expired');
    expect(retired).toMatchObject({ state: 'retired', rate_expired: false });
    expect(expired).toMatchObject({ state: 'active', rate_expired: true });
  });

  it('can_add is false when only expired rate cards exist', async () => {
    const { db, svc } = load(packageCatalogRows());
    db.rateCards = [
      {
        id: 'rc-only-expired',
        tenant_id: 'PTT',
        dv_code: 'DV04',
        package_tier: 'standard',
        fee_vnd: 12_000_000,
        cost_labor_vnd: 7_000_000,
        effective_from: '2025-01-01',
        effective_to: '2025-12-31',
        state: 'retired',
      },
    ];

    const out = await svc.get(undefined, { hasFinance: true });
    expect(itemOf(out, 'DV04').can_add_to_client_quote).toBe(false);
    const growth = (out.packages as Array<{ key: string; can_add: boolean }>).find(
      (pkg) => pkg.key === 'growth_launch',
    );
    expect(growth?.can_add).toBe(false);
  });

  it('finance payload includes cost field (null or number)', async () => {
    const { db, svc } = load([
      row({ dv_code: 'DV04', name: 'Quảng cáo tối ưu chuyển đổi', active: true, tier_pricing: STANDARD_RATE }),
      row({ dv_code: 'DV05', name: 'Tối ưu SEO & AEO', active: true, tier_pricing: STANDARD_RATE }),
    ]);
    db.rateCards = [
      {
        id: 'rc-live',
        tenant_id: 'PTT',
        dv_code: 'DV04',
        package_tier: 'standard',
        fee_vnd: 16_000_000,
        cost_labor_vnd: 9_200_000,
        effective_from: '2026-01-01',
        effective_to: '2026-12-31',
        state: 'active',
      },
    ];

    const withFinance = await svc.get(undefined, { hasFinance: true });
    const dv04 = itemOf(withFinance, 'DV04').drawer as {
      pricing: { cost_labor_vnd: number | null; restricted?: boolean; media_pass_through?: boolean };
    };
    const dv05 = itemOf(withFinance, 'DV05').drawer as {
      pricing: { cost_labor_vnd: number | null };
    };
    expect(dv04.pricing.restricted).not.toBe(true);
    expect(dv04.pricing.cost_labor_vnd).toBe(9_200_000);
    expect(dv04.pricing.media_pass_through).toBe(true);
    expect(dv05.pricing.cost_labor_vnd).toBeNull();

    const noFinance = await svc.get();
    expect((itemOf(noFinance, 'DV04').drawer as { pricing: { restricted: boolean } }).pricing.restricted).toBe(
      true,
    );
  });

  it('GET catalog works with staffId 0 / unresolved', async () => {
    const proposals = {
      getCatalogForQuote: jest.fn().mockResolvedValue({ families: [], packages: [] }),
    };
    const staffAuth = {
      resolveCrmStaffUserId: jest.fn().mockResolvedValue(null),
      me: jest.fn().mockResolvedValue(null),
      hasCap: jest.fn().mockReturnValue(false),
    };
    const ctrl = new ProposalsController(
      proposals as never,
      {} as never,
      {} as never,
      {} as never,
      staffAuth as never,
      {} as never,
    );

    await expect(
      ctrl.getQuoteCatalog({ staffAuthVia: 'jwt', staffUser: { sub: 'uuid-1' } } as never),
    ).resolves.toEqual({ families: [], packages: [] });
    expect(proposals.getCatalogForQuote).toHaveBeenCalled();
    expect(staffAuth.resolveCrmStaffUserId).not.toHaveBeenCalled();

    await expect(ctrl.getQuoteCatalog({ staffAuthVia: 'internal' } as never)).resolves.toEqual({
      families: [],
      packages: [],
    });
  });

  it('draft catalog still cannot add via industry package', async () => {
    const { svc } = load([
      row({
        dv_code: 'DV02',
        name: 'Chiến lược nội dung & Mạng xã hội',
        active: false,
        status: 'draft',
        tier_pricing: STANDARD_RATE,
      }),
      row({ dv_code: 'DV04', name: 'Quảng cáo tối ưu chuyển đổi', active: true, tier_pricing: STANDARD_RATE }),
      row({ dv_code: 'DV03', name: 'Website & Landing Page', active: true, tier_pricing: STANDARD_RATE }),
      row({ dv_code: 'DV12', name: 'Báo cáo phân tích thị trường', active: true, tier_pricing: STANDARD_RATE }),
    ]);

    await expect(svc.snapshotPackage('growth_launch', '2026-09-08')).rejects.toMatchObject({
      response: { error: 'catalog_not_active' },
    });
  });

  it('fills drawer from DV playbook when SPC family has no scope lines', async () => {
    const { svc } = load([
      row({
        dv_code: 'DV19',
        name: 'Vận hành & Quảng cáo trên sàn TMĐT',
        active: true,
        tier_pricing: STANDARD_RATE,
      }),
    ]);

    const out = await svc.get();
    const item = itemOf(out, 'DV19');
    const drawer = item.drawer as {
      overview: { included: string[]; assume: string[]; channel_lines: string[] };
      kpi: { items: Array<{ kind: string }>; forecast: string };
      policy: { sku_codes: string[]; assumptions_required: boolean };
    };

    expect(item.group).toBe('performance');
    expect(item.media_pass_through).toBe(true);
    expect(drawer.overview.included.length).toBeGreaterThan(0);
    expect(drawer.overview.assume.some((row) => /Rate Card/i.test(row))).toBe(true);
    expect(drawer.overview.channel_lines).toEqual(
      expect.arrayContaining(['TikTok Shop']),
    );
    expect(drawer.kpi.items.some((row) => row.kind === 'forecast')).toBe(true);
    expect(drawer.kpi.forecast).toMatch(/GMV/);
    expect(drawer.policy.sku_codes).toEqual(['DV19-CB', 'DV19-TC', 'DV19-CS']);
    expect(drawer.policy.assumptions_required).toBe(true);
  });

  it('keeps SPC offer lines over playbook defaults', async () => {
    const { svc } = load(
      [row({ dv_code: 'DV04', name: 'Quảng cáo tối ưu chuyển đổi', active: true, tier_pricing: STANDARD_RATE })],
      [
        {
          dv_code: 'DV04',
          name_vi: 'Quảng cáo tối ưu chuyển đổi',
          readiness: 'ready',
          depends_on_dv: [],
          service_slug: 'dv04',
          default_sku_code: 'DV04-TC',
          offers: [
            {
              sku_code: 'DV04-TC',
              tier: 'standard',
              lines: [
                { label_vi: 'SPC pixel only', included_by_default: true },
                { label_vi: 'SPC media buy', included_by_default: false },
              ],
            },
          ],
        },
      ],
    );

    const drawer = itemOf(await svc.get(), 'DV04').drawer as {
      overview: { included: string[]; excluded: string[] };
    };
    expect(drawer.overview.included).toEqual(['SPC pixel only']);
    expect(drawer.overview.excluded).toEqual(['SPC media buy']);
  });
});

describe('QT HCM 2026 rate/cost seed coverage', () => {
  it('seed JSON covers every industry-package DV plus DV19 with 3 tiers and GM ≥ 25%', () => {
    const seed = JSON.parse(
      readFileSync(join(__dirname, '../../../../docs/specs/qt-rate-cost-seed.json'), 'utf8'),
    ) as {
      activate_dv: string[];
      margin_floor_bps: number;
      rates: Record<string, Record<string, { fee_vnd: number; cost_labor_vnd: number }>>;
    };
    const required = [...quoteIndustryPackageDvCodes(), ...QT_RATE_SEED_EXTRA_DV];
    expect(required).toEqual(expect.arrayContaining(['DV19', 'DV04', 'DV08', 'DV15']));
    expect([...seed.activate_dv].sort()).toEqual([...required].sort());

    for (const dv of required) {
      for (const tier of ['basic', 'standard', 'premium'] as const) {
        const row = seed.rates[dv]?.[tier];
        expect(row?.fee_vnd).toBeGreaterThan(0);
        expect(row?.cost_labor_vnd).toBeGreaterThan(0);
        const gm = (row.fee_vnd - row.cost_labor_vnd) / row.fee_vnd;
        expect(gm).toBeGreaterThanOrEqual(seed.margin_floor_bps / 10_000);
      }
    }
  });
});
