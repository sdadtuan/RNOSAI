import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import { parseSalesKitMode, type SalesKitLlmMode } from './sales-kit-runtime.util';

export type SalesKitRuntimeRow = {
  mode: SalesKitLlmMode;
  updated_by: number | null;
  updated_at: string;
};

@Injectable()
export class SalesKitRuntimeRepository implements OnModuleDestroy {
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
         WHERE table_schema = 'public' AND table_name = 'sales_kit_runtime'
         LIMIT 1`,
      );
      const ok = (result.rowCount ?? result.rows.length) > 0;
      if (ok) this.tableReadyCached = true;
      return ok;
    } catch {
      return false;
    }
  }

  async getRow(): Promise<SalesKitRuntimeRow | null> {
    if (!(await this.tableReady())) return null;
    const result = await this.db.query(`SELECT mode, updated_by, updated_at FROM sales_kit_runtime WHERE id = 1`);
    const row = result.rows[0];
    if (!row) return null;
    const mode = parseSalesKitMode(String(row.mode)) ?? 'off';
    return {
      mode,
      updated_by: row.updated_by == null ? null : Number(row.updated_by),
      updated_at: String(row.updated_at ?? ''),
    };
  }

  async setMode(mode: SalesKitLlmMode, staffId: number | null): Promise<SalesKitRuntimeRow | null> {
    if (!(await this.tableReady())) return null;
    const result = await this.db.query(
      `UPDATE sales_kit_runtime
       SET mode = $1, updated_by = $2, updated_at = NOW()
       WHERE id = 1
       RETURNING mode, updated_by, updated_at`,
      [mode, staffId && staffId > 0 ? staffId : null],
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      mode: parseSalesKitMode(String(row.mode)) ?? 'off',
      updated_by: row.updated_by == null ? null : Number(row.updated_by),
      updated_at: String(row.updated_at ?? ''),
    };
  }
}
