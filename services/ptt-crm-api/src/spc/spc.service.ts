import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { OpsRouteMapLoader } from '../ops/ops-route-map.loader';
import {
  filterCatalogServicesForSlug,
  loadDealRoomServiceDvMap,
  resolveServiceDvMapping,
} from '../proposals/deal-room-quote.util';
import { QUOTE_PACKAGE_TIERS } from '../proposals/quote-pricing.util';
import { buildLegacyTierPricingFromOffers } from './spc-pricing-sync.util';
import { resolveQuotePriceFromPricingModel } from './spc-quote-pricing.util';
import { skuFromDvTier, tierFromSkuCode } from './spc-sku.util';
import { SpcPgRepository } from './spc-pg.repository';
import type { SpcPatchOfferBody, SpcPublishBody, SpcQuoteCatalogResponse } from './spc.types';

@Injectable()
export class SpcService {
  constructor(
    private readonly repo: SpcPgRepository,
    private readonly routeMap: OpsRouteMapLoader,
  ) {}

  private assertPg(): void {
    if (!this.repo.canUsePg()) {
      throw new ServiceUnavailableException({ error: 'spc_pg_unavailable' });
    }
  }

  async getPortfolio(publishedOnly: boolean) {
    this.assertPg();
    const items = await this.repo.listPortfolio(!publishedOnly);
    return {
      schema_version: '1.0.0',
      count: items.length,
      items,
    };
  }

  async getFamily(dvCode: string, publishedOnly: boolean) {
    this.assertPg();
    const code = String(dvCode ?? '').trim().toUpperCase();
    const family = await this.repo.getFamily(code, publishedOnly);
    if (!family) throw new NotFoundException({ error: 'spc_family_not_found', dv_code: code });
    return family;
  }

  async getOffer(skuCode: string, publishedOnly: boolean) {
    this.assertPg();
    const sku = String(skuCode ?? '').trim().toUpperCase();
    const offer = await this.repo.getOffer(sku, publishedOnly);
    if (!offer) throw new NotFoundException({ error: 'spc_offer_not_found', sku_code: sku });
    return offer;
  }

  async patchOffer(skuCode: string, body: SpcPatchOfferBody) {
    this.assertPg();
    const sku = String(skuCode ?? '').trim().toUpperCase();
    const existing = await this.repo.getOffer(sku, false);
    if (!existing) throw new NotFoundException({ error: 'spc_offer_not_found', sku_code: sku });
    const updated = await this.repo.patchOffer(sku, body);
    if (!updated) throw new NotFoundException({ error: 'spc_offer_not_found', sku_code: sku });
    return updated;
  }

  async publish(body: SpcPublishBody, actorEmail: string) {
    this.assertPg();
    const entity = String(body?.entity ?? '').trim();
    const key = String(body?.key ?? '').trim().toUpperCase();
    if (!entity || !key) {
      throw new BadRequestException({ error: 'spc_publish_invalid_body' });
    }
    if (entity !== 'offer') {
      throw new BadRequestException({ error: 'spc_publish_entity_unsupported', entity });
    }
    const published = await this.repo.publishOffer(key, actorEmail);
    if (!published) throw new NotFoundException({ error: 'spc_offer_not_found', sku_code: key });

    const offers = await this.repo.listOffersByDv(published.dv_code, true);
    const tierPricing = buildLegacyTierPricingFromOffers(offers);
    if (Object.keys(tierPricing).length > 0) {
      await this.repo.syncOpsProfileTierPricing(published.dv_code, tierPricing);
    }
    return {
      published,
      ops_profile_synced: Object.keys(tierPricing).length > 0,
      tier_pricing: tierPricing,
    };
  }

  async getPublishLog(limit?: number) {
    this.assertPg();
    const rows = await this.repo.listPublishLog(limit ?? 50);
    const draftCount = await this.repo.countDraftOffers();
    return { draft_count: draftCount, items: rows };
  }

  async getHubStats() {
    this.assertPg();
    const portfolio = await this.repo.listPortfolio(true);
    const draftCount = await this.repo.countDraftOffers();
    const publishedSkus = portfolio.reduce((sum, row) => sum + row.published_count, 0);
    return {
      family_count: portfolio.length,
      published_skus: publishedSkus,
      draft_offers: draftCount,
      pilot_dv: ['DV02', 'DV04', 'DV05', 'DV20'],
    };
  }

  async listPublishedOffersForOpsCatalog() {
    this.assertPg();
    return this.repo.listPublishedOffersForCatalog();
  }

  async getQuoteCatalog(serviceSlugRaw?: string): Promise<SpcQuoteCatalogResponse> {
    this.assertPg();
    const rows = await this.repo.listQuoteCatalogRows();
    const map = this.routeMap.getMap();
    const slug = String(serviceSlugRaw ?? '').trim();
    const comboWarnings: SpcQuoteCatalogResponse['combo_warnings'] = [];

    let primaryDv: string | null = null;
    let primarySku: string | null = null;
    let primaryName: string | null = null;
    let suggestedBundle: string[] = [];
    let allowedDv = new Set(rows.map((r) => r.family.dv_code));

    if (slug) {
      const dvMap = loadDealRoomServiceDvMap();
      const mapping = resolveServiceDvMapping(slug, map, dvMap);
      primaryDv = mapping.primary_dv;
      primaryName = mapping.primary_name;
      suggestedBundle = mapping.bundle_dv ?? [];
      const filtered = filterCatalogServicesForSlug(map, mapping).map((s) => s.dv_code);
      allowedDv = new Set([primaryDv, ...suggestedBundle, ...filtered]);
    }

    const families = rows
      .filter((row) => !slug || allowedDv.has(row.family.dv_code))
      .map((row) => {
        const routeEntry = map.services.find((s) => s.code === row.family.dv_code);
        const dependsOn = (row.family.depends_on_dv ?? []) as string[];
        for (const dep of dependsOn) {
          if (dep && !allowedDv.has(dep)) {
            comboWarnings.push({
              dv_code: row.family.dv_code,
              message_vi: `${row.family.dv_code} phụ thuộc ${dep} — cân nhắc combo.`,
            });
          }
        }
        const serviceSlug =
          row.service_slug ?? routeEntry?.service_slugs.primary ?? row.family.dv_code.toLowerCase();
        const defaultSku = row.default_sku_code ?? `${row.family.dv_code}-TC`;
        if (row.family.dv_code === primaryDv) {
          primarySku = defaultSku;
        }
        return {
          dv_code: row.family.dv_code,
          name_vi: row.family.name_vi,
          readiness: row.family.readiness,
          depends_on_dv: dependsOn.map(String),
          service_slug: serviceSlug,
          default_sku_code: defaultSku,
          is_primary: row.family.dv_code === primaryDv,
          is_bundle_suggested: suggestedBundle.includes(row.family.dv_code),
          offers: row.offers.map((offer) => ({
            sku_code: offer.sku_code,
            tier: offer.tier,
            label_vi: offer.label_vi,
            scope_summary_vi: offer.scope_summary_vi,
            pricing_model: offer.pricing_model,
            lines: offer.lines.map((line) => ({
              line_code: line.line_code,
              label_vi: line.label_vi,
              description_vi: line.description_vi,
              included_by_default: line.included_by_default,
            })),
          })),
        };
      });

    if (!primarySku && primaryDv) {
      primarySku = skuFromDvTier(primaryDv, 'standard');
    }

    return {
      schema_version: map.schema_version ?? '1.0.0',
      package_tiers: [...QUOTE_PACKAGE_TIERS],
      service_slug: slug || undefined,
      primary_dv: primaryDv,
      primary_sku: primarySku,
      primary_name: primaryName,
      suggested_bundle: suggestedBundle,
      combo_warnings: comboWarnings,
      families,
    };
  }

  async resolveQuoteLineFromSku(skuCodeRaw: string, finalPriceVnd?: number, scopeNotes?: string) {
    this.assertPg();
    const skuCode = String(skuCodeRaw ?? '').trim().toUpperCase();
    const offer = await this.repo.getOffer(skuCode, true);
    if (!offer) throw new NotFoundException({ error: 'spc_offer_not_found', sku_code: skuCode });
    const map = this.routeMap.getMap();
    const entry = map.services.find((s) => s.code === offer.dv_code);
    if (!entry) {
      throw new BadRequestException({ error: 'dv_not_found', dv_code: offer.dv_code });
    }
    const tier = tierFromSkuCode(skuCode);
    if (!tier) {
      throw new BadRequestException({ error: 'invalid_sku_tier', sku_code: skuCode });
    }
    const reference = resolveQuotePriceFromPricingModel(offer.pricing_model);
    const finalPrice =
      finalPriceVnd != null && Number.isFinite(Number(finalPriceVnd))
        ? Math.max(0, Number(finalPriceVnd))
        : reference.suggested_vnd;
    const scope =
      String(scopeNotes ?? '').trim() ||
      offer.scope_summary_vi ||
      offer.lines.map((l) => l.label_vi).join('; ');
    return {
      sku_code: skuCode,
      dv_code: offer.dv_code,
      package_tier: tier,
      service_slug: entry.service_slugs.primary,
      dv_name: entry.name_vi,
      reference_price_min: reference.min_vnd,
      reference_price_max: reference.max_vnd,
      final_price_vnd: finalPrice,
      scope_notes: scope.slice(0, 2000),
    };
  }
}
