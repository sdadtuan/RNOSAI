import { Injectable, Logger } from '@nestjs/common';
import type { ResearchAiAuthType } from './ai-providers.types';
import { candidateHitsBlacklist } from './blacklist.util';
import {
  applyCrossCheckToScore,
  buildCrossCheckPrompt,
  parseCrossCheckResponse,
  type ParsedCrossCheck,
} from './cross-check.util';
import {
  applyLegalStatusScoreBoost,
  enrichLegalStatus,
  legalEnrichEnabled,
  type LegalStatus,
} from './enrich/legal-status.util';
import {
  applyCriticFlagToLead,
  parseCriticClassifications,
  resolveLeadClassification,
  type CriticFlag,
} from './harvest-critic.util';
import { callHarvestChatCompletion } from './harvest-llm.client';
import { parseHarvestAiLeads, type HarvestAiLead } from './harvest-parse.util';
import {
  buildCriticPrompt,
  buildDiscoverPrompt,
  buildExtractPrompt,
} from './harvest-prompt';
import {
  buildDedupeKey,
  isDuplicateAgainst,
  normalizeCompanyKey,
  type DedupeKey,
} from './quality/dedupe.util';
import { fetchEvidenceText } from './quality/evidence-fetch.util';
import { applyQualityGate } from './quality/quality-gate.util';
import { computeQualityScore } from './quality/quality-score.util';
import {
  contactPageUrls,
  mergeScrapedContacts,
  scrapeContactsFromText,
} from './quality/scrape-contact.util';
import { verifyCandidate, type VerifyResult } from './quality/verify-contact.util';
import { RawLeadHarvestRepository } from './raw-lead-harvest.repository';
import type { RawLeadHarvestJobRow } from './raw-lead-harvest.types';

export type HarvestRuntimeCred = {
  baseUrl: string;
  model: string;
  apiToken: string;
  authType: ResearchAiAuthType;
  authHeaderName: string;
  credentialId: number | null;
  providerCode?: string;
};

type ScoredRow = {
  ai: HarvestAiLead;
  verified: VerifyResult;
  score: number;
  crossCheck: (ParsedCrossCheck & { provider: string; model: string }) | null;
  forceReject: boolean;
  criticFlag: CriticFlag;
  criticReason: string | null;
  legalStatus: LegalStatus | null;
  legalDetail: string | null;
};

async function fetchEvidenceBundle(evidenceUrl: string): Promise<{
  fetch: Awaited<ReturnType<typeof fetchEvidenceText>>;
  combinedText: string;
}> {
  const primary = await fetchEvidenceText(evidenceUrl, { timeoutMs: 8000 });
  let combined = primary.text || '';
  const early = scrapeContactsFromText(`${combined}`);
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
      // ignore secondary contact-page failures
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
export class HarvestWorkerService {
  private readonly logger = new Logger(HarvestWorkerService.name);

  constructor(private readonly repo: RawLeadHarvestRepository) {}

  async runRealHarvest(
    job: RawLeadHarvestJobRow,
    runtime: HarvestRuntimeCred,
    opts?: { crossCheckRuntime?: HarvestRuntimeCred | null },
  ): Promise<{ inserted: number; rejected: number }> {
    if (!runtime.apiToken || !runtime.baseUrl) {
      throw new Error('harvest_provider_not_configured');
    }

    if (runtime.credentialId != null) {
      await this.repo.setJobCredentialId(job.id, runtime.credentialId);
    }

    const sourceKeys = job.sources_json.map((s) => s.key);
    const llmBase = {
      baseUrl: runtime.baseUrl,
      model: runtime.model,
      apiToken: runtime.apiToken,
      authType: runtime.authType,
      authHeaderName: runtime.authHeaderName,
    };

    // Pass A — Discover
    const discover = await callHarvestChatCompletion({
      ...llmBase,
      user: buildDiscoverPrompt(job),
      temperature: 0.3,
    });
    let candidates = parseHarvestAiLeads(discover.content, {
      mode: job.mode,
      sourceKeys,
    }).slice(0, Math.max(job.target_count * 2, job.target_count));

    // Pass A2 — Extract per URL
    const refined: HarvestAiLead[] = [];
    for (const c of candidates.slice(0, Math.min(candidates.length, job.target_count + 5))) {
      try {
        const extract = await callHarvestChatCompletion({
          ...llmBase,
          user: buildExtractPrompt({
            company_name: c.company_name,
            evidence_url: c.evidence_url,
            job,
          }),
          temperature: 0.1,
        });
        const parsed = parseHarvestAiLeads(extract.content, {
          mode: job.mode,
          sourceKeys,
        });
        const one = parsed[0];
        if (one) {
          refined.push({
            ...c,
            ...one,
            company_name: one.company_name || c.company_name,
            evidence_url: one.evidence_url || c.evidence_url,
            discovered_via_source_key:
              one.discovered_via_source_key ?? c.discovered_via_source_key,
          });
        } else {
          refined.push(c);
        }
      } catch (err) {
        this.logger.warn(
          `extract_failed job=${job.id} company=${c.company_name}: ${
            err instanceof Error ? err.message : 'error'
          }`,
        );
        refined.push(c);
      }
    }
    candidates = refined.length ? refined : candidates;

    // Pass C — Critic (soft): classify / forceReject, NEVER silent-drop candidates.
    const criticByIndex = new Map<
      number,
      { flag: CriticFlag; reason: string | null }
    >();
    try {
      const critic = await callHarvestChatCompletion({
        ...llmBase,
        user: buildCriticPrompt(JSON.stringify(candidates)),
        temperature: 0,
      });
      const parsed = parseCriticClassifications(critic.content, candidates.length);
      for (const [idx, verdict] of parsed) {
        criticByIndex.set(idx, verdict);
      }
    } catch (err) {
      this.logger.warn(
        `critic_failed job=${job.id}: ${err instanceof Error ? err.message : 'error'}`,
      );
    }

    // Pass B + interim score for all candidates
    const scored: ScoredRow[] = [];
    for (let i = 0; i < candidates.length; i += 1) {
      const c = candidates[i]!;
      const critic = criticByIndex.get(i) ?? { flag: 'keep' as CriticFlag, reason: null };
      const criticApplied = applyCriticFlagToLead(critic.flag);
      const { fetch, combinedText } = await fetchEvidenceBundle(c.evidence_url);
      const scraped = scrapeContactsFromText(
        `${combinedText}\n${c.evidence_snippet ?? ''}`,
      );
      const merged = mergeScrapedContacts(
        { phone: c.phone, email: c.email },
        scraped,
      );
      const enriched: HarvestAiLead = {
        ...c,
        phone: merged.phone,
        email: merged.email,
          field_sources: {
            phone:
              merged.scraped && !c.phone?.trim() && scraped.phone
                ? c.evidence_url
                : c.field_sources.phone,
            email:
              merged.scraped && !c.email?.trim() && scraped.email
                ? c.evidence_url
                : c.field_sources.email,
            address: c.field_sources.address,
          },
        };
      const verified = verifyCandidate(
        {
          company_name: enriched.company_name,
          address: enriched.address,
          phone: enriched.phone,
          email: enriched.email,
          contact_title: enriched.contact_title,
          website: enriched.website,
          evidence_url: enriched.evidence_url,
          evidence_snippet: enriched.evidence_snippet,
          discovered_via_source_key: enriched.discovered_via_source_key,
          confidence: enriched.confidence,
        },
        fetch,
        {
          expectedProvinceHint: job.province_code === 'all' ? null : job.province_name,
          relaxEmailLiteral: job.mode === 'marketing',
        },
      );
      scored.push({
        ai: enriched,
        verified,
        score: computeQualityScore(verified, enriched.confidence),
        crossCheck: null,
        forceReject: criticApplied.forceReject,
        criticFlag: critic.flag,
        criticReason: critic.reason,
        legalStatus: null,
        legalDetail: null,
      });
    }

    // H3b — Cross-check top N with provider B
    const crossRuntime = opts?.crossCheckRuntime ?? null;
    if (job.cross_check && crossRuntime?.apiToken && crossRuntime.baseUrl) {
      const topN = Math.min(10, job.target_count, scored.length);
      const ranked = [...scored].sort((a, b) => b.score - a.score).slice(0, topN);
      for (const row of ranked) {
        try {
          const cc = await callHarvestChatCompletion({
            baseUrl: crossRuntime.baseUrl,
            model: crossRuntime.model,
            apiToken: crossRuntime.apiToken,
            authType: crossRuntime.authType,
            authHeaderName: crossRuntime.authHeaderName,
            user: buildCrossCheckPrompt({
              company_name: row.ai.company_name,
              address: row.ai.address,
              phone: row.verified.phone_out,
              email: row.verified.email_out,
              website: row.ai.website,
              evidence_url: row.ai.evidence_url,
              province_name:
                job.province_code === 'all' ? 'Việt Nam' : job.province_name,
            }),
            temperature: 0,
          });
          const parsed = parseCrossCheckResponse(cc.content);
          const applied = applyCrossCheckToScore(row.score, parsed);
          row.score = applied.score;
          row.forceReject = applied.forceReject;
          row.crossCheck = {
            ...parsed,
            provider: crossRuntime.providerCode ?? 'provider_b',
            model: crossRuntime.model,
          };
        } catch (err) {
          this.logger.warn(
            `cross_check_failed job=${job.id} company=${row.ai.company_name}: ${
              err instanceof Error ? err.message : 'error'
            }`,
          );
          row.crossCheck = {
            verdict: 'uncertain',
            confidence: 0,
            reason: err instanceof Error ? err.message : 'cross_check_failed',
            provider: crossRuntime.providerCode ?? 'provider_b',
            model: crossRuntime.model,
          };
        }
      }
    }

    // H3c — optional legal / Places enrich (score boost only)
    if (legalEnrichEnabled()) {
      for (const row of scored) {
        try {
          const legal = await enrichLegalStatus({
            company_name: row.ai.company_name,
            address: row.ai.address,
            province_name:
              job.province_code === 'all' ? 'Việt Nam' : job.province_name,
            phone: row.verified.phone_out,
            website: row.ai.website,
          });
          row.legalStatus = legal.status;
          row.legalDetail = legal.detail;
          row.score = applyLegalStatusScoreBoost(row.score, legal.status);
        } catch (err) {
          this.logger.warn(
            `legal_enrich_failed job=${job.id}: ${
              err instanceof Error ? err.message : 'error'
            }`,
          );
          row.legalStatus = 'unverified';
          row.legalDetail = 'enrich_error';
        }
      }
    }

    // Persist (highest score first)
    scored.sort((a, b) => b.score - a.score);
    const existingKeys = await this.repo.listDedupeKeys(job.project_id);
    const batchKeys: DedupeKey[] = [...existingKeys];
    const blacklist = await this.repo.listBlacklistEntries();
    let inserted = 0;
    let rejected = 0;

    for (const row of scored) {
      if (inserted >= job.target_count) break;

      const { ai: c, verified } = row;
      const blacklistHit = candidateHitsBlacklist(
        {
          phone_norm: verified.phone_norm,
          email: verified.email_out,
          company_name: c.company_name,
          website: c.website,
        },
        blacklist,
      );
      if (blacklistHit) {
        rejected += 1;
        continue;
      }

      const dedupe = buildDedupeKey({
        company_name: c.company_name,
        phone_norm: verified.phone_norm,
        email: verified.email_out,
      });
      const dedupeHit = isDuplicateAgainst(dedupe, batchKeys);
      if (dedupeHit) {
        rejected += 1;
        continue;
      }

      const alreadyCustomer = verified.phone_norm
        ? await this.repo.findAlreadyCustomerByPhone(verified.phone_norm)
        : false;

      let gate = applyQualityGate(job.mode, row.score, verified);
      if (row.forceReject) gate = 'auto_rejected';

      const contactable = Boolean(verified.phone_ok || verified.email_ok);
      const status = gate === 'pending' ? 'pending' : 'auto_rejected';
      if (status === 'auto_rejected') rejected += 1;

      const classification = resolveLeadClassification({
        criticFlag: row.criticFlag,
        forceReject: row.forceReject,
        status,
      });

      await this.repo.insertLead({
        project_id: job.project_id,
        job_id: job.id,
        company_name: c.company_name,
        company_name_norm: normalizeCompanyKey(c.company_name),
        address: c.address,
        phone: verified.phone_out,
        phone_norm: verified.phone_norm,
        email: verified.email_out,
        contact_title: c.contact_title,
        website: c.website,
        evidence_url: c.evidence_url,
        evidence_snippet: c.evidence_snippet,
        source_provider: job.provider,
        source_model: job.model || runtime.model,
        search_source_keys: sourceKeys,
        search_channel_keys: job.channels_json.map((s) => s.key),
        discovered_via_source_key: c.discovered_via_source_key,
        confidence: c.confidence,
        quality_score: row.score,
        icp_fit_score: Math.min(100, Math.round(row.score * 0.9)),
        contactable: contactable && status === 'pending',
        phone_kind: verified.phone_kind ?? null,
        legal_status: row.legalStatus,
        status,
        classification,
        verify_json: {
          evidence_ok: verified.evidence_ok,
          phone_ok: verified.phone_ok,
          email_ok: verified.email_ok,
          geo_ok: verified.geo_ok,
          title_ok: verified.title_ok,
          website_domain_ok: verified.website_domain_ok,
          fetch: verified.fetch,
          reasons: verified.reasons,
          phone_kind: verified.phone_kind,
          already_customer: alreadyCustomer,
          field_sources: c.field_sources,
          gate,
          critic_flag: row.criticFlag,
          critic_reason: row.criticReason,
          classification,
          cross_check: row.crossCheck,
          legal_status: row.legalStatus,
          legal_detail: row.legalDetail,
        },
        raw_json: {
          ai: c,
          discover_model: discover.model,
          critic: { flag: row.criticFlag, reason: row.criticReason },
          cross_check: row.crossCheck,
          legal: row.legalStatus
            ? { status: row.legalStatus, detail: row.legalDetail }
            : null,
        },
      });

      batchKeys.push(dedupe);
      if (status === 'pending') inserted += 1;
    }

    return { inserted, rejected };
  }
}
