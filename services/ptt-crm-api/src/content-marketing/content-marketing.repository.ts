import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import { CMKT_ITEM_STATUSES, CMKT_REVIEW_SLA_HOURS } from './content-marketing.constants';
import type { CmktActiveSnapshotRow, CmktContextCounts } from './content-marketing.types';

type MemoryStore = {
  ideas: Map<number, number>;
  items: Map<number, Array<{ status: string; in_review_at: string | null; published_at: string | null }>>;
  snapshots: Map<number, CmktActiveSnapshotRow>;
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

@Injectable()
export class ContentMarketingRepository implements OnModuleDestroy {
  private pool: Pool | null = null;
  private pgReady: boolean | null = null;
  private readonly memory: MemoryStore = {
    ideas: new Map(),
    items: new Map(),
    snapshots: new Map(),
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
      ideas: this.memory.ideas.get(lifecycleId) ?? 0,
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
}
