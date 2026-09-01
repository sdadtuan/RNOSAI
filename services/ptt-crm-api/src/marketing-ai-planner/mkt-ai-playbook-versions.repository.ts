import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';

export type MktAiPlaybookVersionStatus =
  | 'draft'
  | 'pending_review'
  | 'approved'
  | 'active'
  | 'retired'
  | 'rejected_auto';

export type MktAiPlaybookVersionDepth = 'shipped' | 'shallow' | 'deep';
export type MktAiPlaybookVersionSource = 'disk' | 'common' | 'learn' | 'manual';
export type MktAiPlaybookLearnJobStatus = 'queued' | 'running' | 'succeeded' | 'failed';

export type MktAiPlaybookLearnJobRow = {
  id: number;
  service_slug: string;
  status: MktAiPlaybookLearnJobStatus;
  actor: string;
  error: string | null;
  output_version_id: number | null;
  created_at: string;
  finished_at: string | null;
};

export type MktAiPlaybookVersionRow = {
  id: number;
  service_slug: string;
  version_no: number;
  status: MktAiPlaybookVersionStatus;
  depth: MktAiPlaybookVersionDepth;
  document_json: Record<string, unknown>;
  source: MktAiPlaybookVersionSource;
  learn_job_id: number | null;
  corpus_json: Record<string, unknown>;
  created_by: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
};

export type InsertPlaybookVersionInput = {
  serviceSlug: string;
  versionNo: number;
  status: Exclude<MktAiPlaybookVersionStatus, 'active'>;
  depth: MktAiPlaybookVersionDepth;
  documentJson: Record<string, unknown>;
  source: MktAiPlaybookVersionSource;
  learnJobId?: number | null;
  corpusJson?: Record<string, unknown>;
  createdBy: string;
};

function mapLearnJob(row: Record<string, unknown>): MktAiPlaybookLearnJobRow {
  return {
    id: Number(row.id),
    service_slug: String(row.service_slug ?? ''),
    status: row.status as MktAiPlaybookLearnJobStatus,
    actor: String(row.actor ?? ''),
    error: row.error != null ? String(row.error) : null,
    output_version_id: row.output_version_id != null ? Number(row.output_version_id) : null,
    created_at: String(row.created_at ?? ''),
    finished_at: row.finished_at != null ? String(row.finished_at) : null,
  };
}

function mapVersion(row: Record<string, unknown>): MktAiPlaybookVersionRow {
  return {
    id: Number(row.id),
    service_slug: String(row.service_slug ?? ''),
    version_no: Number(row.version_no),
    status: row.status as MktAiPlaybookVersionStatus,
    depth: row.depth as MktAiPlaybookVersionDepth,
    document_json: (row.document_json as Record<string, unknown>) ?? {},
    source: row.source as MktAiPlaybookVersionSource,
    learn_job_id: row.learn_job_id != null ? Number(row.learn_job_id) : null,
    corpus_json: (row.corpus_json as Record<string, unknown>) ?? {},
    created_by: String(row.created_by ?? ''),
    reviewed_by: row.reviewed_by != null ? String(row.reviewed_by) : null,
    reviewed_at: row.reviewed_at != null ? String(row.reviewed_at) : null,
    review_note: row.review_note != null ? String(row.review_note) : null,
    created_at: String(row.created_at ?? ''),
  };
}

@Injectable()
export class MktAiPlaybookVersionsRepository implements OnModuleDestroy {
  private pool: Pool | null = null;

  constructor(private readonly config: AppConfigService) {}

  private get db(): Pool {
    if (!this.pool) {
      this.pool = new Pool({ connectionString: this.config.databaseUrl });
    }
    return this.pool;
  }

  onModuleDestroy(): void {
    void this.pool?.end();
    this.pool = null;
  }

  async insertLearnJob(serviceSlug: string, actor: string): Promise<MktAiPlaybookLearnJobRow> {
    const { rows } = await this.db.query(
      `INSERT INTO mkt_ai_playbook_learn_jobs (service_slug, status, actor)
       VALUES ($1, 'queued', $2)
       RETURNING *`,
      [serviceSlug, actor],
    );
    return mapLearnJob(rows[0]);
  }

  async getLearnJob(jobId: number): Promise<MktAiPlaybookLearnJobRow | null> {
    const { rows } = await this.db.query(
      `SELECT * FROM mkt_ai_playbook_learn_jobs WHERE id = $1`,
      [jobId],
    );
    return rows[0] ? mapLearnJob(rows[0]) : null;
  }

  async listLearnJobsBySlug(serviceSlug: string, limit = 20): Promise<MktAiPlaybookLearnJobRow[]> {
    const { rows } = await this.db.query(
      `SELECT * FROM mkt_ai_playbook_learn_jobs
       WHERE service_slug = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [serviceSlug, limit],
    );
    return rows.map((row) => mapLearnJob(row));
  }

  async hasSucceededWithinDays(serviceSlug: string, days = 7): Promise<boolean> {
    const { rows } = await this.db.query(
      `SELECT 1 FROM mkt_ai_playbook_learn_jobs
       WHERE service_slug = $1
         AND status = 'succeeded'
         AND finished_at >= NOW() - ($2 || ' days')::interval
       LIMIT 1`,
      [serviceSlug, String(days)],
    );
    return rows.length > 0;
  }

  async hasInProgressJob(serviceSlug: string): Promise<boolean> {
    const { rows } = await this.db.query(
      `SELECT 1 FROM mkt_ai_playbook_learn_jobs
       WHERE service_slug = $1
         AND status IN ('queued', 'running')
       LIMIT 1`,
      [serviceSlug],
    );
    return rows.length > 0;
  }

  async claimLearnJob(jobId: number): Promise<MktAiPlaybookLearnJobRow | null> {
    const { rows } = await this.db.query(
      `UPDATE mkt_ai_playbook_learn_jobs
       SET status = 'running'
       WHERE id = $1 AND status = 'queued'
       RETURNING *`,
      [jobId],
    );
    return rows[0] ? mapLearnJob(rows[0]) : null;
  }

  async finishLearnJob(
    jobId: number,
    patch: {
      status: Extract<MktAiPlaybookLearnJobStatus, 'succeeded' | 'failed'>;
      error?: string | null;
      outputVersionId?: number | null;
    },
  ): Promise<MktAiPlaybookLearnJobRow | null> {
    const { rows } = await this.db.query(
      `UPDATE mkt_ai_playbook_learn_jobs
       SET status = $2,
           error = $3,
           output_version_id = $4,
           finished_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [jobId, patch.status, patch.error ?? null, patch.outputVersionId ?? null],
    );
    return rows[0] ? mapLearnJob(rows[0]) : null;
  }

  async getNextVersionNo(serviceSlug: string): Promise<number> {
    const { rows } = await this.db.query(
      `SELECT COALESCE(MAX(version_no), 0) + 1 AS next_no
       FROM mkt_ai_playbook_versions
       WHERE service_slug = $1`,
      [serviceSlug],
    );
    return Number(rows[0]?.next_no ?? 1);
  }

  async insertVersion(input: InsertPlaybookVersionInput): Promise<MktAiPlaybookVersionRow> {
    const { rows } = await this.db.query(
      `INSERT INTO mkt_ai_playbook_versions (
         service_slug, version_no, status, depth, document_json, source,
         learn_job_id, corpus_json, created_by
       ) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8::jsonb, $9)
       RETURNING *`,
      [
        input.serviceSlug,
        input.versionNo,
        input.status,
        input.depth,
        JSON.stringify(input.documentJson),
        input.source,
        input.learnJobId ?? null,
        JSON.stringify(input.corpusJson ?? {}),
        input.createdBy,
      ],
    );
    return mapVersion(rows[0]);
  }

  async getVersion(versionId: number): Promise<MktAiPlaybookVersionRow | null> {
    const { rows } = await this.db.query(
      `SELECT * FROM mkt_ai_playbook_versions WHERE id = $1`,
      [versionId],
    );
    return rows[0] ? mapVersion(rows[0]) : null;
  }

  async listVersionsBySlug(serviceSlug: string, limit = 50): Promise<MktAiPlaybookVersionRow[]> {
    const { rows } = await this.db.query(
      `SELECT * FROM mkt_ai_playbook_versions
       WHERE service_slug = $1
       ORDER BY version_no DESC
       LIMIT $2`,
      [serviceSlug, limit],
    );
    return rows.map((row) => mapVersion(row));
  }

  async getActiveVersion(serviceSlug: string): Promise<MktAiPlaybookVersionRow | null> {
    const { rows } = await this.db.query(
      `SELECT * FROM mkt_ai_playbook_versions
       WHERE service_slug = $1 AND status = 'active'
       LIMIT 1`,
      [serviceSlug],
    );
    return rows[0] ? mapVersion(rows[0]) : null;
  }

  async updateVersionDocument(
    versionId: number,
    documentJson: Record<string, unknown>,
  ): Promise<MktAiPlaybookVersionRow | null> {
    const { rows } = await this.db.query(
      `UPDATE mkt_ai_playbook_versions
       SET document_json = $2::jsonb
       WHERE id = $1 AND status = 'draft'
       RETURNING *`,
      [versionId, JSON.stringify(documentJson)],
    );
    return rows[0] ? mapVersion(rows[0]) : null;
  }

  async updateVersionStatus(
    versionId: number,
    status: MktAiPlaybookVersionStatus,
    patch: {
      reviewedBy?: string | null;
      reviewedAt?: Date | null;
      reviewNote?: string | null;
    } = {},
  ): Promise<MktAiPlaybookVersionRow | null> {
    const { rows } = await this.db.query(
      `UPDATE mkt_ai_playbook_versions
       SET status = $2,
           reviewed_by = COALESCE($3, reviewed_by),
           reviewed_at = COALESCE($4, reviewed_at),
           review_note = COALESCE($5, review_note)
       WHERE id = $1
       RETURNING *`,
      [
        versionId,
        status,
        patch.reviewedBy ?? null,
        patch.reviewedAt ?? null,
        patch.reviewNote ?? null,
      ],
    );
    return rows[0] ? mapVersion(rows[0]) : null;
  }

  async retireActiveVersion(serviceSlug: string): Promise<void> {
    await this.db.query(
      `UPDATE mkt_ai_playbook_versions
       SET status = 'retired'
       WHERE service_slug = $1 AND status = 'active'`,
      [serviceSlug],
    );
  }

  async activateVersion(
    versionId: number,
    serviceSlug: string,
    actor: string,
    reviewNote?: string | null,
  ): Promise<MktAiPlaybookVersionRow | null> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE mkt_ai_playbook_versions SET status = 'retired'
         WHERE service_slug = $1 AND status = 'active'`,
        [serviceSlug],
      );
      const { rows } = await client.query(
        `UPDATE mkt_ai_playbook_versions
         SET status = 'active',
             reviewed_by = COALESCE(reviewed_by, $2),
             reviewed_at = COALESCE(reviewed_at, NOW()),
             review_note = COALESCE($3, review_note)
         WHERE id = $1
         RETURNING *`,
        [versionId, actor, reviewNote ?? null],
      );
      if (!rows[0]) {
        await client.query('ROLLBACK');
        return null;
      }
      await client.query(
        `INSERT INTO mkt_ai_service_policy (service_slug, rollout, enabled, active_version_id, updated_by)
         VALUES ($1, 'off', TRUE, $2, $3)
         ON CONFLICT (service_slug) DO UPDATE SET
           active_version_id = EXCLUDED.active_version_id,
           updated_at = now(),
           updated_by = EXCLUDED.updated_by`,
        [serviceSlug, versionId, actor],
      );
      await client.query('COMMIT');
      return mapVersion(rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}
