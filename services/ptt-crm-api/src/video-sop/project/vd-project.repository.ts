import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../../config/app-config.service';
import type {
  InsertVdProjectInput,
  VdProjectRepository as VdProjectRepo,
  VdProjectRow,
  VdProjectStage,
  VdProjectStatus,
} from '../video-sop.types';

type MemoryStore = {
  projects: VdProjectRow[];
  briefs: Array<{ project_id: number; body_json: Record<string, unknown> }>;
  scripts: Array<{ project_id: number; version: number; markdown: string }>;
  audits: Array<{
    project_id: number;
    actor_email: string;
    action: string;
    payload_json: Record<string, unknown>;
  }>;
  nextId: number;
};

function startOfUtcDay(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

@Injectable()
export class VdProjectRepository implements VdProjectRepo, OnModuleDestroy {
  private pool: Pool | null = null;
  private pgReady: boolean | null = null;
  private readonly memory: MemoryStore = {
    projects: [],
    briefs: [],
    scripts: [],
    audits: [],
    nextId: 1,
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
      await this.db.query(`SELECT 1 FROM vd_projects LIMIT 1`);
      this.pgReady = true;
    } catch {
      this.pgReady = false;
    }
    return this.pgReady;
  }

  private mapRow(row: Record<string, unknown>): VdProjectRow {
    return {
      id: Number(row.id),
      lifecycle_id: Number(row.lifecycle_id),
      client_id: row.client_id != null ? String(row.client_id) : null,
      cmkt_item_id: row.cmkt_item_id != null ? Number(row.cmkt_item_id) : null,
      title: String(row.title ?? ''),
      stage: String(row.stage ?? 'brief_draft') as VdProjectStage,
      status: String(row.status ?? 'active') as VdProjectStatus,
      created_by: String(row.created_by ?? ''),
      created_at: new Date(String(row.created_at)).toISOString(),
      updated_at: new Date(String(row.updated_at)).toISOString(),
    };
  }

  async findByCmktItemId(itemId: number): Promise<VdProjectRow | null> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `SELECT id, lifecycle_id, client_id, cmkt_item_id, title, stage, status, created_by, created_at, updated_at
         FROM vd_projects
         WHERE cmkt_item_id = $1 AND deleted_at IS NULL
         LIMIT 1`,
        [itemId],
      );
      const row = res.rows[0] as Record<string, unknown> | undefined;
      return row ? this.mapRow(row) : null;
    }
    return this.memory.projects.find((p) => p.cmkt_item_id === itemId) ?? null;
  }

  async countCreatedToday(lifecycleId: number): Promise<number> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `SELECT COUNT(*)::int AS c
         FROM vd_projects
         WHERE lifecycle_id = $1
           AND deleted_at IS NULL
           AND created_at >= date_trunc('day', NOW())
           AND created_at < date_trunc('day', NOW()) + interval '1 day'`,
        [lifecycleId],
      );
      return Number(res.rows[0]?.c ?? 0);
    }
    const start = startOfUtcDay().getTime();
    const end = start + 24 * 60 * 60 * 1000;
    return this.memory.projects.filter((p) => {
      if (p.lifecycle_id !== lifecycleId) return false;
      const ts = Date.parse(p.created_at);
      return Number.isFinite(ts) && ts >= start && ts < end;
    }).length;
  }

  async insertProject(input: InsertVdProjectInput): Promise<VdProjectRow> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `INSERT INTO vd_projects (lifecycle_id, client_id, cmkt_item_id, title, stage, status, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, lifecycle_id, client_id, cmkt_item_id, title, stage, status, created_by, created_at, updated_at`,
        [
          input.lifecycle_id,
          input.client_id,
          input.cmkt_item_id,
          input.title,
          input.stage,
          input.status,
          input.created_by,
        ],
      );
      return this.mapRow(res.rows[0] as Record<string, unknown>);
    }
    const now = new Date().toISOString();
    const row: VdProjectRow = {
      id: this.memory.nextId++,
      lifecycle_id: input.lifecycle_id,
      client_id: input.client_id,
      cmkt_item_id: input.cmkt_item_id,
      title: input.title,
      stage: input.stage,
      status: input.status,
      created_by: input.created_by,
      created_at: now,
      updated_at: now,
    };
    this.memory.projects.push(row);
    return row;
  }

  async insertBrief(projectId: number, bodyJson: Record<string, unknown>): Promise<void> {
    if (await this.ensurePgReady()) {
      await this.db.query(`INSERT INTO vd_briefs (project_id, body_json) VALUES ($1, $2::jsonb)`, [
        projectId,
        JSON.stringify(bodyJson),
      ]);
      return;
    }
    this.memory.briefs.push({ project_id: projectId, body_json: bodyJson });
  }

  async insertScript(projectId: number, version: number, markdown: string): Promise<void> {
    if (await this.ensurePgReady()) {
      await this.db.query(`INSERT INTO vd_scripts (project_id, version, markdown) VALUES ($1, $2, $3)`, [
        projectId,
        version,
        markdown,
      ]);
      return;
    }
    this.memory.scripts.push({ project_id: projectId, version, markdown });
  }

  async insertAudit(
    projectId: number,
    actorEmail: string,
    action: string,
    payload: Record<string, unknown> = {},
  ): Promise<void> {
    if (await this.ensurePgReady()) {
      await this.db.query(
        `INSERT INTO vd_audit_logs (project_id, actor_email, action, payload_json)
         VALUES ($1, $2, $3, $4::jsonb)`,
        [projectId, actorEmail, action, JSON.stringify(payload)],
      );
      return;
    }
    this.memory.audits.push({
      project_id: projectId,
      actor_email: actorEmail,
      action,
      payload_json: payload,
    });
  }

  async listByLifecycle(lifecycleId: number): Promise<VdProjectRow[]> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `SELECT id, lifecycle_id, client_id, cmkt_item_id, title, stage, status, created_by, created_at, updated_at
         FROM vd_projects
         WHERE lifecycle_id = $1 AND deleted_at IS NULL
         ORDER BY created_at DESC`,
        [lifecycleId],
      );
      return (res.rows as Record<string, unknown>[]).map((row) => this.mapRow(row));
    }
    return this.memory.projects
      .filter((p) => p.lifecycle_id === lifecycleId)
      .slice()
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  async getById(id: number): Promise<VdProjectRow | null> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `SELECT id, lifecycle_id, client_id, cmkt_item_id, title, stage, status, created_by, created_at, updated_at
         FROM vd_projects
         WHERE id = $1 AND deleted_at IS NULL`,
        [id],
      );
      const row = res.rows[0] as Record<string, unknown> | undefined;
      return row ? this.mapRow(row) : null;
    }
    return this.memory.projects.find((p) => p.id === id) ?? null;
  }
}
