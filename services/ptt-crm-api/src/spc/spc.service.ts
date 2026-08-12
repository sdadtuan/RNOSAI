import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { buildLegacyTierPricingFromOffers } from './spc-pricing-sync.util';
import { SpcPgRepository } from './spc-pg.repository';
import type { SpcPatchOfferBody, SpcPublishBody } from './spc.types';

@Injectable()
export class SpcService {
  constructor(private readonly repo: SpcPgRepository) {}

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
}
