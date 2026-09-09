import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { SpcService } from '../spc/spc.service';
import { QT_QUOTE_QUERY, QuoteQueryPort } from './quote-audit.repository';
import { parseQuoteCatalogImport } from './quote-catalog-import.util';
import { applyQuoteCatalogImport, type QuoteCatalogImportJobResult } from './quote-catalog-import.worker';
import { QT_TENANT_ID } from './quote-settings.repository';
import {
  QT_CATALOG_GROUP_DEFS,
  QT_CATALOG_NAV_GROUPS,
  QT_DV_NAME_VI,
  QT_PORTFOLIO_DV_CODES,
  firstNonEmpty,
  formatPlaybookKpis,
  getDvPlaybook,
  mergeCatalogLists,
  resolveQuoteCatalogGroup,
  skuCodesFor,
} from './quote-catalog-dv-playbook';
import {
  QUOTE_PACKAGE_TIERS,
  normalizeQuoteTier,
  resolveProductTierPricing,
  type QuotePackageTier,
} from './quote-pricing.util';

export {
  QT_CATALOG_GROUP_DEFS,
  QT_CATALOG_NAV_GROUPS,
  QT_DV_NAME_VI,
  QT_PORTFOLIO_DV_CODES,
  resolveQuoteCatalogGroup,
  skuCodesFor,
} from './quote-catalog-dv-playbook';
export type { QuoteCatalogGroup, QuoteCatalogNavGroup } from './quote-catalog-dv-playbook';

export const VID_TPL_01 = 'VID-TPL-01';

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
      { dv_code: 'DV12', package_tier: 'standard', qty: 1 },
      { dv_code: 'DV04', package_tier: 'standard', qty: 1 },
      { dv_code: 'DV03', package_tier: 'standard', qty: 1 },
      { dv_code: 'DV02', package_tier: 'standard', qty: 1 },
    ],
  },
  {
    key: 'bds',
    name: 'BĐS Lead Launch',
    package_discount_bps: 500,
    lines: [
      { dv_code: 'DV12', package_tier: 'standard', qty: 1 },
      { dv_code: 'DV04', package_tier: 'standard', qty: 1 },
      { dv_code: 'DV03', package_tier: 'standard', qty: 1 },
      { dv_code: 'DV15', package_tier: 'standard', qty: 1 },
      { dv_code: 'DV08', package_tier: 'standard', qty: 1 },
      { dv_code: 'DV13', package_tier: 'standard', qty: 1 },
    ],
  },
  {
    key: 'spa_clinic',
    name: 'Spa/Clinic Lead Growth',
    package_discount_bps: 300,
    lines: [
      { dv_code: 'DV04', package_tier: 'standard', qty: 1 },
      { dv_code: 'DV02', package_tier: 'standard', qty: 1 },
      { dv_code: 'DV03', package_tier: 'standard', qty: 1 },
      { dv_code: 'DV11', package_tier: 'standard', qty: 1 },
      { dv_code: 'DV06', package_tier: 'standard', qty: 1 },
    ],
  },
  {
    key: 'education',
    name: 'Education Student Recruitment',
    package_discount_bps: 400,
    lines: [
      { dv_code: 'DV04', package_tier: 'standard', qty: 1 },
      { dv_code: 'DV03', package_tier: 'standard', qty: 1 },
      { dv_code: 'DV08', package_tier: 'standard', qty: 1 },
      { dv_code: 'DV02', package_tier: 'standard', qty: 1 },
    ],
  },
];

export function quoteIndustryPackageDvCodes(
  packages: QuoteIndustryPackage[] = QT_INDUSTRY_PACKAGES,
): string[] {
  return [...new Set(packages.flatMap((pkg) => pkg.lines.map((line) => line.dv_code)))].sort();
}

export const QT_RATE_SEED_EXTRA_DV = ['DV19'] as const;

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
  description: string;
  active: boolean;
  status: QuoteCatalogStatus;
  service_slug: string;
  group_key: string | null;
  recommended: boolean;
  tags: string[];
  client_visible: boolean;
  tier_pricing: Record<string, unknown>;
};

export type QuoteCatalogGroupRow = {
  key: string;
  title: string;
  description: string;
  icon: string;
  sort_order: number;
  system: boolean;
  service_count?: number;
};

export type QuoteCatalogServiceWrite = {
  name?: string;
  group_key?: string;
  description?: string;
  dv_code?: string;
  active?: boolean;
  recommended?: boolean;
  tags?: string[];
  client_visible?: boolean;
};

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

function templateKeyFor(name: string, slug: string): string | undefined {
  const hay = `${name} ${slug}`;
  if (/brand[\s-]?film|reels|video[\s-]?storyboard|vid-tpl-01/i.test(hay)) {
    return VID_TPL_01;
  }
  return undefined;
}

function asStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((row) => String(row ?? '').trim()).filter(Boolean);
  }
  if (typeof value === 'string' && value.trim()) {
    try {
      return asStringList(JSON.parse(value));
    } catch {
      return value.split(',').map((row) => row.trim()).filter(Boolean);
    }
  }
  return [];
}

function mapSor(row: Record<string, unknown>): SorRow {
  const active = isActive(row.active);
  const rawStatus = String(row.status ?? '').trim().toLowerCase();
  const groupKey = String(row.group_key ?? '').trim().toLowerCase();
  return {
    dv_code: String(row.dv_code ?? '').trim().toUpperCase(),
    slug: String(row.slug ?? ''),
    name: String(row.name ?? ''),
    description: String(row.description ?? ''),
    active,
    status: rawStatus === 'draft' || !active ? 'draft' : 'active',
    service_slug: String(row.service_slug ?? row.slug ?? ''),
    group_key: groupKey || null,
    recommended: row.recommended === true || row.recommended === 't' || row.recommended === 'true',
    tags: asStringList(row.tags_json ?? row.tags),
    client_visible: row.client_visible == null ? true : isActive(row.client_visible),
    tier_pricing: asObject(row.tier_pricing),
  };
}

function itemOfCatalog(out: { families?: Array<Record<string, unknown>>; services?: Array<Record<string, unknown>> }, dv: string) {
  const lists = [...(out.families ?? []), ...(out.services ?? [])];
  const found = lists.find((item) => String(item.dv_code).toUpperCase() === dv.toUpperCase());
  if (!found) catalogBad('service_not_found', { dv_code: dv });
  return found;
}

function slugKey(value: string, fallback = 'group'): string {
  const slug = String(value ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40);
  return slug || fallback;
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
    const byFamily = new Map<string, Record<string, unknown>>();
    for (const family of base.families ?? []) {
      const dv = String(family.dv_code ?? '').trim().toUpperCase();
      if (dv) byFamily.set(dv, family as Record<string, unknown>);
    }
    const seen = new Set<string>();
    const families: Array<Record<string, unknown>> = [];
    for (const dv of QT_PORTFOLIO_DV_CODES) {
      const family = byFamily.get(dv) ?? {
        dv_code: dv,
        name_vi: QT_DV_NAME_VI[dv],
        service_slug: dv.toLowerCase(),
      };
      families.push(this.present(family, byDv.get(dv) ?? null, hasFinance, cards, day));
      seen.add(dv);
    }
    for (const row of rows) {
      if (!seen.has(row.dv_code)) {
        families.push(this.present({}, row, hasFinance, cards, day));
        seen.add(row.dv_code);
      }
    }
    for (const [dv, family] of byFamily) {
      if (!seen.has(dv)) {
        families.push(this.present(family, byDv.get(dv) ?? null, hasFinance, cards, day));
        seen.add(dv);
      }
    }
    const packages = this.listIndustryPackages(rows, cards, day);
    const groups = await this.presentGroups(families);
    const out: Record<string, unknown> = {
      ...base,
      groups,
      group_keys: groups.map((group) => group.key),
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
      `SELECT c.dv_code, c.slug, c.name, c.active, c.description,
              c.group_key, c.recommended, c.tags_json, c.client_visible,
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
    const name = String(sor?.name || family.name_vi || family.name || QT_DV_NAME_VI[dv] || '');
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
    const playbook = getDvPlaybook(dv);
    const item: Record<string, unknown> = {
      ...family,
      dv_code: dv,
      name_vi: name,
      service_slug: slug || String(family.service_slug ?? ''),
      group: resolveQuoteCatalogGroup(dv, name, slug, sor?.group_key),
      status,
      can_add_to_client_quote,
      rate_missing,
      recommended: sor?.recommended === true,
      tags: sor?.tags?.length ? sor.tags : [dv, resolveQuoteCatalogGroup(dv, name, slug, sor?.group_key)].filter(Boolean),
      client_visible: sor?.client_visible !== false,
      package_tiers,
      sku_codes: skuCodesFor(dv),
      summary_vi: firstNonEmpty(
        family.summary_vi,
        family.summary,
        sor?.description,
        playbook?.summary,
      ),
      duration: firstNonEmpty(family.duration, playbook?.duration),
      effort: firstNonEmpty(family.effort, playbook?.effort),
      price_vnd: package_tiers.find((tier) => tier.tier === 'standard')?.suggested_vnd ?? null,
      price_unit: /tháng/i.test(String(playbook?.duration ?? '')) ? '/ tháng' : '/ project',
      channel_lines: playbook?.channel_lines ?? [],
      media_pass_through: playbook?.media_pass_through === true,
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
    const playbook = getDvPlaybook(dvCode);
    const pricing: Record<string, unknown> = hasFinance
      ? {
          package_tiers: packageTiers,
          cost_labor_vnd: liveCostLaborVnd(cards, dvCode, quoteDate),
          cost_missing: packageTiers.every((tier) => tier.rate_missing),
          media_pass_through: playbook?.media_pass_through === true,
        }
      : { restricted: true, media_pass_through: playbook?.media_pass_through === true };
    return {
      tabs: QT_CATALOG_DRAWER_TABS.map((tab) => tab.id),
      overview: {
        included: mergeCatalogLists(included, playbook?.included ?? []),
        excluded: mergeCatalogLists(excluded, playbook?.excluded ?? []),
        assume: mergeCatalogLists(
          Array.isArray(family.assume)
            ? (family.assume as unknown[]).map((row) => String(row).trim()).filter(Boolean)
            : [],
          playbook?.assume ?? [],
        ),
        cta: firstNonEmpty(family.cta, playbook?.cta.join(' · ')),
        uta: firstNonEmpty(family.uta, playbook?.uta),
        owner: firstNonEmpty(family.owner, playbook?.owner),
        effort: firstNonEmpty(family.effort, playbook?.effort),
        channel_lines: playbook?.channel_lines ?? [],
      },
      deliverable: { items: mergeCatalogLists(deliverables, playbook?.deliverables ?? []) },
      kpi: {
        committed: firstNonEmpty(family.kpi_committed, playbook ? formatPlaybookKpis(playbook, 'committed') : null),
        optimization: firstNonEmpty(
          family.kpi_optimization,
          playbook ? formatPlaybookKpis(playbook, 'optimization') : null,
        ),
        forecast: firstNonEmpty(family.kpi_forecast, playbook ? formatPlaybookKpis(playbook, 'forecast') : null),
        items: playbook?.kpis ?? [],
      },
      timeline: {
        kickoff: firstNonEmpty(family.timeline_kickoff, playbook?.kickoff),
        duration: firstNonEmpty(family.timeline_duration, playbook?.duration),
        notes: firstNonEmpty(family.timeline_notes, playbook?.timeline_notes),
      },
      pricing,
      policy: {
        client_visible: family.client_visible !== false,
        studio_sections: ['04', '07'],
        custom_price_requires_approval: true,
        assumptions_required: true,
        sku_codes: skuCodesFor(dvCode),
      },
    };
  }

  private async listGroups(): Promise<QuoteCatalogGroupRow[]> {
    try {
      const result = await this.db.query(
        `SELECT key, title, description, icon, sort_order, system
           FROM crm_catalog_groups
          ORDER BY sort_order ASC, title ASC`,
      );
      if (result.rows.length) {
        return result.rows.map((row) => ({
          key: String(row.key ?? '').trim().toLowerCase(),
          title: String(row.title ?? ''),
          description: String(row.description ?? ''),
          icon: String(row.icon ?? '▣'),
          sort_order: Number(row.sort_order ?? 0),
          system: row.system === true || row.system === 't',
        })).filter((row) => row.key);
      }
    } catch {
      /* table missing — fall back to playbook defs */
    }
    return QT_CATALOG_GROUP_DEFS.map((row) => ({ ...row }));
  }

  private async presentGroups(families: Array<Record<string, unknown>>): Promise<QuoteCatalogGroupRow[]> {
    const groups = await this.listGroups();
    const counts = new Map<string, number>();
    for (const item of families) {
      const key = String(item.group ?? '').trim().toLowerCase();
      if (!key) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
      if (!groups.some((group) => group.key === key)) {
        groups.push({
          key,
          title: key,
          description: '',
          icon: '▣',
          sort_order: groups.length + 1,
          system: false,
        });
      }
    }
    return groups.map((group) => ({
      ...group,
      service_count: counts.get(group.key) ?? 0,
    }));
  }

  private async seedDefaultGroups() {
    for (const group of QT_CATALOG_GROUP_DEFS) {
      await this.db.query(
        `INSERT INTO crm_catalog_groups (key, title, description, icon, sort_order, system)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (key) DO NOTHING`,
        [group.key, group.title, group.description, group.icon, group.sort_order, group.system],
      );
    }
  }

  private async requireGroup(keyRaw: string): Promise<QuoteCatalogGroupRow> {
    const key = String(keyRaw ?? '').trim().toLowerCase();
    if (!key) catalogBad('group_required');
    const groups = await this.listGroups();
    const found = groups.find((group) => group.key === key);
    if (!found) catalogBad('group_not_found', { key });
    return found;
  }

  async createGroup(input: { key?: string; title?: string; description?: string; icon?: string }) {
    const title = String(input.title ?? '').trim();
    if (!title) catalogBad('group_title_required');
    const key = slugKey(input.key || title);
    const existing = await this.listGroups();
    if (!existing.length || existing.every((row) => row.system)) {
      await this.seedDefaultGroups();
    }
    const current = await this.listGroups();
    if (current.some((row) => row.key === key)) catalogBad('group_exists', { key });
    const sort_order = Math.max(0, ...current.map((row) => row.sort_order)) + 1;
    const description = String(input.description ?? '').trim();
    const icon = String(input.icon ?? '▣').trim() || '▣';
    await this.db.query(
      `INSERT INTO crm_catalog_groups (key, title, description, icon, sort_order, system)
       VALUES ($1,$2,$3,$4,$5,false)`,
      [key, title, description, icon, sort_order],
    );
    return { key, title, description, icon, sort_order, system: false, service_count: 0 };
  }

  async updateGroup(keyRaw: string, input: { title?: string; description?: string; icon?: string }) {
    const current = await this.requireGroup(keyRaw);
    const title = String(input.title ?? current.title).trim();
    if (!title) catalogBad('group_title_required');
    const description = input.description == null ? current.description : String(input.description).trim();
    const icon = String(input.icon ?? current.icon).trim() || current.icon;
    await this.db.query(
      `UPDATE crm_catalog_groups
          SET title=$2, description=$3, icon=$4, updated_at=NOW()
        WHERE key=$1`,
      [current.key, title, description, icon],
    );
    return { ...current, title, description, icon };
  }

  async deleteGroup(keyRaw: string) {
    const current = await this.requireGroup(keyRaw);
    const catalog = await this.get();
    const used = (catalog.families as Array<{ group?: string }>).filter(
      (item) => String(item.group ?? '').toLowerCase() === current.key,
    ).length;
    if (used) catalogBad('group_not_empty', { key: current.key, count: used });
    await this.db.query(`DELETE FROM crm_catalog_groups WHERE key=$1`, [current.key]);
    return { ok: true, key: current.key };
  }

  private async nextCustomDv(): Promise<string> {
    const rows = await this.listSor();
    const used = new Set(rows.map((row) => row.dv_code));
    for (let i = 22; i < 200; i += 1) {
      const dv = `DV${String(i).padStart(2, '0')}`;
      if (!used.has(dv)) return dv;
    }
    catalogBad('dv_code_exhausted');
  }

  async createService(input: QuoteCatalogServiceWrite) {
    const name = String(input.name ?? '').trim();
    if (!name) catalogBad('service_name_required');
    const group = await this.requireGroup(input.group_key ?? '');
    const dv = String(input.dv_code ?? '').trim().toUpperCase() || (await this.nextCustomDv());
    if (!/^DV\d{2,3}$/.test(dv)) catalogBad('dv_code_invalid', { dv_code: dv });
    const existing = await this.listSor();
    if (existing.some((row) => row.dv_code === dv)) catalogBad('service_exists', { dv_code: dv });
    const slug = slugKey(input.dv_code || name, dv.toLowerCase());
    const description = String(input.description ?? '').trim();
    const tags = Array.isArray(input.tags) ? input.tags.map((row) => String(row).trim()).filter(Boolean) : [];
    await this.db.query(
      `INSERT INTO crm_catalog_services
         (slug, name, description, dv_code, group_key, recommended, tags_json, client_visible, active, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,false,$9)`,
      [
        slug,
        name,
        description,
        dv,
        group.key,
        input.recommended === true,
        JSON.stringify(tags),
        input.client_visible !== false,
        100 + existing.length,
      ],
    );
    const catalog = await this.get();
    return itemOfCatalog(catalog, dv);
  }

  async updateService(dvRaw: string, input: QuoteCatalogServiceWrite) {
    const dv = String(dvRaw ?? '').trim().toUpperCase();
    const current = (await this.listSor()).find((row) => row.dv_code === dv);
    if (!current) catalogBad('service_not_found', { dv_code: dv });
    const group = input.group_key ? await this.requireGroup(input.group_key) : null;
    const name = String(input.name ?? current.name).trim();
    if (!name) catalogBad('service_name_required');
    const description = input.description == null ? current.description : String(input.description).trim();
    const tags = input.tags ? input.tags.map((row) => String(row).trim()).filter(Boolean) : current.tags;
    const active = input.active == null ? current.active : input.active === true;
    const recommended = input.recommended == null ? current.recommended : input.recommended === true;
    const client_visible = input.client_visible == null ? current.client_visible : input.client_visible !== false;
    await this.db.query(
      `UPDATE crm_catalog_services
          SET name=$2, description=$3, group_key=$4, recommended=$5, tags_json=$6::jsonb,
              client_visible=$7, active=$8, updated_at=NOW()
        WHERE upper(trim(dv_code))=$1`,
      [dv, name, description, group?.key ?? current.group_key, recommended, JSON.stringify(tags), client_visible, active],
    );
    const catalog = await this.get();
    return itemOfCatalog(catalog, dv);
  }

  async deleteService(dvRaw: string) {
    const dv = String(dvRaw ?? '').trim().toUpperCase();
    const current = (await this.listSor()).find((row) => row.dv_code === dv);
    if (!current) catalogBad('service_not_found', { dv_code: dv });
    if (QT_PORTFOLIO_DV_CODES.includes(dv)) {
      await this.db.query(
        `UPDATE crm_catalog_services SET active=false, updated_at=NOW() WHERE upper(trim(dv_code))=$1`,
        [dv],
      );
      return { ok: true, dv_code: dv, status: 'draft' };
    }
    const used = await this.db.query(
      `SELECT 1 FROM crm_quote_line_item
        WHERE catalog_snapshot_json->>'dv_code' = $1
        LIMIT 1`,
      [dv],
    );
    if (used.rows.length) catalogBad('service_in_use', { dv_code: dv });
    await this.db.query(`DELETE FROM crm_catalog_services WHERE upper(trim(dv_code))=$1`, [dv]);
    return { ok: true, dv_code: dv, deleted: true };
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
