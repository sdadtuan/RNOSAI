import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  Optional,
} from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { AmAuditRepository, AM_TENANT_ID } from './am-audit.repository';
import { AmDashboardService } from './am-dashboard.service';
import { amThrow } from './am-http';
import { amScopeSql, resolveAmScope } from './am-scope.util';
import type { AmScope, AmTaskKind, AmTaskStatus } from './am.types';

export type AmTaskPriority = 'low' | 'medium' | 'high';

export type AmTaskRow = {
  id: string;
  agency_client_id: string;
  title: string;
  kind: AmTaskKind;
  priority: AmTaskPriority;
  status: AmTaskStatus;
  assignee_staff_id: number | null;
  due_at: string | null;
  source: string;
  source_ref: string | null;
  dismissed_at: string | null;
};

export type AmCreateTaskInput = {
  agency_client_id: string;
  title: string;
  kind?: AmTaskKind;
  priority?: AmTaskPriority;
  due_at?: string;
  source?: string;
  source_ref?: string;
};

export type AmWorkInbox = 'me' | 'team' | 'unassigned' | 'all';

export type AmTasksListQuery = {
  inbox?: string;
  scope?: AmScope;
  sla?: string;
  kind?: string;
  status?: string;
  priority?: string;
};

export type AmTaskOverdueInput = {
  status: string;
  sla_paused?: boolean | null;
  sla_resolve_due_at?: string | null;
};

export type AmWorkQueueItem = {
  id: string;
  agency_client_id: string;
  account_name: string | null;
  title: string;
  kind: AmTaskKind;
  priority: AmTaskPriority;
  status: AmTaskStatus;
  assignee_staff_id: number | null;
  assignee_label: string | null;
  due_at: string | null;
  sla_first_due_at: string | null;
  sla_resolve_due_at: string | null;
  sla_paused: boolean;
  sla_clock: number | 'paused' | null;
  overdue: boolean;
  source: string;
  source_ref: string | null;
};

export type AmWorkQueueList = {
  items: AmWorkQueueItem[];
  counts: { me: number | null; team: number | null; unassigned: number | null };
  work_hours: string;
};

export type AmTasksReq = {
  staffUser?: StaffJwtPayload;
  staffAuthVia?: 'internal' | 'jwt';
};

export type AmTasksStore = {
  findById(id: string): Promise<AmTaskRow | null>;
  accept(id: string, staffId: number): Promise<AmTaskRow | null>;
  findOpenBySourceRef(source: string, sourceRef: string): Promise<AmTaskRow | null>;
  insert(input: AmCreateTaskInput): Promise<AmTaskRow>;
  dismiss(source: string, sourceRef: string): Promise<number>;
  query(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: Record<string, unknown>[]; rowCount?: number | null }>;
};

export function amTaskOverdue(row: AmTaskOverdueInput): boolean {
  if (row.status === 'waiting_client' && row.sla_paused === true) return false;
  if (!row.sla_resolve_due_at) return false;
  return Date.parse(row.sla_resolve_due_at) < Date.now();
}

export function amTaskSlaClock(row: AmTaskOverdueInput, now = Date.now()): number | 'paused' | null {
  if (row.status === 'waiting_client' && row.sla_paused === true) return 'paused';
  if (!row.sla_resolve_due_at) return null;
  const due = Date.parse(row.sla_resolve_due_at);
  if (!Number.isFinite(due)) return null;
  return due - now;
}

const TASK_KINDS: AmTaskKind[] = [
  'task',
  'client_request',
  'issue',
  'escalation',
  'approval',
  'milestone',
];
const TASK_PRIORITIES: AmTaskPriority[] = ['low', 'medium', 'high'];
const TASK_STATUSES: AmTaskStatus[] = [
  'new',
  'in_progress',
  'waiting_client',
  'waiting_internal',
  'resolved',
  'closed',
  'cancelled',
];
const WORK_HOURS = 'Giờ LV 08:30–17:30';
const SLA_BREACHED_SQL =
  `NOT (t.status = 'waiting_client' AND t.sla_paused IS TRUE)` +
  ` AND t.sla_resolve_due_at IS NOT NULL AND t.sla_resolve_due_at < now()`;

const TASK_COLS = `
  id::text AS id,
  agency_client_id::text AS agency_client_id,
  title,
  kind,
  priority,
  status,
  assignee_staff_id,
  due_at,
  source,
  source_ref,
  dismissed_at
`;

function mapTask(row: Record<string, unknown>): AmTaskRow {
  return {
    id: String(row.id),
    agency_client_id: String(row.agency_client_id ?? ''),
    title: String(row.title ?? ''),
    kind: (TASK_KINDS.includes(String(row.kind) as AmTaskKind) ? row.kind : 'task') as AmTaskKind,
    priority: (TASK_PRIORITIES.includes(String(row.priority) as AmTaskPriority)
      ? row.priority
      : 'medium') as AmTaskPriority,
    status: String(row.status ?? 'new') as AmTaskStatus,
    assignee_staff_id: row.assignee_staff_id == null ? null : Number(row.assignee_staff_id),
    due_at: row.due_at == null ? null : new Date(String(row.due_at)).toISOString(),
    source: String(row.source ?? 'manual'),
    source_ref: row.source_ref == null || row.source_ref === '' ? null : String(row.source_ref),
    dismissed_at: row.dismissed_at == null ? null : new Date(String(row.dismissed_at)).toISOString(),
  };
}

function isUniqueViolation(err: unknown): boolean {
  return (err as { code?: string }).code === '23505';
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value.trim(),
  );
}

@Injectable()
export class AmTasksRepository implements OnModuleDestroy, AmTasksStore {
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

  async findById(id: string): Promise<AmTaskRow | null> {
    const result = await this.db.query(
      `SELECT ${TASK_COLS} FROM crm_am_tasks WHERE tenant_id = $1 AND id = $2::uuid LIMIT 1`,
      [AM_TENANT_ID, id],
    );
    const row = result.rows[0];
    return row ? mapTask(row) : null;
  }

  async accept(id: string, staffId: number): Promise<AmTaskRow | null> {
    const result = await this.db.query(
      `UPDATE crm_am_tasks
          SET assignee_staff_id = $2,
              status = 'in_progress',
              updated_at = now()
        WHERE tenant_id = $1 AND id = $3::uuid
        RETURNING ${TASK_COLS}`,
      [AM_TENANT_ID, staffId, id],
    );
    const row = result.rows[0];
    return row ? mapTask(row) : null;
  }

  async findOpenBySourceRef(source: string, sourceRef: string): Promise<AmTaskRow | null> {
    const result = await this.db.query(
      `SELECT ${TASK_COLS}
         FROM crm_am_tasks
        WHERE tenant_id = $1
          AND source = $2
          AND source_ref = $3
          AND dismissed_at IS NULL
          AND status NOT IN ('cancelled', 'closed')
        LIMIT 1`,
      [AM_TENANT_ID, source, sourceRef],
    );
    const row = result.rows[0];
    return row ? mapTask(row) : null;
  }

  async insert(input: AmCreateTaskInput): Promise<AmTaskRow> {
    const result = await this.db.query(
      `INSERT INTO crm_am_tasks (
         tenant_id, agency_client_id, title, kind, priority, status,
         source, source_ref, due_at
       ) VALUES ($1, $2::uuid, $3, $4, $5, 'new', $6, $7, $8)
       RETURNING ${TASK_COLS}`,
      [
        AM_TENANT_ID,
        input.agency_client_id,
        input.title,
        input.kind ?? 'task',
        input.priority ?? 'medium',
        input.source ?? 'manual',
        input.source_ref ?? null,
        input.due_at ?? null,
      ],
    );
    return mapTask(result.rows[0]);
  }

  async query(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: Record<string, unknown>[]; rowCount?: number | null }> {
    return this.db.query(sql, params);
  }

  async dismiss(source: string, sourceRef: string): Promise<number> {
    const result = await this.db.query(
      `UPDATE crm_am_tasks
          SET dismissed_at = now(),
              updated_at = now()
        WHERE tenant_id = $1
          AND source = $2
          AND source_ref = $3
          AND dismissed_at IS NULL`,
      [AM_TENANT_ID, source, sourceRef],
    );
    return result.rowCount ?? 0;
  }
}

@Injectable()
export class AmTasksService {
  constructor(
    private readonly repo: AmTasksRepository,
    private readonly audit: AmAuditRepository,
    private readonly staffAuth: StaffAuthService,
    @Optional() private readonly dashboard?: AmDashboardService,
  ) {}

  async list(req: AmTasksReq, q: AmTasksListQuery): Promise<AmWorkQueueList> {
    const emptyCounts = { me: null, team: null, unassigned: null };
    const actor = await this.resolveActor(req, q.scope, q.inbox);
    const inbox = parseInbox(q.inbox, actor.canAll);
    if (inbox === 'team' && actor.teamIds.length === 0) {
      return { items: [], counts: { ...emptyCounts, team: 0 }, work_hours: WORK_HOURS };
    }

    const bound = bindScopeSql(
      amScopeSql({ scope: actor.scope, staffId: actor.staffId, teamIds: actor.teamIds }),
      2,
    );
    const params: unknown[] = [AM_TENANT_ID, ...bound.params];
    const where = [
      't.tenant_id = $1',
      't.dismissed_at IS NULL',
      `t.status <> 'cancelled'`,
      bound.sql,
    ];

    if (inbox === 'me') {
      params.push(actor.staffId);
      where.push(`t.assignee_staff_id = $${params.length}`);
    } else if (inbox === 'unassigned') {
      where.push('t.assignee_staff_id IS NULL');
    } else if (inbox === 'team') {
      params.push(actor.teamIds);
      where.push(
        `t.assignee_staff_id IN (
           SELECT cs.id
             FROM crm_staff cs
             JOIN staff_users u ON lower(trim(u.email)) = lower(trim(cs.email))
             JOIN staff_user_teams sut ON sut.user_id = u.id
            WHERE sut.team_id = ANY($${params.length})
         )`,
      );
    }

    if (q.sla === 'breached') where.push(SLA_BREACHED_SQL);

    const kind = TASK_KINDS.includes(q.kind as AmTaskKind) ? (q.kind as AmTaskKind) : '';
    if (kind) {
      params.push(kind);
      where.push(`t.kind = $${params.length}`);
    }
    const status = TASK_STATUSES.includes(q.status as AmTaskStatus) ? (q.status as AmTaskStatus) : '';
    if (status) {
      params.push(status);
      where.push(`t.status = $${params.length}`);
    }
    const priority = TASK_PRIORITIES.includes(q.priority as AmTaskPriority)
      ? (q.priority as AmTaskPriority)
      : '';
    if (priority) {
      params.push(priority);
      where.push(`t.priority = $${params.length}`);
    }

    let items: AmWorkQueueItem[] = [];
    try {
      const result = await this.repo.query(
        `SELECT
           t.id::text AS id,
           t.agency_client_id::text AS agency_client_id,
           NULLIF(TRIM(COALESCE(c.name, '')), '') AS account_name,
           t.title,
           t.kind,
           t.priority,
           t.status,
           t.assignee_staff_id,
           NULLIF(TRIM(COALESCE(assignee.name, '')), '') AS assignee_label,
           t.due_at,
           t.sla_first_due_at,
           t.sla_resolve_due_at,
           t.sla_paused,
           t.source,
           t.source_ref
         FROM crm_am_tasks t
         INNER JOIN crm_am_account_ext e
                 ON e.agency_client_id = t.agency_client_id AND e.tenant_id = $1
         LEFT JOIN clients c ON c.id = t.agency_client_id
         LEFT JOIN crm_staff assignee ON assignee.id = t.assignee_staff_id
         WHERE ${where.join(' AND ')}
         ORDER BY t.due_at NULLS LAST, t.created_at`,
        params,
      );
      items = result.rows.map((row) => mapWorkItem(row));
      if (q.sla === 'breached') items = items.filter((row) => amTaskOverdue(row));
    } catch (err) {
      if (!isMissingRelation(err)) throw err;
    }

    const counts = await this.loadInboxCounts(actor);
    return { items, counts, work_hours: WORK_HOURS };
  }

  async acceptBulk(
    req: AmTasksReq,
    body: { ids?: string[] },
    staffId: number,
  ): Promise<{ accepted: number; items: AmTaskRow[] }> {
    if (!Array.isArray(body.ids)) amThrow(400, { error: 'ids_required' });
    if (staffId <= 0) throw new BadRequestException({ error: 'invalid_staff_id' });
    const ids = [...new Set(body.ids.map((id) => String(id).trim()).filter(isUuid))].slice(0, 50);
    if (!ids.length) return { accepted: 0, items: [] };

    const actor = await this.resolveActor(req, undefined);
    const bound = bindScopeSql(
      amScopeSql({ scope: actor.scope, staffId: actor.staffId, teamIds: actor.teamIds }),
      3,
    );
    let rows: Record<string, unknown>[] = [];
    try {
      const result = await this.repo.query(
        `SELECT t.id::text AS id, t.assignee_staff_id
           FROM crm_am_tasks t
           INNER JOIN crm_am_account_ext e
                   ON e.agency_client_id = t.agency_client_id AND e.tenant_id = $1
          WHERE t.tenant_id = $1
            AND t.id = ANY($2::uuid[])
            AND t.dismissed_at IS NULL
            AND ${bound.sql}`,
        [AM_TENANT_ID, ids, ...bound.params],
      );
      rows = result.rows;
    } catch (err) {
      if (!isMissingRelation(err)) throw err;
    }

    const items: AmTaskRow[] = [];
    for (const row of rows) {
      const assignee = row.assignee_staff_id == null ? null : Number(row.assignee_staff_id);
      if (assignee != null && assignee !== staffId) continue;
      try {
        items.push(await this.accept(String(row.id), staffId));
      } catch {
        // skip missing or failed ids
      }
    }
    return { accepted: items.length, items };
  }

  async accept(id: string, staffId: number): Promise<AmTaskRow> {
    if (!isUuid(id)) {
      throw new BadRequestException({ error: 'invalid_task_id' });
    }
    if (staffId <= 0) {
      throw new BadRequestException({ error: 'invalid_staff_id' });
    }
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundException({ error: 'task_not_found' });
    const out = (await this.repo.accept(id, staffId)) ?? {
      ...existing,
      assignee_staff_id: staffId,
      status: 'in_progress' as const,
    };
    await this.audit.insert({
      actor_staff_id: staffId || null,
      action: 'task.accept',
      entity_type: 'task',
      entity_id: out.id,
      payload_json: { assignee_staff_id: staffId, status: out.status },
    });
    this.dashboard?.dropCache();
    return out;
  }

  async create(input: AmCreateTaskInput, _staffId: number): Promise<AmTaskRow> {
    const agencyClientId = String(input.agency_client_id ?? '').trim();
    const title = String(input.title ?? '').trim();
    if (!agencyClientId || !title) {
      throw new BadRequestException({ error: 'agency_client_id_and_title_required' });
    }
    if (!isUuid(agencyClientId)) {
      throw new BadRequestException({ error: 'invalid_agency_client_id' });
    }
    const source = String(input.source ?? 'manual').trim() || 'manual';
    const sourceRef = input.source_ref != null ? String(input.source_ref).trim() : '';
    const kind = TASK_KINDS.includes(input.kind as AmTaskKind) ? (input.kind as AmTaskKind) : 'task';
    const priority = TASK_PRIORITIES.includes(input.priority as AmTaskPriority)
      ? (input.priority as AmTaskPriority)
      : 'medium';
    const payload: AmCreateTaskInput = {
      agency_client_id: agencyClientId,
      title,
      kind,
      priority,
      due_at: input.due_at,
      source,
      source_ref: sourceRef || undefined,
    };
    if (payload.source_ref) {
      const dup = await this.repo.findOpenBySourceRef(source, payload.source_ref);
      if (dup) throw new ConflictException({ error: 'duplicate_source_ref' });
    }
    try {
      const out = await this.repo.insert(payload);
      this.dashboard?.dropCache();
      return out;
    } catch (err) {
      if (isUniqueViolation(err)) throw new ConflictException({ error: 'duplicate_source_ref' });
      throw err;
    }
  }

  async dismiss(body: { source: string; source_ref: string }, staffId: number): Promise<{ dismissed: number }> {
    const source = String(body.source ?? '').trim();
    const sourceRef = String(body.source_ref ?? '').trim();
    if (!source || !sourceRef) {
      throw new BadRequestException({ error: 'source_and_source_ref_required' });
    }
    const dismissed = await this.repo.dismiss(source, sourceRef);
    await this.audit.insert({
      actor_staff_id: staffId || null,
      action: 'task.dismiss',
      entity_type: 'task',
      payload_json: { source, source_ref: sourceRef, dismissed },
    });
    this.dashboard?.dropCache();
    return { dismissed };
  }

  private async resolveActor(
    req: AmTasksReq,
    requested: AmScope | undefined,
    inbox?: string,
  ): Promise<TaskActor> {
    const internal = req.staffAuthVia === 'internal';
    const staffId = req.staffUser
      ? ((await this.staffAuth.resolveCrmStaffUserId(req.staffUser)) ?? 0)
      : 0;
    if (internal && !req.staffUser) {
      return {
        staffId,
        scope: resolveAmScope({ requested, hasViewAll: true, canTeam: true }),
        teamIds: [],
        canAll: true,
      };
    }
    if (!req.staffUser) {
      return { staffId, scope: 'me', teamIds: [], canAll: false };
    }
    const me = await this.staffAuth.me(req.staffUser);
    const has = (action: string) => this.staffAuth.hasCap(me.caps, 'crm_am', action);
    const hasViewAll = has('view_all') || has('manage');
    const canTeam = hasViewAll || has('assign');
    const scope = resolveAmScope({ requested, hasViewAll, canTeam });
    const needTeams = scope === 'team' || parseInbox(inbox, hasViewAll) === 'team';
    const teamIds = needTeams ? await this.loadTeamIds(staffId) : [];
    return { staffId, scope, teamIds, canAll: hasViewAll };
  }

  private async loadTeamIds(staffId: number): Promise<number[]> {
    if (staffId <= 0) return [];
    try {
      const result = await this.repo.query(
        `SELECT t.id
           FROM crm_staff cs
           JOIN staff_users u ON lower(trim(u.email)) = lower(trim(cs.email))
           JOIN staff_user_teams sut ON sut.user_id = u.id
           JOIN staff_teams t ON t.id = sut.team_id AND t.active IS TRUE
          WHERE cs.id = $1`,
        [staffId],
      );
      return result.rows
        .map((row) => Number(row.id))
        .filter((n) => Number.isFinite(n) && n > 0);
    } catch {
      return [];
    }
  }

  private async loadInboxCounts(actor: TaskActor): Promise<AmWorkQueueList['counts']> {
    const bound = bindScopeSql(
      amScopeSql({ scope: actor.scope, staffId: actor.staffId, teamIds: actor.teamIds }),
      2,
    );
    const params: unknown[] = [AM_TENANT_ID, ...bound.params];
    params.push(actor.staffId);
    const staffPh = `$${params.length}`;
    let teamSql = 'FALSE';
    if (actor.teamIds.length) {
      params.push(actor.teamIds);
      teamSql = `t.assignee_staff_id IN (
        SELECT cs.id
          FROM crm_staff cs
          JOIN staff_users u ON lower(trim(u.email)) = lower(trim(cs.email))
          JOIN staff_user_teams sut ON sut.user_id = u.id
         WHERE sut.team_id = ANY($${params.length})
      )`;
    }
    try {
      const result = await this.repo.query(
        `SELECT
           COUNT(*) FILTER (WHERE t.assignee_staff_id = ${staffPh})::int AS me,
           COUNT(*) FILTER (WHERE t.assignee_staff_id IS NULL)::int AS unassigned,
           COUNT(*) FILTER (WHERE ${teamSql})::int AS team
         FROM crm_am_tasks t
         INNER JOIN crm_am_account_ext e
                 ON e.agency_client_id = t.agency_client_id AND e.tenant_id = $1
         WHERE t.tenant_id = $1
           AND t.dismissed_at IS NULL
           AND t.status <> 'cancelled'
           AND ${bound.sql}`,
        params,
      );
      const row = result.rows[0] ?? {};
      return {
        me: numOrNull(row.me),
        team: actor.teamIds.length ? numOrNull(row.team) : 0,
        unassigned: numOrNull(row.unassigned),
      };
    } catch (err) {
      if (isMissingRelation(err)) return { me: null, team: actor.teamIds.length ? null : 0, unassigned: null };
      throw err;
    }
  }
}

type TaskActor = {
  staffId: number;
  scope: AmScope;
  teamIds: number[];
  canAll: boolean;
};

function parseInbox(raw: string | undefined, canAll: boolean): AmWorkInbox {
  if (raw === 'team' || raw === 'unassigned') return raw;
  if (raw === 'all' && canAll) return 'all';
  return 'me';
}

function emptyToNull(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text ? text : null;
}

function isoOrNull(value: unknown): string | null {
  if (value == null || value === '') return null;
  const ms = Date.parse(String(value));
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

function mapWorkItem(row: Record<string, unknown>): AmWorkQueueItem {
  const status = String(row.status ?? 'new') as AmTaskStatus;
  const slaPaused = Boolean(row.sla_paused);
  const slaResolveDueAt = isoOrNull(row.sla_resolve_due_at);
  const mapped = {
    status,
    sla_paused: slaPaused,
    sla_resolve_due_at: slaResolveDueAt,
  };
  return {
    id: String(row.id),
    agency_client_id: String(row.agency_client_id ?? ''),
    account_name: emptyToNull(row.account_name),
    title: String(row.title ?? ''),
    kind: (TASK_KINDS.includes(String(row.kind) as AmTaskKind) ? row.kind : 'task') as AmTaskKind,
    priority: (TASK_PRIORITIES.includes(String(row.priority) as AmTaskPriority)
      ? row.priority
      : 'medium') as AmTaskPriority,
    status,
    assignee_staff_id: row.assignee_staff_id == null ? null : Number(row.assignee_staff_id),
    assignee_label: emptyToNull(row.assignee_label),
    due_at: isoOrNull(row.due_at),
    sla_first_due_at: isoOrNull(row.sla_first_due_at),
    sla_resolve_due_at: slaResolveDueAt,
    sla_paused: slaPaused,
    sla_clock: amTaskSlaClock(mapped),
    overdue: amTaskOverdue(mapped),
    source: String(row.source ?? 'manual'),
    source_ref: emptyToNull(row.source_ref),
  };
}

function numOrNull(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function isMissingRelation(err: unknown): boolean {
  const e = err as { code?: string; message?: string };
  return e.code === '42P01' || /does not exist/i.test(e.message ?? '');
}

function bindScopeSql(
  fragment: { sql: string; params: unknown[] },
  startAt: number,
): { sql: string; params: unknown[] } {
  let sql = fragment.sql;
  const params: unknown[] = [];
  let i = startAt;
  if (sql.includes('$teams')) {
    sql = sql.replaceAll('$teams', `$${i++}`);
    params.push(fragment.params[0]);
    if (sql.includes('$staff')) {
      sql = sql.replaceAll('$staff', `$${i++}`);
      params.push(fragment.params[1] ?? fragment.params[0]);
    }
    return { sql, params };
  }
  if (sql.includes('$staff')) {
    sql = sql.replaceAll('$staff', `$${i}`);
    params.push(fragment.params[0]);
  }
  return { sql, params };
}
