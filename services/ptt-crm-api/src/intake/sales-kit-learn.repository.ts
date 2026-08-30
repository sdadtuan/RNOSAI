import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import { normalizeLearnQuestion } from './sales-kit-learn.util';

export type LearnCandidateRow = {
  id: string;
  folder_key: string;
  kind: string;
  question: string;
  answer: string;
  source_session_id: number;
  source_lead_id: number | null;
  source_turn_id: string | null;
  status: string;
  reviewer_staff_id: number | null;
  reviewed_at: string | null;
  reject_reason: string | null;
  created_at: string;
};

export type InsertLearnCandidate = {
  folder_key: string;
  kind: string;
  question: string;
  answer: string;
  source_session_id: number;
  source_lead_id: number | null;
  source_turn_id: string | null;
};

function mapCandidate(row: Record<string, unknown>): LearnCandidateRow {
  return {
    id: String(row.id),
    folder_key: String(row.folder_key ?? ''),
    kind: String(row.kind ?? ''),
    question: String(row.question ?? ''),
    answer: String(row.answer ?? ''),
    source_session_id: Number(row.source_session_id),
    source_lead_id: row.source_lead_id == null ? null : Number(row.source_lead_id),
    source_turn_id: row.source_turn_id != null ? String(row.source_turn_id) : null,
    status: String(row.status ?? 'pending_review'),
    reviewer_staff_id:
      row.reviewer_staff_id == null ? null : Number(row.reviewer_staff_id),
    reviewed_at: row.reviewed_at != null ? String(row.reviewed_at) : null,
    reject_reason: row.reject_reason != null ? String(row.reject_reason) : null,
    created_at: String(row.created_at ?? ''),
  };
}

@Injectable()
export class SalesKitLearnRepository implements OnModuleDestroy {
  private pool: Pool | null = null;
  private tableReadyCached: boolean | null = null;

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

  async tableReady(): Promise<boolean> {
    if (this.tableReadyCached) return true;
    try {
      const result = await this.db.query(
        `SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = 'sales_kit_learn_candidates'
         LIMIT 1`,
      );
      const ok = (result.rowCount ?? result.rows.length) > 0;
      if (ok) this.tableReadyCached = true;
      return ok;
    } catch {
      return false;
    }
  }

  async insert(row: InsertLearnCandidate): Promise<LearnCandidateRow | null> {
    if (!(await this.tableReady())) return null;
    const result = await this.db.query(
      `INSERT INTO sales_kit_learn_candidates (
         folder_key, kind, question, answer,
         source_session_id, source_lead_id, source_turn_id
       ) VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [
        row.folder_key,
        row.kind,
        row.question,
        row.answer,
        row.source_session_id,
        row.source_lead_id,
        row.source_turn_id,
      ],
    );
    const first = result.rows[0];
    return first ? mapCandidate(first) : null;
  }

  async findById(id: string): Promise<LearnCandidateRow | null> {
    if (!(await this.tableReady())) return null;
    const result = await this.db.query(
      `SELECT * FROM sales_kit_learn_candidates WHERE id = $1`,
      [id],
    );
    const first = result.rows[0];
    return first ? mapCandidate(first) : null;
  }

  async listByStatus(status?: string, limit = 100): Promise<LearnCandidateRow[]> {
    if (!(await this.tableReady())) return [];
    const params: unknown[] = [];
    let where = '';
    if (status) {
      params.push(status);
      where = `WHERE status = $1`;
    }
    params.push(limit);
    const result = await this.db.query(
      `SELECT * FROM sales_kit_learn_candidates
       ${where}
       ORDER BY created_at DESC
       LIMIT $${params.length}`,
      params,
    );
    return result.rows.map((r) => mapCandidate(r));
  }

  async hasDuplicateQuestion(folderKey: string, question: string, days = 90): Promise<boolean> {
    if (!(await this.tableReady())) return false;
    const norm = normalizeLearnQuestion(question);
    const result = await this.db.query(
      `SELECT 1 FROM sales_kit_learn_candidates
       WHERE folder_key = $1
         AND lower(regexp_replace(trim(question), '\\s+', ' ', 'g')) = $2
         AND created_at >= NOW() - ($3 || ' days')::interval
       LIMIT 1`,
      [folderKey, norm, String(days)],
    );
    return (result.rowCount ?? result.rows.length) > 0;
  }

  async updateStatus(
    id: string,
    status: string,
    reviewerStaffId: number | null,
    rejectReason?: string | null,
  ): Promise<LearnCandidateRow | null> {
    if (!(await this.tableReady())) return null;
    const result = await this.db.query(
      `UPDATE sales_kit_learn_candidates
       SET status = $2,
           reviewer_staff_id = $3,
           reviewed_at = NOW(),
           reject_reason = $4
       WHERE id = $1
       RETURNING *`,
      [id, status, reviewerStaffId, rejectReason ?? null],
    );
    const first = result.rows[0];
    return first ? mapCandidate(first) : null;
  }

  async metrics(): Promise<{
    pending_7d: number;
    approved_7d: number;
    rejected_7d: number;
    pending_30d: number;
    approved_30d: number;
    rejected_30d: number;
  }> {
    if (!(await this.tableReady())) {
      return {
        pending_7d: 0,
        approved_7d: 0,
        rejected_7d: 0,
        pending_30d: 0,
        approved_30d: 0,
        rejected_30d: 0,
      };
    }
    const result = await this.db.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'pending_review' AND created_at >= NOW() - INTERVAL '7 days') AS pending_7d,
        COUNT(*) FILTER (WHERE status IN ('ingested','approved') AND reviewed_at >= NOW() - INTERVAL '7 days') AS approved_7d,
        COUNT(*) FILTER (WHERE status = 'rejected' AND reviewed_at >= NOW() - INTERVAL '7 days') AS rejected_7d,
        COUNT(*) FILTER (WHERE status = 'pending_review' AND created_at >= NOW() - INTERVAL '30 days') AS pending_30d,
        COUNT(*) FILTER (WHERE status IN ('ingested','approved') AND reviewed_at >= NOW() - INTERVAL '30 days') AS approved_30d,
        COUNT(*) FILTER (WHERE status = 'rejected' AND reviewed_at >= NOW() - INTERVAL '30 days') AS rejected_30d
      FROM sales_kit_learn_candidates
    `);
    const row = result.rows[0] ?? {};
    return {
      pending_7d: Number(row.pending_7d ?? 0),
      approved_7d: Number(row.approved_7d ?? 0),
      rejected_7d: Number(row.rejected_7d ?? 0),
      pending_30d: Number(row.pending_30d ?? 0),
      approved_30d: Number(row.approved_30d ?? 0),
      rejected_30d: Number(row.rejected_30d ?? 0),
    };
  }

  async listIngestedPairs(limit = 500): Promise<Array<{ question: string; answer: string }>> {
    if (!(await this.tableReady())) return [];
    const result = await this.db.query(
      `SELECT question, answer FROM sales_kit_learn_candidates
       WHERE status = 'ingested'
       ORDER BY reviewed_at DESC NULLS LAST
       LIMIT $1`,
      [limit],
    );
    return result.rows.map((r) => ({
      question: String(r.question ?? ''),
      answer: String(r.answer ?? ''),
    }));
  }
}
