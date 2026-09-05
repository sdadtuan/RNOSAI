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

export type AmOnboardingItemKind = 'checklist' | 'milestone';
export type AmOnboardingCaseStatus = 'open' | 'closed';
export type AmOnboardingTrack = 'on_track' | 'at_risk' | 'blocked';
export type AmOnboardingTemplateStatus = 'draft' | 'published';

export type AmOnboardingTemplateItem = {
  id: string;
  kind: AmOnboardingItemKind;
  phase: string;
  title: string;
  owner_role: string;
  due_offset_days: number;
  required: boolean;
};

export type AmOnboardingCaseItem = AmOnboardingTemplateItem & {
  done: boolean;
  done_at: string | null;
  due_on: string | null;
};

export type AmOnboardingCase = {
  id: string;
  agency_client_id: string;
  name: string;
  code: string;
  status: AmOnboardingCaseStatus;
  go_live_on: string | null;
  override_reason: string | null;
  items: AmOnboardingCaseItem[];
  progress_pct: number | null;
  owner_name: string | null;
  delivery_owner: string | null;
  track: AmOnboardingTrack;
  health_fresh_24h: boolean;
  stakeholders: Record<string, unknown>;
  activity: unknown[];
  documents: unknown[];
};

export type AmOnboardingCaseListItem = {
  id: string;
  agency_client_id: string;
  name: string;
  code: string;
  status: AmOnboardingCaseStatus;
  go_live_on: string | null;
  progress_pct: number | null;
  track: AmOnboardingTrack;
};

export type AmOnboardingCaseListQuery = {
  scope?: AmScope;
  agency_client_id?: string;
};

export type AmOnboardingTemplate = {
  id: string;
  name: string;
  version: number;
  status: AmOnboardingTemplateStatus;
  items: AmOnboardingTemplateItem[];
};

export type AmGoLiveBody = {
  go_live_on?: string;
  override?: boolean;
  override_reason?: string;
  notes?: string;
};

export type AmPatchCaseBody = {
  items?: Array<{ id: string; done: boolean }>;
};

export type AmPatchTemplateBody = {
  name?: string;
  items?: unknown;
};

export type AmCreateTemplateBody = {
  name?: string;
  items?: unknown;
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

const ICT = 'Asia/Ho_Chi_Minh';

const CASE_COLS = `
  oc.id::text AS id,
  oc.agency_client_id::text AS agency_client_id,
  oc.template_id::text AS template_id,
  oc.status,
  oc.go_live_on,
  oc.items_json,
  oc.override_reason,
  oc.created_at,
  c.name,
  c.code,
  owner.name AS owner_name
`;

const CASE_FROM = `
  FROM crm_am_onboarding_cases oc
  INNER JOIN crm_am_account_ext e
          ON e.agency_client_id = oc.agency_client_id AND e.tenant_id = oc.tenant_id
  INNER JOIN clients c ON c.id = oc.agency_client_id
  LEFT JOIN crm_staff owner ON owner.id = e.account_owner_staff_id
`;

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

  async listCases(
    req: AmHandoverReq,
    q: AmOnboardingCaseListQuery,
  ): Promise<{ items: AmOnboardingCaseListItem[] }> {
    const actor = await this.resolveActor(req, q.scope);
    const bound = this.scopedWhere(actor, 2);
    const params: unknown[] = [AM_TENANT_ID, ...bound.params];
    const where = [`oc.tenant_id = $1`, bound.sql];
    const clientId = String(q.agency_client_id ?? '').trim();
    if (clientId) {
      if (!isUuid(clientId)) amThrow(400, { error: 'invalid_agency_client_id' });
      params.push(clientId);
      where.push(`oc.agency_client_id = $${params.length}::uuid`);
    }
    const result = await this.db.query(
      `SELECT ${CASE_COLS} ${CASE_FROM}
        WHERE ${where.join(' AND ')}
        ORDER BY oc.created_at DESC`,
      params,
    );
    return { items: result.rows.map(mapCaseListItem) };
  }

  async getCase(req: AmHandoverReq, id: string): Promise<AmOnboardingCase> {
    const row = await this.requireCase(req, id);
    const extras = await this.loadCaseExtras(row.agency_client_id);
    return mapCaseDetail(row, extras);
  }

  async patchCase(req: AmHandoverReq, id: string, body: AmPatchCaseBody): Promise<AmOnboardingCase> {
    const row = await this.requireCase(req, id);
    if (row.status === 'closed') amThrow(409, { error: 'case_closed' });
    const items = hydrateCaseItems(row.items_json, row.created_at);
    const toggles = Array.isArray(body.items) ? body.items : [];
    for (const toggle of toggles) {
      const itemId = String(toggle?.id ?? '').trim();
      const hit = items.find((item) => item.id === itemId);
      if (!hit) amThrow(400, { error: 'invalid_item_id' });
      hit.done = toggle.done === true;
      hit.done_at = hit.done ? new Date().toISOString() : null;
    }
    await this.db.query(
      `UPDATE crm_am_onboarding_cases
          SET items_json = $2::jsonb
        WHERE tenant_id = $1 AND id = $3::uuid`,
      [AM_TENANT_ID, JSON.stringify(items), id],
    );
    return this.getCase(req, id);
  }

  async goLive(
    req: AmHandoverReq,
    id: string,
    body: AmGoLiveBody,
    staffId: number,
  ): Promise<AmOnboardingCase> {
    const goLiveOn = String(body.go_live_on ?? '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(goLiveOn)) {
      amThrow(400, { error: 'invalid_go_live_on' });
    }
    const row = await this.requireCase(req, id);
    if (row.status === 'closed') amThrow(409, { error: 'already_closed' });
    const items = hydrateCaseItems(row.items_json, row.created_at);
    const blocked = items.some((item) => item.required && !item.done);
    const override = body.override === true;
    const reason = String(body.override_reason ?? '').trim();
    if (blocked && !override) amThrow(400, { error: 'required_open' });
    if (blocked && override && !reason) amThrow(400, { error: 'override_reason_required' });

    await this.inTx(async (query) => {
      const updated = await query(
        `UPDATE crm_am_onboarding_cases
            SET status = 'closed',
                go_live_on = $2::date,
                override_reason = $3
          WHERE tenant_id = $1 AND id = $4::uuid AND status = 'open'`,
        [AM_TENANT_ID, goLiveOn, reason || null, id],
      );
      if ((updated.rowCount ?? 0) === 0) {
        amThrow(409, { error: 'already_closed' });
      }
      await query(
        `UPDATE crm_am_account_ext
            SET am_status = 'active', updated_at = now()
          WHERE tenant_id = $1 AND agency_client_id = $2::uuid`,
        [AM_TENANT_ID, row.agency_client_id],
      );
    });

    await this.audit.insert({
      actor_staff_id: staffId > 0 ? staffId : null,
      action: 'onboarding.go_live',
      entity_type: 'onboarding_case',
      entity_id: id,
      payload_json: {
        agency_client_id: row.agency_client_id,
        go_live_on: goLiveOn,
        override,
        override_reason: reason || null,
        notes: String(body.notes ?? '').trim() || null,
      },
    });

    const extras = await this.loadCaseExtras(row.agency_client_id);
    return mapCaseDetail(
      { ...row, status: 'closed', go_live_on: goLiveOn, override_reason: reason || null },
      extras,
    );
  }

  async listTemplates(_req: AmHandoverReq): Promise<{ items: AmOnboardingTemplate[] }> {
    const result = await this.db.query(
      `SELECT id::text AS id, name, version, status, items_json
         FROM crm_am_onboarding_templates
        WHERE tenant_id = $1
        ORDER BY version DESC, name ASC`,
      [AM_TENANT_ID],
    );
    return { items: result.rows.map(mapTemplate) };
  }

  async createTemplate(_req: AmHandoverReq, body: AmCreateTemplateBody): Promise<AmOnboardingTemplate> {
    const name = String(body.name ?? '').trim();
    if (!name) amThrow(400, { error: 'invalid_name' });
    const items = validateTemplateItems(body.items);
    const version = await this.nextTemplateVersion(name);
    const inserted = await this.db.query(
      `INSERT INTO crm_am_onboarding_templates (tenant_id, name, version, status, items_json)
       VALUES ($1, $2, $3, 'draft', $4::jsonb)
       RETURNING id::text AS id, name, version, status, items_json`,
      [AM_TENANT_ID, name, version, JSON.stringify(items)],
    );
    const row = inserted.rows[0];
    if (!row) amThrow(400, { error: 'invalid_items' });
    return mapTemplate(row);
  }

  async patchTemplate(
    _req: AmHandoverReq,
    id: string,
    body: AmPatchTemplateBody,
  ): Promise<AmOnboardingTemplate> {
    const current = await this.requireTemplate(id);
    if (current.status === 'published') amThrow(409, { error: 'template_published' });
    const name = body.name != null ? String(body.name).trim() : current.name;
    if (!name) amThrow(400, { error: 'invalid_name' });
    const items = body.items != null ? validateTemplateItems(body.items) : current.items;
    const updated = await this.db.query(
      `UPDATE crm_am_onboarding_templates
          SET name = $2, items_json = $3::jsonb
        WHERE tenant_id = $1 AND id = $4::uuid AND status = 'draft'
       RETURNING id::text AS id, name, version, status, items_json`,
      [AM_TENANT_ID, name, JSON.stringify(items), id],
    );
    const row = updated.rows[0];
    if (!row) amThrow(409, { error: 'template_published' });
    return mapTemplate(row);
  }

  async cloneTemplate(_req: AmHandoverReq, id: string): Promise<AmOnboardingTemplate> {
    const current = await this.requireTemplate(id);
    const version = await this.nextTemplateVersion(current.name);
    const inserted = await this.db.query(
      `INSERT INTO crm_am_onboarding_templates (tenant_id, name, version, status, items_json)
       VALUES ($1, $2, $3, 'draft', $4::jsonb)
       RETURNING id::text AS id, name, version, status, items_json`,
      [AM_TENANT_ID, current.name, version, JSON.stringify(current.items)],
    );
    const row = inserted.rows[0];
    if (!row) amThrow(400, { error: 'invalid_items' });
    return mapTemplate(row);
  }

  async publishTemplate(_req: AmHandoverReq, id: string): Promise<AmOnboardingTemplate> {
    const current = await this.requireTemplate(id);
    const updated = await this.db.query(
      `UPDATE crm_am_onboarding_templates
          SET status = 'published'
        WHERE tenant_id = $1 AND id = $2::uuid
       RETURNING id::text AS id, name, version, status, items_json`,
      [AM_TENANT_ID, current.id],
    );
    const row = updated.rows[0];
    if (!row) amThrow(404, { error: 'not_found' });
    return mapTemplate(row);
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

  private async requireCase(req: AmHandoverReq, id: string): Promise<CaseRow> {
    if (!isUuid(id)) amThrow(400, { error: 'invalid_onboarding_case_id' });
    const actor = await this.resolveActor(req, undefined);
    const bound = this.scopedWhere(actor, 3);
    const result = await this.db.query(
      `SELECT ${CASE_COLS} ${CASE_FROM}
        WHERE oc.tenant_id = $1 AND oc.id = $2::uuid AND ${bound.sql}
        LIMIT 1`,
      [AM_TENANT_ID, id, ...bound.params],
    );
    const row = result.rows[0];
    if (!row) amThrow(404, { error: 'not_found' });
    return mapCaseRow(row);
  }

  private async loadCaseExtras(agencyClientId: string): Promise<CaseExtras> {
    const today = ictYmd();
    const [handover, health] = await Promise.all([
      this.db.query(
        `SELECT stakeholders_json
           FROM crm_am_handovers
          WHERE tenant_id = $1 AND agency_client_id = $2::uuid AND status = 'accepted'
          ORDER BY accepted_at DESC NULLS LAST, created_at DESC
          LIMIT 1`,
        [AM_TENANT_ID, agencyClientId],
      ),
      this.db.query(
        `SELECT 1 AS ok
           FROM crm_am_health_snapshots
          WHERE tenant_id = $1 AND agency_client_id = $2::uuid AND as_of = $3::date
          LIMIT 1`,
        [AM_TENANT_ID, agencyClientId, today],
      ),
    ]);
    const stakeholders = asObj(handover.rows[0]?.stakeholders_json);
    const delivery = stakeholders.delivery_owner;
    return {
      stakeholders,
      delivery_owner: delivery == null || delivery === '' ? null : String(delivery),
      health_fresh_24h: health.rows.length > 0,
    };
  }

  private async requireTemplate(id: string): Promise<AmOnboardingTemplate> {
    if (!isUuid(id)) amThrow(400, { error: 'invalid_template_id' });
    const result = await this.db.query(
      `SELECT id::text AS id, name, version, status, items_json
         FROM crm_am_onboarding_templates
        WHERE tenant_id = $1 AND id = $2::uuid
        LIMIT 1`,
      [AM_TENANT_ID, id],
    );
    const row = result.rows[0];
    if (!row) amThrow(404, { error: 'not_found' });
    return mapTemplate(row);
  }

  private async nextTemplateVersion(name: string): Promise<number> {
    const result = await this.db.query(
      `SELECT COALESCE(MAX(version), 0) + 1 AS version
         FROM crm_am_onboarding_templates
        WHERE tenant_id = $1 AND name = $2`,
      [AM_TENANT_ID, name],
    );
    return Number(result.rows[0]?.version ?? 1) || 1;
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

type CaseRow = {
  id: string;
  agency_client_id: string;
  template_id: string | null;
  status: AmOnboardingCaseStatus;
  go_live_on: string | null;
  items_json: unknown;
  override_reason: string | null;
  created_at: string | Date | null;
  name: string;
  code: string;
  owner_name: string | null;
};

type CaseExtras = {
  stakeholders: Record<string, unknown>;
  delivery_owner: string | null;
  health_fresh_24h: boolean;
};

function ictYmd(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ICT,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

function addDaysYmd(ymd: string, days: number): string {
  const [year, month, day] = ymd.split('-').map((part) => Number(part));
  const dt = new Date(Date.UTC(year || 1970, (month || 1) - 1, (day || 1) + days));
  return dt.toISOString().slice(0, 10);
}

function asDateOnly(value: unknown): string | null {
  if (value == null || value === '') return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const raw = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function asItems(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function hydrateCaseItems(raw: unknown, createdAt: string | Date | null): AmOnboardingCaseItem[] {
  const createdYmd = createdAt ? ictYmd(new Date(createdAt)) : ictYmd();
  return asItems(raw).map((row) => {
    const item = row && typeof row === 'object' && !Array.isArray(row) ? (row as Record<string, unknown>) : {};
    const offset = Number(item.due_offset_days);
    const dueOffset = Number.isFinite(offset) ? offset : 0;
    return {
      id: String(item.id ?? ''),
      kind: item.kind === 'milestone' ? 'milestone' : 'checklist',
      phase: String(item.phase ?? ''),
      title: String(item.title ?? ''),
      owner_role: String(item.owner_role ?? ''),
      due_offset_days: dueOffset,
      required: item.required === true,
      done: item.done === true,
      done_at: item.done_at == null || item.done_at === '' ? null : String(item.done_at),
      due_on: asDateOnly(item.due_on) ?? addDaysYmd(createdYmd, dueOffset),
    };
  });
}

function progressPct(items: AmOnboardingCaseItem[]): number | null {
  if (!items.length) return null;
  const done = items.filter((item) => item.done).length;
  return Math.round((done / items.length) * 100);
}

function caseTrack(items: AmOnboardingCaseItem[], today = ictYmd()): AmOnboardingTrack {
  const overdue = items.filter((item) => !item.done && item.due_on != null && item.due_on < today);
  if (overdue.some((item) => item.required)) return 'blocked';
  if (overdue.length) return 'at_risk';
  return 'on_track';
}

function validateTemplateItems(raw: unknown): AmOnboardingTemplateItem[] {
  if (!Array.isArray(raw)) amThrow(400, { error: 'invalid_items' });
  return raw.map((row) => {
    const item = row && typeof row === 'object' && !Array.isArray(row) ? (row as Record<string, unknown>) : {};
    const id = String(item.id ?? '').trim();
    const title = String(item.title ?? '').trim();
    const kind = item.kind;
    const offset = Number(item.due_offset_days);
    if (
      !id ||
      !title ||
      (kind !== 'checklist' && kind !== 'milestone') ||
      !Number.isFinite(offset) ||
      typeof item.required !== 'boolean'
    ) {
      amThrow(400, { error: 'invalid_items' });
    }
    return {
      id,
      kind,
      phase: String(item.phase ?? ''),
      title,
      owner_role: String(item.owner_role ?? ''),
      due_offset_days: offset,
      required: item.required,
    };
  });
}

function mapTemplate(row: Record<string, unknown>): AmOnboardingTemplate {
  const status = String(row.status ?? 'draft') === 'published' ? 'published' : 'draft';
  return {
    id: String(row.id ?? ''),
    name: String(row.name ?? ''),
    version: Number(row.version ?? 1) || 1,
    status,
    items: asItems(row.items_json).map((entry) => {
      const item =
        entry && typeof entry === 'object' && !Array.isArray(entry) ? (entry as Record<string, unknown>) : {};
      const offset = Number(item.due_offset_days);
      return {
        id: String(item.id ?? ''),
        kind: item.kind === 'milestone' ? 'milestone' : 'checklist',
        phase: String(item.phase ?? ''),
        title: String(item.title ?? ''),
        owner_role: String(item.owner_role ?? ''),
        due_offset_days: Number.isFinite(offset) ? offset : 0,
        required: item.required === true,
      };
    }),
  };
}

function mapCaseRow(row: Record<string, unknown>): CaseRow {
  return {
    id: String(row.id ?? ''),
    agency_client_id: String(row.agency_client_id ?? ''),
    template_id: row.template_id == null || row.template_id === '' ? null : String(row.template_id),
    status: String(row.status ?? 'open') === 'closed' ? 'closed' : 'open',
    go_live_on: asDateOnly(row.go_live_on),
    items_json: row.items_json,
    override_reason: row.override_reason == null || row.override_reason === '' ? null : String(row.override_reason),
    created_at: row.created_at == null ? null : (row.created_at as string | Date),
    name: String(row.name ?? ''),
    code: String(row.code ?? ''),
    owner_name: row.owner_name == null || row.owner_name === '' ? null : String(row.owner_name),
  };
}

function mapCaseDetail(row: CaseRow, extras: CaseExtras): AmOnboardingCase {
  const items = hydrateCaseItems(row.items_json, row.created_at);
  return {
    id: row.id,
    agency_client_id: row.agency_client_id,
    name: row.name,
    code: row.code,
    status: row.status,
    go_live_on: row.go_live_on,
    override_reason: row.override_reason,
    items,
    progress_pct: progressPct(items),
    owner_name: row.owner_name,
    delivery_owner: extras.delivery_owner,
    track: caseTrack(items),
    health_fresh_24h: extras.health_fresh_24h,
    stakeholders: extras.stakeholders,
    activity: [],
    documents: [],
  };
}

function mapCaseListItem(row: Record<string, unknown>): AmOnboardingCaseListItem {
  const mapped = mapCaseRow(row);
  const items = hydrateCaseItems(mapped.items_json, mapped.created_at);
  return {
    id: mapped.id,
    agency_client_id: mapped.agency_client_id,
    name: mapped.name,
    code: mapped.code,
    status: mapped.status,
    go_live_on: mapped.go_live_on,
    progress_pct: progressPct(items),
    track: caseTrack(items),
  };
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
