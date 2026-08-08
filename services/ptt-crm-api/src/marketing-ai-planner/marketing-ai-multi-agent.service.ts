import {
  BadRequestException,
  ConflictException,
  HttpException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { validateMktAiBrief } from './marketing-ai-brief.util';
import { computeQualityScore } from './marketing-ai-quality.util';
import { MarketingAiPlaybookService } from './marketing-ai-playbook.service';
import { MarketingAiPlannerRepository } from './marketing-ai-planner.repository';
import { MarketingAiPlannerService } from './marketing-ai-planner.service';
import {
  DEFAULT_PIPELINE_KEY,
  DEFAULT_PIPELINE_STEPS,
  type MktAiMultiAgentChildJobRef,
  type MktAiMultiAgentOutput,
  buildPipelineStepStates,
  findLatestMultiAgentParentJob,
  parseMultiAgentOutput,
  resolvePipelineSteps,
  rollupMultiAgentStatus,
  STEP_TO_JOB_TYPE,
} from './marketing-ai-multi-agent.util';
import type {
  MktAiDraft,
  MktAiMultiAgentBody,
  MktAiMultiAgentResult,
  MktAiMultiAgentStatusPayload,
  MktAiPipelineStep,
} from './marketing-ai-planner.types';

function extractFailedJobId(err: unknown): number {
  if (err instanceof HttpException) {
    const resp = err.getResponse();
    if (resp && typeof resp === 'object' && 'job_id' in resp) {
      const jobId = Number((resp as { job_id: unknown }).job_id);
      if (Number.isFinite(jobId) && jobId > 0) return jobId;
    }
  }
  return 0;
}

@Injectable()
export class MarketingAiMultiAgentService {
  constructor(
    private readonly config: AppConfigService,
    private readonly repo: MarketingAiPlannerRepository,
    private readonly playbooks: MarketingAiPlaybookService,
    @Inject(forwardRef(() => MarketingAiPlannerService))
    private readonly planner: MarketingAiPlannerService,
  ) {}

  isEnabled(): boolean {
    return this.config.mktAiPlannerEnabled && this.config.mktAiMultiAgentEnabled;
  }

  async run(
    lifecycleId: number,
    body: MktAiMultiAgentBody,
    actorEmail: string,
  ): Promise<MktAiMultiAgentResult> {
    if (!this.isEnabled()) {
      throw new NotFoundException({ error: 'mkt_ai_multi_agent_disabled' });
    }

    const lc = await this.planner.loadLifecyclePublic(lifecycleId);
    const serviceSlug = String(lc.service_slug ?? '');
    this.planner.assertEnabledPublic(serviceSlug);

    const jobs = await this.repo.listJobs(lifecycleId);
    const runningParent = jobs.find(
      (j) => j.job_type === 'multi_agent' && (j.status === 'running' || j.status === 'pending'),
    );
    if (runningParent) {
      throw new ConflictException({
        error: 'mkt_ai_multi_agent_running',
        job_id: runningParent.id,
      });
    }

    const steps = resolvePipelineSteps({
      steps: body.steps,
      skip_analyst: body.skip_analyst,
      start_from_step: body.start_from_step,
    });
    if (!steps.length) {
      throw new BadRequestException({ error: 'mkt_ai_multi_agent_no_steps' });
    }

    const briefRow = await this.repo.getBrief(lifecycleId);
    const briefValidation = validateMktAiBrief(briefRow?.brief_json ?? null);
    if (
      (steps.includes('strategist') || steps.includes('planner')) &&
      !briefValidation.ok
    ) {
      throw new BadRequestException({
        error: 'brief_incomplete',
        missing: briefValidation.missing,
        messages: briefValidation.messages,
      });
    }

    let playbookSlug =
      body.playbook_slug?.trim() ||
      String((briefRow?.brief_json as Record<string, unknown> | undefined)?._playbook_slug ?? '') ||
      null;

    if (body.playbook_slug?.trim()) {
      const applied = await this.playbooks.mergeAndPersistPlaybook({
        lifecycleId,
        slug: body.playbook_slug.trim(),
        serviceSlug,
        existingBrief: briefRow?.brief_json ?? null,
        actorEmail,
        prefillSources: briefRow?.prefill_sources_json ?? [],
      });
      playbookSlug = applied.playbook_slug;
    } else if (!playbookSlug && this.playbooks.isEnabled()) {
      const list = this.playbooks.listForLifecycle(serviceSlug, briefRow?.brief_json ?? null);
      playbookSlug = list.active_slug;
    }

    const pipelineKey = body.pipeline_key ?? DEFAULT_PIPELINE_KEY;
    const stopOnFailure = body.stop_on_failure !== false;
    const started = Date.now();
    const modelName =
      (await this.planner.getOrchestratorModelName()) +
      ((await this.planner.isStubMode()) ? '-stub' : '');

    const parent = await this.repo.createJob({
      lifecycle_id: lifecycleId,
      job_type: 'multi_agent',
      model_name: modelName,
      input_json: {
        lifecycle_id: lifecycleId,
        pipeline_key: pipelineKey,
        playbook_slug: playbookSlug,
        steps,
        stop_on_failure: stopOnFailure,
      },
      actor_email: actorEmail,
    });

    const childJobs: MktAiMultiAgentChildJobRef[] = [];
    let failedStep: MktAiPipelineStep | undefined;

    for (const step of steps) {
      const childStarted = Date.now();
      try {
        const result = await this.runStep(lifecycleId, step, actorEmail);
        childJobs.push({
          step,
          job_type: STEP_TO_JOB_TYPE[step],
          job_id: result.job_id,
          status: 'succeeded',
          latency_ms: Date.now() - childStarted,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const jobId = extractFailedJobId(err);

        childJobs.push({
          step,
          job_type: STEP_TO_JOB_TYPE[step],
          job_id: jobId,
          status: 'failed',
          latency_ms: Date.now() - childStarted,
          error_message: message,
        });
        failedStep = step;
        if (stopOnFailure) break;
      }
    }

    const draft = await this.repo.getDraft(lifecycleId);
    const quality = computeQualityScore(briefRow?.brief_json ?? null, draft ?? ({} as MktAiDraft));
    const output: MktAiMultiAgentOutput = {
      pipeline_key: pipelineKey,
      playbook_slug: playbookSlug,
      child_jobs: childJobs,
      ...(failedStep ? { failed_step: failedStep } : {}),
      quality_score: quality.score,
    };

    const rollup = rollupMultiAgentStatus(childJobs);
    const parentStatus = rollup === 'failed' ? 'failed' : 'succeeded';
    const latency = Date.now() - started;

    await this.repo.finishJob(parent.id, {
      status: parentStatus,
      output_json: output as unknown as Record<string, unknown>,
      latency_ms: latency,
      error_message:
        rollup === 'failed'
          ? childJobs.find((j) => j.status === 'failed')?.error_message ?? 'multi_agent_failed'
          : rollup === 'partial'
            ? `partial_failure:${failedStep ?? 'unknown'}`
            : null,
    });

    return {
      ok: rollup !== 'failed',
      job_id: parent.id,
      status: rollup,
      output,
      draft: draft ?? undefined,
    };
  }

  async getStatus(lifecycleId: number): Promise<MktAiMultiAgentStatusPayload> {
    const jobs = await this.repo.listJobs(lifecycleId, 30);
    const parent = findLatestMultiAgentParentJob(jobs);
    if (!parent) {
      return {
        ok: true,
        parent_job: null,
        pipeline_key: null,
        playbook_slug: null,
        rollup_status: 'idle',
        steps: buildPipelineStepStates({
          requestedSteps: [...DEFAULT_PIPELINE_STEPS],
          childJobs: [],
        }),
      };
    }

    const output = parseMultiAgentOutput(parent.output_json);
    const inputSteps = Array.isArray(parent.input_json?.steps)
      ? (parent.input_json.steps as string[]).filter((s): s is MktAiPipelineStep =>
          ['strategist', 'planner', 'copywriter', 'analyst'].includes(s),
        )
      : [...DEFAULT_PIPELINE_STEPS];

    const childJobs = output?.child_jobs ?? [];
    let rollupStatus: MktAiMultiAgentStatusPayload['rollup_status'] = 'idle';
    if (parent.status === 'running' || parent.status === 'pending') {
      rollupStatus = 'running';
    } else if (childJobs.length) {
      rollupStatus = rollupMultiAgentStatus(childJobs);
    } else if (parent.status === 'failed') {
      rollupStatus = 'failed';
    } else if (parent.status === 'succeeded') {
      rollupStatus = 'succeeded';
    }

    return {
      ok: true,
      parent_job: parent,
      pipeline_key: output?.pipeline_key ?? String(parent.input_json?.pipeline_key ?? DEFAULT_PIPELINE_KEY),
      playbook_slug:
        output?.playbook_slug ??
        (parent.input_json?.playbook_slug == null
          ? null
          : String(parent.input_json.playbook_slug)),
      rollup_status: rollupStatus,
      steps: buildPipelineStepStates({ requestedSteps: inputSteps, childJobs }),
      quality_score: output?.quality_score,
      failed_step: output?.failed_step,
    };
  }

  private async runStep(
    lifecycleId: number,
    step: MktAiPipelineStep,
    actorEmail: string,
  ): Promise<{ job_id: number }> {
    switch (step) {
      case 'strategist':
        return this.planner.runStrategyJob(lifecycleId, actorEmail);
      case 'planner':
        return this.planner.runCampaignJob(lifecycleId, actorEmail);
      case 'copywriter':
        return this.planner.runContentJob(lifecycleId, actorEmail);
      case 'analyst':
        return this.planner.runQualityJob(lifecycleId, actorEmail);
      default:
        throw new BadRequestException({ error: 'invalid_pipeline_step', step });
    }
  }
}
