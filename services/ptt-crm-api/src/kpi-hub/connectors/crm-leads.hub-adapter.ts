import type { Pool } from 'pg';
import type { HubFormulaFilter } from '../formula/kpi-hub-formula.parser';
import { compileFiltersToSql } from '../formula/kpi-hub-formula.compiler';
import type {
  KpiHubConnectorHealth,
  KpiHubConnectorPort,
  KpiHubQueryPeriod,
  KpiHubQueryResult,
} from './kpi-hub-connector.port';

const PAID_SOURCES = ['meta', 'ads', 'facebook', 'paid', 'google', 'tiktok'];

export class CrmLeadsHubAdapter implements KpiHubConnectorPort {
  readonly adapterKey = 'crm_lead';

  constructor(private readonly db: Pool) {}

  async checkHealth(): Promise<KpiHubConnectorHealth> {
    try {
      await this.db.query(`SET LOCAL statement_timeout = '8s'`);
      await this.db.query(`SELECT 1 FROM crm_leads LIMIT 1`);
      return 'HEALTHY';
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
    if (entity !== 'Lead' && entity !== 'Leads') {
      return { value: null, records_scanned: null, health: 'CONNECTION_ERROR', error: 'ENTITY_MISMATCH' };
    }
    const normalizedAgg = agg.toUpperCase().replace('DISTINCTCOUNT', 'DISTINCT_COUNT');
    if (!['COUNT', 'DISTINCT_COUNT', 'SUM', 'AVG'].includes(normalizedAgg)) {
      return { value: null, records_scanned: null, health: 'CONNECTION_ERROR', error: 'AGG_NOT_SUPPORTED' };
    }

    const compiled = compileFiltersToSql(filters, period, 'crm_leads');
    const params = [...compiled.params];
    let idx = params.length + 1;

    for (const filter of filters) {
      if (filter.op === 'eq' && filter.field === 'source_category' && String(filter.value).toLowerCase() === 'paid') {
        compiled.conditions.push(`lower(COALESCE(source, '')) = ANY($${idx}::text[])`);
        params.push(PAID_SOURCES);
        idx += 1;
      }
    }

    const where = compiled.conditions.join(' AND ');
    let valueSql: string;
    if (normalizedAgg === 'DISTINCT_COUNT') {
      valueSql = field ? `COUNT(DISTINCT ${field})::float` : `COUNT(DISTINCT id)::float`;
    } else if (normalizedAgg === 'SUM') {
      valueSql = `COALESCE(SUM(${field ?? 'amount'}), 0)::float`;
    } else if (normalizedAgg === 'AVG') {
      valueSql = `AVG(${field ?? 'amount'})::float`;
    } else {
      valueSql = `COUNT(*)::float`;
    }

    const client = await this.db.connect();
    try {
      await client.query(`SET LOCAL statement_timeout = '8s'`);
      const result = await client.query<{ value: string; scanned: string }>(
        `SELECT ${valueSql} AS value, COUNT(*)::float AS scanned FROM crm_leads WHERE ${where}`,
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
