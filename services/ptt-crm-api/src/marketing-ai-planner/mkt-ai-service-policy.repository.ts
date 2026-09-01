import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import type { PlannerPolicySnap } from './mkt-ai-planner-allow.util';

export type MktAiServicePolicyPatch = Partial<Pick<PlannerPolicySnap, 'rollout' | 'enabled'>>;

@Injectable()
export class MktAiServicePolicyRepository implements OnModuleDestroy {
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

  async getPolicy(slug: string): Promise<PlannerPolicySnap | null> {
    const { rows } = await this.db.query(
      `SELECT rollout, enabled FROM mkt_ai_service_policy WHERE service_slug = $1`,
      [slug],
    );
    if (!rows[0]) return null;
    return { rollout: rows[0].rollout, enabled: rows[0].enabled };
  }

  async upsertPolicy(
    slug: string,
    patch: MktAiServicePolicyPatch,
    actor: string,
  ): Promise<PlannerPolicySnap> {
    const rollout = patch.rollout ?? 'off';
    const enabled = patch.enabled ?? true;
    const { rows } = await this.db.query(
      `INSERT INTO mkt_ai_service_policy (service_slug, rollout, enabled, updated_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (service_slug) DO UPDATE SET
         rollout = EXCLUDED.rollout,
         enabled = EXCLUDED.enabled,
         updated_at = now(),
         updated_by = EXCLUDED.updated_by
       RETURNING rollout, enabled`,
      [slug, rollout, enabled, actor],
    );
    return { rollout: rows[0].rollout, enabled: rows[0].enabled };
  }
}
