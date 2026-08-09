import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { ContentJobWorkerService } from './content-job-worker.service';
import { ContentMarketingRepository } from './content-marketing.repository';
import { ContentMarketingService } from './content-marketing.service';
import type { CmktGenerateInput } from './content-marketing-prompt.util';
import type { CmktJobRow } from './content-marketing.types';

const GENERATABLE_STATUSES = new Set(['draft', 'changes_requested']);

@Injectable()
export class ContentGenerateService {
  constructor(
    private readonly config: AppConfigService,
    private readonly core: ContentMarketingService,
    private readonly repo: ContentMarketingRepository,
    private readonly worker: ContentJobWorkerService,
  ) {}

  private ensureAiEnabled(): void {
    if (!this.config.contentMarketingAiEnabled) {
      throw new BadRequestException({
        error: 'cmkt_ai_disabled',
        message: 'Bật PTT_CONTENT_MARKETING_AI_ENABLED=1 để dùng AI generate.',
      });
    }
  }

  async startDraftJob(
    lifecycleId: number,
    itemId: number,
    body: Record<string, unknown>,
    actorEmail: string,
  ): Promise<CmktJobRow> {
    return this.startJob(lifecycleId, itemId, 'draft_generate', body, actorEmail);
  }

  async startVariantsJob(
    lifecycleId: number,
    itemId: number,
    body: Record<string, unknown>,
    actorEmail: string,
  ): Promise<CmktJobRow> {
    return this.startJob(lifecycleId, itemId, 'variant_generate', body, actorEmail);
  }

  private async startJob(
    lifecycleId: number,
    itemId: number,
    jobType: 'draft_generate' | 'variant_generate',
    body: Record<string, unknown>,
    actorEmail: string,
  ): Promise<CmktJobRow> {
    this.ensureAiEnabled();
    await this.core.ensureLifecycleEnabled(lifecycleId);

    const item = await this.repo.getItemById(lifecycleId, itemId);
    if (!item) throw new NotFoundException({ error: 'item_not_found', id: itemId });
    if (!GENERATABLE_STATUSES.has(item.status)) {
      throw new BadRequestException({ error: 'item_not_generatable', status: item.status });
    }

    const input: CmktGenerateInput & Record<string, unknown> = {
      tone: (body.tone as CmktGenerateInput['tone']) ?? 'professional_friendly',
      length: (body.length as CmktGenerateInput['length']) ?? 'medium',
      goal: body.goal != null ? String(body.goal) : item.funnel_goal,
      include_outline: body.include_outline !== false,
      variant_count: body.variant_count != null ? Number(body.variant_count) : 3,
      channel: body.channel != null ? String(body.channel) : item.channel,
      format: body.format != null ? String(body.format) : item.format,
    };

    const job = await this.repo.createContentJob({
      lifecycle_id: lifecycleId,
      item_id: itemId,
      job_type: jobType,
      input_json: input,
      created_by: actorEmail,
    });

    const finished = await this.worker.processJob(job.id);
    return finished ?? job;
  }

  async getJob(lifecycleId: number, jobId: number): Promise<CmktJobRow> {
    await this.core.ensureLifecycleEnabled(lifecycleId);
    const job = await this.repo.getContentJob(lifecycleId, jobId);
    if (!job) throw new NotFoundException({ error: 'job_not_found', id: jobId });
    return job;
  }

  async cancelJob(lifecycleId: number, jobId: number): Promise<CmktJobRow> {
    await this.core.ensureLifecycleEnabled(lifecycleId);
    const job = await this.repo.cancelContentJob(lifecycleId, jobId);
    if (!job) {
      throw new ConflictException({ error: 'job_not_cancellable', id: jobId });
    }
    return job;
  }
}
