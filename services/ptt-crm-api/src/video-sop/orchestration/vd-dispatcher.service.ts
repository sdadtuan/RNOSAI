import { Injectable } from '@nestjs/common';
import { VdJobRepository } from '../jobs/vd-job.repository';
import type { EnqueueVdJobInput, VdJobHandler, VdJobRow, VdJobStatus } from '../jobs/vd-job.types';

const RETRYABLE = new Set(['transient', 'rate_limit']);
const TERMINAL = new Set<VdJobStatus>(['succeeded', 'failed', 'cancelled', 'stale']);
const MAX_ATTEMPTS = 3;

function isUniqueViolation(err: unknown): boolean {
  return Boolean(err && typeof err === 'object' && (err as { code?: string }).code === '23505');
}

function errorClassOf(err: unknown): string {
  if (err && typeof err === 'object' && 'error_class' in err) {
    const value = (err as { error_class?: unknown }).error_class;
    if (typeof value === 'string' && value) return value;
  }
  return 'unknown';
}

function shotIdFrom(payload: Record<string, unknown>): number | null {
  const raw = payload.shot_id;
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

@Injectable()
export class VdDispatcherService {
  private readonly handlers = new Map<string, VdJobHandler>();

  constructor(private readonly jobs: VdJobRepository) {
    this.registerHandler('cine_keyframe', async () => ({}));
  }

  registerHandler(jobType: string, handler: VdJobHandler): void {
    this.handlers.set(jobType, handler);
  }

  async enqueue(input: EnqueueVdJobInput): Promise<VdJobRow> {
    const existing = await this.jobs.findByIdempotencyKey(input.idempotencyKey);
    if (existing) return existing;

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
        const found = await this.jobs.findByIdempotencyKey(input.idempotencyKey);
        if (found) return found;
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
      void this.run(id);
    });
  }

  private async run(id: number): Promise<void> {
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
  }
}
