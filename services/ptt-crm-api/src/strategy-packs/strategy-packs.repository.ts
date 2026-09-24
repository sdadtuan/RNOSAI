import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import { INDUSTRY_PACK_SEEDS, SERVICE_PACK_SEEDS } from './strategy-pack.seed';

export type PackKind = 'industry' | 'service';

export type StrategyPackRow = {
  key: string;
  name_vi: string;
  journey_focus: string | null;
  marketing_priorities: string | null;
  defaults_json: Record<string, unknown>;
  is_active: boolean;
  version: number;
  updated_at: string | null;
};

@Injectable()
export class StrategyPacksRepository implements OnModuleInit, OnModuleDestroy {
  private pool: Pool | null = null;

  constructor(private readonly config: AppConfigService) {}

  private get db(): Pool {
    if (!this.pool) this.pool = new Pool({ connectionString: this.config.databaseUrl });
    return this.pool;
  }

  onModuleDestroy(): void {
    void this.pool?.end();
    this.pool = null;
  }

  async onModuleInit(): Promise<void> {
    await this.ensureSchema();
  }

  async ensureSchema(): Promise<void> {
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS strategy_industry_packs (
        id BIGSERIAL PRIMARY KEY,
        key VARCHAR(64) NOT NULL UNIQUE,
        name_vi TEXT NOT NULL DEFAULT '',
        journey_focus TEXT NOT NULL DEFAULT '',
        marketing_priorities TEXT NOT NULL DEFAULT '',
        defaults_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        version INT NOT NULL DEFAULT 1,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS strategy_service_packs (
        id BIGSERIAL PRIMARY KEY,
        key VARCHAR(64) NOT NULL UNIQUE,
        name_vi TEXT NOT NULL DEFAULT '',
        defaults_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        version INT NOT NULL DEFAULT 1,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS crm_marketing_plan_growth_exports (
        id BIGSERIAL PRIMARY KEY,
        plan_id BIGINT NOT NULL,
        version INT NOT NULL,
        filename TEXT NOT NULL,
        storage_path TEXT NOT NULL,
        coverage JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_by TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (plan_id, version)
      );
    `);
    await this.db.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'crm_marketing_plans'
        ) THEN
          ALTER TABLE crm_marketing_plans
            ADD COLUMN IF NOT EXISTS growth_sections JSONB,
            ADD COLUMN IF NOT EXISTS industry_pack_key VARCHAR(64),
            ADD COLUMN IF NOT EXISTS service_pack_key VARCHAR(64);
        END IF;
        IF EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'service_deliveries'
        ) THEN
          ALTER TABLE service_deliveries
            ADD COLUMN IF NOT EXISTS industry_pack_key VARCHAR(64),
            ADD COLUMN IF NOT EXISTS service_pack_key VARCHAR(64);
        END IF;
        IF EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'crm_service_lifecycle'
        ) THEN
          ALTER TABLE crm_service_lifecycle
            ADD COLUMN IF NOT EXISTS industry_pack_key VARCHAR(64),
            ADD COLUMN IF NOT EXISTS service_pack_key VARCHAR(64);
        END IF;
      END $$;
    `);
    for (const pack of INDUSTRY_PACK_SEEDS) {
      await this.db.query(
        `INSERT INTO strategy_industry_packs
           (key, name_vi, journey_focus, marketing_priorities, defaults_json, is_active, version)
         VALUES ($1, $2, $3, $4, $5::jsonb, TRUE, 1)
         ON CONFLICT (key) DO NOTHING`,
        [pack.key, pack.name_vi, pack.journey_focus, pack.marketing_priorities, JSON.stringify(pack.defaults_json)],
      );
    }
    for (const pack of SERVICE_PACK_SEEDS) {
      await this.db.query(
        `INSERT INTO strategy_service_packs (key, name_vi, defaults_json, is_active, version)
         VALUES ($1, $2, $3::jsonb, TRUE, 1)
         ON CONFLICT (key) DO NOTHING`,
        [pack.key, pack.name_vi, JSON.stringify(pack.defaults_json)],
      );
    }
  }

  async listPacks(kind: PackKind, activeOnly: boolean): Promise<StrategyPackRow[]> {
    const table = kind === 'industry' ? 'strategy_industry_packs' : 'strategy_service_packs';
    const extra = kind === 'industry' ? 'journey_focus, marketing_priorities,' : '';
    const where = activeOnly ? 'WHERE is_active = TRUE' : '';
    const result = await this.db.query(
      `SELECT key, name_vi, ${extra} defaults_json, is_active, version, updated_at
       FROM ${table} ${where} ORDER BY key ASC`,
    );
    return result.rows.map((row) => this.mapRow(row, kind));
  }

  async getPack(kind: PackKind, key: string): Promise<StrategyPackRow | null> {
    const table = kind === 'industry' ? 'strategy_industry_packs' : 'strategy_service_packs';
    const extra = kind === 'industry' ? 'journey_focus, marketing_priorities,' : '';
    const result = await this.db.query(
      `SELECT key, name_vi, ${extra} defaults_json, is_active, version, updated_at
       FROM ${table} WHERE key = $1 LIMIT 1`,
      [key],
    );
    const row = result.rows[0];
    return row ? this.mapRow(row, kind) : null;
  }

  async updatePack(
    kind: PackKind,
    key: string,
    patch: { defaults_json?: Record<string, unknown>; is_active?: boolean; name_vi?: string },
  ): Promise<StrategyPackRow | null> {
    const current = await this.getPack(kind, key);
    if (!current) return null;
    const table = kind === 'industry' ? 'strategy_industry_packs' : 'strategy_service_packs';
    await this.db.query(
      `UPDATE ${table}
       SET defaults_json = $2::jsonb,
           is_active = $3,
           name_vi = $4,
           version = version + 1,
           updated_at = NOW()
       WHERE key = $1`,
      [
        key,
        JSON.stringify(patch.defaults_json ?? current.defaults_json),
        patch.is_active ?? current.is_active,
        patch.name_vi ?? current.name_vi,
      ],
    );
    return this.getPack(kind, key);
  }

  async getPlan(planId: number): Promise<{
    id: number;
    status: string;
    growth_sections: unknown;
    industry_pack_key: string | null;
    service_pack_key: string | null;
  } | null> {
    const result = await this.db.query(
      `SELECT id, status, growth_sections, industry_pack_key, service_pack_key
       FROM crm_marketing_plans WHERE id = $1 LIMIT 1`,
      [planId],
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    if (!row) return null;
    return {
      id: Number(row.id),
      status: String(row.status ?? ''),
      growth_sections: row.growth_sections ?? null,
      industry_pack_key: row.industry_pack_key ? String(row.industry_pack_key) : null,
      service_pack_key: row.service_pack_key ? String(row.service_pack_key) : null,
    };
  }

  async saveGrowth(
    planId: number,
    sections: Record<string, unknown>,
    actor: string,
  ): Promise<void> {
    const industry = sections.industry_pack_key ? String(sections.industry_pack_key) : null;
    const service = sections.service_pack_key ? String(sections.service_pack_key) : null;
    await this.db.query(
      `UPDATE crm_marketing_plans
       SET growth_sections = $2::jsonb,
           industry_pack_key = COALESCE($3, industry_pack_key),
           service_pack_key = COALESCE($4, service_pack_key),
           updated_at = NOW()
       WHERE id = $1`,
      [planId, JSON.stringify({ ...sections, updated_at: new Date().toISOString(), updated_by: actor }), industry, service],
    );
  }

  async setPackKeys(
    planId: number,
    keys: { industry_pack_key?: string | null; service_pack_key?: string | null },
  ): Promise<void> {
    const sets: string[] = [];
    const params: unknown[] = [planId];
    if ('industry_pack_key' in keys) {
      params.push(keys.industry_pack_key || null);
      sets.push(`industry_pack_key = $${params.length}`);
    }
    if ('service_pack_key' in keys) {
      params.push(keys.service_pack_key || null);
      sets.push(`service_pack_key = $${params.length}`);
    }
    if (!sets.length) return;
    sets.push('updated_at = NOW()');
    await this.db.query(`UPDATE crm_marketing_plans SET ${sets.join(', ')} WHERE id = $1`, params);
  }

  async loadGenerateSources(planId: number, lifecycleId: number | null, insightId: number | null) {
    const planResult = await this.db.query(
      `SELECT id, status, name, north_star, objectives, lifecycle_id, growth_sections,
              industry_pack_key, service_pack_key, target_market_prof_json, strategy_framework_json,
              period_label, fiscal_year, audiences
       FROM crm_marketing_plans WHERE id = $1 LIMIT 1`,
      [planId],
    );
    const plan = planResult.rows[0] as Record<string, unknown> | undefined;
    if (!plan) return null;
    const lifecycle = lifecycleId ?? (plan.lifecycle_id != null ? Number(plan.lifecycle_id) : null);
    let lifecycleRow: Record<string, unknown> | null = null;
    if (lifecycle) {
      try {
        const found = await this.db.query(
          `SELECT id, service_slug, industry_pack_key, service_pack_key
           FROM crm_service_lifecycle WHERE id = $1 LIMIT 1`,
          [lifecycle],
        );
        lifecycleRow = (found.rows[0] as Record<string, unknown> | undefined) ?? null;
      } catch {
        lifecycleRow = null;
      }
    }
    let insight: Record<string, unknown> | null = null;
    try {
      if (insightId) {
        const found = await this.db.query(
          `SELECT id, status, statement, observation, interpretation, implication
           FROM crm_research_insights WHERE id = $1 LIMIT 1`,
          [insightId],
        );
        insight = (found.rows[0] as Record<string, unknown> | undefined) ?? null;
      } else if (lifecycle) {
        const found = await this.db.query(
          `SELECT i.id, i.status, i.statement, i.observation, i.interpretation, i.implication
           FROM crm_research_insights i
           JOIN crm_research_projects p ON p.id = i.project_id
           WHERE p.lifecycle_id = $1
           ORDER BY CASE WHEN i.status IN ('approved','approved_internal','approved_client_facing','published') THEN 0 ELSE 1 END,
                    i.id DESC
           LIMIT 1`,
          [lifecycle],
        );
        insight = (found.rows[0] as Record<string, unknown> | undefined) ?? null;
      }
    } catch {
      insight = null;
    }
    let roleKpis: Array<Record<string, unknown>> = [];
    try {
      const found = await this.db.query(
        `SELECT id, kpi_key, kpi_label, target_value, target_unit, form_data
         FROM crm_role_kpi_targets
         WHERE plan_id = $1 AND status <> 'cancelled'`,
        [planId],
      );
      roleKpis = found.rows as Array<Record<string, unknown>>;
    } catch {
      roleKpis = [];
    }
    let campaignNames: string[] = [];
    try {
      const found = await this.db.query(
        `SELECT c.name FROM crm_marketing_plan_campaigns l
         JOIN crm_campaigns c ON c.id = l.campaign_id
         WHERE l.plan_id = $1 AND NULLIF(TRIM(c.name), '') IS NOT NULL`,
        [planId],
      );
      campaignNames = found.rows.map((row) => String(row.name));
    } catch {
      campaignNames = [];
    }
    return { plan, lifecycleId: lifecycle, lifecycle: lifecycleRow, insight, roleKpis, campaignNames };
  }

  async listGrowthExports(planId: number) {
    const result = await this.db.query(
      `SELECT id, plan_id, version, filename, created_at
       FROM crm_marketing_plan_growth_exports
       WHERE plan_id = $1
       ORDER BY version DESC`,
      [planId],
    );
    return result.rows.map((row) => ({
      id: Number(row.id),
      plan_id: Number(row.plan_id),
      version: Number(row.version),
      filename: String(row.filename),
      created_at: row.created_at ? new Date(String(row.created_at)).toISOString() : null,
    }));
  }

  async insertGrowthExport(input: {
    planId: number;
    filename: string;
    storagePath: string;
    coverage: unknown;
    actor: string;
  }) {
    const inserted = await this.db.query(
      `INSERT INTO crm_marketing_plan_growth_exports
         (plan_id, version, filename, storage_path, coverage, created_by)
       VALUES (
         $1,
         COALESCE((SELECT MAX(version) FROM crm_marketing_plan_growth_exports WHERE plan_id = $1), 0) + 1,
         $2, $3, $4::jsonb, $5
       )
       RETURNING id, version, filename`,
      [input.planId, input.filename, input.storagePath, JSON.stringify(input.coverage), input.actor],
    );
    const row = inserted.rows[0] as { id: number; version: number; filename: string };
    return { id: Number(row.id), version: Number(row.version), filename: String(row.filename) };
  }

  async getGrowthExport(planId: number, exportId: number) {
    const result = await this.db.query(
      `SELECT id, filename, storage_path
       FROM crm_marketing_plan_growth_exports
       WHERE plan_id = $1 AND id = $2
       LIMIT 1`,
      [planId, exportId],
    );
    const row = result.rows[0] as { id: number; filename: string; storage_path: string } | undefined;
    if (!row) return null;
    return { id: Number(row.id), filename: String(row.filename), storagePath: String(row.storage_path) };
  }

  async renameGrowthExport(exportId: number, filename: string, storagePath: string) {
    await this.db.query(
      `UPDATE crm_marketing_plan_growth_exports SET filename = $2, storage_path = $3 WHERE id = $1`,
      [exportId, filename, storagePath],
    );
  }

  private mapRow(row: Record<string, unknown>, kind: PackKind): StrategyPackRow {
    return {
      key: String(row.key),
      name_vi: String(row.name_vi ?? ''),
      journey_focus: kind === 'industry' ? String(row.journey_focus ?? '') : null,
      marketing_priorities: kind === 'industry' ? String(row.marketing_priorities ?? '') : null,
      defaults_json: (row.defaults_json ?? {}) as Record<string, unknown>,
      is_active: Boolean(row.is_active),
      version: Number(row.version ?? 1),
      updated_at: row.updated_at ? new Date(String(row.updated_at)).toISOString() : null,
    };
  }
}
