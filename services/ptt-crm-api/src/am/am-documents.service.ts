import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { AM_TENANT_ID } from './am-audit.repository';
import { amThrow } from './am-http';
import { amScopeSql, resolveAmScope } from './am-scope.util';
import { isUuid } from './am-tasks.service';
import type { AmScope } from './am.types';

export type AmDocument = {
  id: string;
  agency_client_id: string;
  contract_id: number | null;
  onboarding_case_id: string | null;
  interaction_id: string | null;
  title: string;
  kind: 'link';
  href: string;
  created_by_staff_id: number | null;
  created_at: string;
};

export type AmCreateDocumentInput = {
  agency_client_id: string;
  title?: string;
  href?: string;
  contract_id?: number;
  onboarding_case_id?: string;
  interaction_id?: string;
};

export type AmDocumentsListQuery = {
  agency_client_id?: string;
  contract_id?: string | number;
  onboarding_case_id?: string;
  scope?: AmScope;
};

export type AmDocumentsReq = {
  staffUser?: StaffJwtPayload;
  staffAuthVia?: 'internal' | 'jwt';
};

export type AmDocumentsDb = {
  query(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: Record<string, unknown>[]; rowCount?: number | null }>;
};

export type AmDocumentsFilter = {
  agency_client_id: string;
  contract_id?: number;
  onboarding_case_id?: string;
};

const DOCUMENT_COLS = `
  d.id::text AS id,
  d.agency_client_id::text AS agency_client_id,
  d.contract_id,
  d.onboarding_case_id::text AS onboarding_case_id,
  d.interaction_id::text AS interaction_id,
  d.title,
  d.kind,
  d.href,
  d.created_by_staff_id,
  d.created_at
`;

const DOCUMENT_RETURNING = `
  id::text AS id,
  agency_client_id::text AS agency_client_id,
  contract_id,
  onboarding_case_id::text AS onboarding_case_id,
  interaction_id::text AS interaction_id,
  title,
  kind,
  href,
  created_by_staff_id,
  created_at
`;

export function isSafeAmDocumentHref(raw: string): boolean {
  const href = raw.trim();
  if (href.startsWith('/') && !href.startsWith('//')) return href.length > 1;
  try {
    const u = new URL(href);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

export function mapAmDocument(row: Record<string, unknown>): AmDocument {
  return {
    id: String(row.id ?? ''),
    agency_client_id: String(row.agency_client_id ?? ''),
    contract_id: row.contract_id == null || row.contract_id === '' ? null : Number(row.contract_id),
    onboarding_case_id:
      row.onboarding_case_id == null || row.onboarding_case_id === ''
        ? null
        : String(row.onboarding_case_id),
    interaction_id:
      row.interaction_id == null || row.interaction_id === '' ? null : String(row.interaction_id),
    title: String(row.title ?? ''),
    kind: 'link',
    href: String(row.href ?? ''),
    created_by_staff_id: row.created_by_staff_id == null ? null : Number(row.created_by_staff_id),
    created_at: iso(row.created_at),
  };
}

export async function listAmDocuments(
  db: AmDocumentsDb,
  filter: AmDocumentsFilter,
): Promise<AmDocument[]> {
  const clientId = String(filter.agency_client_id ?? '').trim();
  if (!clientId || !isUuid(clientId)) return [];
  const params: unknown[] = [AM_TENANT_ID, clientId];
  let sql = `SELECT ${DOCUMENT_COLS.replaceAll('d.', '')}
               FROM crm_am_documents
              WHERE tenant_id = $1
                AND agency_client_id = $2::uuid`;
  if (filter.contract_id != null) {
    params.push(filter.contract_id);
    sql += ` AND contract_id = $${params.length}`;
  }
  if (filter.onboarding_case_id) {
    params.push(filter.onboarding_case_id);
    sql += ` AND onboarding_case_id = $${params.length}::uuid`;
  }
  sql += ' ORDER BY created_at DESC';
  try {
    const result = await db.query(sql, params);
    return result.rows.map(mapAmDocument);
  } catch (err) {
    if (isMissingRelation(err)) return [];
    throw err;
  }
}

@Injectable()
export class AmDocumentsRepository implements OnModuleDestroy, AmDocumentsDb {
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
export class AmDocumentsService {
  constructor(
    private readonly db: AmDocumentsRepository,
    private readonly staffAuth: StaffAuthService,
  ) {}

  async list(
    req: AmDocumentsReq,
    q: AmDocumentsListQuery,
  ): Promise<{ items: AmDocument[] }> {
    const clientId = requireClientId(q.agency_client_id);
    const contractId = optionalContractId(q.contract_id);
    const onboardingCaseId = optionalUuid(q.onboarding_case_id, 'invalid_onboarding_case_id');
    const actor = await this.resolveActor(req, q.scope);

    try {
      await this.requireScopedClient(actor, clientId);
      const params: unknown[] = [AM_TENANT_ID, clientId];
      let sql = `SELECT ${DOCUMENT_COLS}
           FROM crm_am_documents d
           INNER JOIN crm_am_account_ext e
                   ON e.agency_client_id = d.agency_client_id
                  AND e.tenant_id = d.tenant_id
          WHERE d.tenant_id = $1
            AND d.agency_client_id = $2::uuid`;
      if (contractId != null) {
        params.push(contractId);
        sql += ` AND d.contract_id = $${params.length}`;
      }
      if (onboardingCaseId) {
        params.push(onboardingCaseId);
        sql += ` AND d.onboarding_case_id = $${params.length}::uuid`;
      }
      const bound = bindScopeSql(
        amScopeSql({ scope: actor.scope, staffId: actor.staffId, teamIds: actor.teamIds }),
        params.length + 1,
      );
      sql += ` AND ${bound.sql} ORDER BY d.created_at DESC`;
      params.push(...bound.params);
      const result = await this.db.query(sql, params);
      return { items: result.rows.map(mapAmDocument) };
    } catch (err) {
      if (isMissingRelation(err)) return { items: [] };
      throw err;
    }
  }

  async listLinked(filter: AmDocumentsFilter): Promise<AmDocument[]> {
    return listAmDocuments(this.db, filter);
  }

  async create(body: AmCreateDocumentInput, staffId: number): Promise<AmDocument> {
    const clientId = requireClientId(body.agency_client_id);
    const title = String(body.title ?? '').trim();
    if (!title || title.length > 200) amThrow(400, { error: 'invalid_title' });
    const href = String(body.href ?? '').trim();
    if (!isSafeAmDocumentHref(href)) amThrow(400, { error: 'invalid_href' });
    const contractId = optionalContractId(body.contract_id);
    const onboardingCaseId = optionalUuid(body.onboarding_case_id, 'invalid_onboarding_case_id');
    const interactionId = optionalUuid(body.interaction_id, 'invalid_interaction_id');

    try {
      const inserted = await this.db.query(
        `INSERT INTO crm_am_documents (
           tenant_id, agency_client_id, contract_id, onboarding_case_id, interaction_id,
           title, kind, href, created_by_staff_id
         ) VALUES ($1, $2::uuid, $3, $4::uuid, $5::uuid, $6, 'link', $7, $8)
         RETURNING ${DOCUMENT_RETURNING}`,
        [
          AM_TENANT_ID,
          clientId,
          contractId,
          onboardingCaseId,
          interactionId,
          title,
          href,
          staffId > 0 ? staffId : null,
        ],
      );
      const row = inserted.rows[0];
      if (!row) amThrow(500, { error: 'insert_failed' });
      return mapAmDocument(row);
    } catch (err) {
      if ((err as { error?: string }).error === 'insert_failed') throw err;
      if (isMissingRelation(err)) amThrow(503, { error: 'documents_table_missing' });
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
    try {
      const result = await this.db.query(
        `SELECT e.agency_client_id::text AS agency_client_id
           FROM crm_am_account_ext e
          WHERE e.tenant_id = $1
            AND e.agency_client_id = $2::uuid
            AND ${bound.sql}
          LIMIT 1`,
        [AM_TENANT_ID, clientId, ...bound.params],
      );
      if (!result.rows[0]) amThrow(404, { error: 'not_found' });
    } catch (err) {
      if ((err as { error?: string }).error === 'not_found') throw err;
      if (isMissingRelation(err)) throw err;
      throw err;
    }
  }

  private async resolveActor(
    req: AmDocumentsReq,
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

function optionalUuid(raw: string | undefined, error: string): string | null {
  if (raw == null || String(raw).trim() === '') return null;
  const value = String(raw).trim();
  if (!isUuid(value)) amThrow(400, { error });
  return value;
}

function optionalContractId(raw: number | string | undefined): number | null {
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) amThrow(400, { error: 'invalid_contract_id' });
  return n;
}

function iso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  const s = String(value ?? '');
  const t = Date.parse(s);
  return Number.isFinite(t) ? new Date(t).toISOString() : s;
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
