import { Inject, Injectable, OnModuleDestroy, Optional, forwardRef } from '@nestjs/common';
import { Pool } from 'pg';
import { AgencyService } from '../agency/agency.service';
import { AppConfigService } from '../config/app-config.service';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import type { StaffSectionCap } from '../staff-auth/staff-auth.types';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { AmAuditRepository, AM_TENANT_ID } from './am-audit.repository';
import { AmDashboardService } from './am-dashboard.service';
import { amThrow } from './am-http';
import { amScopeSql, resolveAmScope } from './am-scope.util';
import { isUuid } from './am-tasks.service';
import type { AmScope } from './am.types';

export type AmCreateAccountBody =
  | { mode: 'create'; code: string; name: string; industry_slug?: string; owner_am_id?: string }
  | { mode: 'attach'; agency_client_id: string; owner_staff_id?: number };

export type AmAccountActor = {
  staffId: number;
  caps: StaffSectionCap[];
  via?: 'internal' | 'jwt';
};

export type AmAccountsListQuery = {
  scope?: AmScope;
  q?: string;
  owner?: string;
  team?: string;
  band?: string;
  lifecycle?: string;
  industry?: string;
  sort?: string;
  page?: string;
  page_size?: string;
  parent?: string;
  ends_within?: string;
};

export type AmAccountListItem = {
  agency_client_id: string;
  code: string;
  name: string;
  parent_id: string | null;
  parent_name: string | null;
  is_parent: boolean;
  child_count: number;
  owner_staff_id: number | null;
  owner_label: string | null;
  delegated_until: string | null;
  team_label: string | null;
  am_status: string;
  band: string | null;
  score: number | null;
  mrr_vnd: number | null;
  ends_on: string | null;
  sla_label: string | null;
};

export type AmAccountsListResult = {
  items: AmAccountListItem[];
  total: number;
  page: number;
};

export type AmAccountsListReq = {
  staffUser?: StaffJwtPayload;
  staffAuthVia?: 'internal' | 'jwt';
};

export type AmTransferBody = {
  agency_client_ids: string[];
  to_staff_id: number;
  reason: string;
  keep_secondary?: boolean;
  backup_staff_id?: number;
  move_open_tasks?: boolean;
};

export type AmTransferResult = {
  transferred: number;
  to_staff_id: number;
  moved_tasks: number;
  keep_secondary: boolean;
};

export type AmAccountsDb = {
  query(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: Record<string, unknown>[]; rowCount?: number | null }>;
};

const EXT_UPSERT = `
INSERT INTO crm_am_account_ext (
  agency_client_id, tenant_id, account_owner_staff_id, am_status, updated_at
) VALUES ($1::uuid, $2, $3, 'active', now())
ON CONFLICT (agency_client_id) DO UPDATE SET
  -- first-writer-wins: keep existing owner; only set when current is null
  account_owner_staff_id = COALESCE(crm_am_account_ext.account_owner_staff_id, EXCLUDED.account_owner_staff_id),
  updated_at = now()
`;

const LIST_SORT: Record<string, string> = {
  ends_on: 'ends_on ASC NULLS LAST',
  '-ends_on': 'ends_on DESC NULLS LAST',
  mrr: 'mrr_vnd DESC NULLS LAST',
  '-mrr': 'mrr_vnd ASC NULLS LAST',
  name: 'name ASC',
  updated: 'updated_at DESC',
};

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

function csv(raw: string | undefined): string[] {
  return String(raw ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function pushParam(params: unknown[], value: unknown): string {
  params.push(value);
  return `$${params.length}`;
}

function num(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function text(value: unknown): string | null {
  if (value == null || value === '') return null;
  return String(value);
}

function dayStr(value: unknown): string | null {
  if (value == null || value === '') return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const s = String(value);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

@Injectable()
export class AmAccountsRepository implements OnModuleDestroy, AmAccountsDb {
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
export class AmAccountsService {
  constructor(
    @Inject(forwardRef(() => AgencyService)) private readonly agency: AgencyService,
    private readonly db: AmAccountsRepository,
    private readonly staffAuth: StaffAuthService,
    @Optional() private readonly dashboard?: AmDashboardService,
    @Optional() private readonly audit?: AmAuditRepository,
  ) {}

  async list(req: AmAccountsListReq, q: AmAccountsListQuery): Promise<AmAccountsListResult> {
    const actor = await this.resolveListActor(req, q.scope);
    const page = Math.max(1, Number.parseInt(String(q.page ?? '1'), 10) || 1);
    const pageSize = Math.min(100, Math.max(1, Number.parseInt(String(q.page_size ?? '50'), 10) || 50));
    const owner = String(q.owner ?? '').trim();
    if (owner === 'unassigned' && !actor.canSeeUnassigned) {
      return { items: [], total: 0, page };
    }

    try {
      return await this.queryList(actor, q, page, pageSize, true, true);
    } catch (err) {
      if (!isMissingRelation(err)) throw err;
      try {
        return await this.queryList(actor, q, page, pageSize, false, true);
      } catch (inner) {
        if (!isMissingRelation(inner)) throw inner;
        return this.queryList(actor, q, page, pageSize, false, false);
      }
    }
  }

  async createAccount(body: AmCreateAccountBody, actor: AmAccountActor) {
    if (body.mode === 'create') {
      return this.createFromAgency(body, actor);
    }
    if (body.mode === 'attach') {
      return this.attachExisting(body, actor);
    }
    amThrow(400, { error: 'invalid_mode' });
  }

  async transfer(body: AmTransferBody, actor: AmAccountActor): Promise<AmTransferResult> {
    if (!this.canAssign(actor)) {
      amThrow(403, { error: 'missing_cap', section: 'crm_am', action: 'assign' });
    }
    const reason = String(body.reason ?? '').trim();
    if (!reason) amThrow(400, { error: 'reason_required' });
    const toStaffId = Number(body.to_staff_id);
    if (!Number.isFinite(toStaffId) || toStaffId <= 0) {
      amThrow(400, { error: 'to_staff_id_required' });
    }
    const ids = [...new Set((body.agency_client_ids ?? []).map((id) => String(id ?? '').trim()).filter(Boolean))];
    if (!ids.length || ids.some((id) => !isUuid(id))) {
      amThrow(400, { error: 'agency_client_ids_required' });
    }
    const keepSecondary = Boolean(body.keep_secondary);
    const moveOpenTasks = Boolean(body.move_open_tasks);
    const backupStaffId = keepSecondary ? num(body.backup_staff_id) : null;

    const current = await this.db.query(
      `SELECT agency_client_id::text AS agency_client_id,
              account_owner_staff_id,
              backup_staff_id
         FROM crm_am_account_ext
        WHERE tenant_id = $1 AND agency_client_id = ANY($2::uuid[])`,
      [AM_TENANT_ID, ids],
    );
    const previous = current.rows.map((row) => ({
      agency_client_id: String(row.agency_client_id ?? ''),
      account_owner_staff_id: num(row.account_owner_staff_id),
      backup_staff_id: num(row.backup_staff_id),
    }));

    await this.db.query(
      `UPDATE crm_am_account_ext
          SET account_owner_staff_id = $2,
              backup_staff_id = CASE
                WHEN $3::boolean THEN COALESCE($4::int, NULLIF(account_owner_staff_id, $2))
                ELSE NULL
              END,
              updated_at = now()
        WHERE tenant_id = $1 AND agency_client_id = ANY($5::uuid[])`,
      [AM_TENANT_ID, toStaffId, keepSecondary, backupStaffId, ids],
    );
    await this.db.query(`UPDATE clients SET owner_am_id = $1 WHERE id = ANY($2::uuid[])`, [
      String(toStaffId),
      ids,
    ]);

    let movedTasks = 0;
    if (moveOpenTasks) {
      const moved = await this.db.query(
        `UPDATE crm_am_tasks
            SET assignee_staff_id = $2,
                updated_at = now()
          WHERE tenant_id = $1
            AND agency_client_id = ANY($3::uuid[])
            AND dismissed_at IS NULL
            AND status NOT IN ('closed', 'cancelled', 'resolved')`,
        [AM_TENANT_ID, toStaffId, ids],
      );
      movedTasks = Number(moved.rowCount ?? 0);
    }

    await this.audit?.insert({
      actor_staff_id: actor.staffId > 0 ? actor.staffId : null,
      action: 'account.transfer',
      entity_type: 'account',
      entity_id: ids.length === 1 ? ids[0] : null,
      payload_json: {
        agency_client_ids: ids,
        to_staff_id: toStaffId,
        reason,
        keep_secondary: keepSecondary,
        backup_staff_id: backupStaffId,
        move_open_tasks: moveOpenTasks,
        previous,
      },
    });
    this.dashboard?.dropCache();
    return {
      transferred: ids.length,
      to_staff_id: toStaffId,
      moved_tasks: movedTasks,
      keep_secondary: keepSecondary,
    };
  }

  private canAssign(actor: AmAccountActor): boolean {
    if (actor.via === 'internal') return true;
    return (
      this.staffAuth.hasCap(actor.caps ?? [], 'crm_am', 'assign') ||
      this.staffAuth.hasCap(actor.caps ?? [], 'crm_am', 'manage')
    );
  }

  private canAgencyWrite(actor: AmAccountActor): boolean {
    if (actor.via === 'internal') return true;
    return (
      this.staffAuth.hasCap(actor.caps ?? [], 'crm_agency', 'create') ||
      this.staffAuth.hasCap(actor.caps ?? [], 'crm_agency', 'write')
    );
  }

  private async createFromAgency(
    body: Extract<AmCreateAccountBody, { mode: 'create' }>,
    actor: AmAccountActor,
  ) {
    if (!this.canAgencyWrite(actor)) {
      amThrow(403, { error: 'agency_write_required', fallback: '/agency/clients/new' });
    }
    const client = await this.agency.createClient({
      code: body.code,
      name: body.name,
      industry_slug: body.industry_slug,
      owner_am_id: body.owner_am_id,
    });
    await this.upsertExt(client.id, actor.staffId);
    this.dashboard?.dropCache();
    return { agency_client_id: client.id, mode: 'create' as const, client };
  }

  private async attachExisting(
    body: Extract<AmCreateAccountBody, { mode: 'attach' }>,
    actor: AmAccountActor,
  ) {
    const agencyClientId = String(body.agency_client_id ?? '').trim();
    if (!agencyClientId) {
      amThrow(400, { error: 'agency_client_id_required' });
    }
    const found = await this.db.query(`SELECT id::text FROM clients WHERE id::text = $1 LIMIT 1`, [
      agencyClientId,
    ]);
    if ((found.rowCount ?? found.rows.length) === 0) {
      amThrow(404, { error: 'client_not_found' });
    }
    const ownerStaffId = body.owner_staff_id ?? actor.staffId;
    await this.upsertExt(agencyClientId, ownerStaffId);
    this.dashboard?.dropCache();
    return { agency_client_id: agencyClientId, mode: 'attach' as const };
  }

  private async upsertExt(agencyClientId: string, ownerStaffId: number): Promise<void> {
    await this.db.query(EXT_UPSERT, [
      agencyClientId,
      AM_TENANT_ID,
      ownerStaffId > 0 ? ownerStaffId : null,
    ]);
  }

  private async queryList(
    actor: ListActor,
    q: AmAccountsListQuery,
    page: number,
    pageSize: number,
    includeContracts: boolean,
    includeTeam: boolean,
  ): Promise<AmAccountsListResult> {
    const params: unknown[] = [AM_TENANT_ID];
    const bound = bindScopeSql(
      amScopeSql({ scope: actor.scope, staffId: actor.staffId, teamIds: actor.teamIds }),
      params.length + 1,
    );
    params.push(...bound.params);

    const where: string[] = [`e.tenant_id = $1`, bound.sql];
    const lifecycles = csv(q.lifecycle);
    if (!lifecycles.includes('churned')) {
      where.push(`e.am_status <> 'churned'`);
    }
    if (lifecycles.length) {
      where.push(`e.am_status = ANY(${pushParam(params, lifecycles)}::text[])`);
    }
    if (!actor.canSeeUnassigned) {
      where.push(`e.account_owner_staff_id IS NOT NULL`);
    }

    const owner = String(q.owner ?? '').trim();
    if (owner === 'unassigned') {
      where.push(`e.account_owner_staff_id IS NULL`);
    } else if (owner === 'me') {
      where.push(`e.account_owner_staff_id = ${pushParam(params, actor.staffId)}`);
    } else if (/^\d+$/.test(owner)) {
      where.push(`e.account_owner_staff_id = ${pushParam(params, Number(owner))}`);
    }

    const team = String(q.team ?? '').trim();
    if (/^\d+$/.test(team)) {
      where.push(`e.team_id = ${pushParam(params, Number(team))}`);
    }

    const needle = String(q.q ?? '').trim();
    if (needle) {
      const like = `%${needle.replace(/[%_\\]/g, '\\$&')}%`;
      const p = pushParam(params, like);
      where.push(`(c.code ILIKE ${p} OR c.name ILIKE ${p})`);
    }

    const industry = String(q.industry ?? '').trim();
    if (industry) {
      where.push(
        `COALESCE(NULLIF(e.industry_override, ''), c.industry_slug) = ${pushParam(params, industry)}`,
      );
    }

    const bands = csv(q.band);
    const parentOnly = q.parent === '1' || q.parent === 'true';
    const endsWithin = Number.parseInt(String(q.ends_within ?? ''), 10);
    const outer: string[] = [];
    if (bands.length) {
      outer.push(`band = ANY(${pushParam(params, bands)}::text[])`);
    }
    if (parentOnly) {
      outer.push(`child_count > 0`);
    }
    if (Number.isFinite(endsWithin) && endsWithin > 0) {
      const days = pushParam(params, endsWithin);
      outer.push(
        `ends_on IS NOT NULL AND ends_on >= CURRENT_DATE AND ends_on <= (CURRENT_DATE + (${days}::int * INTERVAL '1 day'))`,
      );
    }

    const orderBy = LIST_SORT[String(q.sort ?? '').trim()] ?? 'updated_at DESC';
    const limitP = pushParam(params, pageSize);
    const offsetP = pushParam(params, (page - 1) * pageSize);
    const outerSql = outer.length ? `WHERE ${outer.join(' AND ')}` : '';

    const sql = `
      SELECT listed.*, COUNT(*) OVER()::int AS total FROM (
        SELECT
          e.agency_client_id::text AS agency_client_id,
          c.code,
          c.name,
          e.parent_agency_client_id::text AS parent_id,
          parent.name AS parent_name,
          (COALESCE(child.child_count, 0) > 0) AS is_parent,
          COALESCE(child.child_count, 0)::int AS child_count,
          e.account_owner_staff_id AS owner_staff_id,
          owner.name AS owner_label,
          NULL::text AS delegated_until,
          ${includeTeam ? 'team.name AS team_label' : 'NULL::text AS team_label'},
          e.am_status,
          CASE
            WHEN snap.override_band IS NOT NULL AND snap.override_until >= CURRENT_DATE
              THEN snap.override_band
            ELSE snap.band
          END AS band,
          snap.score,
          ${includeContracts ? 'mrr.mrr_vnd' : 'NULL::numeric AS mrr_vnd'},
          ${includeContracts ? 'ends.ends_on' : 'NULL::date AS ends_on'},
          sla.sla_label,
          e.updated_at
        FROM crm_am_account_ext e
        INNER JOIN clients c ON c.id = e.agency_client_id
        LEFT JOIN clients parent ON parent.id = e.parent_agency_client_id
        LEFT JOIN crm_staff owner ON owner.id = e.account_owner_staff_id
        ${includeTeam ? 'LEFT JOIN staff_teams team ON team.id = e.team_id' : ''}
        LEFT JOIN LATERAL (
          SELECT COUNT(*)::int AS child_count
          FROM crm_am_account_ext ch
          WHERE ch.parent_agency_client_id = e.agency_client_id
        ) child ON TRUE
        LEFT JOIN LATERAL (
          SELECT h.score, h.band, h.override_band, h.override_until
          FROM crm_am_health_snapshots h
          WHERE h.tenant_id = $1
            AND h.agency_client_id = e.agency_client_id
          ORDER BY h.as_of DESC
          LIMIT 1
        ) snap ON TRUE
        ${includeContracts ? contractJoins() : ''}
        LEFT JOIN LATERAL (
          SELECT CASE
            WHEN t.sla_resolve_due_at < now() THEN 'SLA quá hạn'
            WHEN t.sla_resolve_due_at <= now() + interval '2 hours' THEN 'SLA sắp đến hạn'
            ELSE NULL
          END AS sla_label
          FROM crm_am_tasks t
          WHERE t.agency_client_id = e.agency_client_id
            AND t.status NOT IN ('closed', 'cancelled', 'resolved')
            AND t.dismissed_at IS NULL
            AND t.sla_resolve_due_at IS NOT NULL
          ORDER BY t.sla_resolve_due_at
          LIMIT 1
        ) sla ON TRUE
        WHERE ${where.join(' AND ')}
      ) listed
      ${outerSql}
      ORDER BY ${orderBy}
      LIMIT ${limitP} OFFSET ${offsetP}`;

    const result = await this.db.query(sql, params);
    const total = Number(result.rows[0]?.total ?? 0);
    return {
      items: result.rows.map(mapListItem),
      total,
      page,
    };
  }

  private async resolveListActor(
    req: AmAccountsListReq,
    requested: AmScope | undefined,
  ): Promise<ListActor> {
    const internal = req.staffAuthVia === 'internal';
    const staffId = req.staffUser
      ? ((await this.staffAuth.resolveCrmStaffUserId(req.staffUser)) ?? 0)
      : 0;
    if (internal && !req.staffUser) {
      return {
        staffId,
        scope: resolveAmScope({ requested, hasViewAll: true, canTeam: true }),
        teamIds: [],
        canSeeUnassigned: true,
      };
    }
    if (!req.staffUser) {
      return { staffId, scope: 'me', teamIds: [], canSeeUnassigned: false };
    }
    const me = await this.staffAuth.me(req.staffUser);
    const has = (action: string) => this.staffAuth.hasCap(me.caps, 'crm_am', action);
    const hasViewAll = has('view_all') || has('manage');
    const canTeam = hasViewAll || has('assign');
    const canSeeUnassigned = has('assign') || hasViewAll;
    const scope = resolveAmScope({ requested, hasViewAll, canTeam });
    const teamIds = scope === 'team' ? await this.loadTeamIds(staffId) : [];
    return { staffId, scope, teamIds, canSeeUnassigned };
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

type ListActor = {
  staffId: number;
  scope: AmScope;
  teamIds: number[];
  canSeeUnassigned: boolean;
};

function contractJoins(): string {
  return `
        LEFT JOIN LATERAL (
          SELECT SUM(
            CASE
              WHEN lower(ct.billing_type) IN ('media', 'media_spend', 'project', 'one_off') THEN NULL
              WHEN lower(ct.billing_type) IN ('annual', 'yearly') THEN ROUND(ct.amount_vnd / 12.0)
              ELSE ct.amount_vnd
            END
          ) AS mrr_vnd
          FROM crm_contracts ct
          WHERE TRIM(COALESCE(ct.agency_client_id, '')) = e.agency_client_id::text
            AND lower(ct.status) IN ('active', 'renewing')
        ) mrr ON TRUE
        LEFT JOIN LATERAL (
          SELECT MIN(ct.ends_on)::date AS ends_on
          FROM crm_contracts ct
          WHERE TRIM(COALESCE(ct.agency_client_id, '')) = e.agency_client_id::text
            AND lower(ct.status) IN ('active', 'renewing')
            AND ct.ends_on IS NOT NULL
        ) ends ON TRUE`;
}

function mapListItem(row: Record<string, unknown>): AmAccountListItem {
  const childCount = Number(row.child_count ?? 0);
  return {
    agency_client_id: String(row.agency_client_id ?? ''),
    code: String(row.code ?? ''),
    name: String(row.name ?? ''),
    parent_id: text(row.parent_id),
    parent_name: text(row.parent_name),
    is_parent: Boolean(row.is_parent) || childCount > 0,
    child_count: childCount,
    owner_staff_id: num(row.owner_staff_id),
    owner_label: text(row.owner_label),
    delegated_until: dayStr(row.delegated_until),
    team_label: text(row.team_label),
    am_status: String(row.am_status ?? 'active'),
    band: text(row.band),
    score: num(row.score),
    mrr_vnd: num(row.mrr_vnd),
    ends_on: dayStr(row.ends_on),
    sla_label: text(row.sla_label),
  };
}
