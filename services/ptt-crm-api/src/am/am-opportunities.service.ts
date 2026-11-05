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

export const AM_OPP_STAGES = ['qualify', 'propose', 'negotiate', 'won', 'lost'] as const;
export type AmOppStage = (typeof AM_OPP_STAGES)[number];
export const AM_OPP_OPEN_STAGES: AmOppStage[] = ['qualify', 'propose', 'negotiate'];

export type AmOpportunityRow = {
  id: string;
  agency_client_id: string;
  account_name: string | null;
  title: string;
  kind: string | null;
  package: string | null;
  value_vnd: number | null;
  probability: number | null;
  stage: AmOppStage;
  next_step: string;
  source: string;
  ai_evidence_json: unknown;
  won_at: string | null;
  lost_at: string | null;
  created_at: string;
};

export type AmCreateOpportunityInput = {
  agency_client_id?: string;
  title?: string;
  kind?: string | null;
  package?: string | null;
  value_vnd?: number | null;
  probability?: number | null;
  stage?: string;
  next_step?: string;
  source?: string;
  ai_evidence_json?: unknown;
};

export type AmPatchOpportunityInput = {
  title?: string;
  kind?: string | null;
  package?: string | null;
  value_vnd?: number | null;
  probability?: number | null;
  stage?: string;
  next_step?: string;
  source?: string;
  ai_evidence_json?: unknown;
};

export type AmOpportunitiesListQuery = {
  agency_client_id?: string;
  scope?: AmScope;
  stage?: string;
};

export type AmOpportunitiesReq = {
  staffUser?: StaffJwtPayload;
  staffAuthVia?: 'internal' | 'jwt';
};

export type AmOpportunityKpis = {
  pipeline_vnd: number | null;
  weighted_vnd: number | null;
  won_month_vnd: number | null;
};

export type AmOpportunitiesList = {
  items: AmOpportunityRow[];
  kpis: AmOpportunityKpis;
  suggestions: [];
};

export type AmOpportunitiesDb = {
  query(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: Record<string, unknown>[]; rowCount?: number | null }>;
};

const ICT = 'Asia/Ho_Chi_Minh';

const OPP_COLS = `
  o.id::text AS id,
  o.agency_client_id::text AS agency_client_id,
  NULLIF(TRIM(COALESCE(c.name, '')), '') AS account_name,
  o.title,
  o.kind,
  o.package,
  o.value_vnd,
  o.probability,
  o.stage,
  o.next_step,
  o.source,
  o.ai_evidence_json,
  o.won_at,
  o.lost_at,
  o.created_at
`;

const OPP_RETURNING = `
  id::text AS id,
  agency_client_id::text AS agency_client_id,
  title,
  kind,
  package,
  value_vnd,
  probability,
  stage,
  next_step,
  source,
  ai_evidence_json,
  won_at,
  lost_at,
  created_at
`;

@Injectable()
export class AmOpportunitiesRepository implements OnModuleDestroy, AmOpportunitiesDb {
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
export class AmOpportunitiesService {
  constructor(
    private readonly db: AmOpportunitiesRepository,
    private readonly staffAuth: StaffAuthService,
    private readonly audit: AmAuditRepository,
  ) {}

  async list(req: AmOpportunitiesReq, q: AmOpportunitiesListQuery): Promise<AmOpportunitiesList> {
    const clientId = optionalClientId(q.agency_client_id);
    const stageFilter = q.stage != null && String(q.stage).trim() !== '' ? parseStage(q.stage) : null;
    const actor = await this.resolveActor(req, q.scope);
    if (clientId) await this.requireScopedClient(actor, clientId);

    const params: unknown[] = [AM_TENANT_ID];
    let sql = `SELECT ${OPP_COLS}
           FROM crm_am_opportunities o
           INNER JOIN crm_am_account_ext e
                   ON e.agency_client_id = o.agency_client_id
                  AND e.tenant_id = o.tenant_id
           LEFT JOIN clients c ON c.id = o.agency_client_id
          WHERE o.tenant_id = $1`;
    if (clientId) {
      params.push(clientId);
      sql += ` AND o.agency_client_id = $${params.length}::uuid`;
    }
    const bound = bindScopeSql(
      amScopeSql({ scope: actor.scope, staffId: actor.staffId, teamIds: actor.teamIds }),
      params.length + 1,
    );
    sql += ` AND ${bound.sql} ORDER BY o.created_at DESC`;
    params.push(...bound.params);

    let rows: AmOpportunityRow[] = [];
    try {
      const result = await this.db.query(sql, params);
      rows = result.rows.map(mapOpp);
    } catch (err) {
      if (isMissingRelation(err)) {
        return { items: [], kpis: emptyKpis(), suggestions: [] };
      }
      throw err;
    }

    const kpis = computeKpis(rows);
    const items = stageFilter ? rows.filter((row) => row.stage === stageFilter) : rows;
    return { items, kpis, suggestions: [] };
  }

  async create(
    req: AmOpportunitiesReq,
    body: AmCreateOpportunityInput,
    staffId: number,
  ): Promise<AmOpportunityRow> {
    const clientId = requireClientId(body.agency_client_id);
    const title = String(body.title ?? '').trim();
    if (!title) amThrow(400, { error: 'title_required' });
    const nextStep = String(body.next_step ?? '').trim();
    if (!nextStep) amThrow(400, { error: 'next_step_required' });
    const stage = parseStage(body.stage ?? 'qualify');
    const source = String(body.source ?? '').trim() || 'manual';
    const valueVnd = optionalMoney(body.value_vnd);
    const probability = optionalProbability(body.probability);
    const kind = emptyToNull(body.kind);
    const pkg = emptyToNull(body.package);
    const evidence = body.ai_evidence_json ?? null;

    await this.requireConvertedClient(clientId);
    const actor = await this.resolveActor(req, undefined);
    await this.requireScopedClient(actor, clientId);

    const inserted = await this.db.query(
      `INSERT INTO crm_am_opportunities (
         tenant_id, agency_client_id, title, kind, package, value_vnd, probability,
         stage, next_step, source, ai_evidence_json, won_at, lost_at
       ) VALUES (
         $1, $2::uuid, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb,
         CASE WHEN $8 = 'won' THEN now() ELSE NULL END,
         CASE WHEN $8 = 'lost' THEN now() ELSE NULL END
       )
       RETURNING ${OPP_RETURNING}`,
      [
        AM_TENANT_ID,
        clientId,
        title,
        kind,
        pkg,
        valueVnd,
        probability,
        stage,
        nextStep,
        source,
        evidence == null ? null : JSON.stringify(evidence),
      ],
    );
    const row = inserted.rows[0];
    if (!row) amThrow(500, { error: 'insert_failed' });
    const mapped = mapOpp(row);
    await this.audit.insert({
      actor_staff_id: staffId > 0 ? staffId : null,
      action: 'opportunity.create',
      entity_type: 'opportunity',
      entity_id: mapped.id,
      payload_json: { agency_client_id: clientId, title, stage },
    });
    return mapped;
  }

  async patch(
    req: AmOpportunitiesReq,
    id: string,
    body: AmPatchOpportunityInput,
    _staffId: number,
  ): Promise<AmOpportunityRow> {
    const oppId = String(id ?? '').trim();
    if (!isUuid(oppId)) amThrow(400, { error: 'invalid_opportunity_id' });
    if (body.stage != null && String(body.stage).trim() !== '') {
      parseStage(body.stage);
    }
    const actor = await this.resolveActor(req, undefined);
    const current = await this.loadOne(actor, oppId);

    const title =
      body.title !== undefined ? String(body.title ?? '').trim() : current.title;
    if (!title) amThrow(400, { error: 'title_required' });
    const nextStep =
      body.next_step !== undefined ? String(body.next_step ?? '').trim() : current.next_step;
    if (!nextStep) amThrow(400, { error: 'next_step_required' });
    const stage = body.stage !== undefined ? parseStage(body.stage) : current.stage;
    const source =
      body.source !== undefined ? String(body.source ?? '').trim() || 'manual' : current.source;
    const valueVnd =
      body.value_vnd !== undefined ? optionalMoney(body.value_vnd) : current.value_vnd;
    const probability =
      body.probability !== undefined ? optionalProbability(body.probability) : current.probability;
    const kind = body.kind !== undefined ? emptyToNull(body.kind) : current.kind;
    const pkg = body.package !== undefined ? emptyToNull(body.package) : current.package;
    const evidence =
      body.ai_evidence_json !== undefined ? body.ai_evidence_json ?? null : current.ai_evidence_json;

    const stamps = stageStamps(current.stage, stage, current.won_at, current.lost_at);

    const updated = await this.db.query(
      `UPDATE crm_am_opportunities
          SET title = $3,
              kind = $4,
              package = $5,
              value_vnd = $6,
              probability = $7,
              stage = $8,
              next_step = $9,
              source = $10,
              ai_evidence_json = $11::jsonb,
              won_at = $12,
              lost_at = $13
        WHERE tenant_id = $1 AND id = $2::uuid
        RETURNING ${OPP_RETURNING}`,
      [
        AM_TENANT_ID,
        oppId,
        title,
        kind,
        pkg,
        valueVnd,
        probability,
        stage,
        nextStep,
        source,
        evidence == null ? null : JSON.stringify(evidence),
        stamps.won_at,
        stamps.lost_at,
      ],
    );
    const row = updated.rows[0];
    if (!row) amThrow(404, { error: 'not_found' });
    return mapOpp(row);
  }

  private async requireConvertedClient(clientId: string): Promise<void> {
    try {
      const found = await this.db.query(`SELECT id::text FROM clients WHERE id = $1::uuid LIMIT 1`, [
        clientId,
      ]);
      if (!found.rows[0]) amThrow(400, { error: 'client_not_found' });
    } catch (err) {
      if ((err as { status?: number }).status === 400) throw err;
      if (isMissingRelation(err)) amThrow(400, { error: 'client_not_found' });
      throw err;
    }
  }

  private async loadOne(
    actor: { scope: AmScope; staffId: number; teamIds: number[] },
    oppId: string,
  ): Promise<AmOpportunityRow> {
    const bound = bindScopeSql(
      amScopeSql({ scope: actor.scope, staffId: actor.staffId, teamIds: actor.teamIds }),
      3,
    );
    try {
      const result = await this.db.query(
        `SELECT ${OPP_COLS}
           FROM crm_am_opportunities o
           INNER JOIN crm_am_account_ext e
                   ON e.agency_client_id = o.agency_client_id
                  AND e.tenant_id = o.tenant_id
           LEFT JOIN clients c ON c.id = o.agency_client_id
          WHERE o.tenant_id = $1
            AND o.id = $2::uuid
            AND ${bound.sql}
          LIMIT 1`,
        [AM_TENANT_ID, oppId, ...bound.params],
      );
      const row = result.rows[0];
      if (!row) amThrow(404, { error: 'not_found' });
      return mapOpp(row);
    } catch (err) {
      if ((err as { status?: number }).status === 404) throw err;
      if (isMissingRelation(err)) amThrow(404, { error: 'not_found' });
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
    const result = await this.db.query(
      `SELECT e.agency_client_id::text
         FROM crm_am_account_ext e
        WHERE e.tenant_id = $1 AND e.agency_client_id = $2::uuid AND ${bound.sql}
        LIMIT 1`,
      [AM_TENANT_ID, clientId, ...bound.params],
    );
    if (!result.rows[0]) amThrow(404, { error: 'not_found' });
  }

  private async resolveActor(
    req: AmOpportunitiesReq,
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

function optionalClientId(raw: string | undefined): string | null {
  if (raw == null || String(raw).trim() === '') return null;
  return requireClientId(raw);
}

function parseStage(raw: string | undefined): AmOppStage {
  const stage = String(raw ?? '').trim();
  if (!(AM_OPP_STAGES as readonly string[]).includes(stage)) {
    amThrow(400, { error: 'invalid_stage' });
  }
  return stage as AmOppStage;
}

function optionalMoney(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) amThrow(400, { error: 'invalid_value_vnd' });
  return n;
}

function optionalProbability(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0 || n > 100) amThrow(400, { error: 'invalid_probability' });
  return n;
}

function emptyToNull(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s || null;
}

function emptyKpis(): AmOpportunityKpis {
  return { pipeline_vnd: null, weighted_vnd: null, won_month_vnd: null };
}

function computeKpis(rows: AmOpportunityRow[]): AmOpportunityKpis {
  let pipeline: number | null = null;
  let weighted: number | null = null;
  let wonMonth: number | null = null;
  const month = ictYearMonth(new Date());
  for (const row of rows) {
    const open = AM_OPP_OPEN_STAGES.includes(row.stage);
    if (open && row.value_vnd != null) {
      pipeline = (pipeline ?? 0) + row.value_vnd;
    }
    if (open && row.value_vnd != null && row.probability != null) {
      weighted = (weighted ?? 0) + (row.value_vnd * row.probability) / 100;
    }
    if (row.won_at && ictYearMonth(row.won_at) === month && row.value_vnd != null) {
      wonMonth = (wonMonth ?? 0) + row.value_vnd;
    }
  }
  return { pipeline_vnd: pipeline, weighted_vnd: weighted, won_month_vnd: wonMonth };
}

function ictYearMonth(value: Date | string): string {
  const d = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ICT,
    year: 'numeric',
    month: '2-digit',
  }).format(d);
}

function stageStamps(
  prev: AmOppStage,
  next: AmOppStage,
  wonAt: string | null,
  lostAt: string | null,
): { won_at: string | null; lost_at: string | null } {
  if (next === 'won') {
    return { won_at: prev === 'won' ? wonAt : new Date().toISOString(), lost_at: null };
  }
  if (next === 'lost') {
    return { lost_at: prev === 'lost' ? lostAt : new Date().toISOString(), won_at: null };
  }
  return { won_at: null, lost_at: null };
}

function mapOpp(row: Record<string, unknown>): AmOpportunityRow {
  return {
    id: String(row.id ?? ''),
    agency_client_id: String(row.agency_client_id ?? ''),
    account_name: emptyToNull(row.account_name),
    title: String(row.title ?? ''),
    kind: emptyToNull(row.kind),
    package: emptyToNull(row.package),
    value_vnd: row.value_vnd == null || row.value_vnd === '' ? null : Number(row.value_vnd),
    probability: row.probability == null || row.probability === '' ? null : Number(row.probability),
    stage: String(row.stage ?? 'qualify') as AmOppStage,
    next_step: String(row.next_step ?? ''),
    source: String(row.source ?? 'manual'),
    ai_evidence_json: row.ai_evidence_json ?? null,
    won_at: isoOrNull(row.won_at),
    lost_at: isoOrNull(row.lost_at),
    created_at: iso(row.created_at),
  };
}

function isoOrNull(value: unknown): string | null {
  if (value == null || value === '') return null;
  return iso(value);
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
