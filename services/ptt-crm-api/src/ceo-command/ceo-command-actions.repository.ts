import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';

export type CeoActionRow = {
  id: string;
  turn_id: string;
  idempotency_key: string;
  action_id: string;
  params_json: Record<string, unknown>;
  status: string;
  result_json: Record<string, unknown>;
  actor_staff_id: number;
  created_at: string;
};

function mapRow(row: Record<string, unknown>): CeoActionRow {
  return {
    id: String(row.id),
    turn_id: String(row.turn_id),
    idempotency_key: String(row.idempotency_key),
    action_id: String(row.action_id),
    params_json: (row.params_json as Record<string, unknown>) ?? {},
    status: String(row.status),
    result_json: (row.result_json as Record<string, unknown>) ?? {},
    actor_staff_id: Number(row.actor_staff_id),
    created_at: String(row.created_at ?? ''),
  };
}

@Injectable()
export class CeoCommandActionsRepository implements OnModuleDestroy {
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
         WHERE table_schema = 'public' AND table_name = 'ceo_command_actions'
         LIMIT 1`,
      );
      const ok = (result.rowCount ?? result.rows.length) > 0;
      if (ok) this.tableReadyCached = true;
      return ok;
    } catch {
      return false;
    }
  }

  async findByIdempotency(key: string): Promise<CeoActionRow | null> {
    if (!(await this.tableReady())) return null;
    const since = new Date(Date.now() - 86400000).toISOString();
    const result = await this.db.query(
      `SELECT * FROM ceo_command_actions
       WHERE idempotency_key = $1 AND created_at >= $2
       ORDER BY created_at DESC
       LIMIT 1`,
      [key, since],
    );
    const first = result.rows[0];
    return first ? mapRow(first) : null;
  }

  async insert(row: {
    turn_id: string;
    idempotency_key: string;
    action_id: string;
    params_json: Record<string, unknown>;
    status: string;
    result_json: Record<string, unknown>;
    actor_staff_id: number;
  }): Promise<CeoActionRow | null> {
    if (!(await this.tableReady())) return null;
    const result = await this.db.query(
      `INSERT INTO ceo_command_actions (
         turn_id, idempotency_key, action_id, params_json, status, result_json, actor_staff_id
       ) VALUES ($1,$2,$3,$4::jsonb,$5,$6::jsonb,$7)
       RETURNING *`,
      [
        row.turn_id,
        row.idempotency_key,
        row.action_id,
        JSON.stringify(row.params_json),
        row.status,
        JSON.stringify(row.result_json),
        row.actor_staff_id,
      ],
    );
    const first = result.rows[0];
    return first ? mapRow(first) : null;
  }
}
