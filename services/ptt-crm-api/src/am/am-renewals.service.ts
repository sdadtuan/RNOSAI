import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { AmAuditRepository, AM_TENANT_ID } from './am-audit.repository';
import { amThrow } from './am-http';
import { monthlyRecurringVnd } from './am-money.util';
import { amScopeSql, resolveAmScope } from './am-scope.util';
import { isUuid } from './am-tasks.service';
import type { AmHealthBand, AmScope } from './am.types';

export type AmRenewalStatus =
  | 'not_started'
  | 'evaluating'
  | 'negotiating'
  | 'decided'
  | 'renewed'
  | 'lost'
  | 'paused';

export type AmRenewalForecast = 'committed' | 'likely' | 'risk' | 'unlikely';

export type AmRenewalsReq = {
  staffUser?: StaffJwtPayload;
  staffAuthVia?: 'internal' | 'jwt';
};

export type AmRenewalsListQuery = {
  scope?: AmScope;
  window?: string;
};

export type AmRenewalCard = {
  id: string;
  agency_client_id: string;
  name: string;
  owner_label: string;
  status: AmRenewalStatus;
  forecast: AmRenewalForecast | null;
  forecast_pct: number | null;
  next_action: string | null;
  mrr_vnd: number | null;
  days_remaining: number | null;
  score: number | null;
  band: AmHealthBand | null;
  ends_on: string | null;
  contract_id: number;
};

export type AmRenewalColumn = {
  id: string;
  label: string;
  count: number;
  mrr_vnd: number | null;
  items: AmRenewalCard[];
};

export type AmRenewalPipeline = {
  hide_amounts: boolean;
  header: {
    renewable_vnd: number | null;
    weighted_vnd: number | null;
    at_risk_vnd: number | null;
  };
  columns: AmRenewalColumn[];
};

export type AmRenewalCase = AmRenewalCard & {
  hide_amounts: boolean;
  contract_ref: string;
  lost_reason: string | null;
  lost_on: string | null;
  lessons: string | null;
  new_contract_id: number | null;
};

export type AmStartRenewalBody = {
  contract_id?: number;
};

export type AmPatchRenewalBody = {
  status?: string;
  forecast?: string | null;
  forecast_pct?: number | null;
  next_action?: string | null;
  lost_reason?: string;
  lost_on?: string;
  lessons?: string;
  new_contract_id?: number | null;
  recoverable?: boolean;
  override?: boolean;
};

export type AmRenewalsDb = {
  query(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: Record<string, unknown>[]; rowCount?: number | null }>;
};

const ICT = 'Asia/Ho_Chi_Minh';

const STATUSES: AmRenewalStatus[] = [
  'not_started',
  'evaluating',
  'negotiating',
  'decided',
  'renewed',
  'lost',
  'paused',
];

const FORECASTS: AmRenewalForecast[] = ['committed', 'likely', 'risk', 'unlikely'];

const COLUMNS: Array<{ id: string; label: string; statuses: AmRenewalStatus[] }> = [
  { id: 'not_started', label: 'Chưa bắt đầu', statuses: ['not_started'] },
  { id: 'evaluating', label: 'Đang đánh giá', statuses: ['evaluating'] },
  { id: 'negotiating', label: 'Đàm phán', statuses: ['negotiating'] },
  { id: 'decided', label: 'Đã quyết định', statuses: ['decided', 'renewed', 'lost', 'paused'] },
];

const PIPELINE_COLS = `
  rc.id::text AS id,
  TRIM(COALESCE(ct.agency_client_id, '')) AS agency_client_id,
  c.name,
  owner.name AS owner_label,
  COALESCE(rc.status, 'not_started') AS status,
  rc.forecast,
  rc.forecast_pct,
  rc.next_action,
  rc.lost_reason,
  rc.lost_on,
  rc.lessons,
  rc.new_contract_id,
  ct.id AS contract_id,
  ct.reference_code,
  ct.billing_type,
  ct.amount_vnd,
  ct.starts_on,
  ct.ends_on,
  hs.score,
  hs.band
`;

const PIPELINE_FROM = `
  FROM crm_contracts ct
  INNER JOIN crm_am_account_ext e
          ON TRIM(COALESCE(ct.agency_client_id, '')) = e.agency_client_id::text
         AND e.tenant_id = $1
  INNER JOIN clients c ON c.id = e.agency_client_id
  LEFT JOIN crm_staff owner ON owner.id = e.account_owner_staff_id
  LEFT JOIN LATERAL (
    SELECT r.id, r.status, r.forecast, r.forecast_pct, r.next_action,
           r.lost_reason, r.lost_on, r.lessons, r.new_contract_id
      FROM crm_am_renewal_cases r
     WHERE r.tenant_id = $1 AND r.contract_id = ct.id
     ORDER BY (r.status NOT IN ('renewed', 'lost')) DESC, r.updated_at DESC
     LIMIT 1
  ) rc ON TRUE
  LEFT JOIN LATERAL (
    SELECT h.score, h.band
      FROM crm_am_health_snapshots h
     WHERE h.tenant_id = $1 AND h.agency_client_id = e.agency_client_id
     ORDER BY h.as_of DESC
     LIMIT 1
  ) hs ON TRUE
`;

@Injectable()
export class AmRenewalsRepository implements OnModuleDestroy, AmRenewalsDb {
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
export class AmRenewalsService {
  constructor(
    private readonly db: AmRenewalsRepository,
    private readonly staffAuth: StaffAuthService,
    private readonly audit: AmAuditRepository,
  ) {}

  async list(req: AmRenewalsReq, q: AmRenewalsListQuery): Promise<AmRenewalPipeline> {
    const hideAmounts = await this.shouldHideAmounts(req);
    const actor = await this.resolveActor(req, q.scope);
    const windowDays = parseWindow(q.window);
    const today = ictYmd();
    const until = addDaysYmd(today, windowDays);
    const bound = bindScopeSql(
      amScopeSql({ scope: actor.scope, staffId: actor.staffId, teamIds: actor.teamIds }),
      4,
    );
    let rows: Record<string, unknown>[] = [];
    try {
      const result = await this.db.query(
        `SELECT ${PIPELINE_COLS} ${PIPELINE_FROM}
          WHERE lower(ct.status) IN ('active', 'renewing')
            AND ct.ends_on IS NOT NULL
            AND ct.ends_on::date >= $2::date
            AND ct.ends_on::date <= $3::date
            AND ${bound.sql}
          ORDER BY ct.ends_on ASC, ct.id`,
        [AM_TENANT_ID, today, until, ...bound.params],
      );
      rows = result.rows;
    } catch (err) {
      if (!isMissingRelation(err)) throw err;
    }
    return buildPipeline(rows, hideAmounts);
  }

  async get(req: AmRenewalsReq, rawId: string): Promise<AmRenewalCase> {
    const id = requireCaseId(rawId);
    const hideAmounts = await this.shouldHideAmounts(req);
    const actor = await this.resolveActor(req, undefined);
    const bound = bindScopeSql(
      amScopeSql({ scope: actor.scope, staffId: actor.staffId, teamIds: actor.teamIds }),
      3,
    );
    const row = await this.loadCaseRow(id, bound);
    if (!row) amThrow(404, { error: 'not_found' });
    return mapCase(row, hideAmounts);
  }

  async start(req: AmRenewalsReq, body: AmStartRenewalBody, staffId: number): Promise<AmRenewalCase> {
    const contractId = parseContractId(body.contract_id);
    const actor = await this.resolveActor(req, undefined);
    const bound = bindScopeSql(
      amScopeSql({ scope: actor.scope, staffId: actor.staffId, teamIds: actor.teamIds }),
      3,
    );
    let contract: Record<string, unknown> | undefined;
    try {
      const result = await this.db.query(
        `SELECT ct.id,
                TRIM(COALESCE(ct.agency_client_id, '')) AS agency_client_id,
                ct.status
           FROM crm_contracts ct
           INNER JOIN crm_am_account_ext e
                   ON TRIM(COALESCE(ct.agency_client_id, '')) = e.agency_client_id::text
                  AND e.tenant_id = $1
          WHERE ct.id = $2
            AND lower(ct.status) IN ('active', 'renewing')
            AND ${bound.sql}
          LIMIT 1`,
        [AM_TENANT_ID, contractId, ...bound.params],
      );
      contract = result.rows[0];
    } catch (err) {
      if (!isMissingRelation(err)) throw err;
    }
    if (!contract) amThrow(404, { error: 'not_found' });
    const agencyClientId = String(contract.agency_client_id ?? '').trim();
    if (!isUuid(agencyClientId)) amThrow(404, { error: 'not_found' });

    let insertedId = '';
    try {
      const inserted = await this.db.query(
        `INSERT INTO crm_am_renewal_cases (tenant_id, agency_client_id, contract_id, status)
         VALUES ($1, $2::uuid, $3, 'not_started')
         RETURNING id::text AS id`,
        [AM_TENANT_ID, agencyClientId, contractId],
      );
      insertedId = String(inserted.rows[0]?.id ?? '');
    } catch (err) {
      if (isUniqueViolation(err)) amThrow(409, { error: 'open_case_exists' });
      throw err;
    }
    if (!insertedId) amThrow(409, { error: 'open_case_exists' });

    await this.audit.insert({
      actor_staff_id: staffId > 0 ? staffId : null,
      action: 'renewal.start',
      entity_type: 'renewal_case',
      entity_id: insertedId,
      payload_json: { contract_id: contractId, agency_client_id: agencyClientId },
    });
    return this.get(req, insertedId);
  }

  async patch(
    req: AmRenewalsReq,
    rawId: string,
    body: AmPatchRenewalBody,
    staffId: number,
  ): Promise<AmRenewalCase> {
    const id = requireCaseId(rawId);
    const hideAmounts = await this.shouldHideAmounts(req);
    const actor = await this.resolveActor(req, undefined);
    const bound = bindScopeSql(
      amScopeSql({ scope: actor.scope, staffId: actor.staffId, teamIds: actor.teamIds }),
      3,
    );
    const current = await this.loadCaseRow(id, bound);
    if (!current) amThrow(404, { error: 'not_found' });
    const currentStatus = asStatus(current.status) ?? 'not_started';
    if (currentStatus === 'renewed' || currentStatus === 'lost') {
      amThrow(409, { error: 'case_closed' });
    }

    const nextStatus = body.status != null ? parseStatus(body.status) : currentStatus;
    const nextForecast = body.forecast !== undefined ? parseForecast(body.forecast) : asForecast(current.forecast);
    const nextPct =
      body.forecast_pct !== undefined ? parseForecastPct(body.forecast_pct) : num(current.forecast_pct);
    const nextAction =
      body.next_action !== undefined ? trimOrNull(body.next_action) : trimOrNull(current.next_action);
    const nextLostReason =
      body.lost_reason !== undefined ? String(body.lost_reason ?? '').trim() : trimOrNull(current.lost_reason);
    const nextLostOn = body.lost_on !== undefined ? parseLostOn(body.lost_on) : dayStr(current.lost_on);
    const rawLessons = body.lessons !== undefined ? String(body.lessons ?? '') : String(current.lessons ?? '');
    const userLessons = stripRecoverablePrefix(rawLessons);
    const nextLessons =
      body.recoverable === undefined
        ? trimOrNull(rawLessons)
        : applyRecoverable(rawLessons, body.recoverable);
    const nextContractId =
      body.new_contract_id !== undefined
        ? parseOptionalContractId(body.new_contract_id)
        : num(current.new_contract_id);

    if (nextStatus !== 'not_started') {
      if (!nextForecast || !nextAction) {
        amThrow(400, { error: 'forecast_required' });
      }
    }

    if (nextStatus === 'renewed') {
      const canOverride = body.override === true && (await this.canManage(req));
      if (nextContractId == null && !canOverride) {
        amThrow(400, { error: 'new_contract_required' });
      }
    }

    if (nextStatus === 'lost') {
      if (!String(nextLostReason ?? '').trim() || !nextLostOn || !userLessons) {
        amThrow(400, { error: 'lost_fields_required' });
      }
    }

    try {
      const updated = await this.db.query(
        `UPDATE crm_am_renewal_cases
            SET status = $2,
                forecast = $3,
                forecast_pct = $4,
                next_action = $5,
                lost_reason = $6,
                lost_on = $7::date,
                lessons = $8,
                new_contract_id = $9,
                updated_at = now()
          WHERE tenant_id = $1 AND id = $10::uuid
            AND status NOT IN ('renewed', 'lost')`,
        [
          AM_TENANT_ID,
          nextStatus,
          nextForecast,
          nextPct,
          nextAction,
          nextStatus === 'lost' ? nextLostReason : current.lost_reason,
          nextStatus === 'lost' ? nextLostOn : dayStr(current.lost_on),
          nextLessons,
          nextContractId,
          id,
        ],
      );
      if ((updated.rowCount ?? 0) === 0) {
        amThrow(409, { error: 'case_closed' });
      }
    } catch (err) {
      if (isUniqueViolation(err)) amThrow(409, { error: 'open_case_exists' });
      throw err;
    }

    const action =
      nextStatus === 'lost' ? 'renewal.lost' : nextStatus === 'renewed' ? 'renewal.renewed' : 'renewal.patch';
    await this.audit.insert({
      actor_staff_id: staffId > 0 ? staffId : null,
      action,
      entity_type: 'renewal_case',
      entity_id: id,
      payload_json: {
        status: nextStatus,
        forecast: nextForecast,
        forecast_pct: nextPct,
        new_contract_id: nextContractId,
      },
    });

    const fresh = await this.loadCaseRow(id, bound);
    if (!fresh) amThrow(404, { error: 'not_found' });
    return mapCase(fresh, hideAmounts);
  }

  private async loadCaseRow(
    id: string,
    bound: { sql: string; params: unknown[] },
  ): Promise<Record<string, unknown> | undefined> {
    try {
      const result = await this.db.query(
        `SELECT ${PIPELINE_COLS} ${PIPELINE_FROM}
          WHERE rc.id = $2::uuid AND ${bound.sql}
          LIMIT 1`,
        [AM_TENANT_ID, id, ...bound.params],
      );
      return result.rows[0];
    } catch (err) {
      if (isMissingRelation(err)) return undefined;
      throw err;
    }
  }

  private async shouldHideAmounts(req: AmRenewalsReq): Promise<boolean> {
    if (req.staffAuthVia === 'internal' && !req.staffUser) return false;
    if (!req.staffUser) return true;
    const me = await this.staffAuth.me(req.staffUser);
    return !(
      this.staffAuth.hasCap(me.caps, 'crm_am.finance', 'view') ||
      this.staffAuth.hasCap(me.caps, 'crm_am', 'manage')
    );
  }

  private async canManage(req: AmRenewalsReq): Promise<boolean> {
    if (req.staffAuthVia === 'internal' && !req.staffUser) return true;
    if (!req.staffUser) return false;
    const me = await this.staffAuth.me(req.staffUser);
    return this.staffAuth.hasCap(me.caps, 'crm_am', 'manage');
  }

  private async resolveActor(
    req: AmRenewalsReq,
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

function buildPipeline(rows: Record<string, unknown>[], hideAmounts: boolean): AmRenewalPipeline {
  const cards = rows.map((row) => mapCard(row, hideAmounts));
  let renewable = 0;
  let weighted = 0;
  let atRisk = 0;
  for (const row of rows) {
    const mrr = cardMrr(row);
    if (mrr == null) continue;
    renewable += mrr;
    const pct = num(row.forecast_pct);
    if (pct != null) weighted += Math.round((mrr * pct) / 100);
    const band = String(row.band ?? '');
    const forecast = String(row.forecast ?? '');
    if (band === 'at_risk' || band === 'critical' || forecast === 'risk' || forecast === 'unlikely') {
      atRisk += mrr;
    }
  }
  return {
    hide_amounts: hideAmounts,
    header: {
      renewable_vnd: hideAmounts ? null : renewable,
      weighted_vnd: hideAmounts ? null : weighted,
      at_risk_vnd: hideAmounts ? null : atRisk,
    },
    columns: COLUMNS.map((col) => {
      const items = cards.filter((card) => col.statuses.includes(card.status));
      const colMrr = items.reduce((sum, card) => sum + (card.mrr_vnd ?? 0), 0);
      return {
        id: col.id,
        label: col.label,
        count: items.length,
        mrr_vnd: hideAmounts ? null : colMrr,
        items,
      };
    }),
  };
}

function mapCard(row: Record<string, unknown>, hideAmounts: boolean): AmRenewalCard {
  const endsOn = dayStr(row.ends_on);
  const mrr = cardMrr(row);
  return {
    id: String(row.id ?? ''),
    agency_client_id: String(row.agency_client_id ?? ''),
    name: String(row.name ?? ''),
    owner_label: String(row.owner_label ?? ''),
    status: asStatus(row.status) ?? 'not_started',
    forecast: asForecast(row.forecast),
    forecast_pct: num(row.forecast_pct),
    next_action: trimOrNull(row.next_action),
    mrr_vnd: hideAmounts ? null : mrr,
    days_remaining: daysRemaining(endsOn),
    score: num(row.score),
    band: asBand(row.band),
    ends_on: endsOn,
    contract_id: Number(row.contract_id ?? 0),
  };
}

function mapCase(row: Record<string, unknown>, hideAmounts: boolean): AmRenewalCase {
  return {
    ...mapCard(row, hideAmounts),
    hide_amounts: hideAmounts,
    contract_ref: String(row.reference_code ?? ''),
    lost_reason: trimOrNull(row.lost_reason),
    lost_on: dayStr(row.lost_on),
    lessons: trimOrNull(row.lessons),
    new_contract_id: num(row.new_contract_id),
  };
}

function cardMrr(row: Record<string, unknown>): number | null {
  return monthlyRecurringVnd({
    billingType: String(row.billing_type ?? '').trim().toLowerCase(),
    amountVnd: num(row.amount_vnd) ?? 0,
    startsOn: dayStr(row.starts_on),
    endsOn: dayStr(row.ends_on),
  });
}

function parseWindow(raw: string | undefined): number {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : 90;
}

function parseContractId(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) amThrow(400, { error: 'invalid_contract_id' });
  return n;
}

function parseOptionalContractId(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  return parseContractId(raw);
}

function requireCaseId(raw: string): string {
  const id = String(raw ?? '').trim();
  if (!isUuid(id)) amThrow(400, { error: 'invalid_renewal_id' });
  return id;
}

function parseStatus(raw: string): AmRenewalStatus {
  const status = String(raw ?? '').trim() as AmRenewalStatus;
  if (!STATUSES.includes(status)) amThrow(400, { error: 'invalid_status' });
  return status;
}

function parseForecast(raw: string | null): AmRenewalForecast | null {
  if (raw == null || String(raw).trim() === '') return null;
  const forecast = String(raw).trim() as AmRenewalForecast;
  if (!FORECASTS.includes(forecast)) amThrow(400, { error: 'invalid_forecast' });
  return forecast;
}

function parseForecastPct(raw: number | null): number | null {
  if (raw == null || raw === ('' as never)) return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0 || n > 100) amThrow(400, { error: 'invalid_forecast_pct' });
  return n;
}

function parseLostOn(raw: string | undefined): string | null {
  const value = String(raw ?? '').trim();
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) amThrow(400, { error: 'lost_fields_required' });
  return value;
}

function stripRecoverablePrefix(lessons: string): string {
  return lessons.replace(/^\[(?:not_)?recoverable\]\s*/i, '').trim();
}

function applyRecoverable(lessons: string, recoverable: boolean): string | null {
  const body = stripRecoverablePrefix(lessons);
  const prefix = recoverable ? '[recoverable] ' : '[not_recoverable] ';
  const next = `${prefix}${body}`.trim();
  return next || prefix.trim();
}

function asStatus(value: unknown): AmRenewalStatus | null {
  const status = String(value ?? '') as AmRenewalStatus;
  return STATUSES.includes(status) ? status : null;
}

function asForecast(value: unknown): AmRenewalForecast | null {
  const forecast = String(value ?? '') as AmRenewalForecast;
  return FORECASTS.includes(forecast) ? forecast : null;
}

function asBand(value: unknown): AmHealthBand | null {
  const band = String(value ?? '');
  if (band === 'healthy' || band === 'watch' || band === 'at_risk' || band === 'critical') return band;
  return null;
}

function daysRemaining(endsOn: string | null): number | null {
  if (!endsOn) return null;
  const today = ictYmd();
  const endMs = Date.parse(`${endsOn}T00:00:00+07:00`);
  const todayMs = Date.parse(`${today}T00:00:00+07:00`);
  if (!Number.isFinite(endMs) || !Number.isFinite(todayMs)) return null;
  return Math.round((endMs - todayMs) / 86_400_000);
}

function ictYmd(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ICT,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

function addDaysYmd(ymd: string, days: number): string {
  const [year, month, day] = ymd.split('-').map((part) => Number(part));
  const dt = new Date(Date.UTC(year || 1970, (month || 1) - 1, (day || 1) + days));
  return dt.toISOString().slice(0, 10);
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

function isUniqueViolation(err: unknown): boolean {
  return (err as { code?: string }).code === '23505';
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

function trimOrNull(value: unknown): string | null {
  const s = String(value ?? '').trim();
  return s || null;
}
