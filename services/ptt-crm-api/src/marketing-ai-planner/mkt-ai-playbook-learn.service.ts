import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AiAgentRunsRepository } from '../ai-intelligence/ai-agent-runs.repository';
import { AppConfigService } from '../config/app-config.service';
import {
  classifyCorpus,
  type CorpusLifecycleInput,
} from './mkt-ai-playbook-corpus.util';
import { rejectLearnedPlaybook } from './mkt-ai-playbook-learn-validate.util';
import {
  MktAiPlaybookVersionsRepository,
  type MktAiPlaybookLearnJobRow,
  type MktAiPlaybookVersionDepth,
} from './mkt-ai-playbook-versions.repository';
import { MarketingAiOrchestratorService } from './marketing-ai-orchestrator.service';
import {
  listPlaybookCatalog,
  resolvePlaybookForSlug,
} from './marketing-ai-playbook.util';

const MAX_PROMPT_LIFECYCLES = 15;
const COOLDOWN_DAYS = 7;

export type EnqueueLearnResult = {
  job_id: number;
  status: MktAiPlaybookLearnJobRow['status'];
};

@Injectable()
export class MktAiPlaybookLearnService {
  private readonly logger = new Logger(MktAiPlaybookLearnService.name);

  constructor(
    private readonly config: AppConfigService,
    private readonly versionsRepo: MktAiPlaybookVersionsRepository,
    private readonly orchestrator: MarketingAiOrchestratorService,
    private readonly agentRuns: AiAgentRunsRepository,
  ) {}

  isEnabled(): boolean {
    return this.config.mktAiPlaybookLearnEnabled;
  }

  assertEnabled(): void {
    if (!this.isEnabled()) {
      throw new NotFoundException({
        error: 'mkt_ai_playbook_learn_disabled',
        message: 'Học playbook từ HĐ thực chiến đang tắt.',
      });
    }
  }

  async enqueueLearn(
    slug: string,
    actor: string,
    excludeLifecycleIds: number[] = [],
  ): Promise<EnqueueLearnResult> {
    this.assertEnabled();
    const serviceSlug = String(slug ?? '').trim();
    if (!serviceSlug) {
      throw new ConflictException({
        error: 'playbook_learn_invalid_slug',
        message: 'Thiếu service_slug.',
      });
    }

    if (await this.versionsRepo.hasSucceededWithinDays(serviceSlug, COOLDOWN_DAYS)) {
      throw new ConflictException({
        error: 'playbook_learn_cooldown',
        message: `Chờ ${COOLDOWN_DAYS} ngày giữa hai lần học thành công cùng slug.`,
      });
    }

    if (await this.versionsRepo.hasInProgressJob(serviceSlug)) {
      throw new ConflictException({
        error: 'playbook_learn_in_progress',
        message: 'Đang có job học playbook queued/running cho slug này.',
      });
    }

    const corpusRows = await this.loadCorpusRows(serviceSlug, excludeLifecycleIds);
    const corpus = classifyCorpus(serviceSlug, corpusRows);
    if (!corpus.canLearn) {
      throw new ConflictException({
        error: 'playbook_learn_need_more',
        remaining: corpus.remaining,
        message: `Còn ${corpus.remaining} HĐ Apply chất lượng ≥70 để đủ ngưỡng học.`,
      });
    }

    const job = await this.versionsRepo.insertLearnJob(serviceSlug, actor);
    void this.runJob(job.id).catch((err) => {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`playbook_learn job ${job.id} failed: ${message}`);
    });

    return { job_id: job.id, status: job.status };
  }

  async runJob(jobId: number): Promise<void> {
    const claimed = await this.versionsRepo.claimLearnJob(jobId);
    if (!claimed) return;

    const serviceSlug = claimed.service_slug;
    const startedAt = Date.now();
    let runId: string | null = null;

    try {
      const corpusRows = await this.loadCorpusRows(serviceSlug, []);
      const corpus = classifyCorpus(serviceSlug, corpusRows);
      if (!corpus.canLearn) {
        throw new Error(`Corpus below threshold: remaining=${corpus.remaining}`);
      }

      const excerptRows = this.pickPromptLifecycles(corpus.candidates, corpus.winners);
      const clientNames = this.extractClientNames(corpusRows);
      const catalog = listPlaybookCatalog();
      const currentPlaybook = resolvePlaybookForSlug(serviceSlug, catalog);
      const stubPlaybook = this.buildStubPlaybook(serviceSlug, currentPlaybook, corpus.depth);

      const payload = {
        service_slug: serviceSlug,
        depth: corpus.depth,
        candidate_count: corpus.candidates.length,
        winner_count: corpus.winners.length,
        winner_excerpts: excerptRows.map((row) => ({
          lifecycle_id_hash: `lc-${row.lifecycleId}`,
          strategy_bullets: [`Applied lifecycle ${row.lifecycleId}`, `Stage ${row.stage}`],
          campaigns: [{ name: 'Campaign A', objective: 'lead' }],
        })),
        negative_lessons: [],
      };

      runId = await this.auditRunStart(claimed, payload);

      const doc = await this.orchestrator.generateLearnedPlaybook({
        payload,
        currentPlaybook: currentPlaybook as unknown as Record<string, unknown>,
        stubPlaybook,
      });

      doc.slug = serviceSlug;
      doc.service_slugs = [serviceSlug];
      doc.anonymized = true;
      doc.learned_from = {
        candidate_count: corpus.candidates.length,
        winner_count: corpus.winners.length,
        depth: corpus.depth,
        generated_at: new Date().toISOString(),
      };

      const validationErrors = rejectLearnedPlaybook(doc, serviceSlug, clientNames);
      const versionNo = await this.versionsRepo.getNextVersionNo(serviceSlug);
      const corpusJson = {
        candidate_count: corpus.candidates.length,
        winner_count: corpus.winners.length,
        depth: corpus.depth,
        lifecycle_ids: corpus.candidates.map((r) => r.lifecycleId),
      };

      const version = await this.versionsRepo.insertVersion({
        serviceSlug,
        versionNo,
        status: validationErrors.length ? 'rejected_auto' : 'draft',
        depth: corpus.depth as MktAiPlaybookVersionDepth,
        documentJson: doc,
        source: 'learn',
        learnJobId: jobId,
        corpusJson,
        createdBy: claimed.actor,
      });

      await this.versionsRepo.finishLearnJob(jobId, {
        status: 'succeeded',
        outputVersionId: version.id,
        error: validationErrors.length ? validationErrors.join('; ') : null,
      });

      await this.auditRunFinish(runId, {
        status: 'succeeded',
        latencyMs: Date.now() - startedAt,
        outputJson: {
          version_id: version.id,
          version_status: version.status,
          validation_errors: validationErrors,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.versionsRepo.finishLearnJob(jobId, {
        status: 'failed',
        error: message,
      });
      await this.auditRunFinish(runId, {
        status: 'failed',
        latencyMs: Date.now() - startedAt,
        errorMessage: message,
      });
      throw err;
    }
  }

  /** Stub until Task 12 wires real lifecycle corpus SQL. */
  async loadCorpusRows(
    _serviceSlug: string,
    _excludeLifecycleIds: number[],
  ): Promise<CorpusLifecycleInput[]> {
    return [];
  }

  private pickPromptLifecycles(
    candidates: CorpusLifecycleInput[],
    winners: CorpusLifecycleInput[],
  ): CorpusLifecycleInput[] {
    const winnerIds = new Set(winners.map((w) => w.lifecycleId));
    const ordered = [
      ...winners,
      ...candidates.filter((c) => !winnerIds.has(c.lifecycleId)),
    ];
    return ordered.slice(0, MAX_PROMPT_LIFECYCLES);
  }

  private extractClientNames(rows: CorpusLifecycleInput[]): string[] {
    return rows
      .map((row) => (row as CorpusLifecycleInput & { clientName?: string }).clientName)
      .filter((name): name is string => Boolean(name?.trim()));
  }

  private buildStubPlaybook(
    serviceSlug: string,
    currentPlaybook: { slug: string; label_vi: string; service_slugs: string[] },
    depth: string,
  ): Record<string, unknown> {
    const base = JSON.parse(JSON.stringify(currentPlaybook)) as Record<string, unknown>;
    base.slug = serviceSlug;
    base.service_slugs = [serviceSlug];
    base.anonymized = true;
    base.learned_from = {
      depth,
      candidate_count: 0,
      winner_count: 0,
      generated_at: new Date().toISOString(),
    };
    const defaults = (base.brief_defaults ?? {}) as Record<string, unknown>;
    delete defaults.brand_name;
    base.brief_defaults = defaults;
    return base;
  }

  private async auditRunStart(
    job: MktAiPlaybookLearnJobRow,
    inputJson: Record<string, unknown>,
  ): Promise<string | null> {
    if (!(await this.agentRuns.tableReady())) return null;
    try {
      const row = await this.agentRuns.insertRun({
        agentName: 'mkt_ai_playbook_learn',
        useCase: 'mkt_ai_playbook_learn',
        modelName: this.orchestrator.modelName,
        inputJson: { ...inputJson, job_id: job.id, service_slug: job.service_slug },
        outputJson: {},
        status: 'running',
        actorId: job.actor,
      });
      return row.id;
    } catch (err) {
      this.logger.warn(`ai_agent_runs insert skipped: ${String(err)}`);
      return null;
    }
  }

  private async auditRunFinish(
    runId: string | null,
    patch: {
      status: 'succeeded' | 'failed';
      latencyMs: number;
      outputJson?: Record<string, unknown>;
      errorMessage?: string;
    },
  ): Promise<void> {
    if (!runId || !(await this.agentRuns.tableReady())) return;
    try {
      await this.agentRuns.updateRun(runId, {
        status: patch.status,
        latencyMs: patch.latencyMs,
        outputJson: patch.outputJson,
        errorMessage: patch.errorMessage,
      });
    } catch (err) {
      this.logger.warn(`ai_agent_runs finish skipped: ${String(err)}`);
    }
  }
}
