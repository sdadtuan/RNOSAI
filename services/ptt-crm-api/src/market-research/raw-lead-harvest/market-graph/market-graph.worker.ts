import { Injectable, Logger } from '@nestjs/common';
import { candidateHitsBlacklist } from '../blacklist.util';
import { resolveLeadClassification } from '../harvest-critic.util';
import { fetchEvidenceText } from '../quality/evidence-fetch.util';
import { applyQualityGate } from '../quality/quality-gate.util';
import { computeQualityScore } from '../quality/quality-score.util';
import {
  buildDedupeKey,
  isDuplicateAgainst,
  normalizeCompanyKey,
  type DedupeKey,
} from '../quality/dedupe.util';
import {
  contactPageUrls,
  mergeScrapedContacts,
  scrapeContactsFromText,
} from '../quality/scrape-contact.util';
import { verifyCandidate } from '../quality/verify-contact.util';
import { normalizePhoneDigits } from '../quality/literal-contact.util';
import { PlacesClient } from '../places/places.client';
import type { PlaceCandidate } from '../places/places.types';
import { RawLeadHarvestRepository } from '../raw-lead-harvest.repository';
import type { RawLeadHarvestJobRow } from '../raw-lead-harvest.types';
import { computeIntentScore } from '../intent/intent-score.util';
import { buildMarketGraphQueries } from './hcm-grid.util';
import { MarketEntitiesRepository } from './market-entities.repository';

export type MarketGraphJobStats = {
  discovered: number;
  places_requests: number;
  census_new: number;
  census_updated: number;
  census_unchanged: number;
  filtered_crm: number;
  filtered_recent: number;
  filtered_blacklist: number;
  filtered_dedupe: number;
  skipped_unchanged: number;
  pending: number;
  rejected: number;
};

const MAX_PLACES_REQUESTS_DEFAULT = 40;
const DETAILS_PAGE_DELAY_MS = 250;
const NEXT_PAGE_DELAY_MS = 2100;
const QUERY_DELAY_MS = 400;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchEvidenceBundle(evidenceUrl: string): Promise<{
  fetch: Awaited<ReturnType<typeof fetchEvidenceText>>;
  combinedText: string;
}> {
  const primary = await fetchEvidenceText(evidenceUrl, { timeoutMs: 8000 });
  let combined = primary.text || '';
  const early = scrapeContactsFromText(combined);
  if (early.phone || early.email) {
    return { fetch: primary, combinedText: combined };
  }
  for (const alt of contactPageUrls(evidenceUrl).slice(0, 2)) {
    try {
      const altFetch = await fetchEvidenceText(alt, { timeoutMs: 6000 });
      if (altFetch.ok && altFetch.text) {
        combined = `${combined}\n${altFetch.text}`.slice(0, 500_000);
        const scraped = scrapeContactsFromText(altFetch.text);
        if (scraped.phone || scraped.email) break;
      }
    } catch {
      /* ignore */
    }
  }
  return {
    fetch: {
      ...primary,
      ok: primary.ok || combined.trim().length > 0,
      text: combined,
    },
    combinedText: combined,
  };
}

@Injectable()
export class MarketGraphWorker {
  private readonly logger = new Logger(MarketGraphWorker.name);

  constructor(
    private readonly repo: RawLeadHarvestRepository,
    private readonly marketEntities: MarketEntitiesRepository,
  ) {}

  async run(
    job: RawLeadHarvestJobRow,
    places: PlacesClient,
    opts?: { maxPlacesRequests?: number },
  ): Promise<{ inserted: number; rejected: number; stats: MarketGraphJobStats }> {
    const scanCap = job.scan_cap ?? Math.max(job.target_count * 10, 2000);
    const maxRequests = opts?.maxPlacesRequests ?? MAX_PLACES_REQUESTS_DEFAULT;

    const stats: MarketGraphJobStats = {
      discovered: 0,
      places_requests: 0,
      census_new: 0,
      census_updated: 0,
      census_unchanged: 0,
      filtered_crm: 0,
      filtered_recent: 0,
      filtered_blacklist: 0,
      filtered_dedupe: 0,
      skipped_unchanged: 0,
      pending: 0,
      rejected: 0,
    };

    const queries = buildMarketGraphQueries({
      industry_label: job.industry_label,
      province_code: job.province_code,
      province_name: job.province_name,
      ward_name: job.ward_name,
    });

    const byPlaceId = new Map<string, PlaceCandidate>();
    for (const query of queries) {
      if (byPlaceId.size >= scanCap || stats.places_requests >= maxRequests) break;
      let pageToken: string | undefined;
      let firstPage = true;
      while (byPlaceId.size < scanCap && stats.places_requests < maxRequests) {
        if (!firstPage && pageToken) await sleep(NEXT_PAGE_DELAY_MS);
        else if (!firstPage) break;
        if (firstPage && byPlaceId.size > 0) await sleep(QUERY_DELAY_MS);
        firstPage = false;
        const page = await places.textSearch(query, { pageToken });
        stats.places_requests += 1;
        for (const row of page.results) {
          if (byPlaceId.size >= scanCap) break;
          if (!byPlaceId.has(row.place_id)) byPlaceId.set(row.place_id, row);
        }
        stats.discovered = byPlaceId.size;
        if (!page.nextPageToken) break;
        pageToken = page.nextPageToken;
      }
    }

    const existingKeys = await this.repo.listDedupeKeys(job.project_id);
    const batchKeys: DedupeKey[] = [...existingKeys];
    const blacklist = await this.repo.listBlacklistEntries();
    let inserted = 0;
    let rejected = 0;

    for (const rough of byPlaceId.values()) {
      if (inserted >= job.target_count) break;
      if (stats.places_requests >= maxRequests) break;

      let place = rough;
      try {
        await sleep(DETAILS_PAGE_DELAY_MS);
        const detailed = await places.placeDetails(rough.place_id);
        stats.places_requests += 1;
        if (detailed) place = detailed;
      } catch (err) {
        this.logger.warn(
          `places_details_failed place=${rough.place_id}: ${
            err instanceof Error ? err.message : 'error'
          }`,
        );
      }

      const upsert = await this.marketEntities.upsertFromPlace({
        ...place,
        industry_key: job.industry_key,
        province_code: job.province_code,
      });
      if (upsert.change === 'new') stats.census_new += 1;
      else if (upsert.change === 'updated') stats.census_updated += 1;
      else stats.census_unchanged += 1;

      if (upsert.change === 'unchanged') {
        stats.skipped_unchanged += 1;
        continue;
      }

      const phoneNorm = place.phone ? normalizePhoneDigits(place.phone) : null;
      const companyNorm = normalizeCompanyKey(place.company_name);

      if (phoneNorm && (await this.repo.findAlreadyCustomerByPhone(phoneNorm))) {
        stats.filtered_crm += 1;
        continue;
      }
      if (
        await this.repo.hasRecentAcceptedOrPushed(job.project_id, {
          phone_norm: phoneNorm,
          company_name_norm: companyNorm,
          days: 90,
        })
      ) {
        stats.filtered_recent += 1;
        continue;
      }

      const blacklistHit = candidateHitsBlacklist(
        {
          phone_norm: phoneNorm,
          email: null,
          company_name: place.company_name,
          website: place.website,
        },
        blacklist,
      );
      if (blacklistHit) {
        stats.filtered_blacklist += 1;
        continue;
      }

      const evidenceUrl = place.website || place.maps_url || '';
      if (!evidenceUrl) {
        continue;
      }

      let combinedText = '';
      let fetchResult = await fetchEvidenceText(evidenceUrl, { timeoutMs: 8000 });
      if (place.website) {
        const bundle = await fetchEvidenceBundle(place.website);
        fetchResult = bundle.fetch;
        combinedText = bundle.combinedText;
      } else {
        combinedText = fetchResult.text || '';
      }

      const scraped = scrapeContactsFromText(combinedText);
      const merged = mergeScrapedContacts(
        { phone: place.phone, email: null },
        scraped,
      );

      const intentScore = computeIntentScore({
        company_name: place.company_name,
        has_places_phone: Boolean(place.phone),
        has_website: Boolean(place.website),
        website_fetch_ok: fetchResult.ok,
        scraped_contact: Boolean(merged.phone || merged.email),
        ratings_total: place.user_ratings_total,
      });

      const evidenceSnippet = [
        place.company_name,
        place.address,
        merged.phone,
        merged.email,
      ]
        .filter(Boolean)
        .join(' — ');
      const fetchForVerify = {
        ok: true as const,
        text: `${combinedText}\n${evidenceSnippet}`,
        status: fetchResult.status,
      };

      const verified = verifyCandidate(
        {
          company_name: place.company_name,
          address: place.address,
          phone: merged.phone,
          email: merged.email,
          contact_title: null,
          website: place.website,
          evidence_url: evidenceUrl,
          evidence_snippet: evidenceSnippet,
          discovered_via_source_key: 'google_maps',
          confidence: 0.7,
        },
        fetchForVerify,
        {
          expectedProvinceHint: job.province_name,
          relaxEmailLiteral: true,
        },
      );

      const dedupe = buildDedupeKey({
        company_name: place.company_name,
        phone_norm: verified.phone_norm,
        email: verified.email_out,
      });
      if (isDuplicateAgainst(dedupe, batchKeys)) {
        stats.filtered_dedupe += 1;
        continue;
      }

      const qualityScore = computeQualityScore(verified, 0.7);
      const gate = applyQualityGate('market_graph', qualityScore, verified);
      const status = gate === 'pending' ? 'pending' : 'auto_rejected';
      if (status === 'auto_rejected') {
        rejected += 1;
        stats.rejected += 1;
      } else {
        inserted += 1;
        stats.pending += 1;
      }

      const classification = resolveLeadClassification({
        criticFlag: intentScore < 55 ? 'weak_contact' : 'keep',
        forceReject: false,
        status,
      });

      await this.repo.insertLead({
        project_id: job.project_id,
        job_id: job.id,
        company_name: place.company_name,
        company_name_norm: companyNorm,
        address: place.address,
        phone: verified.phone_out,
        phone_norm: verified.phone_norm,
        email: verified.email_out,
        contact_title: null,
        website: place.website,
        evidence_url: evidenceUrl,
        evidence_snippet: evidenceSnippet,
        source_provider: 'google_places',
        source_model: 'places_market_graph',
        search_source_keys: job.sources_json.map((s) => s.key),
        search_channel_keys: job.channels_json.map((s) => s.key),
        discovered_via_source_key: 'google_maps',
        confidence: 0.7,
        quality_score: qualityScore,
        icp_fit_score: Math.min(100, Math.round(qualityScore * 0.9)),
        contactable: Boolean(verified.phone_ok || verified.email_ok) && status === 'pending',
        phone_kind: verified.phone_kind ?? null,
        status,
        classification,
        place_id: place.place_id,
        intent_score: intentScore,
        market_entity_id: upsert.entity_id,
        verify_json: {
          evidence_ok: verified.evidence_ok,
          phone_ok: verified.phone_ok,
          email_ok: verified.email_ok,
          fetch: verified.fetch,
          reasons: verified.reasons,
          gate,
          intent_score: intentScore,
          place_id: place.place_id,
          market_entity_id: upsert.entity_id,
          census_change: upsert.change,
          classification,
        },
        raw_json: { place, census_change: upsert.change },
      });

      batchKeys.push(dedupe);
    }

    stats.discovered = byPlaceId.size;
    return { inserted, rejected, stats };
  }
}
