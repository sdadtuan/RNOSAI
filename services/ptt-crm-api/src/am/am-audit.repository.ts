import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';

export const AM_TENANT_ID = 'PTT';

export type AmAuditInsert = {
  actor_staff_id: number | null;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  payload_json?: Record<string, unknown> | null;
};

@Injectable()
export class AmAuditRepository implements OnModuleDestroy {
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

  async insert(input: AmAuditInsert): Promise<void> {
    await this.db.query(
      `INSERT INTO crm_am_audit (
         tenant_id, actor_staff_id, action, entity_type, entity_id, payload_json
       ) VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        AM_TENANT_ID,
        input.actor_staff_id,
        input.action,
        input.entity_type,
        input.entity_id ?? null,
        input.payload_json ?? null,
      ],
    );
  }
}
