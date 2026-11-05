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

export type AmRiskSeverity = 'low' | 'medium' | 'high' | 'critical';

export type AmRiskRow = {
  id: string;
  agency_client_id: string;
  category: string;
  severity: AmRiskSeverity;
  probability: number | null;
  impact: number | null;
  evidence: string;
  owner_staff_id: number | null;
  due_on: string | null;
  status: string;
  created_at: string;
};

export type AmRecoveryRow = {
  id: string;
  agency_client_id: string;
  risk_id: string | null;
  goal: string;
  rca: string | null;
  actions: unknown[];
  exit_criteria: string | null;
  outcome: string | null;
  lesson: string | null;
  status: string;
  created_at: string;
};

export type AmCreateRiskInput = {
  agency_client_id?: string;
  category?: string;
  severity?: string;
  probability?: number | null;
  impact?: number | null;
  evidence?: string;
  owner_staff_id?: number | null;
  due_on?: string | null;
};

export type AmCreateRecoveryInput = {
  agency_client_id?: string;
  risk_id?: string | null;
  goal?: string;
  rca?: string | null;
  actions?: unknown[];
  exit_criteria?: string | null;
};

export type AmCloseRecoveryInput = {
  outcome?: string;
  lesson?: string;
};

export type AmRisksListQuery = {
  agency_client_id?: string;
  scope?: AmScope;
};

export type AmRisksReq = {
  staffUser?: StaffJwtPayload;
  staffAuthVia?: 'internal' | 'jwt';
};

export type AmCriticalRecoveryOpts = {
  override_reason?: string;
  manage?: boolean;
};

export type AmRisksDb = {
  query(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: Record<string, unknown>[]; rowCount?: number | null }>;
};

const SEVERITIES: AmRiskSeverity[] = ['low', 'medium', 'high', 'critical'];

const RISK_COLS = `
  r.id::text AS id,
  r.agency_client_id::text AS agency_client_id,
  r.category,
  r.severity,
  r.probability,
  r.impact,
  r.evidence,
  r.owner_staff_id,
  r.due_on,
  r.status,
  r.created_at
`;

const RECOVERY_COLS = `
  p.id::text AS id,
  p.agency_client_id::text AS agency_client_id,
  p.risk_id::text AS risk_id,
  p.goal,
  p.rca,
  p.actions_json,
  p.exit_criteria,
  p.outcome,
  p.lesson,
  p.status,
  p.created_at
`;

const ICT = 'Asia/Ho_Chi_Minh';

@Injectable()
export class AmRisksRepository implements OnModuleDestroy, AmRisksDb {
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
export class AmRisksService {
  constructor(
    private readonly db: AmRisksRepository,
    private readonly staffAuth: StaffAuthService,
    private readonly audit: AmAuditRepository,
  ) {}

  async listRisks(req: AmRisksReq, q: AmRisksListQuery): Promise<{ items: AmRiskRow[] }> {
    const clientId = requireClientId(q.agency_client_id);
    const actor = await this.resolveActor(req, q.scope);
    await this.requireScopedClient(actor, clientId);
    const bound = bindScopeSql(
      amScopeSql({ scope: actor.scope, staffId: actor.staffId, teamIds: actor.teamIds }),
      3,
    );
    try {
      const result = await this.db.query(
        `SELECT ${RISK_COLS}
           FROM crm_am_risks r
           INNER JOIN crm_am_account_ext e
                   ON e.agency_client_id = r.agency_client_id
                  AND e.tenant_id = r.tenant_id
          WHERE r.tenant_id = $1
            AND r.agency_client_id = $2::uuid
            AND ${bound.sql}
          ORDER BY r.created_at DESC`,
        [AM_TENANT_ID, clientId, ...bound.params],
      );
      return { items: result.rows.map(mapRisk) };
    } catch (err) {
      if (isMissingRelation(err)) return { items: [] };
      throw err;
    }
  }

  async createRisk(req: AmRisksReq, body: AmCreateRiskInput, staffId: number): Promise<AmRiskRow> {
    const clientId = requireClientId(body.agency_client_id);
    const category = String(body.category ?? '').trim();
    if (!category) amThrow(400, { error: 'category_required' });
    const severity = String(body.severity ?? '').trim() as AmRiskSeverity;
    if (!SEVERITIES.includes(severity)) amThrow(400, { error: 'invalid_severity' });
    const evidence = String(body.evidence ?? '').trim();
    if (!evidence) amThrow(400, { error: 'evidence_required' });
    const actor = await this.resolveActor(req, undefined);
    await this.requireScopedClient(actor, clientId);
    const inserted = await this.db.query(
      `INSERT INTO crm_am_risks (
         tenant_id, agency_client_id, category, severity, probability, impact,
         evidence, owner_staff_id, due_on, status
       ) VALUES ($1, $2::uuid, $3, $4, $5, $6, $7, $8, $9, 'open')
       RETURNING ${RISK_COLS.replaceAll('r.', '')}`,
      [
        AM_TENANT_ID,
        clientId,
        category,
        severity,
        optionalInt(body.probability, 'invalid_probability'),
        optionalInt(body.impact, 'invalid_impact'),
        evidence,
        optionalStaffId(body.owner_staff_id),
        optionalDate(body.due_on),
      ],
    );
    const row = inserted.rows[0];
    if (!row) amThrow(500, { error: 'insert_failed' });
    const mapped = mapRisk(row);
    await this.audit.insert({
      actor_staff_id: staffId > 0 ? staffId : null,
      action: 'risk.create',
      entity_type: 'risk',
      entity_id: mapped.id,
      payload_json: { agency_client_id: clientId, category, severity },
    });
    return mapped;
  }

  async listRecovery(req: AmRisksReq, q: AmRisksListQuery): Promise<{ items: AmRecoveryRow[] }> {
    const clientId = requireClientId(q.agency_client_id);
    const actor = await this.resolveActor(req, q.scope);
    await this.requireScopedClient(actor, clientId);
    const bound = bindScopeSql(
      amScopeSql({ scope: actor.scope, staffId: actor.staffId, teamIds: actor.teamIds }),
      3,
    );
    try {
      const result = await this.db.query(
        `SELECT ${RECOVERY_COLS}
           FROM crm_am_recovery_plans p
           INNER JOIN crm_am_account_ext e
                   ON e.agency_client_id = p.agency_client_id
                  AND e.tenant_id = p.tenant_id
          WHERE p.tenant_id = $1
            AND p.agency_client_id = $2::uuid
            AND ${bound.sql}
          ORDER BY p.created_at DESC`,
        [AM_TENANT_ID, clientId, ...bound.params],
      );
      return { items: result.rows.map(mapRecovery) };
    } catch (err) {
      if (isMissingRelation(err)) return { items: [] };
      throw err;
    }
  }

  async createRecovery(
    req: AmRisksReq,
    body: AmCreateRecoveryInput,
    staffId: number,
  ): Promise<AmRecoveryRow> {
    const clientId = requireClientId(body.agency_client_id);
    const goal = String(body.goal ?? '').trim();
    if (!goal) amThrow(400, { error: 'goal_required' });
    const riskId = optionalUuid(body.risk_id, 'invalid_risk_id');
    const actor = await this.resolveActor(req, undefined);
    await this.requireScopedClient(actor, clientId);
    if (riskId) {
      await this.requireRiskForClient(clientId, riskId);
    }
    const inserted = await this.db.query(
      `INSERT INTO crm_am_recovery_plans (
         tenant_id, agency_client_id, risk_id, goal, rca, actions_json, exit_criteria, status
       ) VALUES ($1, $2::uuid, $3::uuid, $4, $5, $6::jsonb, $7, 'open')
       RETURNING ${RECOVERY_COLS.replaceAll('p.', '')}`,
      [
        AM_TENANT_ID,
        clientId,
        riskId,
        goal,
        emptyToNull(body.rca),
        JSON.stringify(Array.isArray(body.actions) ? body.actions : []),
        emptyToNull(body.exit_criteria),
      ],
    );
    const row = inserted.rows[0];
    if (!row) amThrow(500, { error: 'insert_failed' });
    const mapped = mapRecovery(row);
    await this.audit.insert({
      actor_staff_id: staffId > 0 ? staffId : null,
      action: 'recovery.create',
      entity_type: 'recovery_plan',
      entity_id: mapped.id,
      payload_json: { agency_client_id: clientId, risk_id: riskId, goal },
    });
    return mapped;
  }

  async close(
    req: AmRisksReq,
    id: string,
    body: AmCloseRecoveryInput,
    staffId: number,
  ): Promise<AmRecoveryRow> {
    const lesson = String(body.lesson ?? '').trim();
    const outcome = String(body.outcome ?? '').trim();
    if (!lesson) amThrow(400, { error: 'lesson_required' });
    if (!outcome) amThrow(400, { error: 'close_fields_required' });
    const planId = String(id ?? '').trim();
    if (!isUuid(planId)) amThrow(400, { error: 'invalid_recovery_id' });
    const actor = await this.resolveActor(req, undefined);
    const current = await this.loadRecovery(actor, planId);
    if (current.status === 'closed') amThrow(409, { error: 'already_closed' });
    const updated = await this.db.query(
      `UPDATE crm_am_recovery_plans
          SET status = 'closed', outcome = $3, lesson = $4
        WHERE tenant_id = $1 AND id = $2::uuid AND status <> 'closed'
      RETURNING ${RECOVERY_COLS.replaceAll('p.', '')}`,
      [AM_TENANT_ID, planId, outcome, lesson],
    );
    const row = updated.rows[0];
    if (!row) amThrow(409, { error: 'already_closed' });
    const mapped = mapRecovery(row);
    await this.audit.insert({
      actor_staff_id: staffId > 0 ? staffId : null,
      action: 'recovery.close',
      entity_type: 'recovery_plan',
      entity_id: mapped.id,
      payload_json: { outcome, lesson },
    });
    return mapped;
  }

  async assertCriticalRecovery(agencyClientId: string, opts: AmCriticalRecoveryOpts = {}): Promise<void> {
    const required = await this.isRecoveryRequired(agencyClientId);
    if (!required) return;
    const reason = String(opts.override_reason ?? '').trim();
    if (opts.manage && reason) return;
    amThrow(409, { error: 'recovery_required' });
  }

  async isRecoveryRequired(agencyClientId: string): Promise<boolean> {
    const clientId = String(agencyClientId ?? '').trim();
    if (!isUuid(clientId)) return false;
    const band = await this.loadEffectiveBand(clientId);
    if (band !== 'critical') return false;
    return !(await this.hasOpenRecovery(clientId));
  }

  private async loadEffectiveBand(clientId: string): Promise<string | null> {
    try {
      const result = await this.db.query(
        `SELECT band, override_band, override_until
           FROM crm_am_health_snapshots
          WHERE tenant_id = $1 AND agency_client_id = $2::uuid
          ORDER BY as_of DESC
          LIMIT 1`,
        [AM_TENANT_ID, clientId],
      );
      const row = result.rows[0];
      if (!row) return null;
      const until = dayStr(row.override_until);
      const overrideBand = row.override_band != null ? String(row.override_band) : '';
      if (overrideBand && until && until >= ictToday()) return overrideBand;
      return row.band != null ? String(row.band) : null;
    } catch (err) {
      if (isMissingRelation(err)) return null;
      throw err;
    }
  }

  private async hasOpenRecovery(clientId: string): Promise<boolean> {
    try {
      const result = await this.db.query(
        `SELECT id::text AS id
           FROM crm_am_recovery_plans
          WHERE tenant_id = $1 AND agency_client_id = $2::uuid AND status = 'open'
          LIMIT 1`,
        [AM_TENANT_ID, clientId],
      );
      return Boolean(result.rows[0]);
    } catch (err) {
      if (isMissingRelation(err)) return false;
      throw err;
    }
  }

  private async loadRecovery(
    actor: { scope: AmScope; staffId: number; teamIds: number[] },
    planId: string,
  ): Promise<AmRecoveryRow> {
    const bound = bindScopeSql(
      amScopeSql({ scope: actor.scope, staffId: actor.staffId, teamIds: actor.teamIds }),
      3,
    );
    try {
      const result = await this.db.query(
        `SELECT ${RECOVERY_COLS}
           FROM crm_am_recovery_plans p
           INNER JOIN crm_am_account_ext e
                   ON e.agency_client_id = p.agency_client_id
                  AND e.tenant_id = p.tenant_id
          WHERE p.tenant_id = $1
            AND p.id = $2::uuid
            AND ${bound.sql}
          LIMIT 1`,
        [AM_TENANT_ID, planId, ...bound.params],
      );
      const row = result.rows[0];
      if (!row) amThrow(404, { error: 'not_found' });
      return mapRecovery(row);
    } catch (err) {
      if (isMissingRelation(err)) amThrow(404, { error: 'not_found' });
      throw err;
    }
  }

  private async requireRiskForClient(clientId: string, riskId: string): Promise<void> {
    try {
      const result = await this.db.query(
        `SELECT id::text AS id
           FROM crm_am_risks
          WHERE tenant_id = $1 AND agency_client_id = $2::uuid AND id = $3::uuid
          LIMIT 1`,
        [AM_TENANT_ID, clientId, riskId],
      );
      if (!result.rows[0]) amThrow(404, { error: 'risk_not_found' });
    } catch (err) {
      if (isMissingRelation(err)) amThrow(404, { error: 'risk_not_found' });
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
    req: AmRisksReq,
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

function optionalUuid(raw: string | null | undefined, error: string): string | null {
  if (raw == null || String(raw).trim() === '') return null;
  const id = String(raw).trim();
  if (!isUuid(id)) amThrow(400, { error });
  return id;
}

function optionalInt(raw: unknown, error: string): number | null {
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  if (!Number.isInteger(n)) amThrow(400, { error });
  return n;
}

function optionalStaffId(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) amThrow(400, { error: 'invalid_owner_staff_id' });
  return n;
}

function optionalDate(raw: unknown): string | null {
  if (raw == null || String(raw).trim() === '') return null;
  const value = String(raw).trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) amThrow(400, { error: 'invalid_due_on' });
  return value;
}

function emptyToNull(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s || null;
}

function dayStr(value: unknown): string | null {
  if (value == null || value === '') return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const s = String(value);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

function ictToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ICT,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function mapRisk(row: Record<string, unknown>): AmRiskRow {
  return {
    id: String(row.id ?? ''),
    agency_client_id: String(row.agency_client_id ?? ''),
    category: String(row.category ?? ''),
    severity: String(row.severity ?? 'medium') as AmRiskSeverity,
    probability: row.probability == null ? null : Number(row.probability),
    impact: row.impact == null ? null : Number(row.impact),
    evidence: String(row.evidence ?? ''),
    owner_staff_id: row.owner_staff_id == null ? null : Number(row.owner_staff_id),
    due_on: dayStr(row.due_on),
    status: String(row.status ?? 'open'),
    created_at: iso(row.created_at),
  };
}

function mapRecovery(row: Record<string, unknown>): AmRecoveryRow {
  return {
    id: String(row.id ?? ''),
    agency_client_id: String(row.agency_client_id ?? ''),
    risk_id: row.risk_id == null || row.risk_id === '' ? null : String(row.risk_id),
    goal: String(row.goal ?? ''),
    rca: emptyToNull(row.rca),
    actions: asActions(row.actions_json ?? row.actions),
    exit_criteria: emptyToNull(row.exit_criteria),
    outcome: emptyToNull(row.outcome),
    lesson: emptyToNull(row.lesson),
    status: String(row.status ?? 'open'),
    created_at: iso(row.created_at),
  };
}

function asActions(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
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
