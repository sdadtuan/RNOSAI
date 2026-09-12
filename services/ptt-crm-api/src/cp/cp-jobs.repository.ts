import { Inject, Injectable } from '@nestjs/common';
import { insertProviderRun, type InsertProviderRunInput } from './cp-provider-runs.repository';

export const CP_JOBS_QUERY = 'CP_JOBS_QUERY';

export type CpJobsQueryPort = {
  query(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: Record<string, unknown>[]; rowCount?: number | null }>;
};

export type CpJobInsertInput = {
  projectId: string;
  taskId?: string | null;
  state: 'draft' | 'pending_confirm';
  provider: 'magnific_mcp' | 'magnific_rest' | 'comfyui';
  model?: string | null;
  stageLog: Record<string, unknown>;
  createdByStaffId: number;
  idempotencyKey: string;
  correlationId: string;
};

@Injectable()
export class CpJobsRepository implements CpJobsQueryPort {
  constructor(@Inject(CP_JOBS_QUERY) private readonly db: CpJobsQueryPort) {}

  query(sql: string, params?: unknown[]) {
    return this.db.query(sql, params);
  }

  loadProject(projectId: string) {
    return this.query(
      `SELECT * FROM crm_cp_projects WHERE id = $1::uuid LIMIT 1`,
      [projectId],
    );
  }

  findByIdempotencyKey(key: string) {
    return this.query(
      `SELECT * FROM crm_cp_render_jobs WHERE idempotency_key = $1 LIMIT 1`,
      [key],
    );
  }

  findById(id: string) {
    return this.query(
      `SELECT * FROM crm_cp_render_jobs WHERE id = $1::uuid LIMIT 1`,
      [id],
    );
  }

  insertJob(input: CpJobInsertInput) {
    return this.query(
      `INSERT INTO crm_cp_render_jobs (
         project_id, task_id, state, provider, model, stage_log_json,
         idempotency_key, correlation_id, draft_id, stage, progress, attempt
       ) VALUES (
         $1::uuid, $2::uuid, $3, $4, $5, $6::jsonb,
         $7, $8, NULL, $3, 0, 1
       )
       ON CONFLICT (idempotency_key) DO NOTHING
       RETURNING *`,
      [
        input.projectId,
        input.taskId ?? null,
        input.state,
        input.provider,
        input.model ?? null,
        JSON.stringify(input.stageLog),
        input.idempotencyKey,
        input.correlationId,
      ],
    );
  }

  claimQueuedForIngest(id: string, stage = 'magnific_wait') {
    return this.query(
      `UPDATE crm_cp_render_jobs
          SET state = $1, stage = $2
        WHERE id = $3::uuid AND state = 'queued'
        RETURNING *`,
      ['processing', stage, id],
    );
  }

  updateJob(
    id: string,
    patch: { state?: string; stageLog?: Record<string, unknown>; errorClass?: string | null },
  ) {
    const state = patch.state;
    const log = patch.stageLog ? JSON.stringify(patch.stageLog) : null;
    if (state && log && patch.errorClass !== undefined) {
      return this.query(
        `UPDATE crm_cp_render_jobs
            SET state = $1, stage = $1, error_class = $2, stage_log_json = $3::jsonb
          WHERE id = $4::uuid
          RETURNING *`,
        [state, patch.errorClass, log, id],
      );
    }
    if (state && log) {
      return this.query(
        `UPDATE crm_cp_render_jobs
            SET state = $1, stage = $1, stage_log_json = $2::jsonb
          WHERE id = $3::uuid
          RETURNING *`,
        [state, log, id],
      );
    }
    if (state) {
      return this.query(
        `UPDATE crm_cp_render_jobs
            SET state = $1, stage = $1
          WHERE id = $2::uuid
          RETURNING *`,
        [state, id],
      );
    }
    return this.query(
      `UPDATE crm_cp_render_jobs
          SET stage_log_json = $1::jsonb
        WHERE id = $2::uuid
        RETURNING *`,
      [log, id],
    );
  }

  insertRun(input: InsertProviderRunInput) {
    return insertProviderRun(input, this);
  }
}
