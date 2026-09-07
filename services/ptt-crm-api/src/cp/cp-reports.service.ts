import { HttpException, Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import { CpAuditInsert, CpAuditRepository, CP_TENANT_ID } from './cp-audit.repository';
import { FORECAST_ASSUMPTION, forecastCredits } from './cp-forecast.util';
import { kpiOrNull } from './cp-format.util';
import { cpScopeSql, CpScope } from './cp-scope.util';

export const CP_REPORTS_QUERY = 'CP_REPORTS_QUERY';
export const CP_REPORT_SLUGS = [
  'executive',
  'production',
  'credit',
  'performance',
  'governance',
] as const;
export const MISSING_INGEST_SOURCE = 'chưa ingest';
const ICT_TIMEZONE = 'Asia/Ho_Chi_Minh';

export type CpReportSlug = (typeof CP_REPORT_SLUGS)[number];

export type CpSourcedMetric = {
  value: number | null;
  source: string;
  freshness: string | null;
};

export type CpReportQuery = {
  scope: CpScope;
  staffId: number;
  teamIds?: number[];
  from?: string;
  to?: string;
  client?: string;
  lifecycle?: string;
  project?: string;
  channel?: string;
  model?: string;
  template?: string;
  creator?: string;
};

export type CpReportExportInput = {
  slug?: string;
  format?: string;
};

export interface CpReportsQueryPort {
  query(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: Record<string, unknown>[]; rowCount?: number | null }>;
}

@Injectable()
export class CpReportsRepository implements CpReportsQueryPort, OnModuleDestroy {
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
export class CpReportsService {
  constructor(
    @Inject(CP_REPORTS_QUERY) private readonly db: CpReportsQueryPort,
    private readonly audit: CpAuditRepository,
  ) {}

  async get(slug: string, query: CpReportQuery): Promise<Record<string, unknown>> {
    const reportSlug = parseSlug(slug);
    const ingest = await this.loadIngest(query);
    if (reportSlug === 'performance') return this.performance(ingest);
    if (reportSlug === 'executive') return this.executive(query, ingest);
    if (reportSlug === 'production') return this.production(query);
    if (reportSlug === 'credit') return this.credit(query);
    return this.governance(query);
  }

  async export(
    input: CpReportExportInput,
    query: CpReportQuery,
  ): Promise<{ ok: true; slug: CpReportSlug; format: string; body: string }> {
    const slug = parseSlug(input.slug);
    const format = parseFormat(input.format);
    const report = await this.get(slug, query);
    const body = serializeExport(report, format);
    const insert: CpAuditInsert = {
      actor_id: query.staffId > 0 ? query.staffId : null,
      action: 'report_export',
      resource_type: 'report',
      resource_id: slug,
      payload_json: { slug, format },
    };
    await this.audit.insert(insert);
    return { ok: true, slug, format, body };
  }

  private async loadIngest(query: CpReportQuery): Promise<Record<string, unknown>[]> {
    const { scopeSql, params } = bindReportFilters(query);
    const result = await this.db.query(
      `WITH scoped_projects AS (
         SELECT p.* FROM crm_cp_projects p
          WHERE p.tenant_id = '${CP_TENANT_ID}' AND ${scopeSql}
            AND ${clientSql('p')}
       )
       SELECT a.payload_json, a.created_at
         FROM crm_cp_activity a
        WHERE a.tenant_id = '${CP_TENANT_ID}' AND a.action = 'performance_ingest'
          AND ${ictRangeSql('a')}
          AND EXISTS (
            SELECT 1 FROM scoped_projects p
             WHERE p.id::text = a.payload_json->>'project_id'
                OR p.agency_client_id::text = COALESCE(
                     NULLIF(a.payload_json->>'agency_client_id', ''),
                     NULLIF(a.payload_json->>'client', '')
                   )
          )
        ORDER BY a.created_at DESC`,
      params,
    );
    return result.rows;
  }

  private performance(ingest: Record<string, unknown>[]) {
    const mapped = mapIngest(ingest);
    return {
      slug: 'performance' as const,
      metrics: mapped.metrics,
      channels: mapped.channels,
      breakdown: mapped.breakdown,
      funnel: mapped.funnel,
    };
  }

  private async executive(query: CpReportQuery, ingest: Record<string, unknown>[]) {
    const mapped = mapIngest(ingest);
    const { scopeSql, params } = bindReportFilters(query);
    const kpis = await this.db.query(
      `WITH scoped_projects AS (
         SELECT p.* FROM crm_cp_projects p
          WHERE p.tenant_id = '${CP_TENANT_ID}' AND ${scopeSql}
            AND ${clientSql('p')}
       )
       SELECT
         (SELECT NULLIF(COUNT(*), 0)::int
            FROM crm_cp_video_versions v
            JOIN crm_cp_video_drafts d ON d.id = v.draft_id
            JOIN scoped_projects p ON p.id = d.project_id
           WHERE v.approval_status = 'final_approved'
             AND ${ictRangeSql('d')}
         ) AS output_final,
         (SELECT SUM(l.amount)
            FROM crm_cp_credit_ledger l
           WHERE l.tenant_id = '${CP_TENANT_ID}' AND l.kind = 'charge'
             AND ${ictRangeSql('l')}
             AND EXISTS (SELECT 1 FROM scoped_projects p WHERE p.id = l.project_id
               OR (l.project_id IS NULL AND p.agency_client_id = l.agency_client_id))
         ) AS credits_charged,
         (SELECT NULLIF(COUNT(*), 0)::int
            FROM scoped_projects p
           WHERE p.status = 'at_risk'
             AND ${ictRangeSql('p')}
         ) AS at_risk`,
      params,
    );
    const trend = await this.db.query(
      `WITH scoped_projects AS (
         SELECT p.* FROM crm_cp_projects p
          WHERE p.tenant_id = '${CP_TENANT_ID}' AND ${scopeSql}
            AND ${clientSql('p')}
       )
       SELECT day,
              NULLIF(SUM(created), 0)::int AS created,
              NULLIF(SUM(approved), 0)::int AS approved,
              NULLIF(SUM(published), 0)::int AS published
         FROM (
           SELECT (d.created_at AT TIME ZONE '${ICT_TIMEZONE}')::date::text AS day,
                  1 AS created, 0 AS approved, 0 AS published
             FROM crm_cp_video_drafts d
             JOIN scoped_projects p ON p.id = d.project_id
            WHERE ${ictRangeSql('d')}
           UNION ALL
           SELECT (d.created_at AT TIME ZONE '${ICT_TIMEZONE}')::date::text AS day,
                  0, 1, 0
             FROM crm_cp_video_versions v
             JOIN crm_cp_video_drafts d ON d.id = v.draft_id
             JOIN scoped_projects p ON p.id = d.project_id
            WHERE v.approval_status = 'final_approved'
              AND ${ictRangeSql('d')}
           UNION ALL
           SELECT (i.scheduled_at AT TIME ZONE '${ICT_TIMEZONE}')::date::text AS day,
                  0, 0, 1
             FROM crm_cp_publish_items i
             JOIN crm_cp_video_versions v ON v.id = i.video_version_id
             JOIN crm_cp_video_drafts d ON d.id = v.draft_id
             JOIN scoped_projects p ON p.id = d.project_id
            WHERE i.status = 'published'
              AND i.scheduled_at IS NOT NULL
              AND ($1::date IS NULL OR (i.scheduled_at AT TIME ZONE '${ICT_TIMEZONE}') >= $1::date)
              AND ($2::date IS NULL OR (i.scheduled_at AT TIME ZONE '${ICT_TIMEZONE}') < $2::date + INTERVAL '1 day')
         ) series
        GROUP BY day
        ORDER BY day`,
      params,
    );
    const top = await this.db.query(
      `WITH scoped_projects AS (
         SELECT p.* FROM crm_cp_projects p
          WHERE p.tenant_id = '${CP_TENANT_ID}' AND ${scopeSql}
            AND ${clientSql('p')}
       )
       SELECT d.name, v.id::text AS version_id, v.approval_status
         FROM crm_cp_video_versions v
         JOIN crm_cp_video_drafts d ON d.id = v.draft_id
         JOIN scoped_projects p ON p.id = d.project_id
        WHERE v.approval_status = 'final_approved'
          AND ${ictRangeSql('d')}
        ORDER BY d.name, v.version_n DESC
        LIMIT 5`,
      params,
    );
    const health = await this.db.query(
      `SELECT p.id::text, p.name, p.status, p.credit_budget
         FROM crm_cp_projects p
        WHERE p.tenant_id = '${CP_TENANT_ID}' AND ${scopeSql}
          AND ${clientSql('p')}
          AND ${ictRangeSql('p')}
        ORDER BY CASE p.status WHEN 'at_risk' THEN 0 ELSE 1 END, p.name`,
      params,
    );
    const row = kpis.rows[0] ?? {};
    return {
      slug: 'executive' as const,
      kpis: {
        output_final: kpiOrNull(finiteNumber(row.output_final)),
        credits_charged: kpiOrNull(finiteNumber(row.credits_charged)),
        roi: mapped.metrics.roi ?? missingMetric(),
        campaign_health: kpiOrNull(finiteNumber(row.at_risk)),
      },
      trend: trend.rows.map((item) => ({
        day: item.day == null ? null : String(item.day),
        created: kpiOrNull(finiteNumber(item.created)),
        approved: kpiOrNull(finiteNumber(item.approved)),
        published: kpiOrNull(finiteNumber(item.published)),
      })),
      funnel: mapped.funnel,
      top_creative: top.rows.map((item) => ({
        name: item.name == null ? null : String(item.name),
        version_id: item.version_id == null ? null : String(item.version_id),
        approval_status: item.approval_status == null ? null : String(item.approval_status),
      })),
      project_health: health.rows.map((item) => ({
        id: item.id == null ? null : String(item.id),
        name: item.name == null ? null : String(item.name),
        status: item.status == null ? null : String(item.status),
        credit_budget: kpiOrNull(finiteNumber(item.credit_budget)),
      })),
      insights: {
        disclaimer: 'Insight không nhân quả. Không suy diễn hiệu quả ads khi thiếu ingest.',
      },
    };
  }

  private async production(query: CpReportQuery) {
    const { scopeSql, params } = bindReportFilters(query);
    const duration = durationSql('j');
    const queueWait = queueWaitSql('j');
    const scopedJobsCte = `WITH scoped_projects AS (
         SELECT p.* FROM crm_cp_projects p
          WHERE p.tenant_id = '${CP_TENANT_ID}' AND ${scopeSql}
            AND ${clientSql('p')}
       ),
       scoped_jobs AS (
         SELECT j.*, ${duration} AS duration_sec, ${queueWait} AS queue_wait_sec
           FROM crm_cp_render_jobs j
           JOIN crm_cp_video_drafts d ON d.id = j.draft_id
           JOIN scoped_projects p ON p.id = d.project_id
          WHERE ${ictRangeSql('j')}
       )`;
    const jobs = await this.db.query(
      `${scopedJobsCte}
       SELECT
         (SELECT COUNT(*) FILTER (WHERE state = 'completed')::int FROM scoped_jobs) AS completed,
         (SELECT COUNT(*) FILTER (WHERE state = 'failed')::int FROM scoped_jobs) AS failed,
         (SELECT percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_sec)
            FROM scoped_jobs WHERE state = 'completed' AND duration_sec IS NOT NULL) AS render_p95,
         (SELECT percentile_cont(0.95) WITHIN GROUP (ORDER BY queue_wait_sec)
            FROM scoped_jobs WHERE state = 'completed' AND queue_wait_sec IS NOT NULL) AS queue_p95`,
      params,
    );
    const failures = await this.db.query(
      `${scopedJobsCte}
       SELECT j.error_class, COUNT(*)::int AS count,
              COUNT(*) FILTER (WHERE j.attempt > 1 AND j.state = 'completed')::int AS retry_ok
         FROM scoped_jobs j
        WHERE j.error_class IS NOT NULL
        GROUP BY j.error_class
        ORDER BY count DESC`,
      params,
    );
    const heatmap = await this.db.query(
      `${scopedJobsCte}
       SELECT COALESCE(NULLIF(j.model, ''), NULLIF(j.provider, ''), 'stub') AS model,
              (j.created_at AT TIME ZONE '${ICT_TIMEZONE}')::date::text AS day,
              COUNT(*)::int AS count
         FROM scoped_jobs j
        GROUP BY 1, 2
        ORDER BY 2, 1`,
      params,
    );
    const providers = await this.db.query(
      `${scopedJobsCte}
       SELECT COALESCE(NULLIF(j.provider, ''), NULLIF(j.model, ''), 'stub') AS id,
              CASE WHEN COUNT(*) FILTER (WHERE j.state IN ('completed','failed')) = 0 THEN NULL
                   ELSE (COUNT(*) FILTER (WHERE j.state = 'completed')::numeric
                         / NULLIF(COUNT(*) FILTER (WHERE j.state IN ('completed','failed')), 0)) * 100
              END AS success_pct,
              percentile_cont(0.95) WITHIN GROUP (ORDER BY j.duration_sec)
                FILTER (WHERE j.state = 'completed' AND j.duration_sec IS NOT NULL) AS p95_sec
         FROM scoped_jobs j
        GROUP BY 1
        ORDER BY 1`,
      params,
    );
    const row = jobs.rows[0] ?? {};
    const completed = Number(row.completed ?? 0);
    const failed = Number(row.failed ?? 0);
    const attempted = completed + failed;
    return {
      slug: 'production' as const,
      success: attempted > 0 ? completed / attempted : null,
      queue_p95: kpiOrNull(finiteNumber(row.queue_p95)),
      render_p95: kpiOrNull(finiteNumber(row.render_p95)),
      approval_cycle: null,
      heatmap: heatmap.rows.map((item) => ({
        model: item.model == null ? null : String(item.model),
        day: item.day == null ? null : String(item.day),
        count: kpiOrNull(finiteNumber(item.count)),
      })),
      failure_class: failures.rows.map((item) => ({
        error_class: item.error_class == null ? null : String(item.error_class),
        count: finiteNumber(item.count),
        retry_ok: kpiOrNull(finiteNumber(item.retry_ok)),
        recommendation: item.error_class == null ? null : String(item.error_class),
      })),
      provider_health: providers.rows.map((item) => ({
        id: item.id == null ? null : String(item.id),
        success_pct: kpiOrNull(finiteNumber(item.success_pct)),
        p95_sec: kpiOrNull(finiteNumber(item.p95_sec)),
      })),
    };
  }

  private async credit(query: CpReportQuery) {
    const { scopeSql, params } = bindReportFilters(query);
    const ledgerScope = `
       WITH scoped_projects AS (
         SELECT p.* FROM crm_cp_projects p
          WHERE p.tenant_id = '${CP_TENANT_ID}' AND ${scopeSql}
            AND ${clientSql('p')}
       )`;
    const ledgerMatch = `
          AND ${ictRangeSql('l')}
          AND (
            EXISTS (SELECT 1 FROM scoped_projects p WHERE p.id = l.project_id)
            OR (l.project_id IS NULL AND EXISTS (
              SELECT 1 FROM scoped_projects p WHERE p.agency_client_id = l.agency_client_id
            ))
          )`;
    const ledger = await this.db.query(
      `${ledgerScope}
       SELECT l.kind, SUM(l.amount) AS amount
         FROM crm_cp_credit_ledger l
        WHERE l.tenant_id = '${CP_TENANT_ID}'
          ${ledgerMatch}
        GROUP BY l.kind`,
      params,
    );
    const pipeline = await this.db.query(
      `${ledgerScope}
       SELECT COALESCE(NULLIF(l.cost_center, ''), 'gen') AS pipeline, l.kind, SUM(l.amount) AS amount
         FROM crm_cp_credit_ledger l
        WHERE l.tenant_id = '${CP_TENANT_ID}'
          ${ledgerMatch}
        GROUP BY 1, 2
        ORDER BY 1`,
      params,
    );
    const forecastRow = await this.db.query(
      `${ledgerScope}
       SELECT
         (SELECT SUM(b.estimate_credits)
            FROM crm_cp_batch_jobs b
            JOIN scoped_projects p ON p.id = b.project_id
           WHERE b.status NOT IN ('completed', 'cancelled')
         ) AS scheduled_batch_credits,
         (SELECT AVG(l.amount)
            FROM crm_cp_credit_ledger l
           WHERE l.tenant_id = '${CP_TENANT_ID}' AND l.kind = 'charge'
             ${ledgerMatch}
         ) AS historical_avg,
         (SELECT SUM(l.amount)
            FROM crm_cp_credit_ledger l
           WHERE l.tenant_id = '${CP_TENANT_ID}' AND l.kind = 'reserve'
             ${ledgerMatch}
         ) AS reserved`,
      params,
    );
    const sums = sumsByKind(ledger.rows);
    const forecastIn = {
      scheduled_batch_credits: finiteNumber(forecastRow.rows[0]?.scheduled_batch_credits),
      historical_avg: finiteNumber(forecastRow.rows[0]?.historical_avg),
      reserved: finiteNumber(forecastRow.rows[0]?.reserved),
    };
    const forecast = forecastCredits(forecastIn);
    return {
      slug: 'credit' as const,
      used: kpiOrNull(sums.used),
      charged: kpiOrNull(sums.charge),
      reserved: kpiOrNull(sums.reserve),
      released: kpiOrNull(sums.release),
      refunded: kpiOrNull(sums.refund),
      by_pipeline: pipeline.rows,
      forecast: {
        value: forecast.forecast,
        assumption: forecast.assumption || FORECAST_ASSUMPTION,
        parts: forecastIn,
      },
    };
  }

  private async governance(query: CpReportQuery) {
    const { scopeSql, params } = bindReportFilters(query);
    const stats = await this.db.query(
      `WITH scoped_projects AS (
         SELECT p.* FROM crm_cp_projects p
          WHERE p.tenant_id = '${CP_TENANT_ID}' AND ${scopeSql}
            AND ${clientSql('p')}
       )
       SELECT
         (SELECT NULLIF(COUNT(*), 0)::int
            FROM crm_cp_video_versions v
            JOIN crm_cp_video_drafts d ON d.id = v.draft_id
            JOIN scoped_projects p ON p.id = d.project_id
           WHERE v.approval_status = 'brand_approved'
             AND ${ictRangeSql('d')}) AS brand_pass,
         (SELECT NULLIF(COUNT(*), 0)::int
            FROM crm_cp_video_versions v
            JOIN crm_cp_video_drafts d ON d.id = v.draft_id
            JOIN scoped_projects p ON p.id = d.project_id
           WHERE v.qc_status = 'warning'
             AND ${ictRangeSql('d')}) AS qc_warning,
         (SELECT NULLIF(COUNT(*), 0)::int
            FROM crm_cp_assets a
            JOIN scoped_projects p ON p.id = a.project_id
            JOIN crm_cp_asset_rights r ON r.asset_id = a.id
           WHERE r.expiry_on <= (now() AT TIME ZONE '${ICT_TIMEZONE}')::date + 14
             AND a.state <> 'archived'
             AND ${ictRangeSql('a')}) AS rights_14d,
         (SELECT NULLIF(COUNT(*), 0)::int
            FROM crm_cp_activity a
           WHERE a.tenant_id = '${CP_TENANT_ID}'
             AND ${ictRangeSql('a')}
             AND (
               EXISTS (SELECT 1 FROM scoped_projects p
                        WHERE p.id::text = a.payload_json->>'project_id')
               OR (a.resource_type = 'project' AND EXISTS (
                 SELECT 1 FROM scoped_projects p WHERE p.id::text = a.resource_id
               ))
             )) AS audit_rows`,
      params,
    );
    const policy = await this.db.query(
      `SELECT policy_json FROM crm_cp_settings WHERE tenant_id = $1 LIMIT 1`,
      [CP_TENANT_ID],
    );
    const row = stats.rows[0] ?? {};
    return {
      slug: 'governance' as const,
      brand_pass: kpiOrNull(finiteNumber(row.brand_pass)),
      qc_warning: kpiOrNull(finiteNumber(row.qc_warning)),
      rights_14d: kpiOrNull(finiteNumber(row.rights_14d)),
      audit_rows: kpiOrNull(finiteNumber(row.audit_rows)),
      policy: policyOutcome(policy.rows[0]?.policy_json),
      actions: [],
    };
  }
}

function parseSlug(value: string | undefined): CpReportSlug {
  if (value && (CP_REPORT_SLUGS as readonly string[]).includes(value)) {
    return value as CpReportSlug;
  }
  return cpThrow(400, { error: 'unknown_report_slug' });
}

function parseFormat(value: string | undefined): 'csv' | 'xlsx' | 'pdf' {
  if (value === 'csv' || value === 'xlsx' || value === 'pdf') return value;
  return cpThrow(400, { error: 'unknown_export_format' });
}

function missingMetric(source = MISSING_INGEST_SOURCE): CpSourcedMetric {
  return { value: null, source, freshness: null };
}

function finiteNumber(value: unknown): number | null {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function iso(value: unknown): string | null {
  if (value == null || value === '') return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function asObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
  }
  return {};
}

function mapIngest(rows: Record<string, unknown>[]): {
  metrics: { views: CpSourcedMetric; ctr: CpSourcedMetric; roi: CpSourcedMetric };
  channels: Array<CpSourcedMetric & { channel: string }>;
  breakdown: Array<{ key: string; output: number | null; performance: CpSourcedMetric }>;
  funnel: Record<string, number | null> | null;
} {
  if (!rows.length) {
    return {
      metrics: { views: missingMetric(), ctr: missingMetric(), roi: missingMetric() },
      channels: [],
      breakdown: [],
      funnel: null,
    };
  }

  let views: number | null = null;
  let viewsSource = MISSING_INGEST_SOURCE;
  let viewsFreshness: string | null = null;
  let ctr: number | null = null;
  let ctrSource = MISSING_INGEST_SOURCE;
  let ctrFreshness: string | null = null;
  let roi: number | null = null;
  let roiSource = MISSING_INGEST_SOURCE;
  let roiFreshness: string | null = null;
  const channels: Array<CpSourcedMetric & { channel: string }> = [];
  const breakdown: Array<{ key: string; output: number | null; performance: CpSourcedMetric }> = [];
  let funnel: Record<string, number | null> | null = null;

  for (const row of rows) {
    const payload = asObject(row.payload_json);
    const source = String(payload.source ?? 'performance_ingest');
    const freshness = iso(payload.freshness ?? row.created_at);
    const rowViews = finiteNumber(payload.views);
    if (rowViews != null) {
      views = (views ?? 0) + rowViews;
      viewsSource = source;
      viewsFreshness = freshness;
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'ctr')) {
      const rowCtr = finiteNumber(payload.ctr);
      if (rowCtr != null && ctr == null) {
        ctr = rowCtr;
        ctrSource = source;
        ctrFreshness = freshness;
      }
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'roi')) {
      const rowRoi = finiteNumber(payload.roi);
      if (rowRoi != null && roi == null) {
        roi = rowRoi;
        roiSource = source;
        roiFreshness = freshness;
      }
    }
    if (payload.channel != null && payload.channel !== '') {
      channels.push({
        channel: String(payload.channel),
        value: rowViews,
        source,
        freshness,
      });
    }
    const template = payload.template ?? payload.format ?? payload.style;
    if (template != null && template !== '') {
      breakdown.push({
        key: String(template),
        output: finiteNumber(payload.output),
        performance: rowViews == null
          ? missingMetric()
          : { value: rowViews, source, freshness },
      });
    }
    const funnelPayload = asObject(payload.funnel);
    if (Object.keys(funnelPayload).length) {
      funnel = {
        views: finiteNumber(funnelPayload.views ?? payload.views),
        landing: finiteNumber(funnelPayload.landing),
        form: finiteNumber(funnelPayload.form),
        lead: finiteNumber(funnelPayload.lead),
      };
    } else if (payload.landing != null || payload.form != null || payload.lead != null) {
      funnel = {
        views: finiteNumber(payload.views),
        landing: finiteNumber(payload.landing),
        form: finiteNumber(payload.form),
        lead: finiteNumber(payload.lead),
      };
    }
  }

  return {
    metrics: {
      views: {
        value: views,
        source: views == null ? MISSING_INGEST_SOURCE : viewsSource,
        freshness: views == null ? null : viewsFreshness,
      },
      ctr: {
        value: ctr,
        source: ctr == null ? MISSING_INGEST_SOURCE : ctrSource,
        freshness: ctr == null ? null : ctrFreshness,
      },
      roi: {
        value: roi,
        source: roi == null ? MISSING_INGEST_SOURCE : roiSource,
        freshness: roi == null ? null : roiFreshness,
      },
    },
    channels,
    breakdown,
    funnel,
  };
}

function sumsByKind(rows: Record<string, unknown>[]): Record<string, number | null> {
  const sums: Record<string, number | null> = {};
  for (const row of rows) {
    const kind = String(row.kind ?? '');
    sums[kind] = finiteNumber(row.amount);
  }
  const charge = sums.charge ?? null;
  const reserve = sums.reserve ?? null;
  const release = sums.release ?? null;
  const refund = sums.refund ?? null;
  const usedParts = [charge, reserve];
  const used = usedParts.every((value) => value == null)
    ? null
    : usedParts.reduce<number>((sum, value) => sum + (value ?? 0), 0)
      - (release ?? 0)
      - (refund ?? 0);
  return { ...sums, used };
}

function policyOutcome(value: unknown): { allow: number | null; review: number | null; block: number | null } {
  const policy = asObject(value);
  const raw = String(policy.moderation ?? policy.outcome ?? '').toLowerCase();
  if (!raw) return { allow: null, review: null, block: null };
  return {
    allow: raw === 'allow' ? 1 : 0,
    review: raw === 'review' ? 1 : 0,
    block: raw === 'block' ? 1 : 0,
  };
}

function ictRangeSql(alias: string): string {
  return `($1::date IS NULL OR (${alias}.created_at AT TIME ZONE '${ICT_TIMEZONE}') >= $1::date)
      AND ($2::date IS NULL OR (${alias}.created_at AT TIME ZONE '${ICT_TIMEZONE}') < $2::date + INTERVAL '1 day')`;
}

function clientSql(alias: string): string {
  return `($3::text IS NULL OR ${alias}.agency_client_id::text = $3)`;
}

function bindReportFilters(query: CpReportQuery): { scopeSql: string; params: unknown[] } {
  const scoped = bindReportScope(query, 4);
  return {
    scopeSql: scoped.sql,
    params: [query.from ?? null, query.to ?? null, query.client ?? null, ...scoped.params],
  };
}

function stageLogElements(alias: string): string {
  return `jsonb_array_elements(
          CASE jsonb_typeof(${alias}.stage_log_json)
            WHEN 'array' THEN ${alias}.stage_log_json
            WHEN 'object' THEN jsonb_build_array(${alias}.stage_log_json)
            ELSE '[]'::jsonb
          END
        )`;
}

function durationSql(alias: string): string {
  return `(
      SELECT SUM((entry->>'duration_sec')::numeric)
        FROM ${stageLogElements(alias)} entry
       WHERE COALESCE(entry->>'duration_sec', '') ~ '^[0-9]+([.][0-9]+)?$'
    )`;
}

function queueWaitSql(alias: string): string {
  return `(
      SELECT EXTRACT(EPOCH FROM (
        MIN((entry->>'at')::timestamptz) - ${alias}.created_at
      ))
        FROM ${stageLogElements(alias)} entry
       WHERE COALESCE(entry->>'stage', '') NOT IN ('queued', '')
         AND COALESCE(entry->>'at', '') <> ''
    )`;
}

function bindReportScope(
  query: CpReportQuery,
  startAt: number,
): { sql: string; params: unknown[] } {
  const scope = cpScopeSql({
    scope: query.scope,
    staffId: query.staffId,
    teamIds: query.teamIds ?? [],
  });
  let sql = scope.sql;
  const params: unknown[] = [];
  let index = startAt;
  if (sql.includes('$teams')) {
    sql = sql.replaceAll('$teams', `$${index++}`);
    params.push(scope.params[0]);
  }
  if (sql.includes('$staff')) {
    sql = sql.replaceAll('$staff', `$${index}`);
    params.push(scope.params[scope.params.length - 1]);
  }
  return { sql, params };
}

function serializeExport(report: Record<string, unknown>, format: string): string {
  const slug = String(report.slug ?? '');
  if (format === 'csv') {
    return serializeExportCsv(report);
  }
  return JSON.stringify({ slug, format, report });
}

function serializeExportCsv(report: Record<string, unknown>): string {
  const header = ['section', 'key', 'value', 'source', 'freshness'];
  const rows = flattenReportRows(report);
  const lines = [header.join(',')];
  for (const row of rows) {
    lines.push([
      csvCell(row.section),
      csvCell(row.key),
      csvCell(row.value),
      csvCell(row.source),
      csvCell(row.freshness),
    ].join(','));
  }
  return `${lines.join('\n')}\n`;
}

function flattenReportRows(
  report: Record<string, unknown>,
): Array<{ section: string; key: string; value: unknown; source: unknown; freshness: unknown }> {
  const rows: Array<{ section: string; key: string; value: unknown; source: unknown; freshness: unknown }> = [];
  const pushMetric = (section: string, key: string, value: unknown) => {
    if (isSourcedMetric(value)) {
      rows.push({
        section,
        key,
        value: value.value,
        source: value.source,
        freshness: value.freshness,
      });
      return;
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      for (const [nested, item] of Object.entries(value as Record<string, unknown>)) {
        pushMetric(section, nested, item);
      }
      return;
    }
    rows.push({ section, key, value, source: null, freshness: null });
  };

  for (const [section, value] of Object.entries(report)) {
    if (section === 'slug' || section === 'insights' || section === 'policy' || section === 'actions') {
      continue;
    }
    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (item && typeof item === 'object' && !Array.isArray(item)) {
          const obj = item as Record<string, unknown>;
          const key = String(obj.key ?? obj.channel ?? obj.name ?? obj.id ?? obj.error_class ?? index);
          const metric = obj.performance ?? obj;
          if (isSourcedMetric(metric) || isSourcedMetric(obj)) {
            pushMetric(section, key, isSourcedMetric(obj) ? obj : metric);
            return;
          }
          const primary = obj.value ?? obj.count ?? obj.output ?? obj.success_pct ?? null;
          rows.push({
            section,
            key,
            value: primary,
            source: obj.source ?? null,
            freshness: obj.freshness ?? null,
          });
          return;
        }
        rows.push({ section, key: String(index), value: item, source: null, freshness: null });
      });
      continue;
    }
    pushMetric(section, section, value);
  }
  return rows;
}

function isSourcedMetric(value: unknown): value is CpSourcedMetric {
  return Boolean(
    value
    && typeof value === 'object'
    && !Array.isArray(value)
    && 'value' in value
    && 'source' in value
    && 'freshness' in value,
  );
}

function csvCell(value: unknown): string {
  if (value == null || value === '') return '';
  const text = String(value);
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function cpThrow(status: number, body: Record<string, unknown>): never {
  throw Object.assign(new HttpException(body, status), { ...body, status });
}
