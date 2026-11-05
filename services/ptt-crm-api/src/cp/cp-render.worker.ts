import { Inject, Injectable, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { CpJobsService } from './cp-jobs.service';
import {
  pricingVersionForProvider,
  type CpRenderProvider,
} from './cp-render-mode.util';
import { resolveSopMasterOutputUri, resolveSopOutputUri } from './cp-sop-output.util';

export const CP_MAGNIFIC_POLL_MS = 10_000;

export const CP_STUB_PRICING_VERSION = 'stub-2026-09';
export const CP_SOP_PRICING_VERSION = 'sop-2026-09';
export const CP_RENDER_SOP_POLL_MS = 10_000;

interface CpRenderWorkerQueryPort {
  query(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: Record<string, unknown>[]; rowCount?: number | null }>;
}

function pricingVersionFromSnapshot(
  snapshot: Record<string, unknown>,
  fallback: string,
): string {
  const text = String(snapshot.pricing_version ?? '').trim();
  return text || fallback;
}

@Injectable()
export class CpRenderWorker implements OnModuleInit, OnModuleDestroy {
  private sopTimer: ReturnType<typeof setInterval> | undefined;
  private magnificTimer: ReturnType<typeof setInterval> | undefined;
  private magnificPollRunning = false;
  private readonly magnificInFlight = new Set<string>();

  constructor(
    @Inject('CP_RENDERS_QUERY') private readonly db: CpRenderWorkerQueryPort,
    @Optional() private readonly jobs?: Pick<CpJobsService, 'ingest'>,
  ) {}

  onModuleInit(): void {
    this.sopTimer = setInterval(() => void this.pollSopWaitJobs(), CP_RENDER_SOP_POLL_MS);
    this.sopTimer.unref?.();
    this.magnificTimer = setInterval(() => void this.pollMagnificQueuedJobs(), CP_MAGNIFIC_POLL_MS);
    this.magnificTimer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.sopTimer) clearInterval(this.sopTimer);
    this.sopTimer = undefined;
    if (this.magnificTimer) clearInterval(this.magnificTimer);
    this.magnificTimer = undefined;
  }

  async process(
    job: Record<string, unknown>,
    snapshot: Record<string, unknown>,
    db: CpRenderWorkerQueryPort = this.db,
  ): Promise<void> {
    const provider = String(job.provider ?? 'stub');
    if (provider.startsWith('magnific') || provider === 'comfyui') {
      await this.jobs?.ingest(Number(job.created_by_staff_id ?? 0), String(job.id));
      return;
    }
    if (provider === 'video_sop') {
      await this.processSop(job, snapshot, db);
      return;
    }
    await this.processStub(job, snapshot, db);
  }

  async pollMagnificQueuedJobs(db: CpRenderWorkerQueryPort = this.db): Promise<number> {
    if (!this.jobs) return 0;
    if (this.magnificPollRunning) return 0;
    this.magnificPollRunning = true;
    try {
      const pending = await db.query(
        `SELECT j.*
           FROM crm_cp_render_jobs j
          WHERE (j.provider LIKE 'magnific%' OR j.provider = 'comfyui')
            AND j.state = 'queued'
          ORDER BY j.created_at ASC
          LIMIT 20`,
      );
      let completed = 0;
      for (const job of pending.rows) {
        const id = String(job.id);
        if (this.magnificInFlight.has(id)) continue;
        this.magnificInFlight.add(id);
        try {
          await this.jobs.ingest(Number(job.created_by_staff_id ?? 0), id);
          completed += 1;
        } catch {
          // ingest records ASSET_SYNC_FAILED on the job
        } finally {
          this.magnificInFlight.delete(id);
        }
      }
      return completed;
    } finally {
      this.magnificPollRunning = false;
    }
  }

  async pollSopWaitJobs(db: CpRenderWorkerQueryPort = this.db): Promise<number> {
    const pending = await db.query(
      `SELECT j.*
         FROM crm_cp_render_jobs j
        WHERE j.provider = 'video_sop'
          AND j.state = 'processing'
          AND j.stage = 'sop_wait'
        ORDER BY j.created_at ASC
        LIMIT 20`,
    );
    let completed = 0;
    for (const job of pending.rows) {
      const done = await this.tryCompleteSopWaitJob(job, db);
      if (done) completed += 1;
    }
    return completed;
  }

  private async processStub(
    job: Record<string, unknown>,
    snapshot: Record<string, unknown>,
    db: CpRenderWorkerQueryPort,
  ): Promise<void> {
    const startedAt = Date.now();
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
    await this.insertVersion(
      db,
      job,
      snapshot,
      `stub://renders/${String(job.id)}`,
      pricingVersionFromSnapshot(snapshot, CP_STUB_PRICING_VERSION),
    );
    await this.completeJob(db, job.id, startedAt, 'completed');
  }

  private async processSop(
    job: Record<string, unknown>,
    snapshot: Record<string, unknown>,
    db: CpRenderWorkerQueryPort,
  ): Promise<void> {
    const draft = objectValue(snapshot.draft);
    const config = objectValue(draft.config_json);
    const { vdProjectId, outputUri } = await resolveSopOutputUri(
      db,
      String(job.draft_id),
      config,
    );

    if (!vdProjectId && !outputUri) {
      await this.failJob(db, job.id, 'sop_project_missing', {
        message: 'Thiếu vd_project_id hoặc output_uri cho render Video SOP',
      });
      return;
    }

    if (!outputUri) {
      await db.query(
        `UPDATE crm_cp_render_jobs
            SET state = 'processing', stage = 'sop_wait', progress = 25,
                stage_log_json = stage_log_json || $2::jsonb
          WHERE id = $1::uuid AND state = 'queued'`,
        [
          job.id,
          JSON.stringify([{
            stage: 'sop_wait',
            vd_project_id: vdProjectId,
            at: new Date().toISOString(),
          }]),
        ],
      );
      return;
    }

    const startedAt = Date.now();
    await db.query(
      `UPDATE crm_cp_render_jobs
          SET state = 'processing', stage = 'sop_render', progress = 50,
              stage_log_json = stage_log_json || $2::jsonb
        WHERE id = $1::uuid AND state = 'queued'`,
      [
        job.id,
        JSON.stringify([{
          stage: 'sop_render',
          vd_project_id: vdProjectId,
          output_uri: outputUri,
          at: new Date().toISOString(),
        }]),
      ],
    );
    await this.insertVersion(
      db,
      job,
      snapshot,
      outputUri,
      pricingVersionFromSnapshot(snapshot, CP_SOP_PRICING_VERSION),
    );
    await this.completeJob(db, job.id, startedAt, 'completed', {
      vd_project_id: vdProjectId,
      output_uri: outputUri,
    });
  }

  private async tryCompleteSopWaitJob(
    job: Record<string, unknown>,
    db: CpRenderWorkerQueryPort,
  ): Promise<boolean> {
    const vdProjectId = parseVdProjectIdFromLog(job.stage_log_json);
    if (!vdProjectId) {
      await this.failJob(db, job.id, 'sop_project_missing', {
        message: 'Không tìm thấy vd_project_id trên job SOP',
      });
      return false;
    }
    const outputUri = await resolveSopMasterOutputUri(db, vdProjectId);
    if (!outputUri) return false;

    const snapshotResult = await db.query(
      `SELECT d.*
         FROM crm_cp_video_drafts d
        WHERE d.id = $1::uuid
        LIMIT 1`,
      [job.draft_id],
    );
    const draft = snapshotResult.rows[0];
    if (!draft) {
      await this.failJob(db, job.id, 'draft_not_found');
      return false;
    }

    const startedAt = Date.now();
    const snapshot = {
      draft,
      kit_version: null,
      asset_versions: [],
      pricing_version: CP_SOP_PRICING_VERSION,
      render_job_id: job.id,
    };
    await db.query(
      `UPDATE crm_cp_render_jobs
          SET stage = 'sop_render', progress = 75,
              stage_log_json = stage_log_json || $2::jsonb
        WHERE id = $1::uuid`,
      [
        job.id,
        JSON.stringify([{
          stage: 'sop_render',
          vd_project_id: vdProjectId,
          output_uri: outputUri,
          at: new Date().toISOString(),
        }]),
      ],
    );
    await this.insertVersion(db, job, snapshot, outputUri, CP_SOP_PRICING_VERSION);
    await this.completeJob(db, job.id, startedAt, 'completed', {
      vd_project_id: vdProjectId,
      output_uri: outputUri,
    });
    return true;
  }

  private async insertVersion(
    db: CpRenderWorkerQueryPort,
    job: Record<string, unknown>,
    snapshot: Record<string, unknown>,
    outputUri: string,
    pricingVersion: string,
  ): Promise<void> {
    await db.query(
      `SELECT id FROM crm_cp_video_drafts
        WHERE id = $1::uuid
        FOR UPDATE`,
      [job.draft_id],
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
        JSON.stringify({
          ...snapshot,
          pricing_version: pricingVersion,
        }),
        outputUri,
        pricingVersion,
      ],
    );
  }

  private async completeJob(
    db: CpRenderWorkerQueryPort,
    jobId: unknown,
    startedAt: number,
    stage: string,
    extra: Record<string, unknown> = {},
  ): Promise<void> {
    const durationSec = Math.max(0, (Date.now() - startedAt) / 1000);
    await db.query(
      `UPDATE crm_cp_render_jobs
          SET state = 'completed', stage = $3, progress = 100,
              stage_log_json = stage_log_json || $2::jsonb
        WHERE id = $1::uuid`,
      [
        jobId,
        JSON.stringify([{
          stage,
          at: new Date().toISOString(),
          duration_sec: durationSec,
          ...extra,
        }]),
        stage,
      ],
    );
  }

  private async failJob(
    db: CpRenderWorkerQueryPort,
    jobId: unknown,
    errorClass: string,
    extra: Record<string, unknown> = {},
  ): Promise<void> {
    await db.query(
      `UPDATE crm_cp_render_jobs
          SET state = 'failed', stage = 'failed', progress = 100,
              error_class = $2,
              stage_log_json = stage_log_json || $3::jsonb
        WHERE id = $1::uuid`,
      [
        jobId,
        errorClass,
        JSON.stringify([{
          stage: 'failed',
          error_class: errorClass,
          at: new Date().toISOString(),
          ...extra,
        }]),
      ],
    );
  }
}

export function providerPricingVersion(provider: CpRenderProvider): string {
  return pricingVersionForProvider(provider);
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function parseVdProjectIdFromLog(value: unknown): number | null {
  if (!Array.isArray(value)) return null;
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const raw = (entry as Record<string, unknown>).vd_project_id;
    const number = Number(raw);
    if (Number.isFinite(number) && number > 0) return Math.floor(number);
  }
  return null;
}
