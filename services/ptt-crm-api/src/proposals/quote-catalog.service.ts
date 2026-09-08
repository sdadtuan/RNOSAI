import { Inject, Injectable } from '@nestjs/common';
import { SpcService } from '../spc/spc.service';
import { QT_QUOTE_QUERY, QuoteQueryPort } from './quote-audit.repository';
import {
  QUOTE_PACKAGE_TIERS,
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

  async get(serviceSlugRaw?: string) {
    const base = await this.loadBase(serviceSlugRaw);
    const rows = await this.listSor();
    const byDv = new Map(rows.map((row) => [row.dv_code, row]));
    const seen = new Set<string>();
    const families = (base.families ?? []).map((family) => {
      const dv = String(family.dv_code ?? '').trim().toUpperCase();
      if (dv) seen.add(dv);
      return this.present(family as Record<string, unknown>, byDv.get(dv) ?? null);
    });
    for (const row of rows) {
      if (!seen.has(row.dv_code)) {
        families.push(this.present({}, row));
      }
    }
    return {
      ...base,
      groups: [...QT_CATALOG_NAV_GROUPS],
      families,
      services: families,
    };
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

  private present(family: Record<string, unknown>, sor: SorRow | null) {
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
    const can_add_to_client_quote = status === 'active' && !rate_missing;
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
    };
    const template_key = templateKeyFor(name, slug);
    if (template_key) item.template_key = template_key;
    return item;
  }
}
