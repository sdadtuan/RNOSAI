import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import { CSD_TENANT_ID } from './csd.types';

export type CsdAiInteractionInsert = {
  actor_staff_id: number;
  feature: string;
  prompt_hash?: string;
  context_json?: Record<string, unknown>;
  output_text: string;
  user_action?: 'draft' | 'insert' | 'discard' | 'apply' | 'regenerate';
};

@Injectable()
export class CsdAiRepository implements OnModuleDestroy {
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

  async insert(input: CsdAiInteractionInsert): Promise<string> {
    const res = await this.db.query(
      `INSERT INTO csd_ai_interactions (
         tenant_id, actor_staff_id, feature, prompt_hash, context_json, output_text, user_action
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        CSD_TENANT_ID,
        input.actor_staff_id,
        input.feature,
        input.prompt_hash ?? '',
        input.context_json ?? {},
        input.output_text,
        input.user_action ?? 'draft',
      ],
    );
    return String(res.rows[0].id);
  }
}
