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
import { AmRisksService } from './am-risks.service';
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

export type AmBulkTagInput = {
  agency_client_ids: string[];
  tags: string[];
  mode: 'add';
  scope?: AmScope;
};

export type AmBulkTagResult = { updated: number };

export type AmAccountsExportResult =
  | { csv: string; rows: number }
  | never;

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

export type AmContactInput = {
  id?: string;
  full_name: string;
  role_committee?: string | null;
  is_primary?: boolean;
  sentiment?: string | null;
  channel?: string | null;
  email?: string | null;
  phone?: string | null;
  renewal_attitude?: string | null;
};

export type AmPatchAccountBody = {
  name?: string;
  tier?: string | null;
  team_id?: number | null;
  am_status?: string;
  parent_agency_client_id?: string | null;
  archive?: boolean;
  amount_vnd?: unknown;
  owner_staff_id?: number | null;
  industry?: string | null;
  industry_override?: string | null;
  tags?: string[];
  contacts?: AmContactInput[];
};

export type AmMergeAccountBody = {
  into_agency_client_id: string;
};

export type AmAccountChild = {
  agency_client_id: string;
  name: string;
  code: string;
  owner_label: string | null;
  am_status: string;
};

export type AmAccountContact = {
  id: string;
  full_name: string;
  role_committee: string | null;
  is_primary: boolean;
  sentiment: string | null;
  channel: string | null;
  renewal_attitude: string | null;
  email: string | null;
  phone: string | null;
};

export type AmAccountContract = {
  id: number;
  reference_code: string;
  title: string;
  status: string;
  billing_type: string;
  service_slug: string;
  starts_on: string | null;
  ends_on: string | null;
  amount_vnd: number | null;
};

export type AmAccountProjectContract = {
  id: number;
  title: string;
  service_slug: string;
  status: string;
  starts_on: string | null;
  ends_on: string | null;
  href: string;
};

export type AmAccountDeliveryLink = {
  id: string;
  name: string;
  href: string;
};

export type AmAccountProjects = {
  contracts: AmAccountProjectContract[];
  delivery: AmAccountDeliveryLink[];
};

export type AmAccountOpenTask = {
  id: string;
  title: string;
  status: string;
  due_at: string | null;
  sla_label: string | null;
};

export type AmAccountPlan = {
  id: string;
  kind: string;
  period_key: string;
  status: string;
  due_on: string | null;
};

export type AmAccountAuditItem = {
  id: number;
  action: string;
  entity_type: string;
  actor_staff_id: number | null;
  created_at: string;
  payload_json: Record<string, unknown> | null;
};

export type AmAccount360 = {
  agency_client_id: string;
  code: string;
  name: string;
  industry: string | null;
  notes: string | null;
  am_status: string;
  tier: string | null;
  team_id: number | null;
  team_label: string | null;
  owner_staff_id: number | null;
  owner_label: string | null;
  delivery_label: string | null;
  media_label: string | null;
  parent_agency_client_id: string | null;
  parent_name: string | null;
  children: AmAccountChild[];
  band: string | null;
  score: number | null;
  mrr_vnd: number | null;
  outstanding_vnd: number | null;
  next_invoice_on: string | null;
  hide_amounts: boolean;
  name_unchanged?: boolean;
  override: { band: string; reason: string; until: string } | null;
  contacts: AmAccountContact[];
  contracts: AmAccountContract[];
  open_tasks: AmAccountOpenTask[];
  plans: AmAccountPlan[];
  audit: AmAccountAuditItem[];
  recovery_required: boolean;
};

const AM_STATUSES = new Set([
  'pending_handover',
  'onboarding',
  'active',
  'at_risk',
  'renewing',
  'paused',
  'churned',
]);

export type AmAccountsQuery = (
  sql: string,
  params?: unknown[],
) => Promise<{ rows: Record<string, unknown>[]; rowCount?: number | null }>;

export type AmAccountsDb = {
  query: AmAccountsQuery;
  withTransaction?<T>(fn: (query: AmAccountsQuery) => Promise<T>): Promise<T>;
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

function isMissingColumn(err: unknown): boolean {
  const e = err as { code?: string; message?: string };
  return e.code === '42703' || /column .* does not exist/i.test(e.message ?? '') || /missing column/i.test(e.message ?? '');
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

export function mapAccountProjectContract(row: Record<string, unknown>): AmAccountProjectContract {
  const id = Number(row.id);
  return {
    id,
    title: String(row.title ?? ''),
    service_slug: String(row.service_slug ?? ''),
    status: String(row.status ?? ''),
    starts_on: row.starts_on ? String(row.starts_on instanceof Date ? row.starts_on.toISOString() : row.starts_on).slice(0, 10) : null,
    ends_on: row.ends_on ? String(row.ends_on instanceof Date ? row.ends_on.toISOString() : row.ends_on).slice(0, 10) : null,
    href: `/crm/account-management/contracts/${id}`,
  };
}

export function mapAccountDeliveryLink(row: Record<string, unknown>): AmAccountDeliveryLink {
  const id = String(row.id ?? '');
  return {
    id,
    name: String(row.name ?? ''),
    href: `/crm/delivery-projects/${id}`,
  };
}

function ictToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function activeOverride(
  row: Record<string, unknown>,
): { band: string; reason: string; until: string } | null {
  const band = text(row.override_band);
  const until = dayStr(row.override_until);
  if (!band || !until || until < ictToday()) return null;
  return { band, reason: text(row.override_reason) ?? '', until };
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

  async withTransaction<T>(fn: (query: AmAccountsQuery) => Promise<T>): Promise<T> {
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
export class AmAccountsService {
  constructor(
    @Inject(forwardRef(() => AgencyService)) private readonly agency: AgencyService,
    private readonly db: AmAccountsRepository,
    private readonly staffAuth: StaffAuthService,
    @Optional() private readonly dashboard?: AmDashboardService,
    @Optional() private readonly audit?: AmAuditRepository,
    @Optional() private readonly risks?: AmRisksService,
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
      return await this.queryList(actor, q, page, pageSize, true, true, true);
    } catch (err) {
      if (!isMissingRelation(err)) throw err;
      try {
        return await this.queryList(actor, q, page, pageSize, false, true, true);
      } catch (inner) {
        if (!isMissingRelation(inner)) throw inner;
        try {
          return await this.queryList(actor, q, page, pageSize, false, false, true);
        } catch (inner2) {
          if (!isMissingRelation(inner2)) throw inner2;
          return this.queryList(actor, q, page, pageSize, false, false, false);
        }
      }
    }
  }

  async bulkTag(
    req: AmAccountsListReq,
    body: AmBulkTagInput,
    q: AmAccountsListQuery = {},
  ): Promise<AmBulkTagResult> {
    if (String(body?.mode ?? '') !== 'add') {
      amThrow(400, { error: 'mode_invalid' });
    }
    const ids = [
      ...new Set((body.agency_client_ids ?? []).map((id) => String(id ?? '').trim()).filter(Boolean)),
    ];
    if (!ids.length || ids.some((id) => !isUuid(id))) {
      amThrow(400, { error: 'agency_client_ids_required' });
    }
    if (ids.length > 200) {
      amThrow(400, { error: 'too_many_ids', max: 200 });
    }
    const incoming = (body.tags ?? []).map((tag) => String(tag ?? '').trim()).filter(Boolean);
    if (!incoming.length) {
      amThrow(400, { error: 'tags_required' });
    }

    const actor = await this.resolveListActor(req, body.scope ?? q.scope);
    const current = await this.loadScopedTags(ids, actor);
    const found = new Set(current.map((row) => row.agency_client_id));
    if (ids.some((id) => !found.has(id))) {
      amThrow(403, { error: 'out_of_scope' });
    }

    const params: unknown[] = [AM_TENANT_ID, ids, incoming];
    const bound = bindScopeSql(
      amScopeSql({ scope: actor.scope, staffId: actor.staffId, teamIds: actor.teamIds }),
      params.length + 1,
    );
    params.push(...bound.params);
    const result = await this.db.query(
      `UPDATE crm_am_account_ext e
          SET tags = (
                SELECT ARRAY(
                  SELECT DISTINCT btrim(t)
                  FROM unnest(COALESCE(e.tags, ARRAY[]::text[]) || $3::text[]) AS t
                  WHERE btrim(t) <> ''
                )
              ),
              updated_at = now()
        WHERE e.tenant_id = $1 AND e.agency_client_id = ANY($2::uuid[]) AND ${bound.sql}`,
      params,
    );
    const updated = Number(result.rowCount ?? 0);

    await this.audit?.insert({
      actor_staff_id: actor.staffId > 0 ? actor.staffId : null,
      action: 'account.bulk_tag',
      entity_type: 'account',
      entity_id: ids.length === 1 ? ids[0] : null,
      payload_json: { agency_client_ids: ids, tags: incoming, mode: 'add', updated },
    });
    this.dashboard?.dropCache();
    return { updated };
  }

  async exportCsv(req: AmAccountsListReq, q: AmAccountsListQuery): Promise<AmAccountsExportResult> {
    const actor = await this.resolveListActor(req, q.scope);
    const owner = String(q.owner ?? '').trim();
    if (owner === 'unassigned' && !actor.canSeeUnassigned) {
      return { csv: `${EXPORT_CSV_HEADER}\n`, rows: 0 };
    }
    try {
      return await this.runExport(req, actor, q, true);
    } catch (err) {
      if (!isMissingRelation(err)) throw err;
      return this.runExport(req, actor, q, false);
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
    const rawToStaffId = Number(body.to_staff_id);
    if (!Number.isFinite(rawToStaffId) || rawToStaffId <= 0) {
      amThrow(400, { error: 'to_staff_id_required' });
    }
    const ids = [...new Set((body.agency_client_ids ?? []).map((id) => String(id ?? '').trim()).filter(Boolean))];
    if (!ids.length || ids.some((id) => !isUuid(id))) {
      amThrow(400, { error: 'agency_client_ids_required' });
    }
    const toStaffId = await this.requireCrmStaffId(rawToStaffId, 'to_staff_id');
    const keepSecondary = Boolean(body.keep_secondary);
    const moveOpenTasks = Boolean(body.move_open_tasks);
    let backupStaffId = keepSecondary ? num(body.backup_staff_id) : null;
    if (backupStaffId != null) {
      backupStaffId = await this.requireCrmStaffId(backupStaffId, 'backup_staff_id');
    }

    const scopedActor = await this.resolveTransferActor(actor);
    const current = await this.loadScopedAccounts(ids, scopedActor);
    const found = new Set(current.map((row) => row.agency_client_id));
    if (ids.some((id) => !found.has(id))) {
      amThrow(403, { error: 'out_of_scope' });
    }

    const writes = await this.inTx(async (query) => {
      const extParams: unknown[] = [AM_TENANT_ID, toStaffId, keepSecondary, backupStaffId, ids];
      const extBound = bindScopeSql(
        amScopeSql({
          scope: scopedActor.scope,
          staffId: scopedActor.staffId,
          teamIds: scopedActor.teamIds,
        }),
        extParams.length + 1,
      );
      extParams.push(...extBound.params);
      const updated = await query(
        `UPDATE crm_am_account_ext e
            SET account_owner_staff_id = $2,
                backup_staff_id = CASE
                  WHEN $3::boolean THEN COALESCE($4::int, NULLIF(account_owner_staff_id, $2))
                  ELSE NULL
                END,
                updated_at = now()
          WHERE e.tenant_id = $1 AND e.agency_client_id = ANY($5::uuid[]) AND ${extBound.sql}`,
        extParams,
      );
      const transferred = Number(updated.rowCount ?? 0);
      if (transferred > 0) {
        await query(`UPDATE clients SET owner_am_id = $1 WHERE id = ANY($2::uuid[])`, [
          String(toStaffId),
          ids,
        ]);
      }

      let movedTasks = 0;
      if (moveOpenTasks && transferred > 0) {
        const moved = await query(
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
      return { transferred, movedTasks };
    });

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
        previous: current,
        scope: scopedActor.scope,
      },
    });
    this.dashboard?.dropCache();
    return {
      transferred: writes.transferred,
      to_staff_id: toStaffId,
      moved_tasks: writes.movedTasks,
      keep_secondary: keepSecondary,
    };
  }

  async get(req: AmAccountsListReq, agencyClientId: string): Promise<AmAccount360> {
    const id = String(agencyClientId ?? '').trim();
    if (!isUuid(id)) amThrow(404, { error: 'not_found' });
    const actor = await this.resolveListActor(req, undefined);
    const hideAmounts = await this.shouldHideAmounts(req);
    return this.load360(actor, id, hideAmounts);
  }

  async projects(req: AmAccountsListReq, agencyClientId: string): Promise<AmAccountProjects> {
    const id = String(agencyClientId ?? '').trim();
    if (!isUuid(id)) amThrow(404, { error: 'not_found' });
    const actor = await this.resolveListActor(req, undefined);
    const scoped = await this.loadAccountRow(actor, id, true);
    if (!scoped) amThrow(404, { error: 'not_found' });

    const contractsResult = await this.db.query(
      `SELECT ct.id, ct.title, ct.service_slug, ct.status, ct.starts_on, ct.ends_on
         FROM crm_contracts ct
        WHERE TRIM(COALESCE(ct.agency_client_id, '')) = $1
        ORDER BY ct.ends_on NULLS LAST, ct.id`,
      [id],
    );
    const contracts = contractsResult.rows.map(mapAccountProjectContract);

    let delivery: AmAccountDeliveryLink[] = [];
    try {
      const deliveryResult = await this.db.query(
        `SELECT d.id::text AS id, COALESCE(d.name, d.code, d.id::text) AS name
           FROM crm_delivery_projects d
           JOIN crm_b2b_projects b ON b.id = d.b2b_project_id
          WHERE b.agency_client_id::text = $1 OR b.client_id::text = $1`,
        [id],
      );
      delivery = deliveryResult.rows.map(mapAccountDeliveryLink);
    } catch (err) {
      if (!isMissingRelation(err) && !isMissingColumn(err)) throw err;
      delivery = [];
    }

    return { contracts, delivery };
  }

  async patch(
    req: AmAccountsListReq,
    agencyClientId: string,
    body: AmPatchAccountBody,
    actor: AmAccountActor,
  ): Promise<AmAccount360> {
    if (!this.canEdit(actor)) {
      amThrow(403, { error: 'missing_cap', section: 'crm_am', action: 'edit' });
    }
    const id = String(agencyClientId ?? '').trim();
    if (!isUuid(id)) amThrow(404, { error: 'not_found' });
    const scoped = await this.resolveListActor(req, undefined);
    const current = await this.loadAccountRow(scoped, id, true);
    if (!current) amThrow(404, { error: 'not_found' });

    const sets: string[] = ['updated_at = now()'];
    const params: unknown[] = [AM_TENANT_ID, id];
    let nextStatus = String(current.am_status ?? 'active');
    if (body.archive === true) {
      if (!this.canManage(actor)) {
        amThrow(403, { error: 'missing_cap', section: 'crm_am', action: 'manage' });
      }
      nextStatus = 'paused';
      sets.push(`am_status = ${pushParam(params, 'paused')}`);
    } else if (body.am_status != null) {
      const status = String(body.am_status).trim();
      if (!AM_STATUSES.has(status)) amThrow(400, { error: 'am_status_invalid' });
      nextStatus = status;
      sets.push(`am_status = ${pushParam(params, status)}`);
    }
    if ('owner_staff_id' in body) {
      const ownerId = body.owner_staff_id == null || body.owner_staff_id === ('' as never)
        ? null
        : num(body.owner_staff_id);
      if (body.owner_staff_id != null && ownerId == null) amThrow(400, { error: 'owner_staff_id_invalid' });
      const currentOwner = num(current.owner_staff_id);
      if (ownerId !== currentOwner && !this.canAssign(actor)) {
        amThrow(403, { error: 'missing_cap', section: 'crm_am', action: 'assign' });
      }
      if (ownerId !== currentOwner) {
        sets.push(`account_owner_staff_id = ${pushParam(params, ownerId)}`);
      }
    }
    if ('tier' in body) {
      const tier = body.tier == null || body.tier === '' ? null : String(body.tier).trim();
      sets.push(`tier = ${pushParam(params, tier)}`);
    }
    if ('team_id' in body) {
      const teamId = body.team_id == null || body.team_id === ('' as never) ? null : num(body.team_id);
      if (body.team_id != null && teamId == null) amThrow(400, { error: 'team_id_invalid' });
      sets.push(`team_id = ${pushParam(params, teamId)}`);
    }
    if ('parent_agency_client_id' in body) {
      const parent = body.parent_agency_client_id == null || body.parent_agency_client_id === ''
        ? null
        : String(body.parent_agency_client_id).trim();
      if (parent) {
        if (!isUuid(parent) || parent === id) {
          amThrow(400, { error: 'parent_invalid' });
        }
        const found = await this.loadScopedAccounts([parent], scoped);
        if (found.length < 1) {
          amThrow(403, { error: 'parent_denied' });
        }
      }
      sets.push(`parent_agency_client_id = ${pushParam(params, parent)}::uuid`);
    }
    const industryRaw = 'industry' in body ? body.industry : body.industry_override;
    let nextIndustry: string | null | undefined;
    if ('industry' in body || 'industry_override' in body) {
      nextIndustry = industryRaw == null || industryRaw === '' ? null : String(industryRaw).trim();
      sets.push(`industry_override = ${pushParam(params, nextIndustry)}`);
    }
    if (Array.isArray(body.tags)) {
      const nextTags = [
        ...new Set(body.tags.map((tag) => String(tag ?? '').trim()).filter(Boolean)),
      ];
      sets.push(`tags = ${pushParam(params, nextTags)}::text[]`);
    }

    const checkPrimary =
      nextStatus === 'active' &&
      (Array.isArray(body.contacts) || String(body.am_status ?? '').trim() === 'active');
    if (checkPrimary) {
      await this.ensureActiveNamedPrimary(id, nextStatus, body.contacts);
    }
    if (Array.isArray(body.contacts)) {
      await this.upsertContacts(id, body.contacts);
    }

    const bound = bindScopeSql(
      amScopeSql({ scope: scoped.scope, staffId: scoped.staffId, teamIds: scoped.teamIds }),
      params.length + 1,
    );
    params.push(...bound.params);
    await this.db.query(
      `UPDATE crm_am_account_ext e
          SET ${sets.join(', ')}
        WHERE e.tenant_id = $1 AND e.agency_client_id = $2::uuid AND ${bound.sql}`,
      params,
    );

    const nextName = String(body.name ?? '').trim();
    const nameRequested = Boolean(nextName);
    const canWriteAgency = this.canAgencyWrite(actor);
    let nameUnchanged = false;
    const agencyPatch: { name?: string; industry_slug?: string } = {};
    if (nextName && canWriteAgency) {
      agencyPatch.name = nextName;
    } else if (nameRequested) {
      nameUnchanged = true;
    }
    if (nextIndustry && canWriteAgency) {
      agencyPatch.industry_slug = nextIndustry;
    }
    if (Object.keys(agencyPatch).length) {
      await this.agency.updateClient(id, agencyPatch);
    }

    await this.audit?.insert({
      actor_staff_id: actor.staffId > 0 ? actor.staffId : null,
      action: 'account.update',
      entity_type: 'account',
      entity_id: id,
      payload_json: {
        tier: body.tier,
        team_id: body.team_id,
        am_status: body.am_status,
        parent_agency_client_id: body.parent_agency_client_id,
        archive: body.archive === true,
        owner_staff_id: body.owner_staff_id,
        industry: nextIndustry,
        tags: body.tags,
        contacts: Array.isArray(body.contacts) ? body.contacts.length : undefined,
        name: nameUnchanged ? undefined : nextName || undefined,
        name_unchanged: nameUnchanged || undefined,
      },
    });
    this.dashboard?.dropCache();
    const out = await this.load360(scoped, id, await this.shouldHideAmounts(req));
    if (nameUnchanged) out.name_unchanged = true;
    return out;
  }

  async merge(
    req: AmAccountsListReq,
    agencyClientId: string,
    body: AmMergeAccountBody,
    actor: AmAccountActor,
  ): Promise<{ merged: true; into_agency_client_id: string }> {
    if (!this.canManage(actor)) {
      amThrow(403, { error: 'missing_cap', section: 'crm_am', action: 'manage' });
    }
    const id = String(agencyClientId ?? '').trim();
    const into = String(body.into_agency_client_id ?? '').trim();
    if (!isUuid(id) || !isUuid(into) || into === id) {
      amThrow(400, { error: 'merge_target_invalid' });
    }
    const scoped = await this.resolveListActor(req, undefined);
    const found = await this.loadScopedAccounts([id, into], scoped);
    if (found.length < 2) {
      amThrow(403, { error: 'merge_denied' });
    }
    await this.db.query(
      `UPDATE crm_am_account_ext
          SET parent_agency_client_id = $2::uuid, updated_at = now()
        WHERE tenant_id = $3 AND agency_client_id = $1::uuid`,
      [id, into, AM_TENANT_ID],
    );
    await this.audit?.insert({
      actor_staff_id: actor.staffId > 0 ? actor.staffId : null,
      action: 'account.merge',
      entity_type: 'account',
      entity_id: id,
      payload_json: { into_agency_client_id: into },
    });
    this.dashboard?.dropCache();
    return { merged: true, into_agency_client_id: into };
  }

  private async inTx<T>(fn: (query: AmAccountsQuery) => Promise<T>): Promise<T> {
    if (this.db.withTransaction) {
      return this.db.withTransaction(fn);
    }
    return fn((sql, params) => this.db.query(sql, params));
  }

  private async requireCrmStaffId(rawId: number, field: string): Promise<number> {
    try {
      const direct = await this.db.query(`SELECT id FROM crm_staff WHERE id = $1 LIMIT 1`, [rawId]);
      const directId = num(direct.rows[0]?.id);
      if (directId && directId > 0) return directId;
      const mapped = await this.db.query(
        `SELECT cs.id
           FROM staff_users u
           JOIN crm_staff cs ON lower(trim(cs.email)) = lower(trim(u.email))
          WHERE u.id = $1
          LIMIT 1`,
        [rawId],
      );
      const mappedId = num(mapped.rows[0]?.id);
      if (mappedId && mappedId > 0) return mappedId;
    } catch (err) {
      if (!isMissingRelation(err)) throw err;
    }
    amThrow(400, { error: `${field}_invalid` });
  }

  private async resolveTransferActor(actor: AmAccountActor): Promise<ListActor> {
    if (actor.via === 'internal') {
      return { staffId: actor.staffId, scope: 'all', teamIds: [], canSeeUnassigned: true };
    }
    const has = (action: string) => this.staffAuth.hasCap(actor.caps ?? [], 'crm_am', action);
    const hasViewAll = has('view_all') || has('manage');
    const canTeam = hasViewAll || has('assign');
    const requested: AmScope = hasViewAll ? 'all' : canTeam ? 'team' : 'me';
    const scope = resolveAmScope({ requested, hasViewAll, canTeam });
    if (scope === 'all') {
      return { staffId: actor.staffId, scope: 'all', teamIds: [], canSeeUnassigned: true };
    }
    const teamIds = scope === 'team' ? await this.loadTeamIds(actor.staffId) : [];
    if (scope === 'team' && teamIds.length) {
      return { staffId: actor.staffId, scope: 'team', teamIds, canSeeUnassigned: true };
    }
    return { staffId: actor.staffId, scope: 'me', teamIds: [], canSeeUnassigned: false };
  }

  private async loadScopedAccounts(
    ids: string[],
    actor: ListActor,
  ): Promise<
    Array<{
      agency_client_id: string;
      account_owner_staff_id: number | null;
      backup_staff_id: number | null;
    }>
  > {
    const params: unknown[] = [AM_TENANT_ID, ids];
    const bound = bindScopeSql(
      amScopeSql({ scope: actor.scope, staffId: actor.staffId, teamIds: actor.teamIds }),
      params.length + 1,
    );
    params.push(...bound.params);
    const current = await this.db.query(
      `SELECT e.agency_client_id::text AS agency_client_id,
              e.account_owner_staff_id,
              e.backup_staff_id
         FROM crm_am_account_ext e
        WHERE e.tenant_id = $1 AND e.agency_client_id = ANY($2::uuid[]) AND ${bound.sql}`,
      params,
    );
    return current.rows.map((row) => ({
      agency_client_id: String(row.agency_client_id ?? ''),
      account_owner_staff_id: num(row.account_owner_staff_id),
      backup_staff_id: num(row.backup_staff_id),
    }));
  }

  private canAssign(actor: AmAccountActor): boolean {
    if (actor.via === 'internal') return true;
    return (
      this.staffAuth.hasCap(actor.caps ?? [], 'crm_am', 'assign') ||
      this.staffAuth.hasCap(actor.caps ?? [], 'crm_am', 'manage')
    );
  }

  private canEdit(actor: AmAccountActor): boolean {
    if (actor.via === 'internal') return true;
    return (
      this.staffAuth.hasCap(actor.caps ?? [], 'crm_am', 'edit') ||
      this.staffAuth.hasCap(actor.caps ?? [], 'crm_am', 'manage')
    );
  }

  private canManage(actor: AmAccountActor): boolean {
    if (actor.via === 'internal') return true;
    return this.staffAuth.hasCap(actor.caps ?? [], 'crm_am', 'manage');
  }

  private async shouldHideAmounts(req: AmAccountsListReq): Promise<boolean> {
    if (req.staffAuthVia === 'internal' && !req.staffUser) return false;
    if (!req.staffUser) return true;
    const me = await this.staffAuth.me(req.staffUser);
    return !(
      this.staffAuth.hasCap(me.caps, 'crm_am.finance', 'view') ||
      this.staffAuth.hasCap(me.caps, 'crm_am', 'manage')
    );
  }

  private async shouldHideExportAmounts(req: AmAccountsListReq): Promise<boolean> {
    if (req.staffAuthVia === 'internal' && !req.staffUser) return false;
    if (!req.staffUser) return true;
    const me = await this.staffAuth.me(req.staffUser);
    return !this.staffAuth.hasCap(me.caps, 'crm_am.finance', 'view');
  }

  private async load360(actor: ListActor, id: string, hideAmounts: boolean): Promise<AmAccount360> {
    const row = await this.loadAccountRow(actor, id, true);
    if (!row) amThrow(404, { error: 'not_found' });
    const [children, contacts, contracts, openTasks, plans, audit, recoveryRequired] =
      await Promise.all([
        this.loadChildren(id),
        this.loadContacts(id),
        this.loadContracts(id, hideAmounts),
        this.loadOpenTasks(id),
        this.loadPlans(id),
        this.loadAudit(id),
        this.risks?.isRecoveryRequired(id) ?? Promise.resolve(false),
      ]);
    const media = contracts.some((ct) => /media/i.test(ct.billing_type) || /media|ads/i.test(ct.service_slug));
    const delivery = contracts.some(
      (ct) => !/media/i.test(ct.billing_type) && /active|renewing/i.test(ct.status),
    );
    return {
      agency_client_id: String(row.agency_client_id ?? ''),
      code: String(row.code ?? ''),
      name: String(row.name ?? ''),
      industry: text(row.industry),
      notes: text(row.notes),
      am_status: String(row.am_status ?? 'active'),
      tier: text(row.tier),
      team_id: num(row.team_id),
      team_label: text(row.team_label),
      owner_staff_id: num(row.owner_staff_id),
      owner_label: text(row.owner_label),
      delivery_label: delivery ? text(row.delivery_label) ?? 'Delivery' : text(row.delivery_label),
      media_label: media ? text(row.media_label) ?? 'Media' : text(row.media_label),
      parent_agency_client_id: text(row.parent_agency_client_id),
      parent_name: text(row.parent_name),
      children,
      band: text(row.band),
      score: num(row.score),
      mrr_vnd: hideAmounts ? null : num(row.mrr_vnd),
      outstanding_vnd: null,
      next_invoice_on: null,
      hide_amounts: hideAmounts,
      override: activeOverride(row),
      contacts,
      contracts,
      open_tasks: openTasks,
      plans,
      audit,
      recovery_required: recoveryRequired,
    };
  }

  private async loadAccountRow(
    actor: ListActor,
    id: string,
    includeTeam: boolean,
  ): Promise<Record<string, unknown> | null> {
    const params: unknown[] = [AM_TENANT_ID, id];
    const bound = bindScopeSql(
      amScopeSql({ scope: actor.scope, staffId: actor.staffId, teamIds: actor.teamIds }),
      params.length + 1,
    );
    params.push(...bound.params);
    try {
      const result = await this.db.query(
        `SELECT
            e.agency_client_id::text AS agency_client_id,
            c.code,
            c.name,
            COALESCE(NULLIF(e.industry_override, ''), c.industry_slug) AS industry,
            c.notes,
            e.am_status,
            e.tier,
            e.team_id,
            ${includeTeam ? 'team.name AS team_label' : 'NULL::text AS team_label'},
            e.account_owner_staff_id AS owner_staff_id,
            owner.name AS owner_label,
            e.parent_agency_client_id::text AS parent_agency_client_id,
            parent.name AS parent_name,
            CASE
              WHEN snap.override_band IS NOT NULL AND snap.override_until >= CURRENT_DATE
                THEN snap.override_band
              ELSE snap.band
            END AS band,
            snap.score,
            mrr.mrr_vnd,
            NULL::text AS delivery_label,
            NULL::text AS media_label
          FROM crm_am_account_ext e
          INNER JOIN clients c ON c.id = e.agency_client_id
          LEFT JOIN clients parent ON parent.id = e.parent_agency_client_id
          LEFT JOIN crm_staff owner ON owner.id = e.account_owner_staff_id
          ${includeTeam ? 'LEFT JOIN staff_teams team ON team.id = e.team_id' : ''}
          LEFT JOIN LATERAL (
            SELECT h.score, h.band, h.override_band, h.override_until, h.override_reason
              FROM crm_am_health_snapshots h
             WHERE h.tenant_id = $1
               AND h.agency_client_id = e.agency_client_id
             ORDER BY h.as_of DESC
             LIMIT 1
          ) snap ON TRUE
          ${contractJoins()}
          WHERE e.tenant_id = $1 AND e.agency_client_id = $2::uuid AND ${bound.sql}
          LIMIT 1`,
        params,
      );
      return result.rows[0] ?? null;
    } catch (err) {
      if (includeTeam && isMissingRelation(err)) {
        return this.loadAccountRow(actor, id, false);
      }
      if (isMissingRelation(err)) return this.loadAccountRowMinimal(actor, id);
      throw err;
    }
  }

  private async loadAccountRowMinimal(
    actor: ListActor,
    id: string,
  ): Promise<Record<string, unknown> | null> {
    const params: unknown[] = [AM_TENANT_ID, id];
    const bound = bindScopeSql(
      amScopeSql({ scope: actor.scope, staffId: actor.staffId, teamIds: actor.teamIds }),
      params.length + 1,
    );
    params.push(...bound.params);
    const result = await this.db.query(
      `SELECT
          e.agency_client_id::text AS agency_client_id,
          c.code,
          c.name,
          c.industry_slug AS industry,
          c.notes,
          e.am_status,
          e.tier,
          e.team_id,
          NULL::text AS team_label,
          e.account_owner_staff_id AS owner_staff_id,
          NULL::text AS owner_label,
          e.parent_agency_client_id::text AS parent_agency_client_id,
          NULL::text AS parent_name,
          NULL::text AS band,
          NULL::numeric AS score,
          NULL::numeric AS mrr_vnd,
          NULL::text AS delivery_label,
          NULL::text AS media_label
        FROM crm_am_account_ext e
        INNER JOIN clients c ON c.id = e.agency_client_id
       WHERE e.tenant_id = $1 AND e.agency_client_id = $2::uuid AND ${bound.sql}
       LIMIT 1`,
      params,
    );
    return result.rows[0] ?? null;
  }

  private async loadChildren(id: string): Promise<AmAccountChild[]> {
    try {
      const result = await this.db.query(
        `SELECT
            ch.agency_client_id::text AS agency_client_id,
            c.name,
            c.code,
            owner.name AS owner_label,
            ch.am_status
          FROM crm_am_account_ext ch
          INNER JOIN clients c ON c.id = ch.agency_client_id
          LEFT JOIN crm_staff owner ON owner.id = ch.account_owner_staff_id
         WHERE ch.parent_agency_client_id = $1::uuid
         ORDER BY c.name`,
        [id],
      );
      return result.rows.map((row) => ({
        agency_client_id: String(row.agency_client_id ?? ''),
        name: String(row.name ?? ''),
        code: String(row.code ?? ''),
        owner_label: text(row.owner_label),
        am_status: String(row.am_status ?? 'active'),
      }));
    } catch (err) {
      if (isMissingRelation(err)) return [];
      throw err;
    }
  }

  private async hasPrimaryContact(id: string, incoming?: AmContactInput[]): Promise<boolean> {
    if (Array.isArray(incoming) && incoming.some((row) => Boolean(row.is_primary) && String(row.full_name ?? '').trim())) {
      return true;
    }
    const existing = await this.loadContacts(id);
    const incomingIds = new Set(
      (incoming ?? []).map((row) => String(row.id ?? '').trim()).filter(Boolean),
    );
    return existing.some(
      (row) => row.is_primary && String(row.full_name ?? '').trim() && !incomingIds.has(row.id),
    );
  }

  private async ensureActiveNamedPrimary(
    id: string,
    resultingStatus: string,
    incoming?: AmContactInput[],
  ): Promise<void> {
    if (resultingStatus !== 'active') return;
    if (!(await this.hasPrimaryContact(id, incoming))) {
      amThrow(400, { error: 'primary_contact_required' });
    }
  }

  private async upsertContacts(id: string, contacts: AmContactInput[]): Promise<void> {
    try {
      for (const raw of contacts) {
        const fullName = String(raw.full_name ?? '').trim();
        if (!fullName) continue;
        const contactId = String(raw.id ?? '').trim();
        const isPrimary = Boolean(raw.is_primary);
        const fields = [
          fullName,
          text(raw.role_committee),
          isPrimary,
          text(raw.sentiment),
          text(raw.channel),
          text(raw.email),
          text(raw.phone),
          text(raw.renewal_attitude),
        ];
        if (isPrimary) {
          await this.db.query(
            `UPDATE crm_am_contacts SET is_primary = FALSE WHERE agency_client_id = $1::uuid AND tenant_id = $2`,
            [id, AM_TENANT_ID],
          );
        }
        if (contactId && isUuid(contactId)) {
          await this.db.query(
            `UPDATE crm_am_contacts
                SET full_name = $3, role_committee = $4, is_primary = $5, sentiment = $6,
                    channel = $7, email = $8, phone = $9, renewal_attitude = $10
              WHERE id = $1::uuid AND agency_client_id = $2::uuid`,
            [contactId, id, ...fields],
          );
        } else {
          await this.db.query(
            `INSERT INTO crm_am_contacts
               (tenant_id, agency_client_id, full_name, role_committee, is_primary, sentiment, channel, email, phone, renewal_attitude)
             VALUES ($1, $2::uuid, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [AM_TENANT_ID, id, ...fields],
          );
        }
      }
    } catch (err) {
      if (isMissingRelation(err)) return;
      throw err;
    }
  }

  private async loadContacts(id: string): Promise<AmAccountContact[]> {
    try {
      const result = await this.db.query(
        `SELECT id::text AS id, full_name, role_committee, is_primary, sentiment, channel, renewal_attitude, email, phone
           FROM crm_am_contacts
          WHERE agency_client_id = $1::uuid
          ORDER BY is_primary DESC, full_name`,
        [id],
      );
      return result.rows.map((row) => ({
        id: String(row.id ?? ''),
        full_name: String(row.full_name ?? ''),
        role_committee: text(row.role_committee),
        is_primary: Boolean(row.is_primary),
        sentiment: text(row.sentiment),
        channel: text(row.channel),
        renewal_attitude: text(row.renewal_attitude),
        email: text(row.email),
        phone: text(row.phone),
      }));
    } catch (err) {
      if (isMissingRelation(err)) return [];
      throw err;
    }
  }

  private async loadContracts(id: string, hideAmounts: boolean): Promise<AmAccountContract[]> {
    try {
      const result = await this.db.query(
        `SELECT id, reference_code, title, status, billing_type, service_slug, starts_on, ends_on, amount_vnd
           FROM crm_contracts
          WHERE TRIM(COALESCE(agency_client_id, '')) = $1
          ORDER BY ends_on NULLS LAST, id`,
        [id],
      );
      return result.rows.map((row) => ({
        id: Number(row.id ?? 0),
        reference_code: String(row.reference_code ?? ''),
        title: String(row.title ?? ''),
        status: String(row.status ?? ''),
        billing_type: String(row.billing_type ?? ''),
        service_slug: String(row.service_slug ?? ''),
        starts_on: dayStr(row.starts_on),
        ends_on: dayStr(row.ends_on),
        amount_vnd: hideAmounts ? null : num(row.amount_vnd),
      }));
    } catch (err) {
      if (isMissingRelation(err)) return [];
      throw err;
    }
  }

  private async loadOpenTasks(id: string): Promise<AmAccountOpenTask[]> {
    try {
      const result = await this.db.query(
        `SELECT
            id::text AS id,
            title,
            status,
            due_at,
            CASE
              WHEN sla_resolve_due_at < now() THEN 'SLA quá hạn'
              WHEN sla_resolve_due_at <= now() + interval '2 hours' THEN 'SLA sắp đến hạn'
              ELSE NULL
            END AS sla_label
           FROM crm_am_tasks
          WHERE agency_client_id = $1::uuid
            AND dismissed_at IS NULL
            AND status NOT IN ('closed', 'cancelled', 'resolved')
          ORDER BY sla_resolve_due_at NULLS LAST, due_at NULLS LAST
          LIMIT 20`,
        [id],
      );
      return result.rows.map((row) => ({
        id: String(row.id ?? ''),
        title: String(row.title ?? ''),
        status: String(row.status ?? ''),
        due_at: row.due_at == null ? null : String(row.due_at),
        sla_label: text(row.sla_label),
      }));
    } catch (err) {
      if (isMissingRelation(err)) return [];
      throw err;
    }
  }

  private async loadPlans(id: string): Promise<AmAccountPlan[]> {
    try {
      const result = await this.db.query(
        `SELECT id::text AS id, kind, period_key, status, due_on
           FROM crm_am_plans
          WHERE agency_client_id = $1::uuid
          ORDER BY due_on NULLS LAST`,
        [id],
      );
      return result.rows.map((row) => ({
        id: String(row.id ?? ''),
        kind: String(row.kind ?? ''),
        period_key: String(row.period_key ?? ''),
        status: String(row.status ?? ''),
        due_on: dayStr(row.due_on),
      }));
    } catch (err) {
      if (isMissingRelation(err)) return [];
      throw err;
    }
  }

  private async loadAudit(id: string): Promise<AmAccountAuditItem[]> {
    try {
      const result = await this.db.query(
        `SELECT id, action, entity_type, actor_staff_id, created_at, payload_json
           FROM crm_am_audit
          WHERE tenant_id = $1
            AND (
              entity_id = $2
              OR payload_json->>'agency_client_id' = $2
              OR payload_json->'agency_client_ids' ? $2
            )
          ORDER BY created_at DESC
          LIMIT 50`,
        [AM_TENANT_ID, id],
      );
      return result.rows.map((row) => ({
        id: Number(row.id ?? 0),
        action: String(row.action ?? ''),
        entity_type: String(row.entity_type ?? ''),
        actor_staff_id: num(row.actor_staff_id),
        created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at ?? ''),
        payload_json:
          row.payload_json && typeof row.payload_json === 'object'
            ? (row.payload_json as Record<string, unknown>)
            : null,
      }));
    } catch (err) {
      if (isMissingRelation(err)) return [];
      throw err;
    }
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

  private async loadScopedTags(
    ids: string[],
    actor: ListActor,
  ): Promise<Array<{ agency_client_id: string; tags: string[] }>> {
    const params: unknown[] = [AM_TENANT_ID, ids];
    const bound = bindScopeSql(
      amScopeSql({ scope: actor.scope, staffId: actor.staffId, teamIds: actor.teamIds }),
      params.length + 1,
    );
    params.push(...bound.params);
    const current = await this.db.query(
      `SELECT e.agency_client_id::text AS agency_client_id,
              COALESCE(e.tags, ARRAY[]::text[]) AS tags
         FROM crm_am_account_ext e
        WHERE e.tenant_id = $1 AND e.agency_client_id = ANY($2::uuid[]) AND ${bound.sql}`,
      params,
    );
    return current.rows.map((row) => ({
      agency_client_id: String(row.agency_client_id ?? ''),
      tags: asTags(row.tags),
    }));
  }

  private async runExport(
    req: AmAccountsListReq,
    actor: ListActor,
    q: AmAccountsListQuery,
    includeContracts: boolean,
  ): Promise<AmAccountsExportResult> {
    const count = await this.countBook(actor, q, includeContracts);
    if (count >= 10000) {
      amThrow(400, { error: 'export_too_large', max: 10000 });
    }
    const hideAmounts = await this.shouldHideExportAmounts(req);
    const rows = await this.fetchExportRows(actor, q, includeContracts);
    return { csv: buildAccountsCsv(rows, hideAmounts), rows: rows.length };
  }

  private async countBook(
    actor: ListActor,
    q: AmAccountsListQuery,
    includeContracts: boolean,
  ): Promise<number> {
    const { params, where, outer } = this.accountFilterState(actor, q);
    const outerSql = outer.length ? `WHERE ${outer.join(' AND ')}` : '';
    const result = await this.db.query(
      `SELECT COUNT(*)::int AS count FROM (
        ${exportInnerSelect(includeContracts)}
        WHERE ${where.join(' AND ')}
      ) listed
      ${outerSql}`,
      params,
    );
    return Number(result.rows[0]?.count ?? 0);
  }

  private async fetchExportRows(
    actor: ListActor,
    q: AmAccountsListQuery,
    includeContracts: boolean,
  ): Promise<AmExportRow[]> {
    const { params, where, outer, orderBy } = this.accountFilterState(actor, q);
    const outerSql = outer.length ? `WHERE ${outer.join(' AND ')}` : '';
    const result = await this.db.query(
      `SELECT
          listed.agency_client_id,
          listed.code,
          listed.name,
          listed.owner_staff_id,
          listed.team_id,
          listed.am_status,
          listed.band AS health_band,
          listed.mrr_vnd,
          listed.ends_on
        FROM (
          ${exportInnerSelect(includeContracts)}
          WHERE ${where.join(' AND ')}
        ) listed
        ${outerSql}
        ORDER BY ${orderBy}`,
      params,
    );
    return result.rows.map((row) => ({
      agency_client_id: String(row.agency_client_id ?? ''),
      code: String(row.code ?? ''),
      name: String(row.name ?? ''),
      owner_staff_id: num(row.owner_staff_id),
      team_id: num(row.team_id),
      am_status: String(row.am_status ?? ''),
      health_band: text(row.health_band),
      mrr_vnd: num(row.mrr_vnd),
      ends_on: dayStr(row.ends_on),
    }));
  }

  private accountFilterState(
    actor: ListActor,
    q: AmAccountsListQuery,
  ): { params: unknown[]; where: string[]; outer: string[]; orderBy: string } {
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
    return { params, where, outer, orderBy };
  }

  private async queryList(
    actor: ListActor,
    q: AmAccountsListQuery,
    page: number,
    pageSize: number,
    includeContracts: boolean,
    includeTeam: boolean,
    includeDelegations: boolean,
  ): Promise<AmAccountsListResult> {
    const { params, where, outer, orderBy } = this.accountFilterState(actor, q);
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
          ${
            includeDelegations
              ? `(SELECT MAX(d.ends_on)::text
                    FROM crm_am_delegations d
                   WHERE d.tenant_id = e.tenant_id
                     AND d.from_staff_id = e.account_owner_staff_id
                     AND CURRENT_DATE BETWEEN d.starts_on AND d.ends_on)`
              : 'NULL::text'
          } AS delegated_until,
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
    requested: AmScope | undefined | 'max',
  ): Promise<ListActor> {
    const internal = req.staffAuthVia === 'internal';
    const staffId = req.staffUser
      ? ((await this.staffAuth.resolveCrmStaffUserId(req.staffUser)) ?? 0)
      : 0;
    if (internal && !req.staffUser) {
      const wanted: AmScope | undefined = requested === 'max' ? 'all' : requested;
      return {
        staffId,
        scope: resolveAmScope({ requested: wanted, hasViewAll: true, canTeam: true }),
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
    const wanted: AmScope | undefined =
      requested === 'max' ? (hasViewAll ? 'all' : canTeam ? 'team' : 'me') : requested;
    const scope = resolveAmScope({ requested: wanted, hasViewAll, canTeam });
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

const EXPORT_CSV_HEADER =
  'agency_client_id,code,name,owner_staff_id,team_id,am_status,health_band,mrr_vnd,ends_on';

type AmExportRow = {
  agency_client_id: string;
  code: string;
  name: string;
  owner_staff_id: number | null;
  team_id: number | null;
  am_status: string;
  health_band: string | null;
  mrr_vnd: number | null;
  ends_on: string | null;
};

function asTags(value: unknown): string[] {
  if (Array.isArray(value)) {
    return [...new Set(value.map((tag) => String(tag ?? '').trim()).filter(Boolean))];
  }
  return [];
}

function exportInnerSelect(includeContracts: boolean): string {
  return `
        SELECT
          e.agency_client_id::text AS agency_client_id,
          c.code,
          c.name,
          e.account_owner_staff_id AS owner_staff_id,
          e.team_id,
          e.am_status,
          CASE
            WHEN snap.override_band IS NOT NULL AND snap.override_until >= CURRENT_DATE
              THEN snap.override_band
            ELSE snap.band
          END AS band,
          ${includeContracts ? 'mrr.mrr_vnd' : 'NULL::numeric AS mrr_vnd'},
          ${includeContracts ? 'ends.ends_on' : 'NULL::date AS ends_on'},
          COALESCE(child.child_count, 0)::int AS child_count,
          e.updated_at
        FROM crm_am_account_ext e
        INNER JOIN clients c ON c.id = e.agency_client_id
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
        ${includeContracts ? contractJoins() : ''}`;
}

function escapeAmCsvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function buildAccountsCsv(rows: AmExportRow[], hideAmounts: boolean): string {
  const lines = rows.map((row) =>
    [
      row.agency_client_id,
      row.code,
      row.name,
      row.owner_staff_id == null ? '' : String(row.owner_staff_id),
      row.team_id == null ? '' : String(row.team_id),
      row.am_status,
      row.health_band ?? '',
      hideAmounts || row.mrr_vnd == null ? '' : String(row.mrr_vnd),
      row.ends_on ?? '',
    ]
      .map((cell) => escapeAmCsvCell(cell))
      .join(','),
  );
  return [EXPORT_CSV_HEADER, ...lines].join('\n') + '\n';
}
