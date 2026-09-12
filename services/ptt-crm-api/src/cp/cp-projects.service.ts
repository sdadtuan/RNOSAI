import { HttpException, Injectable, OnModuleDestroy, Optional } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import { CreativesService } from '../creatives/creatives.service';
import { CpAuditRepository, CP_TENANT_ID } from './cp-audit.repository';
import { buildCpCreativeDescription } from './cp-launch-gate.util';
import { assertNotQcBlocked } from './cp-qc.service';
import { cpScopeSql, CpScope } from './cp-scope.util';
import { CpVideosService } from './cp-videos.service';

const PROJECT_STATUSES = ['draft', 'active', 'at_risk', 'in_review', 'completed', 'archived'] as const;
const DELIVERABLE_TYPES = ['ai_video', 'motion', 'social', 'landing_asset', 'human_video'] as const;
const PENDING_DELIVERABLE_STATUSES = ['draft', 'queued', 'rendering', 'in_review'] as const;
const PAGE_SIZE = 50;
const PORTFOLIO_SELECT = `
  SELECT p.*,
         c.name AS client_name,
         s.name AS owner_name,
         sl.service_slug AS lifecycle_name,
         COALESCE(d.deliverable_done, 0)::int AS deliverable_done,
         COALESCE(d.deliverable_total, 0)::int AS deliverable_total,
         COALESCE(led.credit_used, 0) AS credit_used
    FROM crm_cp_projects p
    LEFT JOIN clients c ON c.id = p.agency_client_id
    LEFT JOIN crm_staff s ON s.id = p.owner_staff_id
    LEFT JOIN crm_service_lifecycle sl
      ON p.lifecycle_id IS NOT NULL AND sl.id::text = p.lifecycle_id
    LEFT JOIN (
      SELECT project_id,
             COUNT(*) FILTER (WHERE status IS DISTINCT FROM 'archived')::int AS deliverable_total,
             COUNT(*) FILTER (WHERE status IN ('completed', 'final'))::int AS deliverable_done
        FROM crm_cp_deliverables
       GROUP BY project_id
    ) d ON d.project_id = p.id
    LEFT JOIN (
      SELECT project_id, COALESCE(SUM(amount), 0) AS credit_used
        FROM crm_cp_credit_ledger
       WHERE tenant_id = 'PTT' AND kind IN ('charge', 'reserve')
       GROUP BY project_id
    ) led ON led.project_id = p.id
`;

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
  member_staff_ids?: number[];
};

export type CpPatchProjectInput = Partial<Omit<CpCreateProjectInput, 'agency_client_id'>>;
export type CpProjectsListQuery = CpProjectScope & {
  status?: string;
  q?: string;
  cursor?: string;
  client?: string;
  owner?: string;
  lifecycle?: string;
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

export type CpProjectListItem = Record<string, unknown> & {
  deliverable_done?: number;
  deliverable_total?: number;
  progress_pct?: number;
};

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
    @Optional() private readonly creatives?: CreativesService,
    @Optional() private readonly videos?: CpVideosService,
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
    await this.replaceMembers(String(project.id), ownerStaffId, input.member_staff_ids);
    return project;
  }

  async lookups() {
    const [clients, staff, lifecycles] = await Promise.all([
      this.db.query(
        `SELECT id::text, name, industry_slug AS industry
           FROM clients
          WHERE status NOT IN ('archived', 'offboarding')
          ORDER BY name ASC`,
      ),
      this.db.query(
        `SELECT id, name, job_title
           FROM crm_staff
          WHERE active IS TRUE
          ORDER BY name ASC`,
      ),
      this.db.query(
        `SELECT id::text, service_slug
           FROM crm_service_lifecycle
          ORDER BY id DESC`,
      ),
    ]);
    return {
      clients: clients.rows.map((row) => ({
        id: String(row.id),
        name: String(row.name ?? ''),
        industry: row.industry == null ? null : String(row.industry),
      })),
      staff: staff.rows.map((row) => ({
        id: Number(row.id),
        name: String(row.name ?? ''),
        job_title: row.job_title == null ? null : String(row.job_title),
      })),
      lifecycles: lifecycles.rows.map((row) => ({
        id: String(row.id),
        service_slug: row.service_slug == null ? null : String(row.service_slug),
      })),
    };
  }

  async importFromB2b(actorId: number) {
    const ownerStaffId = requiredPositiveInt(actorId, 'owner_staff_id_required');
    const listed = await this.db.query(
      `SELECT id::text, code, name, status FROM crm_b2b_projects ORDER BY code ASC`,
    );
    const created: Record<string, unknown>[] = [];
    let skipped = 0;
    for (const row of listed.rows) {
      const b2bId = String(row.id ?? '').trim();
      if (!isUuid(b2bId)) continue;
      const tag = `b2b:${b2bId}`;
      const existing = await this.db.query(
        `SELECT id FROM crm_cp_projects
          WHERE tenant_id = $1 AND tags @> ARRAY[$2]::text[]
          LIMIT 1`,
        [CP_TENANT_ID, tag],
      );
      if (existing.rows[0]) {
        skipped += 1;
        continue;
      }
      const name = requiredText(row.name, 'name_required');
      const code = String(row.code ?? '')
        .trim()
        .toUpperCase()
        .slice(0, 32) || 'PTT';
      const client = await this.db.query(
        `INSERT INTO clients (code, name, status)
         VALUES ($1, $2, 'active')
         ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, updated_at = now()
         RETURNING id::text`,
        [code, name],
      );
      const clientId = String(client.rows[0]?.id ?? '').trim();
      if (!clientId) cpThrow(500, { error: 'insert_failed' });
      const status = String(row.status ?? '').trim() === 'active' ? 'active' : 'draft';
      const project = await this.create(
        {
          name,
          agency_client_id: clientId,
          owner_staff_id: ownerStaffId,
          status,
          objective: `Lấy từ Dự án PTT (${String(row.code ?? code)})`,
          tags: [tag, `b2b-code:${String(row.code ?? code)}`],
        },
        ownerStaffId,
      );
      const staff = await this.db.query(
        `SELECT staff_id FROM crm_b2b_project_staff WHERE project_id = $1::uuid`,
        [b2bId],
      );
      const memberIds = new Set<number>([ownerStaffId]);
      for (const member of staff.rows) {
        const staffId = Number(member.staff_id);
        if (Number.isInteger(staffId) && staffId > 0) memberIds.add(staffId);
      }
      for (const staffId of memberIds) {
        await this.db.query(
          `INSERT INTO crm_cp_project_members (project_id, staff_id, role)
           VALUES ($1::uuid, $2, 'editor')
           ON CONFLICT DO NOTHING`,
          [project.id, staffId],
        );
      }
      await this.audit.insert({
        actor_id: ownerStaffId,
        action: 'project.import_b2b',
        resource_type: 'project',
        resource_id: String(project.id),
        payload_json: { b2b_project_id: b2bId, agency_client_id: clientId, name },
      });
      created.push(project);
    }
    return { created, skipped };
  }

  async list(query: CpProjectsListQuery) {
    const itemsQuery = this.portfolioFrom(query, { applyStatus: true, applyCursor: true });
    itemsQuery.params.push(PAGE_SIZE + 1);
    const result = await this.db.query(
      `${PORTFOLIO_SELECT}
        WHERE ${itemsQuery.where}
        ORDER BY p.created_at DESC, p.id DESC
        LIMIT $${itemsQuery.params.length}`,
      itemsQuery.params,
    );
    const rows = result.rows;
    const hasMore = rows.length > PAGE_SIZE;
    const items = (hasMore ? rows.slice(0, PAGE_SIZE) : rows).map(mapProjectProgress);
    const summary = await this.portfolioSummary(query);
    return {
      items,
      next_cursor: hasMore
        ? encodeProjectCursor({
            created_at: iso(items[items.length - 1]?.created_at),
            id: String(items[items.length - 1]?.id ?? ''),
          })
        : null,
      summary,
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
    return this.decorateWorkspace(project);
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
      requireOpenProject(project);
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
      `SELECT d.*, s.name AS owner_name
         FROM crm_cp_deliverables d
         LEFT JOIN crm_staff s ON s.id = d.owner_staff_id
        WHERE d.project_id = $1::uuid
        ORDER BY d.due_at, d.id`,
      [project.id],
    );
    return { items: result.rows };
  }

  async addDeliverable(id: string, input: CpDeliverableInput, scope: CpProjectScope) {
    const projectId = requiredUuid(id, 'invalid_project_id', 'invalid_project_id');
    const type = String(input.type ?? '').trim();
    if (!(DELIVERABLE_TYPES as readonly string[]).includes(type)) {
      cpThrow(400, { error: 'invalid_deliverable_type' });
    }
    return this.db.transaction(async (tx) => {
      const project = await this.loadProject(projectId, scope, tx, true);
      requireOpenProject(project);
      const result = await tx.query(
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
          type === 'human_video'
            ? null
            : optionalUuid(input.video_draft_id, 'invalid_video_draft_id'),
          type === 'human_video'
            ? null
            : optionalUuid(input.video_version_id, 'invalid_video_version_id'),
          type === 'human_video' ? nullableText(input.vd_project_id) : null,
          type === 'human_video' ? null : nullableText(input.content_item_id),
        ],
      );
      return result.rows[0] ?? cpThrow(500, { error: 'insert_failed' });
    });
  }

  async listTasks(id: string, scope: CpProjectScope) {
    const project = await this.get(id, scope);
    const result = await this.db.query(
      `SELECT t.*, s.name AS assignee_name
         FROM crm_cp_tasks t
         LEFT JOIN crm_staff s ON s.id = t.assignee_id
        WHERE t.project_id = $1::uuid
        ORDER BY t.created_at DESC`,
      [project.id],
    );
    return { items: result.rows };
  }

  async addTask(id: string, input: CpTaskInput, scope: CpProjectScope) {
    const projectId = requiredUuid(id, 'invalid_project_id', 'invalid_project_id');
    const title = requiredText(input.title, 'title_required');
    return this.db.transaction(async (tx) => {
      const project = await this.loadProject(projectId, scope, tx, true);
      requireOpenProject(project);
      const result = await tx.query(
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
    });
  }

  async listMilestones(id: string, scope: CpProjectScope) {
    const project = await this.get(id, scope);
    const result = await this.db.query(
      `SELECT * FROM crm_cp_milestones WHERE project_id = $1::uuid ORDER BY due_at, id`,
      [project.id],
    );
    return { items: result.rows };
  }

  async submitCreative(
    projectId: string,
    versionId: string | undefined,
    scope: CpProjectScope,
  ) {
    const id = requiredUuid(projectId, 'invalid_project_id', 'invalid_project_id');
    const versionUuid = requiredUuid(versionId, 'version_id_required', 'invalid_version_id');
    const project = await this.loadProject(id, scope);
    const version = await this.loadSubmitVersion(versionUuid, scope, id);
    assertNotQcBlocked(version.qc_status == null ? null : String(version.qc_status));
    if (!this.creatives) cpThrow(500, { error: 'creatives_unavailable' });
    const title =
      nullableText(version.draft_name) ||
      nullableText(project.name) ||
      `Version ${version.version_n ?? version.id}`;
    const outputUri = nullableText(version.output_uri);
    const submitted = await this.creatives.submit({
      client_id: String(project.agency_client_id),
      title,
      description: buildCpCreativeDescription(String(version.id)),
      asset_url: outputUri ?? undefined,
      asset_type: 'video',
      version: Number(version.version_n) > 0 ? Number(version.version_n) : undefined,
    });
    return { creative_id: submitted.creative.id };
  }

  private async loadSubmitVersion(
    versionId: string,
    scope: CpProjectScope,
    projectId: string,
  ) {
    if (!this.videos) cpThrow(500, { error: 'videos_unavailable' });
    try {
      const version = await this.videos.getVersion(versionId, {
        scope: scope.scope,
        staffId: scope.staffId,
        teamIds: scope.teamIds,
      });
      if (String(version.project_id) !== projectId) {
        cpThrow(400, { error: 'version_required' });
      }
      return version;
    } catch (error) {
      if (error instanceof HttpException && error.getStatus() === 404) {
        cpThrow(400, { error: 'version_required' });
      }
      throw error;
    }
  }

  private async replaceMembers(
    projectId: string,
    ownerStaffId: number,
    memberStaffIds: unknown,
  ) {
    const ids = new Set<number>([ownerStaffId]);
    const extras = Array.isArray(memberStaffIds) ? memberStaffIds : [];
    for (const value of extras) {
      ids.add(requiredPositiveInt(value, 'invalid_member_staff_id'));
    }
    for (const staffId of ids) {
      await this.requireStaff(staffId);
      await this.db.query(
        `INSERT INTO crm_cp_project_members (project_id, staff_id, role)
         VALUES ($1::uuid, $2, 'editor')
         ON CONFLICT DO NOTHING`,
        [projectId, staffId],
      );
    }
  }

  private async requireStaff(staffId: number): Promise<void> {
    const found = await this.db.query(
      `SELECT id FROM crm_staff WHERE id = $1 AND active IS TRUE LIMIT 1`,
      [staffId],
    );
    if (!found.rows[0]) cpThrow(400, { error: 'staff_not_found' });
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

  private portfolioFrom(
    query: CpProjectsListQuery,
    opts: { applyStatus: boolean; applyCursor: boolean },
  ) {
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
    if (opts.applyStatus && query.status) {
      params.push(projectStatus(query.status));
      where += ` AND p.status = $${params.length}`;
    }
    const search = nullableText(query.q);
    if (search) {
      params.push(`%${search}%`);
      where += ` AND (p.name ILIKE $${params.length} OR COALESCE(p.objective, '') ILIKE $${params.length})`;
    }
    const client = nullableText(query.client);
    if (client) {
      params.push(isUuid(client) ? client : `%${client}%`);
      where += isUuid(client)
        ? ` AND p.agency_client_id = $${params.length}::uuid`
        : ` AND c.name ILIKE $${params.length}`;
    }
    const owner = nullableText(query.owner);
    if (owner) {
      if (/^[1-9]\d*$/.test(owner)) {
        params.push(Number(owner));
        where += ` AND p.owner_staff_id = $${params.length}`;
      } else {
        params.push(`%${owner}%`);
        where += ` AND s.name ILIKE $${params.length}`;
      }
    }
    const lifecycle = nullableText(query.lifecycle);
    if (lifecycle) {
      params.push(lifecycle);
      where += /^[1-9]\d*$/.test(lifecycle)
        ? ` AND p.lifecycle_id = $${params.length}`
        : ` AND (p.lifecycle_id = $${params.length} OR sl.service_slug ILIKE '%' || $${params.length} || '%')`;
    }
    if (opts.applyCursor && query.cursor) {
      const cursor = decodeProjectCursor(query.cursor);
      params.push(cursor.created_at, cursor.id);
      where += ` AND (p.created_at, p.id) < ($${params.length - 1}::timestamptz, $${params.length}::uuid)`;
    }
    return { where, params };
  }

  private async portfolioSummary(query: CpProjectsListQuery) {
    const built = this.portfolioFrom(query, { applyStatus: false, applyCursor: false });
    const result = await this.db.query(
      `SELECT
          COUNT(*)::int AS project_count,
          COALESCE(SUM(COALESCE(d.deliverable_done, 0)), 0)::int AS deliverable_done,
          COUNT(*) FILTER (
            WHERE p.credit_budget > 0
              AND COALESCE(led.credit_used, 0) * 100 >= p.credit_budget * 80
          )::int AS credit_at_risk,
          COUNT(*) FILTER (WHERE p.status = 'draft')::int AS draft,
          COUNT(*) FILTER (WHERE p.status = 'active')::int AS active,
          COUNT(*) FILTER (WHERE p.status = 'at_risk')::int AS at_risk,
          COUNT(*) FILTER (WHERE p.status = 'in_review')::int AS in_review,
          COUNT(*) FILTER (WHERE p.status = 'completed')::int AS completed,
          COUNT(*) FILTER (WHERE p.status = 'archived')::int AS archived
        FROM crm_cp_projects p
        LEFT JOIN clients c ON c.id = p.agency_client_id
        LEFT JOIN crm_staff s ON s.id = p.owner_staff_id
        LEFT JOIN crm_service_lifecycle sl
          ON p.lifecycle_id IS NOT NULL AND sl.id::text = p.lifecycle_id
        LEFT JOIN (
          SELECT project_id,
                 COUNT(*) FILTER (WHERE status IN ('completed', 'final'))::int AS deliverable_done
            FROM crm_cp_deliverables
           GROUP BY project_id
        ) d ON d.project_id = p.id
        LEFT JOIN (
          SELECT project_id, COALESCE(SUM(amount), 0) AS credit_used
            FROM crm_cp_credit_ledger
           WHERE tenant_id = 'PTT' AND kind IN ('charge', 'reserve')
           GROUP BY project_id
        ) led ON led.project_id = p.id
       WHERE ${built.where}`,
      built.params,
    );
    const row = result.rows[0] ?? {};
    const all = Number(row.project_count ?? 0);
    return {
      project_count: all,
      deliverable_done: Number(row.deliverable_done ?? 0),
      credit_at_risk: Number(row.credit_at_risk ?? 0),
      status_counts: {
        all,
        draft: Number(row.draft ?? 0),
        active: Number(row.active ?? 0),
        at_risk: Number(row.at_risk ?? 0),
        in_review: Number(row.in_review ?? 0),
        completed: Number(row.completed ?? 0),
        archived: Number(row.archived ?? 0),
      },
    };
  }

  private async decorateWorkspace(project: Record<string, unknown>) {
    const projectId = String(project.id);
    const [named, members, extra, ledger, providerJobs, weave] = await Promise.all([
      this.db.query(
        `${PORTFOLIO_SELECT}
          WHERE p.tenant_id = $1 AND p.id = $2::uuid
          LIMIT 1`,
        [CP_TENANT_ID, projectId],
      ),
      this.db.query(
        `SELECT m.staff_id, m.role, s.name
           FROM crm_cp_project_members m
           LEFT JOIN crm_staff s ON s.id = m.staff_id
          WHERE m.project_id = $1::uuid
          ORDER BY m.staff_id`,
        [projectId],
      ),
      this.db.query(
        `SELECT
           COUNT(*) FILTER (
             WHERE type IN ('ai_video', 'human_video')
               AND status IN ('completed', 'final', 'published', 'approved')
           )::int AS video_final,
           COUNT(*) FILTER (
             WHERE due_at < CURRENT_DATE
               AND status NOT IN ('completed', 'archived', 'final')
           )::int AS overdue_deliverables
           FROM crm_cp_deliverables
          WHERE project_id = $1::uuid`,
        [projectId],
      ),
      this.db.query(
        `SELECT kind, cost_center, COALESCE(SUM(amount), 0)::int AS amount
           FROM crm_cp_credit_ledger
          WHERE tenant_id = $1 AND project_id = $2::uuid
            AND kind IN ('charge', 'reserve')
          GROUP BY kind, cost_center`,
        [CP_TENANT_ID, projectId],
      ),
      this.db.query(
        `SELECT
           (SELECT COUNT(*)::int
              FROM crm_cp_render_jobs j
              LEFT JOIN crm_cp_video_drafts d ON d.id = j.draft_id
             WHERE COALESCE(j.project_id, d.project_id) = $1::uuid
               AND j.provider LIKE 'magnific%') AS magnific_jobs,
           (SELECT COUNT(*)::int
              FROM crm_cp_render_jobs j
              LEFT JOIN crm_cp_video_drafts d ON d.id = j.draft_id
             WHERE COALESCE(j.project_id, d.project_id) = $1::uuid
               AND j.provider = 'comfyui') AS comfy_jobs`,
        [projectId],
      ),
      this.db.query(
        `SELECT COUNT(*)::int AS weave_open
           FROM crm_cp_weave_work_orders
          WHERE project_id = $1::uuid
            AND status NOT IN ('cancelled', 'delivered')`,
        [projectId],
      ).catch(() => ({ rows: [{ weave_open: null }] })),
    ]);
    let creditCharged = 0;
    let creditReserved = 0;
    const budgetByCostCenter: Record<string, { charged: number; reserved: number }> = {};
    for (const row of ledger.rows) {
      const amount = Number(row.amount ?? 0);
      const kind = String(row.kind ?? '');
      if (kind === 'charge') creditCharged += amount;
      if (kind === 'reserve') creditReserved += amount;
      const bucket = costCenterBucket(row.cost_center);
      if (!bucket) continue;
      const current = budgetByCostCenter[bucket] ?? { charged: 0, reserved: 0 };
      if (kind === 'charge') current.charged += amount;
      if (kind === 'reserve') current.reserved += amount;
      budgetByCostCenter[bucket] = current;
    }
    const extraRow = extra.rows[0] ?? {};
    const providerRow = providerJobs.rows[0] ?? {};
    const weaveRow = weave.rows[0] ?? {};
    return {
      ...project,
      ...(named.rows[0] ?? {}),
      members: members.rows.map((row) => ({
        staff_id: Number(row.staff_id),
        role: row.role == null ? null : String(row.role),
        name: row.name == null ? null : String(row.name),
      })),
      member_staff_ids: members.rows.map((row) => Number(row.staff_id)),
      video_final: Number(extraRow.video_final ?? 0),
      overdue_deliverables: Number(extraRow.overdue_deliverables ?? 0),
      credit_charged: creditCharged,
      credit_reserved: creditReserved,
      budget_by_cost_center: budgetByCostCenter,
      weave_open_count: countOrNull(weaveRow.weave_open),
      magnific_job_count: countOrNull(providerRow.magnific_jobs),
      comfy_job_count: countOrNull(providerRow.comfy_jobs),
    };
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

function countOrNull(value: unknown): number | null {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function projectProgressPct(done: unknown, total: unknown): number {
  const deliverableDone = Number(done ?? 0);
  const deliverableTotal = Number(total ?? 0);
  if (!Number.isFinite(deliverableDone) || !Number.isFinite(deliverableTotal) || deliverableTotal <= 0) {
    return 0;
  }
  return Math.round((deliverableDone / deliverableTotal) * 100);
}

export function mapProjectProgress(row: Record<string, unknown>): CpProjectListItem {
  return {
    ...row,
    progress_pct: projectProgressPct(row.deliverable_done, row.deliverable_total),
  };
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

function requireOpenProject(project: Record<string, unknown>): void {
  if (project.status === 'completed' || project.status === 'archived') {
    cpThrow(409, { error: 'project_closed' });
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

function costCenterBucket(value: unknown): 'video' | 'batch' | 'voice' | null {
  const key = String(value ?? '').trim().toLowerCase();
  if (['video', 'video_production', 'production'].includes(key)) return 'video';
  if (['batch', 'factory', 'batch_factory'].includes(key)) return 'batch';
  if (['voice', 'tts', 'tts_voice'].includes(key)) return 'voice';
  return null;
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
