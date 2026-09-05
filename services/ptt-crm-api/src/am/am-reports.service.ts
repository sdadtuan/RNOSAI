import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { AM_TENANT_ID } from './am-audit.repository';
import { monthlyRecurringVnd } from './am-money.util';
import {
  amBuildRetention,
  amIsExpandKind,
  type AmReportsClient,
  type AmReportsContract,
  type AmReportsForecastInput,
  type AmReportsLostRenewal,
  type AmReportsRetention,
  type AmReportsWonOpp,
} from './am-reports.util';
import { amScopeSql, resolveAmScope } from './am-scope.util';
import type { AmScope } from './am.types';

export type AmReportsReq = {
  staffUser?: StaffJwtPayload;
  staffAuthVia?: 'internal' | 'jwt';
};

export type AmReportsQuery = { from?: string; to?: string; scope?: AmScope };

const ICT = 'Asia/Ho_Chi_Minh';
const FORECAST_BUCKETS = ['committed', 'likely', 'risk', 'unlikely'] as const;

export const AM_REPORTS_CLIENTS_JOIN = 'INNER JOIN clients c ON c.id = e.agency_client_id';

export function amReportsBookSql(boundSql: string): string {
  return `
      SELECT
        e.agency_client_id::text AS agency_client_id,
        e.account_owner_staff_id,
        e.am_status,
        e.churned_at,
        e.churn_reason,
        COALESCE(cts.contracts, '[]'::json) AS contracts
      FROM crm_am_account_ext e
      ${AM_REPORTS_CLIENTS_JOIN}
      LEFT JOIN LATERAL (
        SELECT json_agg(json_build_object(
          'billing_type', ct.billing_type,
          'amount_vnd', ct.amount_vnd,
          'starts_on', ct.starts_on,
          'ends_on', ct.ends_on,
          'status', ct.status
        )) AS contracts
        FROM crm_contracts ct
        WHERE TRIM(COALESCE(ct.agency_client_id, '')) = e.agency_client_id::text
      ) cts ON TRUE
      WHERE e.tenant_id = $1
        AND ${boundSql}`;
}

export function amReportsBookWithoutContractsSql(boundSql: string): string {
  return `
      SELECT
        e.agency_client_id::text AS agency_client_id,
        e.account_owner_staff_id,
        e.am_status,
        e.churned_at,
        e.churn_reason,
        '[]'::json AS contracts
      FROM crm_am_account_ext e
      ${AM_REPORTS_CLIENTS_JOIN}
      WHERE e.tenant_id = $1
        AND ${boundSql}`;
}

export type AmReportsStore = {
  loadBook(staffId: number, scope: AmScope, teamIds: number[]): Promise<AmReportsClient[]>;
  loadWonExpandOpps(
    staffId: number,
    scope: AmScope,
    teamIds: number[],
    period: { from: string; to: string },
  ): Promise<AmReportsWonOpp[]>;
  loadLostRenewals(
    staffId: number,
    scope: AmScope,
    teamIds: number[],
    period: { from: string; to: string },
  ): Promise<AmReportsLostRenewal[]>;
  loadForecast(
    staffId: number,
    scope: AmScope,
    teamIds: number[],
  ): Promise<AmReportsForecastInput[]>;
  loadFreshnessAsOf(staffId: number, scope: AmScope, teamIds: number[]): Promise<string | null>;
  loadTeamIds(staffId: number): Promise<number[]>;
};

@Injectable()
export class AmReportsRepository implements OnModuleDestroy, AmReportsStore {
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

  async loadBook(staffId: number, scope: AmScope, teamIds: number[]): Promise<AmReportsClient[]> {
    const bound = bindScopeSql(amScopeSql({ scope, staffId, teamIds }), 2);
    const sql = amReportsBookSql(bound.sql);
    try {
      const result = await this.db.query(sql, [AM_TENANT_ID, ...bound.params]);
      return result.rows.map(mapBookRow);
    } catch (err) {
      if (!isMissingRelation(err)) throw err;
      return this.loadBookWithoutContracts(staffId, scope, teamIds);
    }
  }

  private async loadBookWithoutContracts(
    staffId: number,
    scope: AmScope,
    teamIds: number[],
  ): Promise<AmReportsClient[]> {
    const bound = bindScopeSql(amScopeSql({ scope, staffId, teamIds }), 2);
    const sql = amReportsBookWithoutContractsSql(bound.sql);
    try {
      const result = await this.db.query(sql, [AM_TENANT_ID, ...bound.params]);
      return result.rows.map(mapBookRow);
    } catch (err) {
      if (isMissingRelation(err)) return [];
      throw err;
    }
  }

  async loadWonExpandOpps(
    staffId: number,
    scope: AmScope,
    teamIds: number[],
    period: { from: string; to: string },
  ): Promise<AmReportsWonOpp[]> {
    const bound = bindScopeSql(amScopeSql({ scope, staffId, teamIds }), 4);
    const sql = `
      SELECT
        o.agency_client_id::text AS agency_client_id,
        o.kind,
        o.value_vnd
      FROM crm_am_opportunities o
      INNER JOIN crm_am_account_ext e
              ON e.agency_client_id = o.agency_client_id
             AND e.tenant_id = o.tenant_id
      WHERE o.tenant_id = $1
        AND o.stage = 'won'
        AND o.won_at::date > $2::date
        AND o.won_at::date <= $3::date
        AND ${bound.sql}`;
    try {
      const result = await this.db.query(sql, [AM_TENANT_ID, period.from, period.to, ...bound.params]);
      return result.rows
        .map((row) => ({
          agency_client_id: String(row.agency_client_id),
          kind: row.kind != null ? String(row.kind) : null,
          value_vnd: num(row.value_vnd),
        }))
        .filter((row) => amIsExpandKind(row.kind));
    } catch (err) {
      if (isMissingRelation(err)) return [];
      throw err;
    }
  }

  async loadLostRenewals(
    staffId: number,
    scope: AmScope,
    teamIds: number[],
    period: { from: string; to: string },
  ): Promise<AmReportsLostRenewal[]> {
    const bound = bindScopeSql(amScopeSql({ scope, staffId, teamIds }), 4);
    const sql = `
      SELECT
        rc.agency_client_id::text AS agency_client_id,
        rc.lost_on,
        rc.lost_reason
      FROM crm_am_renewal_cases rc
      INNER JOIN crm_am_account_ext e
              ON e.agency_client_id = rc.agency_client_id
             AND e.tenant_id = rc.tenant_id
      WHERE rc.tenant_id = $1
        AND rc.status = 'lost'
        AND rc.lost_on > $2::date
        AND rc.lost_on <= $3::date
        AND ${bound.sql}`;
    try {
      const result = await this.db.query(sql, [AM_TENANT_ID, period.from, period.to, ...bound.params]);
      return result.rows.map((row) => ({
        agency_client_id: String(row.agency_client_id),
        lost_on: dayStr(row.lost_on),
        lost_reason: row.lost_reason != null ? String(row.lost_reason) : null,
      }));
    } catch (err) {
      if (isMissingRelation(err)) return [];
      throw err;
    }
  }

  async loadForecast(
    staffId: number,
    scope: AmScope,
    teamIds: number[],
  ): Promise<AmReportsForecastInput[]> {
    const bound = bindScopeSql(amScopeSql({ scope, staffId, teamIds }), 2);
    const sql = `
      SELECT
        rc.forecast,
        ct.billing_type,
        ct.amount_vnd,
        ct.starts_on,
        ct.ends_on
      FROM crm_am_renewal_cases rc
      INNER JOIN crm_am_account_ext e
              ON e.agency_client_id = rc.agency_client_id
             AND e.tenant_id = rc.tenant_id
      LEFT JOIN crm_contracts ct ON ct.id = rc.contract_id
      WHERE rc.tenant_id = $1
        AND rc.forecast IN ('committed', 'likely', 'risk', 'unlikely')
        AND ${bound.sql}`;
    try {
      const result = await this.db.query(sql, [AM_TENANT_ID, ...bound.params]);
      if (!result.rows.length) return [];
      const buckets: Record<(typeof FORECAST_BUCKETS)[number], { value: number; had: boolean }> = {
        committed: { value: 0, had: false },
        likely: { value: 0, had: false },
        risk: { value: 0, had: false },
        unlikely: { value: 0, had: false },
      };
      for (const row of result.rows) {
        const bucket = String(row.forecast ?? '') as (typeof FORECAST_BUCKETS)[number];
        if (!buckets[bucket]) continue;
        const mrr = monthlyRecurringVnd({
          billingType: String(row.billing_type ?? '').trim().toLowerCase(),
          amountVnd: Number(row.amount_vnd ?? 0),
          startsOn: dayStr(row.starts_on),
          endsOn: dayStr(row.ends_on),
        });
        if (mrr == null) continue;
        buckets[bucket].value += mrr;
        buckets[bucket].had = true;
      }
      const out = FORECAST_BUCKETS.map((bucket) => ({
        bucket,
        value_vnd: buckets[bucket].had ? buckets[bucket].value : null,
      }));
      return out.some((row) => row.value_vnd != null) ? out : [];
    } catch (err) {
      if (isMissingRelation(err)) return [];
      throw err;
    }
  }

  async loadTeamIds(staffId: number): Promise<number[]> {
    if (staffId <= 0) return [];
    try {
      const result = await this.db.query<{ id: number }>(
        `SELECT t.id
           FROM crm_staff cs
           JOIN staff_users u ON lower(trim(u.email)) = lower(trim(cs.email))
           JOIN staff_user_teams sut ON sut.user_id = u.id
           JOIN staff_teams t ON t.id = sut.team_id AND t.active IS TRUE
          WHERE cs.id = $1`,
        [staffId],
      );
      return result.rows.map((row) => Number(row.id)).filter((n) => Number.isFinite(n) && n > 0);
    } catch (err) {
      if (isMissingRelation(err)) return [];
      throw err;
    }
  }

  async loadFreshnessAsOf(
    staffId: number,
    scope: AmScope,
    teamIds: number[],
  ): Promise<string | null> {
    const bound = bindScopeSql(amScopeSql({ scope, staffId, teamIds }), 2);
    const sql = `
      SELECT MAX(h.as_of) AS as_of
        FROM crm_am_health_snapshots h
        INNER JOIN crm_am_account_ext e
                ON e.agency_client_id = h.agency_client_id
               AND e.tenant_id = h.tenant_id
       WHERE h.tenant_id = $1
         AND ${bound.sql}`;
    try {
      const result = await this.db.query<{ as_of: unknown }>(sql, [AM_TENANT_ID, ...bound.params]);
      const raw = result.rows[0]?.as_of;
      if (raw == null) return null;
      if (raw instanceof Date) return raw.toISOString();
      const s = String(raw);
      return s.length === 10 ? `${s}T00:00:00.000Z` : s;
    } catch (err) {
      if (isMissingRelation(err)) return null;
      throw err;
    }
  }
}

@Injectable()
export class AmReportsService {
  constructor(
    private readonly db: AmReportsRepository,
    private readonly staffAuth: StaffAuthService,
  ) {}

  async retention(req: AmReportsReq, q: AmReportsQuery): Promise<AmReportsRetention> {
    const now = new Date();
    const period = {
      from: parseDay(q.from, ictYearStart(now)),
      to: parseDay(q.to, ictYmd(now)),
    };
    const actor = await this.resolveActor(req, q.scope);
    const [clients, wonExpandOpps, lostRenewals, forecast, freshnessAsOf] = await Promise.all([
      this.db.loadBook(actor.staffId, actor.scope, actor.teamIds),
      this.db.loadWonExpandOpps(actor.staffId, actor.scope, actor.teamIds, period),
      this.db.loadLostRenewals(actor.staffId, actor.scope, actor.teamIds, period),
      this.db.loadForecast(actor.staffId, actor.scope, actor.teamIds),
      this.db.loadFreshnessAsOf(actor.staffId, actor.scope, actor.teamIds),
    ]);
    return amBuildRetention({
      period,
      scope: actor.scope,
      clients,
      wonExpandOpps,
      lostRenewals,
      forecast,
      freshnessAsOf,
      now,
    });
  }

  private async resolveActor(
    req: AmReportsReq,
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
    const teamIds = scope === 'team' ? await this.db.loadTeamIds(staffId) : [];
    return { staffId, scope, teamIds };
  }
}

function mapBookRow(row: Record<string, unknown>): AmReportsClient {
  const contractsRaw = Array.isArray(row.contracts) ? row.contracts : [];
  return {
    agency_client_id: String(row.agency_client_id),
    owner_staff_id: num(row.account_owner_staff_id),
    am_status: String(row.am_status ?? 'active'),
    churned_at: dayStr(row.churned_at),
    churn_reason: row.churn_reason != null ? String(row.churn_reason) : null,
    contracts: contractsRaw.map((ct) => {
      const c = ct as Record<string, unknown>;
      return {
        billing_type: String(c.billing_type ?? ''),
        amount_vnd: Number(c.amount_vnd ?? 0),
        starts_on: dayStr(c.starts_on),
        ends_on: dayStr(c.ends_on),
        status: String(c.status ?? ''),
      } satisfies AmReportsContract;
    }),
  };
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

function ictYmd(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ICT,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

function ictYearStart(now = new Date()): string {
  return `${ictYmd(now).slice(0, 4)}-01-01`;
}

function parseDay(raw: string | undefined, fallback: string): string {
  return raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : fallback;
}

function dayStr(value: unknown): string | null {
  if (value == null || value === '') return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const s = String(value);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

function num(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function isMissingRelation(err: unknown): boolean {
  const e = err as { code?: string; message?: string };
  return e.code === '42P01' || /does not exist/i.test(e.message ?? '');
}
