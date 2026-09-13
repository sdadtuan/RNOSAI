import { Inject, Injectable, OnModuleDestroy, Optional } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import type { MagnificFlowDetail } from './cp-magnific-http.util';
import { CpMagnificFlowsAdapter } from './cp-magnific-flows.adapter';

export const CP_MAGNIFIC_FLOW_CACHE_QUERY = 'CP_MAGNIFIC_FLOW_CACHE_QUERY';

export type CachedMagnificFlow = {
  sqid: string;
  name: string;
  inputs_schema_json: unknown;
  total_cost: number | null;
  fetched_at: Date;
  expires_at: Date;
};

export interface CpMagnificFlowCacheQueryPort {
  query(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: Record<string, unknown>[]; rowCount?: number | null }>;
}

@Injectable()
export class CpMagnificFlowCacheRepository implements CpMagnificFlowCacheQueryPort, OnModuleDestroy {
  private pool: Pool | null = null;

  constructor(private readonly config: AppConfigService) {}

  private get db(): Pool {
    if (!this.pool) this.pool = new Pool({ connectionString: this.config.databaseUrl });
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
export class CpMagnificFlowCacheService {
  constructor(
    @Inject(CP_MAGNIFIC_FLOW_CACHE_QUERY) private readonly db: CpMagnificFlowCacheQueryPort,
    @Optional() private readonly flows?: CpMagnificFlowsAdapter,
  ) {}

  async get(sqid: string, env: NodeJS.ProcessEnv = process.env): Promise<CachedMagnificFlow | null> {
    const id = String(sqid ?? '').trim();
    if (!id) return null;
    const result = await this.db.query(
      `SELECT sqid, name, inputs_schema_json, total_cost, fetched_at, expires_at
         FROM crm_cp_magnific_flow_cache
        WHERE sqid = $1 AND expires_at > now()
        LIMIT 1`,
      [id],
    );
    const row = result.rows[0];
    if (!row) return null;
    return mapCachedRow(row);
  }

  async upsert(detail: MagnificFlowDetail, ttlSec?: number, env: NodeJS.ProcessEnv = process.env): Promise<void> {
    const ttl = resolveCacheTtlSec(ttlSec, env);
    await this.db.query(
      `INSERT INTO crm_cp_magnific_flow_cache (
         sqid, name, inputs_schema_json, total_cost, fetched_at, expires_at
       ) VALUES (
         $1, $2, $3::jsonb, $4, now(), now() + ($5::int * interval '1 second')
       )
       ON CONFLICT (sqid) DO UPDATE SET
         name = EXCLUDED.name,
         inputs_schema_json = EXCLUDED.inputs_schema_json,
         total_cost = EXCLUDED.total_cost,
         fetched_at = now(),
         expires_at = EXCLUDED.expires_at`,
      [
        detail.sqid,
        detail.name,
        JSON.stringify(detail.inputs),
        detail.total_cost,
        ttl,
      ],
    );
  }

  async getOrFetch(sqid: string, env: NodeJS.ProcessEnv = process.env): Promise<MagnificFlowDetail> {
    const cached = await this.get(sqid, env);
    if (cached) {
      return {
        sqid: cached.sqid,
        name: cached.name,
        inputs: Array.isArray(cached.inputs_schema_json)
          ? cached.inputs_schema_json as MagnificFlowDetail['inputs']
          : [],
        total_cost: cached.total_cost,
      };
    }
    if (!this.flows) {
      throw Object.assign(new Error('flows_adapter_unavailable'), { error: 'flows_adapter_unavailable' });
    }
    const detail = await this.flows.getFlow(sqid);
    await this.upsert(detail, undefined, env);
    return detail;
  }
}

function resolveCacheTtlSec(ttlSec: number | undefined, env: NodeJS.ProcessEnv): number {
  if (ttlSec != null && Number.isFinite(ttlSec) && ttlSec > 0) return Math.trunc(ttlSec);
  const fromEnv = Number(env.MAGNIFIC_FLOW_CACHE_TTL_SEC ?? 900);
  return Number.isFinite(fromEnv) && fromEnv > 0 ? Math.trunc(fromEnv) : 900;
}

function mapCachedRow(row: Record<string, unknown>): CachedMagnificFlow {
  return {
    sqid: String(row.sqid ?? ''),
    name: String(row.name ?? ''),
    inputs_schema_json: row.inputs_schema_json ?? [],
    total_cost: nullableInt(row.total_cost),
    fetched_at: new Date(String(row.fetched_at ?? Date.now())),
    expires_at: new Date(String(row.expires_at ?? Date.now())),
  };
}

function nullableInt(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}
