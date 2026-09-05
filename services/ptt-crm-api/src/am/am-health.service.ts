import { Injectable, OnModuleDestroy, Optional } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { AmAuditRepository, AM_TENANT_ID } from './am-audit.repository';
import { AmDashboardService } from './am-dashboard.service';
import { amThrow } from './am-http';
import {
  bandFromScore,
  DEFAULT_BANDS,
  DEFAULT_WEIGHTS,
  isActiveBook,
  weightedScore,
  type AmBandRanges,
} from './am-health.util';
import { sumRevenueAtRisk } from './am-dashboard.service';
import { monthlyRecurringVnd } from './am-money.util';
import { AmSettingsService } from './am-settings.service';
import { amScopeSql, resolveAmScope } from './am-scope.util';
import { isUuid } from './am-tasks.service';
import type { AmAmStatus, AmHealthBand, AmHealthComponents, AmScope } from './am.types';

export type AmHealthAccountRow = {
  agency_client_id: string;
  am_status: AmAmStatus;
  created_at: string;
  has_active_contract: boolean;
  csd_breached: boolean;
};

export type AmHealthSnapshotInput = {
  agency_client_id: string;
  as_of: string;
  score: number;
  band: AmHealthBand;
  components: AmHealthComponents;
  scorecard_version: number;
  thin_data: boolean;
};

export type AmHealthDist = {
  healthy: number;
  watch: number;
  at_risk: number;
  critical: number;
  avg: number | null;
};

export type AmHealthRecomputeResult = {
  as_of: string;
  computed: number;
  skipped: number;
  dist: AmHealthDist;
};

export type AmHealthOverrideBody = {
  band?: string;
  reason?: string;
  until?: string;
};

export type AmHealthOverrideResult = {
  agency_client_id: string;
  band: AmHealthBand;
  reason: string;
  until: string;
};

export type AmHealthLatestSnapshot = {
  as_of: string;
  score: number;
  band: AmHealthBand;
  components: AmHealthComponents;
  scorecard_version: number;
  thin_data: boolean;
};

export type AmHealthCenterRow = {
  agency_client_id: string;
  name: string;
  am_status: AmAmStatus;
  score: number | null;
  band: AmHealthBand | null;
  override_band: AmHealthBand | null;
  override_until: string | null;
  owner_label: string;
  open_risks: number;
  recovery_status: string | null;
  prior_score: number | null;
  mrr_vnd: number | null;
};

export type AmHealthCenterQuery = { scope?: AmScope; from?: string; to?: string };

export type AmHealthCenterTiles = {
  healthy: number;
  watch: number;
  at_risk: number;
  critical: number;
  revenue_at_risk_vnd: number | null;
  open_risks: number;
};

export type AmHealthRiskyRow = {
  agency_client_id: string;
  name: string;
  score: number | null;
  band: 'at_risk' | 'critical';
  delta_30d: number | null;
  mrr_vnd: number | null;
  owner_label: string;
  open_risks: number;
  recovery_status: string | null;
};

export type AmHealthCenterResult = {
  hide_amounts: boolean;
  tiles: AmHealthCenterTiles;
  sparkline: Array<{ as_of: string; avg: number | null }>;
  risky: AmHealthRiskyRow[];
};

export type AmHealthDetailRow = {
  agency_client_id: string;
  name: string;
  score: number | null;
  band: AmHealthBand | null;
  as_of: string | null;
  scorecard_version: number | null;
  thin_data: boolean;
  override_band: AmHealthBand | null;
  override_reason: string | null;
  override_until: string | null;
  components: AmHealthComponents | null;
};

export type AmHealthContribution = {
  key: keyof AmHealthComponents;
  score: number;
  weight: number;
  points: number;
};

export type AmHealthDetailResult = {
  agency_client_id: string;
  name: string;
  score: number | null;
  band: AmHealthBand | null;
  as_of: string | null;
  scorecard_version: number | null;
  thin_data: boolean;
  override: { band: AmHealthBand; reason: string; until: string } | null;
  weights: AmHealthComponents;
  components: AmHealthComponents | null;
  contribution: AmHealthContribution[];
  trend: Array<{ as_of: string; score: number | null }>;
  signals: string[];
};

export type AmHealthStore = {
  listAccounts(): Promise<AmHealthAccountRow[]>;
  upsertSnapshot(input: AmHealthSnapshotInput): Promise<void>;
  loadWeights(): Promise<AmHealthComponents>;
  applyOverride(input: {
    agency_client_id: string;
    band: AmHealthBand;
    reason: string;
    until: string;
    as_of: string;
    fallback: Omit<AmHealthSnapshotInput, 'agency_client_id' | 'as_of'>;
  }): Promise<void>;
  findAccount(
    agencyClientId: string,
    scopeSql: string,
    scopeParams: unknown[],
  ): Promise<boolean>;
  loadCenterRows(scopeSql: string, scopeParams: unknown[], asOf: string): Promise<AmHealthCenterRow[]>;
  loadSparkline(
    scopeSql: string,
    scopeParams: unknown[],
    months: string[],
  ): Promise<Array<{ as_of: string; avg: number | null }>>;
  countOpenRisks(scopeSql: string, scopeParams: unknown[]): Promise<number>;
  loadTeamIds(staffId: number): Promise<number[]>;
  loadDetail(
    agencyClientId: string,
    scopeSql: string,
    scopeParams: unknown[],
  ): Promise<AmHealthDetailRow | null>;
  loadTrend(agencyClientId: string): Promise<Array<{ as_of: string; score: number | null }>>;
};

export type AmHealthReq = {
  staffUser?: StaffJwtPayload;
  staffAuthVia?: 'internal' | 'jwt';
};

const HEALTH_BANDS = new Set<AmHealthBand>(['healthy', 'watch', 'at_risk', 'critical']);

const ICT = 'Asia/Ho_Chi_Minh';

export const HEALTH_SNAPSHOT_UPSERT = `
INSERT INTO crm_am_health_snapshots (
  tenant_id, agency_client_id, as_of, score, band, components_json,
  scorecard_version, thin_data, override_band, override_reason, override_until
) VALUES ($1, $2::uuid, $3::date, $4, $5, $6::jsonb, $7, $8, $9, $10, $11::date)
ON CONFLICT (tenant_id, agency_client_id, as_of) DO UPDATE SET
  score = EXCLUDED.score,
  band = EXCLUDED.band,
  components_json = EXCLUDED.components_json,
  thin_data = EXCLUDED.thin_data
`;

function isMissingRelation(err: unknown): boolean {
  const e = err as { code?: string; message?: string };
  return e.code === '42P01' || /does not exist/i.test(e.message ?? '');
}

function ictYmd(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ICT,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

function parseAsOf(raw: string | undefined): string {
  return raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : ictYmd();
}

function daysBetween(from: string, asOf: string): number {
  const start = Date.parse(`${String(from).slice(0, 10)}T00:00:00Z`);
  const end = Date.parse(`${asOf}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.floor((end - start) / 86_400_000);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function emptyDist(): AmHealthDist {
  return { healthy: 0, watch: 0, at_risk: 0, critical: 0, avg: null };
}

export function stubHealthComponents(input: {
  hasActiveContract: boolean;
  csdBreached: boolean;
}): AmHealthComponents {
  return {
    kpi_delivery: 70,
    engagement: 70,
    financial: input.hasActiveContract ? 80 : 70,
    satisfaction: 70,
    contract_support: input.csdBreached ? 40 : 70,
  };
}

export function wave1ThinData(account: { am_status: string; created_at: string }, asOf: string): boolean {
  const newlyActive = account.am_status === 'active' && daysBetween(account.created_at, asOf) < 30;
  const stubbedSources = true;
  return stubbedSources || newlyActive;
}

function parseWeights(raw: unknown): AmHealthComponents {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_WEIGHTS };
  const row = raw as Record<string, unknown>;
  const num = (key: keyof AmHealthComponents) => {
    const n = Number(row[key]);
    return Number.isFinite(n) ? n : DEFAULT_WEIGHTS[key];
  };
  return {
    kpi_delivery: num('kpi_delivery'),
    engagement: num('engagement'),
    financial: num('financial'),
    satisfaction: num('satisfaction'),
    contract_support: num('contract_support'),
  };
}

@Injectable()
export class AmHealthRepository implements OnModuleDestroy, AmHealthStore {
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

  async listAccounts(): Promise<AmHealthAccountRow[]> {
    const accounts = await this.loadExt();
    const [activeContracts, breached] = await Promise.all([
      this.loadActiveContractIds(),
      this.loadBreachedClientIds(),
    ]);
    return accounts.map((row) => ({
      ...row,
      has_active_contract: activeContracts.has(row.agency_client_id),
      csd_breached: breached.has(row.agency_client_id),
    }));
  }

  async upsertSnapshot(input: AmHealthSnapshotInput): Promise<void> {
    const previous = await this.loadLatestOverride(input.agency_client_id);
    const today = ictYmd();
    const carry = Boolean(previous?.until && previous.until >= today);
    await this.db.query(HEALTH_SNAPSHOT_UPSERT, [
      AM_TENANT_ID,
      input.agency_client_id,
      input.as_of,
      input.score,
      input.band,
      JSON.stringify(input.components),
      input.scorecard_version,
      input.thin_data,
      carry ? previous?.band : null,
      carry ? previous?.reason : null,
      carry ? previous?.until : null,
    ]);
  }

  async loadWeights(): Promise<AmHealthComponents> {
    try {
      const result = await this.db.query<{ weights_json: unknown }>(
        `SELECT weights_json FROM crm_am_settings WHERE tenant_id = $1 LIMIT 1`,
        [AM_TENANT_ID],
      );
      return parseWeights(result.rows[0]?.weights_json);
    } catch (err) {
      if (isMissingRelation(err)) return { ...DEFAULT_WEIGHTS };
      throw err;
    }
  }

  async findAccount(
    agencyClientId: string,
    scopeSql: string,
    scopeParams: unknown[],
  ): Promise<boolean> {
    try {
      const result = await this.db.query(
        `SELECT 1
           FROM crm_am_account_ext e
          WHERE e.tenant_id = $1 AND e.agency_client_id = $2::uuid AND ${scopeSql}
          LIMIT 1`,
        [AM_TENANT_ID, agencyClientId, ...scopeParams],
      );
      return (result.rowCount ?? 0) > 0;
    } catch (err) {
      if (isMissingRelation(err)) return false;
      throw err;
    }
  }

  async applyOverride(input: {
    agency_client_id: string;
    band: AmHealthBand;
    reason: string;
    until: string;
    as_of: string;
    fallback: Omit<AmHealthSnapshotInput, 'agency_client_id' | 'as_of'>;
  }): Promise<void> {
    const latest = await this.loadLatestSnapshot(input.agency_client_id);
    if (latest) {
      await this.db.query(
        `UPDATE crm_am_health_snapshots
            SET override_band = $3, override_reason = $4, override_until = $5::date
          WHERE tenant_id = $1 AND agency_client_id = $2::uuid AND as_of = $6::date`,
        [AM_TENANT_ID, input.agency_client_id, input.band, input.reason, input.until, latest.as_of],
      );
      return;
    }
    await this.db.query(
      `INSERT INTO crm_am_health_snapshots (
         tenant_id, agency_client_id, as_of, score, band, components_json,
         scorecard_version, thin_data, override_band, override_reason, override_until
       ) VALUES ($1, $2::uuid, $3::date, $4, $5, $6::jsonb, $7, $8, $9, $10, $11::date)
       ON CONFLICT (tenant_id, agency_client_id, as_of) DO UPDATE SET
         override_band = EXCLUDED.override_band,
         override_reason = EXCLUDED.override_reason,
         override_until = EXCLUDED.override_until`,
      [
        AM_TENANT_ID,
        input.agency_client_id,
        input.as_of,
        input.fallback.score,
        input.fallback.band,
        JSON.stringify(input.fallback.components),
        input.fallback.scorecard_version,
        input.fallback.thin_data,
        input.band,
        input.reason,
        input.until,
      ],
    );
  }

  async loadCenterRows(
    scopeSql: string,
    scopeParams: unknown[],
    asOf: string,
  ): Promise<AmHealthCenterRow[]> {
    const sql = `
      SELECT
        e.agency_client_id::text AS agency_client_id,
        e.am_status,
        c.name,
        COALESCE(owner.name, '') AS owner_label,
        snap.score,
        snap.band,
        snap.override_band,
        snap.override_until,
        prior.score AS prior_score,
        COALESCE(risks.open_risks, 0)::int AS open_risks,
        rec.status AS recovery_status,
        COALESCE(cts.contracts, '[]'::json) AS contracts
      FROM crm_am_account_ext e
      INNER JOIN clients c ON c.id = e.agency_client_id
      LEFT JOIN crm_staff owner ON owner.id = e.account_owner_staff_id
      LEFT JOIN LATERAL (
        SELECT h.score, h.band, h.override_band, h.override_until
          FROM crm_am_health_snapshots h
         WHERE h.tenant_id = $1
           AND h.agency_client_id = e.agency_client_id
           AND h.as_of <= $2::date
         ORDER BY h.as_of DESC
         LIMIT 1
      ) snap ON TRUE
      LEFT JOIN LATERAL (
        SELECT h.score
          FROM crm_am_health_snapshots h
         WHERE h.tenant_id = $1
           AND h.agency_client_id = e.agency_client_id
           AND h.as_of <= ($2::date - INTERVAL '30 days')
         ORDER BY h.as_of DESC
         LIMIT 1
      ) prior ON TRUE
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS open_risks
          FROM crm_am_risks r
         WHERE r.tenant_id = $1
           AND r.agency_client_id = e.agency_client_id
           AND r.status = 'open'
      ) risks ON TRUE
      LEFT JOIN LATERAL (
        SELECT p.status
          FROM crm_am_recovery_plans p
         WHERE p.tenant_id = $1
           AND p.agency_client_id = e.agency_client_id
         ORDER BY p.created_at DESC
         LIMIT 1
      ) rec ON TRUE
      LEFT JOIN LATERAL (
        SELECT json_agg(json_build_object(
          'status', ct.status,
          'billing_type', ct.billing_type,
          'amount_vnd', ct.amount_vnd,
          'starts_on', ct.starts_on,
          'ends_on', ct.ends_on
        )) AS contracts
          FROM crm_contracts ct
         WHERE TRIM(COALESCE(ct.agency_client_id, '')) = e.agency_client_id::text
      ) cts ON TRUE
      WHERE e.tenant_id = $1
        AND ${scopeSql}`;
    try {
      const result = await this.db.query(sql, [AM_TENANT_ID, asOf, ...scopeParams]);
      return result.rows.map(mapCenterRow);
    } catch (err) {
      if (!isMissingRelation(err)) throw err;
      return this.loadCenterRowsLite(scopeSql, scopeParams, asOf);
    }
  }

  async loadSparkline(
    scopeSql: string,
    scopeParams: unknown[],
    months: string[],
  ): Promise<Array<{ as_of: string; avg: number | null }>> {
    const empty = months.map((as_of) => ({ as_of, avg: null as number | null }));
    if (!months.length) return empty;
    const from = months[0];
    const last = months[months.length - 1];
    const toExclusive = addMonthsYmd(last, 1);
    const sql = `
      SELECT to_char(date_trunc('month', h.as_of), 'YYYY-MM-01') AS month_start,
             AVG(h.score)::float AS avg
        FROM crm_am_health_snapshots h
        JOIN crm_am_account_ext e
          ON e.tenant_id = h.tenant_id AND e.agency_client_id = h.agency_client_id
       WHERE h.tenant_id = $1
         AND h.as_of >= $2::date
         AND h.as_of < $3::date
         AND e.am_status <> 'churned'
         AND ${scopeSql}
       GROUP BY 1`;
    try {
      const result = await this.db.query<{ month_start: string; avg: string | number | null }>(
        sql,
        [AM_TENANT_ID, from, toExclusive, ...scopeParams],
      );
      const byMonth = new Map<string, number | null>();
      for (const row of result.rows) {
        const key = String(row.month_start ?? '').slice(0, 10);
        const avg = row.avg == null ? null : Number(row.avg);
        byMonth.set(key, avg != null && Number.isFinite(avg) ? round1(avg) : null);
      }
      return months.map((as_of) => ({ as_of, avg: byMonth.get(as_of) ?? null }));
    } catch (err) {
      if (isMissingRelation(err)) return empty;
      throw err;
    }
  }

  async countOpenRisks(scopeSql: string, scopeParams: unknown[]): Promise<number> {
    try {
      const result = await this.db.query<{ n: string | number }>(
        `SELECT COUNT(*)::int AS n
           FROM crm_am_risks r
           JOIN crm_am_account_ext e
             ON e.tenant_id = r.tenant_id AND e.agency_client_id = r.agency_client_id
          WHERE r.tenant_id = $1
            AND r.status = 'open'
            AND e.am_status <> 'churned'
            AND ${scopeSql}`,
        [AM_TENANT_ID, ...scopeParams],
      );
      return Number(result.rows[0]?.n ?? 0) || 0;
    } catch (err) {
      if (isMissingRelation(err)) return 0;
      throw err;
    }
  }

  async loadTeamIds(staffId: number): Promise<number[]> {
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

  async loadDetail(
    agencyClientId: string,
    scopeSql: string,
    scopeParams: unknown[],
  ): Promise<AmHealthDetailRow | null> {
    const sql = `
      SELECT
        e.agency_client_id::text AS agency_client_id,
        c.name,
        snap.as_of,
        snap.score,
        snap.band,
        snap.components_json,
        snap.scorecard_version,
        snap.thin_data,
        snap.override_band,
        snap.override_reason,
        snap.override_until
      FROM crm_am_account_ext e
      INNER JOIN clients c ON c.id = e.agency_client_id
      LEFT JOIN LATERAL (
        SELECT h.as_of, h.score, h.band, h.components_json, h.scorecard_version,
               h.thin_data, h.override_band, h.override_reason, h.override_until
          FROM crm_am_health_snapshots h
         WHERE h.tenant_id = $1 AND h.agency_client_id = e.agency_client_id
         ORDER BY h.as_of DESC
         LIMIT 1
      ) snap ON TRUE
      WHERE e.tenant_id = $1
        AND e.agency_client_id = $2::uuid
        AND ${scopeSql}
      LIMIT 1`;
    try {
      const result = await this.db.query(sql, [AM_TENANT_ID, agencyClientId, ...scopeParams]);
      const row = result.rows[0];
      if (!row) return null;
      return {
        agency_client_id: String(row.agency_client_id ?? ''),
        name: String(row.name ?? ''),
        score: row.score == null ? null : Number(row.score),
        band: row.band ? (String(row.band) as AmHealthBand) : null,
        as_of: dayStr(row.as_of),
        scorecard_version: row.scorecard_version == null ? null : Number(row.scorecard_version),
        thin_data: Boolean(row.thin_data),
        override_band: row.override_band ? (String(row.override_band) as AmHealthBand) : null,
        override_reason: row.override_reason != null ? String(row.override_reason) : null,
        override_until: dayStr(row.override_until),
        components: row.components_json ? parseWeights(row.components_json) : null,
      };
    } catch (err) {
      if (isMissingRelation(err)) return null;
      throw err;
    }
  }

  async loadTrend(agencyClientId: string): Promise<Array<{ as_of: string; score: number | null }>> {
    try {
      const result = await this.db.query(
        `SELECT as_of, score
           FROM crm_am_health_snapshots
          WHERE tenant_id = $1 AND agency_client_id = $2::uuid
          ORDER BY as_of DESC
          LIMIT 4`,
        [AM_TENANT_ID, agencyClientId],
      );
      return result.rows
        .map((row) => ({
          as_of: dayStr(row.as_of) ?? '',
          score: row.score == null ? null : Number(row.score),
        }))
        .reverse();
    } catch (err) {
      if (isMissingRelation(err)) return [];
      throw err;
    }
  }

  private async loadCenterRowsLite(
    scopeSql: string,
    scopeParams: unknown[],
    asOf: string,
  ): Promise<AmHealthCenterRow[]> {
    const sql = `
      SELECT
        e.agency_client_id::text AS agency_client_id,
        e.am_status,
        c.name,
        COALESCE(owner.name, '') AS owner_label,
        snap.score,
        snap.band,
        snap.override_band,
        snap.override_until,
        prior.score AS prior_score
      FROM crm_am_account_ext e
      INNER JOIN clients c ON c.id = e.agency_client_id
      LEFT JOIN crm_staff owner ON owner.id = e.account_owner_staff_id
      LEFT JOIN LATERAL (
        SELECT h.score, h.band, h.override_band, h.override_until
          FROM crm_am_health_snapshots h
         WHERE h.tenant_id = $1
           AND h.agency_client_id = e.agency_client_id
           AND h.as_of <= $2::date
         ORDER BY h.as_of DESC
         LIMIT 1
      ) snap ON TRUE
      LEFT JOIN LATERAL (
        SELECT h.score
          FROM crm_am_health_snapshots h
         WHERE h.tenant_id = $1
           AND h.agency_client_id = e.agency_client_id
           AND h.as_of <= ($2::date - INTERVAL '30 days')
         ORDER BY h.as_of DESC
         LIMIT 1
      ) prior ON TRUE
      WHERE e.tenant_id = $1
        AND ${scopeSql}`;
    try {
      const result = await this.db.query(sql, [AM_TENANT_ID, asOf, ...scopeParams]);
      return result.rows.map((row) => mapCenterRow({ ...row, open_risks: 0, recovery_status: null, contracts: [] }));
    } catch (err) {
      if (isMissingRelation(err)) return [];
      throw err;
    }
  }

  private async loadLatestOverride(
    agencyClientId: string,
  ): Promise<{ band: string | null; reason: string | null; until: string | null } | null> {
    try {
      const result = await this.db.query(
        `SELECT override_band, override_reason, override_until
           FROM crm_am_health_snapshots
          WHERE tenant_id = $1 AND agency_client_id = $2::uuid
          ORDER BY as_of DESC
          LIMIT 1`,
        [AM_TENANT_ID, agencyClientId],
      );
      const row = result.rows[0];
      if (!row) return null;
      return {
        band: row.override_band != null ? String(row.override_band) : null,
        reason: row.override_reason != null ? String(row.override_reason) : null,
        until: dayStr(row.override_until),
      };
    } catch (err) {
      if (isMissingRelation(err)) return null;
      throw err;
    }
  }

  private async loadLatestSnapshot(agencyClientId: string): Promise<AmHealthLatestSnapshot | null> {
    try {
      const result = await this.db.query(
        `SELECT as_of, score, band, components_json, scorecard_version, thin_data
           FROM crm_am_health_snapshots
          WHERE tenant_id = $1 AND agency_client_id = $2::uuid
          ORDER BY as_of DESC
          LIMIT 1`,
        [AM_TENANT_ID, agencyClientId],
      );
      const row = result.rows[0];
      if (!row) return null;
      return {
        as_of: dayStr(row.as_of) ?? '',
        score: Number(row.score),
        band: String(row.band) as AmHealthBand,
        components: parseWeights(row.components_json),
        scorecard_version: Number(row.scorecard_version ?? 1),
        thin_data: Boolean(row.thin_data),
      };
    } catch (err) {
      if (isMissingRelation(err)) return null;
      throw err;
    }
  }

  private async loadExt(): Promise<Array<Pick<AmHealthAccountRow, 'agency_client_id' | 'am_status' | 'created_at'>>> {
    try {
      const result = await this.db.query(
        `SELECT agency_client_id::text AS agency_client_id, am_status, created_at
         FROM crm_am_account_ext
         WHERE tenant_id = $1`,
        [AM_TENANT_ID],
      );
      return result.rows.map((row) => ({
        agency_client_id: String(row.agency_client_id ?? ''),
        am_status: String(row.am_status ?? 'active') as AmAmStatus,
        created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at ?? ''),
      }));
    } catch (err) {
      if (isMissingRelation(err)) return [];
      throw err;
    }
  }

  private async loadActiveContractIds(): Promise<Set<string>> {
    try {
      const result = await this.db.query<{ agency_client_id: string }>(
        `SELECT DISTINCT TRIM(agency_client_id) AS agency_client_id
         FROM crm_contracts
         WHERE TRIM(COALESCE(agency_client_id, '')) <> ''
           AND LOWER(TRIM(status)) IN ('active', 'renewing')`,
      );
      return new Set(result.rows.map((row) => String(row.agency_client_id)));
    } catch (err) {
      if (isMissingRelation(err)) return new Set();
      throw err;
    }
  }

  private async loadBreachedClientIds(): Promise<Set<string>> {
    try {
      const result = await this.db.query<{ client_account_id: string }>(
        `SELECT DISTINCT client_account_id
         FROM csd_tickets
         WHERE is_deleted = FALSE
           AND scope_status = 'in_scope'
           AND sla_status = 'breached'
           AND client_account_id IS NOT NULL`,
      );
      return new Set(result.rows.map((row) => String(row.client_account_id)));
    } catch (err) {
      if (isMissingRelation(err)) return new Set();
      throw err;
    }
  }
}

@Injectable()
export class AmHealthService {
  constructor(
    private readonly repo: AmHealthRepository,
    private readonly audit: AmAuditRepository,
    @Optional() private readonly dashboard?: AmDashboardService,
    @Optional() private readonly settings?: AmSettingsService,
    @Optional() private readonly staffAuth?: StaffAuthService,
  ) {}

  async recompute(input: { asOf?: string; actorStaffId?: number } = {}): Promise<AmHealthRecomputeResult> {
    const asOf = parseAsOf(input.asOf);
    const scorecard = await this.loadScorecard();
    const accounts = await this.repo.listAccounts();
    const dist = emptyDist();
    let sum = 0;
    let computed = 0;
    let skipped = 0;

    for (const account of accounts) {
      if (account.am_status === 'churned' || !isActiveBook(account.am_status)) {
        skipped += 1;
        continue;
      }
      const components = stubHealthComponents({
        hasActiveContract: account.has_active_contract,
        csdBreached: account.csd_breached,
      });
      const score = round1(weightedScore(components, scorecard.weights));
      const band = bandFromScore(score, scorecard.bands);
      await this.repo.upsertSnapshot({
        agency_client_id: account.agency_client_id,
        as_of: asOf,
        score,
        band,
        components,
        scorecard_version: scorecard.scorecard_version,
        thin_data: wave1ThinData(account, asOf),
      });
      dist[band] += 1;
      sum += score;
      computed += 1;
    }

    dist.avg = computed ? round1(sum / computed) : null;
    this.dashboard?.dropCache();
    await this.audit.insert({
      actor_staff_id: input.actorStaffId && input.actorStaffId > 0 ? input.actorStaffId : null,
      action: 'health.recompute',
      entity_type: 'health_snapshot',
      payload_json: { as_of: asOf, computed, skipped },
    });
    return { as_of: asOf, computed, skipped, dist };
  }

  async override(
    req: AmHealthReq,
    agencyClientId: string,
    body: AmHealthOverrideBody,
    actorStaffId: number,
  ): Promise<AmHealthOverrideResult> {
    const reason = String(body.reason ?? '').trim();
    if (!reason) amThrow(400, { error: 'reason_required' });
    const band = String(body.band ?? '').trim() as AmHealthBand;
    if (!HEALTH_BANDS.has(band)) amThrow(400, { error: 'invalid_band' });
    const until = String(body.until ?? '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(until)) amThrow(400, { error: 'override_until_invalid' });
    const today = ictYmd();
    const maxUntil = addDaysYmd(today, 30);
    if (until < today || until > maxUntil) amThrow(400, { error: 'override_until_invalid' });

    const id = String(agencyClientId ?? '').trim();
    if (!isUuid(id)) amThrow(404, { error: 'not_found' });
    const actor = await this.resolveActor(req);
    const bound = bindScopeSql(
      amScopeSql({ scope: actor.scope, staffId: actor.staffId, teamIds: actor.teamIds }),
      3,
    );
    const visible = await this.repo.findAccount(id, bound.sql, bound.params);
    if (!visible) amThrow(404, { error: 'not_found' });

    const scorecard = await this.loadScorecard();
    const fallbackComponents = stubHealthComponents({ hasActiveContract: false, csdBreached: false });
    const fallbackScore = round1(weightedScore(fallbackComponents, scorecard.weights));
    await this.repo.applyOverride({
      agency_client_id: id,
      band,
      reason,
      until,
      as_of: today,
      fallback: {
        score: fallbackScore,
        band: bandFromScore(fallbackScore, scorecard.bands),
        components: fallbackComponents,
        scorecard_version: scorecard.scorecard_version,
        thin_data: true,
      },
    });
    this.dashboard?.dropCache();
    await this.audit.insert({
      actor_staff_id: actorStaffId > 0 ? actorStaffId : null,
      action: 'health.override',
      entity_type: 'health_snapshot',
      entity_id: id,
      payload_json: { band, reason, until },
    });
    return { agency_client_id: id, band, reason, until };
  }

  async center(req: AmHealthReq, query: AmHealthCenterQuery = {}): Promise<AmHealthCenterResult> {
    const actor = await this.resolveActor(req, query.scope);
    const scopeFrag = amScopeSql({ scope: actor.scope, staffId: actor.staffId, teamIds: actor.teamIds });
    const asOf = parseAsOf(query.to);
    const months = last6MonthsIct(asOf);
    const hideAmounts = await this.shouldHideAmounts(req);
    const rowsBound = bindScopeSql(scopeFrag, 3);
    const sparkBound = bindScopeSql(scopeFrag, 4);
    const riskBound = bindScopeSql(scopeFrag, 2);
    const [rows, sparkline, openRisks] = await Promise.all([
      this.repo.loadCenterRows(rowsBound.sql, rowsBound.params, asOf),
      this.repo.loadSparkline(sparkBound.sql, sparkBound.params, months),
      this.repo.countOpenRisks(riskBound.sql, riskBound.params),
    ]);
    const book = rows.filter((row) => row.am_status !== 'churned');
    const tiles: AmHealthCenterTiles = {
      healthy: 0,
      watch: 0,
      at_risk: 0,
      critical: 0,
      revenue_at_risk_vnd: null,
      open_risks: openRisks,
    };
    const riskRows: AmHealthRiskyRow[] = [];
    const moneyRows: Array<{ band: string; mrr: number | null }> = [];
    for (const row of book) {
      const band = effectiveCenterBand(row, asOf);
      if (band) tiles[band] += 1;
      moneyRows.push({ band: band ?? '', mrr: row.mrr_vnd });
      if (band === 'at_risk' || band === 'critical') {
        const delta =
          row.score != null && row.prior_score != null ? round1(row.score - row.prior_score) : null;
        riskRows.push({
          agency_client_id: row.agency_client_id,
          name: row.name,
          score: row.score,
          band,
          delta_30d: delta,
          mrr_vnd: hideAmounts ? null : row.mrr_vnd,
          owner_label: row.owner_label || 'Chưa gán',
          open_risks: row.open_risks,
          recovery_status: row.recovery_status,
        });
      }
    }
    const atRisk = sumRevenueAtRisk(moneyRows);
    tiles.revenue_at_risk_vnd = hideAmounts ? null : atRisk.vnd;
    riskRows.sort((a, b) => {
      const rank = { critical: 0, at_risk: 1 };
      const br = rank[a.band] - rank[b.band];
      if (br) return br;
      return (b.mrr_vnd ?? 0) - (a.mrr_vnd ?? 0);
    });
    return { hide_amounts: hideAmounts, tiles, sparkline, risky: riskRows };
  }

  async detail(req: AmHealthReq, agencyClientId: string): Promise<AmHealthDetailResult> {
    const id = String(agencyClientId ?? '').trim();
    if (!isUuid(id)) amThrow(404, { error: 'not_found' });
    const actor = await this.resolveActor(req);
    const bound = bindScopeSql(
      amScopeSql({ scope: actor.scope, staffId: actor.staffId, teamIds: actor.teamIds }),
      3,
    );
    const row = await this.repo.loadDetail(id, bound.sql, bound.params);
    if (!row) amThrow(404, { error: 'not_found' });
    const scorecard = await this.loadScorecard();
    const today = ictYmd();
    const overrideActive = Boolean(
      row.override_band && row.override_until && row.override_until >= today && HEALTH_BANDS.has(row.override_band),
    );
    const override = overrideActive
      ? {
          band: row.override_band as AmHealthBand,
          reason: row.override_reason ?? '',
          until: row.override_until ?? '',
        }
      : null;
    const band = override ? override.band : row.band;
    const components = row.components;
    const contribution: AmHealthContribution[] = components
      ? (Object.keys(scorecard.weights) as Array<keyof AmHealthComponents>).map((key) => ({
          key,
          score: components[key],
          weight: scorecard.weights[key],
          points: round1((components[key] * scorecard.weights[key]) / 100),
        }))
      : [];
    const trendRaw = await this.repo.loadTrend(id);
    const trend = padTrend(trendRaw);
    return {
      agency_client_id: row.agency_client_id,
      name: row.name,
      score: row.score,
      band,
      as_of: row.as_of,
      scorecard_version: row.scorecard_version ?? scorecard.scorecard_version,
      thin_data: row.thin_data,
      override,
      weights: scorecard.weights,
      components,
      contribution,
      trend,
      signals: deriveSignals({ thin_data: row.thin_data, override, components }),
    };
  }

  private async loadScorecard(): Promise<{
    weights: AmHealthComponents;
    bands: AmBandRanges;
    scorecard_version: number;
  }> {
    if (this.settings) {
      const row = await this.settings.get();
      return {
        weights: row.weights,
        bands: row.bands,
        scorecard_version: row.scorecard_version || 1,
      };
    }
    return {
      weights: await this.repo.loadWeights(),
      bands: { ...DEFAULT_BANDS },
      scorecard_version: 1,
    };
  }

  private async shouldHideAmounts(req: AmHealthReq): Promise<boolean> {
    if (req.staffAuthVia === 'internal' && !req.staffUser) return false;
    if (!req.staffUser || !this.staffAuth) return true;
    const me = await this.staffAuth.me(req.staffUser);
    return !(
      this.staffAuth.hasCap(me.caps, 'crm_am.finance', 'view') ||
      this.staffAuth.hasCap(me.caps, 'crm_am', 'manage')
    );
  }

  private async resolveActor(
    req: AmHealthReq,
    requested: AmScope | undefined = 'all',
  ): Promise<{
    staffId: number;
    scope: AmScope;
    teamIds: number[];
  }> {
    const internal = req.staffAuthVia === 'internal';
    const staffId = req.staffUser
      ? ((await this.staffAuth?.resolveCrmStaffUserId(req.staffUser)) ?? 0)
      : 0;
    if (internal && !req.staffUser) {
      return { staffId, scope: resolveAmScope({ requested, hasViewAll: true, canTeam: true }), teamIds: [] };
    }
    if (!req.staffUser || !this.staffAuth) {
      return { staffId, scope: 'me', teamIds: [] };
    }
    const me = await this.staffAuth.me(req.staffUser);
    const has = (action: string) => this.staffAuth!.hasCap(me.caps, 'crm_am', action);
    const hasViewAll = has('view_all') || has('manage');
    const canTeam = hasViewAll || has('assign');
    const scope = resolveAmScope({ requested, hasViewAll, canTeam });
    const teamIds = scope === 'team' ? await this.repo.loadTeamIds(staffId) : [];
    return { staffId, scope, teamIds };
  }
}

function addDaysYmd(ymd: string, days: number): string {
  const [year, month, day] = ymd.split('-').map((part) => Number(part));
  const dt = new Date(Date.UTC(year || 1970, (month || 1) - 1, (day || 1) + days));
  return dt.toISOString().slice(0, 10);
}

function dayStr(value: unknown): string | null {
  if (value == null || value === '') return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const s = String(value);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

function last6MonthsIct(asOf: string): string[] {
  const [year, month] = asOf.split('-').map((part) => Number(part));
  const out: string[] = [];
  for (let i = 5; i >= 0; i -= 1) {
    const dt = new Date(Date.UTC(year || 1970, (month || 1) - 1 - i, 1));
    out.push(`${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-01`);
  }
  return out;
}

function addMonthsYmd(ymd: string, months: number): string {
  const [year, month, day] = ymd.split('-').map((part) => Number(part));
  const dt = new Date(Date.UTC(year || 1970, (month || 1) - 1 + months, day || 1));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

function effectiveCenterBand(row: AmHealthCenterRow, asOf: string): AmHealthBand | null {
  if (row.override_band && row.override_until && row.override_until >= asOf) {
    return HEALTH_BANDS.has(row.override_band) ? row.override_band : null;
  }
  if (row.band && HEALTH_BANDS.has(row.band)) return row.band;
  if (row.score != null) return bandFromScore(row.score);
  return null;
}

function mapCenterRow(row: Record<string, unknown>): AmHealthCenterRow {
  return {
    agency_client_id: String(row.agency_client_id ?? ''),
    name: String(row.name ?? ''),
    am_status: String(row.am_status ?? 'active') as AmAmStatus,
    score: row.score == null ? null : Number(row.score),
    band: row.band ? (String(row.band) as AmHealthBand) : null,
    override_band: row.override_band ? (String(row.override_band) as AmHealthBand) : null,
    override_until: dayStr(row.override_until),
    owner_label: String(row.owner_label ?? ''),
    open_risks: Number(row.open_risks ?? 0) || 0,
    recovery_status: row.recovery_status != null ? String(row.recovery_status) : null,
    prior_score: row.prior_score == null ? null : Number(row.prior_score),
    mrr_vnd: accountMrrFromContracts(row.contracts),
  };
}

function accountMrrFromContracts(raw: unknown): number | null {
  const list = Array.isArray(raw) ? raw : [];
  let sum = 0;
  let any = false;
  for (const item of list) {
    const ct = item as Record<string, unknown>;
    const status = String(ct.status ?? '').trim().toLowerCase();
    if (status !== 'active' && status !== 'renewing') continue;
    const mrr = monthlyRecurringVnd({
      billingType: String(ct.billing_type ?? '').trim().toLowerCase(),
      amountVnd: Number(ct.amount_vnd ?? 0),
      startsOn: dayStr(ct.starts_on),
      endsOn: dayStr(ct.ends_on),
    });
    if (mrr == null) continue;
    sum += mrr;
    any = true;
  }
  return any ? sum : null;
}

function padTrend(
  rows: Array<{ as_of: string; score: number | null }>,
): Array<{ as_of: string; score: number | null }> {
  const out = [...rows];
  while (out.length < 4) out.unshift({ as_of: '', score: null });
  return out.slice(-4);
}

function deriveSignals(input: {
  thin_data: boolean;
  override: { band: AmHealthBand; reason: string; until: string } | null;
  components: AmHealthComponents | null;
}): string[] {
  const out: string[] = [];
  if (input.thin_data) out.push('Dữ liệu mỏng');
  if (input.override) out.push(`Override ${input.override.band}`);
  const labels: Record<keyof AmHealthComponents, string> = {
    kpi_delivery: 'KPI Delivery',
    engagement: 'Engagement',
    financial: 'Financial',
    satisfaction: 'Satisfaction',
    contract_support: 'Contract & Support',
  };
  if (input.components) {
    for (const key of Object.keys(labels) as Array<keyof AmHealthComponents>) {
      if (input.components[key] < 60) out.push(`${labels[key]} thấp`);
    }
  }
  return out;
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
