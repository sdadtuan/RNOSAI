import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { CrmConfigService } from '../../crm-config/crm-config.service';
import { LeadsWriteService } from '../../leads/leads-write.service';
import { VnAdminGeoRepository } from '../../vn-admin-geo/vn-admin-geo.repository';
import { ResearchAiProvidersRepository } from './ai-providers.repository';
import {
  blacklistEntriesFromFeedback,
  candidateHitsBlacklist,
  isDialOutcome,
  isFeedbackCode,
} from './blacklist.util';
import { buildRawLeadsCsv } from './export-csv.util';
import { HarvestWorkerService } from './harvest-worker.service';
import { IntentHarvestWorker } from './intent/intent-harvest.worker';
import { MarketEntitiesRepository } from './market-graph/market-entities.repository';
import { MarketGraphWorker } from './market-graph/market-graph.worker';
import { PlacesClient } from './places/places.client';
import { readinessAfterAccept } from './accept-readiness.util';
import { filterBulkAcceptCandidates } from './bulk-accept.util';
import { assertRawLeadPushable } from './push-crm.util';
import { classifyRawLeadReadiness } from './quality/readiness-classify.util';
import { buildReadinessInputFromRawLead } from './quality/readiness-from-row.util';
import { normalizePhoneDigits } from './quality/literal-contact.util';
import {
  assertManualReadyAllowed,
  isRawLeadReadinessStatus,
} from './readiness-patch.util';
import { RawLeadHarvestRepository } from './raw-lead-harvest.repository';
import {
  buildAccountClusterKey,
  computePriorityTier,
} from './quality/priority-cluster.util';
import { buildRawLeadBattlecard } from './quality/battlecard.util';
import type { RawLeadBattlecard } from './quality/battlecard.util';
import type {
  BulkAcceptRawLeadsBody,
  CreateRawLeadHarvestBody,
  EnrichRawLeadsContactsBody,
  ExportRawLeadsBody,
  PatchRawLeadBody,
  PushRawLeadsBody,
  ReclassifyRawLeadsBody,
  RecomputePriorityBody,
  RawLeadRow,
} from './raw-lead-harvest.types';
import {
  mergeContactEnrichment,
  scrapeFromFetchedText,
} from './quality/contact-enrich.util';
import { fetchEvidenceText } from './quality/evidence-fetch.util';
import { contactPageUrls } from './quality/scrape-contact.util';
import {
  normalizeHarvestMode,
  validateCreateRawLeadHarvest,
} from './raw-lead-harvest.validation';
import {
  parseRawLeadListQuery,
  totalPages,
} from './raw-lead-list-query.util';

function harvestEnabled(): boolean {
  return String(process.env.PTT_RESEARCH_RAW_LEAD_HARVEST ?? '').trim() === '1';
}

function harvestMock(): boolean {
  const raw = String(process.env.PTT_RESEARCH_HARVEST_MOCK ?? '1').trim();
  return raw !== '0' && raw.toLowerCase() !== 'false';
}

function intentHarvestEnabled(): boolean {
  return ['1', 'true', 'yes', 'on'].includes(
    String(process.env.PTT_RESEARCH_HARVEST_INTENT ?? '').trim().toLowerCase(),
  );
}

function marketGraphHarvestEnabled(): boolean {
  return ['1', 'true', 'yes', 'on'].includes(
    String(process.env.PTT_RESEARCH_HARVEST_MARKET_GRAPH ?? '').trim().toLowerCase(),
  );
}

function googlePlacesApiKey(): string {
  return String(process.env.PTT_GOOGLE_PLACES_API_KEY ?? '').trim();
}

function isPlacesMode(mode: string): boolean {
  return mode === 'intent' || mode === 'market_graph';
}

@Injectable()
export class RawLeadHarvestService {
  constructor(
    private readonly repo: RawLeadHarvestRepository,
    private readonly aiProviders: ResearchAiProvidersRepository,
    private readonly crmConfig: CrmConfigService,
    private readonly vnGeo: VnAdminGeoRepository,
    private readonly worker: HarvestWorkerService,
    private readonly intentWorker: IntentHarvestWorker,
    private readonly marketGraphWorker: MarketGraphWorker,
    private readonly marketEntities: MarketEntitiesRepository,
    private readonly leadsWrite: LeadsWriteService,
  ) {}

  assertEnabled() {
    if (!harvestEnabled()) {
      throw new ServiceUnavailableException({ error: 'raw_lead_harvest_disabled' });
    }
  }

  async listHarvestProviders() {
    this.assertEnabled();
    return this.aiProviders.listHarvestProviders();
  }

  async getMarketEntitiesSummary(industryKey: string, provinceCode: string) {
    this.assertEnabled();
    const industry = String(industryKey ?? '').trim();
    const province = String(provinceCode ?? '').trim();
    if (!industry) throw new BadRequestException({ error: 'industry_key_required' });
    if (!province || province === 'all') {
      throw new BadRequestException({ error: 'province_code_required' });
    }
    return this.marketEntities.listSummary(industry, province);
  }

  async createJob(
    projectId: number,
    body: CreateRawLeadHarvestBody,
    staffId: number | null,
  ) {
    this.assertEnabled();
    const err = validateCreateRawLeadHarvest(body);
    if (err) throw new BadRequestException(err);

    const running = await this.repo.countRunningJobs(projectId);
    if (running > 0) throw new BadRequestException({ error: 'harvest_job_already_running' });

    const mode = normalizeHarvestMode(body.mode);
    if (mode === 'intent') {
      if (!intentHarvestEnabled()) {
        throw new BadRequestException({ error: 'intent_disabled' });
      }
      if (!googlePlacesApiKey()) {
        throw new BadRequestException({ error: 'places_not_configured' });
      }
    }
    if (mode === 'market_graph') {
      if (!marketGraphHarvestEnabled()) {
        throw new BadRequestException({ error: 'market_graph_disabled' });
      }
      if (!googlePlacesApiKey()) {
        throw new BadRequestException({ error: 'places_not_configured' });
      }
    }

    const industries = await this.crmConfig.listLeadLookups('industry', true);
    const titles = await this.crmConfig.listLeadLookups('job_title', true);
    const sources = await this.crmConfig.listLeadLookups('source', true);
    const channels = await this.crmConfig.listLeadLookups('channel', true);

    const industry = industries.options.find((o) => o.option_key === body.industry_key);
    if (!industry) throw new BadRequestException({ error: 'invalid_industry' });

    const jobTitleKey = String(body.job_title_key ?? '').trim();
    let jobTitleLabel = 'Tất cả';
    if (jobTitleKey && jobTitleKey !== 'all') {
      const title = titles.options.find((o) => o.option_key === jobTitleKey);
      if (!title) throw new BadRequestException({ error: 'invalid_job_title' });
      jobTitleLabel = title.label;
    }

    const sourceKeys = body.source_keys.map(String);
    const channelKeys = (body.channel_keys ?? []).map(String);
    const sourceSnap = sourceKeys.map((key) => {
      const row = sources.options.find((o) => o.option_key === key);
      if (!row) throw new BadRequestException({ error: 'invalid_source', detail: key });
      return { key, label: row.label };
    });
    const channelSnap = channelKeys.map((key) => {
      const row = channels.options.find((o) => o.option_key === key);
      if (!row) throw new BadRequestException({ error: 'invalid_channel', detail: key });
      return { key, label: row.label };
    });

    const provinceCode = String(body.province_code ?? '').trim();
    let provinceName = 'Tất cả';
    let wardCode: string | null = null;
    let wardName: string | null = null;
    if (provinceCode && provinceCode !== 'all') {
      const provinces = await this.vnGeo.listProvinces(false);
      const province = provinces.find((p) => p.code === provinceCode);
      if (!province) throw new BadRequestException({ error: 'invalid_province' });
      provinceName = province.name;
      wardCode = body.ward_code ? String(body.ward_code).trim() || null : null;
      if (wardCode) {
        const wards = await this.vnGeo.listWards(provinceCode, false);
        const ward = wards.find((w) => w.code === wardCode);
        if (!ward) throw new BadRequestException({ error: 'invalid_ward' });
        wardName = ward.name;
      }
    }

    let providerCode = String(body.provider ?? '').trim() || 'google_places';
    let modelId = String(body.model ?? '').trim() || '';
    let providerBaseUrl: string | null = null;
    let credentialId: number | null = null;
    let runtime: Awaited<
      ReturnType<ResearchAiProvidersRepository['resolveRuntimeCredential']>
    > = null;

    if (!isPlacesMode(mode)) {
      const harvestProviders = await this.aiProviders.listHarvestProviders();
      const provider = harvestProviders.find((p) => p.code === body.provider);
      if (!provider || !provider.configured) {
        throw new BadRequestException({ error: 'provider_not_configured' });
      }
      if (!provider.models.some((m) => m.id === body.model)) {
        throw new BadRequestException({ error: 'model_not_allowed' });
      }
      runtime = await this.aiProviders.resolveRuntimeCredential(body.provider!);
      const adminProviders = await this.aiProviders.listProviders();
      const adminProvider = adminProviders.find((p) => p.code === body.provider);
      providerCode = body.provider!;
      modelId = body.model!;
      providerBaseUrl = adminProvider?.base_url ?? null;
      credentialId = runtime?.credentialId ?? null;
    }

    const scanCap =
      body.scan_cap != null && Number.isFinite(Number(body.scan_cap))
        ? Math.max(1, Math.floor(Number(body.scan_cap)))
        : mode === 'intent'
          ? Math.max(Number(body.target_count) * 5, 200)
          : mode === 'market_graph'
            ? Math.max(Number(body.target_count) * 10, 2000)
            : null;

    const job = await this.repo.createJob({
      project_id: projectId,
      industry_key: industry.option_key,
      industry_label: industry.label,
      job_title_key: jobTitleKey && jobTitleKey !== 'all' ? jobTitleKey : 'all',
      job_title_label: jobTitleLabel,
      province_code: provinceCode && provinceCode !== 'all' ? provinceCode : 'all',
      province_name: provinceName,
      ward_code: wardCode,
      ward_name: wardName,
      sources_json: sourceSnap,
      channels_json: channelSnap,
      provider: providerCode,
      model: modelId,
      provider_base_url: providerBaseUrl,
      credential_id: credentialId,
      mode,
      cross_check: Boolean(body.cross_check),
      target_count: Number(body.target_count),
      scan_cap: scanCap,
      notes: body.notes ? String(body.notes).slice(0, 500) : null,
      created_by_staff_id: staffId,
    });

    // Fire-and-forget mock/real worker
    void this.runJob(job.id, projectId, runtime).catch(() => undefined);

    return { job_id: job.id, status: job.status };
  }

  async listJobs(projectId: number) {
    this.assertEnabled();
    return { jobs: await this.repo.listJobs(projectId) };
  }

  async getJob(projectId: number, jobId: number) {
    this.assertEnabled();
    const job = await this.repo.getJob(projectId, jobId);
    if (!job) throw new NotFoundException({ error: 'harvest_job_not_found' });
    return job;
  }

  async listLeads(
    projectId: number,
    query: Record<string, string | undefined>,
  ) {
    this.assertEnabled();
    const parsed = parseRawLeadListQuery(query);
    const { leads, total } = await this.repo.listLeadsPage(projectId, parsed);
    return {
      leads,
      page: parsed.page,
      page_size: parsed.page_size,
      total,
      total_pages: totalPages(total, parsed.page_size),
    };
  }

  async readinessCounts(projectId: number) {
    this.assertEnabled();
    return { counts: await this.repo.countByReadiness(projectId) };
  }

  async priorityCounts(projectId: number) {
    this.assertEnabled();
    return { counts: await this.repo.countByPriority(projectId) };
  }

  async getBattlecard(projectId: number, leadId: number): Promise<RawLeadBattlecard> {
    this.assertEnabled();
    const lead = await this.repo.getLead(projectId, leadId);
    if (!lead) throw new NotFoundException({ error: 'raw_lead_not_found' });
    const mates = lead.account_cluster_key
      ? await this.repo.listClusterMates(
          projectId,
          lead.account_cluster_key,
          lead.id,
          8,
        )
      : [];
    return buildRawLeadBattlecard({ lead, clusterMates: mates });
  }

  async recomputePriority(projectId: number, body: RecomputePriorityBody = {}) {
    this.assertEnabled();
    const leadIds = Array.isArray(body.lead_ids)
      ? body.lead_ids.map(Number).filter(Number.isFinite)
      : undefined;
    const jobId =
      body.job_id != null && Number.isFinite(Number(body.job_id))
        ? Math.floor(Number(body.job_id))
        : undefined;
    const leads = await this.repo.listLeadsForPriorityRecompute(projectId, {
      job_id: jobId,
      lead_ids: leadIds?.length ? leadIds : undefined,
      limit: body.limit,
    });

    let updated = 0;
    const counts: Record<string, number> = { P1: 0, P2: 0, P3: 0 };
    const clusterSizes = new Map<string, number>();

    for (const lead of leads) {
      const account_cluster_key = buildAccountClusterKey(lead);
      const priority_tier = computePriorityTier({
        readiness_status: lead.readiness_status,
        quality_score: lead.quality_score,
        contactable: lead.contactable,
        phone_norm: lead.phone_norm,
        phone: lead.phone,
      });
      await this.repo.updateLeadPriorityCluster(projectId, lead.id, {
        account_cluster_key,
        priority_tier,
      });
      updated += 1;
      counts[priority_tier] = (counts[priority_tier] ?? 0) + 1;
      clusterSizes.set(
        account_cluster_key,
        (clusterSizes.get(account_cluster_key) ?? 0) + 1,
      );
    }

    let multi_member_clusters = 0;
    for (const n of clusterSizes.values()) {
      if (n > 1) multi_member_clusters += 1;
    }

    return {
      updated,
      scanned: leads.length,
      counts,
      clusters: clusterSizes.size,
      multi_member_clusters,
      priority_counts: await this.repo.countByPriority(projectId),
    };
  }

  async reclassifyReadiness(projectId: number, body: ReclassifyRawLeadsBody = {}) {
    this.assertEnabled();
    const onlyUnclassified = body.only_unclassified !== false && !body.force;
    const leadIds = Array.isArray(body.lead_ids)
      ? body.lead_ids.map(Number).filter(Number.isFinite)
      : undefined;
    const jobId =
      body.job_id != null && Number.isFinite(Number(body.job_id))
        ? Math.floor(Number(body.job_id))
        : undefined;

    const leads = await this.repo.listLeadsForReclassify(projectId, {
      only_unclassified: onlyUnclassified,
      job_id: jobId,
      lead_ids: leadIds?.length ? leadIds : undefined,
    });

    const blacklist = await this.repo.listBlacklistEntries();
    const jobCache = new Map<number, Awaited<ReturnType<RawLeadHarvestRepository['getJobById']>>>();
    const seenPhones = new Set<string>();
    let updated = 0;
    let skipped = 0;
    const counts: Record<string, number> = {
      READY_TO_PUSH: 0,
      NEEDS_REVIEW: 0,
      MISSING_CONTACT: 0,
      DUPLICATE_OR_BLACKLIST: 0,
    };

    for (const lead of leads) {
      if (lead.status === 'pushed') {
        skipped += 1;
        continue;
      }

      let job = jobCache.get(lead.job_id);
      if (job === undefined) {
        job = await this.repo.getJobById(lead.job_id);
        jobCache.set(lead.job_id, job);
      }

      const phoneNorm =
        String(lead.phone_norm ?? '').replace(/\D+/g, '') ||
        (lead.phone ? normalizePhoneDigits(lead.phone) : '');

      const existingCrm = phoneNorm
        ? await this.repo.findAlreadyCustomerByPhone(phoneNorm)
        : false;
      const blacklistHit = candidateHitsBlacklist(
        {
          phone_norm: phoneNorm || null,
          email: lead.email,
          company_name: lead.company_name,
          website: lead.website || lead.fanpage_url,
        },
        blacklist,
      );
      const dupPhone =
        Boolean(phoneNorm) &&
        (seenPhones.has(phoneNorm) ||
          (await this.repo.hasDuplicatePhoneInProjectExcept(
            projectId,
            phoneNorm,
            lead.id,
          )));

      const readiness = classifyRawLeadReadiness(
        buildReadinessInputFromRawLead(lead, {
          blacklist_hit: blacklistHit,
          existing_crm_customer: existingCrm,
          duplicate_phone_in_project: dupPhone,
          vertical_ok: Boolean(job?.industry_key),
          territory_ok: Boolean(job?.province_code || job?.province_name),
        }),
      );

      await this.repo.updateLeadReadiness(projectId, lead.id, {
        readiness_status: readiness.readiness_status,
        readiness_reason_codes: readiness.readiness_reason_codes,
        classification: readiness.classification,
      });
      updated += 1;
      counts[readiness.readiness_status] =
        (counts[readiness.readiness_status] ?? 0) + 1;
      if (phoneNorm) seenPhones.add(phoneNorm);
    }

    return {
      updated,
      skipped,
      scanned: leads.length,
      counts,
      readiness_counts: await this.repo.countByReadiness(projectId),
    };
  }

  async enrichContacts(projectId: number, body: EnrichRawLeadsContactsBody = {}) {
    this.assertEnabled();
    const leadIds = Array.isArray(body.lead_ids)
      ? body.lead_ids.map(Number).filter(Number.isFinite)
      : undefined;
    const jobId =
      body.job_id != null && Number.isFinite(Number(body.job_id))
        ? Math.floor(Number(body.job_id))
        : undefined;
    const onlyMissing =
      leadIds?.length ? body.only_missing_contact === true : body.only_missing_contact !== false;
    const limit = Math.min(50, Math.max(1, Math.floor(Number(body.limit) || 50)));

    const leads = await this.repo.listLeadsForContactEnrich(projectId, {
      only_missing_contact: onlyMissing,
      job_id: jobId,
      lead_ids: leadIds?.length ? leadIds : undefined,
      limit,
    });

    const placesKey = googlePlacesApiKey();
    const places = placesKey ? new PlacesClient(placesKey) : null;
    const blacklist = await this.repo.listBlacklistEntries();
    const jobCache = new Map<number, Awaited<ReturnType<RawLeadHarvestRepository['getJobById']>>>();
    const seenPhones = new Set<string>();

    let enriched = 0;
    let unchanged = 0;
    let failed = 0;
    const counts: Record<string, number> = {
      READY_TO_PUSH: 0,
      NEEDS_REVIEW: 0,
      MISSING_CONTACT: 0,
      DUPLICATE_OR_BLACKLIST: 0,
    };

    for (const lead of leads) {
      try {
        let placesHint: { phone?: string | null; website?: string | null } | null = null;
        if (places && lead.place_id) {
          try {
            await new Promise((r) => setTimeout(r, 250));
            const detailed = await places.placeDetails(lead.place_id);
            if (detailed) {
              placesHint = { phone: detailed.phone, website: detailed.website };
            }
          } catch {
            /* continue with scrape */
          }
        }

        let scrapedText = '';
        const urls = [
          lead.website,
          lead.evidence_url,
          lead.fanpage_url,
          placesHint?.website,
        ]
          .map((u) => String(u ?? '').trim())
          .filter(Boolean);
        const uniqueUrls = [...new Set(urls)].slice(0, 3);
        for (const url of uniqueUrls) {
          const primary = await fetchEvidenceText(url, { timeoutMs: 7000 });
          if (primary.ok && primary.text) {
            scrapedText += `\n${primary.text}`;
            for (const alt of contactPageUrls(url).slice(0, 2)) {
              const altFetch = await fetchEvidenceText(alt, { timeoutMs: 5000 });
              if (altFetch.ok && altFetch.text) scrapedText += `\n${altFetch.text}`;
            }
            break;
          }
        }

        const patch = mergeContactEnrichment({
          lead,
          places: placesHint,
          scraped: scrapedText ? scrapeFromFetchedText(scrapedText) : null,
        });

        let working: RawLeadRow = lead;
        if (patch.changed) {
          const hadPhone = Boolean(lead.phone_norm || lead.phone);
          const qualityBoost =
            !hadPhone && patch.phone_norm
              ? Math.min(100, Number(lead.quality_score ?? 0) + 15)
              : undefined;
          const verify = {
            ...(lead.verify_json ?? {}),
            enrich: {
              at: new Date().toISOString(),
              sources: patch.sources,
              places: Boolean(placesHint?.phone || placesHint?.website),
            },
            phone_ok: Boolean(patch.phone_norm),
            email_ok: Boolean(patch.email && String(patch.email).includes('@')),
          };
          const updated = await this.repo.updateLeadContact(projectId, lead.id, {
            phone: patch.phone,
            phone_norm: patch.phone_norm,
            email: patch.email,
            website: patch.website,
            fanpage_url: patch.fanpage_url,
            contactable: patch.contactable,
            quality_score: qualityBoost,
            verify_json: verify,
          });
          if (updated) working = updated;
          enriched += 1;
        } else {
          unchanged += 1;
        }

        let job = jobCache.get(working.job_id);
        if (job === undefined) {
          job = await this.repo.getJobById(working.job_id);
          jobCache.set(working.job_id, job);
        }

        const phoneNorm =
          String(working.phone_norm ?? '').replace(/\D+/g, '') ||
          (working.phone ? normalizePhoneDigits(working.phone) : '');
        const existingCrm = phoneNorm
          ? await this.repo.findAlreadyCustomerByPhone(phoneNorm)
          : false;
        const blacklistHit = candidateHitsBlacklist(
          {
            phone_norm: phoneNorm || null,
            email: working.email,
            company_name: working.company_name,
            website: working.website || working.fanpage_url,
          },
          blacklist,
        );
        const dupPhone =
          Boolean(phoneNorm) &&
          (seenPhones.has(phoneNorm) ||
            (await this.repo.hasDuplicatePhoneInProjectExcept(
              projectId,
              phoneNorm,
              working.id,
            )));

        const readiness = classifyRawLeadReadiness(
          buildReadinessInputFromRawLead(working, {
            blacklist_hit: blacklistHit,
            existing_crm_customer: existingCrm,
            duplicate_phone_in_project: dupPhone,
            vertical_ok: Boolean(job?.industry_key),
            territory_ok: Boolean(job?.province_code || job?.province_name),
          }),
        );
        await this.repo.updateLeadReadiness(projectId, working.id, {
          readiness_status: readiness.readiness_status,
          readiness_reason_codes: readiness.readiness_reason_codes,
          classification: readiness.classification,
        });
        counts[readiness.readiness_status] =
          (counts[readiness.readiness_status] ?? 0) + 1;
        if (phoneNorm) seenPhones.add(phoneNorm);
      } catch {
        failed += 1;
      }
    }

    return {
      enriched,
      unchanged,
      failed,
      scanned: leads.length,
      counts,
      readiness_counts: await this.repo.countByReadiness(projectId),
    };
  }

  async bulkAccept(
    projectId: number,
    body: BulkAcceptRawLeadsBody,
    staffId: number | null = null,
  ) {
    this.assertEnabled();
    const ids = Array.isArray(body.lead_ids)
      ? [...new Set(body.lead_ids.map(Number).filter(Number.isFinite))].slice(0, 100)
      : [];
    if (!ids.length) throw new BadRequestException({ error: 'lead_ids_required' });

    const checklist =
      body.accepted_checklist_json && typeof body.accepted_checklist_json === 'object'
        ? body.accepted_checklist_json
        : {};

    let accepted = 0;
    let skipped = 0;
    let promoted_ready = 0;
    const errors: Array<{ raw_lead_id: number; error: string }> = [];

    const loaded: Array<{ id: number; status: string; readiness_status: string | null }> =
      [];
    for (const id of ids) {
      const lead = await this.repo.getLead(projectId, id);
      if (!lead) {
        errors.push({ raw_lead_id: id, error: 'raw_lead_not_found' });
        continue;
      }
      loaded.push({
        id: lead.id,
        status: lead.status,
        readiness_status: lead.readiness_status,
      });
    }

    const eligibleIds = new Set(
      filterBulkAcceptCandidates(loaded).map((l) => l.id),
    );

    for (const id of ids) {
      if (!eligibleIds.has(id)) {
        if (!errors.some((e) => e.raw_lead_id === id)) {
          skipped += 1;
        }
        continue;
      }
      try {
        const before = await this.repo.getLead(projectId, id);
        if (!before) {
          errors.push({ raw_lead_id: id, error: 'raw_lead_not_found' });
          continue;
        }
        const promote = readinessAfterAccept({
          readiness_status: before.readiness_status,
          contactable: before.contactable,
        });
        if (promote.promote) {
          await this.repo.updateLeadReadiness(projectId, id, {
            readiness_status: promote.readiness_status,
            readiness_reason_codes: promote.readiness_reason_codes,
            classification: promote.classification,
          });
          if (promote.readiness_status === 'READY_TO_PUSH') promoted_ready += 1;
        }
        await this.repo.patchLead(projectId, id, {
          status: 'accepted',
          accepted_checklist_json: checklist,
          feedback_by_staff_id: staffId,
        });
        accepted += 1;
      } catch (err) {
        errors.push({
          raw_lead_id: id,
          error: err instanceof Error ? err.message : 'accept_failed',
        });
      }
    }

    return {
      accepted,
      skipped,
      promoted_ready,
      errors,
      readiness_counts: await this.repo.countByReadiness(projectId),
    };
  }

  async patchLead(
    projectId: number,
    leadId: number,
    body: PatchRawLeadBody,
    staffId: number | null = null,
  ) {
    this.assertEnabled();
    if (body.feedback_code != null && !isFeedbackCode(body.feedback_code)) {
      throw new BadRequestException({ error: 'invalid_feedback_code' });
    }
    if (body.dial_outcome != null && !isDialOutcome(body.dial_outcome)) {
      throw new BadRequestException({ error: 'invalid_dial_outcome' });
    }

    const before = await this.repo.getLead(projectId, leadId);
    if (!before) throw new NotFoundException({ error: 'raw_lead_not_found' });

    if (body.readiness_status != null) {
      if (!isRawLeadReadinessStatus(body.readiness_status)) {
        throw new BadRequestException({ error: 'invalid_readiness_status' });
      }
      const gate = assertManualReadyAllowed({
        next: body.readiness_status,
        current_reason_codes:
          body.readiness_reason_codes ?? before.readiness_reason_codes,
        force_ready: Boolean(body.force_ready),
      });
      if (!gate.ok) {
        throw new BadRequestException({ error: gate.error });
      }
      const reasonCodes =
        body.readiness_reason_codes ??
        (body.readiness_status === before.readiness_status
          ? before.readiness_reason_codes
          : [`MANUAL_${body.readiness_status}`]);
      await this.repo.updateLeadReadiness(projectId, leadId, {
        readiness_status: body.readiness_status,
        readiness_reason_codes: reasonCodes,
        classification:
          body.readiness_status === 'READY_TO_PUSH'
            ? 'pass'
            : body.readiness_status === 'NEEDS_REVIEW'
              ? 'needs_review'
              : body.readiness_status === 'MISSING_CONTACT'
                ? 'missing_contact'
                : body.readiness_status === 'DUPLICATE_OR_BLACKLIST'
                  ? 'rejected_dedupe'
                  : null,
      });
    } else if (body.status === 'accepted') {
      const promote = readinessAfterAccept({
        readiness_status: before.readiness_status,
        contactable: before.contactable,
      });
      if (promote.promote) {
        await this.repo.updateLeadReadiness(projectId, leadId, {
          readiness_status: promote.readiness_status,
          readiness_reason_codes: promote.readiness_reason_codes,
          classification: promote.classification,
        });
      }
    }

    const lead = await this.repo.patchLead(projectId, leadId, {
      status: body.status,
      company_name: body.company_name,
      address: body.address,
      phone: body.phone,
      email: body.email,
      website: body.website,
      fanpage_url: body.fanpage_url,
      zalo_url: body.zalo_url,
      contact_title: body.contact_title,
      accepted_checklist_json: body.accepted_checklist_json,
      feedback_code: body.feedback_code,
      feedback_note: body.feedback_note ? String(body.feedback_note).slice(0, 500) : undefined,
      feedback_by_staff_id: body.feedback_code || body.dial_outcome ? staffId : undefined,
      dial_outcome: body.dial_outcome,
    });
    if (!lead) throw new NotFoundException({ error: 'raw_lead_not_found' });

    const bl = blacklistEntriesFromFeedback({
      feedback_code: body.feedback_code ?? null,
      dial_outcome: body.dial_outcome ?? null,
      phone: lead.phone ?? before.phone,
      email: lead.email ?? before.email,
      company_name: lead.company_name,
      website: lead.website,
    });
    if (bl.length) {
      await this.repo.upsertBlacklistEntries(bl, staffId);
    }
    return lead;
  }

  async exportLeads(projectId: number, body: ExportRawLeadsBody = {}) {
    this.assertEnabled();
    const leads = await this.repo.listLeadsForExport(projectId, {
      lead_ids: body.lead_ids,
      status: body.status,
      contactableOnly: body.lead_ids?.length ? false : true,
    });
    const csv = buildRawLeadsCsv(leads);
    return { csv, count: leads.length };
  }

  async pushToCrm(projectId: number, body: PushRawLeadsBody) {
    this.assertEnabled();
    const ids = Array.isArray(body.lead_ids) ? body.lead_ids.map(Number).filter(Number.isFinite) : [];
    if (!ids.length) throw new BadRequestException({ error: 'lead_ids_required' });

    const pushed: Array<{ raw_lead_id: number; crm_lead_id: number }> = [];
    const errors: Array<{ raw_lead_id: number; error: string }> = [];

    for (const leadId of ids) {
      const lead = await this.repo.getLead(projectId, leadId);
      if (!lead) {
        errors.push({ raw_lead_id: leadId, error: 'raw_lead_not_found' });
        continue;
      }
      const gate = assertRawLeadPushable(lead);
      if (!gate.ok) {
        errors.push({ raw_lead_id: leadId, error: gate.error });
        continue;
      }

      const job = await this.repo.getJobById(lead.job_id);
      const source = job?.sources_json?.[0]?.key ?? 'research_harvest';
      const channel = job?.channels_json?.[0]?.key ?? '';

      try {
        const fullName =
          lead.contact_title && lead.contact_title.trim()
            ? `${lead.contact_title.trim()} — ${lead.company_name}`
            : lead.company_name;
        const crmLead = await this.leadsWrite.createLead({
          full_name: fullName,
          phone: lead.phone ?? undefined,
          email: lead.email ?? undefined,
          source,
          channel,
          lead_flow_kind: 'b2b_prospect',
          status: 'new',
          external_lead_id: `raw-harvest-${lead.id}`,
        });
        try {
          await this.leadsWrite.patchLead(crmLead.id, {
            company_name: lead.company_name,
            company_address: lead.address ?? undefined,
          });
        } catch {
          /* company fields optional */
        }
        await this.repo.markLeadPushed(projectId, leadId, crmLead.id);
        pushed.push({ raw_lead_id: leadId, crm_lead_id: crmLead.id });
      } catch (err) {
        errors.push({
          raw_lead_id: leadId,
          error: err instanceof Error ? err.message : 'push_failed',
        });
      }
    }

    return { pushed, errors };
  }

  private async runJob(
    jobId: number,
    projectId: number,
    runtime: Awaited<ReturnType<ResearchAiProvidersRepository['resolveRuntimeCredential']>>,
  ): Promise<void> {
    await this.repo.markJobRunning(jobId);
    try {
      const job = await this.repo.getJob(projectId, jobId);
      if (!job) return;

      if (job.mode === 'intent') {
        if (!intentHarvestEnabled()) {
          await this.repo.markJobFinished(jobId, 'failed', 0, 0, 'intent_disabled');
          return;
        }
        const key = googlePlacesApiKey();
        if (!key) {
          await this.repo.markJobFinished(jobId, 'failed', 0, 0, 'places_not_configured');
          return;
        }
        const places = new PlacesClient(key);
        const result = await this.intentWorker.run(job, places);
        await this.repo.markJobFinished(
          jobId,
          'succeeded',
          result.inserted,
          result.rejected,
          null,
          result.stats as unknown as Record<string, unknown>,
        );
        return;
      }

      if (job.mode === 'market_graph') {
        if (!marketGraphHarvestEnabled()) {
          await this.repo.markJobFinished(jobId, 'failed', 0, 0, 'market_graph_disabled');
          return;
        }
        const key = googlePlacesApiKey();
        if (!key) {
          await this.repo.markJobFinished(jobId, 'failed', 0, 0, 'places_not_configured');
          return;
        }
        await this.marketEntities.ensureSchema();
        const places = new PlacesClient(key);
        const result = await this.marketGraphWorker.run(job, places);
        await this.repo.markJobFinished(
          jobId,
          'succeeded',
          result.inserted,
          result.rejected,
          null,
          result.stats as unknown as Record<string, unknown>,
        );
        return;
      }

      if (!harvestMock()) {
        if (!runtime) {
          await this.repo.markJobFinished(
            jobId,
            'failed',
            0,
            0,
            'harvest_provider_not_configured',
          );
          return;
        }

        let crossCheckRuntime: {
          baseUrl: string;
          model: string;
          apiToken: string;
          authType: typeof runtime.authType;
          authHeaderName: string;
          credentialId: number | null;
          providerCode: string;
        } | null = null;

        if (job.cross_check) {
          const harvestProviders = await this.aiProviders.listHarvestProviders();
          const other = harvestProviders.find(
            (p) => p.configured && p.code !== job.provider,
          );
          if (other) {
            const otherCred = await this.aiProviders.resolveRuntimeCredential(other.code);
            if (otherCred) {
              crossCheckRuntime = {
                baseUrl: otherCred.provider.base_url,
                model: other.default_model ?? other.models[0]?.id ?? job.model,
                apiToken: otherCred.apiToken,
                authType: otherCred.authType,
                authHeaderName: otherCred.authHeaderName,
                credentialId: otherCred.credentialId,
                providerCode: other.code,
              };
            }
          }
        }

        const result = await this.worker.runRealHarvest(
          job,
          {
            baseUrl: runtime.provider.base_url,
            model: job.model,
            apiToken: runtime.apiToken,
            authType: runtime.authType,
            authHeaderName: runtime.authHeaderName,
            credentialId: runtime.credentialId,
            providerCode: job.provider,
          },
          { crossCheckRuntime },
        );
        await this.repo.markJobFinished(
          jobId,
          'succeeded',
          result.inserted,
          result.rejected,
          null,
        );
        return;
      }

      const n = Math.min(job.target_count, 3);
      let inserted = 0;
      for (let i = 0; i < n; i += 1) {
        const company = `Mock Co ${job.industry_label} ${i + 1}`;
        await this.repo.insertLead({
          project_id: projectId,
          job_id: jobId,
          company_name: company,
          address:
            job.province_code === 'all'
              ? 'Việt Nam'
              : `${job.province_name}, Việt Nam`,
          phone: `09010000${10 + i}`,
          phone_norm: `09010000${10 + i}`,
          email: `contact${i + 1}@example-mock.vn`,
          contact_title:
            job.job_title_key === 'all' ? null : job.job_title_label,
          website: `https://example-mock.vn/co-${i + 1}`,
          evidence_url: `https://example-mock.vn/co-${i + 1}`,
          evidence_snippet: `${company} — ${job.province_name}`,
          source_provider: job.provider,
          source_model: job.model,
          search_source_keys: job.sources_json.map((s) => s.key),
          search_channel_keys: job.channels_json.map((s) => s.key),
          quality_score: 70 - i * 5,
          icp_fit_score: 60,
          contactable: true,
          status: 'pending',
          verify_json: {
            evidence_ok: true,
            phone_ok: true,
            email_ok: true,
            geo_ok: true,
            mock: true,
            reasons: [],
          },
          raw_json: { mock: true, index: i },
        });
        inserted += 1;
      }
      await this.repo.markJobFinished(jobId, 'succeeded', inserted, 0, null);
    } catch (err) {
      await this.repo.markJobFinished(
        jobId,
        'failed',
        0,
        0,
        err instanceof Error ? err.message : 'harvest_failed',
      );
    }
  }
}
