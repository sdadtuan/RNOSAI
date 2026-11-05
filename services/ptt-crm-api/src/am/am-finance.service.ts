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

export type AmFinanceReq = {
  staffUser?: StaffJwtPayload;
  staffAuthVia?: 'internal' | 'jwt';
};

export type AmFinanceInvoice = {
  id: string | number;
  number: string | null;
  status: string | null;
  issued_on: string | null;
  due_on: string | null;
  amount_vnd: number | null;
  paid_vnd: number | null;
  aging_days: number | null;
};

export type AmFinanceKpis = {
  mrr_vnd: number | null;
  active_total_vnd: number | null;
  outstanding_vnd: number | null;
  overdue_vnd: number | null;
  next_invoice_on: string | null;
  next_invoice_vnd: number | null;
};

export type AmFinanceSnapshot = {
  hidden: boolean;
  stale: boolean;
  source: string | null;
  last_sync: string | null;
  erp_href: '/crm/invoices';
  kpis: AmFinanceKpis;
  invoices: AmFinanceInvoice[];
};

export type AmFinanceDb = {
  query(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: Record<string, unknown>[]; rowCount?: number | null }>;
};

const ICT = 'Asia/Ho_Chi_Minh';
const ERP_HREF = '/crm/invoices' as const;
const CLOSED_STATUSES = new Set(['paid', 'void', 'draft', 'cancelled', 'canceled']);

type InvoiceTable = 'crm_invoices' | 'invoices';

type ContractRow = {
  billing_type: string;
  amount_vnd: number | null;
  starts_on: string | null;
  ends_on: string | null;
  status: string;
};

type InvoiceRow = {
  id: string | number;
  number: string | null;
  status: string | null;
  issued_on: string | null;
  due_on: string | null;
  amount_vnd: number | null;
  paid_vnd: number | null;
  updated_at: string | null;
};

@Injectable()
export class AmFinanceRepository implements OnModuleDestroy, AmFinanceDb {
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
export class AmFinanceService {
  constructor(
    private readonly db: AmFinanceRepository,
    private readonly staffAuth: StaffAuthService,
  ) {}

  async get(req: AmFinanceReq, rawId: string): Promise<AmFinanceSnapshot> {
    const clientId = String(rawId ?? '').trim();
    if (!isUuid(clientId)) amThrow(400, { error: 'invalid_agency_client_id' });
    const hidden = await this.shouldHideAmounts(req);
    const actor = await this.resolveActor(req);
    await this.assertInScope(actor, clientId);
    const source = await this.detectInvoiceTable();
    if (!source) {
      return hideVndFields(staleEmpty(hidden), hidden);
    }
    const [contracts, invoices] = await Promise.all([
      this.loadContracts(clientId),
      this.loadInvoices(source, clientId),
    ]);
    return hideVndFields(assembleSnapshot(source, contracts, invoices, hidden), hidden);
  }

  private async shouldHideAmounts(req: AmFinanceReq): Promise<boolean> {
    if (req.staffAuthVia === 'internal' && !req.staffUser) return false;
    if (!req.staffUser) return true;
    const me = await this.staffAuth.me(req.staffUser);
    return !(
      this.staffAuth.hasCap(me.caps, 'crm_am.finance', 'view') ||
      this.staffAuth.hasCap(me.caps, 'crm_am', 'manage')
    );
  }

  private async assertInScope(
    actor: { staffId: number; scope: AmScope; teamIds: number[] },
    clientId: string,
  ): Promise<void> {
    const bound = bindScopeSql(
      amScopeSql({ scope: actor.scope, staffId: actor.staffId, teamIds: actor.teamIds }),
      3,
    );
    let row: Record<string, unknown> | undefined;
    try {
      const result = await this.db.query(
        `SELECT e.agency_client_id::text AS agency_client_id
           FROM crm_am_account_ext e
          INNER JOIN clients c ON c.id = e.agency_client_id
          WHERE e.tenant_id = $1
            AND e.agency_client_id = $2::uuid
            AND ${bound.sql}
          LIMIT 1`,
        [AM_TENANT_ID, clientId, ...bound.params],
      );
      row = result.rows[0];
    } catch (err) {
      if (!isMissingRelation(err)) throw err;
    }
    if (!row) amThrow(404, { error: 'not_found' });
  }

  private async detectInvoiceTable(): Promise<InvoiceTable | null> {
    const result = await this.db.query(
      `SELECT to_regclass('public.crm_invoices') AS crm, to_regclass('public.invoices') AS inv`,
    );
    const row = result.rows[0] ?? {};
    if (row.crm) return 'crm_invoices';
    if (row.inv) return 'invoices';
    return null;
  }

  private async loadContracts(clientId: string): Promise<ContractRow[]> {
    try {
      const result = await this.db.query(
        `SELECT billing_type, amount_vnd, starts_on, ends_on, status
           FROM crm_contracts
          WHERE TRIM(COALESCE(agency_client_id, '')) = $1`,
        [clientId],
      );
      return result.rows.map((row) => ({
        billing_type: String(row.billing_type ?? ''),
        amount_vnd: num(row.amount_vnd),
        starts_on: dayStr(row.starts_on),
        ends_on: dayStr(row.ends_on),
        status: String(row.status ?? ''),
      }));
    } catch (err) {
      if (isMissingRelation(err)) return [];
      throw err;
    }
  }

  private async loadInvoices(source: InvoiceTable, clientId: string): Promise<InvoiceRow[]> {
    const table = source === 'crm_invoices' ? 'crm_invoices' : 'invoices';
    try {
      const result = await this.db.query(
        `SELECT i.*
           FROM ${table} i
           INNER JOIN crm_contracts ct ON ct.id = i.contract_id
          WHERE TRIM(COALESCE(ct.agency_client_id, '')) = $1
          ORDER BY i.due_on NULLS LAST, i.id`,
        [clientId],
      );
      return result.rows.map(mapInvoiceRow);
    } catch (err) {
      if (isMissingRelation(err) || isUndefinedColumn(err)) return [];
      throw err;
    }
  }

  private async resolveActor(
    req: AmFinanceReq,
  ): Promise<{ staffId: number; scope: AmScope; teamIds: number[] }> {
    const internal = req.staffAuthVia === 'internal';
    const staffId = req.staffUser
      ? ((await this.staffAuth.resolveCrmStaffUserId(req.staffUser)) ?? 0)
      : 0;
    if (internal && !req.staffUser) {
      return { staffId, scope: resolveAmScope({ requested: 'all', hasViewAll: true, canTeam: true }), teamIds: [] };
    }
    if (!req.staffUser) {
      return { staffId, scope: 'me', teamIds: [] };
    }
    const me = await this.staffAuth.me(req.staffUser);
    const has = (action: string) => this.staffAuth.hasCap(me.caps, 'crm_am', action);
    const hasViewAll = has('view_all') || has('manage');
    const canTeam = hasViewAll || has('assign');
    const scope = resolveAmScope({ requested: undefined, hasViewAll, canTeam });
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

function assembleSnapshot(
  source: InvoiceTable,
  contracts: ContractRow[],
  invoices: InvoiceRow[],
  hidden: boolean,
): AmFinanceSnapshot {
  const today = ictToday();
  const { mrr_vnd, active_total_vnd } = contractKpis(contracts);
  const { outstanding_vnd, overdue_vnd, next_invoice_on, next_invoice_vnd } = invoiceKpis(invoices, today);
  const last_sync = invoices.reduce<string | null>((latest, row) => {
    if (!row.updated_at) return latest;
    if (!latest) return row.updated_at;
    return Date.parse(row.updated_at) > Date.parse(latest) ? row.updated_at : latest;
  }, null);
  return {
    hidden,
    stale: false,
    source,
    last_sync,
    erp_href: ERP_HREF,
    kpis: {
      mrr_vnd,
      active_total_vnd,
      outstanding_vnd,
      overdue_vnd,
      next_invoice_on,
      next_invoice_vnd,
    },
    invoices: invoices.map((row) => ({
      id: row.id,
      number: row.number,
      status: row.status,
      issued_on: row.issued_on,
      due_on: row.due_on,
      amount_vnd: row.amount_vnd,
      paid_vnd: row.paid_vnd,
      aging_days: row.due_on ? daysBetween(row.due_on, today) : null,
    })),
  };
}

function contractKpis(contracts: ContractRow[]): Pick<AmFinanceKpis, 'mrr_vnd' | 'active_total_vnd'> {
  const active = contracts.filter((row) => /^(active|renewing)$/i.test(row.status.trim()));
  if (!active.length) return { mrr_vnd: null, active_total_vnd: null };
  let mrr = 0;
  let hasMrr = false;
  let activeTotal = 0;
  let hasActive = false;
  for (const row of active) {
    const amount = row.amount_vnd;
    if (amount != null) {
      activeTotal += amount;
      hasActive = true;
    }
    const recurring = monthlyRecurringVnd({
      billingType: row.billing_type.trim().toLowerCase(),
      amountVnd: amount ?? 0,
      startsOn: row.starts_on,
      endsOn: row.ends_on,
    });
    if (recurring != null) {
      mrr += recurring;
      hasMrr = true;
    }
  }
  return {
    mrr_vnd: hasMrr ? mrr : null,
    active_total_vnd: hasActive ? activeTotal : null,
  };
}

function invoiceKpis(
  invoices: InvoiceRow[],
  today: string,
): Pick<AmFinanceKpis, 'outstanding_vnd' | 'overdue_vnd' | 'next_invoice_on' | 'next_invoice_vnd'> {
  let outstanding = 0;
  let hasOutstanding = false;
  let overdue = 0;
  let hasOverdue = false;
  let next: InvoiceRow | null = null;
  for (const row of invoices) {
    if (!isOpen(row.status)) continue;
    const remain = remaining(row);
    if (remain != null && remain > 0) {
      outstanding += remain;
      hasOutstanding = true;
    }
    if (isOverdue(row, today) && remain != null && remain > 0) {
      overdue += remain;
      hasOverdue = true;
    }
    if (row.due_on && row.due_on >= today) {
      if (!next || row.due_on < next.due_on! || (row.due_on === next.due_on && idRank(row.id) < idRank(next.id))) {
        next = row;
      }
    }
  }
  return {
    outstanding_vnd: hasOutstanding ? outstanding : null,
    overdue_vnd: hasOverdue ? overdue : null,
    next_invoice_on: next?.due_on ?? null,
    next_invoice_vnd: next ? next.amount_vnd : null,
  };
}

function staleEmpty(hidden: boolean): AmFinanceSnapshot {
  return {
    hidden,
    stale: true,
    source: null,
    last_sync: null,
    erp_href: ERP_HREF,
    kpis: {
      mrr_vnd: null,
      active_total_vnd: null,
      outstanding_vnd: null,
      overdue_vnd: null,
      next_invoice_on: null,
      next_invoice_vnd: null,
    },
    invoices: [],
  };
}

function hideVndFields<T>(value: T, hidden: boolean): T {
  if (!hidden || value == null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((item) => hideVndFields(item, hidden)) as T;
  const out: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    out[key] = key.endsWith('_vnd') ? null : hideVndFields(nested, hidden);
  }
  return out as T;
}

function mapInvoiceRow(row: Record<string, unknown>): InvoiceRow {
  return {
    id: row.id == null || row.id === '' ? String(row.id ?? '') : (typeof row.id === 'number' ? row.id : String(row.id)),
    number: textOrNull(row.invoice_number ?? row.number),
    status: textOrNull(row.status),
    issued_on: dayStr(row.issued_on),
    due_on: dayStr(row.due_on),
    amount_vnd: num(row.amount_vnd),
    paid_vnd: num(row.paid_vnd),
    updated_at: asIso(row.updated_at),
  };
}

function isOpen(status: string | null): boolean {
  if (!status) return true;
  return !CLOSED_STATUSES.has(status.trim().toLowerCase());
}

function remaining(row: InvoiceRow): number | null {
  if (row.amount_vnd == null) return null;
  return Math.max(0, row.amount_vnd - (row.paid_vnd ?? 0));
}

function isOverdue(row: InvoiceRow, today: string): boolean {
  if (!isOpen(row.status)) return false;
  if (row.due_on) return row.due_on < today;
  return /overdue/i.test(row.status ?? '');
}

function idRank(id: string | number): number {
  const n = Number(id);
  return Number.isFinite(n) ? n : 0;
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

function isUndefinedColumn(err: unknown): boolean {
  return (err as { code?: string }).code === '42703';
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

function textOrNull(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s || null;
}

function asIso(value: unknown): string | null {
  if (value == null || value === '') return null;
  if (value instanceof Date) return value.toISOString();
  const s = String(value);
  const t = Date.parse(s);
  return Number.isFinite(t) ? new Date(t).toISOString() : s;
}

function ictToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ICT,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function daysBetween(from: string, to: string): number | null {
  const a = Date.parse(`${from}T00:00:00+07:00`);
  const b = Date.parse(`${to}T00:00:00+07:00`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.round((b - a) / 86_400_000);
}
