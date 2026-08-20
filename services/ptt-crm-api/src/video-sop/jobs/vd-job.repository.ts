import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../../config/app-config.service';
import type { InsertVdJobInput, PatchVdJobInput, VdJobRow, VdJobStatus, VdQueue } from './vd-job.types';

type MemoryStore = {
  jobs: VdJobRow[];
  nextId: number;
};

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === 'string') {
    try {
      const parsed: unknown = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      /* fall through */
    }
  }
  return {};
}

@Injectable()
export class VdJobRepository implements OnModuleDestroy {
  private pool: Pool | null = null;
  private pgReady: boolean | null = null;
  private readonly memory: MemoryStore = { jobs: [], nextId: 1 };
  last: VdJobRow = undefined as unknown as VdJobRow;

  constructor(private readonly config: AppConfigService) {}

  private get db(): Pool {
    if (!this.pool) {
      this.pool = new Pool({ connectionString: this.config.databaseUrl });
    }
    return this.pool;
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool?.end();
    this.pool = null;
  }

  async ensurePgReady(): Promise<boolean> {
    if (this.pgReady != null) return this.pgReady;
    try {
      await this.db.query(`SELECT 1 FROM vd_jobs LIMIT 1`);
      this.pgReady = true;
    } catch {
      this.pgReady = false;
    }
    return this.pgReady;
  }

  private assertWritableOrThrow(): void {
    if (this.config.contentMarketingVideoCinematicEnabled) {
      throw new Error('vd_tables_missing');
    }
  }

  private remember(row: VdJobRow): VdJobRow {
    this.last = row;
    return row;
  }

  private mapRow(row: Record<string, unknown>): VdJobRow {
    return {
      id: Number(row.id),
      project_id: Number(row.project_id),
      shot_id: row.shot_id != null ? Number(row.shot_id) : null,
      queue: String(row.queue) as VdQueue,
      job_type: String(row.job_type ?? ''),
      status: String(row.status ?? 'queued') as VdJobStatus,
      error_class: row.error_class != null ? String(row.error_class) : null,
      attempt: Number(row.attempt ?? 0),
      idempotency_key: String(row.idempotency_key ?? ''),
      input_json: asRecord(row.input_json),
      output_json: asRecord(row.output_json),
      created_at: new Date(String(row.created_at)).toISOString(),
      updated_at: new Date(String(row.updated_at)).toISOString(),
    };
  }

  async findByIdempotencyKey(key: string): Promise<VdJobRow | null> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `SELECT id, project_id, shot_id, queue, job_type, status, error_class, attempt,
                idempotency_key, input_json, output_json, created_at, updated_at
         FROM vd_jobs
         WHERE idempotency_key = $1
         LIMIT 1`,
        [key],
      );
      const row = res.rows[0] as Record<string, unknown> | undefined;
      return row ? this.mapRow(row) : null;
    }
    return this.memory.jobs.find((j) => j.idempotency_key === key) ?? null;
  }

  async getById(id: number): Promise<VdJobRow | null> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `SELECT id, project_id, shot_id, queue, job_type, status, error_class, attempt,
                idempotency_key, input_json, output_json, created_at, updated_at
         FROM vd_jobs
         WHERE id = $1`,
        [id],
      );
      const row = res.rows[0] as Record<string, unknown> | undefined;
      return row ? this.mapRow(row) : null;
    }
    return this.memory.jobs.find((j) => j.id === id) ?? null;
  }

  async listByProjectId(projectId: number): Promise<VdJobRow[]> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `SELECT id, project_id, shot_id, queue, job_type, status, error_class, attempt,
                idempotency_key, input_json, output_json, created_at, updated_at
         FROM vd_jobs
         WHERE project_id = $1
         ORDER BY updated_at DESC`,
        [projectId],
      );
      return (res.rows as Record<string, unknown>[]).map((row) => this.mapRow(row));
    }
    return this.memory.jobs
      .filter((j) => j.project_id === projectId)
      .slice()
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }

  async insert(input: InsertVdJobInput): Promise<VdJobRow> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `INSERT INTO vd_jobs (
           project_id, shot_id, queue, job_type, status, error_class, attempt,
           idempotency_key, input_json, output_json
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb)
         RETURNING id, project_id, shot_id, queue, job_type, status, error_class, attempt,
                   idempotency_key, input_json, output_json, created_at, updated_at`,
        [
          input.project_id,
          input.shot_id,
          input.queue,
          input.job_type,
          input.status,
          input.error_class ?? null,
          input.attempt ?? 0,
          input.idempotency_key,
          JSON.stringify(input.input_json),
          JSON.stringify(input.output_json ?? {}),
        ],
      );
      return this.remember(this.mapRow(res.rows[0] as Record<string, unknown>));
    }
    this.assertWritableOrThrow();
    const existing = this.memory.jobs.find((j) => j.idempotency_key === input.idempotency_key);
    if (existing) {
      throw Object.assign(new Error('duplicate key value violates unique constraint'), { code: '23505' });
    }
    const now = new Date().toISOString();
    const row: VdJobRow = {
      id: this.memory.nextId++,
      project_id: input.project_id,
      shot_id: input.shot_id,
      queue: input.queue,
      job_type: input.job_type,
      status: input.status,
      error_class: input.error_class ?? null,
      attempt: input.attempt ?? 0,
      idempotency_key: input.idempotency_key,
      input_json: input.input_json,
      output_json: input.output_json ?? {},
      created_at: now,
      updated_at: now,
    };
    this.memory.jobs.push(row);
    return this.remember(row);
  }

  async update(id: number, patch: PatchVdJobInput): Promise<VdJobRow> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `UPDATE vd_jobs
         SET status = COALESCE($2, status),
             error_class = CASE WHEN $3::bool THEN $4 ELSE error_class END,
             attempt = COALESCE($5, attempt),
             output_json = CASE WHEN $6::bool THEN $7::jsonb ELSE output_json END,
             updated_at = now()
         WHERE id = $1
         RETURNING id, project_id, shot_id, queue, job_type, status, error_class, attempt,
                   idempotency_key, input_json, output_json, created_at, updated_at`,
        [
          id,
          patch.status ?? null,
          patch.error_class !== undefined,
          patch.error_class ?? null,
          patch.attempt ?? null,
          patch.output_json !== undefined,
          patch.output_json !== undefined ? JSON.stringify(patch.output_json) : null,
        ],
      );
      const row = res.rows[0] as Record<string, unknown> | undefined;
      if (!row) throw new Error('vd_job_not_found');
      return this.remember(this.mapRow(row));
    }
    this.assertWritableOrThrow();
    const idx = this.memory.jobs.findIndex((j) => j.id === id);
    if (idx < 0) throw new Error('vd_job_not_found');
    const current = this.memory.jobs[idx];
    const next: VdJobRow = {
      ...current,
      status: patch.status ?? current.status,
      error_class: patch.error_class !== undefined ? patch.error_class : current.error_class,
      attempt: patch.attempt ?? current.attempt,
      output_json: patch.output_json ?? current.output_json,
      updated_at: new Date().toISOString(),
    };
    this.memory.jobs[idx] = next;
    return this.remember(next);
  }
}
