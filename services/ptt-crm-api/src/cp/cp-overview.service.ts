import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import { kpiOrNull } from './cp-format.util';
import { cpScopeSql, CpScope } from './cp-scope.util';
import { CpKpis } from './cp.types';

const TENANT_ID = 'PTT';
const ICT_TIMEZONE = 'Asia/Ho_Chi_Minh';
const PAGE_SIZE = 50;
const QUEUE_STATES = new Set(['queued', 'preparing', 'rendering']);
const SLOT_STATES = new Set(['preparing', 'rendering']);
const TERMINAL_STATES = new Set(['completed', 'failed']);

export type CpOverviewScope = {
  scope: CpScope;
  staffId: number;
  teamIds?: number[];
};

export type CpKpiQuery = CpOverviewScope & {
  from?: string;
  to?: string;
  clientId?: string;
  lifecycleId?: string;
  ownerId?: string;
};

export type CpAction = {
  kind: 'review_pending' | 'render_failed' | 'rights_expiring' | 'budget_threshold' | 'publish_failed' | 'mention';
  severity: string;
  title: string;
  resource_type: string;
  resource_id: string | null;
  owner_staff_id: number | null;
  sla_at: string | null;
  href: string;
};

export type CpActivity = {
  id: string;
  actor_id: number | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  payload: unknown;
  created_at: string;
};

export type CpHealth = {
  queue_depth: number | null;
  slots: { used: number | null; max: number | null };
  providers: Array<{ id: string; success_pct: number | null; p95_sec: number | null }>;
};

export type OverviewFixtureBag = {
  projects: Array<Record<string, unknown>>;
  jobs: Array<Record<string, unknown>>;
  ledger: Array<Record<string, unknown>>;
  assets: Array<Record<string, unknown>>;
  tasks: Array<Record<string, unknown>>;
  drafts?: Array<Record<string, unknown>>;
  versions?: Array<Record<string, unknown>>;
  allocations?: Array<Record<string, unknown>>;
  actions?: CpAction[];
  activity?: CpActivity[];
  settings?: { concurrent_slots?: number | null };
};

type RenderCounts = { completed: number; failed: number; cancelled?: number };

export function renderSuccessRate(counts: RenderCounts): number | null {
  const attempted = counts.completed + counts.failed;
  return attempted > 0 ? counts.completed / attempted : null;
}

export function slotUsage(states: Iterable<unknown>): number {
  let used = 0;
  for (const state of states) {
    if (SLOT_STATES.has(String(state))) used += 1;
  }
  return used;
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

function ictYmd(value: unknown): string | null {
  const date = value instanceof Date ? value : new Date(String(value));
  if (!Number.isFinite(date.getTime())) return null;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ICT_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function inIctRange(value: unknown, from?: string, to?: string): boolean {
  if (!from && !to) return true;
  const day = ictYmd(value);
  if (!day) return false;
  return (!from || day >= from) && (!to || day <= to);
}

function countOrNull(rows: unknown[]): number | null {
  return rows.length ? rows.length : null;
}

function durationFromStageLog(value: unknown): number | null {
  const entries = Array.isArray(value) ? value : value && typeof value === 'object' ? [value] : [];
  const durations = entries
    .map((entry) => finiteNumber((entry as Record<string, unknown>).duration_sec))
    .filter((n): n is number => n != null);
  return durations.length ? durations.reduce((sum, n) => sum + n, 0) : null;
}

function percentile95(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil(sorted.length * 0.95) - 1];
}

function bindScope(
  scope: ReturnType<typeof cpScopeSql>,
  startAt: number,
): { sql: string; params: unknown[] } {
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

function stageDurationSql(alias: string): string {
  return `(
    SELECT SUM((entry->>'duration_sec')::numeric)
      FROM jsonb_array_elements(
        CASE jsonb_typeof(${alias}.stage_log_json)
          WHEN 'array' THEN ${alias}.stage_log_json
          WHEN 'object' THEN jsonb_build_array(${alias}.stage_log_json)
          ELSE '[]'::jsonb
        END
      ) entry
     WHERE COALESCE(entry->>'duration_sec', '') ~ '^[0-9]+([.][0-9]+)?$'
  )`;
}

export type OverviewSql = { sql: string; params: unknown[] };

export function buildKpiSql(query: CpKpiQuery): OverviewSql {
  const scope = bindScope(
    cpScopeSql({
      scope: query.scope,
      staffId: query.staffId,
      teamIds: query.teamIds ?? [],
    }),
    6,
  );
  const duration = stageDurationSql('j');
  return {
    sql: `WITH scoped_projects AS (
         SELECT p.*
           FROM crm_cp_projects p
          WHERE p.tenant_id = '${TENANT_ID}'
            AND ${scope.sql}
            AND ($3::text IS NULL OR p.agency_client_id::text = $3)
            AND ($4::text IS NULL OR p.lifecycle_id = $4)
            AND ($5::text IS NULL OR p.owner_staff_id::text = $5)
       ),
       scoped_clients AS (
         SELECT DISTINCT agency_client_id FROM scoped_projects
       ),
       scoped_jobs AS (
         SELECT j.*, ${duration} AS duration_sec
           FROM crm_cp_render_jobs j
           JOIN crm_cp_video_drafts d ON d.id = j.draft_id
           JOIN scoped_projects p ON p.id = d.project_id
          WHERE ($1::date IS NULL OR (j.created_at AT TIME ZONE '${ICT_TIMEZONE}') >= $1::date)
            AND ($2::date IS NULL OR (j.created_at AT TIME ZONE '${ICT_TIMEZONE}') < $2::date + INTERVAL '1 day')
       ),
       scoped_ledger AS (
         SELECT l.*
           FROM crm_cp_credit_ledger l
          WHERE l.tenant_id = '${TENANT_ID}'
            AND l.kind IN ('charge', 'reserve')
            AND ($1::date IS NULL OR (l.created_at AT TIME ZONE '${ICT_TIMEZONE}') >= $1::date)
            AND ($2::date IS NULL OR (l.created_at AT TIME ZONE '${ICT_TIMEZONE}') < $2::date + INTERVAL '1 day')
            AND (
              EXISTS (SELECT 1 FROM scoped_projects p WHERE p.id = l.project_id)
              OR (l.project_id IS NULL AND EXISTS (
                SELECT 1 FROM scoped_clients c WHERE c.agency_client_id = l.agency_client_id
              ))
            )
       )
       SELECT
         (SELECT NULLIF(COUNT(*), 0)::int
            FROM crm_cp_video_drafts d JOIN scoped_projects p ON p.id = d.project_id
           WHERE ($1::date IS NULL OR (d.created_at AT TIME ZONE '${ICT_TIMEZONE}') >= $1::date)
             AND ($2::date IS NULL OR (d.created_at AT TIME ZONE '${ICT_TIMEZONE}') < $2::date + INTERVAL '1 day')
         ) AS videos_created,
         (SELECT NULLIF(COUNT(*), 0)::int
            FROM crm_cp_video_versions v
            JOIN crm_cp_video_drafts d ON d.id = v.draft_id
            JOIN scoped_projects p ON p.id = d.project_id
           WHERE v.approval_status = 'final_approved') AS videos_approved,
         (SELECT COUNT(*) FILTER (WHERE state = 'completed')::int FROM scoped_jobs) AS render_completed,
         (SELECT COUNT(*) FILTER (WHERE state = 'failed')::int FROM scoped_jobs) AS render_failed,
         (SELECT AVG(duration_sec) FROM scoped_jobs
           WHERE state = 'completed' AND duration_sec IS NOT NULL) AS render_avg_duration_sec,
         (SELECT SUM(amount) FROM scoped_ledger) AS credits_used,
         (SELECT SUM(a.allocated) - COALESCE((SELECT SUM(amount) FROM scoped_ledger), 0)
            FROM crm_cp_credit_allocations a
            JOIN scoped_clients c ON c.agency_client_id = a.agency_client_id) AS credits_remaining,
         (SELECT NULLIF(COUNT(*), 0)::int
            FROM crm_cp_assets a
            JOIN scoped_projects p ON p.id = a.project_id
            JOIN crm_cp_asset_rights r ON r.asset_id = a.id
           WHERE r.expiry_on <= (now() AT TIME ZONE '${ICT_TIMEZONE}')::date + 14
             AND a.state <> 'archived') AS assets_expiring,
         (SELECT NULLIF(COUNT(*), 0)::int
            FROM crm_cp_tasks t JOIN scoped_projects p ON p.id = t.project_id
           WHERE (t.due_at AT TIME ZONE '${ICT_TIMEZONE}') < (now() AT TIME ZONE '${ICT_TIMEZONE}')
             AND t.status NOT IN ('done', 'cancelled')) AS tasks_overdue`,
    params: [
      query.from ?? null,
      query.to ?? null,
      query.clientId ?? null,
      query.lifecycleId ?? null,
      query.ownerId ?? null,
      ...scope.params,
    ],
  };
}

export function mapKpiRow(row: Record<string, unknown>): CpKpis {
  return {
    videos_created: kpiOrNull(finiteNumber(row.videos_created)),
    videos_approved: kpiOrNull(finiteNumber(row.videos_approved)),
    render_success_rate: renderSuccessRate({
      completed: Number(row.render_completed ?? 0),
      failed: Number(row.render_failed ?? 0),
    }),
    render_avg_duration_sec: kpiOrNull(finiteNumber(row.render_avg_duration_sec)),
    credits_used: kpiOrNull(finiteNumber(row.credits_used)),
    credits_remaining: kpiOrNull(finiteNumber(row.credits_remaining)),
    assets_expiring: kpiOrNull(finiteNumber(row.assets_expiring)),
    tasks_overdue: kpiOrNull(finiteNumber(row.tasks_overdue)),
  };
}

export function mapActionRows(rows: Array<Record<string, unknown>>): CpAction[] {
  return rows.map((row) => ({
    kind: row.kind as CpAction['kind'],
    severity: String(row.severity),
    title: String(row.title),
    resource_type: String(row.resource_type),
    resource_id: row.resource_id == null || row.resource_id === '' ? null : String(row.resource_id),
    owner_staff_id: finiteNumber(row.owner_staff_id),
    sla_at: iso(row.sla_at),
    href: String(row.href),
  }));
}

export function buildActionSql(query: CpOverviewScope): OverviewSql {
  const scope = bindScope(
    cpScopeSql({ scope: query.scope, staffId: query.staffId, teamIds: query.teamIds ?? [] }),
    1,
  );
  return {
    sql: `WITH scoped_projects AS (
         SELECT p.* FROM crm_cp_projects p
          WHERE p.tenant_id = '${TENANT_ID}' AND ${scope.sql}
       ),
       scoped_clients AS (
         SELECT agency_client_id, MIN(owner_staff_id) AS owner_staff_id
           FROM scoped_projects GROUP BY agency_client_id
       ),
       credit_usage AS (
         SELECT c.agency_client_id, c.owner_staff_id, a.allocated,
                COALESCE(SUM(l.amount) FILTER (WHERE l.kind IN ('charge', 'reserve')), 0) AS used
           FROM scoped_clients c
           JOIN crm_cp_credit_allocations a ON a.agency_client_id = c.agency_client_id
           LEFT JOIN crm_cp_credit_ledger l
             ON l.agency_client_id = c.agency_client_id AND l.tenant_id = '${TENANT_ID}'
          GROUP BY c.agency_client_id, c.owner_staff_id, a.allocated
       ),
       action_events AS (
         SELECT a.*
           FROM crm_cp_activity a
          WHERE a.tenant_id = '${TENANT_ID}'
            AND a.action IN ('publish_failed', 'mention')
            AND EXISTS (
              SELECT 1 FROM scoped_projects p
               WHERE p.id::text = CASE
                 WHEN a.resource_type = 'project' THEN a.resource_id
                 ELSE a.payload_json->>'project_id'
               END
            )
       )
       SELECT 'review_pending' AS kind, 'warning' AS severity,
              'Review pending' AS title, 'video_version' AS resource_type,
              v.id::text AS resource_id, p.owner_staff_id, NULL::text AS sla_at,
              '/cp/videos/' || d.id::text || '/review' AS href
         FROM crm_cp_video_versions v
         JOIN crm_cp_video_drafts d ON d.id = v.draft_id
         JOIN scoped_projects p ON p.id = d.project_id
        WHERE v.approval_status IN ('internal_review', 'client_review')
       UNION ALL
       SELECT 'render_failed', 'critical', 'Render failed', 'render_job', j.id::text,
              p.owner_staff_id, NULL::text, '/cp/renders/' || j.id::text
         FROM crm_cp_render_jobs j
         JOIN crm_cp_video_drafts d ON d.id = j.draft_id
         JOIN scoped_projects p ON p.id = d.project_id
        WHERE j.state = 'failed'
       UNION ALL
       SELECT 'rights_expiring', 'warning', 'Asset rights expiring', 'asset', a.id::text,
              a.owner_staff_id, r.expiry_on::text, '/cp/assets/' || a.id::text
         FROM crm_cp_assets a
         JOIN crm_cp_asset_rights r ON r.asset_id = a.id
         JOIN scoped_projects p ON p.id = a.project_id
        WHERE r.expiry_on <= (now() AT TIME ZONE '${ICT_TIMEZONE}')::date + 14
          AND a.state <> 'archived'
       UNION ALL
       SELECT 'budget_threshold',
              CASE
                WHEN allocated <= 0 OR used >= allocated THEN 'critical'
                WHEN used * 100 >= allocated * 80 THEN 'danger'
                ELSE 'warning'
              END,
              'Credit budget threshold', 'client', agency_client_id::text, owner_staff_id,
              NULL::text, '/cp/credits?client=' || agency_client_id::text
         FROM credit_usage
        WHERE allocated <= 0 OR used * 100 >= allocated * 50
       UNION ALL
       SELECT e.action, CASE WHEN e.action = 'publish_failed' THEN 'critical' ELSE 'info' END,
              CASE WHEN e.action = 'publish_failed' THEN 'Publish failed' ELSE 'You were mentioned' END,
              e.resource_type, e.resource_id,
              CASE WHEN COALESCE(e.payload_json->>'owner_staff_id', '') ~ '^[0-9]+$'
                   THEN (e.payload_json->>'owner_staff_id')::int ELSE NULL END,
              e.payload_json->>'sla_at',
              COALESCE(e.payload_json->>'href', '/cp/activity')
         FROM action_events e
       ORDER BY severity, sla_at NULLS LAST`,
    params: scope.params,
  };
}

export function buildHealthSql(): string {
  const duration = stageDurationSql('j');
  return `WITH jobs AS (
         SELECT j.*, ${duration} AS duration_sec
           FROM crm_cp_render_jobs j
           JOIN crm_cp_video_drafts d ON d.id = j.draft_id
           JOIN crm_cp_projects p ON p.id = d.project_id
          WHERE p.tenant_id = '${TENANT_ID}'
       ),
       stub_terminal AS (
         SELECT * FROM jobs WHERE provider = 'stub' AND state IN ('completed', 'failed')
       )
       SELECT
         CASE WHEN (SELECT COUNT(*) FROM jobs) = 0 THEN NULL
              ELSE (SELECT COUNT(*)::int FROM jobs WHERE state IN ('queued','preparing','rendering'))
          END AS queue_depth,
         CASE WHEN (SELECT COUNT(*) FROM jobs) = 0 THEN NULL
              ELSE (SELECT COUNT(*)::int FROM jobs WHERE state IN ('preparing','rendering'))
          END AS slots_used,
         (SELECT concurrent_slots FROM crm_cp_settings WHERE tenant_id = '${TENANT_ID}') AS slots_max,
         (SELECT COUNT(*) FILTER (WHERE state = 'completed')::int FROM stub_terminal) AS completed,
         (SELECT COUNT(*) FILTER (WHERE state = 'failed')::int FROM stub_terminal) AS failed,
         (SELECT percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_sec)
            FROM stub_terminal WHERE duration_sec IS NOT NULL) AS p95_sec`;
}

@Injectable()
export class CpOverviewService implements OnModuleDestroy {
  private pool: Pool | null = null;

  constructor(private readonly config: AppConfigService) {}

  private get db(): Pool {
    if (!this.pool) this.pool = new Pool({ connectionString: this.config.databaseUrl });
    return this.pool;
  }

  onModuleDestroy(): void {
    void this.pool?.end();
    this.pool = null;
  }

  async getKpis(query: CpKpiQuery): Promise<{ last_updated: string; kpis: CpKpis }> {
    const built = buildKpiSql(query);
    const result = await this.db.query<Record<string, unknown>>(built.sql, built.params);
    return {
      last_updated: new Date().toISOString(),
      kpis: mapKpiRow(result.rows[0] ?? {}),
    };
  }

  async getActions(query: CpOverviewScope): Promise<CpAction[]> {
    const built = buildActionSql(query);
    const result = await this.db.query<Record<string, unknown>>(built.sql, built.params);
    return mapActionRows(result.rows);
  }

  async getHealth(): Promise<CpHealth> {
    const result = await this.db.query<Record<string, unknown>>(buildHealthSql());
    const row = result.rows[0] ?? {};
    const queueDepth = finiteNumber(row.queue_depth);
    const successRate = renderSuccessRate({
      completed: Number(row.completed ?? 0),
      failed: Number(row.failed ?? 0),
    });
    return {
      queue_depth: queueDepth,
      slots: { used: finiteNumber(row.slots_used), max: finiteNumber(row.slots_max) },
      providers: [
        {
          id: 'stub',
          success_pct: successRate == null ? null : successRate * 100,
          p95_sec: finiteNumber(row.p95_sec),
        },
      ],
    };
  }

  async listActivity(
    query: CpOverviewScope & { cursor?: string },
  ): Promise<{ items: CpActivity[]; next_cursor: string | null }> {
    const cursor = query.cursor && /^[0-9]+$/.test(query.cursor) ? query.cursor : null;
    const scope = bindScope(
      cpScopeSql({ scope: query.scope, staffId: query.staffId, teamIds: query.teamIds ?? [] }),
      2,
    );
    const result = await this.db.query<Record<string, unknown>>(
      `WITH scoped_projects AS (
         SELECT p.* FROM crm_cp_projects p
          WHERE p.tenant_id = '${TENANT_ID}' AND ${scope.sql}
       )
       SELECT a.id::text, a.actor_id, a.action, a.resource_type, a.resource_id,
              a.payload_json, a.created_at
         FROM crm_cp_activity a
        WHERE a.tenant_id = '${TENANT_ID}'
          AND ($1::bigint IS NULL OR a.id < $1::bigint)
          AND (
            EXISTS (SELECT 1 FROM scoped_projects p
                     WHERE p.id::text = a.payload_json->>'project_id')
            OR (a.resource_type = 'project' AND EXISTS (
              SELECT 1 FROM scoped_projects p WHERE p.id::text = a.resource_id
            ))
            OR (a.resource_type = 'video_draft' AND EXISTS (
              SELECT 1 FROM crm_cp_video_drafts d JOIN scoped_projects p ON p.id = d.project_id
               WHERE d.id::text = a.resource_id
            ))
            OR (a.resource_type = 'video_version' AND EXISTS (
              SELECT 1 FROM crm_cp_video_versions v
              JOIN crm_cp_video_drafts d ON d.id = v.draft_id
              JOIN scoped_projects p ON p.id = d.project_id WHERE v.id::text = a.resource_id
            ))
            OR (a.resource_type = 'render_job' AND EXISTS (
              SELECT 1 FROM crm_cp_render_jobs j
              JOIN crm_cp_video_drafts d ON d.id = j.draft_id
              JOIN scoped_projects p ON p.id = d.project_id WHERE j.id::text = a.resource_id
            ))
            OR (a.resource_type = 'asset' AND EXISTS (
              SELECT 1 FROM crm_cp_assets x JOIN scoped_projects p ON p.id = x.project_id
               WHERE x.id::text = a.resource_id
            ))
            OR (a.resource_type = 'task' AND EXISTS (
              SELECT 1 FROM crm_cp_tasks t JOIN scoped_projects p ON p.id = t.project_id
               WHERE t.id::text = a.resource_id
            ))
          )
        ORDER BY a.id DESC
        LIMIT ${PAGE_SIZE + 1}`,
      [cursor, ...scope.params],
    );
    const hasMore = result.rows.length > PAGE_SIZE;
    const rows = result.rows.slice(0, PAGE_SIZE);
    const items = rows.map((row) => ({
      id: String(row.id),
      actor_id: finiteNumber(row.actor_id),
      action: String(row.action),
      resource_type: String(row.resource_type),
      resource_id: row.resource_id == null ? null : String(row.resource_id),
      payload: row.payload_json ?? null,
      created_at: iso(row.created_at) ?? String(row.created_at),
    }));
    return {
      items,
      next_cursor: hasMore ? items[items.length - 1]?.id ?? null : null,
    };
  }
}

class FixtureOverview {
  constructor(private readonly fixtures: OverviewFixtureBag) {}

  async getKpis(query: CpKpiQuery): Promise<{ last_updated: string; kpis: CpKpis }> {
    const projectIds = new Set(
      this.fixtures.projects
        .filter((project) => {
          if (query.scope === 'all') return true;
          if (query.scope === 'me') {
            const members = Array.isArray(project.member_staff_ids) ? project.member_staff_ids : [];
            return Number(project.owner_staff_id) === query.staffId || members.includes(query.staffId);
          }
          return true;
        })
        .map((project) => String(project.id)),
    );
    if (!projectIds.size) {
      return { last_updated: new Date().toISOString(), kpis: mapKpiRow({}) };
    }
    const inScope = (row: Record<string, unknown>) =>
      projectIds.has(String(row.project_id ?? row.projectId ?? ''));
    const scopedDrafts = (this.fixtures.drafts ?? []).filter(inScope);
    const drafts = scopedDrafts.filter(
      (draft) =>
        inIctRange(draft.created_at ?? draft.createdAt, query.from, query.to),
    );
    const draftIds = new Set(scopedDrafts.map((draft) => String(draft.id)));
    const jobs = this.fixtures.jobs.filter(
      (job) =>
        (inScope(job) || draftIds.has(String(job.draft_id ?? job.draftId ?? ''))) &&
        inIctRange(job.created_at ?? job.createdAt, query.from, query.to),
    );
    const terminal = {
      completed: jobs.filter((job) => job.state === 'completed').length,
      failed: jobs.filter((job) => job.state === 'failed').length,
    };
    const completedDurations = jobs
      .filter((job) => job.state === 'completed')
      .map((job) => durationFromStageLog(job.stage_log_json ?? job.stageLog))
      .filter((n): n is number => n != null);
    const ledger = this.fixtures.ledger.filter(
      (row) =>
        inScope(row) &&
        (row.kind === 'charge' || row.kind === 'reserve') &&
        inIctRange(row.created_at ?? row.createdAt, query.from, query.to),
    );
    const creditsUsed = ledger
      .map((row) => finiteNumber(row.amount))
      .filter((n): n is number => n != null);
    const allocations = this.fixtures.allocations ?? [];
    const allocated = allocations
      .map((row) => finiteNumber(row.allocated))
      .filter((n): n is number => n != null);
    const now = Date.now();
    const expiring = this.fixtures.assets.filter((asset) => {
      if (!inScope(asset) || asset.state === 'archived') return false;
      const expiry = Date.parse(String(asset.expiry_on ?? ''));
      return Number.isFinite(expiry) && expiry <= now + 14 * 86_400_000;
    });
    const overdue = this.fixtures.tasks.filter((task) => {
      if (!inScope(task) || task.status === 'done' || task.status === 'cancelled') return false;
      const due = Date.parse(String(task.due_at ?? ''));
      return Number.isFinite(due) && due < now;
    });
    const versions = (this.fixtures.versions ?? []).filter(
      (version) =>
        draftIds.has(String(version.draft_id ?? version.draftId ?? '')) &&
        version.approval_status === 'final_approved',
    );
    const row = {
      videos_created: countOrNull(drafts),
      videos_approved: countOrNull(versions),
      render_completed: terminal.completed,
      render_failed: terminal.failed,
      render_avg_duration_sec: completedDurations.length
        ? completedDurations.reduce((sum, n) => sum + n, 0) / completedDurations.length
        : null,
      credits_used: creditsUsed.length ? creditsUsed.reduce((sum, n) => sum + n, 0) : null,
      credits_remaining: allocated.length
        ? allocated.reduce((sum, n) => sum + n, 0) - creditsUsed.reduce((sum, n) => sum + n, 0)
        : null,
      assets_expiring: countOrNull(expiring),
      tasks_overdue: countOrNull(overdue),
    };
    return { last_updated: new Date().toISOString(), kpis: mapKpiRow(row) };
  }

  async getActions(): Promise<CpAction[]> {
    return mapActionRows((this.fixtures.actions ?? []) as Array<Record<string, unknown>>);
  }

  async getHealth(): Promise<CpHealth> {
    const jobs = this.fixtures.jobs;
    const queueDepth = jobs.length
      ? jobs.filter((job) => QUEUE_STATES.has(String(job.state))).length
      : null;
    const slotsUsed = jobs.length ? slotUsage(jobs.map((job) => job.state)) : null;
    const terminal = jobs.filter(
      (job) => job.provider === 'stub' && TERMINAL_STATES.has(String(job.state)),
    );
    const completed = terminal.filter((job) => job.state === 'completed').length;
    const failed = terminal.filter((job) => job.state === 'failed').length;
    const durations = terminal
      .map((job) => durationFromStageLog(job.stage_log_json ?? job.stageLog))
      .filter((n): n is number => n != null);
    const rate = renderSuccessRate({ completed, failed });
    return {
      queue_depth: queueDepth,
      slots: {
        used: slotsUsed,
        max: finiteNumber(this.fixtures.settings?.concurrent_slots),
      },
      providers: [{ id: 'stub', success_pct: rate == null ? null : rate * 100, p95_sec: percentile95(durations) }],
    };
  }

  async listActivity(query: { cursor?: string }): Promise<{ items: CpActivity[]; next_cursor: string | null }> {
    const all = this.fixtures.activity ?? [];
    const start = query.cursor ? all.findIndex((item) => item.id === query.cursor) + 1 : 0;
    const items = all.slice(start, start + PAGE_SIZE);
    return {
      items,
      next_cursor: start + PAGE_SIZE < all.length ? items[items.length - 1]?.id ?? null : null,
    };
  }
}

export function makeOverview(fixtures: OverviewFixtureBag): FixtureOverview {
  return new FixtureOverview(fixtures);
}
