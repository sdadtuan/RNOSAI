import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';

export const CP_TENANT_ID = 'PTT';

export type CpAuditInsert = {
  actor_id: number | null;
  action: string;
  resource_type: string;
  resource_id?: string | null;
  payload_json?: Record<string, unknown> | null;
  ip?: string | null;
};

export type CpAuditQueryPort = {
  query(sql: string, params?: unknown[]): Promise<unknown>;
};

@Injectable()
export class CpAuditRepository implements OnModuleDestroy {
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

  async insert(input: CpAuditInsert, query: CpAuditQueryPort = this.db): Promise<void> {
    await query.query(
      `INSERT INTO crm_cp_activity (
         tenant_id, actor_id, action, resource_type, resource_id, payload_json, ip
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        CP_TENANT_ID,
        input.actor_id,
        input.action,
        input.resource_type,
        input.resource_id ?? null,
        input.payload_json ?? null,
        input.ip ?? null,
      ],
    );
  }
}
