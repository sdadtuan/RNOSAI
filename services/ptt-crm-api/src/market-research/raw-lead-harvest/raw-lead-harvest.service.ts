import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { CrmConfigService } from '../../crm-config/crm-config.service';
import { VnAdminGeoRepository } from '../../vn-admin-geo/vn-admin-geo.repository';
import { ResearchAiProvidersRepository } from './ai-providers.repository';
import { RawLeadHarvestRepository } from './raw-lead-harvest.repository';
import type {
  CreateRawLeadHarvestBody,
  PatchRawLeadBody,
} from './raw-lead-harvest.types';
import {
  normalizeHarvestMode,
  validateCreateRawLeadHarvest,
} from './raw-lead-harvest.validation';

function harvestEnabled(): boolean {
  return String(process.env.PTT_RESEARCH_RAW_LEAD_HARVEST ?? '').trim() === '1';
}

function harvestMock(): boolean {
  const raw = String(process.env.PTT_RESEARCH_HARVEST_MOCK ?? '1').trim();
  return raw !== '0' && raw.toLowerCase() !== 'false';
}

@Injectable()
export class RawLeadHarvestService {
  constructor(
    private readonly repo: RawLeadHarvestRepository,
    private readonly aiProviders: ResearchAiProvidersRepository,
    private readonly crmConfig: CrmConfigService,
    private readonly vnGeo: VnAdminGeoRepository,
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
    const industries = await this.crmConfig.listLeadLookups('industry', true);
    const titles = await this.crmConfig.listLeadLookups('job_title', true);
    const sources = await this.crmConfig.listLeadLookups('source', true);
    const channels = await this.crmConfig.listLeadLookups('channel', true);

    const industry = industries.options.find((o) => o.option_key === body.industry_key);
    const title = titles.options.find((o) => o.option_key === body.job_title_key);
    if (!industry) throw new BadRequestException({ error: 'invalid_industry' });
    if (!title) throw new BadRequestException({ error: 'invalid_job_title' });

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

    const provinces = await this.vnGeo.listProvinces(false);
    const province = provinces.find((p) => p.code === body.province_code);
    if (!province) throw new BadRequestException({ error: 'invalid_province' });

    let wardName: string | null = null;
    const wardCode = body.ward_code ? String(body.ward_code) : null;
    if (wardCode) {
      const wards = await this.vnGeo.listWards(body.province_code, false);
      const ward = wards.find((w) => w.code === wardCode);
      if (!ward) throw new BadRequestException({ error: 'invalid_ward' });
      wardName = ward.name;
    }

    const harvestProviders = await this.aiProviders.listHarvestProviders();
    const provider = harvestProviders.find((p) => p.code === body.provider);
    if (!provider || !provider.configured) {
      throw new BadRequestException({ error: 'provider_not_configured' });
    }
    if (!provider.models.some((m) => m.id === body.model)) {
      throw new BadRequestException({ error: 'model_not_allowed' });
    }

    const runtime = await this.aiProviders.resolveRuntimeCredential(body.provider);
    const adminProviders = await this.aiProviders.listProviders();
    const adminProvider = adminProviders.find((p) => p.code === body.provider);

    const job = await this.repo.createJob({
      project_id: projectId,
      industry_key: industry.option_key,
      industry_label: industry.label,
      job_title_key: title.option_key,
      job_title_label: title.label,
      province_code: province.code,
      province_name: province.name,
      ward_code: wardCode,
      ward_name: wardName,
      sources_json: sourceSnap,
      channels_json: channelSnap,
      provider: body.provider,
      model: body.model,
      provider_base_url: adminProvider?.base_url ?? null,
      credential_id: null,
      mode,
      cross_check: Boolean(body.cross_check),
      target_count: Number(body.target_count),
      notes: body.notes ? String(body.notes).slice(0, 500) : null,
      created_by_staff_id: staffId,
    });

    // Fire-and-forget mock/real worker
    void this.runJob(job.id, projectId, runtime?.provider.base_url ?? null).catch(() => undefined);

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
    query: { status?: string; job_id?: string; include_auto_rejected?: string },
  ) {
    this.assertEnabled();
    const leads = await this.repo.listLeads(projectId, {
      status: query.status,
      job_id: query.job_id ? Number(query.job_id) : undefined,
      include_auto_rejected: query.include_auto_rejected === '1',
    });
    return { leads };
  }

  async patchLead(projectId: number, leadId: number, body: PatchRawLeadBody) {
    this.assertEnabled();
    const lead = await this.repo.patchLead(projectId, leadId, {
      status: body.status,
      company_name: body.company_name,
      address: body.address,
      phone: body.phone,
      email: body.email,
      contact_title: body.contact_title,
      accepted_checklist_json: body.accepted_checklist_json,
    });
    if (!lead) throw new NotFoundException({ error: 'raw_lead_not_found' });
    return lead;
  }

  private async runJob(
    jobId: number,
    projectId: number,
    _baseUrl: string | null,
  ): Promise<void> {
    await this.repo.markJobRunning(jobId);
    try {
      const job = await this.repo.getJob(projectId, jobId);
      if (!job) return;

      if (!harvestMock()) {
        // Real AI arrives in Wave C — fail closed for now if mock off
        await this.repo.markJobFinished(
          jobId,
          'failed',
          0,
          0,
          'real_ai_not_implemented_enable_mock',
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
          address: `${job.province_name}, Việt Nam`,
          phone: `09010000${10 + i}`,
          email: `contact${i + 1}@example-mock.vn`,
          contact_title: job.job_title_label,
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
