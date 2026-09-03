import type { Pool } from 'pg';
import type { KpiFormulaAst } from '../formula/kpi-type-formula.parser';
import type {
  KpiTypeDataSourceAdapter,
  KpiTypePreviewPeriod,
  KpiTypePreviewResult,
} from './kpi-type-connector.port';

const PAID_SOURCES = ['meta', 'ads', 'facebook', 'paid', 'google', 'tiktok'];

export class CrmLeadKpiTypeAdapter implements KpiTypeDataSourceAdapter {
  readonly adapterKey = 'crm_lead';

  constructor(private readonly db: Pool) {}

  async checkHealth() {
    try {
      await this.db.query(`SET LOCAL statement_timeout = '8s'`);
      await this.db.query(`SELECT 1 FROM crm_leads LIMIT 1`);
      return 'HEALTHY' as const;
    } catch {
      return 'CONNECTION_ERROR' as const;
    }
  }

  async preview(ast: KpiFormulaAst, period: KpiTypePreviewPeriod): Promise<KpiTypePreviewResult> {
    if (ast.entity !== 'Lead') {
      return { value: null, records_scanned: null, health: 'CONNECTION_ERROR', error: 'ENTITY_MISMATCH' };
    }
    if (ast.aggregation !== 'COUNT' && ast.aggregation !== 'DISTINCT_COUNT') {
      return { value: null, records_scanned: null, health: 'CONNECTION_ERROR', error: 'AGG_NOT_SUPPORTED' };
    }

    const conditions: string[] = ['1=1'];
    const params: unknown[] = [];
    let idx = 1;

    for (const filter of ast.filters) {
      if (filter.op === 'in_period' && (filter.field === 'created_at' || filter.field === 'date')) {
        conditions.push(`created_at >= $${idx} AND created_at < $${idx + 1}`);
        params.push(period.from.toISOString(), period.to.toISOString());
        idx += 2;
        continue;
      }
      if (filter.op === 'eq' && (filter.field === 'lifecycle_stage' || filter.field === 'status')) {
        conditions.push(`lower(status) = lower($${idx})`);
        params.push(filter.value ?? '');
        idx += 1;
        continue;
      }
      if (filter.op === 'eq' && filter.field === 'source') {
        conditions.push(`lower(COALESCE(source, '')) = lower($${idx})`);
        params.push(filter.value ?? '');
        idx += 1;
        continue;
      }
      if (filter.op === 'eq' && filter.field === 'source_category' && String(filter.value).toLowerCase() === 'paid') {
        conditions.push(`lower(COALESCE(source, '')) = ANY($${idx}::text[])`);
        params.push(PAID_SOURCES);
        idx += 1;
      }
    }

    const where = conditions.join(' AND ');
    const valueSql =
      ast.aggregation === 'DISTINCT_COUNT'
        ? `COUNT(DISTINCT id)::float`
        : `COUNT(*)::float`;

    const client = await this.db.connect();
    try {
      await client.query(`SET LOCAL statement_timeout = '8s'`);
      const result = await client.query<{ value: string; scanned: string }>(
        `SELECT ${valueSql} AS value, COUNT(*)::float AS scanned
         FROM crm_leads
         WHERE ${where}`,
        params,
      );
      const value = Number(result.rows[0]?.value ?? 0);
      const scanned = Number(result.rows[0]?.scanned ?? 0);
      return {
        value: Number.isFinite(value) ? value : 0,
        records_scanned: Number.isFinite(scanned) ? scanned : 0,
        health: 'HEALTHY',
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
