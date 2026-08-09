import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import { CMKT_ITEM_STATUSES, CMKT_REVIEW_SLA_HOURS } from './content-marketing.constants';
import { emptyBodyJson } from './content-marketing.util';
import type {
  CmktActiveSnapshotRow,
  CmktBodyJson,
  CmktContextCounts,
  CmktIdeaRow,
  CmktItemRow,
} from './content-marketing.types';

type MemoryStore = {
  ideas: Map<number, CmktIdeaRow[]>;
  items: Map<number, CmktItemRow[]>;
  snapshots: Map<number, CmktActiveSnapshotRow>;
  nextIdeaId: number;
  nextItemId: number;
  nextVersionNo: Map<number, number>;
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

function mapItemRow(row: Record<string, unknown>): CmktItemRow {
  return {
    id: Number(row.id),
    lifecycle_id: Number(row.lifecycle_id),
    idea_id: row.idea_id != null ? Number(row.idea_id) : null,
    parent_item_id: row.parent_item_id != null ? Number(row.parent_item_id) : null,
    title: String(row.title ?? ''),
    format: String(row.format ?? ''),
    channel: String(row.channel ?? ''),
    funnel_goal: String(row.funnel_goal ?? ''),
    status: String(row.status ?? 'draft'),
    assignee_sp: row.assignee_sp != null ? Number(row.assignee_sp) : null,
    assignee_qa: row.assignee_qa != null ? Number(row.assignee_qa) : null,
    brief_json: (row.brief_json as Record<string, unknown>) ?? {},
    body_json: (row.body_json as CmktBodyJson) ?? emptyBodyJson(),
    selected_variant_idx: row.selected_variant_idx != null ? Number(row.selected_variant_idx) : null,
    quality_score_json: (row.quality_score_json as Record<string, unknown>) ?? {},
    seo_bridge_id: row.seo_bridge_id != null ? Number(row.seo_bridge_id) : null,
    email_bridge_id: row.email_bridge_id != null ? Number(row.email_bridge_id) : null,
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
    nextIdeaId: 1,
    nextItemId: 1,
    nextVersionNo: new Map(),
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
      };
    }
    return this.memory.snapshots.get(lifecycleId) ?? null;
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

      return {
        ideas: Number(ideasRes.rows[0]?.cnt ?? 0),
        items_by_status,
        draft,
        in_review,
        published_mtd: Number(mtdRes.rows[0]?.cnt ?? 0),
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
    },
  ): Promise<CmktItemRow> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `INSERT INTO cmkt_content_items (
           lifecycle_id, idea_id, title, format, channel, funnel_goal, status,
           brief_json, body_json, created_by
         ) VALUES ($1,$2,$3,$4,$5,$6,'draft',$7,$8,$9)
         RETURNING *`,
        [
          lifecycleId,
          input.idea_id,
          input.title,
          input.format,
          input.channel,
          input.funnel_goal,
          JSON.stringify(input.brief_json),
          JSON.stringify(input.body_json),
          input.created_by,
        ],
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
          key === 'body_json' || key === 'brief_json' || key === 'quality_score_json'
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
  ): Promise<void> {
    if (await this.ensurePgReady()) {
      const verRes = await this.db.query(
        `SELECT COALESCE(MAX(version_no), 0)::int AS max_v FROM cmkt_content_item_versions WHERE item_id = $1`,
        [itemId],
      );
      const versionNo = Number(verRes.rows[0]?.max_v ?? 0) + 1;
      await this.db.query(
        `INSERT INTO cmkt_content_item_versions (item_id, version_no, body_json, changed_by, change_reason)
         VALUES ($1, $2, $3, $4, $5)`,
        [itemId, versionNo, JSON.stringify(bodyJson), changedBy, changeReason],
      );
      return;
    }
    const versionNo = (this.memory.nextVersionNo.get(itemId) ?? 0) + 1;
    this.memory.nextVersionNo.set(itemId, versionNo);
  }
}
