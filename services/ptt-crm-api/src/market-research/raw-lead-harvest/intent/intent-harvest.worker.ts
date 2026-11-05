import { Injectable, Logger } from '@nestjs/common';
import { candidateHitsBlacklist } from '../blacklist.util';
import { fetchEvidenceText } from '../quality/evidence-fetch.util';
import { computeQualityScore } from '../quality/quality-score.util';
import { classifyRawLeadReadiness } from '../quality/readiness-classify.util';
import { normalizeCompanyKey } from '../quality/dedupe.util';
import {
  contactPageUrls,
  mergeScrapedContacts,
  scrapeContactsFromText,
} from '../quality/scrape-contact.util';
import { verifyCandidate } from '../quality/verify-contact.util';
import { normalizePhoneDigits } from '../quality/literal-contact.util';
import { isDenylistedEvidenceHost, isSequentialOrRepeatedPhone } from '../quality/brq-patterns.util';
import { PlacesClient } from '../places/places.client';
import type { PlaceCandidate } from '../places/places.types';
import { buildMarketGraphQueries } from '../market-graph/hcm-grid.util';
import { RawLeadHarvestRepository } from '../raw-lead-harvest.repository';
import type { RawLeadHarvestJobRow } from '../raw-lead-harvest.types';
import { computeIntentScore } from './intent-score.util';

export type IntentJobStats = {
  discovered: number;
  places_requests: number;
  search_requests: number;
  details_requests: number;
  skipped_place_id: number;
  inserted: number;
  ready_to_push: number;
  needs_review: number;
  missing_contact: number;
  duplicate_or_blacklist: number;
  pending: number;
  rejected: number;
};

const MAX_SEARCH_REQUESTS_DEFAULT = 60;
/** Place Details enrichment cap (independent of search). */
const MAX_DETAILS_REQUESTS_DEFAULT = 200;
const DETAILS_PAGE_DELAY_MS = 250;
const NEXT_PAGE_DELAY_MS = 2100;
const QUERY_DELAY_MS = 400;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Facebook/Instagram listed as "website" on Maps → fanpage, not company site. */
function splitPlacesWebChannels(website: string | null): {
  website: string | null;
  fanpage_url: string | null;
} {
  const raw = String(website ?? '').trim();
  if (!raw) return { website: null, fanpage_url: null };
  try {
    const host = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`).hostname;
    if (/(^|\.)facebook\.com$|(^|\.)fb\.com$|(^|\.)instagram\.com$/i.test(host)) {
      return { website: null, fanpage_url: raw.startsWith('http') ? raw : `https://${raw}` };
    }
  } catch {
    /* keep as website */
  }
  return { website: raw, fanpage_url: null };
}

function preferEvidenceUrl(input: {
  website: string | null;
  fanpage_url: string | null;
  maps_url: string | null;
  place_id: string;
}): string {
  if (input.website && !isDenylistedEvidenceHost(input.website)) return input.website;
  if (input.maps_url) return input.maps_url;
  if (input.place_id) {
    return `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(input.place_id)}`;
  }
  if (input.fanpage_url) return input.fanpage_url;
  return '';
}

function mergePlace(base: PlaceCandidate, detailed: PlaceCandidate): PlaceCandidate {
  return {
    ...base,
    ...detailed,
    phone: detailed.phone || base.phone,
    website: detailed.website || base.website,
    maps_url: detailed.maps_url || base.maps_url,
    address: detailed.address || base.address,
  };
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
export class IntentHarvestWorker {
  private readonly logger = new Logger(IntentHarvestWorker.name);

  constructor(private readonly repo: RawLeadHarvestRepository) {}

  async run(
    job: RawLeadHarvestJobRow,
    places: PlacesClient,
    opts?: {
      maxPlacesRequests?: number;
      maxSearchRequests?: number;
      maxDetailsRequests?: number;
    },
  ): Promise<{ inserted: number; rejected: number; stats: IntentJobStats }> {
    const scanCap = job.scan_cap ?? Math.max(job.target_count * 5, 200);
    // Legacy opt: maxPlacesRequests applied to search budget only (details are separate).
    const maxSearchRequests =
      opts?.maxSearchRequests ?? opts?.maxPlacesRequests ?? MAX_SEARCH_REQUESTS_DEFAULT;
    const maxDetailsRequests = opts?.maxDetailsRequests ?? MAX_DETAILS_REQUESTS_DEFAULT;

    const stats: IntentJobStats = {
      discovered: 0,
      places_requests: 0,
      search_requests: 0,
      details_requests: 0,
      skipped_place_id: 0,
      inserted: 0,
      ready_to_push: 0,
      needs_review: 0,
      missing_contact: 0,
      duplicate_or_blacklist: 0,
      pending: 0,
      rejected: 0,
    };

    // HCM uses district grid (same as market_graph); other provinces = single query.
    const queries = buildMarketGraphQueries({
      industry_label: job.industry_label,
      province_code: job.province_code,
      province_name: job.province_name,
      ward_name: job.ward_name,
    });

    const byPlaceId = new Map<string, PlaceCandidate>();
    for (const query of queries) {
      if (byPlaceId.size >= scanCap || stats.search_requests >= maxSearchRequests) break;
      let pageToken: string | undefined;
      let firstPage = true;
      while (byPlaceId.size < scanCap && stats.search_requests < maxSearchRequests) {
        if (!firstPage && pageToken) await sleep(NEXT_PAGE_DELAY_MS);
        else if (!firstPage) break;
        if (firstPage && byPlaceId.size > 0) await sleep(QUERY_DELAY_MS);
        firstPage = false;
        const page = await places.textSearch(query, { pageToken });
        stats.search_requests += 1;
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

    const candidates = [...byPlaceId.values()];
    const blacklist = await this.repo.listBlacklistEntries();
    let inserted = 0;
    const seenPhones = new Set<string>();

    for (const rough of candidates) {
      if (stats.details_requests >= maxDetailsRequests) break;

      if (rough.place_id && (await this.repo.hasPlaceIdInProject(job.project_id, rough.place_id))) {
        stats.skipped_place_id += 1;
        continue;
      }

      let place = rough;
      const enrichDetails = async () => {
        await sleep(DETAILS_PAGE_DELAY_MS);
        const detailed = await places.placeDetails(rough.place_id);
        stats.details_requests += 1;
        stats.places_requests += 1;
        if (detailed) place = mergePlace(place, detailed);
      };
      try {
        await enrichDetails();
        if (!place.phone && !place.website) {
          await sleep(400);
          await enrichDetails();
        }
      } catch (err) {
        this.logger.warn(
          `places_details_failed place=${rough.place_id}: ${
            err instanceof Error ? err.message : 'error'
          }`,
        );
      }

      const channels = splitPlacesWebChannels(place.website);
      const companyWebsite = channels.website;
      const fanpageUrl = channels.fanpage_url;

      const phoneNorm = place.phone ? normalizePhoneDigits(place.phone) : null;
      const companyNorm = normalizeCompanyKey(place.company_name);

      const existingCrm = phoneNorm
        ? await this.repo.findAlreadyCustomerByPhone(phoneNorm)
        : false;
      const blacklistHit = candidateHitsBlacklist(
        {
          phone_norm: phoneNorm,
          email: null,
          company_name: place.company_name,
          website: companyWebsite || fanpageUrl,
        },
        blacklist,
      );
      const dupPhone =
        Boolean(phoneNorm) &&
        (seenPhones.has(phoneNorm!) ||
          (await this.repo.hasDuplicatePhoneInProject(job.project_id, phoneNorm!)));

      const evidenceUrl = preferEvidenceUrl({
        website: companyWebsite,
        fanpage_url: fanpageUrl,
        maps_url: place.maps_url,
        place_id: place.place_id,
      });

      let websiteFetchOk = false;
      let scrapedContact = false;
      let combinedText = '';
      let fetchResult = await fetchEvidenceText(evidenceUrl || place.maps_url || '', {
        timeoutMs: 8000,
      });

      if (companyWebsite) {
        const bundle = await fetchEvidenceBundle(companyWebsite);
        fetchResult = bundle.fetch;
        combinedText = bundle.combinedText;
        websiteFetchOk = bundle.fetch.ok;
      } else {
        combinedText = fetchResult.text || '';
        websiteFetchOk = fetchResult.ok;
      }

      const scraped = scrapeContactsFromText(combinedText);
      const merged = mergeScrapedContacts(
        { phone: place.phone, email: null },
        scraped,
      );
      scrapedContact = Boolean(merged.phone || merged.email);

      const intentScore = computeIntentScore({
        company_name: place.company_name,
        has_places_phone: Boolean(place.phone),
        has_website: Boolean(companyWebsite),
        website_fetch_ok: websiteFetchOk,
        scraped_contact: scrapedContact,
        ratings_total: place.user_ratings_total,
      });

      const evidenceSnippet = [
        place.company_name,
        place.address,
        merged.phone,
        merged.email,
        fanpageUrl,
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
          website: companyWebsite,
          evidence_url: evidenceUrl || place.maps_url || `place:${place.place_id}`,
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

      const qualityScore = computeQualityScore(verified, 0.7);
      const phoneValid =
        Boolean(verified.phone_norm) &&
        verified.phone_ok &&
        !isSequentialOrRepeatedPhone(verified.phone_norm || '');
      const emailValid = Boolean(verified.email_out) && verified.email_ok;
      const companyWebsiteOk =
        Boolean(companyWebsite) && !isDenylistedEvidenceHost(companyWebsite || '');
      const socialOnly = Boolean(fanpageUrl) && !companyWebsiteOk;

      const readiness = classifyRawLeadReadiness({
        phone_valid: phoneValid,
        email_valid: emailValid,
        company_website_ok: companyWebsiteOk,
        social_only: socialOnly,
        quality_score: qualityScore,
        blacklist_hit: Boolean(blacklistHit),
        existing_crm_customer: existingCrm,
        duplicate_phone_in_project: dupPhone,
        vertical_ok: Boolean(job.industry_key),
        territory_ok: Boolean(job.province_code || job.province_name),
      });

      if (readiness.readiness_status === 'READY_TO_PUSH') stats.ready_to_push += 1;
      else if (readiness.readiness_status === 'NEEDS_REVIEW') stats.needs_review += 1;
      else if (readiness.readiness_status === 'MISSING_CONTACT') stats.missing_contact += 1;
      else stats.duplicate_or_blacklist += 1;

      try {
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
          website: companyWebsite,
          fanpage_url: fanpageUrl,
          evidence_url: evidenceUrl || place.maps_url,
          evidence_snippet: evidenceSnippet,
          source_provider: 'google_places',
          source_model: 'places_new',
          search_source_keys: job.sources_json.map((s) => s.key),
          search_channel_keys: job.channels_json.map((s) => s.key),
          discovered_via_source_key: 'google_maps',
          confidence: 0.7,
          quality_score: qualityScore,
          icp_fit_score: Math.min(100, Math.round(qualityScore * 0.9)),
          contactable: Boolean(verified.phone_ok || verified.email_ok),
          phone_kind: verified.phone_kind ?? null,
          status: 'pending',
          classification: readiness.classification,
          readiness_status: readiness.readiness_status,
          readiness_reason_codes: readiness.readiness_reason_codes,
          place_id: place.place_id,
          intent_score: intentScore,
          verify_json: {
            evidence_ok: verified.evidence_ok,
            phone_ok: verified.phone_ok,
            email_ok: verified.email_ok,
            fetch: verified.fetch,
            reasons: verified.reasons,
            readiness: readiness.readiness_status,
            readiness_reason_codes: readiness.readiness_reason_codes,
            intent_score: intentScore,
            place_id: place.place_id,
            classification: readiness.classification,
            already_customer: existingCrm,
          },
          raw_json: { place },
        });
        inserted += 1;
        stats.inserted += 1;
        stats.pending += 1;
        if (phoneNorm) seenPhones.add(phoneNorm);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/uq_raw_leads_project_place|duplicate key/i.test(msg)) {
          stats.skipped_place_id += 1;
        } else {
          this.logger.warn(`insert_raw_lead_failed place=${place.place_id}: ${msg}`);
          stats.rejected += 1;
        }
      }
    }

    stats.discovered = candidates.length;
    return { inserted, rejected: stats.rejected, stats };
  }
}
