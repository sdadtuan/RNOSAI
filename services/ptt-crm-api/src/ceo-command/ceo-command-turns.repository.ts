import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';

export type CeoTurnRow = {
  id: string;
  thread_id: string;
  actor_staff_id: number;
  intent: string;
  user_text: string;
  reply_vi: string;
  stub_mode: boolean;
  model_name: string;
  facts_json: Record<string, unknown>;
  citations_json: unknown[];
  proposed_action_json: unknown | null;
  cards_json: unknown[];
  degraded_json: Array<{ source: string; reason: string }>;
  rating: 'up' | 'down' | null;
  rating_reason: string | null;
  created_at: string;
};

export type InsertCeoTurn = {
  thread_id: string;
  actor_staff_id: number;
  intent: string;
  user_text: string;
  reply_vi: string;
  stub_mode: boolean;
  model_name: string;
  facts_json: Record<string, unknown>;
  citations_json: unknown[];
  proposed_action_json?: unknown | null;
  cards_json: unknown[];
  degraded_json: Array<{ source: string; reason: string }>;
};

function mapTurn(row: Record<string, unknown>): CeoTurnRow {
  const rating = String(row.rating ?? '').trim();
  return {
    id: String(row.id),
    thread_id: String(row.thread_id ?? ''),
    actor_staff_id: Number(row.actor_staff_id),
    intent: String(row.intent ?? ''),
    user_text: String(row.user_text ?? ''),
    reply_vi: String(row.reply_vi ?? ''),
    stub_mode: Boolean(row.stub_mode),
    model_name: String(row.model_name ?? 'facts'),
    facts_json: (row.facts_json as Record<string, unknown>) ?? {},
    citations_json: (row.citations_json as unknown[]) ?? [],
    proposed_action_json: row.proposed_action_json ?? null,
    cards_json: (row.cards_json as unknown[]) ?? [],
    degraded_json: (row.degraded_json as Array<{ source: string; reason: string }>) ?? [],
    rating: rating === 'up' || rating === 'down' ? rating : null,
    rating_reason: row.rating_reason != null ? String(row.rating_reason) : null,
    created_at: String(row.created_at ?? ''),
  };
}

@Injectable()
export class CeoCommandTurnsRepository implements OnModuleDestroy {
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
         WHERE table_schema = 'public' AND table_name = 'ceo_command_turns'
         LIMIT 1`,
      );
      const ok = (result.rowCount ?? result.rows.length) > 0;
      if (ok) this.tableReadyCached = true;
      return ok;
    } catch {
      return false;
    }
  }

  async insert(row: InsertCeoTurn): Promise<CeoTurnRow | null> {
    if (!(await this.tableReady())) return null;
    if (!Number.isFinite(row.actor_staff_id) || row.actor_staff_id <= 0) return null;
    const result = await this.db.query(
      `INSERT INTO ceo_command_turns (
         thread_id, actor_staff_id, intent, user_text, reply_vi,
         stub_mode, model_name, facts_json, citations_json,
         proposed_action_json, cards_json, degraded_json
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10::jsonb,$11::jsonb,$12::jsonb)
       RETURNING *`,
      [
        row.thread_id,
        row.actor_staff_id,
        row.intent,
        row.user_text,
        row.reply_vi,
        row.stub_mode,
        row.model_name,
        JSON.stringify(row.facts_json ?? {}),
        JSON.stringify(row.citations_json ?? []),
        row.proposed_action_json != null ? JSON.stringify(row.proposed_action_json) : null,
        JSON.stringify(row.cards_json ?? []),
        JSON.stringify(row.degraded_json ?? []),
      ],
    );
    const first = result.rows[0];
    return first ? mapTurn(first) : null;
  }

  async listByThread(threadId: string): Promise<CeoTurnRow[]> {
    if (!(await this.tableReady())) return [];
    const result = await this.db.query(
      `SELECT * FROM ceo_command_turns WHERE thread_id = $1 ORDER BY created_at ASC`,
      [threadId],
    );
    return result.rows.map((r) => mapTurn(r));
  }

  async listThreadsByStaff(staffId: number, days = 7): Promise<Array<{ thread_id: string; date: string }>> {
    if (!(await this.tableReady())) return [];
    const since = new Date(Date.now() - days * 86400000).toISOString();
    const result = await this.db.query(
      `SELECT DISTINCT thread_id,
              substring(thread_id from 'ceo:[0-9]+:(.+)$') AS date
       FROM ceo_command_turns
       WHERE actor_staff_id = $1 AND created_at >= $2
       ORDER BY thread_id DESC`,
      [staffId, since],
    );
    return result.rows.map((r) => ({
      thread_id: String(r.thread_id),
      date: String(r.date ?? ''),
    }));
  }

  async findById(id: string): Promise<CeoTurnRow | null> {
    if (!(await this.tableReady())) return null;
    const result = await this.db.query(`SELECT * FROM ceo_command_turns WHERE id = $1`, [id]);
    const first = result.rows[0];
    return first ? mapTurn(first) : null;
  }

  async rate(
    id: string,
    rating: 'up' | 'down',
    reason?: string | null,
  ): Promise<CeoTurnRow | null> {
    if (!(await this.tableReady())) return null;
    const trimmed = String(reason ?? '').trim().slice(0, 200) || null;
    const result = await this.db.query(
      `UPDATE ceo_command_turns SET rating = $2, rating_reason = $3 WHERE id = $1 RETURNING *`,
      [id, rating, trimmed],
    );
    const first = result.rows[0];
    return first ? mapTurn(first) : null;
  }

  async listByRating(
    rating: 'up' | 'down',
    since?: Date,
    limit = 50,
  ): Promise<CeoTurnRow[]> {
    if (!(await this.tableReady())) return [];
    const params: unknown[] = [rating];
    let extra = '';
    if (since) {
      params.push(since.toISOString());
      extra = ` AND created_at >= $${params.length}`;
    }
    params.push(limit);
    const result = await this.db.query(
      `SELECT * FROM ceo_command_turns
       WHERE rating = $1${extra}
       ORDER BY created_at DESC
       LIMIT $${params.length}`,
      params,
    );
    return result.rows.map((r) => mapTurn(r));
  }
}
