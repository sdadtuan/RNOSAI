import { Injectable, OnModuleDestroy, Optional } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import { AmAuditRepository, AM_TENANT_ID } from './am-audit.repository';
import { AmDashboardService } from './am-dashboard.service';
import { bandFromScore, DEFAULT_WEIGHTS, isActiveBook, weightedScore } from './am-health.util';
import type { AmAmStatus, AmHealthBand, AmHealthComponents } from './am.types';

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

export type AmHealthStore = {
  listAccounts(): Promise<AmHealthAccountRow[]>;
  upsertSnapshot(input: AmHealthSnapshotInput): Promise<void>;
  loadWeights(): Promise<AmHealthComponents>;
};

const ICT = 'Asia/Ho_Chi_Minh';
const SCORECARD_VERSION = 1;

export const HEALTH_SNAPSHOT_UPSERT = `
INSERT INTO crm_am_health_snapshots (
  tenant_id, agency_client_id, as_of, score, band, components_json,
  scorecard_version, thin_data
) VALUES ($1, $2::uuid, $3::date, $4, $5, $6::jsonb, $7, $8)
ON CONFLICT (tenant_id, agency_client_id, as_of) DO UPDATE SET
  score = EXCLUDED.score,
  band = EXCLUDED.band,
  components_json = EXCLUDED.components_json,
  scorecard_version = EXCLUDED.scorecard_version,
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
    await this.db.query(HEALTH_SNAPSHOT_UPSERT, [
      AM_TENANT_ID,
      input.agency_client_id,
      input.as_of,
      input.score,
      input.band,
      JSON.stringify(input.components),
      input.scorecard_version,
      input.thin_data,
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
  ) {}

  async recompute(input: { asOf?: string; actorStaffId?: number } = {}): Promise<AmHealthRecomputeResult> {
    const asOf = parseAsOf(input.asOf);
    const [accounts, weights] = await Promise.all([this.repo.listAccounts(), this.repo.loadWeights()]);
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
      const score = round1(weightedScore(components, weights));
      const band = bandFromScore(score);
      await this.repo.upsertSnapshot({
        agency_client_id: account.agency_client_id,
        as_of: asOf,
        score,
        band,
        components,
        scorecard_version: SCORECARD_VERSION,
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
}
