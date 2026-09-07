import { HttpException, Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import { CpAuditRepository, CP_TENANT_ID } from './cp-audit.repository';
import { cpScopeSql, CpScope } from './cp-scope.util';

const PROJECT_STATUSES = ['draft', 'active', 'at_risk', 'in_review', 'completed', 'archived'] as const;
const DELIVERABLE_TYPES = ['ai_video', 'motion', 'social', 'landing_asset', 'human_video'] as const;
const PENDING_DELIVERABLE_STATUSES = ['draft', 'queued', 'rendering', 'in_review'] as const;
const PAGE_SIZE = 50;

export type CpProjectScope = {
  scope: CpScope;
  staffId: number;
  teamIds?: number[];
};

export type CpCreateProjectInput = {
  name?: string;
  agency_client_id?: string;
  owner_staff_id?: number;
  lifecycle_id?: string | null;
  industry?: string | null;
  objective?: string | null;
  start_at?: string | null;
  due_at?: string | null;
  status?: string;
  credit_budget?: number | null;
  cost_center?: string | null;
  tags?: string[];
};

export type CpPatchProjectInput = Partial<Omit<CpCreateProjectInput, 'agency_client_id'>>;
export type CpProjectsListQuery = CpProjectScope & {
  status?: string;
  q?: string;
  cursor?: string;
};
export type CpCloseProjectInput = { archive_pending?: boolean };
export type CpBriefInput = { body_json?: unknown; approval_status?: string };
export type CpDeliverableInput = {
  type?: string;
  status?: string;
  owner_staff_id?: number | null;
  due_at?: string | null;
  priority?: string;
  video_draft_id?: string | null;
  video_version_id?: string | null;
  vd_project_id?: string | null;
  content_item_id?: string | null;
};
export type CpTaskInput = {
  title?: string;
  assignee_id?: number | null;
  due_at?: string | null;
  priority?: string;
  status?: string;
  depends_on_id?: string | null;
  am_task_id?: string | null;
  csd_ticket_id?: string | null;
};

export interface CpProjectsDb {
  query(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: Record<string, unknown>[]; rowCount?: number | null }>;
}

export type CpProjectCursor = { created_at: string; id: string };

@Injectable()
export class CpProjectsRepository implements CpProjectsDb, OnModuleDestroy {
  private pool: Pool | null = null;

  constructor(private readonly config: AppConfigService) {}

  private get db(): Pool {
    if (!this.pool) this.pool = new Pool({ connectionString: this.config.databaseUrl });
    return this.pool;
  }

  query(sql: string, params?: unknown[]) {
    return this.db.query(sql, params);
  }

  async transaction<T>(work: (tx: CpProjectsDb) => Promise<T>): Promise<T> {
    const client = await this.db.connect();
    const tx: CpProjectsDb = {
      query: (sql, params) => client.query(sql, params),
    };
    try {
      await client.query('BEGIN');
      const result = await work(tx);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  onModuleDestroy(): void {
    void this.pool?.end();
    this.pool = null;
  }
}

@Injectable()
export class CpProjectsService {
  constructor(
    private readonly db: CpProjectsRepository,
    private readonly audit: CpAuditRepository,
  ) {}

  async create(input: CpCreateProjectInput, actorId: number | null = null) {
    const name = requiredText(input.name, 'name_required');
    const clientId = requiredUuid(
      input.agency_client_id,
      'agency_client_id_required',
      'invalid_agency_client_id',
    );
    const ownerStaffId = requiredPositiveInt(input.owner_staff_id, 'owner_staff_id_required');
    const status = projectStatus(input.status ?? 'draft');
    const lifecycleId = nullableText(input.lifecycle_id);
    await this.requireClient(clientId);
    if (lifecycleId) await this.requireLifecycle(lifecycleId);

    const result = await this.db.query(
      `INSERT INTO crm_cp_projects (
         tenant_id, agency_client_id, lifecycle_id, owner_staff_id, name, industry,
         objective, start_at, due_at, status, credit_budget, cost_center, tags
       ) VALUES (
         $1, $2::uuid, $3, $4, $5, $6, $7, $8::date, $9::date, $10, $11, $12, $13::text[]
       )
       RETURNING *`,
      [
        CP_TENANT_ID,
        clientId,
        lifecycleId,
        ownerStaffId,
        name,
        nullableText(input.industry),
        nullableText(input.objective),
        nullableText(input.start_at),
        nullableText(input.due_at),
        status,
        optionalNonNegativeInt(input.credit_budget, 'invalid_credit_budget'),
        nullableText(input.cost_center),
        textArray(input.tags),
      ],
    );
    const project = result.rows[0];
    if (!project) cpThrow(500, { error: 'insert_failed' });
    await this.audit.insert({
      actor_id: actorId,
      action: 'project.create',
      resource_type: 'project',
      resource_id: String(project.id),
      payload_json: { agency_client_id: clientId, name },
    });
    return project;
  }

  async list(query: CpProjectsListQuery) {
    const params: unknown[] = [CP_TENANT_ID];
    const scope = bindScope(
      cpScopeSql({
        scope: query.scope,
        staffId: query.staffId,
        teamIds: query.teamIds ?? [],
      }),
      params.length + 1,
    );
    params.push(...scope.params);
    let where = `p.tenant_id = $1 AND ${scope.sql}`;
    if (query.status) {
      params.push(projectStatus(query.status));
      where += ` AND p.status = $${params.length}`;
    }
    const search = nullableText(query.q);
    if (search) {
      params.push(`%${search}%`);
      where += ` AND (p.name ILIKE $${params.length} OR COALESCE(p.objective, '') ILIKE $${params.length})`;
    }
    if (query.cursor) {
      const cursor = decodeProjectCursor(query.cursor);
      params.push(cursor.created_at, cursor.id);
      where += ` AND (p.created_at, p.id) < ($${params.length - 1}::timestamptz, $${params.length}::uuid)`;
    }
    params.push(PAGE_SIZE + 1);
    const result = await this.db.query(
      `SELECT p.* FROM crm_cp_projects p
        WHERE ${where}
        ORDER BY p.created_at DESC, p.id DESC
        LIMIT $${params.length}`,
      params,
    );
    const rows = result.rows;
    const hasMore = rows.length > PAGE_SIZE;
    const items = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
    return {
      items,
      next_cursor: hasMore
        ? encodeProjectCursor({
            created_at: iso(items[items.length - 1]?.created_at),
            id: String(items[items.length - 1]?.id ?? ''),
          })
        : null,
    };
  }

  async get(id: string, scope: CpProjectScope) {
    const projectId = requiredUuid(id, 'invalid_project_id', 'invalid_project_id');
    let project = await this.loadProject(projectId, scope);
    if (
      !['completed', 'archived'].includes(String(project.status)) &&
      (await this.isAtRisk(projectId, project.credit_budget))
    ) {
      const result = await this.db.query(
        `UPDATE crm_cp_projects
            SET status = 'at_risk', updated_at = now()
          WHERE tenant_id = $1 AND id = $2::uuid
            AND status NOT IN ('completed', 'archived')
          RETURNING *`,
        [CP_TENANT_ID, projectId],
      );
      project = result.rows[0] ?? (await this.loadProject(projectId, scope));
    }
    return project;
  }

  async patch(id: string, input: CpPatchProjectInput, scope: CpProjectScope) {
    const projectId = requiredUuid(id, 'invalid_project_id', 'invalid_project_id');
    const current = await this.loadProject(projectId, scope);
    const requestedStatus =
      input.status === undefined ? undefined : projectStatus(input.status);
    if (requestedStatus === 'completed' || requestedStatus === 'archived') {
      cpThrow(400, { error: 'use_close' });
    }
    const status = requestedStatus ?? String(current.status);
    const lifecycleId =
      input.lifecycle_id === undefined ? current.lifecycle_id : nullableText(input.lifecycle_id);
    if (input.lifecycle_id !== undefined && lifecycleId) {
      await this.requireLifecycle(String(lifecycleId));
    }
    const result = await this.db.query(
      `UPDATE crm_cp_projects SET
         lifecycle_id = $3, owner_staff_id = $4, name = $5, industry = $6,
         objective = $7, start_at = $8::date, due_at = $9::date, status = $10,
         credit_budget = $11, cost_center = $12, tags = $13::text[], updated_at = now()
       WHERE tenant_id = $1 AND id = $2::uuid
       RETURNING *`,
      [
        CP_TENANT_ID,
        projectId,
        lifecycleId,
        input.owner_staff_id === undefined
          ? current.owner_staff_id
          : requiredPositiveInt(input.owner_staff_id, 'owner_staff_id_required'),
        input.name === undefined ? current.name : requiredText(input.name, 'name_required'),
        input.industry === undefined ? current.industry : nullableText(input.industry),
        input.objective === undefined ? current.objective : nullableText(input.objective),
        input.start_at === undefined ? current.start_at : nullableText(input.start_at),
        input.due_at === undefined ? current.due_at : nullableText(input.due_at),
        status,
        input.credit_budget === undefined
          ? current.credit_budget
          : optionalNonNegativeInt(input.credit_budget, 'invalid_credit_budget'),
        input.cost_center === undefined ? current.cost_center : nullableText(input.cost_center),
        input.tags === undefined ? current.tags : textArray(input.tags),
      ],
    );
    return result.rows[0] ?? cpThrow(404, { error: 'not_found' });
  }

  async close(
    id: string,
    input: CpCloseProjectInput,
    scope: CpProjectScope,
    actorId: number | null = null,
  ) {
    const projectId = requiredUuid(id, 'invalid_project_id', 'invalid_project_id');
    return this.db.transaction(async (tx) => {
      await this.loadProject(projectId, scope, tx, true);
      const pending = await tx.query(
        `SELECT id::text FROM crm_cp_deliverables
          WHERE project_id = $1::uuid AND status = ANY($2::text[])
          LIMIT 1`,
        [projectId, [...PENDING_DELIVERABLE_STATUSES]],
      );
      if (pending.rows[0] && input.archive_pending !== true) {
        cpThrow(409, { error: 'pending_deliverables' });
      }
      if (pending.rows[0]) {
        await tx.query(
          `UPDATE crm_cp_deliverables SET status = 'archived'
            WHERE project_id = $1::uuid AND status = ANY($2::text[])`,
          [projectId, [...PENDING_DELIVERABLE_STATUSES]],
        );
      }
      const updated = await tx.query(
        `UPDATE crm_cp_projects
            SET status = 'completed', updated_at = now()
          WHERE tenant_id = $1 AND id = $2::uuid
          RETURNING *`,
        [CP_TENANT_ID, projectId],
      );
      const project = updated.rows[0] ?? cpThrow(404, { error: 'not_found' });
      await this.audit.insert(
        {
          actor_id: actorId,
          action: 'project.close',
          resource_type: 'project',
          resource_id: projectId,
          payload_json: { archive_pending: input.archive_pending === true },
        },
        tx,
      );
      return project;
    });
  }

  async listBriefs(id: string, scope: CpProjectScope) {
    const project = await this.get(id, scope);
    const result = await this.db.query(
      `SELECT * FROM crm_cp_briefs WHERE project_id = $1::uuid ORDER BY version DESC`,
      [project.id],
    );
    return { items: result.rows };
  }

  async addBrief(id: string, input: CpBriefInput, scope: CpProjectScope, actorId: number) {
    const projectId = requiredUuid(id, 'invalid_project_id', 'invalid_project_id');
    if (input.body_json === undefined) cpThrow(400, { error: 'body_json_required' });
    return this.db.transaction(async (tx) => {
      const project = await this.loadProject(projectId, scope, tx, true);
      const createdBy = actorId > 0 ? actorId : Number(project.owner_staff_id);
      const result = await tx.query(
        `INSERT INTO crm_cp_briefs (project_id, version, body_json, approval_status, created_by)
         SELECT $1::uuid, COALESCE(MAX(version), 0) + 1, $2::jsonb, $3, $4
           FROM crm_cp_briefs WHERE project_id = $1::uuid
         RETURNING *`,
        [
          project.id,
          JSON.stringify(input.body_json),
          nullableText(input.approval_status) ?? 'draft',
          requiredPositiveInt(createdBy, 'created_by_required'),
        ],
      );
      return result.rows[0] ?? cpThrow(500, { error: 'insert_failed' });
    });
  }

  async listDeliverables(id: string, scope: CpProjectScope) {
    const project = await this.get(id, scope);
    const result = await this.db.query(
      `SELECT * FROM crm_cp_deliverables WHERE project_id = $1::uuid ORDER BY due_at, id`,
      [project.id],
    );
    return { items: result.rows };
  }

  async addDeliverable(id: string, input: CpDeliverableInput, scope: CpProjectScope) {
    const project = await this.get(id, scope);
    const type = String(input.type ?? '').trim();
    if (!(DELIVERABLE_TYPES as readonly string[]).includes(type)) {
      cpThrow(400, { error: 'invalid_deliverable_type' });
    }
    const result = await this.db.query(
      `INSERT INTO crm_cp_deliverables (
         project_id, type, status, owner_staff_id, due_at, priority,
         video_draft_id, video_version_id, vd_project_id, content_item_id
       ) VALUES ($1::uuid, $2, $3, $4, $5::date, $6, $7::uuid, $8::uuid, $9, $10)
       RETURNING *`,
      [
        project.id,
        type,
        nullableText(input.status) ?? 'draft',
        optionalPositiveInt(input.owner_staff_id, 'invalid_owner_staff_id'),
        nullableText(input.due_at),
        nullableText(input.priority) ?? 'normal',
        type === 'human_video' ? null : optionalUuid(input.video_draft_id, 'invalid_video_draft_id'),
        type === 'human_video'
          ? null
          : optionalUuid(input.video_version_id, 'invalid_video_version_id'),
        type === 'human_video' ? nullableText(input.vd_project_id) : null,
        type === 'human_video' ? null : nullableText(input.content_item_id),
      ],
    );
    return result.rows[0] ?? cpThrow(500, { error: 'insert_failed' });
  }

  async listTasks(id: string, scope: CpProjectScope) {
    const project = await this.get(id, scope);
    const result = await this.db.query(
      `SELECT * FROM crm_cp_tasks WHERE project_id = $1::uuid ORDER BY created_at DESC`,
      [project.id],
    );
    return { items: result.rows };
  }

  async addTask(id: string, input: CpTaskInput, scope: CpProjectScope) {
    const project = await this.get(id, scope);
    const title = requiredText(input.title, 'title_required');
    const result = await this.db.query(
      `INSERT INTO crm_cp_tasks (
         project_id, title, assignee_id, due_at, priority, status,
         depends_on_id, am_task_id, csd_ticket_id
       ) VALUES ($1::uuid, $2, $3, $4::timestamptz, $5, $6, $7::uuid, $8::uuid, $9)
       RETURNING *`,
      [
        project.id,
        title,
        optionalPositiveInt(input.assignee_id, 'invalid_assignee_id'),
        nullableText(input.due_at),
        nullableText(input.priority) ?? 'normal',
        nullableText(input.status) ?? 'open',
        optionalUuid(input.depends_on_id, 'invalid_depends_on_id'),
        optionalUuid(input.am_task_id, 'invalid_am_task_id'),
        nullableText(input.csd_ticket_id),
      ],
    );
    return result.rows[0] ?? cpThrow(500, { error: 'insert_failed' });
  }

  async listMilestones(id: string, scope: CpProjectScope) {
    const project = await this.get(id, scope);
    const result = await this.db.query(
      `SELECT * FROM crm_cp_milestones WHERE project_id = $1::uuid ORDER BY due_at, id`,
      [project.id],
    );
    return { items: result.rows };
  }

  private async requireClient(clientId: string): Promise<void> {
    const found = await this.db.query(`SELECT id::text FROM clients WHERE id = $1::uuid LIMIT 1`, [
      clientId,
    ]);
    if (!found.rows[0]) cpThrow(400, { error: 'client_not_found' });
  }

  private async requireLifecycle(lifecycleId: string): Promise<void> {
    if (!/^[1-9]\d*$/.test(lifecycleId)) {
      cpThrow(400, { error: 'lifecycle_not_found' });
    }
    const found = await this.db.query(
      `SELECT id FROM crm_service_lifecycle WHERE id = $1 LIMIT 1`,
      [Number(lifecycleId)],
    );
    if (!found.rows[0]) cpThrow(400, { error: 'lifecycle_not_found' });
  }

  private async loadProject(
    projectId: string,
    scope: CpProjectScope,
    db: CpProjectsDb = this.db,
    forUpdate = false,
  ) {
    const bound = bindScope(
      cpScopeSql({
        scope: scope.scope,
        staffId: scope.staffId,
        teamIds: scope.teamIds ?? [],
      }),
      3,
    );
    const result = await db.query(
      `SELECT p.* FROM crm_cp_projects p
        WHERE p.tenant_id = $1 AND p.id = $2::uuid AND ${bound.sql}
        LIMIT 1${forUpdate ? ' FOR UPDATE' : ''}`,
      [CP_TENANT_ID, projectId, ...bound.params],
    );
    return result.rows[0] ?? cpThrow(404, { error: 'not_found' });
  }

  private async isAtRisk(projectId: string, budget: unknown): Promise<boolean> {
    const result = await this.db.query(
      `SELECT
         EXISTS (
           SELECT 1 FROM crm_cp_deliverables
            WHERE project_id = $1::uuid
              AND due_at < CURRENT_DATE
              AND status NOT IN ('completed', 'archived')
         ) AS overdue,
         COALESCE((
           SELECT SUM(amount) FROM crm_cp_credit_ledger
            WHERE tenant_id = $2 AND project_id = $1::uuid
              AND kind IN ('charge', 'reserve')
         ), 0) AS credit_used`,
      [projectId, CP_TENANT_ID],
    );
    const risk = result.rows[0] ?? {};
    const creditBudget = Number(budget);
    return projectIsAtRisk(risk, creditBudget);
  }
}

export function projectIsAtRisk(
  risk: { overdue?: unknown; credit_used?: unknown },
  budget: unknown,
): boolean {
  const creditBudget = Number(budget);
  return (
    risk.overdue === true ||
    (Number.isFinite(creditBudget) &&
      creditBudget > 0 &&
      Number(risk.credit_used ?? 0) * 100 >= creditBudget * 80)
  );
}

export function encodeProjectCursor(cursor: CpProjectCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString('base64url');
}

export function decodeProjectCursor(cursor: string): CpProjectCursor {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as {
      created_at?: unknown;
      id?: unknown;
    };
    const createdAt = String(parsed.created_at ?? '');
    const id = String(parsed.id ?? '');
    if (!Number.isFinite(Date.parse(createdAt)) || !isUuid(id)) throw new Error('invalid');
    return { created_at: createdAt, id };
  } catch {
    cpThrow(400, { error: 'invalid_cursor' });
  }
}

function cpThrow(status: number, body: Record<string, unknown>): never {
  throw Object.assign(new HttpException(body, status), body);
}

function requiredText(value: unknown, error: string): string {
  const text = String(value ?? '').trim();
  if (!text) cpThrow(400, { error });
  return text;
}

function nullableText(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text || null;
}

function iso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  const text = String(value ?? '');
  const timestamp = Date.parse(text);
  if (!Number.isFinite(timestamp)) cpThrow(500, { error: 'invalid_project_timestamp' });
  return new Date(timestamp).toISOString();
}

function requiredPositiveInt(value: unknown, error: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) cpThrow(400, { error });
  return n;
}

function optionalPositiveInt(value: unknown, error: string): number | null {
  if (value == null || value === '') return null;
  return requiredPositiveInt(value, error);
}

function optionalNonNegativeInt(value: unknown, error: string): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) cpThrow(400, { error });
  return n;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function requiredUuid(value: unknown, missingError: string, invalidError: string): string {
  const id = String(value ?? '').trim();
  if (!id) cpThrow(400, { error: missingError });
  if (!isUuid(id)) cpThrow(400, { error: invalidError });
  return id;
}

function optionalUuid(value: unknown, error: string): string | null {
  if (value == null || value === '') return null;
  return requiredUuid(value, error, error);
}

function projectStatus(value: unknown): string {
  const status = String(value ?? '').trim();
  if (!(PROJECT_STATUSES as readonly string[]).includes(status)) {
    cpThrow(400, { error: 'invalid_project_status' });
  }
  return status;
}

function textArray(value: unknown): string[] {
  if (value == null) return [];
  if (!Array.isArray(value)) cpThrow(400, { error: 'invalid_tags' });
  return value.map((item) => String(item).trim()).filter(Boolean);
}

function bindScope(
  fragment: { sql: string; params: unknown[] },
  startAt: number,
): { sql: string; params: unknown[] } {
  let sql = fragment.sql;
  const params: unknown[] = [];
  let index = startAt;
  if (sql.includes('$teams')) {
    sql = sql.replaceAll('$teams', `$${index++}`);
    params.push(fragment.params[0]);
  }
  if (sql.includes('$staff')) {
    sql = sql.replaceAll('$staff', `$${index}`);
    params.push(fragment.params[sql.includes('$teams') ? 1 : 0] ?? fragment.params[0]);
  }
  return { sql, params };
}
