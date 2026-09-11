import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import { CMKT_ITEM_STATUSES, CMKT_REVIEW_SLA_HOURS } from './content-marketing.constants';
import { isReviewSlaBreach } from './content-workflow.util';
import { emptyBodyJson } from './content-marketing.util';
import { nextDisplaySeq } from '../content-os-portfolio/display-seq';
import { formatContentItemCode } from '../content-os-portfolio/content-os-portfolio.util';
import type {
  CmktActiveSnapshotRow,
  CmktBodyJson,
  CmktContextCounts,
  CmktDerivationRow,
  CmktIdeaRow,
  CmktItemRow,
  CmktAuditRow,
  CmktCalendarSlotRow,
  CmktCommentRow,
  CmktItemVersionRow,
  CmktJobRow,
  CmktMetricRow,
  CmktMetricWithItemRow,
  CmktPillarRow,
  CmktReviewQueueItem,
  CmktReviewQueueSummary,
  CmktVisualReviewItem,
  CmktWeeklyMemoPreview,
  CmktApprovalPackageRow,
  CmktApprovalPackageWrite,
  CmktSlaAuditFilter,
  CmktSlaAuditRow,
  CmktSlaAuditWrite,
  CmktSlaScanItem,
  CmktPublicationLogRow,
  CmktPublicationLogWrite,
} from './content-marketing.types';
import type { ChannelConnectorRow } from '../content-os-portfolio/channel-health.util';
import { nextPublicationRetryN } from '../content-os-portfolio/publication-log.util';
import type { PlannerIngestSource, SnapshotPillarDraft } from './content-plan-snapshot.util';
import type { AssetRightStatus, CmktAssetRightRow, CmktAssetRightWrite } from '../content-os-portfolio/content-os-portfolio.types';
import {
  CMKT_INSIGHT_STATUSES,
  type CmktInsightRow,
  type CmktInsightStatus,
} from '../content-os-portfolio/copilot-insights.util';

type MemoryStore = {
  ideas: Map<number, CmktIdeaRow[]>;
  items: Map<number, CmktItemRow[]>;
  snapshots: Map<number, CmktActiveSnapshotRow[]>;
  pillars: Map<number, CmktPillarRow[]>;
  jobs: Map<number, CmktJobRow>;
  versions: Map<number, CmktItemVersionRow[]>;
  calendar: Map<number, CmktCalendarSlotRow[]>;
  comments: Map<number, Array<{ id: number; item_id: number; author_id: string; body: string; visibility: string; created_at: string }>>;
  metrics: Map<number, CmktMetricRow[]>;
  topicSuggestions: Map<number, string[]>;
  derivations: CmktDerivationRow[];
  nextIdeaId: number;
  nextItemId: number;
  nextSnapshotId: number;
  nextPillarId: number;
  nextJobId: number;
  nextVersionId: number;
  nextCalendarId: number;
  nextCommentId: number;
  nextMetricId: number;
  nextDerivationId: number;
  nextVersionNo: Map<number, number>;
  plannerSources: Map<number, PlannerIngestSource>;
  assetRights: Map<number, CmktAssetRightRow[]>;
  nextRightsId: number;
  approvalPackages: Map<number, CmktApprovalPackageRow[]>;
  nextApprovalPackageId: number;
  slaEvents: CmktSlaAuditRow[];
  nextSlaEventId: number;
  publicationLogs: CmktPublicationLogRow[];
  nextPublicationLogId: number;
};

function emptyCounts(): CmktContextCounts {
  const items_by_status: Record<string, number> = {};
  for (const s of CMKT_ITEM_STATUSES) {
    items_by_status[s] = 0;
  }
  return {
    ideas: 0,
    items_by_status,
    draft: 0,
    in_review: 0,
    published_mtd: 0,
    scheduled_this_week: 0,
    in_review_sla_breach: 0,
  };
}

function mapIdeaRow(row: Record<string, unknown>): CmktIdeaRow {
  return {
    id: Number(row.id),
    lifecycle_id: Number(row.lifecycle_id),
    pillar_id: row.pillar_id != null ? Number(row.pillar_id) : null,
    title: String(row.title ?? ''),
    hook: String(row.hook ?? ''),
    target_goal: String(row.target_goal ?? ''),
    channel_hints: (row.channel_hints as string[]) ?? [],
    source: String(row.source ?? 'manual'),
    status: String(row.status ?? 'backlog'),
    meta_json: (row.meta_json as Record<string, unknown>) ?? {},
    created_by: String(row.created_by ?? ''),
    created_at: new Date(String(row.created_at)).toISOString(),
    updated_at: new Date(String(row.updated_at)).toISOString(),
  };
}

function mapJobRow(row: Record<string, unknown>): CmktJobRow {
  return {
    id: Number(row.id),
    lifecycle_id: Number(row.lifecycle_id),
    item_id: row.item_id != null ? Number(row.item_id) : null,
    job_type: String(row.job_type ?? ''),
    status: String(row.status ?? 'queued') as CmktJobRow['status'],
    input_json: (row.input_json as Record<string, unknown>) ?? {},
    output_json: (row.output_json as Record<string, unknown>) ?? {},
    error_text: row.error_text != null ? String(row.error_text) : null,
    ai_run_id: row.ai_run_id != null ? String(row.ai_run_id) : null,
    created_by: String(row.created_by ?? ''),
    created_at: new Date(String(row.created_at)).toISOString(),
    finished_at: row.finished_at ? new Date(String(row.finished_at)).toISOString() : null,
  };
}

function mapCalendarRow(row: Record<string, unknown>): CmktCalendarSlotRow {
  const itemJson = row.item_json as Record<string, unknown> | undefined;
  return {
    id: Number(row.id),
    lifecycle_id: Number(row.lifecycle_id),
    item_id: Number(row.item_id),
    scheduled_at: new Date(String(row.scheduled_at)).toISOString(),
    timezone: String(row.timezone ?? 'Asia/Ho_Chi_Minh'),
    reminder_sent: Boolean(row.reminder_sent),
    item: itemJson ? mapItemRow(itemJson) : undefined,
  };
}

function mapItemRow(row: Record<string, unknown>): CmktItemRow {
  return {
    id: Number(row.id),
    lifecycle_id: Number(row.lifecycle_id),
    idea_id: row.idea_id != null ? Number(row.idea_id) : null,
    parent_item_id: row.parent_item_id != null ? Number(row.parent_item_id) : null,
    master_id: row.master_id != null ? Number(row.master_id) : null,
    display_code: row.display_code != null ? String(row.display_code) : null,
    title: String(row.title ?? ''),
    format: String(row.format ?? ''),
    channel: String(row.channel ?? ''),
    funnel_goal: String(row.funnel_goal ?? ''),
    status: String(row.status ?? 'draft'),
    assignee_sp: row.assignee_sp != null ? Number(row.assignee_sp) : null,
    assignee_qa: row.assignee_qa != null ? Number(row.assignee_qa) : null,
    brief_json: (row.brief_json as Record<string, unknown>) ?? {},
    brief_score: row.brief_score != null ? Number(row.brief_score) : null,
    brief_locked_at: row.brief_locked_at ? new Date(String(row.brief_locked_at)).toISOString() : null,
    risk_level: row.risk_level != null ? String(row.risk_level) : 'Normal',
    body_json: (row.body_json as CmktBodyJson) ?? emptyBodyJson(),
    selected_variant_idx: row.selected_variant_idx != null ? Number(row.selected_variant_idx) : null,
    quality_score_json: (row.quality_score_json as Record<string, unknown>) ?? {},
    seo_bridge_id: row.seo_bridge_id != null ? Number(row.seo_bridge_id) : null,
    email_bridge_id: row.email_bridge_id != null ? Number(row.email_bridge_id) : null,
    production_json: (row.production_json as CmktItemRow['production_json']) ?? {},
    visual_status: String(row.visual_status ?? 'not_needed') as CmktItemRow['visual_status'],
    media_json: (row.media_json as CmktItemRow['media_json']) ?? {},
    published_url: row.published_url != null ? String(row.published_url) : null,
    published_at: row.published_at ? new Date(String(row.published_at)).toISOString() : null,
    due_at: row.due_at ? new Date(String(row.due_at)).toISOString() : null,
    in_review_at: row.in_review_at ? new Date(String(row.in_review_at)).toISOString() : null,
    created_by: String(row.created_by ?? ''),
    created_at: new Date(String(row.created_at)).toISOString(),
    updated_at: new Date(String(row.updated_at)).toISOString(),
  };
}

@Injectable()
export class ContentMarketingRepository implements OnModuleDestroy {
  private pool: Pool | null = null;
  private pgReady: boolean | null = null;
  private readonly memory: MemoryStore = {
    ideas: new Map(),
    items: new Map(),
    snapshots: new Map(),
    pillars: new Map(),
    jobs: new Map(),
    versions: new Map(),
    calendar: new Map(),
    comments: new Map(),
    metrics: new Map(),
    topicSuggestions: new Map(),
    derivations: [],
    nextIdeaId: 1,
    nextItemId: 1,
    nextSnapshotId: 1,
    nextPillarId: 1,
    nextJobId: 1,
    nextVersionId: 1,
    nextCalendarId: 1,
    nextCommentId: 1,
    nextMetricId: 1,
    nextDerivationId: 1,
    nextVersionNo: new Map(),
    plannerSources: new Map(),
    assetRights: new Map(),
    nextRightsId: 1,
    approvalPackages: new Map(),
    nextApprovalPackageId: 1,
    slaEvents: [],
    nextSlaEventId: 1,
    publicationLogs: [],
    nextPublicationLogId: 1,
  };

  constructor(private readonly config: AppConfigService) {}

  private get db(): Pool {
    if (!this.pool) {
      this.pool = new Pool({ connectionString: this.config.databaseUrl });
    }
    return this.pool;
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool?.end();
    this.pool = null;
  }

  async ensurePgReady(): Promise<boolean> {
    if (this.pgReady != null) return this.pgReady;
    try {
      await this.db.query(`SELECT 1 FROM cmkt_content_items LIMIT 1`);
      this.pgReady = true;
    } catch {
      this.pgReady = false;
    }
    return this.pgReady;
  }

  private bumpIdeaCount(lifecycleId: number, delta: number): void {
    const ideas = this.memory.ideas.get(lifecycleId) ?? [];
    if (delta > 0 && ideas.length === 0) {
      // count tracked via ideas array length in memory mode
    }
  }

  async getActiveSnapshotSummary(lifecycleId: number): Promise<CmktActiveSnapshotRow | null> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `SELECT s.id,
                s.sealed,
                s.ingested_at,
                s.marketing_plan_id,
                s.source_hash,
                s.ingested_by,
                s.snapshot_json,
                s.brand_context_json,
                COALESCE(p.cnt, 0)::int AS pillars_count
         FROM cmkt_plan_snapshots s
         LEFT JOIN LATERAL (
           SELECT COUNT(*) AS cnt
           FROM cmkt_content_pillars p
           WHERE p.lifecycle_id = s.lifecycle_id
             AND (p.snapshot_id = s.id OR p.snapshot_id IS NULL)
             AND p.active = TRUE
         ) p ON TRUE
         WHERE s.lifecycle_id = $1
         ORDER BY s.sealed ASC, s.ingested_at DESC
         LIMIT 1`,
        [lifecycleId],
      );
      const row = res.rows[0];
      if (!row) return null;
      return {
        id: Number(row.id),
        sealed: Boolean(row.sealed),
        ingested_at: row.ingested_at as Date,
        marketing_plan_id: row.marketing_plan_id != null ? Number(row.marketing_plan_id) : null,
        pillars_count: Number(row.pillars_count ?? 0),
        source_hash: String(row.source_hash ?? ''),
        ingested_by: String(row.ingested_by ?? ''),
        snapshot_json: (row.snapshot_json as Record<string, unknown>) ?? {},
        brand_context_json: (row.brand_context_json as Record<string, unknown>) ?? {},
      };
    }
    const list = this.memory.snapshots.get(lifecycleId) ?? [];
    const active = list.find((s) => !s.sealed) ?? list[0];
    return active ?? null;
  }

  async getActiveUnsealedSnapshot(lifecycleId: number): Promise<CmktActiveSnapshotRow | null> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `SELECT s.*, COALESCE(p.cnt, 0)::int AS pillars_count
         FROM cmkt_plan_snapshots s
         LEFT JOIN LATERAL (
           SELECT COUNT(*) AS cnt FROM cmkt_content_pillars p
           WHERE p.lifecycle_id = s.lifecycle_id AND p.snapshot_id = s.id AND p.active = TRUE
         ) p ON TRUE
         WHERE s.lifecycle_id = $1 AND s.sealed = FALSE
         ORDER BY s.ingested_at DESC
         LIMIT 1`,
        [lifecycleId],
      );
      const row = res.rows[0];
      if (!row) return null;
      return {
        id: Number(row.id),
        sealed: false,
        ingested_at: row.ingested_at as Date,
        marketing_plan_id: row.marketing_plan_id != null ? Number(row.marketing_plan_id) : null,
        pillars_count: Number(row.pillars_count ?? 0),
        source_hash: String(row.source_hash ?? ''),
        ingested_by: String(row.ingested_by ?? ''),
        snapshot_json: (row.snapshot_json as Record<string, unknown>) ?? {},
        brand_context_json: (row.brand_context_json as Record<string, unknown>) ?? {},
      };
    }
    return (this.memory.snapshots.get(lifecycleId) ?? []).find((s) => !s.sealed) ?? null;
  }

  async loadPlannerSource(lifecycleId: number): Promise<PlannerIngestSource | null> {
    if (await this.ensurePgReady()) {
      try {
        const res = await this.db.query(
          `SELECT lc.marketing_plan_id,
                  COALESCE(d.content_json, '{}'::jsonb) AS content_json,
                  COALESCE(d.campaigns_json, '[]'::jsonb) AS campaigns_json,
                  COALESCE(d.strategy_framework_json, '{}'::jsonb) AS strategy_framework_json,
                  COALESCE(d.target_market_prof_json, '{}'::jsonb) AS target_market_prof_json,
                  COALESCE(b.brief_json, '{}'::jsonb) AS brief_json
           FROM crm_service_lifecycle lc
           LEFT JOIN mkt_ai_drafts d ON d.lifecycle_id = lc.id
           LEFT JOIN mkt_ai_briefs b ON b.lifecycle_id = lc.id
           WHERE lc.id = $1`,
          [lifecycleId],
        );
        const row = res.rows[0];
        if (!row?.marketing_plan_id) return null;
        return {
          marketing_plan_id: Number(row.marketing_plan_id),
          brief_json: (row.brief_json as Record<string, unknown>) ?? {},
          content_json: (row.content_json as Record<string, unknown>) ?? {},
          campaigns_json: (row.campaigns_json as unknown[]) ?? [],
          strategy_framework_json: (row.strategy_framework_json as Record<string, unknown>) ?? {},
          target_market_prof_json: (row.target_market_prof_json as Record<string, unknown>) ?? {},
        };
      } catch {
        return this.memory.plannerSources.get(lifecycleId) ?? null;
      }
    }
    return this.memory.plannerSources.get(lifecycleId) ?? null;
  }

  /** Test/dev helper for memory mode smoke. */
  setPlannerSourceForMemory(lifecycleId: number, source: PlannerIngestSource): void {
    this.memory.plannerSources.set(lifecycleId, source);
  }

  async listPillars(lifecycleId: number, snapshotId?: number): Promise<CmktPillarRow[]> {
    if (await this.ensurePgReady()) {
      const params: unknown[] = [lifecycleId];
      let clause = 'lifecycle_id = $1 AND active = TRUE';
      if (snapshotId != null) {
        params.push(snapshotId);
        clause += ` AND snapshot_id = $${params.length}`;
      }
      const res = await this.db.query(
        `SELECT * FROM cmkt_content_pillars WHERE ${clause} ORDER BY sort_order ASC, id ASC`,
        params,
      );
      return res.rows.map((row) => ({
        id: Number(row.id),
        lifecycle_id: Number(row.lifecycle_id),
        snapshot_id: row.snapshot_id != null ? Number(row.snapshot_id) : null,
        name: String(row.name ?? ''),
        goal: String(row.goal ?? ''),
        topics_json: (row.topics_json as string[]) ?? [],
        sort_order: Number(row.sort_order ?? 0),
        active: Boolean(row.active),
      }));
    }
    let pillars = this.memory.pillars.get(lifecycleId) ?? [];
    if (snapshotId != null) pillars = pillars.filter((p) => p.snapshot_id === snapshotId);
    return pillars.filter((p) => p.active);
  }

  async upsertActiveSnapshot(input: {
    lifecycle_id: number;
    marketing_plan_id: number;
    snapshot_json: Record<string, unknown>;
    brand_context_json: Record<string, unknown>;
    source_hash: string;
    ingested_by: string;
  }): Promise<number> {
    if (await this.ensurePgReady()) {
      const existing = await this.getActiveUnsealedSnapshot(input.lifecycle_id);
      if (existing) {
        const res = await this.db.query(
          `UPDATE cmkt_plan_snapshots
           SET marketing_plan_id = $2,
               snapshot_json = $3::jsonb,
               brand_context_json = $4::jsonb,
               source_hash = $5,
               ingested_at = NOW(),
               ingested_by = $6
           WHERE id = $1
           RETURNING id`,
          [
            existing.id,
            input.marketing_plan_id,
            JSON.stringify(input.snapshot_json),
            JSON.stringify(input.brand_context_json),
            input.source_hash,
            input.ingested_by,
          ],
        );
        return Number(res.rows[0].id);
      }
      const res = await this.db.query(
        `INSERT INTO cmkt_plan_snapshots (
           lifecycle_id, marketing_plan_id, snapshot_json, brand_context_json,
           source_hash, ingested_by, sealed
         ) VALUES ($1,$2,$3::jsonb,$4::jsonb,$5,$6,FALSE)
         RETURNING id`,
        [
          input.lifecycle_id,
          input.marketing_plan_id,
          JSON.stringify(input.snapshot_json),
          JSON.stringify(input.brand_context_json),
          input.source_hash,
          input.ingested_by,
        ],
      );
      return Number(res.rows[0].id);
    }
    const now = new Date();
    const list = this.memory.snapshots.get(input.lifecycle_id) ?? [];
    const existing = list.find((s) => !s.sealed);
    if (existing) {
      existing.snapshot_json = input.snapshot_json;
      existing.brand_context_json = input.brand_context_json;
      existing.source_hash = input.source_hash;
      existing.ingested_by = input.ingested_by;
      existing.ingested_at = now;
      existing.marketing_plan_id = input.marketing_plan_id;
      return existing.id;
    }
    const row: CmktActiveSnapshotRow = {
      id: this.memory.nextSnapshotId++,
      sealed: false,
      ingested_at: now,
      marketing_plan_id: input.marketing_plan_id,
      pillars_count: 0,
      source_hash: input.source_hash,
      ingested_by: input.ingested_by,
      snapshot_json: input.snapshot_json,
      brand_context_json: input.brand_context_json,
    };
    list.push(row);
    this.memory.snapshots.set(input.lifecycle_id, list);
    return row.id;
  }

  async sealActiveSnapshot(lifecycleId: number): Promise<CmktActiveSnapshotRow | null> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `UPDATE cmkt_plan_snapshots SET sealed = TRUE
         WHERE lifecycle_id = $1 AND sealed = FALSE
         RETURNING *`,
        [lifecycleId],
      );
      const row = res.rows[0];
      if (!row) return null;
      return {
        id: Number(row.id),
        sealed: true,
        ingested_at: row.ingested_at as Date,
        marketing_plan_id: row.marketing_plan_id != null ? Number(row.marketing_plan_id) : null,
        pillars_count: 0,
        source_hash: String(row.source_hash ?? ''),
        ingested_by: String(row.ingested_by ?? ''),
        snapshot_json: (row.snapshot_json as Record<string, unknown>) ?? {},
        brand_context_json: (row.brand_context_json as Record<string, unknown>) ?? {},
      };
    }
    const list = this.memory.snapshots.get(lifecycleId) ?? [];
    const active = list.find((s) => !s.sealed);
    if (!active) return null;
    active.sealed = true;
    return active;
  }

  async replacePillarsForSnapshot(
    lifecycleId: number,
    snapshotId: number,
    pillars: SnapshotPillarDraft[],
  ): Promise<number> {
    if (await this.ensurePgReady()) {
      await this.db.query(
        `UPDATE cmkt_content_pillars SET active = FALSE
         WHERE lifecycle_id = $1 AND snapshot_id = $2`,
        [lifecycleId, snapshotId],
      );
      let count = 0;
      for (const pillar of pillars) {
        await this.db.query(
          `INSERT INTO cmkt_content_pillars (
             lifecycle_id, snapshot_id, name, goal, topics_json, sort_order, active
           ) VALUES ($1,$2,$3,$4,$5::jsonb,$6,TRUE)`,
          [
            lifecycleId,
            snapshotId,
            pillar.name,
            pillar.goal,
            JSON.stringify(pillar.topics),
            pillar.sort_order,
          ],
        );
        count++;
      }
      return count;
    }
    const list = (this.memory.pillars.get(lifecycleId) ?? []).map((p) =>
      p.snapshot_id === snapshotId ? { ...p, active: false } : p,
    );
    for (const pillar of pillars) {
      list.push({
        id: this.memory.nextPillarId++,
        lifecycle_id: lifecycleId,
        snapshot_id: snapshotId,
        name: pillar.name,
        goal: pillar.goal,
        topics_json: pillar.topics,
        sort_order: pillar.sort_order,
        active: true,
      });
    }
    this.memory.pillars.set(lifecycleId, list);
    return pillars.length;
  }

  async archivePlannerImportedIdeas(lifecycleId: number): Promise<number> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `UPDATE cmkt_content_ideas
         SET status = 'archived', updated_at = NOW()
         WHERE lifecycle_id = $1
           AND source = 'planner_import'
           AND status IN ('backlog', 'shortlisted')`,
        [lifecycleId],
      );
      return res.rowCount ?? 0;
    }
    const ideas = this.memory.ideas.get(lifecycleId) ?? [];
    let n = 0;
    for (const idea of ideas) {
      if (idea.source === 'planner_import' && ['backlog', 'shortlisted'].includes(idea.status)) {
        idea.status = 'archived';
        n++;
      }
    }
    return n;
  }

  async listIdeaTitleKeys(lifecycleId: number): Promise<Set<string>> {
    const ideas = await this.listIdeas(lifecycleId, {});
    const keys = new Set<string>();
    for (const idea of ideas) {
      if (idea.status !== 'archived') {
        keys.add(idea.title.trim().toLowerCase());
      }
    }
    return keys;
  }

  async createIdeaFromImport(
    lifecycleId: number,
    input: {
      title: string;
      hook: string;
      target_goal: string;
      channel_hints: string[];
      meta_json: Record<string, unknown>;
      created_by: string;
    },
  ): Promise<CmktIdeaRow> {
    return this.createIdea(lifecycleId, {
      ...input,
      pillar_id: null,
      status: 'backlog',
      source: 'planner_import',
    });
  }

  async getContextCounts(lifecycleId: number): Promise<CmktContextCounts> {
    if (await this.ensurePgReady()) {
      const [ideasRes, statusRes, slaRes] = await Promise.all([
        this.db.query(
          `SELECT COUNT(*)::int AS cnt
           FROM cmkt_content_ideas
           WHERE lifecycle_id = $1 AND status <> 'archived'`,
          [lifecycleId],
        ),
        this.db.query(
          `SELECT status, COUNT(*)::int AS cnt
           FROM cmkt_content_items
           WHERE lifecycle_id = $1
           GROUP BY status`,
          [lifecycleId],
        ),
        this.db.query(
          `SELECT COUNT(*)::int AS cnt
           FROM cmkt_content_items
           WHERE lifecycle_id = $1
             AND status = 'in_review'
             AND in_review_at IS NOT NULL
             AND in_review_at < NOW() - ($2::int * INTERVAL '1 hour')`,
          [lifecycleId, CMKT_REVIEW_SLA_HOURS],
        ),
      ]);

      const items_by_status = emptyCounts().items_by_status;
      for (const row of statusRes.rows) {
        const status = String(row.status);
        items_by_status[status] = Number(row.cnt ?? 0);
      }

      const draft = items_by_status.draft ?? 0;
      const in_review = items_by_status.in_review ?? 0;

      const mtdRes = await this.db.query(
        `SELECT COUNT(*)::int AS cnt
         FROM cmkt_content_items
         WHERE lifecycle_id = $1
           AND status = 'published'
           AND published_at IS NOT NULL
           AND published_at >= date_trunc('month', NOW())`,
        [lifecycleId],
      );

      const weekRes = await this.db.query(
        `SELECT COUNT(*)::int AS cnt
         FROM cmkt_calendar_slots
         WHERE lifecycle_id = $1
           AND scheduled_at >= date_trunc('week', NOW())
           AND scheduled_at < date_trunc('week', NOW()) + INTERVAL '7 days'`,
        [lifecycleId],
      );

      return {
        ideas: Number(ideasRes.rows[0]?.cnt ?? 0),
        items_by_status,
        draft,
        in_review,
        published_mtd: Number(mtdRes.rows[0]?.cnt ?? 0),
        scheduled_this_week: Number(weekRes.rows[0]?.cnt ?? 0),
        in_review_sla_breach: Number(slaRes.rows[0]?.cnt ?? 0),
      };
    }

    const ideas = (this.memory.ideas.get(lifecycleId) ?? []).filter((i) => i.status !== 'archived');
    const items = this.memory.items.get(lifecycleId) ?? [];
    const items_by_status = emptyCounts().items_by_status;
    for (const item of items) {
      items_by_status[item.status] = (items_by_status[item.status] ?? 0) + 1;
    }
    const now = Date.now();
    const slaMs = CMKT_REVIEW_SLA_HOURS * 3600 * 1000;
    const in_review_sla_breach = items.filter(
      (i) =>
        i.status === 'in_review' &&
        i.in_review_at &&
        now - new Date(i.in_review_at).getTime() > slaMs,
    ).length;

    const weekStart = new Date();
    weekStart.setHours(0, 0, 0, 0);
    const day = weekStart.getDay();
    const diffToMon = day === 0 ? -6 : 1 - day;
    weekStart.setDate(weekStart.getDate() + diffToMon);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const slots = this.memory.calendar.get(lifecycleId) ?? [];
    const scheduled_this_week = slots.filter((s) => {
      const t = new Date(s.scheduled_at).getTime();
      return t >= weekStart.getTime() && t < weekEnd.getTime();
    }).length;

    return {
      ideas: ideas.length,
      items_by_status,
      draft: items_by_status.draft ?? 0,
      in_review: items_by_status.in_review ?? 0,
      published_mtd: items.filter(
        (i) =>
          i.status === 'published' &&
          i.published_at &&
          new Date(i.published_at).getMonth() === new Date().getMonth(),
      ).length,
      scheduled_this_week,
      in_review_sla_breach,
    };
  }

  async listIdeas(
    lifecycleId: number,
    filters: { status?: string; pillar_id?: number },
  ): Promise<CmktIdeaRow[]> {
    if (await this.ensurePgReady()) {
      const clauses = ['lifecycle_id = $1'];
      const params: unknown[] = [lifecycleId];
      if (filters.status) {
        params.push(filters.status);
        clauses.push(`status = $${params.length}`);
      }
      if (filters.pillar_id != null) {
        params.push(filters.pillar_id);
        clauses.push(`pillar_id = $${params.length}`);
      }
      const res = await this.db.query(
        `SELECT * FROM cmkt_content_ideas
         WHERE ${clauses.join(' AND ')}
         ORDER BY updated_at DESC, id DESC`,
        params,
      );
      return res.rows.map((row) => mapIdeaRow(row));
    }
    let ideas = this.memory.ideas.get(lifecycleId) ?? [];
    if (filters.status) ideas = ideas.filter((i) => i.status === filters.status);
    if (filters.pillar_id != null) ideas = ideas.filter((i) => i.pillar_id === filters.pillar_id);
    return [...ideas].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }

  async getIdeaById(lifecycleId: number, ideaId: number): Promise<CmktIdeaRow | null> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `SELECT * FROM cmkt_content_ideas WHERE lifecycle_id = $1 AND id = $2`,
        [lifecycleId, ideaId],
      );
      return res.rows[0] ? mapIdeaRow(res.rows[0]) : null;
    }
    return (this.memory.ideas.get(lifecycleId) ?? []).find((i) => i.id === ideaId) ?? null;
  }

  async createIdea(
    lifecycleId: number,
    input: {
      title: string;
      hook: string;
      target_goal: string;
      channel_hints: string[];
      pillar_id: number | null;
      status: string;
      meta_json: Record<string, unknown>;
      source: string;
      created_by: string;
    },
  ): Promise<CmktIdeaRow> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `INSERT INTO cmkt_content_ideas (
           lifecycle_id, pillar_id, title, hook, target_goal, channel_hints,
           source, status, meta_json, created_by
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         RETURNING *`,
        [
          lifecycleId,
          input.pillar_id,
          input.title,
          input.hook,
          input.target_goal,
          input.channel_hints,
          input.source,
          input.status,
          JSON.stringify(input.meta_json),
          input.created_by,
        ],
      );
      return mapIdeaRow(res.rows[0]);
    }
    const now = new Date().toISOString();
    const row: CmktIdeaRow = {
      id: this.memory.nextIdeaId++,
      lifecycle_id: lifecycleId,
      pillar_id: input.pillar_id,
      title: input.title,
      hook: input.hook,
      target_goal: input.target_goal,
      channel_hints: input.channel_hints,
      source: input.source,
      status: input.status,
      meta_json: input.meta_json,
      created_by: input.created_by,
      created_at: now,
      updated_at: now,
    };
    const list = this.memory.ideas.get(lifecycleId) ?? [];
    list.push(row);
    this.memory.ideas.set(lifecycleId, list);
    this.bumpIdeaCount(lifecycleId, 1);
    return row;
  }

  async patchIdea(
    lifecycleId: number,
    ideaId: number,
    patch: Record<string, unknown>,
  ): Promise<CmktIdeaRow> {
    if (await this.ensurePgReady()) {
      const sets: string[] = ['updated_at = NOW()'];
      const params: unknown[] = [lifecycleId, ideaId];
      for (const [key, value] of Object.entries(patch)) {
        params.push(key === 'meta_json' ? JSON.stringify(value) : value);
        sets.push(`${key} = $${params.length}`);
      }
      const res = await this.db.query(
        `UPDATE cmkt_content_ideas SET ${sets.join(', ')}
         WHERE lifecycle_id = $1 AND id = $2
         RETURNING *`,
        params,
      );
      return mapIdeaRow(res.rows[0]);
    }
    const list = this.memory.ideas.get(lifecycleId) ?? [];
    const idx = list.findIndex((i) => i.id === ideaId);
    if (idx < 0) throw new Error('idea_not_found');
    const updated = {
      ...list[idx],
      ...patch,
      meta_json: (patch.meta_json as Record<string, unknown>) ?? list[idx].meta_json,
      updated_at: new Date().toISOString(),
    } as CmktIdeaRow;
    list[idx] = updated;
    return updated;
  }

  async listItems(
    lifecycleId: number,
    filters: { status?: string; format?: string; assignee?: number },
  ): Promise<CmktItemRow[]> {
    if (await this.ensurePgReady()) {
      const clauses = ['lifecycle_id = $1'];
      const params: unknown[] = [lifecycleId];
      if (filters.status) {
        params.push(filters.status);
        clauses.push(`status = $${params.length}`);
      }
      if (filters.format) {
        params.push(filters.format);
        clauses.push(`format = $${params.length}`);
      }
      if (filters.assignee != null) {
        params.push(filters.assignee);
        clauses.push(`assignee_sp = $${params.length}`);
      }
      const res = await this.db.query(
        `SELECT * FROM cmkt_content_items
         WHERE ${clauses.join(' AND ')}
         ORDER BY updated_at DESC, id DESC`,
        params,
      );
      return res.rows.map((row) => mapItemRow(row));
    }
    let items = this.memory.items.get(lifecycleId) ?? [];
    if (filters.status) items = items.filter((i) => i.status === filters.status);
    if (filters.format) items = items.filter((i) => i.format === filters.format);
    if (filters.assignee != null) items = items.filter((i) => i.assignee_sp === filters.assignee);
    return [...items].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }

  async getItemById(lifecycleId: number, itemId: number): Promise<CmktItemRow | null> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `SELECT * FROM cmkt_content_items WHERE lifecycle_id = $1 AND id = $2`,
        [lifecycleId, itemId],
      );
      return res.rows[0] ? mapItemRow(res.rows[0]) : null;
    }
    return (this.memory.items.get(lifecycleId) ?? []).find((i) => i.id === itemId) ?? null;
  }

  async findItemById(itemId: number): Promise<CmktItemRow | null> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(`SELECT * FROM cmkt_content_items WHERE id = $1`, [itemId]);
      return res.rows[0] ? mapItemRow(res.rows[0]) : null;
    }
    for (const items of this.memory.items.values()) {
      const found = items.find((i) => i.id === itemId);
      if (found) return found;
    }
    return null;
  }

  async nextItemSeq(now = new Date()): Promise<number> {
    return nextDisplaySeq(
      (sql, values) => this.db.query(sql, values),
      formatContentItemCode(now, 0),
      'cmkt_content_items',
    );
  }

  async createItem(
    lifecycleId: number,
    input: {
      title: string;
      channel: string;
      format: string;
      funnel_goal: string;
      idea_id: number | null;
      brief_json: Record<string, unknown>;
      body_json: CmktBodyJson;
      created_by: string;
      master_id?: number | null;
      display_code?: string | null;
    },
  ): Promise<CmktItemRow> {
    if (await this.ensurePgReady()) {
      const cols = [
        'lifecycle_id',
        'idea_id',
        'title',
        'format',
        'channel',
        'funnel_goal',
        'status',
        'brief_json',
        'body_json',
        'created_by',
      ];
      const vals: unknown[] = [
        lifecycleId,
        input.idea_id,
        input.title,
        input.format,
        input.channel,
        input.funnel_goal,
        'draft',
        JSON.stringify(input.brief_json),
        JSON.stringify(input.body_json),
        input.created_by,
      ];
      if ('master_id' in input) {
        cols.push('master_id');
        vals.push(input.master_id ?? null);
      }
      if (input.display_code != null) {
        cols.push('display_code');
        vals.push(input.display_code);
      }
      const placeholders = vals.map((_, i) => `$${i + 1}`).join(',');
      const res = await this.db.query(
        `INSERT INTO cmkt_content_items (${cols.join(', ')}) VALUES (${placeholders}) RETURNING *`,
        vals,
      );
      const item = mapItemRow(res.rows[0]);
      await this.insertItemVersion(item.id, item.body_json, input.created_by, 'manual');
      return item;
    }
    const now = new Date().toISOString();
    const row: CmktItemRow = {
      id: this.memory.nextItemId++,
      lifecycle_id: lifecycleId,
      idea_id: input.idea_id,
      parent_item_id: null,
      master_id: 'master_id' in input ? (input.master_id ?? null) : null,
      display_code: input.display_code ?? null,
      title: input.title,
      format: input.format,
      channel: input.channel,
      funnel_goal: input.funnel_goal,
      status: 'draft',
      assignee_sp: null,
      assignee_qa: null,
      brief_json: input.brief_json,
      body_json: input.body_json,
      selected_variant_idx: null,
      quality_score_json: {},
      seo_bridge_id: null,
      email_bridge_id: null,
      production_json: {},
      visual_status: 'not_needed',
      media_json: {},
      published_url: null,
      published_at: null,
      due_at: null,
      in_review_at: null,
      created_by: input.created_by,
      created_at: now,
      updated_at: now,
    };
    const list = this.memory.items.get(lifecycleId) ?? [];
    list.push(row);
    this.memory.items.set(lifecycleId, list);
    this.memory.nextVersionNo.set(row.id, 1);
    return row;
  }

  async patchItem(
    lifecycleId: number,
    itemId: number,
    patch: Record<string, unknown>,
  ): Promise<CmktItemRow> {
    if (await this.ensurePgReady()) {
      const sets: string[] = ['updated_at = NOW()'];
      const params: unknown[] = [lifecycleId, itemId];
      for (const [key, value] of Object.entries(patch)) {
        const serialized =
          key === 'body_json' ||
          key === 'brief_json' ||
          key === 'quality_score_json' ||
          key === 'production_json' ||
          key === 'media_json'
            ? JSON.stringify(value)
            : value;
        params.push(serialized);
        sets.push(`${key} = $${params.length}`);
      }
      const res = await this.db.query(
        `UPDATE cmkt_content_items SET ${sets.join(', ')}
         WHERE lifecycle_id = $1 AND id = $2
         RETURNING *`,
        params,
      );
      return mapItemRow(res.rows[0]);
    }
    const list = this.memory.items.get(lifecycleId) ?? [];
    const idx = list.findIndex((i) => i.id === itemId);
    if (idx < 0) throw new Error('item_not_found');
    const updated = {
      ...list[idx],
      ...patch,
      body_json: (patch.body_json as CmktBodyJson) ?? list[idx].body_json,
      brief_json: (patch.brief_json as Record<string, unknown>) ?? list[idx].brief_json,
      production_json:
        (patch.production_json as CmktItemRow['production_json']) ?? list[idx].production_json,
      media_json: (patch.media_json as CmktItemRow['media_json']) ?? list[idx].media_json,
      visual_status:
        (patch.visual_status as CmktItemRow['visual_status']) ?? list[idx].visual_status,
      updated_at: new Date().toISOString(),
    } as CmktItemRow;
    list[idx] = updated;
    return updated;
  }

  async insertItemVersion(
    itemId: number,
    bodyJson: CmktBodyJson,
    changedBy: string,
    changeReason: string,
    aiRunId?: string | null,
  ): Promise<number> {
    if (await this.ensurePgReady()) {
      const verRes = await this.db.query(
        `SELECT COALESCE(MAX(version_no), 0)::int AS max_v FROM cmkt_content_item_versions WHERE item_id = $1`,
        [itemId],
      );
      const versionNo = Number(verRes.rows[0]?.max_v ?? 0) + 1;
      await this.db.query(
        `INSERT INTO cmkt_content_item_versions (item_id, version_no, body_json, changed_by, change_reason, ai_run_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [itemId, versionNo, JSON.stringify(bodyJson), changedBy, changeReason, aiRunId ?? null],
      );
      return versionNo;
    }
    const versionNo = (this.memory.nextVersionNo.get(itemId) ?? 0) + 1;
    this.memory.nextVersionNo.set(itemId, versionNo);
    const list = this.memory.versions.get(itemId) ?? [];
    list.push({
      id: this.memory.nextVersionId++,
      item_id: itemId,
      version_no: versionNo,
      body_json: bodyJson,
      changed_by: changedBy,
      change_reason: changeReason,
      ai_run_id: aiRunId ?? null,
      created_at: new Date().toISOString(),
    });
    this.memory.versions.set(itemId, list);
    return versionNo;
  }

  async listItemVersions(itemId: number): Promise<CmktItemVersionRow[]> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `SELECT id, item_id, version_no, body_json, changed_by, change_reason,
                ai_run_id::text AS ai_run_id, created_at
         FROM cmkt_content_item_versions
         WHERE item_id = $1
         ORDER BY version_no DESC`,
        [itemId],
      );
      return res.rows.map((row) => ({
        id: Number(row.id),
        item_id: Number(row.item_id),
        version_no: Number(row.version_no),
        body_json: (row.body_json as CmktBodyJson) ?? emptyBodyJson(),
        changed_by: String(row.changed_by ?? ''),
        change_reason: String(row.change_reason ?? ''),
        ai_run_id: row.ai_run_id != null ? String(row.ai_run_id) : null,
        created_at: new Date(String(row.created_at)).toISOString(),
      }));
    }
    return [...(this.memory.versions.get(itemId) ?? [])].sort((a, b) => b.version_no - a.version_no);
  }

  async createContentJob(input: {
    lifecycle_id: number;
    item_id: number | null;
    job_type: string;
    input_json: Record<string, unknown>;
    created_by: string;
  }): Promise<CmktJobRow> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `INSERT INTO cmkt_content_jobs (lifecycle_id, item_id, job_type, status, input_json, created_by)
         VALUES ($1, $2, $3, 'queued', $4::jsonb, $5)
         RETURNING *`,
        [
          input.lifecycle_id,
          input.item_id,
          input.job_type,
          JSON.stringify(input.input_json),
          input.created_by,
        ],
      );
      return mapJobRow(res.rows[0]);
    }
    const now = new Date().toISOString();
    const row: CmktJobRow = {
      id: this.memory.nextJobId++,
      lifecycle_id: input.lifecycle_id,
      item_id: input.item_id,
      job_type: input.job_type,
      status: 'queued',
      input_json: input.input_json,
      output_json: {},
      error_text: null,
      ai_run_id: null,
      created_by: input.created_by,
      created_at: now,
      finished_at: null,
    };
    this.memory.jobs.set(row.id, row);
    return row;
  }

  async getContentJob(lifecycleId: number, jobId: number): Promise<CmktJobRow | null> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `SELECT * FROM cmkt_content_jobs WHERE lifecycle_id = $1 AND id = $2`,
        [lifecycleId, jobId],
      );
      return res.rows[0] ? mapJobRow(res.rows[0]) : null;
    }
    const job = this.memory.jobs.get(jobId);
    return job && job.lifecycle_id === lifecycleId ? job : null;
  }

  async claimContentJob(jobId: number): Promise<CmktJobRow | null> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `UPDATE cmkt_content_jobs SET status = 'running'
         WHERE id = $1 AND status = 'queued'
         RETURNING *`,
        [jobId],
      );
      return res.rows[0] ? mapJobRow(res.rows[0]) : null;
    }
    const job = this.memory.jobs.get(jobId);
    if (!job || job.status !== 'queued') return null;
    job.status = 'running';
    return job;
  }

  async finishContentJob(
    jobId: number,
    patch: {
      status: CmktJobRow['status'];
      output_json?: Record<string, unknown>;
      error_text?: string | null;
      ai_run_id?: string | null;
    },
  ): Promise<CmktJobRow | null> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `UPDATE cmkt_content_jobs
         SET status = $2,
             output_json = COALESCE($3::jsonb, output_json),
             error_text = $4,
             ai_run_id = $5::uuid,
             finished_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [
          jobId,
          patch.status,
          patch.output_json != null ? JSON.stringify(patch.output_json) : null,
          patch.error_text ?? null,
          patch.ai_run_id ?? null,
        ],
      );
      return res.rows[0] ? mapJobRow(res.rows[0]) : null;
    }
    const job = this.memory.jobs.get(jobId);
    if (!job) return null;
    job.status = patch.status;
    if (patch.output_json) job.output_json = patch.output_json;
    job.error_text = patch.error_text ?? null;
    job.ai_run_id = patch.ai_run_id ?? null;
    job.finished_at = new Date().toISOString();
    return job;
  }

  async cancelContentJob(lifecycleId: number, jobId: number): Promise<CmktJobRow | null> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `UPDATE cmkt_content_jobs SET status = 'cancelled', finished_at = NOW()
         WHERE lifecycle_id = $1 AND id = $2 AND status IN ('queued', 'running')
         RETURNING *`,
        [lifecycleId, jobId],
      );
      return res.rows[0] ? mapJobRow(res.rows[0]) : null;
    }
    const job = this.memory.jobs.get(jobId);
    if (!job || job.lifecycle_id !== lifecycleId || !['queued', 'running'].includes(job.status)) {
      return null;
    }
    job.status = 'cancelled';
    job.finished_at = new Date().toISOString();
    return job;
  }

  async listReviewQueue(
    lifecycleId: number,
    filters: { sla_breach?: boolean; channel?: string },
  ): Promise<CmktReviewQueueItem[]> {
    const items = await this.listItems(lifecycleId, { status: 'in_review' });
    let rows: CmktReviewQueueItem[] = items.map((item) => ({
      ...item,
      sla_breach: isReviewSlaBreach(item.in_review_at),
    }));
    if (filters.channel) rows = rows.filter((r) => r.channel === filters.channel);
    if (filters.sla_breach) rows = rows.filter((r) => r.sla_breach);
    rows.sort((a, b) => {
      if (a.sla_breach !== b.sla_breach) return a.sla_breach ? -1 : 1;
      const ta = a.in_review_at ? new Date(a.in_review_at).getTime() : 0;
      const tb = b.in_review_at ? new Date(b.in_review_at).getTime() : 0;
      return ta - tb;
    });
    return rows;
  }

  async getReviewQueueSummary(lifecycleId: number): Promise<CmktReviewQueueSummary> {
    const rows = await this.listReviewQueue(lifecycleId, {});
    const by_channel: Record<string, number> = {};
    const now = Date.now();
    let maxHours: number | null = null;
    let sumHours = 0;
    let counted = 0;
    for (const row of rows) {
      by_channel[row.channel] = (by_channel[row.channel] ?? 0) + 1;
      if (row.in_review_at) {
        const hours = (now - new Date(row.in_review_at).getTime()) / 3600000;
        sumHours += hours;
        counted += 1;
        if (maxHours == null || hours > maxHours) maxHours = hours;
      }
    }
    return {
      total: rows.length,
      sla_breach: rows.filter((r) => r.sla_breach).length,
      by_channel,
      sla_target_hours: CMKT_REVIEW_SLA_HOURS,
      max_hours_in_review: maxHours != null ? Math.round(maxHours * 10) / 10 : null,
      avg_hours_in_review: counted ? Math.round((sumHours / counted) * 10) / 10 : null,
    };
  }

  async listCalendarSlots(
    lifecycleId: number,
    range?: { from?: string; to?: string },
  ): Promise<CmktCalendarSlotRow[]> {
    if (await this.ensurePgReady()) {
      const params: unknown[] = [lifecycleId];
      let clause = 's.lifecycle_id = $1';
      if (range?.from) {
        params.push(range.from);
        clause += ` AND s.scheduled_at >= $${params.length}::timestamptz`;
      }
      if (range?.to) {
        params.push(range.to);
        clause += ` AND s.scheduled_at <= $${params.length}::timestamptz`;
      }
      const res = await this.db.query(
        `SELECT s.*
         FROM cmkt_calendar_slots s
         WHERE ${clause}
         ORDER BY s.scheduled_at ASC`,
        params,
      );
      return res.rows.map((row) => mapCalendarRow(row));
    }
    let slots = this.memory.calendar.get(lifecycleId) ?? [];
    if (range?.from) {
      const fromMs = new Date(range.from).getTime();
      slots = slots.filter((s) => new Date(s.scheduled_at).getTime() >= fromMs);
    }
    if (range?.to) {
      const toMs = new Date(range.to).getTime();
      slots = slots.filter((s) => new Date(s.scheduled_at).getTime() <= toMs);
    }
    return [...slots].sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
  }

  async upsertCalendarSlot(input: {
    lifecycle_id: number;
    item_id: number;
    scheduled_at: string;
    timezone?: string;
  }): Promise<CmktCalendarSlotRow> {
    const tz = input.timezone ?? 'Asia/Ho_Chi_Minh';
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `INSERT INTO cmkt_calendar_slots (lifecycle_id, item_id, scheduled_at, timezone)
         VALUES ($1, $2, $3::timestamptz, $4)
         ON CONFLICT (item_id) DO UPDATE SET scheduled_at = EXCLUDED.scheduled_at, timezone = EXCLUDED.timezone
         RETURNING *`,
        [input.lifecycle_id, input.item_id, input.scheduled_at, tz],
      );
      return mapCalendarRow(res.rows[0]);
    }
    const list = this.memory.calendar.get(input.lifecycle_id) ?? [];
    const idx = list.findIndex((s) => s.item_id === input.item_id);
    const row: CmktCalendarSlotRow = {
      id: idx >= 0 ? list[idx].id : this.memory.nextCalendarId++,
      lifecycle_id: input.lifecycle_id,
      item_id: input.item_id,
      scheduled_at: new Date(input.scheduled_at).toISOString(),
      timezone: tz,
      reminder_sent: false,
    };
    if (idx >= 0) list[idx] = row;
    else list.push(row);
    this.memory.calendar.set(input.lifecycle_id, list);
    return row;
  }

  async deleteCalendarSlot(lifecycleId: number, itemId: number): Promise<boolean> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `DELETE FROM cmkt_calendar_slots WHERE lifecycle_id = $1 AND item_id = $2`,
        [lifecycleId, itemId],
      );
      return (res.rowCount ?? 0) > 0;
    }
    const list = this.memory.calendar.get(lifecycleId) ?? [];
    const next = list.filter((s) => s.item_id !== itemId);
    this.memory.calendar.set(lifecycleId, next);
    return next.length !== list.length;
  }

  async insertItemComment(input: {
    item_id: number;
    author_id: string;
    body: string;
    visibility?: string;
  }): Promise<void> {
    await this.insertItemCommentReturning(input);
  }

  async insertItemCommentReturning(input: {
    item_id: number;
    author_id: string;
    body: string;
    visibility?: string;
  }): Promise<CmktCommentRow> {
    const visibility = input.visibility ?? 'internal';
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `INSERT INTO cmkt_content_comments (item_id, author_id, body, visibility)
         VALUES ($1, $2, $3, $4)
         RETURNING id, item_id, author_id, body, visibility, created_at`,
        [input.item_id, input.author_id, input.body, visibility],
      );
      const row = res.rows[0];
      return {
        id: Number(row.id),
        item_id: Number(row.item_id),
        author_id: String(row.author_id ?? ''),
        body: String(row.body ?? ''),
        visibility: String(row.visibility ?? 'internal'),
        created_at: new Date(String(row.created_at)).toISOString(),
      };
    }
    const list = this.memory.comments.get(input.item_id) ?? [];
    const comment = {
      id: this.memory.nextCommentId++,
      item_id: input.item_id,
      author_id: input.author_id,
      body: input.body,
      visibility,
      created_at: new Date().toISOString(),
    };
    list.push(comment);
    this.memory.comments.set(input.item_id, list);
    return comment;
  }

  async listItemComments(itemId: number): Promise<CmktCommentRow[]> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `SELECT id, item_id, author_id, body, visibility, created_at
         FROM cmkt_content_comments
         WHERE item_id = $1
         ORDER BY created_at ASC, id ASC`,
        [itemId],
      );
      return res.rows.map((row) => ({
        id: Number(row.id),
        item_id: Number(row.item_id),
        author_id: String(row.author_id ?? ''),
        body: String(row.body ?? ''),
        visibility: String(row.visibility ?? 'internal'),
        created_at: new Date(String(row.created_at)).toISOString(),
      }));
    }
    return [...(this.memory.comments.get(itemId) ?? [])].sort((a, b) =>
      a.created_at.localeCompare(b.created_at),
    );
  }

  async staffExists(staffId: number): Promise<boolean> {
    if (!Number.isFinite(staffId) || staffId <= 0) return false;
    if (await this.ensurePgReady()) {
      try {
        const res = await this.db.query(
          `SELECT 1 FROM crm_staff WHERE id = $1 AND COALESCE(active, TRUE) = TRUE LIMIT 1`,
          [staffId],
        );
        return (res.rowCount ?? 0) > 0;
      } catch {
        return false;
      }
    }
    return staffId > 0 && staffId < 100000;
  }

  async getItemVersionByNo(itemId: number, versionNo: number): Promise<CmktItemVersionRow | null> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `SELECT id, item_id, version_no, body_json, changed_by, change_reason,
                ai_run_id::text AS ai_run_id, created_at
         FROM cmkt_content_item_versions
         WHERE item_id = $1 AND version_no = $2
         LIMIT 1`,
        [itemId, versionNo],
      );
      if (!res.rows[0]) return null;
      const row = res.rows[0];
      return {
        id: Number(row.id),
        item_id: Number(row.item_id),
        version_no: Number(row.version_no),
        body_json: row.body_json as CmktBodyJson,
        changed_by: String(row.changed_by ?? ''),
        change_reason: String(row.change_reason ?? ''),
        ai_run_id: row.ai_run_id != null ? String(row.ai_run_id) : null,
        created_at: new Date(String(row.created_at)).toISOString(),
      };
    }
    return (this.memory.versions.get(itemId) ?? []).find((v) => v.version_no === versionNo) ?? null;
  }

  async listAudit(lifecycleId: number, limit = 50): Promise<CmktAuditRow[]> {
    const cap = Math.min(Math.max(limit, 1), 200);
    if (await this.ensurePgReady()) {
      try {
        const res = await this.db.query(
          `SELECT v.item_id, i.title AS item_title, v.version_no, v.change_reason,
                  v.changed_by, v.created_at, v.ai_run_id::text AS ai_run_id,
                  r.agent_name, r.use_case
           FROM cmkt_content_item_versions v
           JOIN cmkt_content_items i ON i.id = v.item_id
           LEFT JOIN ai_agent_runs r ON r.id = v.ai_run_id
           WHERE i.lifecycle_id = $1
           ORDER BY v.created_at DESC
           LIMIT $2`,
          [lifecycleId, cap],
        );
        return res.rows.map((row) => ({
          item_id: Number(row.item_id),
          item_title: String(row.item_title ?? ''),
          version_no: Number(row.version_no),
          change_reason: String(row.change_reason ?? ''),
          changed_by: String(row.changed_by ?? ''),
          created_at: new Date(String(row.created_at)).toISOString(),
          ai_run_id: row.ai_run_id != null ? String(row.ai_run_id) : null,
          agent_name: row.agent_name != null ? String(row.agent_name) : null,
          use_case: row.use_case != null ? String(row.use_case) : null,
        }));
      } catch {
        /* fall through to versions-only query */
      }
      const res = await this.db.query(
        `SELECT v.item_id, i.title AS item_title, v.version_no, v.change_reason,
                v.changed_by, v.created_at, v.ai_run_id::text AS ai_run_id
         FROM cmkt_content_item_versions v
         JOIN cmkt_content_items i ON i.id = v.item_id
         WHERE i.lifecycle_id = $1
         ORDER BY v.created_at DESC
         LIMIT $2`,
        [lifecycleId, cap],
      );
      return res.rows.map((row) => ({
        item_id: Number(row.item_id),
        item_title: String(row.item_title ?? ''),
        version_no: Number(row.version_no),
        change_reason: String(row.change_reason ?? ''),
        changed_by: String(row.changed_by ?? ''),
        created_at: new Date(String(row.created_at)).toISOString(),
        ai_run_id: row.ai_run_id != null ? String(row.ai_run_id) : null,
      }));
    }
    const items = this.memory.items.get(lifecycleId) ?? [];
    const titleById = new Map(items.map((i) => [i.id, i.title]));
    const rows: CmktAuditRow[] = [];
    for (const item of items) {
      for (const v of this.memory.versions.get(item.id) ?? []) {
        rows.push({
          item_id: item.id,
          item_title: titleById.get(item.id) ?? '',
          version_no: v.version_no,
          change_reason: v.change_reason,
          changed_by: v.changed_by,
          created_at: v.created_at,
          ai_run_id: v.ai_run_id ?? null,
        });
      }
    }
    return rows.sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, cap);
  }

  async createDerivedItem(
    lifecycleId: number,
    input: {
      parent_item_id: number;
      title: string;
      channel: string;
      format: string;
      funnel_goal: string;
      brief_json: Record<string, unknown>;
      created_by: string;
      master_id?: number | null;
    },
  ): Promise<CmktItemRow> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `INSERT INTO cmkt_content_items (
           lifecycle_id, parent_item_id, title, format, channel, funnel_goal, status,
           brief_json, body_json, created_by, master_id
         ) VALUES ($1,$2,$3,$4,$5,$6,'draft',$7,$8,$9,$10)
         RETURNING *`,
        [
          lifecycleId,
          input.parent_item_id,
          input.title,
          input.format,
          input.channel,
          input.funnel_goal,
          JSON.stringify(input.brief_json),
          JSON.stringify(emptyBodyJson()),
          input.created_by,
          input.master_id ?? null,
        ],
      );
      const item = mapItemRow(res.rows[0]);
      await this.insertItemVersion(item.id, item.body_json, input.created_by, 'repurpose');
      return item;
    }
    const now = new Date().toISOString();
    const row: CmktItemRow = {
      id: this.memory.nextItemId++,
      lifecycle_id: lifecycleId,
      idea_id: null,
      parent_item_id: input.parent_item_id,
      master_id: input.master_id ?? null,
      title: input.title,
      format: input.format,
      channel: input.channel,
      funnel_goal: input.funnel_goal,
      status: 'draft',
      assignee_sp: null,
      assignee_qa: null,
      brief_json: input.brief_json,
      body_json: emptyBodyJson(),
      selected_variant_idx: null,
      quality_score_json: {},
      seo_bridge_id: null,
      email_bridge_id: null,
      production_json: {},
      visual_status: 'not_needed',
      media_json: {},
      published_url: null,
      published_at: null,
      due_at: null,
      in_review_at: null,
      created_by: input.created_by,
      created_at: now,
      updated_at: now,
    };
    const list = this.memory.items.get(lifecycleId) ?? [];
    list.push(row);
    this.memory.items.set(lifecycleId, list);
    this.memory.nextVersionNo.set(row.id, 1);
    return row;
  }

  async insertDerivation(input: {
    source_item_id: number;
    derived_item_id: number;
    transform_type: string;
    prompt_profile: string;
  }): Promise<CmktDerivationRow> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `INSERT INTO cmkt_content_item_derivations (
           source_item_id, derived_item_id, transform_type, prompt_profile
         ) VALUES ($1,$2,$3,$4)
         RETURNING *`,
        [input.source_item_id, input.derived_item_id, input.transform_type, input.prompt_profile],
      );
      const row = res.rows[0];
      return {
        id: Number(row.id),
        source_item_id: Number(row.source_item_id),
        derived_item_id: Number(row.derived_item_id),
        transform_type: String(row.transform_type),
        prompt_profile: String(row.prompt_profile),
        created_at: new Date(String(row.created_at)).toISOString(),
      };
    }
    const row: CmktDerivationRow = {
      id: this.memory.nextDerivationId++,
      source_item_id: input.source_item_id,
      derived_item_id: input.derived_item_id,
      transform_type: input.transform_type,
      prompt_profile: input.prompt_profile,
      created_at: new Date().toISOString(),
    };
    this.memory.derivations.push(row);
    return row;
  }

  async listDerivations(lifecycleId: number, sourceItemId: number): Promise<CmktDerivationRow[]> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `SELECT d.*, row_to_json(i.*) AS derived_item_json
         FROM cmkt_content_item_derivations d
         JOIN cmkt_content_items i ON i.id = d.derived_item_id
         WHERE d.source_item_id = $1 AND i.lifecycle_id = $2
         ORDER BY d.created_at ASC, d.id ASC`,
        [sourceItemId, lifecycleId],
      );
      return res.rows.map((row) => ({
        id: Number(row.id),
        source_item_id: Number(row.source_item_id),
        derived_item_id: Number(row.derived_item_id),
        transform_type: String(row.transform_type),
        prompt_profile: String(row.prompt_profile),
        created_at: new Date(String(row.created_at)).toISOString(),
        derived_item: row.derived_item_json
          ? mapItemRow(row.derived_item_json as Record<string, unknown>)
          : undefined,
      }));
    }
    const items = this.memory.items.get(lifecycleId) ?? [];
    const byId = new Map(items.map((i) => [i.id, i]));
    return this.memory.derivations
      .filter((d) => d.source_item_id === sourceItemId && byId.has(d.derived_item_id))
      .map((d) => ({ ...d, derived_item: byId.get(d.derived_item_id) }));
  }

  async countMediaJobsToday(lifecycleId: number): Promise<number> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `SELECT COUNT(*)::int AS c FROM cmkt_content_jobs
         WHERE lifecycle_id = $1
           AND job_type IN ('image_generate', 'carousel_slides_generate', 'visual_qa_score')
           AND created_at >= date_trunc('day', NOW())`,
        [lifecycleId],
      );
      return Number(res.rows[0]?.c ?? 0);
    }
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    let count = 0;
    for (const job of this.memory.jobs.values()) {
      if (job.lifecycle_id !== lifecycleId) continue;
      if (!['image_generate', 'carousel_slides_generate', 'visual_qa_score'].includes(job.job_type)) {
        continue;
      }
      if (new Date(job.created_at).getTime() >= start.getTime()) count++;
    }
    return count;
  }

  async countSocialJobsToday(lifecycleId: number): Promise<number> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `SELECT COUNT(*)::int AS c FROM cmkt_content_jobs
         WHERE lifecycle_id = $1
           AND job_type IN ('social_storyboard', 'social_render', 'video_short_generate')
           AND created_at >= date_trunc('day', NOW())`,
        [lifecycleId],
      );
      return Number(res.rows[0]?.c ?? 0);
    }
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    let count = 0;
    for (const job of this.memory.jobs.values()) {
      if (job.lifecycle_id !== lifecycleId) continue;
      if (!['social_storyboard', 'social_render', 'video_short_generate'].includes(job.job_type)) {
        continue;
      }
      if (new Date(job.created_at).getTime() >= start.getTime()) count++;
    }
    return count;
  }

  async listVisualReviewQueue(lifecycleId: number): Promise<CmktVisualReviewItem[]> {
    const items = await this.listItems(lifecycleId, {});
    return items
      .filter((item) => item.visual_status === 'ai_ready')
      .map((item) => ({
        ...item,
        visual_qa_score: item.media_json?.visual_qa?.score ?? null,
      }))
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }

  private mapMetricRow(row: Record<string, unknown>): CmktMetricRow {
    return {
      id: Number(row.id),
      item_id: Number(row.item_id),
      channel: String(row.channel ?? ''),
      metric_date: String(row.metric_date ?? '').slice(0, 10),
      impressions: row.impressions != null ? Number(row.impressions) : null,
      engagements: row.engagements != null ? Number(row.engagements) : null,
      clicks: row.clicks != null ? Number(row.clicks) : null,
      leads: row.leads != null ? Number(row.leads) : null,
      source: String(row.source ?? 'manual'),
      raw_json: (row.raw_json as Record<string, unknown>) ?? {},
      created_at: new Date(String(row.created_at ?? Date.now())).toISOString(),
    };
  }

  async insertMetricReturning(input: {
    item_id: number;
    channel: string;
    metric_date: string;
    impressions: number | null;
    engagements: number | null;
    clicks: number | null;
    leads: number | null;
    source: string;
    raw_json: Record<string, unknown>;
  }): Promise<CmktMetricRow> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `INSERT INTO cmkt_content_metrics (
           item_id, channel, metric_date, impressions, engagements, clicks, leads, source, raw_json
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
         RETURNING *`,
        [
          input.item_id,
          input.channel,
          input.metric_date,
          input.impressions,
          input.engagements,
          input.clicks,
          input.leads,
          input.source,
          JSON.stringify(input.raw_json),
        ],
      );
      return this.mapMetricRow(res.rows[0]);
    }
    const metric: CmktMetricRow = {
      id: this.memory.nextMetricId++,
      item_id: input.item_id,
      channel: input.channel,
      metric_date: input.metric_date,
      impressions: input.impressions,
      engagements: input.engagements,
      clicks: input.clicks,
      leads: input.leads,
      source: input.source,
      raw_json: input.raw_json,
      created_at: new Date().toISOString(),
    };
    const list = this.memory.metrics.get(input.item_id) ?? [];
    list.push(metric);
    this.memory.metrics.set(input.item_id, list);
    return metric;
  }

  async getMetricById(itemId: number, metricId: number): Promise<CmktMetricRow | null> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `SELECT * FROM cmkt_content_metrics WHERE item_id = $1 AND id = $2`,
        [itemId, metricId],
      );
      return res.rows[0] ? this.mapMetricRow(res.rows[0]) : null;
    }
    return (this.memory.metrics.get(itemId) ?? []).find((m) => m.id === metricId) ?? null;
  }

  async patchMetric(
    itemId: number,
    metricId: number,
    patch: Partial<CmktMetricRow>,
  ): Promise<CmktMetricRow | null> {
    if (await this.ensurePgReady()) {
      const existing = await this.getMetricById(itemId, metricId);
      if (!existing) return null;
      const next = { ...existing, ...patch, id: existing.id, item_id: existing.item_id };
      const res = await this.db.query(
        `UPDATE cmkt_content_metrics
         SET channel = $3, metric_date = $4, impressions = $5, engagements = $6,
             clicks = $7, leads = $8
         WHERE item_id = $1 AND id = $2
         RETURNING *`,
        [
          itemId,
          metricId,
          next.channel,
          next.metric_date,
          next.impressions,
          next.engagements,
          next.clicks,
          next.leads,
        ],
      );
      return res.rows[0] ? this.mapMetricRow(res.rows[0]) : null;
    }
    const list = this.memory.metrics.get(itemId) ?? [];
    const idx = list.findIndex((m) => m.id === metricId);
    if (idx < 0) return null;
    list[idx] = { ...list[idx], ...patch, id: list[idx].id, item_id: list[idx].item_id };
    this.memory.metrics.set(itemId, list);
    return list[idx];
  }

  async listItemMetrics(itemId: number): Promise<CmktMetricRow[]> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `SELECT * FROM cmkt_content_metrics WHERE item_id = $1 ORDER BY metric_date DESC, id DESC`,
        [itemId],
      );
      return res.rows.map((row) => this.mapMetricRow(row));
    }
    return [...(this.memory.metrics.get(itemId) ?? [])].sort((a, b) =>
      b.metric_date.localeCompare(a.metric_date),
    );
  }

  async listLifecycleMetricsInRange(
    lifecycleId: number,
    fromDate: string,
    toDate: string,
  ): Promise<CmktMetricWithItemRow[]> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `SELECT m.*, i.title AS item_title, i.status AS item_status
         FROM cmkt_content_metrics m
         JOIN cmkt_content_items i ON i.id = m.item_id
         WHERE i.lifecycle_id = $1
           AND m.metric_date >= $2::date
           AND m.metric_date <= $3::date
         ORDER BY m.metric_date DESC, m.id DESC`,
        [lifecycleId, fromDate, toDate],
      );
      return res.rows.map((row) => ({
        ...this.mapMetricRow(row),
        item_title: String(row.item_title ?? ''),
        item_status: String(row.item_status ?? ''),
      }));
    }
    const items = this.memory.items.get(lifecycleId) ?? [];
    const itemById = new Map(items.map((i) => [i.id, i]));
    const out: CmktMetricWithItemRow[] = [];
    for (const item of items) {
      for (const metric of this.memory.metrics.get(item.id) ?? []) {
        if (metric.metric_date >= fromDate && metric.metric_date <= toDate) {
          out.push({
            ...metric,
            item_title: item.title,
            item_status: item.status,
          });
        }
      }
    }
    return out.sort((a, b) => b.metric_date.localeCompare(a.metric_date));
  }

  async countPublishedItemsByChannel(
    lifecycleId: number,
    fromDate: string,
    toDate: string,
  ): Promise<Record<string, number>> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `SELECT channel, COUNT(*)::int AS cnt
         FROM cmkt_content_items
         WHERE lifecycle_id = $1
           AND status = 'published'
           AND published_at IS NOT NULL
           AND published_at::date >= $2::date
           AND published_at::date <= $3::date
         GROUP BY channel`,
        [lifecycleId, fromDate, toDate],
      );
      const out: Record<string, number> = {};
      for (const row of res.rows) {
        out[String(row.channel)] = Number(row.cnt);
      }
      return out;
    }
    const out: Record<string, number> = {};
    for (const item of this.memory.items.get(lifecycleId) ?? []) {
      if (item.status !== 'published' || !item.published_at) continue;
      const day = item.published_at.slice(0, 10);
      if (day < fromDate || day > toDate) continue;
      out[item.channel] = (out[item.channel] ?? 0) + 1;
    }
    return out;
  }

  async getLatestTopicSuggestions(lifecycleId: number): Promise<string[]> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `SELECT output_json
         FROM cmkt_content_jobs
         WHERE lifecycle_id = $1
           AND job_type = 'topic_suggest'
           AND status = 'succeeded'
         ORDER BY finished_at DESC NULLS LAST, id DESC
         LIMIT 1`,
        [lifecycleId],
      );
      const output = res.rows[0]?.output_json as { suggestions?: string[] } | undefined;
      return Array.isArray(output?.suggestions) ? output!.suggestions! : [];
    }
    return this.memory.topicSuggestions.get(lifecycleId) ?? [];
  }

  async setLatestTopicSuggestions(lifecycleId: number, suggestions: string[]): Promise<void> {
    this.memory.topicSuggestions.set(lifecycleId, suggestions);
  }

  async getLatestJobOutput(
    lifecycleId: number,
    jobType: string,
  ): Promise<{ job_id: number; output_json: Record<string, unknown>; finished_at: string | null } | null> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `SELECT id, output_json, finished_at
         FROM cmkt_content_jobs
         WHERE lifecycle_id = $1
           AND job_type = $2
           AND status = 'succeeded'
         ORDER BY finished_at DESC NULLS LAST, id DESC
         LIMIT 1`,
        [lifecycleId, jobType],
      );
      const row = res.rows[0];
      if (!row) return null;
      return {
        job_id: Number(row.id),
        output_json: (row.output_json as Record<string, unknown>) ?? {},
        finished_at: row.finished_at ? new Date(row.finished_at).toISOString() : null,
      };
    }
    let latest: { job_id: number; output_json: Record<string, unknown>; finished_at: string | null } | null =
      null;
    for (const job of this.memory.jobs.values()) {
      if (job.lifecycle_id !== lifecycleId || job.job_type !== jobType || job.status !== 'succeeded') {
        continue;
      }
      if (!latest || job.id > latest.job_id) {
        latest = {
          job_id: job.id,
          output_json: job.output_json ?? {},
          finished_at: job.finished_at,
        };
      }
    }
    return latest;
  }

  async getLatestWeeklyMemo(lifecycleId: number): Promise<CmktWeeklyMemoPreview | null> {
    const row = await this.getLatestJobOutput(lifecycleId, 'weekly_memo');
    if (!row) return null;
    const memo = row.output_json?.memo as { title?: string; body_vi?: string } | undefined;
    if (!memo?.body_vi) return null;
    return {
      title: String(memo.title ?? 'Weekly content memo'),
      body_vi: String(memo.body_vi),
      generated_at: row.finished_at ?? new Date().toISOString(),
      job_id: row.job_id,
    };
  }

  async getPillarById(lifecycleId: number, pillarId: number): Promise<CmktPillarRow | null> {
    const pillars = await this.listPillars(lifecycleId);
    return pillars.find((p) => p.id === pillarId) ?? null;
  }

  async patchPillar(
    lifecycleId: number,
    pillarId: number,
    patch: Partial<CmktPillarRow>,
  ): Promise<CmktPillarRow | null> {
    if (await this.ensurePgReady()) {
      const existing = await this.getPillarById(lifecycleId, pillarId);
      if (!existing) return null;
      const next = { ...existing, ...patch, id: existing.id, lifecycle_id: existing.lifecycle_id };
      const res = await this.db.query(
        `UPDATE cmkt_content_pillars
         SET name = $3, goal = $4, topics_json = $5::jsonb, sort_order = $6
         WHERE lifecycle_id = $1 AND id = $2 AND active = TRUE
         RETURNING *`,
        [
          lifecycleId,
          pillarId,
          next.name,
          next.goal,
          JSON.stringify(next.topics_json ?? []),
          next.sort_order,
        ],
      );
      if (!res.rows[0]) return null;
      return {
        id: Number(res.rows[0].id),
        lifecycle_id: Number(res.rows[0].lifecycle_id),
        snapshot_id: res.rows[0].snapshot_id != null ? Number(res.rows[0].snapshot_id) : null,
        name: String(res.rows[0].name ?? ''),
        goal: String(res.rows[0].goal ?? ''),
        topics_json: (res.rows[0].topics_json as string[]) ?? [],
        sort_order: Number(res.rows[0].sort_order ?? 0),
        active: Boolean(res.rows[0].active),
      };
    }
    const list = this.memory.pillars.get(lifecycleId) ?? [];
    const idx = list.findIndex((p) => p.id === pillarId && p.active);
    if (idx < 0) return null;
    list[idx] = { ...list[idx], ...patch, id: list[idx].id, lifecycle_id: list[idx].lifecycle_id };
    this.memory.pillars.set(lifecycleId, list);
    return list[idx];
  }

  async listAssetRights(itemId: number): Promise<CmktAssetRightRow[]> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `SELECT id, item_id, asset_ref, license_type, channels, territory, expiry_at,
                paid_ok, releases_ok, ai_declaration, status, created_at
         FROM cmkt_asset_rights
         WHERE item_id = $1
         ORDER BY id ASC`,
        [itemId],
      );
      return res.rows.map((row) => mapAssetRightRow(row as Record<string, unknown>));
    }
    return [...(this.memory.assetRights.get(itemId) ?? [])].sort((a, b) => a.id - b.id);
  }

  async replaceAssetRights(itemId: number, rows: CmktAssetRightWrite[]): Promise<CmktAssetRightRow[]> {
    if (await this.ensurePgReady()) {
      const client = await this.db.connect();
      try {
        await client.query('BEGIN');
        await client.query(`DELETE FROM cmkt_asset_rights WHERE item_id = $1`, [itemId]);
        const inserted: CmktAssetRightRow[] = [];
        for (const row of rows) {
          const res = await client.query(
            `INSERT INTO cmkt_asset_rights
               (item_id, asset_ref, license_type, channels, territory, expiry_at,
                paid_ok, releases_ok, ai_declaration, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             RETURNING id, item_id, asset_ref, license_type, channels, territory, expiry_at,
                       paid_ok, releases_ok, ai_declaration, status, created_at`,
            [
              itemId,
              row.asset_ref,
              row.license_type ?? null,
              row.channels ?? [],
              row.territory ?? null,
              row.expiry_at ?? null,
              row.paid_ok ?? false,
              row.releases_ok ?? false,
              row.ai_declaration ?? false,
              row.status ?? 'Unknown',
            ],
          );
          inserted.push(mapAssetRightRow(res.rows[0] as Record<string, unknown>));
        }
        await client.query('COMMIT');
        return inserted;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }
    const next = rows.map((row) => ({
      id: this.memory.nextRightsId++,
      item_id: itemId,
      asset_ref: row.asset_ref,
      license_type: row.license_type ?? null,
      channels: row.channels ?? [],
      territory: row.territory ?? null,
      expiry_at: row.expiry_at ?? null,
      paid_ok: row.paid_ok ?? false,
      releases_ok: row.releases_ok ?? false,
      ai_declaration: row.ai_declaration ?? false,
      status: row.status ?? 'Unknown',
      created_at: new Date().toISOString(),
    }));
    this.memory.assetRights.set(itemId, next);
    return next;
  }

  async getAssetRightById(rightsId: number): Promise<CmktAssetRightRow | null> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `SELECT id, item_id, asset_ref, license_type, channels, territory, expiry_at,
                paid_ok, releases_ok, ai_declaration, status, created_at
         FROM cmkt_asset_rights
         WHERE id = $1`,
        [rightsId],
      );
      return res.rows[0] ? mapAssetRightRow(res.rows[0] as Record<string, unknown>) : null;
    }
    for (const list of this.memory.assetRights.values()) {
      const found = list.find((row) => row.id === rightsId);
      if (found) return found;
    }
    return null;
  }

  async updateAssetRightStatus(rightsId: number, status: AssetRightStatus): Promise<CmktAssetRightRow | null> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `UPDATE cmkt_asset_rights
         SET status = $2
         WHERE id = $1
         RETURNING id, item_id, asset_ref, license_type, channels, territory, expiry_at,
                   paid_ok, releases_ok, ai_declaration, status, created_at`,
        [rightsId, status],
      );
      return res.rows[0] ? mapAssetRightRow(res.rows[0] as Record<string, unknown>) : null;
    }
    for (const [itemId, list] of this.memory.assetRights.entries()) {
      const idx = list.findIndex((row) => row.id === rightsId);
      if (idx < 0) continue;
      list[idx] = { ...list[idx], status };
      this.memory.assetRights.set(itemId, list);
      return list[idx];
    }
    return null;
  }

  async insertApprovalPackage(input: CmktApprovalPackageWrite): Promise<CmktApprovalPackageRow> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `INSERT INTO cmkt_approval_packages (item_id, snapshot_json, status, created_by)
         VALUES ($1, $2, $3, $4)
         RETURNING id, item_id, snapshot_json, status, created_by, created_at`,
        [input.item_id, JSON.stringify(input.snapshot_json), input.status, input.created_by],
      );
      return mapApprovalPackageRow(res.rows[0] as Record<string, unknown>);
    }
    const row: CmktApprovalPackageRow = {
      id: this.memory.nextApprovalPackageId++,
      item_id: input.item_id,
      snapshot_json: input.snapshot_json,
      status: input.status,
      created_by: input.created_by,
      created_at: new Date().toISOString(),
    };
    const list = this.memory.approvalPackages.get(input.item_id) ?? [];
    list.push(row);
    this.memory.approvalPackages.set(input.item_id, list);
    return row;
  }

  async getLatestApprovalPackage(
    itemId: number,
    opts?: { status?: string },
  ): Promise<CmktApprovalPackageRow | null> {
    if (await this.ensurePgReady()) {
      const res = opts?.status
        ? await this.db.query(
            `SELECT id, item_id, snapshot_json, status, created_by, created_at
             FROM cmkt_approval_packages
             WHERE item_id = $1 AND status = $2
             ORDER BY created_at DESC, id DESC
             LIMIT 1`,
            [itemId, opts.status],
          )
        : await this.db.query(
            `SELECT id, item_id, snapshot_json, status, created_by, created_at
             FROM cmkt_approval_packages
             WHERE item_id = $1
             ORDER BY created_at DESC, id DESC
             LIMIT 1`,
            [itemId],
          );
      return res.rows[0] ? mapApprovalPackageRow(res.rows[0] as Record<string, unknown>) : null;
    }
    const list = this.memory.approvalPackages.get(itemId) ?? [];
    const filtered = opts?.status ? list.filter((row) => row.status === opts.status) : list;
    if (!filtered.length) return null;
    return [...filtered].sort((a, b) => {
      const byTime = String(b.created_at).localeCompare(String(a.created_at));
      return byTime !== 0 ? byTime : b.id - a.id;
    })[0];
  }

  async updateApprovalPackageStatus(
    packageId: number,
    status: string,
  ): Promise<CmktApprovalPackageRow | null> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `UPDATE cmkt_approval_packages
         SET status = $2
         WHERE id = $1
         RETURNING id, item_id, snapshot_json, status, created_by, created_at`,
        [packageId, status],
      );
      return res.rows[0] ? mapApprovalPackageRow(res.rows[0] as Record<string, unknown>) : null;
    }
    for (const [itemId, list] of this.memory.approvalPackages.entries()) {
      const idx = list.findIndex((row) => row.id === packageId);
      if (idx < 0) continue;
      list[idx] = { ...list[idx], status };
      this.memory.approvalPackages.set(itemId, list);
      return list[idx];
    }
    return null;
  }

  async listItemsWithProductionTasks(): Promise<CmktSlaScanItem[]> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `SELECT i.id, i.lifecycle_id, i.assignee_sp, i.production_json, lc.assigned_am
           FROM cmkt_content_items i
           LEFT JOIN crm_service_lifecycle lc ON lc.id = i.lifecycle_id
          WHERE jsonb_typeof(COALESCE(i.production_json->'tasks', 'null'::jsonb)) = 'array'
            AND jsonb_array_length(i.production_json->'tasks') > 0
          ORDER BY i.id ASC`,
      );
      return res.rows.map((row) => this.mapSlaScanItem(row as Record<string, unknown>));
    }
    const out: CmktSlaScanItem[] = [];
    for (const items of this.memory.items.values()) {
      for (const item of items) {
        const tasks = item.production_json?.tasks;
        if (!Array.isArray(tasks) || !tasks.length) continue;
        out.push({
          id: item.id,
          lifecycle_id: item.lifecycle_id,
          assignee_sp: item.assignee_sp,
          production_json: item.production_json ?? {},
        });
      }
    }
    return out.sort((a, b) => a.id - b.id);
  }

  async insertSlaAudit(input: CmktSlaAuditWrite): Promise<CmktSlaAuditRow | null> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `INSERT INTO cmkt_sla_events (item_id, task_id, threshold, action, am_staff_id)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (item_id, task_id, threshold) DO NOTHING
         RETURNING id, item_id, task_id, threshold, action, am_staff_id, created_at`,
        [input.item_id, input.task_id, input.threshold, input.action, input.am_staff_id],
      );
      const inserted = res.rows[0] as Record<string, unknown> | undefined;
      return inserted ? this.mapSlaAuditRow(inserted) : null;
    }
    const dup = this.memory.slaEvents.some(
      (row) =>
        row.item_id === input.item_id &&
        row.task_id === input.task_id &&
        row.threshold === input.threshold,
    );
    if (dup) return null;
    const row: CmktSlaAuditRow = {
      id: this.memory.nextSlaEventId++,
      item_id: input.item_id,
      task_id: input.task_id,
      threshold: input.threshold,
      action: input.action,
      am_staff_id: input.am_staff_id,
      created_at: new Date().toISOString(),
    };
    this.memory.slaEvents.push(row);
    return row;
  }

  async nextPublicationRetryN(itemId: number): Promise<number> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `SELECT MAX(retry_n) AS max_retry FROM cmkt_publication_logs WHERE item_id = $1`,
        [itemId],
      );
      return nextPublicationRetryN(res.rows[0]?.max_retry != null ? Number(res.rows[0].max_retry) : null);
    }
    const max = this.memory.publicationLogs
      .filter((row) => row.item_id === itemId)
      .reduce((acc, row) => Math.max(acc, row.retry_n), 0);
    return nextPublicationRetryN(max);
  }

  async insertPublicationLog(input: CmktPublicationLogWrite): Promise<CmktPublicationLogRow> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `INSERT INTO cmkt_publication_logs (item_id, error, retry_n, post_id, http_status)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, item_id, attempted_at, error, retry_n, post_id, http_status`,
        [input.item_id, input.error, input.retry_n, input.post_id, input.http_status],
      );
      return this.mapPublicationLogRow(res.rows[0] as Record<string, unknown>);
    }
    const row: CmktPublicationLogRow = {
      id: this.memory.nextPublicationLogId++,
      item_id: input.item_id,
      attempted_at: new Date().toISOString(),
      error: input.error,
      retry_n: input.retry_n,
      post_id: input.post_id,
      http_status: input.http_status,
    };
    this.memory.publicationLogs.push(row);
    return row;
  }

  async listChannelConnectors(): Promise<ChannelConnectorRow[]> {
    // No channel_accounts / connector table in E2 — never invent tokens.
    return [];
  }

  async listSlaAudits(filter?: CmktSlaAuditFilter): Promise<CmktSlaAuditRow[]> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `SELECT id, item_id, task_id, threshold, action, am_staff_id, created_at
           FROM cmkt_sla_events
          WHERE ($1::bigint IS NULL OR item_id = $1)
            AND ($2::int IS NULL OR am_staff_id = $2)
          ORDER BY created_at ASC, id ASC`,
        [filter?.item_id ?? null, filter?.am_staff_id ?? null],
      );
      return res.rows.map((row) => this.mapSlaAuditRow(row as Record<string, unknown>));
    }
    const rows = this.memory.slaEvents.filter((row) => {
      if (filter?.item_id != null && row.item_id !== filter.item_id) return false;
      if (filter?.am_staff_id != null && row.am_staff_id !== filter.am_staff_id) return false;
      return true;
    });
    return [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id - b.id);
  }

  async listInsightsForLifecycle(lifecycleId: number): Promise<CmktInsightRow[]> {
    if (!(lifecycleId > 0)) return [];
    if (!(await this.ensurePgReady())) return [];
    try {
      const res = await this.db.query(
        `SELECT id, lifecycle_id, pattern, evidence, confidence, status, scope_json, expires_at, created_at
         FROM cmkt_insights
         WHERE lifecycle_id = $1
         ORDER BY id ASC`,
        [lifecycleId],
      );
      return res.rows.map((row) => mapInsightRow(row as Record<string, unknown>));
    } catch {
      return [];
    }
  }

  async patchSlaFired(itemId: number, slaFired: string[]): Promise<void> {
    if (await this.ensurePgReady()) {
      await this.db.query(
        `UPDATE cmkt_content_items
            SET production_json = jsonb_set(
                  COALESCE(production_json, '{}'::jsonb),
                  '{sla_fired}',
                  $2::jsonb,
                  true
                ),
                updated_at = NOW()
          WHERE id = $1`,
        [itemId, JSON.stringify(slaFired)],
      );
      return;
    }
    for (const items of this.memory.items.values()) {
      const idx = items.findIndex((item) => item.id === itemId);
      if (idx < 0) continue;
      items[idx] = {
        ...items[idx],
        production_json: {
          ...(items[idx].production_json ?? {}),
          sla_fired: slaFired,
        },
      };
      return;
    }
  }

  private mapSlaScanItem(row: Record<string, unknown>): CmktSlaScanItem {
    const asAmId = (value: unknown): number | null => {
      if (value == null) return null;
      const n = Number(value);
      return Number.isFinite(n) && n > 0 ? n : null;
    };
    return {
      id: Number(row.id),
      lifecycle_id: Number(row.lifecycle_id),
      assignee_sp: row.assignee_sp != null ? Number(row.assignee_sp) : null,
      assigned_am: asAmId(row.assigned_am),
      account_manager_id: asAmId(row.account_manager_id),
      am_id: asAmId(row.am_id),
      production_json: (row.production_json as CmktSlaScanItem['production_json']) ?? {},
    };
  }

  private mapSlaAuditRow(row: Record<string, unknown>): CmktSlaAuditRow {
    return {
      id: Number(row.id),
      item_id: Number(row.item_id),
      task_id: String(row.task_id ?? ''),
      threshold: Number(row.threshold),
      action: String(row.action ?? ''),
      am_staff_id: row.am_staff_id != null ? Number(row.am_staff_id) : null,
      created_at: new Date(String(row.created_at)).toISOString(),
    };
  }

  private mapPublicationLogRow(row: Record<string, unknown>): CmktPublicationLogRow {
    return {
      id: Number(row.id),
      item_id: Number(row.item_id),
      attempted_at: new Date(String(row.attempted_at)).toISOString(),
      error: row.error != null ? String(row.error) : null,
      retry_n: Number(row.retry_n),
      post_id: row.post_id != null ? String(row.post_id) : null,
      http_status: row.http_status != null ? Number(row.http_status) : null,
    };
  }
}

function mapInsightRow(row: Record<string, unknown>): CmktInsightRow {
  const statusRaw = String(row.status ?? 'Draft');
  const status = (CMKT_INSIGHT_STATUSES as readonly string[]).includes(statusRaw)
    ? (statusRaw as CmktInsightStatus)
    : 'Draft';
  const scope = row.scope_json;
  return {
    id: Number(row.id),
    lifecycle_id: Number(row.lifecycle_id),
    pattern: String(row.pattern ?? ''),
    evidence: String(row.evidence ?? ''),
    confidence: row.confidence != null ? Number(row.confidence) : null,
    status,
    scope_json:
      scope && typeof scope === 'object' && !Array.isArray(scope)
        ? (scope as Record<string, unknown>)
        : {},
    expires_at: row.expires_at != null ? String(row.expires_at) : null,
    created_at: String(row.created_at ?? ''),
  };
}

function mapAssetRightRow(row: Record<string, unknown>): CmktAssetRightRow {
  return {
    id: Number(row.id),
    item_id: Number(row.item_id),
    asset_ref: String(row.asset_ref ?? ''),
    license_type: row.license_type != null ? String(row.license_type) : null,
    channels: Array.isArray(row.channels) ? row.channels.map((ch) => String(ch)) : [],
    territory: row.territory != null ? String(row.territory) : null,
    expiry_at: row.expiry_at != null ? new Date(String(row.expiry_at)).toISOString() : null,
    paid_ok: Boolean(row.paid_ok),
    releases_ok: Boolean(row.releases_ok),
    ai_declaration: Boolean(row.ai_declaration),
    status: String(row.status ?? 'Unknown') as AssetRightStatus,
    created_at: row.created_at != null ? new Date(String(row.created_at)).toISOString() : new Date().toISOString(),
  };
}

function mapApprovalPackageRow(row: Record<string, unknown>): CmktApprovalPackageRow {
  return {
    id: Number(row.id),
    item_id: Number(row.item_id),
    snapshot_json: (row.snapshot_json as CmktApprovalPackageRow['snapshot_json']) ?? {
      body_json: {},
      brief_json: {},
      media: {},
      rights: [],
      disclaimer: null,
    },
    status: String(row.status ?? 'Draft'),
    created_by: String(row.created_by ?? ''),
    created_at: row.created_at != null ? new Date(String(row.created_at)).toISOString() : new Date().toISOString(),
  };
}
