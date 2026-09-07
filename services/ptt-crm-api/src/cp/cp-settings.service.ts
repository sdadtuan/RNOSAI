import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import { CP_TENANT_ID } from './cp-audit.repository';

export const CP_SETTINGS_QUERY = 'CP_SETTINGS_QUERY';

const MODEL_FIELDS = new Set([
  'id',
  'max_res',
  'max_duration_sec',
  'cap_per_job',
  'region',
  'fallback_id',
]);
const SECRET_FIELDS = new Set([
  'api_key',
  'secret',
  'token',
  'password',
  'credentials',
]);
const PATCH_FIELDS = [
  'locale',
  'timezone',
  'default_brand_kit_id',
  'retention_days',
  'signed_url_ttl_min',
  'restore_days',
  'legal_hold',
  'soft_alert_pct',
  'hard_cap_pct',
  'high_cost_threshold',
  'concurrent_slots',
  'watermark_draft',
  'ai_enabled',
  'publish_native',
  'models_json',
  'policy_json',
] as const;

export interface CpSettingsQueryPort {
  query(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: Record<string, unknown>[]; rowCount?: number | null }>;
}

export type CpSettingsPatch = Partial<
  Record<(typeof PATCH_FIELDS)[number], unknown>
>;

@Injectable()
export class CpSettingsRepository
  implements CpSettingsQueryPort, OnModuleDestroy
{
  private pool: Pool | null = null;

  constructor(private readonly config: AppConfigService) {}

  private get db(): Pool {
    if (!this.pool) {
      this.pool = new Pool({ connectionString: this.config.databaseUrl });
    }
    return this.pool;
  }

  query(sql: string, params?: unknown[]) {
    return this.db.query(sql, params);
  }

  onModuleDestroy(): void {
    void this.pool?.end();
    this.pool = null;
  }
}

@Injectable()
export class CpSettingsService {
  constructor(
    @Inject(CP_SETTINGS_QUERY) private readonly db: CpSettingsQueryPort,
  ) {}

  async get(): Promise<Record<string, unknown> | null> {
    const result = await this.db.query(
      `SELECT *
         FROM crm_cp_settings
        WHERE tenant_id = $1
        LIMIT 1`,
      [CP_TENANT_ID],
    );
    return sanitizeSettings(result.rows[0] ?? null);
  }

  async patch(
    input: CpSettingsPatch,
    updatedByStaffId: number | null = null,
  ): Promise<Record<string, unknown> | null> {
    const params: unknown[] = [];
    const sets: string[] = [];

    for (const field of PATCH_FIELDS) {
      if (!Object.prototype.hasOwnProperty.call(input, field)) continue;
      let value = input[field];
      if (field === 'models_json') value = sanitizeModels(value);
      if (field === 'policy_json') value = stripSecrets(value);
      params.push(value);
      const cast = field === 'default_brand_kit_id'
        ? '::uuid'
        : field === 'models_json' || field === 'policy_json'
          ? '::jsonb'
          : '';
      sets.push(`${field} = $${params.length}${cast}`);
    }

    if (sets.length === 0) return this.get();

    params.push(updatedByStaffId, CP_TENANT_ID);
    const result = await this.db.query(
      `UPDATE crm_cp_settings
          SET ${sets.join(', ')},
              updated_at = now(),
              updated_by_staff_id = $${params.length - 1}
        WHERE tenant_id = $${params.length}
        RETURNING *`,
      params,
    );
    return sanitizeSettings(result.rows[0] ?? null);
  }
}

function sanitizeSettings(
  row: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (!row) return null;
  return {
    ...row,
    models_json: stripSecrets(row.models_json),
    policy_json: stripSecrets(row.policy_json),
  };
}

function sanitizeModels(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isRecord)
    .map((model) => Object.fromEntries(
      Object.entries(model).filter(([key]) => MODEL_FIELDS.has(key)),
    ));
}

function stripSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripSecrets);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !SECRET_FIELDS.has(key.toLowerCase()))
      .map(([key, item]) => [key, stripSecrets(item)]),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
