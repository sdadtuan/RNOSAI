import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import { todayYmd } from '../finance/finance-metrics.util';
import { DealScoreContextRepository } from './deal-score-context.repository';
import { NlQueryExecutionResult } from './nl-query.types';
import { RenewalContractContextRepository } from './renewal-contract-context.repository';

function formatYmd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function daysAgoYmd(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return formatYmd(date);
}

const META_FILTER = `(
  NULLIF(BTRIM(COALESCE(utm_campaign, '')), '') IS NOT NULL
  OR NULLIF(BTRIM(COALESCE(meta_json->>'campaign_id', '')), '') IS NOT NULL
  OR NULLIF(BTRIM(COALESCE(meta_json->>'facebook_campaign_id', '')), '') IS NOT NULL
  OR lower(COALESCE(meta_json->>'utm_source', '')) LIKE ANY(ARRAY['%meta%', '%facebook%'])
)`;

@Injectable()
export class NlQueryContextRepository implements OnModuleDestroy {
  private pool: Pool | null = null;

  constructor(
    private readonly config: AppConfigService,
    private readonly deals: DealScoreContextRepository,
    private readonly renewals: RenewalContractContextRepository,
  ) {}

  private get db(): Pool {
    if (!this.pool) this.pool = new Pool({ connectionString: this.config.databaseUrl });
    return this.pool;
  }

  onModuleDestroy(): void {
    void this.pool?.end();
    this.pool = null;
  }

  async executeSqliteIntent(intentId: string): Promise<NlQueryExecutionResult> {
    switch (intentId) {
      case 'leads_new_7d':
        return this.countLeads('7 ngày', daysAgoYmd(6), todayYmd());
      case 'leads_new_30d':
        return this.countLeads('30 ngày', daysAgoYmd(29), todayYmd());
      case 'leads_won_30d':
        return this.countLeadsWithFilter('Số lead won', `lower(COALESCE(status, '')) IN ('won','closed_won')`);
      case 'leads_by_channel_30d':
        return this.leadsByChannel();
      case 'leads_meta_30d':
        return this.countLeadsWithFilter('Lead Meta', META_FILTER, '/meta/ads-combined');
      case 'cpl_meta_t30_overview':
        return this.cplMetaOverview();
      case 'revenue_received_7d':
        return this.sumRevenue('7 ngày', daysAgoYmd(6), todayYmd());
      case 'revenue_received_30d':
        return this.sumRevenue('30 ngày', daysAgoYmd(29), todayYmd());
      case 'revenue_trend_12w':
        return this.weeklyTrend('revenue', 12);
      case 'leads_trend_12w':
        return this.weeklyTrend('leads', 12);
      case 'revenue_by_week_8w':
        return this.weeklyTrend('revenue', 8);
      case 'campaign_leads_top_month':
      case 'attribution_drill_paths':
        return this.campaignLeads();
      case 'open_deals_count':
        return this.openDealsCount();
      case 'marketing_spend_current_month':
        return this.marketingSpendCurrentMonth();
      case 'duplicate_leads_30d':
        return this.countLeadsWithFilter('Lead trùng', 'is_duplicate IS TRUE');
      case 'qualified_leads_month':
        return this.qualifiedLeadsMonth();
      case 'renewal_candidates_90d':
        return this.renewalCandidates();
      case 'ops_contracts_expiring_30d':
        return this.renewalCandidates(30);
      case 'leads_qualified_30d':
        return this.countLeadsWithFilter('Lead', `lower(COALESCE(status, '')) = 'qualified'`);
      case 'leads_conversion_rate_30d':
        return this.leadConversionRate();
      case 'leads_unassigned':
        return this.countMetric('Lead chưa phân công', 'owner_id IS NULL');
      case 'leads_stale_7d':
        return this.countMetric(
          'Lead không cập nhật 7 ngày',
          `lower(COALESCE(status, '')) NOT IN ('won','lost','closed_won','closed_lost')
           AND updated_at <= NOW() - INTERVAL '7 days'`,
        );
      case 'ops_deals_stalled_14d':
        return this.stalledDeals();
      case 'ops_payments_overdue':
        return this.overduePayments();
      case 'cpl_by_client_30d':
      case 'revenue_by_client_30d':
      case 'roas_overview_30d':
      case 'roas_meta_30d':
      case 'roas_zalo_30d':
      case 'marketing_spend_by_channel_30d':
      case 'cpl_trend_12w':
      case 'roas_trend_12w':
        return this.performanceIntent(intentId);
      default:
        return { columns: [], rows: [] };
    }
  }

  private async scalar(sql: string, params: unknown[] = []): Promise<number> {
    try {
      const result = await this.db.query(sql, params);
      return Number(result.rows[0]?.value ?? 0);
    } catch {
      return 0;
    }
  }

  private async countLeads(period: string, start: string, end: string): Promise<NlQueryExecutionResult> {
    const count = await this.scalar(
      `SELECT COUNT(*)::int AS value FROM crm_leads
       WHERE is_duplicate IS NOT TRUE AND created_at::date BETWEEN $1::date AND $2::date`,
      [start, end],
    );
    return {
      columns: [
        { key: 'period', label: 'Kỳ', type: 'string' },
        { key: 'count', label: 'Số lead', type: 'number' },
      ],
      rows: [{ period, count }],
    };
  }

  private async countLeadsWithFilter(
    label: string,
    filter: string,
    drillHref?: string,
  ): Promise<NlQueryExecutionResult> {
    const count = await this.scalar(
      `SELECT COUNT(*)::int AS value FROM crm_leads
       WHERE created_at >= CURRENT_DATE - INTERVAL '29 days' AND ${filter}`,
    );
    return {
      columns: [
        { key: 'period', label: 'Kỳ', type: 'string' },
        { key: 'count', label, type: 'number' },
      ],
      rows: [{ period: '30 ngày', count }],
      drill_href: drillHref,
    };
  }

  private async leadsByChannel(): Promise<NlQueryExecutionResult> {
    let rows: Array<Record<string, unknown>> = [];
    try {
      const result = await this.db.query(
        `SELECT COALESCE(NULLIF(BTRIM(channel), ''), NULLIF(BTRIM(meta_json->>'channel'), ''),
                         NULLIF(BTRIM(meta_json->>'utm_source'), ''), 'unknown') AS channel,
                COUNT(*)::int AS lead_count
         FROM crm_leads
         WHERE is_duplicate IS NOT TRUE AND created_at >= CURRENT_DATE - INTERVAL '29 days'
         GROUP BY 1 ORDER BY lead_count DESC, channel ASC LIMIT 20`,
      );
      rows = result.rows;
    } catch {
      rows = [];
    }
    return {
      columns: [
        { key: 'channel', label: 'Kênh', type: 'string' },
        { key: 'lead_count', label: 'Lead', type: 'number' },
      ],
      rows: rows.map((row) => ({ channel: String(row.channel), lead_count: Number(row.lead_count) })),
    };
  }

  private async cplMetaOverview(): Promise<NlQueryExecutionResult> {
    const [spend, leads] = await Promise.all([
      this.scalar(
        `SELECT COALESCE(SUM(spend), 0)::float8 AS value FROM daily_performance
         WHERE performance_date >= date_trunc('month', CURRENT_DATE)`,
      ),
      this.scalar(
        `SELECT COUNT(*)::int AS value FROM crm_leads
         WHERE is_duplicate IS NOT TRUE AND created_at >= CURRENT_DATE - INTERVAL '29 days'
           AND ${META_FILTER}`,
      ),
    ]);
    return {
      columns: [
        { key: 'period', label: 'Kỳ', type: 'string' },
        { key: 'marketing_spend_vnd', label: 'Chi phí MKT tháng', type: 'currency' },
        { key: 'meta_leads', label: 'Lead Meta 30 ngày', type: 'number' },
        { key: 'cpl_vnd', label: 'CPL ước tính', type: 'currency' },
      ],
      rows: [{
        period: 'T-30 / tháng hiện tại',
        marketing_spend_vnd: spend,
        meta_leads: leads,
        cpl_vnd: spend > 0 && leads > 0 ? Math.round((spend / leads) * 100) / 100 : null,
      }],
      drill_href: '/meta/ads-combined',
    };
  }

  private async sumRevenue(period: string, start: string, end: string): Promise<NlQueryExecutionResult> {
    const amount = await this.scalar(
      `SELECT COALESCE(SUM(amount_vnd), 0)::float8 AS value FROM crm_svc_payments
       WHERE status = 'received' AND received_on::date BETWEEN $1::date AND $2::date`,
      [start, end],
    );
    return {
      columns: [
        { key: 'period', label: 'Kỳ', type: 'string' },
        { key: 'amount_vnd', label: 'Doanh thu thu về', type: 'currency' },
      ],
      rows: [{ period, amount_vnd: amount }],
      drill_href: '/crm/financials',
    };
  }

  private async weeklyTrend(kind: 'revenue' | 'leads', weeks: number): Promise<NlQueryExecutionResult> {
    const source =
      kind === 'revenue'
        ? `SELECT date_trunc('week', received_on::date) AS week, SUM(amount_vnd)::float8 AS value
           FROM crm_svc_payments WHERE status = 'received' AND received_on::date >= CURRENT_DATE - ($1 * INTERVAL '1 week')
           GROUP BY 1`
        : `SELECT date_trunc('week', created_at) AS week, COUNT(*)::float8 AS value
           FROM crm_leads WHERE created_at >= CURRENT_DATE - ($1 * INTERVAL '1 week') AND is_duplicate IS NOT TRUE
           GROUP BY 1`;
    let rows: Array<{ week: unknown; value: unknown }> = [];
    try {
      rows = (await this.db.query(`${source} ORDER BY week`, [weeks])).rows;
    } catch {
      rows = [];
    }
    const labels = rows.map((row) => new Date(String(row.week)).toLocaleDateString('vi-VN'));
    const values = rows.map((row) => Number(row.value ?? 0));
    return {
      columns: [
        { key: 'week_label', label: 'Tuần', type: 'string' },
        { key: 'value', label: kind === 'revenue' ? 'Doanh thu ₫' : 'Lead', type: 'number' },
      ],
      rows: labels.map((week_label, index) => ({ week_label, value: values[index] })),
      chart: { type: 'line', labels, series: [{ key: kind, label: kind, values }] },
      drill_href: '/crm/business-dashboard',
    };
  }

  private async campaignLeads(): Promise<NlQueryExecutionResult> {
    let rows: Array<Record<string, unknown>> = [];
    try {
      rows = (await this.db.query(
        `SELECT COALESCE(NULLIF(BTRIM(campaign_id), ''), NULLIF(BTRIM(meta_json->>'campaign_id'), ''), 'unknown') AS campaign_key,
                COUNT(*)::int AS lead_count
         FROM crm_leads WHERE created_at >= date_trunc('month', CURRENT_DATE)
         GROUP BY 1 ORDER BY lead_count DESC LIMIT 10`,
      )).rows;
    } catch {
      rows = [];
    }
    return {
      columns: [
        { key: 'campaign_key', label: 'Campaign', type: 'string' },
        { key: 'lead_count', label: 'Lead', type: 'number' },
      ],
      rows: rows.map((row) => ({
        campaign_key: String(row.campaign_key),
        lead_count: Number(row.lead_count),
        hub_href: '/crm/business-dashboard',
      })),
      drill_href: '/crm/business-dashboard',
    };
  }

  private async openDealsCount(): Promise<NlQueryExecutionResult> {
    const ids = await this.deals.listOpenDealIds(500);
    return {
      columns: [
        { key: 'metric', label: 'Chỉ số', type: 'string' },
        { key: 'count', label: 'Giá trị', type: 'number' },
      ],
      rows: [{ metric: 'Deal đang mở', count: ids.length }],
      drill_href: '/crm/sales',
    };
  }

  private async marketingSpendCurrentMonth(): Promise<NlQueryExecutionResult> {
    const spend = await this.scalar(
      `SELECT COALESCE(SUM(spend), 0)::float8 AS value FROM daily_performance
       WHERE performance_date >= date_trunc('month', CURRENT_DATE)`,
    );
    const now = new Date();
    return {
      columns: [
        { key: 'period', label: 'Tháng', type: 'string' },
        { key: 'marketing_spend_vnd', label: 'Chi phí MKT', type: 'currency' },
        { key: 'source', label: 'Nguồn', type: 'string' },
      ],
      rows: [{ period: `${now.getMonth() + 1}/${now.getFullYear()}`, marketing_spend_vnd: spend, source: 'daily_performance' }],
      drill_href: '/crm/business-dashboard',
    };
  }

  private async qualifiedLeadsMonth(): Promise<NlQueryExecutionResult> {
    const count = await this.scalar(
      `SELECT COUNT(*)::int AS value FROM crm_leads
       WHERE lower(COALESCE(status, '')) = 'qualified' AND created_at >= date_trunc('month', CURRENT_DATE)`,
    );
    return {
      columns: [
        { key: 'period', label: 'Tháng', type: 'string' },
        { key: 'count', label: 'Lead qualified', type: 'number' },
      ],
      rows: [{ period: todayYmd().slice(0, 7), count }],
    };
  }

  private async renewalCandidates(days = 90): Promise<NlQueryExecutionResult> {
    const candidates = await this.renewals.listRenewalCandidates(days, 25);
    return {
      columns: [
        { key: 'contract_id', label: 'HĐ', type: 'number' },
        { key: 'client_name', label: 'Client', type: 'string' },
        { key: 'ends_on', label: 'Hết hạn', type: 'string' },
        { key: 'days_until_end', label: 'Còn (ngày)', type: 'number' },
        { key: 'amount_vnd', label: 'Giá trị', type: 'currency' },
      ],
      rows: candidates.map((candidate) => ({ ...candidate })),
      drill_href: '/crm/renewals',
    };
  }

  private async countMetric(metric: string, where: string): Promise<NlQueryExecutionResult> {
    const count = await this.scalar(`SELECT COUNT(*)::int AS value FROM crm_leads WHERE ${where}`);
    return {
      columns: [
        { key: 'metric', label: 'Chỉ số', type: 'string' },
        { key: 'count', label: 'Giá trị', type: 'number' },
      ],
      rows: [{ metric, count }],
    };
  }

  private async leadConversionRate(): Promise<NlQueryExecutionResult> {
    const result = await this.db.query(
      `SELECT COUNT(*) FILTER (WHERE is_duplicate IS NOT TRUE)::int AS total,
              COUNT(*) FILTER (WHERE is_duplicate IS NOT TRUE
                AND lower(COALESCE(status, '')) IN ('won','closed_won'))::int AS won
       FROM crm_leads WHERE created_at >= CURRENT_DATE - INTERVAL '29 days'`,
    );
    const total = Number(result.rows[0]?.total ?? 0);
    const won = Number(result.rows[0]?.won ?? 0);
    return {
      columns: [
        { key: 'total', label: 'Lead mới', type: 'number' },
        { key: 'won', label: 'Won', type: 'number' },
        { key: 'conversion_rate_pct', label: 'Tỷ lệ', type: 'pct' },
      ],
      rows: [{ total, won, conversion_rate_pct: total ? Math.round((won / total) * 1000) / 10 : null }],
    };
  }

  private async stalledDeals(): Promise<NlQueryExecutionResult> {
    const count = await this.scalar(
      `SELECT COUNT(*)::int AS value FROM crm_cases
       WHERE lower(COALESCE(status, '')) NOT IN ('closed','won','lost')
         AND updated_at <= NOW() - INTERVAL '14 days'`,
    );
    return {
      columns: [{ key: 'count', label: 'Deal treo >14 ngày', type: 'number' }],
      rows: [{ count }],
      drill_href: '/crm/sales',
    };
  }

  private async overduePayments(): Promise<NlQueryExecutionResult> {
    const result = await this.db.query(
      `SELECT COUNT(*)::int AS count, COALESCE(SUM(amount_vnd), 0)::float8 AS amount
       FROM crm_svc_payments WHERE status = 'pending' AND due_on::date < CURRENT_DATE`,
    );
    return {
      columns: [
        { key: 'count', label: 'Khoản quá hạn', type: 'number' },
        { key: 'amount_vnd', label: 'Tổng quá hạn', type: 'currency' },
      ],
      rows: [{ count: Number(result.rows[0]?.count ?? 0), amount_vnd: Number(result.rows[0]?.amount ?? 0) }],
      drill_href: '/crm/financials',
    };
  }

  private async performanceIntent(intentId: string): Promise<NlQueryExecutionResult> {
    try {
      if (intentId === 'cpl_trend_12w' || intentId === 'roas_trend_12w') {
        const result = await this.db.query(
          `SELECT to_char(date_trunc('week', performance_date), 'DD/MM') AS label,
                  SUM(spend)::float8 AS spend, SUM(leads_crm)::float8 AS leads,
                  SUM(conversion_value)::float8 AS revenue
           FROM daily_performance WHERE performance_date >= CURRENT_DATE - INTERVAL '12 weeks'
           GROUP BY date_trunc('week', performance_date) ORDER BY date_trunc('week', performance_date)`,
        );
        const metric = intentId.startsWith('cpl') ? 'cpl' : 'roas';
        const rows = result.rows.map((row) => ({
          label: String(row.label),
          value: metric === 'cpl'
            ? (Number(row.leads) > 0 ? Number(row.spend) / Number(row.leads) : 0)
            : (Number(row.spend) > 0 ? Number(row.revenue) / Number(row.spend) : 0),
        }));
        return {
          columns: [
            { key: 'label', label: 'Tuần', type: 'string' },
            { key: 'value', label: metric.toUpperCase(), type: 'number' },
          ],
          rows,
          chart: {
            type: 'line',
            labels: rows.map((row) => row.label),
            series: [{ key: metric, label: metric.toUpperCase(), values: rows.map((row) => row.value) }],
          },
          drill_href: '/crm/business-dashboard',
        };
      }

      const channel = intentId === 'roas_meta_30d' ? 'meta' : intentId === 'roas_zalo_30d' ? 'zalo' : null;
      const result = await this.db.query(
        `SELECT dp.client_id::text, COALESCE(c.name, c.code, dp.client_id::text) AS client_name,
                dp.channel, SUM(dp.spend)::float8 AS spend, SUM(dp.leads_crm)::float8 AS leads,
                SUM(dp.conversion_value)::float8 AS revenue
         FROM daily_performance dp LEFT JOIN clients c ON c.id = dp.client_id
         WHERE dp.performance_date >= CURRENT_DATE - INTERVAL '29 days'
           AND ($1::text IS NULL OR dp.channel = $1)
         GROUP BY dp.client_id, c.name, c.code, dp.channel ORDER BY SUM(dp.spend) DESC`,
        [channel],
      );
      const rows = result.rows.map((row) => ({
        client_id: String(row.client_id),
        client_name: String(row.client_name),
        channel: String(row.channel),
        spend_vnd: Number(row.spend ?? 0),
        leads: Number(row.leads ?? 0),
        revenue_vnd: Number(row.revenue ?? 0),
        cpl_vnd: Number(row.leads) > 0 ? Number(row.spend) / Number(row.leads) : null,
        roas: Number(row.spend) > 0 ? Number(row.revenue) / Number(row.spend) : null,
      }));
      return {
        columns: [
          { key: 'client_name', label: 'Client', type: 'string' },
          { key: 'revenue_vnd', label: 'Doanh thu', type: 'currency' },
          { key: 'spend_vnd', label: 'Chi phí', type: 'currency' },
          { key: 'leads', label: 'Lead', type: 'number' },
        ],
        rows,
        drill_href: '/crm/business-dashboard',
      };
    } catch {
      return {
        columns: [{ key: 'status', label: 'Trạng thái', type: 'string' }],
        rows: [{ status: 'PG performance chưa sẵn sàng' }],
        drill_href: '/crm/business-dashboard',
      };
    }
  }
}
