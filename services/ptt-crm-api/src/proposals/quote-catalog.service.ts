import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { SpcService } from '../spc/spc.service';
import { QT_QUOTE_QUERY, QuoteQueryPort } from './quote-audit.repository';
import { parseQuoteCatalogImport } from './quote-catalog-import.util';
import { applyQuoteCatalogImport, type QuoteCatalogImportJobResult } from './quote-catalog-import.worker';
import { QT_TENANT_ID } from './quote-settings.repository';
import {
  QUOTE_PACKAGE_TIERS,
  normalizeQuoteTier,
  resolveProductTierPricing,
  type QuotePackageTier,
} from './quote-pricing.util';

export const QT_CATALOG_NAV_GROUPS = [
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
] as const;

export const VID_TPL_01 = 'VID-TPL-01';

export type QuoteCatalogNavGroup = (typeof QT_CATALOG_NAV_GROUPS)[number];
export type QuoteCatalogGroup = QuoteCatalogNavGroup | 'package';

export type QuoteCatalogStatus = 'active' | 'draft';

export type QuoteCatalogTier = {
  tier: QuotePackageTier;
  min_vnd: number | null;
  max_vnd: number | null;
  suggested_vnd: number | null;
  rate_missing: boolean;
};

export type QuotePackageSnapshotLine = {
  dv_code: string;
  package_tier: string;
  qty: number;
  catalog_snapshot_json: Record<string, unknown> & {
    dv_code?: string;
    quoted_at?: string;
    rate?: {
      min_vnd?: number | null;
      max_vnd?: number | null;
      suggested_vnd?: number | null;
      rate_card_id?: string | null;
    };
  };
};

export type QuotePackageSnapshot = {
  package_key: string;
  name: string;
  package_discount_bps: number;
  lines: QuotePackageSnapshotLine[];
};

export type QuoteResolvedRate = {
  dv_code: string;
  package_tier: QuotePackageTier;
  fee_vnd: number;
  min_vnd: number | null;
  max_vnd: number | null;
  suggested_vnd: number;
  rate_card_id?: string | null;
  cost_labor_vnd?: number | null;
};

export type QuoteRateCardItem = {
  id: string;
  dv_code: string;
  package_tier: string;
  fee_vnd: number;
  cost_labor_vnd?: number | null;
  effective_from: string;
  effective_to: string | null;
  state: 'active' | 'retired';
  rate_expired: boolean;
};

export type QuoteRateCardList = {
  items: QuoteRateCardItem[];
};

export const QT_CATALOG_DRAWER_TABS = [
  { id: 'overview', label: 'Tổng quan' },
  { id: 'deliverable', label: 'Deliverable' },
  { id: 'kpi', label: 'KPI' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'pricing', label: 'Pricing & Cost' },
  { id: 'policy', label: 'Proposal & Policy' },
] as const;

export type QuoteIndustryPackageLine = {
  dv_code: string;
  package_tier: QuotePackageTier;
  qty: number;
};

export type QuoteIndustryPackage = {
  key: string;
  name: string;
  package_discount_bps: number;
  lines: QuoteIndustryPackageLine[];
};

export const QT_INDUSTRY_PACKAGES: QuoteIndustryPackage[] = [
  {
    key: 'growth_launch',
    name: 'Growth Launch',
    package_discount_bps: 500,
    lines: [
      { dv_code: 'DV05', package_tier: 'standard', qty: 1 },
      { dv_code: 'DV08', package_tier: 'standard', qty: 1 },
      { dv_code: 'DV03', package_tier: 'standard', qty: 1 },
      { dv_code: 'DV12', package_tier: 'standard', qty: 1 },
    ],
  },
  {
    key: 'bds',
    name: 'BĐS',
    package_discount_bps: 500,
    lines: [
      { dv_code: 'DV08', package_tier: 'standard', qty: 1 },
      { dv_code: 'DV05', package_tier: 'standard', qty: 1 },
      { dv_code: 'DV12', package_tier: 'standard', qty: 1 },
    ],
  },
  {
    key: 'spa_clinic',
    name: 'Spa/Clinic',
    package_discount_bps: 300,
    lines: [
      { dv_code: 'DV05', package_tier: 'standard', qty: 1 },
      { dv_code: 'DV08', package_tier: 'standard', qty: 1 },
    ],
  },
  {
    key: 'education',
    name: 'Education',
    package_discount_bps: 400,
    lines: [
      { dv_code: 'DV08', package_tier: 'standard', qty: 1 },
      { dv_code: 'DV05', package_tier: 'standard', qty: 1 },
      { dv_code: 'DV03', package_tier: 'standard', qty: 1 },
    ],
  },
];

export type QuoteCatalogGetOpts = {
  hasFinance?: boolean;
  includeRates?: boolean;
};

function catalogBad(error: string, extra?: Record<string, unknown>): never {
  throw new BadRequestException({ error, ...extra });
}

function quoteDateKey(value?: string): string {
  const raw = String(value ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
}

function cardState(value: unknown): 'active' | 'retired' {
  return String(value ?? '').trim().toLowerCase() === 'retired' ? 'retired' : 'active';
}

function isRateExpired(effectiveTo: string | null | undefined, quoteDate: string): boolean {
  if (!effectiveTo) return false;
  return quoteDate > String(effectiveTo).slice(0, 10);
}

function isRateEffective(
  effectiveFrom: string,
  effectiveTo: string | null | undefined,
  quoteDate: string,
): boolean {
  const from = String(effectiveFrom).slice(0, 10);
  const to = effectiveTo ? String(effectiveTo).slice(0, 10) : null;
  return quoteDate >= from && (!to || quoteDate <= to);
}

function cardMatches(
  card: RateCardRow,
  dvCode: string,
  tier?: QuotePackageTier | string,
): boolean {
  if (String(card.dv_code).toUpperCase() !== dvCode) return false;
  if (!tier) return true;
  return (normalizeQuoteTier(String(card.package_tier)) ?? String(card.package_tier)) === tier;
}

function isLiveRateCard(card: RateCardRow, quoteDate: string): boolean {
  return (
    cardState(card.state) === 'active' &&
    isRateEffective(String(card.effective_from), card.effective_to, quoteDate)
  );
}

function cardsFor(
  cards: RateCardRow[],
  dvCode: string,
  tier?: QuotePackageTier | string,
): RateCardRow[] {
  return cards.filter((card) => cardMatches(card, dvCode, tier));
}

function canAddWithRateCards(
  status: QuoteCatalogStatus,
  rateMissing: boolean,
  cards: RateCardRow[],
  dvCode: string,
  quoteDate: string,
  tier?: QuotePackageTier | string,
): boolean {
  if (status !== 'active') return false;
  const match = cardsFor(cards, dvCode, tier);
  if (!match.length) return !rateMissing;
  return match.some((card) => isLiveRateCard(card, quoteDate));
}

function liveCostLaborVnd(cards: RateCardRow[], dvCode: string, quoteDate: string): number | null {
  const live = cardsFor(cards, dvCode).filter((card) => isLiveRateCard(card, quoteDate));
  const preferred =
    live.find((card) => (normalizeQuoteTier(String(card.package_tier)) ?? card.package_tier) === 'standard') ??
    live[0];
  if (!preferred || preferred.cost_labor_vnd == null) return null;
  return Number(preferred.cost_labor_vnd);
}

type SorRow = {
  dv_code: string;
  slug: string;
  name: string;
  active: boolean;
  status: QuoteCatalogStatus;
  service_slug: string;
  tier_pricing: Record<string, unknown>;
};

const GROUP_KEYWORDS: Array<[RegExp, QuoteCatalogGroup]> = [
  [/package|ngành|nganh|growth[\s-]?launch/i, 'package'],
  [/brand[\s-]?film|reels|video|image|sản xuất|san xuat|\btvc\b/i, 'production'],
  [
    /strateg|research|nghiên cứu|nghien cuu|thị[\s-]?trường|thi[\s-]?truong|phân[\s-]?tích[\s-]?thị[\s-]?trường|phan[\s-]?tich[\s-]?thi[\s-]?truong/i,
    'strategy',
  ],
  [/brand|nhận diện|nhan dien|identity|creative|key visual/i, 'branding'],
  [/content|social|nội dung|noi dung|mạng xã hội|mang xa hoi/i, 'content'],
  [/performance|media|\bads\b|quảng cáo|quang cao|meta|google|tiktok/i, 'performance'],
  [/web|landing|\blp\b|cro|website/i, 'web'],
  [/\bseo\b|\baeo\b|organic/i, 'seo'],
  [/email|retention|nurture|nuôi dưỡng|nuoi duong|zalo|sms|zns/i, 'retention'],
  [/\bcrm\b|automation|chatbot/i, 'crm'],
  [/\bpr\b|kol|koc|báo chí|bao chi|reputation/i, 'pr'],
  [/event|sự kiện|su kien|activation|\bbtl\b/i, 'event'],
  [/sales|enablement|playbook|bán hàng|ban hang/i, 'sales'],
  [/data|analytics|dashboard|pixel|báo cáo|bao cao/i, 'data'],
];

function asObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === 'string' && value) {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
  }
  return {};
}

function isActive(value: unknown): boolean {
  return value !== false && value !== 'f' && value !== 'false';
}

export function resolveQuoteCatalogGroup(
  _dvCode: string,
  name: string,
  slug: string,
): QuoteCatalogGroup {
  const hay = `${name} ${slug}`;
  for (const [pattern, group] of GROUP_KEYWORDS) {
    if (pattern.test(hay)) return group;
  }
  return 'strategy';
}

function templateKeyFor(name: string, slug: string): string | undefined {
  const hay = `${name} ${slug}`;
  if (/brand[\s-]?film|reels|video[\s-]?storyboard|vid-tpl-01/i.test(hay)) {
    return VID_TPL_01;
  }
  return undefined;
}

function mapSor(row: Record<string, unknown>): SorRow {
  const active = isActive(row.active);
  const rawStatus = String(row.status ?? '').trim().toLowerCase();
  return {
    dv_code: String(row.dv_code ?? '').trim().toUpperCase(),
    slug: String(row.slug ?? ''),
    name: String(row.name ?? ''),
    active,
    status: rawStatus === 'draft' || !active ? 'draft' : 'active',
    service_slug: String(row.service_slug ?? row.slug ?? ''),
    tier_pricing: asObject(row.tier_pricing),
  };
}

@Injectable()
export class QuoteCatalogService {
  constructor(
    @Inject(QT_QUOTE_QUERY) private readonly db: QuoteQueryPort,
    private readonly spc: SpcService,
  ) {}

  async get(serviceSlugRaw?: string, opts?: QuoteCatalogGetOpts) {
    const hasFinance = opts?.hasFinance === true;
    const day = quoteDateKey();
    const base = await this.loadBase(serviceSlugRaw);
    const rows = await this.listSor();
    const cards = await this.loadRateCardRows();
    const byDv = new Map(rows.map((row) => [row.dv_code, row]));
    const seen = new Set<string>();
    const families = (base.families ?? []).map((family) => {
      const dv = String(family.dv_code ?? '').trim().toUpperCase();
      if (dv) seen.add(dv);
      return this.present(family as Record<string, unknown>, byDv.get(dv) ?? null, hasFinance, cards, day);
    });
    for (const row of rows) {
      if (!seen.has(row.dv_code)) {
        families.push(this.present({}, row, hasFinance, cards, day));
      }
    }
    const packages = this.listIndustryPackages(rows, cards, day);
    const out: Record<string, unknown> = {
      ...base,
      groups: [...QT_CATALOG_NAV_GROUPS],
      drawer_tabs: [...QT_CATALOG_DRAWER_TABS],
      families,
      services: families,
      packages,
    };
    if (opts?.includeRates) {
      const rates = await this.listRateCards(undefined, hasFinance);
      out.rate_cards = rates.items;
    }
    return out;
  }

  private async loadBase(serviceSlugRaw?: string) {
    try {
      return await this.spc.getQuoteCatalog(serviceSlugRaw);
    } catch {
      return {
        schema_version: '1.0.0',
        package_tiers: [...QUOTE_PACKAGE_TIERS],
        primary_dv: null,
        primary_sku: null,
        suggested_bundle: [] as string[],
        combo_warnings: [] as Array<{ dv_code: string; message_vi: string }>,
        families: [] as Array<Record<string, unknown>>,
      };
    }
  }

  private async listSor(): Promise<SorRow[]> {
    const result = await this.db.query(
      `SELECT c.dv_code, c.slug, c.name, c.active,
              CASE WHEN c.active THEN 'active' ELSE 'draft' END AS status,
              COALESCE(p.tier_pricing, '{}') AS tier_pricing,
              COALESCE(p.service_slug, c.slug) AS service_slug
         FROM crm_catalog_services c
         LEFT JOIN ops_service_profile p
           ON upper(trim(p.dv_code)) = upper(trim(c.dv_code))
        WHERE c.dv_code IS NOT NULL AND btrim(c.dv_code) <> ''
        ORDER BY c.sort_order ASC, c.dv_code ASC`,
    );
    return result.rows.map(mapSor).filter((row) => row.dv_code);
  }

  private present(
    family: Record<string, unknown>,
    sor: SorRow | null,
    hasFinance = false,
    cards: RateCardRow[] = [],
    quoteDate = quoteDateKey(),
  ) {
    const dv = String(sor?.dv_code || family.dv_code || '')
      .trim()
      .toUpperCase();
    const name = String(sor?.name || family.name_vi || family.name || '');
    const slug = String(sor?.service_slug || sor?.slug || family.service_slug || '');
    const status: QuoteCatalogStatus = sor?.status === 'active' ? 'active' : 'draft';
    const package_tiers: QuoteCatalogTier[] = QUOTE_PACKAGE_TIERS.map((tier) => ({
      tier,
      ...resolveProductTierPricing(sor?.tier_pricing ?? {}, tier),
    }));
    const rate_missing = package_tiers.every((tier) => tier.rate_missing);
    const can_add_to_client_quote = canAddWithRateCards(
      status,
      rate_missing,
      cards,
      dv,
      quoteDate,
    );
    const item: Record<string, unknown> = {
      ...family,
      dv_code: dv,
      name_vi: String(family.name_vi ?? name),
      service_slug: slug || String(family.service_slug ?? ''),
      group: resolveQuoteCatalogGroup(dv, name, slug),
      status,
      can_add_to_client_quote,
      rate_missing,
      package_tiers,
      drawer: this.drawerFor(family, package_tiers, hasFinance, cards, dv, quoteDate),
    };
    const template_key = templateKeyFor(name, slug);
    if (template_key) item.template_key = template_key;
    return item;
  }

  private drawerFor(
    family: Record<string, unknown>,
    packageTiers: QuoteCatalogTier[],
    hasFinance: boolean,
    cards: RateCardRow[] = [],
    dvCode = '',
    quoteDate = quoteDateKey(),
  ) {
    const offers = Array.isArray(family.offers) ? (family.offers as Array<Record<string, unknown>>) : [];
    const included: string[] = [];
    const excluded: string[] = [];
    for (const offer of offers) {
      const lines = Array.isArray(offer.lines) ? (offer.lines as Array<Record<string, unknown>>) : [];
      for (const line of lines) {
        const label = String(line.label_vi ?? line.line_code ?? '').trim();
        if (!label) continue;
        if (line.included_by_default === false) excluded.push(label);
        else included.push(label);
      }
    }
    const components = Array.isArray(family.components)
      ? (family.components as Array<Record<string, unknown>>)
      : [];
    const deliverables = components
      .map((row) => String(row.deliverable_vi ?? '').trim())
      .filter(Boolean);
    const pricing: Record<string, unknown> = hasFinance
      ? {
          package_tiers: packageTiers,
          cost_labor_vnd: liveCostLaborVnd(cards, dvCode, quoteDate),
          cost_missing: packageTiers.every((tier) => tier.rate_missing),
        }
      : { restricted: true };
    return {
      tabs: QT_CATALOG_DRAWER_TABS.map((tab) => tab.id),
      overview: {
        included: included.length ? included : null,
        excluded: excluded.length ? excluded : null,
        cta: family.cta == null ? null : String(family.cta),
        uta: family.uta == null ? null : String(family.uta),
        owner: family.owner == null ? null : String(family.owner),
        effort: family.effort == null ? null : String(family.effort),
      },
      deliverable: { items: deliverables.length ? deliverables : null },
      kpi: {
        committed: family.kpi_committed == null ? null : String(family.kpi_committed),
        optimization: family.kpi_optimization == null ? null : String(family.kpi_optimization),
        forecast: family.kpi_forecast == null ? null : String(family.kpi_forecast),
      },
      timeline: {
        kickoff: family.timeline_kickoff == null ? null : String(family.timeline_kickoff),
        duration: family.timeline_duration == null ? null : String(family.timeline_duration),
        notes: family.timeline_notes == null ? null : String(family.timeline_notes),
      },
      pricing,
      policy: {
        client_visible: family.client_visible !== false,
        studio_sections: ['04', '07'],
        custom_price_requires_approval: true,
      },
    };
  }

  listIndustryPackages(rows?: SorRow[], cards: RateCardRow[] = [], quoteDate = quoteDateKey()) {
    const byDv = new Map((rows ?? []).map((row) => [row.dv_code, row]));
    return QT_INDUSTRY_PACKAGES.map((pkg) => {
      const members = pkg.lines.map((line) => {
        const sor = byDv.get(line.dv_code);
        const status: QuoteCatalogStatus = sor?.status === 'active' ? 'active' : 'draft';
        const priced = resolveProductTierPricing(sor?.tier_pricing ?? {}, line.package_tier);
        return {
          ...line,
          status,
          rate_missing: priced.rate_missing,
          can_add_to_client_quote: canAddWithRateCards(
            status,
            priced.rate_missing,
            cards,
            line.dv_code,
            quoteDate,
            line.package_tier,
          ),
        };
      });
      return {
        key: pkg.key,
        name: pkg.name,
        package_discount_bps: pkg.package_discount_bps,
        line_count: pkg.lines.length,
        dv_codes: pkg.lines.map((line) => line.dv_code),
        lines: members,
        can_add: members.every((line) => line.can_add_to_client_quote),
      };
    });
  }

  async snapshotPackage(packageKey: string, quoteDate?: string): Promise<QuotePackageSnapshot> {
    const pkg = QT_INDUSTRY_PACKAGES.find((item) => item.key === packageKey);
    if (!pkg) catalogBad('package_not_found', { package_key: packageKey });
    const day = quoteDateKey(quoteDate);
    const rows = await this.listSor();
    const byDv = new Map(rows.map((row) => [row.dv_code, row]));
    const lines: QuotePackageSnapshotLine[] = [];
    for (const member of pkg.lines) {
      const sor = byDv.get(member.dv_code) ?? null;
      const status: QuoteCatalogStatus = sor?.status === 'active' ? 'active' : 'draft';
      if (status !== 'active') catalogBad('catalog_not_active', { dv_code: member.dv_code });
      const rate = await this.resolveRate(member.dv_code, member.package_tier, day);
      lines.push({
        dv_code: member.dv_code,
        package_tier: member.package_tier,
        qty: member.qty,
        catalog_snapshot_json: {
          dv_code: member.dv_code,
          package_tier: member.package_tier,
          catalog_status: status,
          quoted_at: day,
          package_key: pkg.key,
          package_discount_bps: pkg.package_discount_bps,
          rate: {
            min_vnd: rate.min_vnd,
            max_vnd: rate.max_vnd,
            suggested_vnd: rate.suggested_vnd,
            rate_card_id: rate.rate_card_id ?? null,
          },
        },
      });
    }
    return {
      package_key: pkg.key,
      name: pkg.name,
      package_discount_bps: pkg.package_discount_bps,
      lines,
    };
  }

  async resolveRate(
    dvCodeRaw: string,
    tierRaw: string,
    quoteDate?: string,
  ): Promise<QuoteResolvedRate> {
    const dvCode = String(dvCodeRaw ?? '').trim().toUpperCase();
    const tier = normalizeQuoteTier(tierRaw) ?? 'standard';
    const day = quoteDateKey(quoteDate);
    const cards = (await this.loadRateCardRows(dvCode, tier)).filter(
      (card) =>
        String(card.dv_code).toUpperCase() === dvCode &&
        (normalizeQuoteTier(String(card.package_tier)) ?? String(card.package_tier)) === tier,
    );
    const live = cards.filter(
      (card) =>
        cardState(card.state) === 'active' &&
        isRateEffective(String(card.effective_from), card.effective_to, day),
    );
    if (live[0]) {
      const fee = Number(live[0].fee_vnd);
      return {
        dv_code: dvCode,
        package_tier: tier,
        fee_vnd: fee,
        min_vnd: fee,
        max_vnd: fee,
        suggested_vnd: fee,
        rate_card_id: String(live[0].id),
        cost_labor_vnd: live[0].cost_labor_vnd == null ? null : Number(live[0].cost_labor_vnd),
      };
    }
    if (cards.length) catalogBad('rate_expired', { dv_code: dvCode, tier });
    const rows = await this.listSor();
    const sor = rows.find((row) => row.dv_code === dvCode);
    const priced = resolveProductTierPricing(sor?.tier_pricing ?? {}, tier);
    if (priced.rate_missing || !priced.suggested_vnd) {
      catalogBad('rate_missing', { dv_code: dvCode, tier });
    }
    return {
      dv_code: dvCode,
      package_tier: tier,
      fee_vnd: priced.suggested_vnd,
      min_vnd: priced.min_vnd,
      max_vnd: priced.max_vnd,
      suggested_vnd: priced.suggested_vnd,
      rate_card_id: null,
      cost_labor_vnd: null,
    };
  }

  async importCatalog(input: {
    filename?: string;
    csv?: string;
    json?: unknown;
    created_by: number;
  }): Promise<QuoteCatalogImportJobResult> {
    const filename = String(input.filename ?? '').trim() || 'catalog.json';
    const parsed = parseQuoteCatalogImport({
      filename,
      csv: input.csv,
      json: input.json,
    });
    const queued = await this.db.query(
      `INSERT INTO crm_quote_import_jobs (filename, state, result_json, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING id, filename, state, result_json, created_by`,
      [filename, 'queued', { filename }, input.created_by],
    );
    const jobId = String(queued.rows[0]?.id ?? '');
    if (!jobId) catalogBad('import_job_failed');
    return applyQuoteCatalogImport(this.db, { jobId, parsed });
  }

  async listRateCards(quoteDate?: string, hasFinance = false): Promise<QuoteRateCardList> {
    const day = quoteDateKey(quoteDate);
    const rows = await this.loadRateCardRows();
    return {
      items: rows.map((row) => {
        const state = cardState(row.state);
        const effectiveTo = row.effective_to == null ? null : String(row.effective_to).slice(0, 10);
        const item: QuoteRateCardItem = {
          id: String(row.id),
          dv_code: String(row.dv_code ?? '').trim().toUpperCase(),
          package_tier: String(row.package_tier ?? ''),
          fee_vnd: Number(row.fee_vnd),
          effective_from: String(row.effective_from ?? '').slice(0, 10),
          effective_to: effectiveTo,
          state,
          rate_expired: isRateExpired(effectiveTo, day),
        };
        if (hasFinance) {
          item.cost_labor_vnd = row.cost_labor_vnd == null ? null : Number(row.cost_labor_vnd);
        }
        return item;
      }),
    };
  }

  private async loadRateCardRows(dvCode?: string, tier?: string): Promise<RateCardRow[]> {
    const result = await this.db.query(
      `SELECT id, tenant_id, dv_code, package_tier, fee_vnd, cost_labor_vnd,
              effective_from::text AS effective_from, effective_to::text AS effective_to, state
         FROM crm_quote_rate_cards
        WHERE tenant_id = $1
          AND ($2::text IS NULL OR upper(trim(dv_code)) = upper(trim($2)))
          AND ($3::text IS NULL OR lower(trim(package_tier)) = lower(trim($3)))
        ORDER BY dv_code ASC, package_tier ASC, effective_from DESC`,
      [QT_TENANT_ID, dvCode ?? null, tier ?? null],
    );
    return result.rows.map((row) => ({
      id: String(row.id ?? ''),
      tenant_id: String(row.tenant_id ?? QT_TENANT_ID),
      dv_code: String(row.dv_code ?? ''),
      package_tier: String(row.package_tier ?? ''),
      fee_vnd: Number(row.fee_vnd ?? 0),
      cost_labor_vnd: row.cost_labor_vnd == null ? null : Number(row.cost_labor_vnd),
      effective_from: String(row.effective_from ?? ''),
      effective_to: row.effective_to == null ? null : String(row.effective_to),
      state: String(row.state ?? 'active'),
    }));
  }
}

type RateCardRow = {
  id: string;
  tenant_id: string;
  dv_code: string;
  package_tier: string;
  fee_vnd: number;
  cost_labor_vnd: number | null;
  effective_from: string;
  effective_to: string | null;
  state: string;
};
