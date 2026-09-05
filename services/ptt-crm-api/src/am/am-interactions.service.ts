import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { AmAuditRepository, AM_TENANT_ID } from './am-audit.repository';
import { amThrow } from './am-http';
import { amScopeSql, resolveAmScope } from './am-scope.util';
import { AmTasksService, isUuid } from './am-tasks.service';
import type { AmScope } from './am.types';

export type AmInteractionKind = 'note' | 'call' | 'meeting' | 'email' | 'system';

export type AmInteractionActionItem = {
  title: string;
  done?: boolean;
  due_at?: string;
  task_id?: string;
};

export type AmActionItemToTaskResult = {
  task_id: string;
  created: boolean;
  action_items: AmInteractionActionItem[];
};

export type AmInteractionRow = {
  id: string;
  agency_client_id: string;
  kind: AmInteractionKind;
  occurred_at: string;
  actor_staff_id: number | null;
  summary: string;
  sentiment: string | null;
  visibility: string;
  attendees: string[];
  action_items: AmInteractionActionItem[];
  created_at: string;
  editable: boolean;
};

export type AmCreateInteractionInput = {
  agency_client_id?: string;
  kind?: string;
  occurred_at?: string;
  summary?: string;
  sentiment?: string;
  visibility?: string;
  attendees?: string[];
  action_items?: AmInteractionActionItem[];
};

export type AmPatchInteractionInput = {
  summary?: string;
  sentiment?: string | null;
  visibility?: string;
  attendees?: string[];
  action_items?: AmInteractionActionItem[];
};

export type AmInteractionsListQuery = {
  agency_client_id?: string;
  scope?: AmScope;
};

export type AmInteractionsReq = {
  staffUser?: StaffJwtPayload;
  staffAuthVia?: 'internal' | 'jwt';
};

export type AmInteractionsDb = {
  query(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: Record<string, unknown>[]; rowCount?: number | null }>;
};

const HUMAN_KINDS: AmInteractionKind[] = ['note', 'call', 'meeting', 'email'];
const SYSTEM_AUDIT_ACTIONS = `(a.action LIKE 'health.%' OR a.action LIKE 'handover.%' OR a.action = 'account.transfer')`;

const INTERACTION_COLS = `
  i.id::text AS id,
  i.agency_client_id::text AS agency_client_id,
  i.kind,
  i.occurred_at,
  i.actor_staff_id,
  i.summary,
  i.sentiment,
  i.visibility,
  i.attendees_json,
  i.action_items_json,
  i.created_at
`;

@Injectable()
export class AmInteractionsRepository implements OnModuleDestroy, AmInteractionsDb {
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

  async query(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: Record<string, unknown>[]; rowCount?: number | null }> {
    return this.db.query(sql, params);
  }
}

@Injectable()
export class AmInteractionsService {
  constructor(
    private readonly db: AmInteractionsRepository,
    private readonly staffAuth: StaffAuthService,
    private readonly audit: AmAuditRepository,
    private readonly tasks: AmTasksService,
  ) {}

  async list(
    req: AmInteractionsReq,
    q: AmInteractionsListQuery,
  ): Promise<{ items: AmInteractionRow[] }> {
    const clientId = requireClientId(q.agency_client_id);
    const actor = await this.resolveActor(req, q.scope);
    await this.requireScopedClient(actor, clientId);

    const bound = bindScopeSql(
      amScopeSql({ scope: actor.scope, staffId: actor.staffId, teamIds: actor.teamIds }),
      3,
    );
    let stored: AmInteractionRow[] = [];
    try {
      const result = await this.db.query(
        `SELECT ${INTERACTION_COLS}
           FROM crm_am_interactions i
           INNER JOIN crm_am_account_ext e
                   ON e.agency_client_id = i.agency_client_id
                  AND e.tenant_id = i.tenant_id
          WHERE i.tenant_id = $1
            AND i.agency_client_id = $2::uuid
            AND ${bound.sql}
          ORDER BY i.occurred_at DESC, i.created_at DESC`,
        [AM_TENANT_ID, clientId, ...bound.params],
      );
      stored = result.rows.map(mapRow);
    } catch (err) {
      if (!isMissingRelation(err)) throw err;
    }

    const synthesized = await this.loadAuditRows(clientId);
    const items = [...stored, ...synthesized].sort((a, b) => {
      const ta = Date.parse(a.occurred_at) || 0;
      const tb = Date.parse(b.occurred_at) || 0;
      if (tb !== ta) return tb - ta;
      return (Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0);
    });
    return { items };
  }

  async create(
    req: AmInteractionsReq,
    body: AmCreateInteractionInput,
    staffId: number,
  ): Promise<AmInteractionRow> {
    const clientId = requireClientId(body.agency_client_id);
    const kindRaw = String(body.kind ?? '').trim();
    if (kindRaw === 'system') amThrow(400, { error: 'system_readonly' });
    if (!HUMAN_KINDS.includes(kindRaw as AmInteractionKind)) {
      amThrow(400, { error: 'invalid_kind' });
    }
    const kind = kindRaw as Exclude<AmInteractionKind, 'system'>;
    const summary = String(body.summary ?? '').trim();
    if (!summary) amThrow(400, { error: 'summary_required' });
    const attendees = normalizeAttendees(body.attendees);
    if (kind === 'meeting' && attendees.length < 1) {
      amThrow(400, { error: 'attendees_required' });
    }
    const occurredAt = parseOccurredAt(body.occurred_at);
    const actionItems = normalizeActionItems(body.action_items);
    const visibility = String(body.visibility ?? 'internal').trim() || 'internal';
    const sentiment = emptyToNull(body.sentiment);

    const actor = await this.resolveActor(req, undefined);
    await this.requireScopedClient(actor, clientId);

    const inserted = await this.db.query(
      `INSERT INTO crm_am_interactions (
         tenant_id, agency_client_id, kind, occurred_at, actor_staff_id,
         summary, sentiment, visibility, attendees_json, action_items_json
       ) VALUES ($1, $2::uuid, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb)
       RETURNING ${INTERACTION_COLS.replaceAll('i.', '')}`,
      [
        AM_TENANT_ID,
        clientId,
        kind,
        occurredAt,
        staffId > 0 ? staffId : null,
        summary,
        sentiment,
        visibility,
        JSON.stringify(attendees),
        JSON.stringify(actionItems),
      ],
    );
    const row = inserted.rows[0];
    if (!row) amThrow(500, { error: 'insert_failed' });
    const out = mapRow(row);

    await this.audit.insert({
      actor_staff_id: staffId > 0 ? staffId : null,
      action: 'interaction.create',
      entity_type: 'interaction',
      entity_id: out.id,
      payload_json: { agency_client_id: clientId, kind },
    });

    for (let i = 0; i < actionItems.length; i += 1) {
      const item = actionItems[i];
      if (item.done !== true || !item.title) continue;
      await this.tasks.create(
        {
          agency_client_id: clientId,
          title: item.title,
          source: 'interaction',
          source_ref: `interaction:${out.id}:${i}`,
          due_at: item.due_at,
        },
        staffId,
      );
    }

    return out;
  }

  async patch(
    req: AmInteractionsReq,
    rawId: string,
    body: AmPatchInteractionInput,
    _staffId: number,
  ): Promise<AmInteractionRow> {
    const id = String(rawId ?? '').trim();
    if (id.startsWith('audit:')) amThrow(409, { error: 'system_readonly' });
    if (!isUuid(id)) amThrow(400, { error: 'invalid_interaction_id' });

    const actor = await this.resolveActor(req, undefined);
    const current = await this.loadScoped(actor, id);
    if (current.kind === 'system') amThrow(409, { error: 'system_readonly' });

    const summary =
      body.summary != null ? String(body.summary).trim() : current.summary;
    if (!summary) amThrow(400, { error: 'summary_required' });
    const attendees =
      body.attendees != null ? normalizeAttendees(body.attendees) : current.attendees;
    if (current.kind === 'meeting' && attendees.length < 1) {
      amThrow(400, { error: 'attendees_required' });
    }
    const actionItems =
      body.action_items != null ? normalizeActionItems(body.action_items) : current.action_items;
    const visibility =
      body.visibility != null
        ? String(body.visibility).trim() || current.visibility
        : current.visibility;
    const sentiment =
      body.sentiment !== undefined ? emptyToNull(body.sentiment) : current.sentiment;

    const updated = await this.db.query(
      `UPDATE crm_am_interactions
          SET summary = $3,
              sentiment = $4,
              visibility = $5,
              attendees_json = $6::jsonb,
              action_items_json = $7::jsonb
        WHERE tenant_id = $1 AND id = $2::uuid
        RETURNING id::text AS id,
                  agency_client_id::text AS agency_client_id,
                  kind, occurred_at, actor_staff_id, summary, sentiment, visibility,
                  attendees_json, action_items_json, created_at`,
      [AM_TENANT_ID, id, summary, sentiment, visibility, JSON.stringify(attendees), JSON.stringify(actionItems)],
    );
    const row = updated.rows[0];
    if (!row) amThrow(404, { error: 'not_found' });
    return mapRow(row);
  }

  async toTask(
    req: AmInteractionsReq,
    rawId: string,
    rawIndex: number | string,
  ): Promise<AmActionItemToTaskResult> {
    const id = String(rawId ?? '').trim();
    if (id.startsWith('audit:')) amThrow(409, { error: 'system_readonly' });
    if (!isUuid(id)) amThrow(400, { error: 'invalid_interaction_id' });

    const index = Number.parseInt(String(rawIndex), 10);
    if (!Number.isInteger(index) || index < 0) {
      amThrow(400, { error: 'action_item_not_found' });
    }

    const actor = await this.resolveActor(req, undefined);
    const current = await this.loadScoped(actor, id);
    const item = current.action_items[index];
    if (!item) amThrow(400, { error: 'action_item_not_found' });

    const sourceRef = `${id}:${index}`;
    const existingId = await this.findOpenTaskId('interaction', sourceRef);
    let created = false;
    let taskId = existingId || item.task_id || '';

    if (!existingId && !item.task_id) {
      try {
        const task = await this.tasks.create(
          {
            agency_client_id: current.agency_client_id,
            title: item.title,
            kind: 'task',
            due_at: item.due_at,
            source: 'interaction',
            source_ref: sourceRef,
          },
          actor.staffId,
        );
        taskId = task.id;
        created = true;
      } catch (err) {
        if (!isDuplicateSourceRef(err)) throw err;
        const again = await this.findOpenTaskId('interaction', sourceRef);
        if (!again) throw err;
        taskId = again;
      }
    }

    const actionItems = current.action_items.map((row, i) =>
      i === index ? { ...row, done: true, task_id: taskId } : row,
    );

    await this.db.query(
      `UPDATE crm_am_interactions
          SET action_items_json = $3::jsonb
        WHERE tenant_id = $1 AND id = $2::uuid`,
      [AM_TENANT_ID, id, JSON.stringify(actionItems)],
    );

    await this.audit.insert({
      actor_staff_id: actor.staffId > 0 ? actor.staffId : null,
      action: 'interaction.action_item_to_task',
      entity_type: 'interaction',
      entity_id: id,
      payload_json: { index, task_id: taskId, created },
    });

    return { task_id: taskId, created, action_items: actionItems };
  }

  private async findOpenTaskId(source: string, sourceRef: string): Promise<string | null> {
    try {
      const result = await this.db.query(
        `SELECT id::text AS id
           FROM crm_am_tasks
          WHERE tenant_id = $1
            AND source = $2
            AND source_ref = $3
            AND dismissed_at IS NULL
            AND status NOT IN ('cancelled', 'closed')
          LIMIT 1`,
        [AM_TENANT_ID, source, sourceRef],
      );
      const id = result.rows[0]?.id;
      return id ? String(id) : null;
    } catch (err) {
      if (isMissingRelation(err)) return null;
      throw err;
    }
  }

  private async requireScopedClient(
    actor: { scope: AmScope; staffId: number; teamIds: number[] },
    clientId: string,
  ): Promise<void> {
    const bound = bindScopeSql(
      amScopeSql({ scope: actor.scope, staffId: actor.staffId, teamIds: actor.teamIds }),
      3,
    );
    try {
      const result = await this.db.query(
        `SELECT e.agency_client_id::text AS agency_client_id
           FROM crm_am_account_ext e
          WHERE e.tenant_id = $1
            AND e.agency_client_id = $2::uuid
            AND ${bound.sql}
          LIMIT 1`,
        [AM_TENANT_ID, clientId, ...bound.params],
      );
      if (!result.rows[0]) amThrow(404, { error: 'not_found' });
    } catch (err) {
      if ((err as { error?: string }).error === 'not_found') throw err;
      if (isMissingRelation(err)) amThrow(404, { error: 'not_found' });
      throw err;
    }
  }

  private async loadScoped(
    actor: { scope: AmScope; staffId: number; teamIds: number[] },
    id: string,
  ): Promise<AmInteractionRow> {
    const bound = bindScopeSql(
      amScopeSql({ scope: actor.scope, staffId: actor.staffId, teamIds: actor.teamIds }),
      3,
    );
    const result = await this.db.query(
      `SELECT ${INTERACTION_COLS}
         FROM crm_am_interactions i
         INNER JOIN crm_am_account_ext e
                 ON e.agency_client_id = i.agency_client_id
                AND e.tenant_id = i.tenant_id
        WHERE i.tenant_id = $1
          AND i.id = $2::uuid
          AND ${bound.sql}
        LIMIT 1`,
      [AM_TENANT_ID, id, ...bound.params],
    );
    const row = result.rows[0];
    if (!row) amThrow(404, { error: 'not_found' });
    return mapRow(row);
  }

  private async loadAuditRows(clientId: string): Promise<AmInteractionRow[]> {
    try {
      const result = await this.db.query(
        `SELECT a.id::text AS id,
                a.action,
                a.actor_staff_id,
                a.entity_id,
                a.payload_json,
                a.created_at
           FROM crm_am_audit a
          WHERE a.tenant_id = $1
            AND ${SYSTEM_AUDIT_ACTIONS}
            AND (
              a.entity_id = $2
              OR a.payload_json->>'agency_client_id' = $2
              OR COALESCE(a.payload_json->'agency_client_ids', '[]'::jsonb) ? $2
            )
          ORDER BY a.created_at DESC`,
        [AM_TENANT_ID, clientId],
      );
      return result.rows.map((row) => mapAuditRow(row, clientId));
    } catch (err) {
      if (isMissingRelation(err)) return [];
      throw err;
    }
  }

  private async resolveActor(
    req: AmInteractionsReq,
    requested: AmScope | undefined,
  ): Promise<{ staffId: number; scope: AmScope; teamIds: number[] }> {
    const internal = req.staffAuthVia === 'internal';
    const staffId = req.staffUser
      ? ((await this.staffAuth.resolveCrmStaffUserId(req.staffUser)) ?? 0)
      : 0;
    if (internal && !req.staffUser) {
      return {
        staffId,
        scope: resolveAmScope({ requested, hasViewAll: true, canTeam: true }),
        teamIds: [],
      };
    }
    if (!req.staffUser) {
      return { staffId, scope: 'me', teamIds: [] };
    }
    const me = await this.staffAuth.me(req.staffUser);
    const has = (action: string) => this.staffAuth.hasCap(me.caps, 'crm_am', action);
    const hasViewAll = has('view_all') || has('manage');
    const canTeam = hasViewAll || has('assign');
    const scope = resolveAmScope({ requested, hasViewAll, canTeam });
    const teamIds = scope === 'team' ? await this.loadTeamIds(staffId) : [];
    return { staffId, scope, teamIds };
  }

  private async loadTeamIds(staffId: number): Promise<number[]> {
    if (staffId <= 0) return [];
    try {
      const result = await this.db.query(
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
    } catch (err) {
      if (isMissingRelation(err)) return [];
      throw err;
    }
  }
}

function requireClientId(raw: string | undefined): string {
  const clientId = String(raw ?? '').trim();
  if (!clientId) amThrow(400, { error: 'agency_client_id_required' });
  if (!isUuid(clientId)) amThrow(400, { error: 'invalid_agency_client_id' });
  return clientId;
}

function parseOccurredAt(raw: string | undefined): string {
  if (raw == null || String(raw).trim() === '') return new Date().toISOString();
  const t = Date.parse(String(raw));
  if (!Number.isFinite(t)) amThrow(400, { error: 'invalid_occurred_at' });
  return new Date(t).toISOString();
}

function normalizeAttendees(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => String(item ?? '').trim()).filter(Boolean);
}

function normalizeActionItems(raw: unknown): AmInteractionActionItem[] {
  if (!Array.isArray(raw)) return [];
  const items: AmInteractionActionItem[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const title = String(rec.title ?? '').trim();
    if (!title) continue;
    const due = rec.due_at != null ? String(rec.due_at).trim() : '';
    const taskId = rec.task_id != null ? String(rec.task_id).trim() : '';
    items.push({
      title,
      done: rec.done === true,
      ...(due ? { due_at: due } : {}),
      ...(taskId ? { task_id: taskId } : {}),
    });
  }
  return items;
}

function mapRow(row: Record<string, unknown>): AmInteractionRow {
  const kind = String(row.kind ?? 'note') as AmInteractionKind;
  return {
    id: String(row.id ?? ''),
    agency_client_id: String(row.agency_client_id ?? ''),
    kind,
    occurred_at: iso(row.occurred_at),
    actor_staff_id: row.actor_staff_id == null ? null : Number(row.actor_staff_id),
    summary: String(row.summary ?? ''),
    sentiment: emptyToNull(row.sentiment),
    visibility: String(row.visibility ?? 'internal'),
    attendees: asStringList(row.attendees_json ?? row.attendees),
    action_items: asActionItems(row.action_items_json ?? row.action_items),
    created_at: iso(row.created_at),
    editable: kind !== 'system',
  };
}

function mapAuditRow(row: Record<string, unknown>, clientId: string): AmInteractionRow {
  const action = String(row.action ?? 'system');
  const payload = asRecord(row.payload_json);
  const reason = payload?.reason != null ? String(payload.reason) : '';
  const at = iso(row.created_at);
  return {
    id: `audit:${String(row.id ?? '')}`,
    agency_client_id: clientId,
    kind: 'system',
    occurred_at: at,
    actor_staff_id: row.actor_staff_id == null ? null : Number(row.actor_staff_id),
    summary: reason ? `${action}: ${reason}` : action,
    sentiment: null,
    visibility: 'internal',
    attendees: [],
    action_items: [],
    created_at: at,
    editable: false,
  };
}

function asStringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item ?? '').trim()).filter(Boolean);
  if (typeof value === 'string') {
    try {
      return asStringList(JSON.parse(value) as unknown);
    } catch {
      return value.split(',').map((item) => item.trim()).filter(Boolean);
    }
  }
  return [];
}

function asActionItems(value: unknown): AmInteractionActionItem[] {
  let raw: unknown = value;
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw) as unknown;
    } catch {
      return [];
    }
  }
  return normalizeActionItems(raw);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return null;
    }
  }
  return null;
}

function iso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  const s = String(value ?? '');
  const t = Date.parse(s);
  return Number.isFinite(t) ? new Date(t).toISOString() : s;
}

function emptyToNull(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s || null;
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

function isMissingRelation(err: unknown): boolean {
  const e = err as { code?: string; message?: string };
  return e.code === '42P01' || /does not exist/i.test(e.message ?? '');
}

function isDuplicateSourceRef(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as {
    status?: number;
    error?: string;
    getStatus?: () => number;
    getResponse?: () => unknown;
  };
  if (e.error === 'duplicate_source_ref') return true;
  const status = typeof e.getStatus === 'function' ? e.getStatus() : e.status;
  if (status !== 409) return false;
  const res = typeof e.getResponse === 'function' ? e.getResponse() : null;
  if (res && typeof res === 'object' && (res as { error?: string }).error === 'duplicate_source_ref') {
    return true;
  }
  return true;
}
