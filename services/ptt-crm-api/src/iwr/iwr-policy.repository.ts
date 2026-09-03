import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import { IWR_TENANT_ID } from './iwr.types';
import type { IwrRecipientPolicyRules } from './iwr-recipient.util';

@Injectable()
export class IwrPolicyRepository implements OnModuleDestroy {
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

  async getActivePolicy(): Promise<IwrRecipientPolicyRules | null> {
    const res = await this.db.query(
      `SELECT rules_json FROM iwr_recipient_policies
        WHERE tenant_id = $1 AND active = TRUE
        ORDER BY created_at DESC LIMIT 1`,
      [IWR_TENANT_ID],
    );
    const row = res.rows[0];
    if (!row) return null;
    const rules = row.rules_json as Record<string, unknown>;
    return {
      allow_bcc: Boolean(rules.allow_bcc),
      cc_mode: rules.cc_mode === 'open' ? 'open' : 'w1',
    };
  }
}
