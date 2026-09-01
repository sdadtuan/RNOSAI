import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import { CSD_TENANT_ID } from './csd.types';

export type CsdAuditInsert = {
  actor_staff_id: number | null;
  actor_type?: 'user' | 'system' | 'ai' | 'api';
  action: string;
  entity_type: string;
  entity_id: string;
  before_json?: Record<string, unknown> | null;
  after_json?: Record<string, unknown> | null;
  metadata_json?: Record<string, unknown>;
};

@Injectable()
export class CsdAuditRepository implements OnModuleDestroy {
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

  async insert(input: CsdAuditInsert): Promise<void> {
    await this.db.query(
      `INSERT INTO csd_audit_logs (
         tenant_id, actor_type, actor_staff_id, action, entity_type, entity_id,
         before_json, after_json, metadata_json
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        CSD_TENANT_ID,
        input.actor_type ?? 'user',
        input.actor_staff_id,
        input.action,
        input.entity_type,
        input.entity_id,
        input.before_json ?? null,
        input.after_json ?? null,
        input.metadata_json ?? {},
      ],
    );
  }
}
