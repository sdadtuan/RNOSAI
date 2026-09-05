import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { AM_TENANT_ID } from './am-audit.repository';
import { isStale, workLeftLabel } from './am-freshness.util';
import { bandFromScore, isActiveBook } from './am-health.util';
import { monthlyRecurringVnd } from './am-money.util';
import { amScopeSql, resolveAmScope } from './am-scope.util';
import type {
  AmAmStatus,
  AmCommandCenter,
  AmHealthBand,
  AmRole,
  AmScope,
} from './am.types';

const CACHE_TTL_MS = 60_000;
const DEFAULT_QUOTA = 40;
const ICT = 'Asia/Ho_Chi_Minh';

export type AmDashboardReq = {
  staffUser?: StaffJwtPayload;
  staffAuthVia?: 'internal' | 'jwt';
};

export type AmDashboardQuery = { from?: string; to?: string; scope?: AmScope };

export type RevenueAtRiskRow = { band: string; mrr: number | null | undefined };

export function emptyKpis(): AmCommandCenter['kpis'] {
  return {
    active_accounts: null,
    mrr_vnd: null,
    renewal_90d_vnd: null,
    renewal_90d_count: null,
    revenue_at_risk_vnd: null,
    revenue_at_risk_count: null,
    sla_overdue: null,
    csat: null,
  };
}

export function sumRevenueAtRisk(rows: RevenueAtRiskRow[]): { vnd: number | null; count: number } {
  let vnd = 0;
  let count = 0;
  let anyMoney = false;
  for (const row of rows) {
    if (row.band !== 'at_risk' && row.band !== 'critical') continue;
    count += 1;
    if (row.mrr != null) {
      vnd += row.mrr;
      anyMoney = true;
    }
  }
  return { vnd: anyMoney && vnd !== 0 ? vnd : null, count };
}

export function todayWorkChip(
  dueAt: unknown,
  assigneeStaffId: number | null,
  now: Date,
): AmCommandCenter['today_work'][number]['chip'] {
  if (assigneeStaffId == null) return 'unassigned';
  const due =
    dueAt instanceof Date ? dueAt : dueAt != null && dueAt !== '' ? new Date(String(dueAt)) : null;
  if (!due || !Number.isFinite(due.getTime())) return 'soon';
  const dueDay = ictYmd(due);
  const today = ictYmd(now);
  if (dueDay < today) return 'overdue';
  if (dueDay === today) return 'today';
  return 'soon';
}

export function showCoverage(scope: AmScope, role: AmRole): boolean {
  return (scope === 'team' || scope === 'all') && (role === 'director' || role === 'admin');
}

type CacheEntry = { expires: number; value: AmCommandCenter };

type BookRow = {
  agency_client_id: string;
  am_status: string;
  account_owner_staff_id: number | null;
  backup_staff_id: number | null;
  team_id: number | null;
  parent_agency_client_id: string | null;
  name: string;
  parent_name: string | null;
  child_count: number;
  owner_label: string | null;
  score: number | null;
  band: string | null;
  override_band: string | null;
  override_until: string | null;
  snap_as_of: string | null;
  next_action: string | null;
  contracts: ContractRow[];
};

type ContractRow = {
  id: number;
  status: string;
  billing_type: string;
  amount_vnd: number;
  starts_on: string | null;
  ends_on: string | null;
  title: string;
  service_slug: string;
};

function ictYmd(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ICT,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

function ictMonthStart(now = new Date()): string {
  return `${ictYmd(now).slice(0, 7)}-01`;
}

function parseDay(raw: string | undefined, fallback: string): string {
  return raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : fallback;
}

function addDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

function dayStr(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const s = String(value);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

function isoTs(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  const s = String(value);
  return s || null;
}

function num(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function daysBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  const a = Date.UTC(fy, fm - 1, fd);
  const b = Date.UTC(ty, tm - 1, td);
  return Math.round((b - a) / 86_400_000);
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

function contractStatus(row: ContractRow): string {
  return String(row.status ?? '').trim().toLowerCase();
}

function isLiveContract(row: ContractRow): boolean {
  const s = contractStatus(row);
  return s === 'active' || s === 'renewing';
}

function recurringOf(row: ContractRow): number | null {
  return monthlyRecurringVnd({
    billingType: String(row.billing_type ?? '').trim().toLowerCase(),
    amountVnd: Number(row.amount_vnd ?? 0),
    startsOn: dayStr(row.starts_on),
    endsOn: dayStr(row.ends_on),
  });
}

function accountMrr(contracts: ContractRow[]): number | null {
  let sum = 0;
  let any = false;
  for (const ct of contracts) {
    if (!isLiveContract(ct)) continue;
    const mrr = recurringOf(ct);
    if (mrr == null) continue;
    sum += mrr;
    any = true;
  }
  return any ? sum : null;
}

function earliestEnd(contracts: ContractRow[]): string | null {
  let best: string | null = null;
  for (const ct of contracts) {
    if (!isLiveContract(ct)) continue;
    const end = dayStr(ct.ends_on);
    if (!end) continue;
    if (!best || end < best) best = end;
  }
  return best;
}

function packageLabel(contracts: ContractRow[]): string {
  const live = contracts.find((ct) => isLiveContract(ct));
  const title = String(live?.title ?? '').trim();
  if (title) return title;
  return String(live?.service_slug ?? '').trim();
}

function effectiveBand(row: BookRow, asOf: string): AmHealthBand | null {
  const until = dayStr(row.override_until);
  if (row.override_band && until && until >= asOf) {
    return row.override_band as AmHealthBand;
  }
  if (row.band) return row.band as AmHealthBand;
  if (row.score != null) return bandFromScore(row.score);
  return null;
}

function emptyForecast(): AmCommandCenter['forecast'] {
  return { committed_vnd: null, likely_vnd: null, risk_vnd: null, unlikely_vnd: null };
}

function emptyHealth(): AmCommandCenter['health_dist'] {
  return { healthy: 0, watch: 0, at_risk: 0, critical: 0, avg: null };
}

function moneyOrNull(n: number, had: boolean): number | null {
  return had ? n : null;
}

@Injectable()
export class AmDashboardService implements OnModuleDestroy {
  private pool: Pool | null = null;
  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    private readonly config: AppConfigService,
    private readonly staffAuth: StaffAuthService,
  ) {}

  private get db(): Pool {
    if (!this.pool) {
      this.pool = new Pool({ connectionString: this.config.databaseUrl });
    }
    return this.pool;
  }

  onModuleDestroy(): void {
    void this.pool?.end();
    this.pool = null;
    this.cache.clear();
  }

  dropCache(key?: string): void {
    if (key) this.cache.delete(key);
    else this.cache.clear();
  }

  async get(req: AmDashboardReq, q: AmDashboardQuery): Promise<AmCommandCenter> {
    const now = new Date();
    const period = {
      from: parseDay(q.from, ictMonthStart(now)),
      to: parseDay(q.to, ictYmd(now)),
    };
    const { staffId, role, hasViewAll, canTeam, teamIds } = await this.resolveActor(req);
    const scope = resolveAmScope({ requested: q.scope, hasViewAll, canTeam });
    const cacheKey = `${staffId}|${scope}|${period.from}|${period.to}`;
    const hit = this.cache.get(cacheKey);
    if (hit && hit.expires > Date.now()) return hit.value;

    const payload = await this.build(staffId, role, scope, teamIds, period, now);
    this.cache.set(cacheKey, { expires: Date.now() + CACHE_TTL_MS, value: payload });
    return payload;
  }

  private async resolveActor(req: AmDashboardReq): Promise<{
    staffId: number;
    role: AmRole;
    hasViewAll: boolean;
    canTeam: boolean;
    teamIds: number[];
  }> {
    const internal = req.staffAuthVia === 'internal';
    const staffId = req.staffUser
      ? ((await this.staffAuth.resolveCrmStaffUserId(req.staffUser)) ?? 0)
      : 0;
    if (internal && !req.staffUser) {
      return { staffId, role: 'admin', hasViewAll: true, canTeam: true, teamIds: [] };
    }
    if (!req.staffUser) {
      return { staffId, role: 'am', hasViewAll: false, canTeam: false, teamIds: [] };
    }
    const me = await this.staffAuth.me(req.staffUser);
    const has = (action: string) => this.staffAuth.hasCap(me.caps, 'crm_am', action);
    const hasViewAll = has('view_all') || has('manage');
    const canTeam = hasViewAll || has('assign');
    const role: AmRole = has('manage') ? 'admin' : canTeam ? 'director' : 'am';
    const teamIds = await this.loadTeamIds(staffId, req.staffUser.sub);
    return { staffId, role, hasViewAll, canTeam, teamIds };
  }

  private async loadTeamIds(staffId: number, userSub: string): Promise<number[]> {
    try {
      const byStaff = await this.db.query<{ id: number }>(
        `SELECT t.id
         FROM crm_staff cs
         JOIN staff_users u ON lower(trim(u.email)) = lower(trim(cs.email))
         JOIN staff_user_teams sut ON sut.user_id = u.id
         JOIN staff_teams t ON t.id = sut.team_id AND t.active IS TRUE
         WHERE cs.id = $1`,
        [staffId],
      );
      if (byStaff.rows.length) return byStaff.rows.map((r) => Number(r.id)).filter((n) => n > 0);
    } catch (err) {
      if (!isMissingRelation(err)) throw err;
    }
    if (!/^[0-9a-f-]{36}$/i.test(userSub)) return [];
    try {
      const byUser = await this.db.query<{ id: number }>(
        `SELECT t.id
         FROM staff_user_teams sut
         JOIN staff_teams t ON t.id = sut.team_id AND t.active IS TRUE
         WHERE sut.user_id = $1::uuid`,
        [userSub],
      );
      return byUser.rows.map((r) => Number(r.id)).filter((n) => n > 0);
    } catch (err) {
      if (isMissingRelation(err)) return [];
      throw err;
    }
  }

  private async build(
    staffId: number,
    role: AmRole,
    scope: AmScope,
    teamIds: number[],
    period: { from: string; to: string },
    now: Date,
  ): Promise<AmCommandCenter> {
    const asOf = period.to;
    const today = ictYmd(now);
    const [book, todayWork, slaOverdue, quota, qbrThisWeek] = await Promise.all([
      this.loadBook(staffId, scope, teamIds, asOf),
      this.loadTodayWork(staffId, scope, teamIds, now),
      this.loadSlaOverdue(staffId, scope, teamIds),
      this.loadQuota(),
      this.loadQbrThisWeek(staffId, scope, teamIds, today),
    ]);

    const active = book.filter((row) => isActiveBook(row.am_status as AmAmStatus));
    const freshnessAsOf = latestSnapAsOf(book) ?? now.toISOString();
    const freshness = {
      as_of: freshnessAsOf,
      stale: book.length > 0 && isStale(freshnessAsOf, now),
      work_left_label: workLeftLabel(now),
    };

    if (!active.length) {
      return {
        period,
        scope,
        freshness,
        role,
        load: { accounts: 0, quota },
        kpis: emptyKpis(),
        coverage: showCoverage(scope, role)
          ? { avg_load: null, unassigned: 0, delegated: 0, qbr_this_week: qbrThisWeek }
          : null,
        today_work: [],
        attention: [],
        forecast: emptyForecast(),
        health_dist: emptyHealth(),
        my_book: [],
      };
    }

    const riskRows = active.map((row) => ({
      band: effectiveBand(row, asOf) ?? '',
      mrr: accountMrr(row.contracts),
    }));
    const atRisk = sumRevenueAtRisk(riskRows);
    const mrrParts = active.map((row) => accountMrr(row.contracts)).filter((n): n is number => n != null);
    const renewal = sumRenewal90d(active, asOf);
    const forecast = forecastFromBands(active, asOf);

    return {
      period,
      scope,
      freshness,
      role,
      load: { accounts: active.length, quota },
      kpis: {
        active_accounts: active.length,
        mrr_vnd: mrrParts.length ? mrrParts.reduce((a, b) => a + b, 0) : null,
        renewal_90d_vnd: renewal.vnd,
        renewal_90d_count: renewal.count,
        revenue_at_risk_vnd: atRisk.count ? atRisk.vnd : null,
        revenue_at_risk_count: atRisk.count ? atRisk.count : null,
        sla_overdue: slaOverdue,
        csat: null,
      },
      coverage: showCoverage(scope, role) ? coverageOf(active, qbrThisWeek) : null,
      today_work: todayWork,
      attention: attentionOf(active, asOf),
      forecast,
      health_dist: healthDistOf(active, asOf),
      my_book: myBookOf(active, asOf),
    };
  }

  private async loadBook(
    staffId: number,
    scope: AmScope,
    teamIds: number[],
    asOf: string,
  ): Promise<BookRow[]> {
    const bound = bindScopeSql(amScopeSql({ scope, staffId, teamIds }), 3);
    const sql = `
      SELECT
        e.agency_client_id::text AS agency_client_id,
        e.am_status,
        e.account_owner_staff_id,
        e.backup_staff_id,
        e.team_id,
        e.parent_agency_client_id::text AS parent_agency_client_id,
        c.name,
        parent.name AS parent_name,
        COALESCE(child.child_count, 0)::int AS child_count,
        owner.name AS owner_label,
        snap.score,
        snap.band,
        snap.override_band,
        snap.override_until,
        snap.as_of AS snap_as_of,
        nxt.title AS next_action,
        COALESCE(cts.contracts, '[]'::json) AS contracts
      FROM crm_am_account_ext e
      INNER JOIN clients c ON c.id = e.agency_client_id
      LEFT JOIN clients parent ON parent.id = e.parent_agency_client_id
      LEFT JOIN crm_staff owner ON owner.id = e.account_owner_staff_id
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS child_count
        FROM crm_am_account_ext ch
        WHERE ch.parent_agency_client_id = e.agency_client_id
      ) child ON TRUE
      LEFT JOIN LATERAL (
        SELECT h.score, h.band, h.override_band, h.override_until, h.as_of
        FROM crm_am_health_snapshots h
        WHERE h.tenant_id = $1
          AND h.agency_client_id = e.agency_client_id
          AND h.as_of <= $2::date
        ORDER BY h.as_of DESC
        LIMIT 1
      ) snap ON TRUE
      LEFT JOIN LATERAL (
        SELECT t.title
        FROM crm_am_tasks t
        WHERE t.agency_client_id = e.agency_client_id
          AND t.status NOT IN ('closed', 'cancelled', 'resolved')
          AND t.dismissed_at IS NULL
        ORDER BY t.due_at NULLS LAST, t.created_at
        LIMIT 1
      ) nxt ON TRUE
      LEFT JOIN LATERAL (
        SELECT json_agg(json_build_object(
          'id', ct.id,
          'status', ct.status,
          'billing_type', ct.billing_type,
          'amount_vnd', ct.amount_vnd,
          'starts_on', ct.starts_on,
          'ends_on', ct.ends_on,
          'title', ct.title,
          'service_slug', ct.service_slug
        )) AS contracts
        FROM crm_contracts ct
        WHERE TRIM(COALESCE(ct.agency_client_id, '')) = e.agency_client_id::text
      ) cts ON TRUE
      WHERE e.tenant_id = $1
        AND ${bound.sql}`;
    try {
      const result = await this.db.query(sql, [AM_TENANT_ID, asOf, ...bound.params]);
      return result.rows.map(mapBookRow);
    } catch (err) {
      if (!isMissingRelation(err)) throw err;
      return this.loadBookWithoutContracts(staffId, scope, teamIds, asOf);
    }
  }

  private async loadBookWithoutContracts(
    staffId: number,
    scope: AmScope,
    teamIds: number[],
    asOf: string,
  ): Promise<BookRow[]> {
    const bound = bindScopeSql(amScopeSql({ scope, staffId, teamIds }), 3);
    const sql = `
      SELECT
        e.agency_client_id::text AS agency_client_id,
        e.am_status,
        e.account_owner_staff_id,
        e.backup_staff_id,
        e.team_id,
        e.parent_agency_client_id::text AS parent_agency_client_id,
        c.name,
        parent.name AS parent_name,
        COALESCE(child.child_count, 0)::int AS child_count,
        owner.name AS owner_label,
        snap.score,
        snap.band,
        snap.override_band,
        snap.override_until,
        snap.as_of AS snap_as_of,
        nxt.title AS next_action,
        '[]'::json AS contracts
      FROM crm_am_account_ext e
      INNER JOIN clients c ON c.id = e.agency_client_id
      LEFT JOIN clients parent ON parent.id = e.parent_agency_client_id
      LEFT JOIN crm_staff owner ON owner.id = e.account_owner_staff_id
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS child_count
        FROM crm_am_account_ext ch
        WHERE ch.parent_agency_client_id = e.agency_client_id
      ) child ON TRUE
      LEFT JOIN LATERAL (
        SELECT h.score, h.band, h.override_band, h.override_until, h.as_of
        FROM crm_am_health_snapshots h
        WHERE h.tenant_id = $1
          AND h.agency_client_id = e.agency_client_id
          AND h.as_of <= $2::date
        ORDER BY h.as_of DESC
        LIMIT 1
      ) snap ON TRUE
      LEFT JOIN LATERAL (
        SELECT t.title
        FROM crm_am_tasks t
        WHERE t.agency_client_id = e.agency_client_id
          AND t.status NOT IN ('closed', 'cancelled', 'resolved')
          AND t.dismissed_at IS NULL
        ORDER BY t.due_at NULLS LAST, t.created_at
        LIMIT 1
      ) nxt ON TRUE
      WHERE e.tenant_id = $1
        AND ${bound.sql}`;
    try {
      const result = await this.db.query(sql, [AM_TENANT_ID, asOf, ...bound.params]);
      return result.rows.map(mapBookRow);
    } catch (err) {
      if (isMissingRelation(err)) return [];
      throw err;
    }
  }

  private async loadTodayWork(
    staffId: number,
    scope: AmScope,
    teamIds: number[],
    now: Date,
  ): Promise<AmCommandCenter['today_work']> {
    const bound = bindScopeSql(amScopeSql({ scope, staffId, teamIds }), 2);
    const sql = `
      SELECT
        t.id::text AS id,
        t.due_at,
        t.title,
        COALESCE(c.name, '') AS account_name,
        t.sla_resolve_due_at,
        t.assignee_staff_id
      FROM crm_am_tasks t
      INNER JOIN crm_am_account_ext e ON e.agency_client_id = t.agency_client_id AND e.tenant_id = $1
      LEFT JOIN clients c ON c.id = t.agency_client_id
      WHERE t.tenant_id = $1
        AND t.status NOT IN ('closed', 'cancelled', 'resolved')
        AND t.dismissed_at IS NULL
        AND ${bound.sql}
      ORDER BY t.due_at NULLS LAST, t.created_at
      LIMIT 50`;
    try {
      const result = await this.db.query(sql, [AM_TENANT_ID, ...bound.params]);
      return result.rows.map((row) => mapTodayWork(row, now));
    } catch (err) {
      if (isMissingRelation(err)) return [];
      throw err;
    }
  }

  private async loadSlaOverdue(
    staffId: number,
    scope: AmScope,
    teamIds: number[],
  ): Promise<number | null> {
    const bound = bindScopeSql(amScopeSql({ scope, staffId, teamIds }), 2);
    const sql = `
      SELECT COUNT(*)::int AS n
      FROM csd_tickets t
      INNER JOIN crm_am_account_ext e
        ON e.agency_client_id::text = t.client_account_id
       AND e.tenant_id = $1
      WHERE t.is_deleted = FALSE
        AND t.scope_status = 'in_scope'
        AND t.sla_status = 'breached'
        AND ${bound.sql}`;
    try {
      const result = await this.db.query<{ n: number }>(sql, [AM_TENANT_ID, ...bound.params]);
      return Number(result.rows[0]?.n ?? 0);
    } catch (err) {
      if (isMissingRelation(err)) return null;
      throw err;
    }
  }

  private async loadQuota(): Promise<number> {
    try {
      const result = await this.db.query<{ quota_accounts_per_am: number }>(
        `SELECT quota_accounts_per_am FROM crm_am_settings WHERE tenant_id = $1 LIMIT 1`,
        [AM_TENANT_ID],
      );
      return Number(result.rows[0]?.quota_accounts_per_am ?? DEFAULT_QUOTA) || DEFAULT_QUOTA;
    } catch (err) {
      if (isMissingRelation(err)) return DEFAULT_QUOTA;
      throw err;
    }
  }

  private async loadQbrThisWeek(
    staffId: number,
    scope: AmScope,
    teamIds: number[],
    today: string,
  ): Promise<number> {
    const [y, m, d] = today.split('-').map(Number);
    const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    const mondayOffset = dow === 0 ? -6 : 1 - dow;
    const weekStart = addDays(today, mondayOffset);
    const weekEnd = addDays(weekStart, 6);
    const bound = bindScopeSql(amScopeSql({ scope, staffId, teamIds }), 4);
    const sql = `
      SELECT COUNT(*)::int AS n
      FROM crm_am_plans p
      INNER JOIN crm_am_account_ext e ON e.agency_client_id = p.agency_client_id AND e.tenant_id = $1
      WHERE p.tenant_id = $1
        AND p.kind = 'qbr'
        AND p.status = 'open'
        AND p.due_on BETWEEN $2::date AND $3::date
        AND ${bound.sql}`;
    try {
      const result = await this.db.query<{ n: number }>(sql, [
        AM_TENANT_ID,
        weekStart,
        weekEnd,
        ...bound.params,
      ]);
      return Number(result.rows[0]?.n ?? 0);
    } catch (err) {
      if (isMissingRelation(err)) return 0;
      throw err;
    }
  }
}

function mapBookRow(row: Record<string, unknown>): BookRow {
  const contractsRaw = Array.isArray(row.contracts) ? row.contracts : [];
  return {
    agency_client_id: String(row.agency_client_id),
    am_status: String(row.am_status ?? 'active'),
    account_owner_staff_id: num(row.account_owner_staff_id),
    backup_staff_id: num(row.backup_staff_id),
    team_id: num(row.team_id),
    parent_agency_client_id: row.parent_agency_client_id != null ? String(row.parent_agency_client_id) : null,
    name: String(row.name ?? ''),
    parent_name: row.parent_name != null ? String(row.parent_name) : null,
    child_count: Number(row.child_count ?? 0),
    owner_label: row.owner_label != null ? String(row.owner_label) : null,
    score: num(row.score),
    band: row.band != null ? String(row.band) : null,
    override_band: row.override_band != null ? String(row.override_band) : null,
    override_until: dayStr(row.override_until),
    snap_as_of: row.snap_as_of != null ? String(row.snap_as_of) : null,
    next_action: row.next_action != null ? String(row.next_action) : null,
    contracts: contractsRaw.map((ct) => {
      const c = ct as Record<string, unknown>;
      return {
        id: Number(c.id ?? 0),
        status: String(c.status ?? ''),
        billing_type: String(c.billing_type ?? ''),
        amount_vnd: Number(c.amount_vnd ?? 0),
        starts_on: dayStr(c.starts_on),
        ends_on: dayStr(c.ends_on),
        title: String(c.title ?? ''),
        service_slug: String(c.service_slug ?? ''),
      };
    }),
  };
}

function mapTodayWork(
  row: Record<string, unknown>,
  now: Date,
): AmCommandCenter['today_work'][number] {
  const dueAt = isoTs(row.due_at);
  const assignee = num(row.assignee_staff_id);
  return {
    id: String(row.id),
    due_at: dueAt,
    title: String(row.title ?? ''),
    account_name: String(row.account_name ?? ''),
    sla_label: slaLabel(isoTs(row.sla_resolve_due_at), now),
    chip: todayWorkChip(row.due_at, assignee, now),
    can_accept: assignee == null,
  };
}

function slaLabel(due: string | null, now: Date): string | null {
  if (!due) return null;
  const dueMs = Date.parse(due);
  if (!Number.isFinite(dueMs)) return null;
  if (dueMs < now.getTime()) return 'SLA quá hạn';
  if (dueMs - now.getTime() <= 2 * 60 * 60 * 1000) return 'SLA sắp đến hạn';
  return null;
}

function latestSnapAsOf(book: BookRow[]): string | null {
  let best: string | null = null;
  for (const row of book) {
    const asOf = row.snap_as_of;
    if (!asOf) continue;
    const iso = asOf.length === 10 ? `${asOf}T00:00:00.000Z` : asOf;
    if (!best || iso > best) best = iso;
  }
  return best;
}

function sumRenewal90d(
  active: BookRow[],
  asOf: string,
): { vnd: number | null; count: number | null } {
  const end = addDays(asOf, 90);
  let vnd = 0;
  let count = 0;
  let anyMoney = false;
  for (const row of active) {
    for (const ct of row.contracts) {
      if (contractStatus(ct) !== 'active') continue;
      const ends = dayStr(ct.ends_on);
      if (!ends || ends < asOf || ends > end) continue;
      count += 1;
      const mrr = recurringOf(ct);
      if (mrr != null) {
        vnd += mrr;
        anyMoney = true;
      }
    }
  }
  if (!count) return { vnd: null, count: null };
  return { vnd: anyMoney ? vnd : null, count };
}

function forecastFromBands(active: BookRow[], asOf: string): AmCommandCenter['forecast'] {
  const buckets: Record<'healthy' | 'watch' | 'at_risk' | 'critical', number> = {
    healthy: 0,
    watch: 0,
    at_risk: 0,
    critical: 0,
  };
  let had = false;
  for (const row of active) {
    const band = effectiveBand(row, asOf);
    const mrr = accountMrr(row.contracts);
    if (!band || mrr == null) continue;
    buckets[band] += mrr;
    had = true;
  }
  return {
    committed_vnd: moneyOrNull(buckets.healthy, had),
    likely_vnd: moneyOrNull(buckets.watch, had),
    risk_vnd: moneyOrNull(buckets.at_risk, had),
    unlikely_vnd: moneyOrNull(buckets.critical, had),
  };
}

function coverageOf(active: BookRow[], qbrThisWeek: number): NonNullable<AmCommandCenter['coverage']> {
  const owners = new Map<number, number>();
  let unassigned = 0;
  let delegated = 0;
  for (const row of active) {
    if (row.account_owner_staff_id == null) unassigned += 1;
    else owners.set(row.account_owner_staff_id, (owners.get(row.account_owner_staff_id) ?? 0) + 1);
    if (row.backup_staff_id != null) delegated += 1;
  }
  const loads = [...owners.values()];
  const avg_load = loads.length ? loads.reduce((a, b) => a + b, 0) / loads.length : null;
  return { avg_load, unassigned, delegated, qbr_this_week: qbrThisWeek };
}

function attentionOf(active: BookRow[], asOf: string): AmCommandCenter['attention'] {
  const BAND_RANK: Record<AmHealthBand, number> = { critical: 0, at_risk: 1, watch: 2, healthy: 3 };
  const rows = active
    .map((row) => {
      const band = effectiveBand(row, asOf);
      const ends = earliestEnd(row.contracts);
      const days = ends ? daysBetween(asOf, ends) : null;
      return {
        agency_client_id: row.agency_client_id,
        name: row.name,
        parent_name: row.parent_name,
        band,
        score: row.score,
        mrr_vnd: accountMrr(row.contracts),
        days_to_end: days,
      };
    })
    .filter((row): row is AmCommandCenter['attention'][number] => {
      if (!row.band) return false;
      return row.band === 'at_risk' || row.band === 'critical' || (row.days_to_end != null && row.days_to_end <= 30);
    });
  rows.sort((a, b) => {
    const br = BAND_RANK[a.band] - BAND_RANK[b.band];
    if (br) return br;
    const da = a.days_to_end ?? 9999;
    const db = b.days_to_end ?? 9999;
    if (da !== db) return da - db;
    return (b.mrr_vnd ?? 0) - (a.mrr_vnd ?? 0);
  });
  return rows.slice(0, 20);
}

function healthDistOf(active: BookRow[], asOf: string): AmCommandCenter['health_dist'] {
  const dist = emptyHealth();
  let sum = 0;
  let n = 0;
  for (const row of active) {
    const band = effectiveBand(row, asOf);
    if (band) dist[band] += 1;
    if (row.score != null) {
      sum += row.score;
      n += 1;
    }
  }
  dist.avg = n ? Math.round((sum / n) * 10) / 10 : null;
  return dist;
}

const BOOK_BAND_RANK: Record<AmHealthBand, number> = { critical: 0, at_risk: 1, watch: 2, healthy: 3 };

function myBookOf(active: BookRow[], asOf: string): AmCommandCenter['my_book'] {
  const rows = active.map((row) => {
    const band = effectiveBand(row, asOf);
    return {
      agency_client_id: row.agency_client_id,
      name: row.name,
      is_parent: row.child_count > 0,
      child_count: row.child_count,
      owner_label: row.owner_label ?? 'Chưa gán',
      package_label: packageLabel(row.contracts),
      score: row.score,
      band,
      mrr_vnd: accountMrr(row.contracts),
      ends_on: earliestEnd(row.contracts),
      next_action: row.next_action,
    };
  });
  rows.sort((a, b) => {
    const ar = a.band ? BOOK_BAND_RANK[a.band] : 4;
    const br = b.band ? BOOK_BAND_RANK[b.band] : 4;
    if (ar !== br) return ar - br;
    const ea = a.ends_on ?? '9999-99-99';
    const eb = b.ends_on ?? '9999-99-99';
    return ea.localeCompare(eb);
  });
  return rows;
}
