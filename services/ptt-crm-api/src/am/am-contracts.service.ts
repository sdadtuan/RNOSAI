import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { AM_TENANT_ID } from './am-audit.repository';
import { amThrow } from './am-http';
import { monthlyRecurringVnd } from './am-money.util';
import { amScopeSql, resolveAmScope } from './am-scope.util';
import { isUuid } from './am-tasks.service';
import type { AmScope } from './am.types';

export type AmContractsReq = {
  staffUser?: StaffJwtPayload;
  staffAuthVia?: 'internal' | 'jwt';
};

export type AmContractsListQuery = {
  agency_client_id?: string;
  scope?: AmScope;
};

export type AmContractListItem = {
  id: number;
  reference_code: string;
  title: string;
  status: string;
  billing_type: string;
  service_slug: string;
  starts_on: string | null;
  ends_on: string | null;
  days_remaining: number | null;
  amount_vnd: number | null;
  mrr_vnd: number | null;
  agency_client_id: string;
  client_name: string;
  client_code: string;
  hide_amounts: boolean;
};

export type AmContractLineItem = {
  service_slug: string;
  title: string;
  amount_vnd: number | null;
  starts_on: string | null;
  ends_on: string | null;
  status: string;
};

export type AmContractAuditItem = {
  event_type: string;
  actor: string;
  created_at: string;
  payload_json: Record<string, unknown> | null;
};

export type AmContractDetail = AmContractListItem & {
  notes: string;
  renewal_reminder_days: number | null;
  signed_on: string | null;
  line_items: AmContractLineItem[];
  obligations: [];
  payment_schedule: [];
  amendments: [];
  documents: [];
  renewal: {
    ends_on: string | null;
    days_remaining: number | null;
    open_case_id: string | null;
  };
  audit: AmContractAuditItem[];
};

export type AmContractsDb = {
  query(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: Record<string, unknown>[]; rowCount?: number | null }>;
};

const ICT = 'Asia/Ho_Chi_Minh';

const CONTRACT_COLS = `
  ct.id,
  ct.reference_code,
  ct.title,
  ct.status,
  ct.billing_type,
  ct.service_slug,
  ct.starts_on,
  ct.ends_on,
  ct.amount_vnd,
  TRIM(COALESCE(ct.agency_client_id, '')) AS agency_client_id,
  ct.notes,
  ct.renewal_reminder_days,
  ct.signed_on,
  c.name AS client_name,
  c.code AS client_code
`;

const CONTRACT_FROM = `
  FROM crm_contracts ct
  INNER JOIN crm_am_account_ext e
          ON TRIM(COALESCE(ct.agency_client_id, '')) = e.agency_client_id::text
         AND e.tenant_id = $1
  INNER JOIN clients c ON c.id = e.agency_client_id
`;

@Injectable()
export class AmContractsRepository implements OnModuleDestroy, AmContractsDb {
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
export class AmContractsService {
  constructor(
    private readonly db: AmContractsRepository,
    private readonly staffAuth: StaffAuthService,
  ) {}

  async list(req: AmContractsReq, q: AmContractsListQuery): Promise<{ items: AmContractListItem[] }> {
    const hideAmounts = await this.shouldHideAmounts(req);
    const actor = await this.resolveActor(req, q.scope);
    const bound = bindScopeSql(
      amScopeSql({ scope: actor.scope, staffId: actor.staffId, teamIds: actor.teamIds }),
      2,
    );
    const params: unknown[] = [AM_TENANT_ID, ...bound.params];
    const where = [bound.sql];

    const clientId = String(q.agency_client_id ?? '').trim();
    if (clientId) {
      if (!isUuid(clientId)) amThrow(400, { error: 'invalid_agency_client_id' });
      params.push(clientId);
      where.push(`TRIM(COALESCE(ct.agency_client_id, '')) = $${params.length}`);
    }

    try {
      const result = await this.db.query(
        `SELECT ${CONTRACT_COLS} ${CONTRACT_FROM}
          WHERE ${where.join(' AND ')}
          ORDER BY ct.ends_on NULLS LAST, ct.id`,
        params,
      );
      return { items: result.rows.map((row) => this.mapListItem(row, hideAmounts)) };
    } catch (err) {
      if (isMissingRelation(err)) return { items: [] };
      throw err;
    }
  }

  async get(req: AmContractsReq, rawId: string): Promise<AmContractDetail> {
    const id = parseContractId(rawId);
    const hideAmounts = await this.shouldHideAmounts(req);
    const actor = await this.resolveActor(req, undefined);
    const bound = bindScopeSql(
      amScopeSql({ scope: actor.scope, staffId: actor.staffId, teamIds: actor.teamIds }),
      3,
    );
    let row: Record<string, unknown> | undefined;
    try {
      const result = await this.db.query(
        `SELECT ${CONTRACT_COLS} ${CONTRACT_FROM}
          WHERE ct.id = $2 AND ${bound.sql}
          LIMIT 1`,
        [AM_TENANT_ID, id, ...bound.params],
      );
      row = result.rows[0];
    } catch (err) {
      if (!isMissingRelation(err)) throw err;
    }
    if (!row) amThrow(404, { error: 'not_found' });

    const list = this.mapListItem(row, hideAmounts);
    const [openCaseId, audit] = await Promise.all([
      this.loadOpenRenewalCaseId(id),
      this.loadAudit(id),
    ]);
    return {
      ...list,
      notes: String(row.notes ?? ''),
      renewal_reminder_days: num(row.renewal_reminder_days),
      signed_on: dayStr(row.signed_on),
      line_items: deriveLineItems(row, hideAmounts),
      obligations: [],
      payment_schedule: [],
      amendments: [],
      documents: [],
      renewal: {
        ends_on: list.ends_on,
        days_remaining: list.days_remaining,
        open_case_id: openCaseId,
      },
      audit,
    };
  }

  private async shouldHideAmounts(req: AmContractsReq): Promise<boolean> {
    if (req.staffAuthVia === 'internal' && !req.staffUser) return false;
    if (!req.staffUser) return true;
    const me = await this.staffAuth.me(req.staffUser);
    return !(
      this.staffAuth.hasCap(me.caps, 'crm_am.finance', 'view') ||
      this.staffAuth.hasCap(me.caps, 'crm_am', 'manage')
    );
  }

  private mapListItem(row: Record<string, unknown>, hideAmounts: boolean): AmContractListItem {
    const billingType = String(row.billing_type ?? '');
    const amount = num(row.amount_vnd);
    const startsOn = dayStr(row.starts_on);
    const endsOn = dayStr(row.ends_on);
    const mrr = monthlyRecurringVnd({
      billingType: billingType.trim().toLowerCase(),
      amountVnd: amount ?? 0,
      startsOn,
      endsOn,
    });
    return {
      id: Number(row.id ?? 0),
      reference_code: String(row.reference_code ?? ''),
      title: String(row.title ?? ''),
      status: String(row.status ?? ''),
      billing_type: billingType,
      service_slug: String(row.service_slug ?? ''),
      starts_on: startsOn,
      ends_on: endsOn,
      days_remaining: daysRemaining(endsOn),
      amount_vnd: hideAmounts ? null : amount,
      mrr_vnd: hideAmounts ? null : mrr,
      agency_client_id: String(row.agency_client_id ?? ''),
      client_name: String(row.client_name ?? ''),
      client_code: String(row.client_code ?? ''),
      hide_amounts: hideAmounts,
    };
  }

  private async loadOpenRenewalCaseId(contractId: number): Promise<string | null> {
    try {
      const result = await this.db.query(
        `SELECT id::text AS id
           FROM crm_am_renewal_cases
          WHERE contract_id = $1
            AND status NOT IN ('renewed', 'lost')
          LIMIT 1`,
        [contractId],
      );
      const id = String(result.rows[0]?.id ?? '').trim();
      return id || null;
    } catch (err) {
      if (isMissingRelation(err)) return null;
      throw err;
    }
  }

  private async loadAudit(contractId: number): Promise<AmContractAuditItem[]> {
    try {
      const result = await this.db.query(
        `SELECT event_type, actor, created_at, payload_json
           FROM crm_contract_events
          WHERE contract_id = $1
          ORDER BY created_at DESC
          LIMIT 20`,
        [contractId],
      );
      return result.rows.map((row) => ({
        event_type: String(row.event_type ?? ''),
        actor: String(row.actor ?? ''),
        created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at ?? ''),
        payload_json: asJson(row.payload_json),
      }));
    } catch (err) {
      if (isMissingRelation(err)) return [];
      throw err;
    }
  }

  private async resolveActor(
    req: AmContractsReq,
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

function parseContractId(raw: string): number {
  const s = String(raw ?? '').trim();
  if (!/^\d+$/.test(s)) amThrow(400, { error: 'invalid_contract_id' });
  const n = Number(s);
  if (!Number.isInteger(n) || n <= 0) amThrow(400, { error: 'invalid_contract_id' });
  return n;
}

function deriveLineItems(row: Record<string, unknown>, hideAmounts: boolean): AmContractLineItem[] {
  const slug = String(row.service_slug ?? '').trim();
  const title = String(row.title ?? '').trim();
  if (!slug && !title) return [];
  return [
    {
      service_slug: slug,
      title,
      amount_vnd: hideAmounts ? null : num(row.amount_vnd),
      starts_on: dayStr(row.starts_on),
      ends_on: dayStr(row.ends_on),
      status: String(row.status ?? ''),
    },
  ];
}

function daysRemaining(endsOn: string | null): number | null {
  if (!endsOn) return null;
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: ICT,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const endMs = Date.parse(`${endsOn}T00:00:00+07:00`);
  const todayMs = Date.parse(`${today}T00:00:00+07:00`);
  if (!Number.isFinite(endMs) || !Number.isFinite(todayMs)) return null;
  return Math.round((endMs - todayMs) / 86_400_000);
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

function num(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function dayStr(value: unknown): string | null {
  if (value == null || value === '') return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const s = String(value);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

function asJson(value: unknown): Record<string, unknown> | null {
  if (value == null) return null;
  if (typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
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
