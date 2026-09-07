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
    const ingest = await this.loadIngest();
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

  private async loadIngest(): Promise<Record<string, unknown>[]> {
    const result = await this.db.query(
      `SELECT payload_json, created_at
         FROM crm_cp_activity
        WHERE tenant_id = $1 AND action = 'performance_ingest'
        ORDER BY created_at DESC`,
      [CP_TENANT_ID],
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
    const scoped = bindReportScope(query, 4);
    const kpis = await this.db.query(
      `WITH scoped_projects AS (
         SELECT p.* FROM crm_cp_projects p
          WHERE p.tenant_id = '${CP_TENANT_ID}' AND ${scoped.sql}
            AND ($3::text IS NULL OR p.agency_client_id::text = $3)
       )
       SELECT
         (SELECT NULLIF(COUNT(*), 0)::int
            FROM crm_cp_video_versions v
            JOIN crm_cp_video_drafts d ON d.id = v.draft_id
            JOIN scoped_projects p ON p.id = d.project_id
           WHERE v.approval_status = 'final_approved'
         ) AS output_final,
         (SELECT SUM(l.amount)
            FROM crm_cp_credit_ledger l
           WHERE l.tenant_id = '${CP_TENANT_ID}' AND l.kind = 'charge'
             AND ($1::date IS NULL OR (l.created_at AT TIME ZONE '${ICT_TIMEZONE}') >= $1::date)
             AND ($2::date IS NULL OR (l.created_at AT TIME ZONE '${ICT_TIMEZONE}') < $2::date + INTERVAL '1 day')
             AND EXISTS (SELECT 1 FROM scoped_projects p WHERE p.id = l.project_id
               OR (l.project_id IS NULL AND p.agency_client_id = l.agency_client_id))
         ) AS credits_charged,
         (SELECT NULLIF(COUNT(*), 0)::int FROM scoped_projects WHERE status = 'at_risk') AS at_risk`,
      [query.from ?? null, query.to ?? null, query.client ?? null, ...scoped.params],
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
      trend: [],
      funnel: mapped.funnel,
      top_creative: [],
      project_health: [],
      insights: {
        disclaimer: 'Insight không nhân quả. Không suy diễn hiệu quả ads khi thiếu ingest.',
      },
    };
  }

  private async production(query: CpReportQuery) {
    const scoped = bindReportScope(query, 1);
    const duration = `(
      SELECT SUM((entry->>'duration_sec')::numeric)
        FROM jsonb_array_elements(
          CASE jsonb_typeof(j.stage_log_json)
            WHEN 'array' THEN j.stage_log_json
            WHEN 'object' THEN jsonb_build_array(j.stage_log_json)
            ELSE '[]'::jsonb
          END
        ) entry
       WHERE COALESCE(entry->>'duration_sec', '') ~ '^[0-9]+([.][0-9]+)?$'
    )`;
    const jobs = await this.db.query(
      `WITH scoped_projects AS (
         SELECT p.* FROM crm_cp_projects p
          WHERE p.tenant_id = '${CP_TENANT_ID}' AND ${scoped.sql}
       ),
       scoped_jobs AS (
         SELECT j.*, ${duration} AS duration_sec
           FROM crm_cp_render_jobs j
           JOIN crm_cp_video_drafts d ON d.id = j.draft_id
           JOIN scoped_projects p ON p.id = d.project_id
       )
       SELECT
         (SELECT COUNT(*) FILTER (WHERE state = 'completed')::int FROM scoped_jobs) AS completed,
         (SELECT COUNT(*) FILTER (WHERE state = 'failed')::int FROM scoped_jobs) AS failed,
         (SELECT percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_sec)
            FROM scoped_jobs WHERE duration_sec IS NOT NULL) AS render_p95,
         (SELECT percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_sec)
            FROM scoped_jobs WHERE state IN ('queued','preparing') AND duration_sec IS NOT NULL) AS queue_p95`,
      scoped.params,
    );
    const failures = await this.db.query(
      `WITH scoped_projects AS (
         SELECT p.* FROM crm_cp_projects p
          WHERE p.tenant_id = '${CP_TENANT_ID}' AND ${scoped.sql}
       )
       SELECT j.error_class, COUNT(*)::int AS count,
              COUNT(*) FILTER (WHERE j.attempt > 1 AND j.state = 'completed')::int AS retry_ok
         FROM crm_cp_render_jobs j
         JOIN crm_cp_video_drafts d ON d.id = j.draft_id
         JOIN scoped_projects p ON p.id = d.project_id
        WHERE j.error_class IS NOT NULL
        GROUP BY j.error_class
        ORDER BY count DESC`,
      scoped.params,
    );
    const heatmap = await this.db.query(
      `WITH scoped_projects AS (
         SELECT p.* FROM crm_cp_projects p
          WHERE p.tenant_id = '${CP_TENANT_ID}' AND ${scoped.sql}
       )
       SELECT COALESCE(j.model, 'stub') AS model,
              (j.created_at AT TIME ZONE '${ICT_TIMEZONE}')::date::text AS day,
              COUNT(*)::int AS count
         FROM crm_cp_render_jobs j
         JOIN crm_cp_video_drafts d ON d.id = j.draft_id
         JOIN scoped_projects p ON p.id = d.project_id
        GROUP BY 1, 2
        ORDER BY 2, 1`,
      scoped.params,
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
      heatmap: heatmap.rows,
      failure_class: failures.rows.map((item) => ({
        error_class: item.error_class == null ? null : String(item.error_class),
        count: finiteNumber(item.count),
        retry_ok: kpiOrNull(finiteNumber(item.retry_ok)),
        recommendation: item.error_class == null ? null : String(item.error_class),
      })),
      provider_health: attempted > 0
        ? [{ id: 'stub', success_pct: (completed / attempted) * 100, p95_sec: finiteNumber(row.render_p95) }]
        : [],
    };
  }

  private async credit(query: CpReportQuery) {
    const scoped = bindReportScope(query, 1);
    const ledger = await this.db.query(
      `WITH scoped_projects AS (
         SELECT p.* FROM crm_cp_projects p
          WHERE p.tenant_id = '${CP_TENANT_ID}' AND ${scoped.sql}
       )
       SELECT l.kind, SUM(l.amount) AS amount
         FROM crm_cp_credit_ledger l
        WHERE l.tenant_id = '${CP_TENANT_ID}'
          AND (
            EXISTS (SELECT 1 FROM scoped_projects p WHERE p.id = l.project_id)
            OR (l.project_id IS NULL AND EXISTS (
              SELECT 1 FROM scoped_projects p WHERE p.agency_client_id = l.agency_client_id
            ))
          )
        GROUP BY l.kind`,
      scoped.params,
    );
    const pipeline = await this.db.query(
      `WITH scoped_projects AS (
         SELECT p.* FROM crm_cp_projects p
          WHERE p.tenant_id = '${CP_TENANT_ID}' AND ${scoped.sql}
       )
       SELECT COALESCE(NULLIF(l.cost_center, ''), 'gen') AS pipeline, l.kind, SUM(l.amount) AS amount
         FROM crm_cp_credit_ledger l
        WHERE l.tenant_id = '${CP_TENANT_ID}'
          AND (
            EXISTS (SELECT 1 FROM scoped_projects p WHERE p.id = l.project_id)
            OR (l.project_id IS NULL AND EXISTS (
              SELECT 1 FROM scoped_projects p WHERE p.agency_client_id = l.agency_client_id
            ))
          )
        GROUP BY 1, 2
        ORDER BY 1`,
      scoped.params,
    );
    const forecastRow = await this.db.query(
      `WITH scoped_projects AS (
         SELECT p.* FROM crm_cp_projects p
          WHERE p.tenant_id = '${CP_TENANT_ID}' AND ${scoped.sql}
       )
       SELECT
         (SELECT SUM(b.estimate_credits)
            FROM crm_cp_batch_jobs b
            JOIN scoped_projects p ON p.id = b.project_id
           WHERE b.status NOT IN ('completed', 'cancelled')
         ) AS scheduled_batch_credits,
         (SELECT AVG(l.amount)
            FROM crm_cp_credit_ledger l
           WHERE l.tenant_id = '${CP_TENANT_ID}' AND l.kind = 'charge'
             AND (
               EXISTS (SELECT 1 FROM scoped_projects p WHERE p.id = l.project_id)
               OR (l.project_id IS NULL AND EXISTS (
                 SELECT 1 FROM scoped_projects p WHERE p.agency_client_id = l.agency_client_id
               ))
             )
         ) AS historical_avg,
         (SELECT SUM(l.amount)
            FROM crm_cp_credit_ledger l
           WHERE l.tenant_id = '${CP_TENANT_ID}' AND l.kind = 'reserve'
             AND (
               EXISTS (SELECT 1 FROM scoped_projects p WHERE p.id = l.project_id)
               OR (l.project_id IS NULL AND EXISTS (
                 SELECT 1 FROM scoped_projects p WHERE p.agency_client_id = l.agency_client_id
               ))
             )
         ) AS reserved`,
      scoped.params,
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
    const scoped = bindReportScope(query, 1);
    const stats = await this.db.query(
      `WITH scoped_projects AS (
         SELECT p.* FROM crm_cp_projects p
          WHERE p.tenant_id = '${CP_TENANT_ID}' AND ${scoped.sql}
       )
       SELECT
         (SELECT NULLIF(COUNT(*), 0)::int
            FROM crm_cp_video_versions v
            JOIN crm_cp_video_drafts d ON d.id = v.draft_id
            JOIN scoped_projects p ON p.id = d.project_id
           WHERE v.approval_status = 'brand_approved') AS brand_pass,
         (SELECT NULLIF(COUNT(*), 0)::int
            FROM crm_cp_video_versions v
            JOIN crm_cp_video_drafts d ON d.id = v.draft_id
            JOIN scoped_projects p ON p.id = d.project_id
           WHERE v.qc_status = 'warning') AS qc_warning,
         (SELECT NULLIF(COUNT(*), 0)::int
            FROM crm_cp_assets a
            JOIN scoped_projects p ON p.id = a.project_id
            JOIN crm_cp_asset_rights r ON r.asset_id = a.id
           WHERE r.expiry_on <= (now() AT TIME ZONE '${ICT_TIMEZONE}')::date + 14
             AND a.state <> 'archived') AS rights_14d,
         (SELECT NULLIF(COUNT(*), 0)::int
            FROM crm_cp_activity a
           WHERE a.tenant_id = '${CP_TENANT_ID}'
             AND (
               EXISTS (SELECT 1 FROM scoped_projects p
                        WHERE p.id::text = a.payload_json->>'project_id')
               OR (a.resource_type = 'project' AND EXISTS (
                 SELECT 1 FROM scoped_projects p WHERE p.id::text = a.resource_id
               ))
             )) AS audit_rows`,
      scoped.params,
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
    return `slug,format\n${slug},${format}\n`;
  }
  return JSON.stringify({ slug, format, report });
}

function cpThrow(status: number, body: Record<string, unknown>): never {
  throw Object.assign(new HttpException(body, status), { ...body, status });
}
