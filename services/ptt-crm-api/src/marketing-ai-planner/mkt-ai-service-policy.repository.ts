import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import type { PlannerPolicySnap } from './mkt-ai-planner-allow.util';

export type MktAiServicePolicyPatch = Partial<Pick<PlannerPolicySnap, 'rollout' | 'enabled'>>;

export type MktAiServicePolicyRow = PlannerPolicySnap & {
  service_slug: string;
  active_version_id: number | null;
  strict_pilot_quality: boolean;
  updated_at: string;
  updated_by: string;
};

function mapPolicyRow(row: Record<string, unknown>): MktAiServicePolicyRow {
  return {
    service_slug: String(row.service_slug ?? ''),
    rollout: row.rollout as MktAiServicePolicyRow['rollout'],
    enabled: Boolean(row.enabled),
    active_version_id: row.active_version_id != null ? Number(row.active_version_id) : null,
    strict_pilot_quality: Boolean(row.strict_pilot_quality ?? true),
    updated_at: String(row.updated_at ?? ''),
    updated_by: String(row.updated_by ?? ''),
  };
}

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
    const row = await this.getPolicyRow(slug);
    if (!row) return null;
    return { rollout: row.rollout, enabled: row.enabled };
  }

  async getPolicyRow(slug: string): Promise<MktAiServicePolicyRow | null> {
    const { rows } = await this.db.query(
      `SELECT service_slug, rollout, enabled, active_version_id, strict_pilot_quality, updated_at, updated_by
       FROM mkt_ai_service_policy WHERE service_slug = $1`,
      [slug],
    );
    return rows[0] ? mapPolicyRow(rows[0]) : null;
  }

  async listPolicyRows(): Promise<MktAiServicePolicyRow[]> {
    const { rows } = await this.db.query(
      `SELECT service_slug, rollout, enabled, active_version_id, strict_pilot_quality, updated_at, updated_by
       FROM mkt_ai_service_policy
       ORDER BY service_slug`,
    );
    return rows.map((row) => mapPolicyRow(row));
  }

  async setActiveVersionId(slug: string, versionId: number, actor: string): Promise<void> {
    await this.db.query(
      `INSERT INTO mkt_ai_service_policy (service_slug, rollout, enabled, active_version_id, updated_by)
       VALUES ($1, 'off', TRUE, $2, $3)
       ON CONFLICT (service_slug) DO UPDATE SET
         active_version_id = EXCLUDED.active_version_id,
         updated_at = now(),
         updated_by = EXCLUDED.updated_by`,
      [slug, versionId, actor],
    );
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
