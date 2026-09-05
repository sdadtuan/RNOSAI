import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { AmAuditRepository, AM_TENANT_ID } from './am-audit.repository';
import { amThrow } from './am-http';
import { amScopeSql, resolveAmScope } from './am-scope.util';
import { isUuid } from './am-tasks.service';
import type { AmScope } from './am.types';

export const AM_HANDOVER_CHECKLIST_KEYS = [
  'understood_scope',
  'stakeholders_access',
  'delivery_owner',
] as const;

export type AmHandoverChecklistKey = (typeof AM_HANDOVER_CHECKLIST_KEYS)[number];

export type AmHandoverStatus = 'draft' | 'pending_am' | 'accepted' | 'rejected' | 'needs_info';

export type AmHandoverChecklist = Partial<Record<AmHandoverChecklistKey, boolean>>;

export type AmHandover = {
  id: string;
  agency_client_id: string;
  status: AmHandoverStatus;
  commercial_json: Record<string, unknown>;
  scope_json: Record<string, unknown>;
  stakeholders_json: Record<string, unknown>;
  reject_reason: string | null;
  accepted_by_staff_id: number | null;
  accepted_at: string | null;
  name: string;
  code: string;
  am_status: string;
  onboarding_case_id?: string | null;
};

export type AmHandoverListQuery = {
  scope?: AmScope;
  agency_client_id?: string;
  status?: string;
};

export type AmHandoverReq = {
  staffUser?: StaffJwtPayload;
  staffAuthVia?: 'internal' | 'jwt';
};

export type AmHandoverQuery = (
  sql: string,
  params?: unknown[],
) => Promise<{ rows: Record<string, unknown>[]; rowCount?: number | null }>;

export type AmHandoverDb = {
  query: AmHandoverQuery;
  withTransaction?<T>(fn: (query: AmHandoverQuery) => Promise<T>): Promise<T>;
};

const HANDOVER_COLS = `
  h.id::text AS id,
  h.agency_client_id::text AS agency_client_id,
  h.status,
  h.commercial_json,
  h.scope_json,
  h.stakeholders_json,
  h.reject_reason,
  h.accepted_by_staff_id,
  h.accepted_at,
  c.name,
  c.code,
  e.am_status
`;

const HANDOVER_FROM = `
  FROM crm_am_handovers h
  INNER JOIN crm_am_account_ext e
          ON e.agency_client_id = h.agency_client_id AND e.tenant_id = h.tenant_id
  INNER JOIN clients c ON c.id = h.agency_client_id
`;

const ACTIONABLE: AmHandoverStatus[] = ['pending_am', 'needs_info'];

@Injectable()
export class AmOnboardingRepository implements OnModuleDestroy, AmHandoverDb {
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

  async withTransaction<T>(fn: (query: AmHandoverQuery) => Promise<T>): Promise<T> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      const result = await fn((sql, params) => client.query(sql, params));
      await client.query('COMMIT');
      return result;
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch {
        /* connection may already be broken */
      }
      throw err;
    } finally {
      client.release();
    }
  }
}

@Injectable()
export class AmOnboardingService {
  constructor(
    private readonly db: AmOnboardingRepository,
    private readonly staffAuth: StaffAuthService,
    private readonly audit: AmAuditRepository,
  ) {}

  async list(req: AmHandoverReq, q: AmHandoverListQuery): Promise<{ items: AmHandover[] }> {
    const actor = await this.resolveActor(req, q.scope);
    const bound = this.scopedWhere(actor, 2);
    const params: unknown[] = [AM_TENANT_ID, ...bound.params];
    const where = [`h.tenant_id = $1`, bound.sql];

    const clientId = String(q.agency_client_id ?? '').trim();
    if (clientId) {
      if (!isUuid(clientId)) amThrow(400, { error: 'invalid_agency_client_id' });
      params.push(clientId);
      where.push(`h.agency_client_id = $${params.length}::uuid`);
    }

    const statuses = csv(q.status);
    const allowed = statuses.filter((s) =>
      ['draft', 'pending_am', 'accepted', 'rejected', 'needs_info'].includes(s),
    );
    if (allowed.length) {
      params.push(allowed);
      where.push(`h.status = ANY($${params.length}::text[])`);
    } else if (!clientId) {
      params.push(ACTIONABLE);
      where.push(`h.status = ANY($${params.length}::text[])`);
    }

    const result = await this.db.query(
      `SELECT ${HANDOVER_COLS} ${HANDOVER_FROM}
        WHERE ${where.join(' AND ')}
        ORDER BY h.created_at DESC`,
      params,
    );
    let items = result.rows.map(mapHandover);
    if (clientId && items.length === 0) {
      const created = await this.ensurePending(actor, clientId);
      if (created) items = [created];
    }
    return { items };
  }

  async get(req: AmHandoverReq, id: string): Promise<AmHandover> {
    if (!isUuid(id)) amThrow(400, { error: 'invalid_handover_id' });
    const actor = await this.resolveActor(req, undefined);
    const row = await this.loadScoped(actor, id);
    if (!row) amThrow(404, { error: 'not_found' });
    return row;
  }

  async accept(
    req: AmHandoverReq,
    id: string,
    body: { checklist?: AmHandoverChecklist },
    staffId: number,
  ): Promise<AmHandover> {
    if (!checklistComplete(body.checklist)) {
      amThrow(400, { error: 'checklist_required' });
    }
    const current = await this.requireActionable(req, id);
    const acceptedAt = new Date().toISOString();

    const { onboardingCaseId, templateId } = await this.inTx(async (query) => {
      const updated = await query(
        `UPDATE crm_am_handovers
            SET status = 'accepted',
                accepted_by_staff_id = $2,
                accepted_at = $3::timestamptz,
                reject_reason = NULL
          WHERE tenant_id = $1 AND id = $4::uuid
            AND status IN ('pending_am', 'needs_info')`,
        [AM_TENANT_ID, staffId > 0 ? staffId : null, acceptedAt, id],
      );
      if ((updated.rowCount ?? 0) === 0) {
        amThrow(409, { error: 'already_processed' });
      }

      await query(
        `UPDATE crm_am_account_ext
            SET am_status = 'onboarding', updated_at = now()
          WHERE tenant_id = $1 AND agency_client_id = $2::uuid`,
        [AM_TENANT_ID, current.agency_client_id],
      );

      const template = await this.publishedTemplate(query);
      const itemsJson = template?.items_json ?? [];
      const inserted = await query(
        `INSERT INTO crm_am_onboarding_cases (
           tenant_id, agency_client_id, template_id, status, items_json
         ) VALUES ($1, $2::uuid, $3, 'open', $4::jsonb)
         RETURNING id::text AS id`,
        [AM_TENANT_ID, current.agency_client_id, template?.id ?? null, JSON.stringify(itemsJson)],
      );
      return {
        onboardingCaseId: String(inserted.rows[0]?.id ?? ''),
        templateId: template?.id ?? null,
      };
    });

    await this.audit.insert({
      actor_staff_id: staffId > 0 ? staffId : null,
      action: 'handover.accept',
      entity_type: 'handover',
      entity_id: id,
      payload_json: {
        agency_client_id: current.agency_client_id,
        onboarding_case_id: onboardingCaseId || null,
        template_id: templateId,
      },
    });

    return {
      ...current,
      status: 'accepted',
      am_status: 'onboarding',
      accepted_by_staff_id: staffId > 0 ? staffId : null,
      accepted_at: acceptedAt,
      reject_reason: null,
      onboarding_case_id: onboardingCaseId || null,
    };
  }

  async reject(
    req: AmHandoverReq,
    id: string,
    body: { reason?: string },
    staffId: number,
  ): Promise<AmHandover> {
    const reason = requireReason(body.reason);
    const current = await this.requireActionable(req, id);
    await this.db.query(
      `UPDATE crm_am_handovers
          SET status = 'rejected', reject_reason = $2
        WHERE tenant_id = $1 AND id = $3::uuid`,
      [AM_TENANT_ID, reason, id],
    );
    await this.audit.insert({
      actor_staff_id: staffId > 0 ? staffId : null,
      action: 'handover.reject',
      entity_type: 'handover',
      entity_id: id,
      payload_json: { agency_client_id: current.agency_client_id, reason },
    });
    return { ...current, status: 'rejected', reject_reason: reason };
  }

  async needsInfo(
    req: AmHandoverReq,
    id: string,
    body: { reason?: string },
    staffId: number,
  ): Promise<AmHandover> {
    const reason = requireReason(body.reason);
    const current = await this.requireActionable(req, id);
    await this.db.query(
      `UPDATE crm_am_handovers
          SET status = 'needs_info', reject_reason = $2
        WHERE tenant_id = $1 AND id = $3::uuid`,
      [AM_TENANT_ID, reason, id],
    );
    await this.audit.insert({
      actor_staff_id: staffId > 0 ? staffId : null,
      action: 'handover.needs_info',
      entity_type: 'handover',
      entity_id: id,
      payload_json: { agency_client_id: current.agency_client_id, reason },
    });
    return { ...current, status: 'needs_info', reject_reason: reason };
  }

  private async requireActionable(req: AmHandoverReq, id: string): Promise<AmHandover> {
    if (!isUuid(id)) amThrow(400, { error: 'invalid_handover_id' });
    const actor = await this.resolveActor(req, undefined);
    const row = await this.loadScoped(actor, id);
    if (!row) amThrow(404, { error: 'not_found' });
    if (!ACTIONABLE.includes(row.status)) {
      amThrow(409, { error: 'handover_not_pending' });
    }
    return row;
  }

  private async loadScoped(actor: HandoverActor, id: string): Promise<AmHandover | null> {
    const bound = this.scopedWhere(actor, 3);
    const result = await this.db.query(
      `SELECT ${HANDOVER_COLS} ${HANDOVER_FROM}
        WHERE h.tenant_id = $1 AND h.id = $2::uuid AND ${bound.sql}
        LIMIT 1`,
      [AM_TENANT_ID, id, ...bound.params],
    );
    const row = result.rows[0];
    return row ? mapHandover(row) : null;
  }

  private async ensurePending(actor: HandoverActor, agencyClientId: string): Promise<AmHandover | null> {
    const bound = this.scopedWhere(actor, 3);
    const found = await this.db.query(
      `SELECT e.agency_client_id::text AS agency_client_id, e.am_status, c.name, c.code
         FROM crm_am_account_ext e
         INNER JOIN clients c ON c.id = e.agency_client_id
        WHERE e.tenant_id = $1 AND e.agency_client_id = $2::uuid AND ${bound.sql}
        LIMIT 1`,
      [AM_TENANT_ID, agencyClientId, ...bound.params],
    );
    const account = found.rows[0];
    if (!account) return null;
    const inserted = await this.db.query(
      `INSERT INTO crm_am_handovers (tenant_id, agency_client_id, status)
       VALUES ($1, $2::uuid, 'pending_am')
       RETURNING id::text AS id, agency_client_id::text AS agency_client_id, status,
                 commercial_json, scope_json, stakeholders_json, reject_reason,
                 accepted_by_staff_id, accepted_at`,
      [AM_TENANT_ID, agencyClientId],
    );
    const row = inserted.rows[0];
    if (!row) return null;
    return mapHandover({
      ...row,
      name: account.name,
      code: account.code,
      am_status: account.am_status,
    });
  }

  private async inTx<T>(fn: (query: AmHandoverQuery) => Promise<T>): Promise<T> {
    if (this.db.withTransaction) {
      return this.db.withTransaction(fn);
    }
    return fn((sql, params) => this.db.query(sql, params));
  }

  private async publishedTemplate(
    query: AmHandoverQuery = (sql, params) => this.db.query(sql, params),
  ): Promise<{ id: string; items_json: unknown } | null> {
    const result = await query(
      `SELECT id::text AS id, items_json
         FROM crm_am_onboarding_templates
        WHERE tenant_id = $1 AND status = 'published'
        ORDER BY version DESC
        LIMIT 1`,
      [AM_TENANT_ID],
    );
    const row = result.rows[0];
    if (!row) return null;
    return { id: String(row.id), items_json: row.items_json ?? [] };
  }

  private scopedWhere(actor: HandoverActor, startAt: number): { sql: string; params: unknown[] } {
    return bindScopeSql(
      amScopeSql({ scope: actor.scope, staffId: actor.staffId, teamIds: actor.teamIds }),
      startAt,
    );
  }

  private async resolveActor(req: AmHandoverReq, requested: AmScope | undefined): Promise<HandoverActor> {
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
    } catch {
      return [];
    }
  }
}

type HandoverActor = {
  staffId: number;
  scope: AmScope;
  teamIds: number[];
};

function checklistComplete(checklist: AmHandoverChecklist | undefined): boolean {
  if (!checklist) return false;
  return AM_HANDOVER_CHECKLIST_KEYS.every((key) => checklist[key] === true);
}

function requireReason(raw: string | undefined): string {
  const reason = String(raw ?? '').trim();
  if (!reason) amThrow(400, { error: 'reason_required' });
  return reason;
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

function csv(raw: string | undefined): string[] {
  return String(raw ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function asObj(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
  }
  return {};
}

function mapHandover(row: Record<string, unknown>): AmHandover {
  return {
    id: String(row.id ?? ''),
    agency_client_id: String(row.agency_client_id ?? ''),
    status: String(row.status ?? 'draft') as AmHandoverStatus,
    commercial_json: asObj(row.commercial_json),
    scope_json: asObj(row.scope_json),
    stakeholders_json: asObj(row.stakeholders_json),
    reject_reason: row.reject_reason == null || row.reject_reason === '' ? null : String(row.reject_reason),
    accepted_by_staff_id: row.accepted_by_staff_id == null ? null : Number(row.accepted_by_staff_id),
    accepted_at: row.accepted_at == null ? null : new Date(String(row.accepted_at)).toISOString(),
    name: String(row.name ?? ''),
    code: String(row.code ?? ''),
    am_status: String(row.am_status ?? 'pending_handover'),
    onboarding_case_id: row.onboarding_case_id == null ? null : String(row.onboarding_case_id),
  };
}
