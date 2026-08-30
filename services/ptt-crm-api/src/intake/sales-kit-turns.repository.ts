import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';

export type SalesKitTurnRow = {
  id: string;
  session_id: number;
  actor_staff_id: number | null;
  intent: string;
  user_text: string;
  reply_vi: string;
  stub_mode: boolean;
  model_name: string;
  citations_json: unknown;
  apply_json: unknown;
  rating: 'up' | 'down' | null;
  rating_reason: string | null;
  created_at: string;
};

export type InsertSalesKitTurn = {
  session_id: number;
  actor_staff_id: number | null;
  intent: string;
  user_text: string;
  reply_vi: string;
  stub_mode: boolean;
  model_name: string;
  citations_json: unknown;
  apply_json: unknown;
};

function mapTurn(row: Record<string, unknown>): SalesKitTurnRow {
  const rating = String(row.rating ?? '').trim();
  return {
    id: String(row.id),
    session_id: Number(row.session_id),
    actor_staff_id: row.actor_staff_id == null ? null : Number(row.actor_staff_id),
    intent: String(row.intent ?? ''),
    user_text: String(row.user_text ?? ''),
    reply_vi: String(row.reply_vi ?? ''),
    stub_mode: Boolean(row.stub_mode),
    model_name: String(row.model_name ?? 'rules'),
    citations_json: row.citations_json ?? [],
    apply_json: row.apply_json ?? {},
    rating: rating === 'up' || rating === 'down' ? rating : null,
    rating_reason: row.rating_reason != null ? String(row.rating_reason) : null,
    created_at: String(row.created_at ?? ''),
  };
}

@Injectable()
export class SalesKitTurnsRepository implements OnModuleDestroy {
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
         WHERE table_schema = 'public' AND table_name = 'sales_kit_turns'
         LIMIT 1`,
      );
      const ok = (result.rowCount ?? result.rows.length) > 0;
      if (ok) this.tableReadyCached = true;
      return ok;
    } catch {
      return false;
    }
  }

  async insert(row: InsertSalesKitTurn): Promise<SalesKitTurnRow | null> {
    if (!(await this.tableReady())) return null;
    const actor =
      row.actor_staff_id != null && row.actor_staff_id > 0 ? row.actor_staff_id : null;
    const result = await this.db.query(
      `INSERT INTO sales_kit_turns (
         session_id, actor_staff_id, intent, user_text, reply_vi,
         stub_mode, model_name, citations_json, apply_json
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb)
       RETURNING *`,
      [
        row.session_id,
        actor,
        row.intent,
        row.user_text,
        row.reply_vi,
        row.stub_mode,
        row.model_name,
        JSON.stringify(row.citations_json ?? []),
        JSON.stringify(row.apply_json ?? {}),
      ],
    );
    const first = result.rows[0];
    return first ? mapTurn(first) : null;
  }

  async listBySession(sessionId: number): Promise<SalesKitTurnRow[]> {
    if (!(await this.tableReady())) return [];
    const result = await this.db.query(
      `SELECT * FROM sales_kit_turns
       WHERE session_id = $1
       ORDER BY created_at ASC`,
      [sessionId],
    );
    return result.rows.map((r) => mapTurn(r));
  }

  async findById(id: string): Promise<SalesKitTurnRow | null> {
    if (!(await this.tableReady())) return null;
    const result = await this.db.query(`SELECT * FROM sales_kit_turns WHERE id = $1`, [id]);
    const first = result.rows[0];
    return first ? mapTurn(first) : null;
  }

  async listByRating(
    rating: 'up' | 'down',
    since?: Date,
    limit = 50,
  ): Promise<SalesKitTurnRow[]> {
    if (!(await this.tableReady())) return [];
    const params: unknown[] = [rating];
    let extra = '';
    if (since) {
      params.push(since.toISOString());
      extra = ` AND created_at >= $${params.length}`;
    }
    params.push(limit);
    const result = await this.db.query(
      `SELECT * FROM sales_kit_turns
       WHERE rating = $1${extra}
       ORDER BY created_at DESC
       LIMIT $${params.length}`,
      params,
    );
    return result.rows.map((r) => mapTurn(r));
  }

  async listUpBySession(sessionId: number): Promise<SalesKitTurnRow[]> {
    if (!(await this.tableReady())) return [];
    const result = await this.db.query(
      `SELECT * FROM sales_kit_turns
       WHERE session_id = $1 AND rating = 'up'
       ORDER BY created_at ASC`,
      [sessionId],
    );
    return result.rows.map((r) => mapTurn(r));
  }

  async rate(
    id: string,
    rating: 'up' | 'down',
    reason?: string | null,
  ): Promise<SalesKitTurnRow | null> {
    if (!(await this.tableReady())) return null;
    const trimmed = String(reason ?? '').trim().slice(0, 200) || null;
    const result = await this.db.query(
      `UPDATE sales_kit_turns
       SET rating = $2, rating_reason = $3
       WHERE id = $1
       RETURNING *`,
      [id, rating, trimmed],
    );
    const first = result.rows[0];
    return first ? mapTurn(first) : null;
  }
}
