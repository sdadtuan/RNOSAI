import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import type { CorpusLifecycleInput } from './mkt-ai-playbook-corpus.util';
import type { DoneOpsTaskInput } from './mkt-ai-playbook-week-hints.util';

/** Row loaded from SQL; `clientName` is for PII validation only — not persisted in playbook. */
export type CorpusLifecycleLoadRow = CorpusLifecycleInput & { clientName?: string };

type TableFlags = {
  drafts: boolean;
  jobs: boolean;
  planVersions: boolean;
  leads: boolean;
  customers: boolean;
  svcTasks: boolean;
  contentItems: boolean;
  contentPlans: boolean;
};

function mapCorpusRow(row: Record<string, unknown>): CorpusLifecycleLoadRow {
  return {
    lifecycleId: Number(row.lifecycle_id),
    serviceSlug: String(row.service_slug ?? ''),
    applied: row.applied === true || row.applied === 't',
    qualityScore: Number(row.quality_score ?? 0),
    humanEditedAfterGenerate:
      row.human_edited_after_generate === true || row.human_edited_after_generate === 't',
    isUatSeed: row.is_uat_seed === true || row.is_uat_seed === 't',
    sqliteLeadId: row.sqlite_lead_id != null ? Number(row.sqlite_lead_id) : undefined,
    stage: String(row.stage ?? ''),
    closedLoopWin: row.closed_loop_win === true || row.closed_loop_win === 't',
    hasTier3Artifact: row.has_tier3_artifact === true || row.has_tier3_artifact === 't',
    clientName: row.client_name ? String(row.client_name) : undefined,
  };
}

function mapDoneOpsTask(row: Record<string, unknown>): DoneOpsTaskInput | null {
  const lifecycleId = Number(row.lifecycle_id);
  const weekNo = Number(row.week_no);
  const taskName = String(row.title ?? '').trim();
  if (!Number.isFinite(lifecycleId) || !taskName) return null;
  if (!Number.isFinite(weekNo) || weekNo < 0) return null;
  return {
    lifecycleId,
    weekNo,
    taskName,
    status: 'done',
  };
}

@Injectable()
export class MktAiPlaybookCorpusRepository implements OnModuleDestroy {
  private readonly logger = new Logger(MktAiPlaybookCorpusRepository.name);
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

  private async tableExists(name: string): Promise<boolean> {
    const { rows } = await this.db.query(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = $1
       ) AS ok`,
      [name],
    );
    return Boolean(rows[0]?.ok);
  }

  private async loadTableFlags(): Promise<TableFlags | null> {
    if (!(await this.tableExists('crm_service_lifecycle'))) {
      return null;
    }
    const [
      drafts,
      jobs,
      planVersions,
      leads,
      customers,
      svcTasks,
      contentItems,
      contentPlans,
    ] = await Promise.all([
      this.tableExists('mkt_ai_drafts'),
      this.tableExists('mkt_ai_jobs'),
      this.tableExists('mkt_ai_plan_versions'),
      this.tableExists('crm_leads'),
      this.tableExists('crm_customers'),
      this.tableExists('crm_svc_tasks'),
      this.tableExists('cmkt_content_items'),
      this.tableExists('cm_content_plans'),
    ]);
    return { drafts, jobs, planVersions, leads, customers, svcTasks, contentItems, contentPlans };
  }

  private buildAppliedExpr(flags: TableFlags): string {
    const parts: string[] = [];
    if (flags.planVersions) {
      parts.push(
        `EXISTS (
           SELECT 1 FROM mkt_ai_plan_versions pv
           WHERE pv.lifecycle_id = lc.id AND pv.applied_at IS NOT NULL
         )`,
      );
    }
    if (flags.jobs) {
      parts.push(
        `EXISTS (
           SELECT 1 FROM mkt_ai_jobs j
           WHERE j.lifecycle_id = lc.id
             AND j.job_type = 'apply_to_tmmt'
             AND j.status = 'succeeded'
         )`,
      );
    }
    return parts.length ? `(${parts.join(' OR ')})` : 'FALSE';
  }

  private buildAppliedVersionScoreExpr(flags: TableFlags): string {
    if (!flags.planVersions) return 'NULL';
    return `(
      SELECT NULLIF((pv.quality_score_json->>'score')::numeric, NULL)
      FROM mkt_ai_plan_versions pv
      WHERE pv.lifecycle_id = lc.id AND pv.applied_at IS NOT NULL
      ORDER BY pv.applied_at DESC NULLS LAST, pv.id DESC
      LIMIT 1
    )`;
  }

  private buildQualityScoreExpr(flags: TableFlags): string {
    const appliedScore = this.buildAppliedVersionScoreExpr(flags);
    if (flags.drafts) {
      return `COALESCE(
        NULLIF((d.quality_score_json->>'score')::numeric, NULL),
        ${appliedScore},
        0
      )`;
    }
    if (flags.planVersions) {
      return `COALESCE(${appliedScore}, 0)`;
    }
    return '0';
  }

  private buildHumanEditedExpr(flags: TableFlags): string {
    if (flags.drafts && flags.jobs) {
      return `(
        d.updated_at > COALESCE((
          SELECT MAX(j.ended_at) FROM mkt_ai_jobs j
          WHERE j.lifecycle_id = lc.id
            AND j.job_type = 'strategy_generate'
            AND j.status = 'succeeded'
        ), '-infinity'::timestamptz)
        OR COALESCE(d.updated_by, '') NOT IN ('', 'system', 'ai')
      )`;
    }
    if (flags.drafts) {
      return `COALESCE(d.updated_by, '') NOT IN ('', 'system', 'ai')`;
    }
    return 'FALSE';
  }

  private buildUatSeedExpr(flags: TableFlags): string {
    const parts: string[] = [
      `lc.notes ILIKE '%mkt-ai-seed%'`,
      `lc.notes ILIKE '%mkt-ai-smoke%'`,
    ];
    if (flags.leads) {
      parts.unshift(`COALESCE(l.sqlite_lead_id, 0) >= 900000901`);
    }
    return `(${parts.join(' OR ')})`;
  }

  /** W1 pragmatic MVP: deliver-stage + marketing plan or applied version (not full KPI closed-loop yet). */
  private buildClosedLoopWinExpr(flags: TableFlags): string {
    const appliedExists = flags.planVersions
      ? `EXISTS (
           SELECT 1 FROM mkt_ai_plan_versions pv
           WHERE pv.lifecycle_id = lc.id AND pv.applied_at IS NOT NULL
         )`
      : 'FALSE';
    return `(
      lc.stage IN ('deliver', 'cskh', 'done')
      AND (
        lc.marketing_plan_id IS NOT NULL
        OR ${appliedExists}
      )
    )`;
  }

  private buildTier3ArtifactExpr(flags: TableFlags): string {
    const parts: string[] = [];
    if (flags.svcTasks) {
      parts.push(
        `EXISTS (
           SELECT 1 FROM crm_svc_tasks t
           WHERE t.lifecycle_id = lc.id AND t.is_done = TRUE
         )`,
      );
    }
    if (flags.contentItems) {
      parts.push(
        `EXISTS (
           SELECT 1 FROM cmkt_content_items ci
           WHERE ci.lifecycle_id = lc.id AND ci.status = 'approved_internal'
         )`,
      );
    }
    if (flags.contentPlans) {
      parts.push(
        `EXISTS (
           SELECT 1 FROM cm_content_plans cp
           WHERE cp.lifecycle_id = lc.id AND cp.status = 'approved_internal'
         )`,
      );
    }
    return parts.length ? `(${parts.join(' OR ')})` : 'FALSE';
  }

  async loadCorpusRows(
    serviceSlug: string,
    excludeLifecycleIds: number[] = [],
  ): Promise<CorpusLifecycleLoadRow[]> {
    const slug = String(serviceSlug ?? '').trim();
    if (!slug) return [];

    let flags: TableFlags | null;
    try {
      flags = await this.loadTableFlags();
    } catch (err) {
      this.logger.warn(`corpus table probe failed: ${String(err)}`);
      return [];
    }
    if (!flags) return [];

    const exclude = Array.isArray(excludeLifecycleIds)
      ? excludeLifecycleIds.filter((id) => Number.isFinite(id))
      : [];

    const draftJoin = flags.drafts ? 'LEFT JOIN mkt_ai_drafts d ON d.lifecycle_id = lc.id' : '';
    const leadJoin = flags.leads ? 'LEFT JOIN crm_leads l ON l.sqlite_lead_id = lc.lead_id' : '';
    const customerJoin = flags.customers
      ? 'LEFT JOIN crm_customers cust ON cust.id = lc.customer_id'
      : '';

    let clientNameExpr = 'NULL::text';
    if (flags.customers && flags.leads) {
      clientNameExpr = `COALESCE(NULLIF(TRIM(cust.name), ''), NULLIF(TRIM(l.full_name), ''))`;
    } else if (flags.customers) {
      clientNameExpr = `NULLIF(TRIM(cust.name), '')`;
    } else if (flags.leads) {
      clientNameExpr = `NULLIF(TRIM(l.full_name), '')`;
    }

    const sqliteLeadExpr = flags.leads ? 'l.sqlite_lead_id' : 'NULL::bigint';

    const sql = `
      SELECT
        lc.id AS lifecycle_id,
        lc.service_slug,
        lc.stage,
        ${sqliteLeadExpr} AS sqlite_lead_id,
        ${clientNameExpr} AS client_name,
        ${this.buildAppliedExpr(flags)} AS applied,
        ${this.buildQualityScoreExpr(flags)} AS quality_score,
        ${this.buildHumanEditedExpr(flags)} AS human_edited_after_generate,
        ${this.buildUatSeedExpr(flags)} AS is_uat_seed,
        ${this.buildClosedLoopWinExpr(flags)} AS closed_loop_win,
        ${this.buildTier3ArtifactExpr(flags)} AS has_tier3_artifact
      FROM crm_service_lifecycle lc
      ${draftJoin}
      ${leadJoin}
      ${customerJoin}
      WHERE lc.service_slug = $1
        AND (cardinality($2::bigint[]) = 0 OR lc.id != ALL($2::bigint[]))
      ORDER BY lc.updated_at DESC NULLS LAST, lc.id DESC
    `;

    let rows: Record<string, unknown>[] = [];
    try {
      const result = await this.db.query(sql, [slug, exclude]);
      rows = result.rows as Record<string, unknown>[];
    } catch (err) {
      this.logger.warn(`corpus lifecycle query failed for ${slug}: ${String(err)}`);
      return [];
    }

    const corpusRows = rows.map((row) => mapCorpusRow(row));
    if (!flags.svcTasks || corpusRows.length === 0) {
      return corpusRows;
    }

    const lifecycleIds = corpusRows.map((row) => row.lifecycleId);
    try {
      const tasksResult = await this.db.query(
        `SELECT
           t.lifecycle_id,
           t.title,
           COALESCE(
             NULLIF(substring(t.title FROM '(?i)(?:tu[aà]n|week)\\s*(\\d+)'), '')::int,
             NULLIF((t.form_data->>'week_no')::int, NULL),
             t.step_index
           ) AS week_no
         FROM crm_svc_tasks t
         WHERE t.lifecycle_id = ANY($1::bigint[])
           AND t.is_done = TRUE
         ORDER BY t.lifecycle_id, week_no, t.id`,
        [lifecycleIds],
      );

      const tasksByLifecycle = new Map<number, DoneOpsTaskInput[]>();
      for (const row of tasksResult.rows as Record<string, unknown>[]) {
        const task = mapDoneOpsTask(row);
        if (!task) continue;
        const list = tasksByLifecycle.get(task.lifecycleId) ?? [];
        list.push(task);
        tasksByLifecycle.set(task.lifecycleId, list);
      }

      return corpusRows.map((row) => ({
        ...row,
        doneOpsTasks: tasksByLifecycle.get(row.lifecycleId) ?? [],
      }));
    } catch (err) {
      this.logger.warn(`corpus ops tasks query failed for ${slug}: ${String(err)}`);
      return corpusRows;
    }
  }
}
