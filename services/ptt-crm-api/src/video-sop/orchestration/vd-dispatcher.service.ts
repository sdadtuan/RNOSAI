import { Injectable, Logger, Optional } from '@nestjs/common';
import { createHash } from 'crypto';
import type { VdImageGenInput } from '../adapters/i-image-gen';
import { parseIdeaSummaries, selectTextGen } from '../adapters/i-text-gen';
import { VdAssetRepository } from '../assets/vd-asset.repository';
import { VdJobRepository } from '../jobs/vd-job.repository';
import type { EnqueueVdJobInput, VdJobHandler, VdJobRow, VdJobStatus } from '../jobs/vd-job.types';
import { VdIdeaRepository } from '../script/vd-idea.repository';
import { VdShotRepository } from '../script/vd-shot.repository';
import { VdPromptRepository } from '../prompt/vd-prompt.repository';
import { selectImageGen } from './vd-model-router';

const RETRYABLE = new Set(['transient', 'rate_limit']);
const TERMINAL = new Set<VdJobStatus>(['succeeded', 'failed', 'cancelled', 'stale']);
const MAX_ATTEMPTS = 3;
const KNOWN_ERROR_CLASS = new Set(['auth', 'transient', 'rate_limit', 'validation', 'provider', 'unknown']);

function isUniqueViolation(err: unknown): boolean {
  return Boolean(err && typeof err === 'object' && (err as { code?: string }).code === '23505');
}

function errorClassOf(err: unknown): string {
  if (err && typeof err === 'object' && 'error_class' in err) {
    const value = (err as { error_class?: unknown }).error_class;
    if (typeof value === 'string' && KNOWN_ERROR_CLASS.has(value)) return value;
  }
  if (err instanceof Error && KNOWN_ERROR_CLASS.has(err.message)) {
    return err.message;
  }
  return 'unknown';
}

function shotIdFrom(payload: Record<string, unknown>): number | null {
  const raw = payload.shot_id;
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function imageInputFrom(payload: Record<string, unknown>): VdImageGenInput {
  const width = Number(payload.width);
  const height = Number(payload.height);
  const seed = payload.seed != null ? Number(payload.seed) : undefined;
  return {
    prompt: typeof payload.prompt === 'string' ? payload.prompt : '',
    width: Number.isFinite(width) && width > 0 ? Math.floor(width) : 1024,
    height: Number.isFinite(height) && height > 0 ? Math.floor(height) : 1024,
    ...(Number.isFinite(seed) ? { seed } : {}),
    ...(typeof payload.negativePrompt === 'string' ? { negativePrompt: payload.negativePrompt } : {}),
  };
}

@Injectable()
export class VdDispatcherService {
  private readonly handlers = new Map<string, VdJobHandler>();
  private readonly logger = new Logger(VdDispatcherService.name);

  constructor(
    private readonly jobs: VdJobRepository,
    private readonly assets: VdAssetRepository,
    @Optional() private readonly ideas?: VdIdeaRepository,
    @Optional() private readonly shots?: VdShotRepository,
    @Optional() private readonly prompts?: VdPromptRepository,
  ) {
    this.registerHandler('cine_keyframe', (job) => this.handleCineKeyframe(job));
    this.registerHandler('cine_director', (job) => this.handleCineDirector(job));
  }

  private async handleCineDirector(job: VdJobRow): Promise<Record<string, unknown>> {
    if (!this.ideas) {
      throw Object.assign(new Error('validation'), { error_class: 'validation' });
    }
    const gen = selectTextGen({ OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? '' });
    const result = await gen.complete({
      system: 'Return JSON { "ideas": [{ "summary": string }, { "summary": string }, { "summary": string }] }.',
      user:
        typeof job.input_json.prompt === 'string' && job.input_json.prompt.trim()
          ? job.input_json.prompt
          : 'Sinh 3 ý tưởng video 15–60s',
    });
    let summaries: string[];
    try {
      summaries = parseIdeaSummaries(result);
    } catch {
      throw Object.assign(new Error('validation'), { error_class: 'validation' });
    }
    const rows = await this.ideas.replaceForProject(job.project_id, summaries);
    return {
      ideas: rows.map((row) => ({ ordinal: row.ordinal, summary: row.summary })),
    };
  }

  private async handleCineKeyframe(job: VdJobRow): Promise<Record<string, unknown>> {
    const gen = selectImageGen({
      PTT_VD_LEONARDO_API_KEY: (process.env.PTT_VD_LEONARDO_API_KEY ?? '').trim(),
      REPLICATE_API_TOKEN: (process.env.REPLICATE_API_TOKEN ?? '').trim(),
    });
    const input = imageInputFrom(job.input_json);
    const result = await gen.generate(input);
    if (!result?.buffer || !Buffer.isBuffer(result.buffer) || result.buffer.length === 0) {
      throw Object.assign(new Error('empty_image_buffer'), { error_class: 'provider' });
    }
    const sha256 = createHash('sha256').update(result.buffer).digest('hex');
    const asset = await this.assets.insert({
      project_id: job.project_id,
      job_id: job.id,
      kind: 'keyframe',
      storage_key: '',
      url: '',
      sha256,
      width: input.width,
      height: input.height,
    });

    if (job.shot_id && this.shots) {
      await this.shots.updateStatus(job.shot_id, 'keyframe_pending');
      if (this.prompts) {
        const promptRow = await this.prompts.getByShotId(job.shot_id);
        if (promptRow) {
          await this.assets.insertLineage({
            parent_asset_id: asset.id,
            child_asset_id: asset.id,
            edge: 'prompt',
          });
        }
      }
    }

    return {
      provider: result.provider,
      providerId: result.providerId,
      seed: result.seed,
      asset_id: asset.id,
    };
  }

  registerHandler(jobType: string, handler: VdJobHandler): void {
    this.handlers.set(jobType, handler);
  }

  async enqueue(input: EnqueueVdJobInput): Promise<VdJobRow> {
    const scoped = await this.jobs.findByIdempotencyKey(input.idempotencyKey, input.projectId);
    if (scoped) return scoped;
    const existing = await this.jobs.findByIdempotencyKey(input.idempotencyKey);
    if (existing) throw new Error('idempotency_key_conflict');

    try {
      const row = await this.jobs.insert({
        project_id: input.projectId,
        shot_id: shotIdFrom(input.payload),
        queue: input.queue,
        job_type: input.jobType,
        status: 'queued',
        idempotency_key: input.idempotencyKey,
        input_json: input.payload,
      });
      this.schedule(row.id);
      return row;
    } catch (err) {
      if (isUniqueViolation(err)) {
        const foundScoped = await this.jobs.findByIdempotencyKey(input.idempotencyKey, input.projectId);
        if (foundScoped) return foundScoped;
        const found = await this.jobs.findByIdempotencyKey(input.idempotencyKey);
        if (found) throw new Error('idempotency_key_conflict');
      }
      throw err;
    }
  }

  async drainForTest(id: number): Promise<VdJobRow> {
    for (let i = 0; i < 64; i += 1) {
      const row = await this.jobs.getById(id);
      if (!row) throw new Error('vd_job_not_found');
      if (TERMINAL.has(row.status)) return row;
      await new Promise<void>((resolve) => {
        setImmediate(resolve);
      });
    }
    const last = await this.jobs.getById(id);
    if (!last) throw new Error('vd_job_not_found');
    if (TERMINAL.has(last.status)) return last;
    throw new Error('vd_job_drain_timeout');
  }

  private schedule(id: number): void {
    setImmediate(() => {
      void this.run(id).catch((err) => {
        this.logger.error(
          `vd job ${id} uncaught: ${err instanceof Error ? err.message : String(err)}`,
        );
      });
    });
  }

  private logUncaught(id: number, err: unknown): void {
    this.logger.error(
      `vd job ${id} uncaught: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  private async run(id: number): Promise<void> {
    try {
      const job = await this.jobs.getById(id);
      if (!job || TERMINAL.has(job.status)) return;

      const handler = this.handlers.get(job.job_type);
      const attempt = job.attempt + 1;
      await this.jobs.update(id, { status: 'running', attempt });

      if (!handler) {
        await this.jobs.update(id, { status: 'failed', error_class: 'validation', attempt });
        return;
      }

      try {
        const output = await handler({ ...job, attempt, status: 'running' });
        await this.jobs.update(id, {
          status: 'succeeded',
          error_class: null,
          attempt,
          output_json: output ?? {},
        });
      } catch (err) {
        const errorClass = errorClassOf(err);
        if (RETRYABLE.has(errorClass) && attempt < MAX_ATTEMPTS) {
          await this.jobs.update(id, { status: 'queued', error_class: errorClass, attempt });
          this.schedule(id);
          return;
        }
        await this.jobs.update(id, { status: 'failed', error_class: errorClass, attempt });
      }
    } catch (err) {
      this.logUncaught(id, err);
    }
  }
}
