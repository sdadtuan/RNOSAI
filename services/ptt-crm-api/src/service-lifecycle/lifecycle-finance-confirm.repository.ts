import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';

export interface LifecycleFinanceConfirmRow {
  id: number;
  lifecycle_id: number;
  staff_id: number | null;
  staff_email: string;
  outstanding_vnd: number;
  ar_pending_vnd: number;
  ar_overdue_vnd: number;
  strict_mode: boolean;
  note: string | null;
  created_at: string;
}

@Injectable()
export class LifecycleFinanceConfirmRepository implements OnModuleDestroy {
  private pool: Pool | null = null;
  private tableReady: Promise<void> | null = null;

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
    this.tableReady = null;
  }

  private ensureTable(): Promise<void> {
    if (!this.tableReady) {
      this.tableReady = this.db
        .query(`
          CREATE TABLE IF NOT EXISTS lifecycle_finance_confirm (
            id BIGSERIAL PRIMARY KEY,
            lifecycle_id BIGINT NOT NULL,
            staff_id BIGINT,
            staff_email TEXT NOT NULL DEFAULT '',
            outstanding_vnd BIGINT NOT NULL DEFAULT 0,
            ar_pending_vnd BIGINT NOT NULL DEFAULT 0,
            ar_overdue_vnd BIGINT NOT NULL DEFAULT 0,
            strict_mode BOOLEAN NOT NULL DEFAULT FALSE,
            note TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
          CREATE INDEX IF NOT EXISTS idx_lifecycle_finance_confirm_lc
            ON lifecycle_finance_confirm (lifecycle_id, created_at DESC);
        `)
        .then(() => undefined)
        .catch((error: unknown) => {
          this.tableReady = null;
          throw error;
        });
    }
    return this.tableReady;
  }

  async insertConfirm(input: {
    lifecycleId: number;
    staffId?: number | null;
    staffEmail: string;
    outstandingVnd: number;
    arPendingVnd: number;
    arOverdueVnd: number;
    strictMode: boolean;
    note?: string | null;
  }): Promise<LifecycleFinanceConfirmRow> {
    await this.ensureTable();
    const result = await this.db.query(
      `INSERT INTO lifecycle_finance_confirm
       (lifecycle_id, staff_id, staff_email, outstanding_vnd, ar_pending_vnd, ar_overdue_vnd, strict_mode, note)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        input.lifecycleId,
        input.staffId ?? null,
        input.staffEmail,
        input.outstandingVnd,
        input.arPendingVnd,
        input.arOverdueVnd,
        input.strictMode,
        input.note ?? null,
      ],
    );
    return this.mapRow(result.rows[0] as Record<string, unknown>);
  }

  async listForLifecycle(
    lifecycleId: number,
    limit = 20,
  ): Promise<LifecycleFinanceConfirmRow[]> {
    await this.ensureTable();
    const result = await this.db.query(
      `SELECT * FROM lifecycle_finance_confirm
       WHERE lifecycle_id = $1
       ORDER BY created_at DESC, id DESC
       LIMIT $2`,
      [lifecycleId, limit],
    );
    return (result.rows as Array<Record<string, unknown>>).map((row) => this.mapRow(row));
  }

  private mapRow(row: Record<string, unknown>): LifecycleFinanceConfirmRow {
    return {
      id: Number(row.id),
      lifecycle_id: Number(row.lifecycle_id),
      staff_id: row.staff_id != null ? Number(row.staff_id) : null,
      staff_email: String(row.staff_email ?? ''),
      outstanding_vnd: Number(row.outstanding_vnd ?? 0),
      ar_pending_vnd: Number(row.ar_pending_vnd ?? 0),
      ar_overdue_vnd: Number(row.ar_overdue_vnd ?? 0),
      strict_mode: row.strict_mode === true,
      note: row.note != null ? String(row.note) : null,
      created_at: String(row.created_at ?? ''),
    };
  }
}
