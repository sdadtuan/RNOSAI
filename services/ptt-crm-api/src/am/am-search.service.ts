import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { AM_TENANT_ID } from './am-audit.repository';
import { amScopeSql, resolveAmScope } from './am-scope.util';
import type { AmScope } from './am.types';

export type AmSearchGroup = 'account' | 'contract' | 'task';

export type AmSearchItem = {
  group: AmSearchGroup;
  id: string;
  title: string;
  subtitle: string | null;
  href: string;
};

export type AmSearchResult = { items: AmSearchItem[] };

export type AmSearchReq = {
  staffUser?: StaffJwtPayload;
  staffAuthVia?: 'internal' | 'jwt';
};

export type AmSearchQuery = { q?: string; scope?: AmScope };

export type AmSearchDb = {
  query(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: Record<string, unknown>[] }>;
};

export type AmSearchRow = {
  group?: string;
  grp?: string;
  id?: string;
  title?: string;
  subtitle?: string | null;
  code?: string | null;
  href?: string;
};

const GROUPS: AmSearchGroup[] = ['account', 'contract', 'task'];

const HREF: Record<AmSearchGroup, (id: string) => string> = {
  account: (id) => `/crm/account-management/clients/${id}`,
  contract: (id) => `/crm/account-management/contracts/${id}`,
  task: (id) => `/crm/account-management/work/${id}`,
};

function isSearchGroup(value: string): value is AmSearchGroup {
  return value === 'account' || value === 'contract' || value === 'task';
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

function rowGroup(row: AmSearchRow): AmSearchGroup | null {
  const g = String(row.group ?? row.grp ?? '');
  return isSearchGroup(g) ? g : null;
}

function isExactCode(code: string | null | undefined, q: string): boolean {
  return (code ?? '').trim().toLowerCase() === q.trim().toLowerCase();
}

export function rankAmSearchItems(rows: AmSearchRow[], q: string): AmSearchItem[] {
  const needle = q.trim();
  const items = rows
    .map((row) => {
      const group = rowGroup(row);
      const id = String(row.id ?? '').trim();
      if (!group || !id) return null;
      const title = String(row.title ?? '');
      const subtitle = row.subtitle == null || row.subtitle === '' ? null : String(row.subtitle);
      const code = row.code == null || row.code === '' ? null : String(row.code);
      return {
        group,
        id,
        title,
        subtitle,
        href: row.href ? String(row.href) : HREF[group](id),
        code,
      };
    })
    .filter((row): row is AmSearchItem & { code: string | null } => row != null);

  items.sort((a, b) => {
    const aExact = a.group === 'account' && isExactCode(a.code, needle) ? 0 : 1;
    const bExact = b.group === 'account' && isExactCode(b.code, needle) ? 0 : 1;
    if (aExact !== bExact) return aExact - bExact;
    const byGroup = GROUPS.indexOf(a.group) - GROUPS.indexOf(b.group);
    if (byGroup !== 0) return byGroup;
    return a.title.localeCompare(b.title, 'vi');
  });

  return items.map(({ code: _code, ...item }) => item);
}

@Injectable()
export class AmSearchRepository implements OnModuleDestroy, AmSearchDb {
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
  ): Promise<{ rows: Record<string, unknown>[] }> {
    return this.db.query(sql, params);
  }
}

@Injectable()
export class AmSearchService {
  constructor(
    private readonly db: AmSearchRepository,
    private readonly staffAuth: StaffAuthService,
  ) {}

  async search(req: AmSearchReq, q: AmSearchQuery): Promise<AmSearchResult> {
    const needle = String(q.q ?? '').trim();
    if (needle.length < 2) return { items: [] };

    const { staffId, scope, teamIds } = await this.resolveActor(req, q.scope);
    const like = `%${needle.replace(/[%_\\]/g, '\\$&')}%`;
    const bound = bindScopeSql(amScopeSql({ scope, staffId, teamIds }), 4);
    const params = [AM_TENANT_ID, needle, like, ...bound.params];

    try {
      const result = await this.db.query(this.searchSql(bound.sql, true), params);
      return { items: rankAmSearchItems(result.rows, needle) };
    } catch (err) {
      if (!isMissingRelation(err)) throw err;
      const result = await this.db.query(this.searchSql(bound.sql, false), params);
      return { items: rankAmSearchItems(result.rows, needle) };
    }
  }

  private searchSql(scopeSql: string, includeContracts: boolean): string {
    const account = `
      SELECT
        'account'::text AS grp,
        e.agency_client_id::text AS id,
        c.name AS title,
        c.code AS subtitle,
        c.code AS code
      FROM crm_am_account_ext e
      INNER JOIN clients c ON c.id = e.agency_client_id
      WHERE e.tenant_id = $1
        AND ${scopeSql}
        AND (c.code ILIKE $2 OR c.name ILIKE $3)`;

    const contract = includeContracts
      ? `
      UNION ALL
      SELECT
        'contract'::text AS grp,
        ct.id::text AS id,
        COALESCE(ct.title, '') AS title,
        c.name AS subtitle,
        NULL::text AS code
      FROM crm_contracts ct
      INNER JOIN crm_am_account_ext e
        ON TRIM(COALESCE(ct.agency_client_id, '')) = e.agency_client_id::text
      INNER JOIN clients c ON c.id = e.agency_client_id
      WHERE e.tenant_id = $1
        AND ${scopeSql}
        AND ct.title ILIKE $3`
      : '';

    const task = `
      UNION ALL
      SELECT
        'task'::text AS grp,
        t.id::text AS id,
        t.title AS title,
        c.name AS subtitle,
        NULL::text AS code
      FROM crm_am_tasks t
      INNER JOIN crm_am_account_ext e ON t.agency_client_id = e.agency_client_id
      INNER JOIN clients c ON c.id = e.agency_client_id
      WHERE e.tenant_id = $1
        AND ${scopeSql}
        AND t.dismissed_at IS NULL
        AND t.status NOT IN ('closed', 'cancelled')
        AND t.title ILIKE $3`;

    return `
      SELECT grp, id, title, subtitle, code
      FROM (${account}${contract}${task}) hits
      ORDER BY CASE WHEN code ILIKE $2 THEN 0 ELSE 1 END, title
      LIMIT 40`;
  }

  private async resolveActor(
    req: AmSearchReq,
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
