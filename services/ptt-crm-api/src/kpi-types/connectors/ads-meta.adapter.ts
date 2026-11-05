import type { Pool } from 'pg';
import type { KpiFormulaAst } from '../formula/kpi-type-formula.parser';
import type {
  KpiTypeDataSourceAdapter,
  KpiTypePreviewPeriod,
  KpiTypePreviewResult,
} from './kpi-type-connector.port';
import type { KpiTypeSourceHealth } from '../kpi-types.types';

const STALE_MS = 48 * 60 * 60 * 1000;

export class AdsMetaKpiTypeAdapter implements KpiTypeDataSourceAdapter {
  readonly adapterKey = 'ads_meta';

  constructor(private readonly db: Pool) {}

  async checkHealth(): Promise<KpiTypeSourceHealth> {
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

  async preview(ast: KpiFormulaAst, period: KpiTypePreviewPeriod): Promise<KpiTypePreviewResult> {
    if (ast.entity !== 'AdSpend') {
      return { value: null, records_scanned: null, health: 'CONNECTION_ERROR', error: 'ENTITY_MISMATCH' };
    }

    const health = await this.checkHealth();
    if (health === 'CONNECTION_ERROR') {
      return { value: null, records_scanned: null, health, error: 'CONNECTION_ERROR' };
    }

    const agg =
      ast.aggregation === 'AVG'
        ? 'AVG(spend)'
        : ast.aggregation === 'COUNT' || ast.aggregation === 'DISTINCT_COUNT'
          ? 'COUNT(*)'
          : 'SUM(spend)';

    const client = await this.db.connect();
    try {
      await client.query(`SET LOCAL statement_timeout = '8s'`);
      const result = await client.query<{ value: string | null; scanned: string }>(
        `SELECT ${agg}::float AS value, COUNT(*)::float AS scanned
         FROM daily_performance
         WHERE performance_date >= $1::date AND performance_date < $2::date`,
        [period.from.toISOString().slice(0, 10), period.to.toISOString().slice(0, 10)],
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
