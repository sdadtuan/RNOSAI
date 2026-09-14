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
  legalStatus: LegalStatus | null;
  legalDetail: string | null;
};

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

    // Pass C — Critic
    try {
      const critic = await callHarvestChatCompletion({
        ...llmBase,
        user: buildCriticPrompt(JSON.stringify(candidates)),
        temperature: 0,
      });
      const dropIdx = parseCriticDropIndexes(critic.content, candidates.length);
      if (dropIdx.size > 0) {
        candidates = candidates.filter((_, i) => !dropIdx.has(i));
      }
    } catch (err) {
      this.logger.warn(
        `critic_failed job=${job.id}: ${err instanceof Error ? err.message : 'error'}`,
      );
    }

    // Pass B + interim score for all candidates
    const scored: ScoredRow[] = [];
    for (const c of candidates) {
      const fetch = await fetchEvidenceText(c.evidence_url, { timeoutMs: 8000 });
      const verified = verifyCandidate(
        {
          company_name: c.company_name,
          address: c.address,
          phone: c.phone,
          email: c.email,
          contact_title: c.contact_title,
          website: c.website,
          evidence_url: c.evidence_url,
          evidence_snippet: c.evidence_snippet,
          discovered_via_source_key: c.discovered_via_source_key,
          confidence: c.confidence,
        },
        fetch,
        { expectedProvinceHint: job.province_name },
      );
      scored.push({
        ai: c,
        verified,
        score: computeQualityScore(verified, c.confidence),
        crossCheck: null,
        forceReject: false,
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
              province_name: job.province_name,
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
            province_name: job.province_name,
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
      if (
        candidateHitsBlacklist(
          {
            phone_norm: verified.phone_norm,
            email: verified.email_out,
            company_name: c.company_name,
            website: c.website,
          },
          blacklist,
        )
      ) {
        rejected += 1;
        continue;
      }

      const dedupe = buildDedupeKey({
        company_name: c.company_name,
        phone_norm: verified.phone_norm,
        email: verified.email_out,
      });
      if (isDuplicateAgainst(dedupe, batchKeys)) {
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
          cross_check: row.crossCheck,
          legal_status: row.legalStatus,
          legal_detail: row.legalDetail,
        },
        raw_json: {
          ai: c,
          discover_model: discover.model,
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

function parseCriticDropIndexes(raw: string, len: number): Set<number> {
  const text = String(raw ?? '').trim();
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start < 0 || end <= start) return new Set();
  try {
    const arr = JSON.parse(text.slice(start, end + 1)) as unknown;
    if (!Array.isArray(arr)) return new Set();
    return new Set(
      arr
        .map((n) => Number(n))
        .filter((n) => Number.isInteger(n) && n >= 0 && n < len),
    );
  } catch {
    return new Set();
  }
}
