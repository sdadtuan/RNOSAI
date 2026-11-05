import { Injectable, OnModuleDestroy, Optional } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { AmAuditRepository, AM_TENANT_ID } from './am-audit.repository';
import { AmDashboardService } from './am-dashboard.service';
import { amThrow } from './am-http';
import { amScopeSql, resolveAmScope } from './am-scope.util';
import { AmTasksService, isUuid } from './am-tasks.service';
import type { AmScope } from './am.types';

export const AM_FEEDBACK_KINDS = ['csat', 'nps', 'complaint', 'response', 'comment'] as const;
export type AmFeedbackKind = (typeof AM_FEEDBACK_KINDS)[number];

const DEFAULT_CSAT_THRESHOLD = 3;
const FOLLOWUP_MS = 24 * 60 * 60 * 1000;
const CSAT_TASK_TITLE = 'CSAT thấp — follow-up';
const GENERIC_FOLLOWUP_TITLE = 'Follow-up phản hồi';

export type AmFeedbackRow = {
  id: string;
  agency_client_id: string;
  account_name: string | null;
  kind: AmFeedbackKind;
  score: number | null;
  comment: string | null;
  followup_task_id: string | null;
  csd_ticket_id: string | null;
  csd_href: string | null;
  created_at: string;
};

export type AmFeedbackKpis = {
  csat: number | null;
  nps: number | null;
  response_pct: number | null;
  complaints_open: number | null;
};

export type AmFeedbackList = {
  items: AmFeedbackRow[];
  kpis: AmFeedbackKpis;
};

export type AmCreateFeedbackInput = {
  agency_client_id?: string;
  kind?: string;
  score?: number | null;
  comment?: string | null;
  csd_ticket_id?: string | null;
};

export type AmFollowupInput = {
  csd_ticket_id?: string | null;
};

export type AmFeedbackListQuery = {
  agency_client_id?: string;
  scope?: AmScope;
  kind?: string;
};

export type AmSurveyRow = {
  id: string;
  name: string;
  template: string;
  channel: string | null;
  audience_json: unknown;
  no_recontact_days: number | null;
  csat_task_threshold: number;
  created_at: string;
};

export type AmCreateSurveyInput = {
  name?: string;
  template?: string;
  channel?: string | null;
  audience_json?: unknown;
  no_recontact_days?: number | null;
  csat_task_threshold?: number | null;
};

export type AmFeedbackReq = {
  staffUser?: StaffJwtPayload;
  staffAuthVia?: 'internal' | 'jwt';
};

export type AmFeedbackDb = {
  query(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: Record<string, unknown>[]; rowCount?: number | null }>;
};

export const AM_FEEDBACK_CLIENTS_JOIN = 'INNER JOIN clients c ON c.id = f.agency_client_id';

const FEEDBACK_COLS = `
  f.id::text AS id,
  f.agency_client_id::text AS agency_client_id,
  NULLIF(TRIM(COALESCE(c.name, '')), '') AS account_name,
  f.kind,
  f.score,
  f.comment,
  f.followup_task_id::text AS followup_task_id,
  t.csd_ticket_id::text AS csd_ticket_id,
  f.created_at
`;

const FEEDBACK_RETURNING = `
  id::text AS id,
  agency_client_id::text AS agency_client_id,
  kind,
  score,
  comment,
  followup_task_id::text AS followup_task_id,
  created_at
`;

@Injectable()
export class AmFeedbackRepository implements OnModuleDestroy, AmFeedbackDb {
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
export class AmFeedbackService {
  constructor(
    private readonly db: AmFeedbackRepository,
    private readonly staffAuth: StaffAuthService,
    private readonly audit: AmAuditRepository,
    private readonly tasks: AmTasksService,
    @Optional() private readonly dashboard?: AmDashboardService,
  ) {}

  async list(req: AmFeedbackReq, q: AmFeedbackListQuery): Promise<AmFeedbackList> {
    const clientId = optionalClientId(q.agency_client_id);
    const kindFilter = optionalKind(q.kind);
    const actor = await this.resolveActor(req, q.scope);
    if (clientId) await this.requireScopedClient(actor, clientId);

    const params: unknown[] = [AM_TENANT_ID];
    let sql = `SELECT ${FEEDBACK_COLS}
           FROM crm_am_feedback f
           INNER JOIN crm_am_account_ext e
                   ON e.agency_client_id = f.agency_client_id
                  AND e.tenant_id = f.tenant_id
           ${AM_FEEDBACK_CLIENTS_JOIN}
           LEFT JOIN crm_am_tasks t ON t.id = f.followup_task_id
          WHERE f.tenant_id = $1`;
    if (clientId) {
      params.push(clientId);
      sql += ` AND f.agency_client_id = $${params.length}::uuid`;
    }
    if (kindFilter) {
      params.push(kindFilter);
      sql += ` AND f.kind = $${params.length}`;
    }
    const bound = bindScopeSql(
      amScopeSql({ scope: actor.scope, staffId: actor.staffId, teamIds: actor.teamIds }),
      params.length + 1,
    );
    sql += ` AND ${bound.sql} ORDER BY f.created_at DESC`;
    params.push(...bound.params);

    try {
      const result = await this.db.query(sql, params);
      const items = result.rows.map(mapFeedback);
      return { items, kpis: computeKpis(items) };
    } catch (err) {
      if (isMissingRelation(err)) return { items: [], kpis: emptyKpis() };
      throw err;
    }
  }

  async create(
    req: AmFeedbackReq,
    body: AmCreateFeedbackInput,
    staffId: number,
  ): Promise<AmFeedbackRow> {
    const clientId = requireClientId(body.agency_client_id);
    const kind = parseKind(body.kind);
    const score = parseScore(kind, body.score);
    const comment = emptyToNull(body.comment);
    const csdTicketId = optionalTicketId(body.csd_ticket_id);

    await this.requireConvertedClient(clientId);
    const actor = await this.resolveActor(req, undefined);
    await this.requireScopedClient(actor, clientId);

    const inserted = await this.db.query(
      `INSERT INTO crm_am_feedback (
         tenant_id, agency_client_id, kind, score, comment
       ) VALUES ($1, $2::uuid, $3, $4, $5)
       RETURNING ${FEEDBACK_RETURNING}`,
      [AM_TENANT_ID, clientId, kind, score, comment],
    );
    const row = inserted.rows[0];
    if (!row) amThrow(500, { error: 'insert_failed' });
    let mapped = mapFeedback({ ...row, account_name: null, csd_ticket_id: null });

    const threshold = await this.loadThreshold();
    const needsSurveyTask =
      (kind === 'csat' && score != null && score <= threshold) ||
      (kind === 'complaint' && Boolean(csdTicketId));
    if (needsSurveyTask) {
      mapped = await this.attachSurveyTask(mapped, staffId, csdTicketId);
    }

    await this.audit.insert({
      actor_staff_id: staffId > 0 ? staffId : null,
      action: 'feedback.create',
      entity_type: 'feedback',
      entity_id: mapped.id,
      payload_json: { agency_client_id: clientId, kind, score },
    });
    this.dashboard?.dropCache();
    return mapped;
  }

  async followup(
    req: AmFeedbackReq,
    rawId: string,
    staffId: number,
    body: AmFollowupInput = {},
  ): Promise<AmFeedbackRow> {
    const id = String(rawId ?? '').trim();
    if (!isUuid(id)) amThrow(400, { error: 'invalid_feedback_id' });
    const actor = await this.resolveActor(req, undefined);
    const current = await this.loadOne(actor, id);
    if (current.followup_task_id) amThrow(409, { error: 'already_followed_up' });
    const csdTicketId = optionalTicketId(body.csd_ticket_id) ?? current.csd_ticket_id;
    const out = await this.attachSurveyTask(current, staffId, csdTicketId, {
      alreadyFollowedError: 'already_followed_up',
    });
    this.dashboard?.dropCache();
    return out;
  }

  async listSurveys(_req: AmFeedbackReq): Promise<{ items: AmSurveyRow[] }> {
    try {
      const result = await this.db.query(
        `SELECT id::text AS id, name, template, channel, audience_json,
                no_recontact_days, csat_task_threshold, created_at
           FROM crm_am_surveys
          WHERE tenant_id = $1
          ORDER BY created_at DESC`,
        [AM_TENANT_ID],
      );
      return { items: result.rows.map(mapSurvey) };
    } catch (err) {
      if (isMissingRelation(err)) return { items: [] };
      throw err;
    }
  }

  async createSurvey(
    _req: AmFeedbackReq,
    body: AmCreateSurveyInput,
    staffId: number,
  ): Promise<AmSurveyRow> {
    const name = String(body.name ?? '').trim();
    if (!name) amThrow(400, { error: 'name_required' });
    const template = String(body.template ?? '').trim();
    if (!template) amThrow(400, { error: 'template_required' });
    const channel = emptyToNull(body.channel);
    const noRecontact = optionalInt(body.no_recontact_days, 'invalid_no_recontact_days');
    const threshold =
      body.csat_task_threshold == null || body.csat_task_threshold === ('' as never)
        ? DEFAULT_CSAT_THRESHOLD
        : Number(body.csat_task_threshold);
    if (!Number.isFinite(threshold)) amThrow(400, { error: 'invalid_csat_task_threshold' });
    const audience = body.audience_json ?? null;

    const inserted = await this.db.query(
      `INSERT INTO crm_am_surveys (
         tenant_id, name, template, channel, audience_json, no_recontact_days, csat_task_threshold
       ) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
       RETURNING id::text AS id, name, template, channel, audience_json,
                 no_recontact_days, csat_task_threshold, created_at`,
      [
        AM_TENANT_ID,
        name,
        template,
        channel,
        audience == null ? null : JSON.stringify(audience),
        noRecontact,
        threshold,
      ],
    );
    const row = inserted.rows[0];
    if (!row) amThrow(500, { error: 'insert_failed' });
    const mapped = mapSurvey(row);
    await this.audit.insert({
      actor_staff_id: staffId > 0 ? staffId : null,
      action: 'survey.create',
      entity_type: 'survey',
      entity_id: mapped.id,
      payload_json: { name, template, csat_task_threshold: threshold },
    });
    return mapped;
  }

  private async attachSurveyTask(
    row: AmFeedbackRow,
    staffId: number,
    csdTicketId: string | null,
    opts?: { alreadyFollowedError?: string },
  ): Promise<AmFeedbackRow> {
    const dueAt = new Date(Date.now() + FOLLOWUP_MS).toISOString();
    let task: { id: string };
    try {
      task = await this.tasks.create(
        {
          agency_client_id: row.agency_client_id,
          title: row.kind === 'csat' ? CSAT_TASK_TITLE : GENERIC_FOLLOWUP_TITLE,
          source: 'survey',
          source_ref: row.id,
          due_at: dueAt,
        },
        staffId,
      );
    } catch (err) {
      if (isConflict(err)) {
        amThrow(409, { error: opts?.alreadyFollowedError ?? 'duplicate_source_ref' });
      }
      throw err;
    }
    if (csdTicketId) {
      try {
        await this.db.query(
          `UPDATE crm_am_tasks SET csd_ticket_id = $2::uuid WHERE tenant_id = $1 AND id = $3::uuid`,
          [AM_TENANT_ID, csdTicketId, task.id],
        );
      } catch (err) {
        if (!isMissingRelation(err)) throw err;
      }
    }
    const updated = await this.db.query(
      `UPDATE crm_am_feedback
          SET followup_task_id = $3::uuid
        WHERE tenant_id = $1 AND id = $2::uuid
        RETURNING ${FEEDBACK_RETURNING}`,
      [AM_TENANT_ID, row.id, task.id],
    );
    const next = updated.rows[0] ?? { ...row, followup_task_id: task.id };
    return mapFeedback({
      ...row,
      ...next,
      followup_task_id: task.id,
      csd_ticket_id: csdTicketId,
    });
  }

  private async loadThreshold(): Promise<number> {
    try {
      const result = await this.db.query(
        `SELECT csat_task_threshold
           FROM crm_am_surveys
          WHERE tenant_id = $1
          ORDER BY created_at DESC
          LIMIT 1`,
        [AM_TENANT_ID],
      );
      const raw = result.rows[0]?.csat_task_threshold;
      const n = raw == null || raw === '' ? DEFAULT_CSAT_THRESHOLD : Number(raw);
      return Number.isFinite(n) ? n : DEFAULT_CSAT_THRESHOLD;
    } catch (err) {
      if (isMissingRelation(err)) return DEFAULT_CSAT_THRESHOLD;
      throw err;
    }
  }

  private async requireConvertedClient(clientId: string): Promise<void> {
    try {
      const found = await this.db.query(`SELECT id::text FROM clients WHERE id = $1::uuid LIMIT 1`, [
        clientId,
      ]);
      if (!found.rows[0]) amThrow(400, { error: 'client_not_found' });
    } catch (err) {
      if ((err as { status?: number }).status === 400) throw err;
      if (isMissingRelation(err)) amThrow(400, { error: 'client_not_found' });
      throw err;
    }
  }

  private async loadOne(
    actor: { scope: AmScope; staffId: number; teamIds: number[] },
    id: string,
  ): Promise<AmFeedbackRow> {
    const bound = bindScopeSql(
      amScopeSql({ scope: actor.scope, staffId: actor.staffId, teamIds: actor.teamIds }),
      3,
    );
    try {
      const result = await this.db.query(
        `SELECT ${FEEDBACK_COLS}
           FROM crm_am_feedback f
           INNER JOIN crm_am_account_ext e
                   ON e.agency_client_id = f.agency_client_id
                  AND e.tenant_id = f.tenant_id
           ${AM_FEEDBACK_CLIENTS_JOIN}
           LEFT JOIN crm_am_tasks t ON t.id = f.followup_task_id
          WHERE f.tenant_id = $1
            AND f.id = $2::uuid
            AND ${bound.sql}
          LIMIT 1`,
        [AM_TENANT_ID, id, ...bound.params],
      );
      const row = result.rows[0];
      if (!row) amThrow(404, { error: 'not_found' });
      return mapFeedback(row);
    } catch (err) {
      if ((err as { status?: number }).status === 404) throw err;
      if (isMissingRelation(err)) amThrow(404, { error: 'not_found' });
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
    const result = await this.db.query(
      `SELECT e.agency_client_id::text
         FROM crm_am_account_ext e
        WHERE e.tenant_id = $1 AND e.agency_client_id = $2::uuid AND ${bound.sql}
        LIMIT 1`,
      [AM_TENANT_ID, clientId, ...bound.params],
    );
    if (!result.rows[0]) amThrow(404, { error: 'not_found' });
  }

  private async resolveActor(
    req: AmFeedbackReq,
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

function optionalClientId(raw: string | undefined): string | null {
  if (raw == null || String(raw).trim() === '') return null;
  return requireClientId(raw);
}

function parseKind(raw: string | undefined): AmFeedbackKind {
  const kind = String(raw ?? '').trim().toLowerCase();
  if (!(AM_FEEDBACK_KINDS as readonly string[]).includes(kind)) {
    amThrow(400, { error: 'invalid_kind' });
  }
  return kind as AmFeedbackKind;
}

function optionalKind(raw: string | undefined): AmFeedbackKind | null {
  if (raw == null || String(raw).trim() === '') return null;
  return parseKind(raw);
}

function parseScore(kind: AmFeedbackKind, raw: unknown): number | null {
  if (raw == null || raw === '') {
    if (kind === 'csat' || kind === 'nps') amThrow(400, { error: 'score_required' });
    return null;
  }
  const n = Number(raw);
  if (!Number.isFinite(n)) amThrow(400, { error: 'invalid_score' });
  if (kind === 'csat' && (n < 1 || n > 5)) amThrow(400, { error: 'invalid_score' });
  if (kind === 'nps' && (n < 0 || n > 10)) amThrow(400, { error: 'invalid_score' });
  return n;
}

function optionalTicketId(raw: unknown): string | null {
  if (raw == null || String(raw).trim() === '') return null;
  const id = String(raw).trim();
  if (!isUuid(id)) amThrow(400, { error: 'invalid_csd_ticket_id' });
  return id;
}

function optionalInt(raw: unknown, error: string): number | null {
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) amThrow(400, { error });
  return n;
}

function emptyToNull(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s || null;
}

function emptyKpis(): AmFeedbackKpis {
  return { csat: null, nps: null, response_pct: null, complaints_open: null };
}

function computeKpis(items: AmFeedbackRow[]): AmFeedbackKpis {
  const csatScores = items.filter((row) => row.kind === 'csat').map((row) => row.score);
  const npsScores = items.filter((row) => row.kind === 'nps' && row.score != null).map((row) => row.score as number);
  const complaints = items.filter((row) => row.kind === 'complaint');
  return {
    csat: averageScores(csatScores),
    nps: npsScores.length ? npsOf(npsScores) : null,
    response_pct: null,
    complaints_open: complaints.length
      ? complaints.filter((row) => !row.followup_task_id).length
      : null,
  };
}

function averageScores(scores: Array<number | null>): number | null {
  const nums = scores.filter((n): n is number => n != null && Number.isFinite(n));
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function npsOf(scores: number[]): number {
  let promoters = 0;
  let detractors = 0;
  for (const score of scores) {
    if (score >= 9) promoters += 1;
    else if (score <= 6) detractors += 1;
  }
  return ((promoters - detractors) / scores.length) * 100;
}

function mapFeedback(row: Record<string, unknown>): AmFeedbackRow {
  const kind = (AM_FEEDBACK_KINDS as readonly string[]).includes(String(row.kind))
    ? (row.kind as AmFeedbackKind)
    : 'comment';
  const csdTicketId = emptyToNull(row.csd_ticket_id);
  return {
    id: String(row.id ?? ''),
    agency_client_id: String(row.agency_client_id ?? ''),
    account_name: emptyToNull(row.account_name),
    kind,
    score: row.score == null || row.score === '' ? null : Number(row.score),
    comment: emptyToNull(row.comment),
    followup_task_id: emptyToNull(row.followup_task_id),
    csd_ticket_id: csdTicketId,
    csd_href: csdTicketId ? `/crm/csd/tickets/${csdTicketId}` : null,
    created_at: iso(row.created_at),
  };
}

function mapSurvey(row: Record<string, unknown>): AmSurveyRow {
  return {
    id: String(row.id ?? ''),
    name: String(row.name ?? ''),
    template: String(row.template ?? ''),
    channel: emptyToNull(row.channel),
    audience_json: row.audience_json ?? null,
    no_recontact_days: row.no_recontact_days == null || row.no_recontact_days === ''
      ? null
      : Number(row.no_recontact_days),
    csat_task_threshold:
      row.csat_task_threshold == null || row.csat_task_threshold === ''
        ? DEFAULT_CSAT_THRESHOLD
        : Number(row.csat_task_threshold),
    created_at: iso(row.created_at),
  };
}

function iso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  const s = String(value ?? '');
  const t = Date.parse(s);
  return Number.isFinite(t) ? new Date(t).toISOString() : s;
}

function isConflict(err: unknown): boolean {
  const e = err as { status?: number; getStatus?: () => number };
  return e.status === 409 || e.getStatus?.() === 409;
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
