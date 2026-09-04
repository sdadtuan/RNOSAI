import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { randomUUID } from 'crypto';
import { AppConfigService } from '../../config/app-config.service';
import { isMissingRelationError } from '../kpi-hub.memory-store';
import {
  KPI_HUB_DEFAULT_WORKSPACE_ID,
  KPI_HUB_TENANT_ID,
} from '../kpi-hub.types';
import type { HubFactRow } from '../connectors/kpi-hub-connector.port';

export type UpsertFactInput = {
  dictionary_id: string;
  version_id?: string | null;
  period_start: string;
  period_end: string;
  grain?: string;
  scope_hash?: string;
  actual_value: number | null;
  num_value?: number | null;
  den_value?: number | null;
  calculation_status?: HubFactRow['calculation_status'];
  is_blank?: boolean;
};

@Injectable()
export class KpiHubFactsRepository implements OnModuleDestroy {
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

  async upsert(input: UpsertFactInput): Promise<void> {
    const versionId = input.version_id ?? '00000000-0000-0000-0000-000000000000';
    const grain = input.grain ?? 'MONTH';
    const scopeHash = input.scope_hash ?? 'org';

    const existing = await this.db.query(
      `SELECT id FROM crm_kpi_facts
       WHERE dictionary_id = $1::uuid
         AND COALESCE(version_id, '00000000-0000-0000-0000-000000000000'::uuid) = $2::uuid
         AND period_start = $3::date
         AND grain = $4
         AND scope_hash = $5
         AND deleted_at IS NULL`,
      [input.dictionary_id, versionId, input.period_start, grain, scopeHash],
    );

    if (existing.rows.length > 0) {
      await this.db.query(
        `UPDATE crm_kpi_facts SET
           actual_value = $6, num_value = $7, den_value = $8,
           calculation_status = $9, is_blank = $10,
           computed_at = NOW(), updated_at = NOW(), row_version = row_version + 1
         WHERE id = $1::uuid`,
        [
          existing.rows[0].id,
          input.actual_value,
          input.num_value ?? null,
          input.den_value ?? null,
          input.calculation_status ?? 'SUCCESS',
          input.is_blank ?? input.actual_value == null,
        ],
      );
      return;
    }

    await this.db.query(
      `INSERT INTO crm_kpi_facts (
        id, tenant_id, workspace_id, dictionary_id, version_id,
        period_start, period_end, grain, scope_hash,
        actual_value, num_value, den_value, calculation_status,
        is_blank, computed_at, updated_at
      ) VALUES (
        $1::uuid, $2, $3::uuid, $4::uuid, $5::uuid,
        $6::date, $7::date, $8, $9,
        $10, $11, $12, $13,
        $14, NOW(), NOW()
      )`,
      [
        randomUUID(),
        KPI_HUB_TENANT_ID,
        KPI_HUB_DEFAULT_WORKSPACE_ID,
        input.dictionary_id,
        versionId === '00000000-0000-0000-0000-000000000000' ? null : versionId,
        input.period_start,
        input.period_end,
        grain,
        scopeHash,
        input.actual_value,
        input.num_value ?? null,
        input.den_value ?? null,
        input.calculation_status ?? 'SUCCESS',
        input.is_blank ?? input.actual_value == null,
      ],
    );
  }

  async getByCodes(periodStart: string, codes: string[]): Promise<Map<string, HubFactRow>> {
    if (codes.length === 0) return new Map();
    try {
      const res = await this.db.query(
        `SELECT f.*, d.code AS dictionary_code
         FROM crm_kpi_facts f
         JOIN crm_kpi_dictionary d ON d.id = f.dictionary_id
         WHERE f.tenant_id = $1
           AND f.workspace_id = $2::uuid
           AND f.period_start = $3::date
           AND f.scope_hash = 'org'
           AND f.deleted_at IS NULL
           AND d.code = ANY($4::text[])`,
        [KPI_HUB_TENANT_ID, KPI_HUB_DEFAULT_WORKSPACE_ID, periodStart, codes],
      );
      const map = new Map<string, HubFactRow>();
      for (const row of res.rows) {
        const r = row as Record<string, unknown>;
        map.set(String(r.dictionary_code), {
          dictionary_id: String(r.dictionary_id),
          dictionary_code: String(r.dictionary_code),
          version_id: r.version_id != null ? String(r.version_id) : null,
          period_start: String(r.period_start).slice(0, 10),
          period_end: String(r.period_end).slice(0, 10),
          grain: String(r.grain),
          scope_hash: String(r.scope_hash),
          actual_value: r.actual_value != null ? Number(r.actual_value) : null,
          num_value: r.num_value != null ? Number(r.num_value) : null,
          den_value: r.den_value != null ? Number(r.den_value) : null,
          calculation_status: String(r.calculation_status) as HubFactRow['calculation_status'],
          is_blank: Boolean(r.is_blank),
        });
      }
      return map;
    } catch (err) {
      if (isMissingRelationError(err)) return new Map();
      throw err;
    }
  }

  async countForDictionary(dictionaryId: string, periodStart: string): Promise<number> {
    try {
      const res = await this.db.query(
        `SELECT COUNT(*)::int AS c FROM crm_kpi_facts
         WHERE dictionary_id = $1::uuid AND period_start = $2::date AND deleted_at IS NULL`,
        [dictionaryId, periodStart],
      );
      return Number(res.rows[0]?.c ?? 0);
    } catch (err) {
      if (isMissingRelationError(err)) return 0;
      throw err;
    }
  }
}
