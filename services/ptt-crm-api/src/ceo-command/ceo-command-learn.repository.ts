import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';

export type CeoLearnCandidateRow = {
  id: string;
  folder_key: string;
  kind: string;
  question: string;
  answer: string;
  source_turn_id: string | null;
  status: string;
  created_at: string;
};

function mapRow(row: Record<string, unknown>): CeoLearnCandidateRow {
  return {
    id: String(row.id),
    folder_key: String(row.folder_key),
    kind: String(row.kind),
    question: String(row.question),
    answer: String(row.answer),
    source_turn_id: row.source_turn_id != null ? String(row.source_turn_id) : null,
    status: String(row.status),
    created_at: String(row.created_at ?? ''),
  };
}

@Injectable()
export class CeoCommandLearnRepository implements OnModuleDestroy {
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
         WHERE table_schema = 'public' AND table_name = 'ceo_command_learn_candidates'
         LIMIT 1`,
      );
      const ok = (result.rowCount ?? result.rows.length) > 0;
      if (ok) this.tableReadyCached = true;
      return ok;
    } catch {
      return false;
    }
  }

  async listByStatus(status?: string): Promise<CeoLearnCandidateRow[]> {
    if (!(await this.tableReady())) return [];
    const params: unknown[] = [];
    let where = '';
    if (status) {
      params.push(status);
      where = `WHERE status = $1`;
    }
    const result = await this.db.query(
      `SELECT * FROM ceo_command_learn_candidates ${where} ORDER BY created_at DESC LIMIT 200`,
      params,
    );
    return result.rows.map(mapRow);
  }

  async hasDuplicateQuestion(folderKey: string, question: string): Promise<boolean> {
    if (!(await this.tableReady())) return false;
    const since = new Date(Date.now() - 90 * 86400000).toISOString();
    const result = await this.db.query(
      `SELECT 1 FROM ceo_command_learn_candidates
       WHERE folder_key = $1 AND lower(question) = lower($2) AND created_at >= $3
       LIMIT 1`,
      [folderKey, question, since],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async insert(row: {
    folder_key: string;
    kind: string;
    question: string;
    answer: string;
    source_turn_id?: string;
  }): Promise<CeoLearnCandidateRow | null> {
    if (!(await this.tableReady())) return null;
    const result = await this.db.query(
      `INSERT INTO ceo_command_learn_candidates (folder_key, kind, question, answer, source_turn_id)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING *`,
      [row.folder_key, row.kind, row.question, row.answer, row.source_turn_id ?? null],
    );
    const first = result.rows[0];
    return first ? mapRow(first) : null;
  }

  async updateStatus(
    id: string,
    status: string,
    reviewerStaffId?: number,
    rejectReason?: string,
  ): Promise<CeoLearnCandidateRow | null> {
    if (!(await this.tableReady())) return null;
    const result = await this.db.query(
      `UPDATE ceo_command_learn_candidates
       SET status = $2,
           reviewer_staff_id = $3,
           reviewed_at = NOW(),
           reject_reason = $4
       WHERE id = $1
       RETURNING *`,
      [id, status, reviewerStaffId ?? null, rejectReason ?? null],
    );
    const first = result.rows[0];
    return first ? mapRow(first) : null;
  }
}
