import type { Pool } from 'pg';
import type { HubFormulaFilter } from '../formula/kpi-hub-formula.parser';
import { compileFiltersToSql } from '../formula/kpi-hub-formula.compiler';
import type {
  KpiHubConnectorHealth,
  KpiHubConnectorPort,
  KpiHubQueryPeriod,
  KpiHubQueryResult,
} from './kpi-hub-connector.port';

const STALE_MS = 48 * 60 * 60 * 1000;

export class MetaAdsHubAdapter implements KpiHubConnectorPort {
  readonly adapterKey = 'ads_meta';

  constructor(private readonly db: Pool) {}

  async checkHealth(): Promise<KpiHubConnectorHealth> {
    try {
      const result = await this.db.query<{ max: string | null }>(
        `SELECT MAX(synced_at)::text AS max FROM daily_performance`,
      );
      const raw = result.rows[0]?.max;
      if (!raw) return 'STALE';
      const synced = new Date(raw);
      if (Number.isNaN(synced.getTime())) return 'STALE';
      return Date.now() - synced.getTime() > STALE_MS ? 'STALE' : 'HEALTHY';
    } catch {
      return 'CONNECTION_ERROR';
    }
  }

  async query(
    entity: string,
    agg: string,
    field: string | undefined,
    filters: HubFormulaFilter[],
    period: KpiHubQueryPeriod,
  ): Promise<KpiHubQueryResult> {
    if (entity !== 'AdInsights' && entity !== 'AdSpend') {
      return { value: null, records_scanned: null, health: 'CONNECTION_ERROR', error: 'ENTITY_MISMATCH' };
    }

    const health = await this.checkHealth();
    if (health === 'CONNECTION_ERROR') {
      return { value: null, records_scanned: null, health, error: 'CONNECTION_ERROR' };
    }

    const normalizedAgg = agg.toUpperCase();
    const aggSql =
      normalizedAgg === 'AVG'
        ? 'AVG(spend)'
        : normalizedAgg === 'COUNT' || normalizedAgg === 'DISTINCT_COUNT'
          ? 'COUNT(*)'
          : 'SUM(spend)';

    const compiled = compileFiltersToSql(filters, period, 'daily_performance');
    const dateCond = `performance_date >= $${compiled.params.length + 1}::date AND performance_date < $${compiled.params.length + 2}::date`;
    const where = [...compiled.conditions, dateCond].join(' AND ');
    const params = [
      ...compiled.params,
      period.from.toISOString().slice(0, 10),
      period.to.toISOString().slice(0, 10),
    ];

    const client = await this.db.connect();
    try {
      await client.query(`SET LOCAL statement_timeout = '8s'`);
      const result = await client.query<{ value: string | null; scanned: string }>(
        `SELECT ${aggSql}::float AS value, COUNT(*)::float AS scanned
         FROM daily_performance WHERE ${where}`,
        params,
      );
      const value = Number(result.rows[0]?.value ?? 0);
      const scanned = Number(result.rows[0]?.scanned ?? 0);
      return {
        value: Number.isFinite(value) ? value : 0,
        records_scanned: Number.isFinite(scanned) ? scanned : 0,
        health,
      };
    } catch (err) {
      return {
        value: null,
        records_scanned: null,
        health: 'CONNECTION_ERROR',
        error: err instanceof Error ? err.message : 'CONNECTION_ERROR',
      };
    } finally {
      client.release();
    }
  }
}
