import { Inject, Injectable } from '@nestjs/common';

export const CP_STUB_PRICING_VERSION = 'stub-2026-09';

interface CpRenderWorkerQueryPort {
  query(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: Record<string, unknown>[]; rowCount?: number | null }>;
}

@Injectable()
export class CpRenderWorker {
  constructor(
    @Inject('CP_RENDERS_QUERY') private readonly db: CpRenderWorkerQueryPort,
  ) {}

  async process(
    job: Record<string, unknown>,
    snapshot: Record<string, unknown>,
    db: CpRenderWorkerQueryPort = this.db,
  ): Promise<void> {
    await db.query(
      `UPDATE crm_cp_render_jobs
          SET state = 'processing', stage = 'stub_render', progress = 50,
              stage_log_json = stage_log_json || $2::jsonb
        WHERE id = $1::uuid AND state = 'queued'`,
      [
        job.id,
        JSON.stringify([{
          stage: 'stub_render',
          at: new Date().toISOString(),
        }]),
      ],
    );
    await db.query(
      `INSERT INTO crm_cp_video_versions (
         draft_id, version_n, snapshot_json, qc_status, approval_status,
         immutable, output_uri, pricing_version
       )
       SELECT $1::uuid, COALESCE(MAX(version_n), 0) + 1, $2::jsonb,
              NULL, 'internal_review', TRUE, $3, $4
         FROM crm_cp_video_versions
        WHERE draft_id = $1::uuid
       RETURNING *`,
      [
        job.draft_id,
        JSON.stringify(snapshot),
        `stub://renders/${String(job.id)}`,
        CP_STUB_PRICING_VERSION,
      ],
    );
    await db.query(
      `UPDATE crm_cp_render_jobs
          SET state = 'completed', stage = 'completed', progress = 100,
              stage_log_json = stage_log_json || $2::jsonb
        WHERE id = $1::uuid`,
      [
        job.id,
        JSON.stringify([{
          stage: 'completed',
          at: new Date().toISOString(),
        }]),
      ],
    );
  }
}
