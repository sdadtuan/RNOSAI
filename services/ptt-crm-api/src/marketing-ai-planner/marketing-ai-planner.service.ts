import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AiAgentRunsRepository } from '../ai-intelligence/ai-agent-runs.repository';
import { AppConfigService } from '../config/app-config.service';
import { ServiceLifecycleService } from '../service-lifecycle/service-lifecycle.service';
import { validateMktAiBrief, mergeBrief, emptyDraft } from './marketing-ai-brief.util';
import { computeQualityScore } from './marketing-ai-quality.util';
import { MarketingAiBudgetService } from './marketing-ai-budget.service';
import { MarketingAiExportService } from './marketing-ai-export.service';
import { MarketingAiOrchestratorService } from './marketing-ai-orchestrator.service';
import { MarketingAiRagService } from './marketing-ai-rag.service';
import { MarketingAiPlannerRepository } from './marketing-ai-planner.repository';
import type { MktAiExportFileResult } from './marketing-ai-export.types';
import type {
  MktAiBrief,
  MktAiCampaignDraft,
  MktAiDraft,
  MktAiJobType,
  MktAiPlannerContext,
} from './marketing-ai-planner.types';

const RETRY_JOB_TYPES: MktAiJobType[] = [
  'strategy_generate',
  'campaign_generate',
  'content_generate',
  'quality_score',
];

@Injectable()
export class MarketingAiPlannerService {
  constructor(
    private readonly config: AppConfigService,
    private readonly lifecycle: ServiceLifecycleService,
    private readonly repo: MarketingAiPlannerRepository,
    private readonly orchestrator: MarketingAiOrchestratorService,
    private readonly rag: MarketingAiRagService,
    private readonly budget: MarketingAiBudgetService,
    private readonly agentRuns: AiAgentRunsRepository,
    private readonly exportService: MarketingAiExportService,
  ) {}

  private assertEnabled(serviceSlug?: string): void {
    if (!this.config.mktAiPlannerEnabled) {
      throw new NotFoundException({ error: 'mkt_ai_planner_disabled' });
    }
    const slugs = this.config.mktAiPlannerSlugs;
    if (slugs.length && serviceSlug && !slugs.includes(serviceSlug)) {
      throw new ForbiddenException({ error: 'mkt_ai_planner_slug_not_pilot', service_slug: serviceSlug });
    }
  }

  private async loadLifecycleRow(id: number): Promise<Record<string, unknown>> {
    const detail = await this.lifecycle.detail(id);
    return detail as Record<string, unknown>;
  }

  private async buildPrefillBrief(lifecycleId: number, serviceSlug: string): Promise<{
    brief: MktAiBrief;
    sources: string[];
  }> {
    const brief: MktAiBrief = { service_slug: serviceSlug };
    const sources: string[] = [];

    try {
      const consult = (await this.lifecycle.consultBrief(lifecycleId)) as Record<string, unknown>;
      const highlights = (consult.highlights ?? {}) as Record<string, unknown>;
      if (highlights.pain) brief.challenges = String(highlights.pain);
      if (highlights.budget_vnd != null) brief.budget_monthly_vnd = Number(highlights.budget_vnd);
      if (highlights.niche) brief.industry = String(highlights.niche);
      if (highlights.goal) brief.objective = String(highlights.goal);
      if (consult.company_name) brief.brand_name = String(consult.company_name);
      sources.push('consult-brief');
    } catch {
      /* optional */
    }

    try {
      const onboard = (await this.lifecycle.onboardingBrief(lifecycleId)) as Record<string, unknown>;
      if (onboard.client_name && !brief.brand_name) brief.brand_name = String(onboard.client_name);
      sources.push('onboarding-brief');
    } catch {
      /* optional */
    }

    return { brief, sources };
  }

  async getContext(lifecycleId: number): Promise<MktAiPlannerContext> {
    const lc = await this.loadLifecycleRow(lifecycleId);
    const serviceSlug = String(lc.service_slug ?? '');
    this.assertEnabled(serviceSlug);

    let briefRow = await this.repo.getBrief(lifecycleId);
    if (!briefRow) {
      const prefill = await this.buildPrefillBrief(lifecycleId, serviceSlug);
      briefRow = {
        brief_json: prefill.brief,
        prefill_sources_json: prefill.sources,
        updated_by: '',
      };
    }

    const draft =
      (await this.repo.getDraft(lifecycleId)) ?? (emptyDraft() as MktAiDraft);
    const briefValidation = validateMktAiBrief(briefRow.brief_json);
    const tmmtPayload = await this.lifecycle.marketingPlan(lifecycleId);
    const quality = computeQualityScore(briefRow.brief_json, draft);
    const jobs = await this.repo.listJobs(lifecycleId);
    const documents = this.rag.isFeatureEnabled()
      ? await this.rag.listDocuments(lifecycleId)
      : [];
    const indexedCount = documents.filter((d) => d.status === 'indexed' && d.chunk_count > 0).length;
    const useRag = this.rag.shouldUseRag(briefRow.brief_json, indexedCount);
    const ragCitations = draft.quality_score_json?.rag_citations;
    const budgetScenarios = await this.repo.listBudgetScenarios(lifecycleId);

    return {
      lifecycle_id: lifecycleId,
      stage: String(lc.stage ?? ''),
      service_slug: serviceSlug,
      enabled: true,
      brief: briefRow.brief_json,
      brief_validation: briefValidation,
      prefill_sources: briefRow.prefill_sources_json ?? [],
      jobs,
      draft: {
        ...draft,
        quality_score_json: {
          ...draft.quality_score_json,
          ...(ragCitations ? { rag_citations: ragCitations } : {}),
        },
      },
      documents,
      rag: {
        use_rag: useRag,
        indexed_count: indexedCount,
      },
      budget_scenarios: budgetScenarios,
      tmmt_validation: {
        ok: Boolean(tmmtPayload.validation?.ok),
        messages: tmmtPayload.validation?.messages ?? [],
        filled_count: tmmtPayload.filled_count,
      },
      quality_score: {
        score: quality.score,
        criteria: quality.criteria,
        can_apply: quality.can_apply,
        can_export: quality.can_export,
        can_export_docx_only: quality.can_export_docx_only,
      },
      flags: {
        rag_enabled: this.rag.isFeatureEnabled(),
        approval_required: false,
        stub_mode: this.orchestrator.stubMode,
      },
    };
  }

  async listDocuments(lifecycleId: number) {
    const lc = await this.loadLifecycleRow(lifecycleId);
    this.assertEnabled(String(lc.service_slug ?? ''));
    if (!this.rag.isFeatureEnabled()) {
      return { documents: [] as const, rag_enabled: false };
    }
    const documents = await this.rag.listDocuments(lifecycleId);
    return { documents, rag_enabled: true };
  }

  async uploadDocument(
    lifecycleId: number,
    file: Express.Multer.File,
    actorEmail: string,
  ) {
    const lc = await this.loadLifecycleRow(lifecycleId);
    this.assertEnabled(String(lc.service_slug ?? ''));
    const document = await this.rag.uploadDocument(lifecycleId, file, actorEmail);
    return { document };
  }

  async patchBrief(
    lifecycleId: number,
    patch: Record<string, unknown>,
    actorEmail: string,
  ): Promise<{ brief: MktAiBrief; brief_validation: ReturnType<typeof validateMktAiBrief> }> {
    const lc = await this.loadLifecycleRow(lifecycleId);
    this.assertEnabled(String(lc.service_slug ?? ''));

    const existing = await this.repo.getBrief(lifecycleId);
    const merged = mergeBrief(existing?.brief_json ?? null, patch);
    if (!merged.service_slug) merged.service_slug = String(lc.service_slug ?? '');

    const validation = validateMktAiBrief(merged);
    await this.repo.upsertBrief(
      lifecycleId,
      merged,
      existing?.prefill_sources_json ?? [],
      actorEmail,
    );
    return { brief: merged, brief_validation: validation };
  }

  async patchDraft(
    lifecycleId: number,
    patch: Partial<MktAiDraft>,
    actorEmail: string,
  ): Promise<MktAiDraft> {
    const lc = await this.loadLifecycleRow(lifecycleId);
    this.assertEnabled(String(lc.service_slug ?? ''));

    const current = await this.repo.ensureDraft(lifecycleId, actorEmail);
    const merged: MktAiDraft = {
      ...current,
      ...patch,
      strategy_framework: { ...current.strategy_framework, ...(patch.strategy_framework ?? {}) },
      target_market_prof: { ...current.target_market_prof, ...(patch.target_market_prof ?? {}) },
    };
    await this.repo.upsertDraft(lifecycleId, merged, actorEmail);
    return merged;
  }

  private async requireBrief(lifecycleId: number): Promise<MktAiBrief> {
    const row = await this.repo.getBrief(lifecycleId);
    const brief = row?.brief_json ?? null;
    const validation = validateMktAiBrief(brief);
    if (!validation.ok) {
      throw new BadRequestException({
        error: 'brief_incomplete',
        missing: validation.missing,
        messages: validation.messages,
      });
    }
    return brief!;
  }

  private async runJob(
    lifecycleId: number,
    jobType: MktAiJobType,
    actorEmail: string,
    runner: (jobId: number) => Promise<Record<string, unknown>>,
  ): Promise<{ job_id: number; status: string; output?: Record<string, unknown> }> {
    // P0: jobs run synchronously in-request; poll via GET /context (async worker deferred).
    const started = Date.now();
    const modelName = this.orchestrator.modelName + (this.orchestrator.stubMode ? '-stub' : '');
    const job = await this.repo.createJob({
      lifecycle_id: lifecycleId,
      job_type: jobType,
      model_name: modelName,
      prompt_version: this.orchestrator.promptVersion,
      input_json: { lifecycle_id: lifecycleId },
      actor_email: actorEmail,
    });

    try {
      const output = await runner(job.id);
      const latency = Date.now() - started;
      await this.repo.finishJob(job.id, {
        status: 'succeeded',
        output_json: output,
        latency_ms: latency,
      });
      await this.auditAgentRun({
        lifecycleId,
        jobType,
        modelName,
        actorEmail,
        status: 'succeeded',
        latencyMs: latency,
        input: { lifecycle_id: lifecycleId, job_id: job.id },
        output,
      });
      return { job_id: job.id, status: 'succeeded', output };
    } catch (err) {
      const latency = Date.now() - started;
      const message = err instanceof Error ? err.message : String(err);
      await this.repo.finishJob(job.id, {
        status: 'failed',
        error_message: message,
        latency_ms: latency,
      });
      await this.auditAgentRun({
        lifecycleId,
        jobType,
        modelName,
        actorEmail,
        status: 'failed',
        latencyMs: latency,
        input: { lifecycle_id: lifecycleId, job_id: job.id },
        output: {},
        errorMessage: message,
      });
      throw new ServiceUnavailableException({
        error: 'mkt_ai_job_failed',
        job_id: job.id,
        job_type: jobType,
        message,
      });
    }
  }

  private async auditAgentRun(args: {
    lifecycleId: number;
    jobType: MktAiJobType;
    modelName: string;
    actorEmail: string;
    status: 'succeeded' | 'failed';
    latencyMs: number;
    input: Record<string, unknown>;
    output: Record<string, unknown>;
    errorMessage?: string;
  }): Promise<void> {
    try {
      if (!(await this.agentRuns.tableReady())) return;
      await this.agentRuns.insertRun({
        agentName: 'mkt_ai_planner',
        useCase: args.jobType,
        modelName: args.modelName,
        inputJson: args.input,
        outputJson: { ...args.output, lifecycle_id: args.lifecycleId },
        status: args.status,
        latencyMs: args.latencyMs,
        actorId: args.actorEmail,
        errorMessage: args.errorMessage ?? null,
      });
    } catch {
      /* audit optional when PG unavailable */
    }
  }

  async runStrategyJob(lifecycleId: number, actorEmail: string) {
    const lc = await this.loadLifecycleRow(lifecycleId);
    this.assertEnabled(String(lc.service_slug ?? ''));
    const brief = await this.requireBrief(lifecycleId);

    return this.runJob(lifecycleId, 'strategy_generate', actorEmail, async () => {
      const ragCtx = await this.rag.buildForStrategy(lifecycleId, brief);
      const ragCitations = ragCtx.enabled
        ? this.rag.attachCitations(ragCtx.chunks)
        : undefined;
      const out = await this.orchestrator.generateStrategy(brief, {
        ragPromptBlock: ragCtx.promptBlock,
        ragCitations,
      });
      const draft = await this.repo.ensureDraft(lifecycleId, actorEmail);
      await this.repo.upsertDraft(
        lifecycleId,
        {
          ...draft,
          strategy_framework: out.strategy_framework,
          target_market_prof: out.target_market_prof,
          swot_json: out.swot_json,
          quality_score_json: {
            ...draft.quality_score_json,
            ...(out.rag_citations ? { rag_citations: out.rag_citations } : {}),
          },
        },
        actorEmail,
      );
      return out as unknown as Record<string, unknown>;
    });
  }

  async runCampaignJob(lifecycleId: number, actorEmail: string) {
    const lc = await this.loadLifecycleRow(lifecycleId);
    this.assertEnabled(String(lc.service_slug ?? ''));
    const brief = await this.requireBrief(lifecycleId);

    return this.runJob(lifecycleId, 'campaign_generate', actorEmail, async () => {
      const campaigns = await this.orchestrator.generateCampaigns(brief);
      const draft = await this.repo.ensureDraft(lifecycleId, actorEmail);
      await this.repo.upsertDraft(lifecycleId, { ...draft, campaigns_json: campaigns }, actorEmail);
      await this.repo.replaceCampaigns(lifecycleId, null, campaigns);
      return { campaigns } as Record<string, unknown>;
    });
  }

  async runContentJob(lifecycleId: number, actorEmail: string) {
    const lc = await this.loadLifecycleRow(lifecycleId);
    this.assertEnabled(String(lc.service_slug ?? ''));
    const brief = await this.requireBrief(lifecycleId);
    const draft = await this.repo.ensureDraft(lifecycleId, actorEmail);
    const campaigns = (draft.campaigns_json ?? []) as MktAiCampaignDraft[];

    return this.runJob(lifecycleId, 'content_generate', actorEmail, async () => {
      const out = await this.orchestrator.generateContent(brief, campaigns);
      await this.repo.upsertDraft(
        lifecycleId,
        { ...draft, content_json: out.content_json },
        actorEmail,
      );
      await this.repo.replaceContentAssets(lifecycleId, null, out.assets);
      return out as unknown as Record<string, unknown>;
    });
  }

  async runQualityJob(lifecycleId: number, actorEmail: string) {
    const lc = await this.loadLifecycleRow(lifecycleId);
    this.assertEnabled(String(lc.service_slug ?? ''));
    const briefRow = await this.repo.getBrief(lifecycleId);
    const draft = await this.repo.ensureDraft(lifecycleId, actorEmail);
    const quality = computeQualityScore(briefRow?.brief_json ?? null, draft);

    return this.runJob(lifecycleId, 'quality_score', actorEmail, async () => {
      const prevRag = draft.quality_score_json?.rag_citations;
      await this.repo.upsertDraft(
        lifecycleId,
        {
          ...draft,
          quality_score_json: {
            ...(quality as unknown as Record<string, unknown>),
            ...(prevRag ? { rag_citations: prevRag } : {}),
          },
        },
        actorEmail,
      );
      return quality as unknown as Record<string, unknown>;
    });
  }

  async runBudgetSimulateJob(lifecycleId: number, actorEmail: string) {
    const lc = await this.loadLifecycleRow(lifecycleId);
    this.assertEnabled(String(lc.service_slug ?? ''));
    const brief = await this.requireBrief(lifecycleId);

    return this.runJob(lifecycleId, 'budget_simulate', actorEmail, async (jobId) => {
      const scenarios = await this.budget.simulate(lifecycleId, brief, jobId);
      return { scenarios, count: scenarios.length } as unknown as Record<string, unknown>;
    });
  }

  async applyBudgetScenario(lifecycleId: number, scenarioId: number, actorEmail: string) {
    const lc = await this.loadLifecycleRow(lifecycleId);
    this.assertEnabled(String(lc.service_slug ?? ''));
    const draft = await this.repo.ensureDraft(lifecycleId, actorEmail);
    const campaigns = (draft.campaigns_json ?? []) as MktAiCampaignDraft[];
    const applied = await this.budget.applyScenario(lifecycleId, scenarioId, campaigns, actorEmail);
    return applied;
  }

  async retryJob(lifecycleId: number, jobType: string, actorEmail: string) {
    if (!RETRY_JOB_TYPES.includes(jobType as MktAiJobType)) {
      throw new BadRequestException({ error: 'invalid_job_type', job_type: jobType });
    }
    switch (jobType) {
      case 'strategy_generate':
        return this.runStrategyJob(lifecycleId, actorEmail);
      case 'campaign_generate':
        return this.runCampaignJob(lifecycleId, actorEmail);
      case 'content_generate':
        return this.runContentJob(lifecycleId, actorEmail);
      case 'quality_score':
        return this.runQualityJob(lifecycleId, actorEmail);
      default:
        throw new BadRequestException({ error: 'invalid_job_type' });
    }
  }

  async applyToTmmt(
    lifecycleId: number,
    body: Record<string, unknown>,
    actorEmail: string,
  ) {
    const lc = await this.loadLifecycleRow(lifecycleId);
    this.assertEnabled(String(lc.service_slug ?? ''));

    if (!body.confirm_overwrite) {
      throw new BadRequestException({ error: 'confirm_overwrite_required' });
    }

    const draft = await this.repo.ensureDraft(lifecycleId, actorEmail);
    const briefRow = await this.repo.getBrief(lifecycleId);
    const quality = computeQualityScore(briefRow?.brief_json ?? null, draft);
    if (!quality.can_apply) {
      throw new BadRequestException({
        error: 'quality_score_too_low',
        score: quality.score,
      });
    }

    const patchBody: Record<string, unknown> = {
      strategy_framework: body.strategy_framework ?? draft.strategy_framework,
      target_market_prof: body.target_market_prof ?? draft.target_market_prof,
    };

    let planPayload;
    try {
      planPayload = await this.lifecycle.patchMarketingPlan(lifecycleId, patchBody);
    } catch (err) {
      if (err instanceof NotFoundException) {
        throw new ConflictException({
          error: 'no_official_marketing_plan',
          message: 'Chưa có Kế hoạch MKT chính thức — promote presales R5 trước khi apply.',
        });
      }
      throw err;
    }
    await this.runJob(lifecycleId, 'apply_to_tmmt', actorEmail, async () => ({
      applied: true,
      validation: planPayload.validation,
    }));

    return {
      plan: planPayload.plan,
      tmmt_validation: planPayload.validation,
      filled_count: planPayload.filled_count,
    };
  }

  async exportPlan(
    lifecycleId: number,
    format: string,
    actorEmail: string,
  ): Promise<MktAiExportFileResult> {
    const lc = await this.loadLifecycleRow(lifecycleId);
    this.assertEnabled(String(lc.service_slug ?? ''));

    const fmt = String(format ?? 'pdf').toLowerCase();
    if (!['pdf', 'docx', 'xlsx'].includes(fmt)) {
      throw new BadRequestException({ error: 'invalid_export_format', format: fmt });
    }

    const ctx = await this.getContext(lifecycleId);
    const score = ctx.quality_score?.score ?? 0;
    if (score < 60) {
      throw new BadRequestException({ error: 'quality_score_too_low', score });
    }
    if (ctx.quality_score?.can_export_docx_only && fmt !== 'docx') {
      throw new BadRequestException({ error: 'export_docx_only', score });
    }

    const isDraftExport = !ctx.tmmt_validation.ok;
    const result = await this.exportService.buildExport({
      lifecycleId,
      ctx,
      format: fmt as 'pdf' | 'docx' | 'xlsx',
      isDraftExport,
    });

    await this.repo.createExport({
      lifecycle_id: lifecycleId,
      format: fmt,
      exported_by: actorEmail,
      quality_score: score,
    });

    return result;
  }
}
