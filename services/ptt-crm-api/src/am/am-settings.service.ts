import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import { AmAuditRepository, AM_TENANT_ID } from './am-audit.repository';
import { amThrow } from './am-http';
import { DEFAULT_BANDS, DEFAULT_WEIGHTS, type AmBandRanges } from './am-health.util';
import type { AmHealthComponents } from './am.types';

export type { AmBandRanges };

export type AmSettings = {
  weights: AmHealthComponents;
  bands: AmBandRanges;
  quota_accounts_per_am: number;
  watch_ends_on_days: number;
  health_drop_alert: number;
  rollup_parent_health: boolean;
  scorecard_version: number;
};

export type AmPublishSettingsBody = {
  weights: AmHealthComponents;
  bands: AmBandRanges;
  quota_accounts_per_am?: number;
  watch_ends_on_days?: number;
  health_drop_alert?: number;
  rollup_parent_health?: boolean;
};

const WEIGHT_KEYS: Array<keyof AmHealthComponents> = [
  'kpi_delivery',
  'engagement',
  'financial',
  'satisfaction',
  'contract_support',
];

const BAND_KEYS: Array<keyof AmBandRanges> = ['healthy', 'watch', 'at_risk', 'critical'];

const DEFAULT_SETTINGS: AmSettings = {
  weights: { ...DEFAULT_WEIGHTS },
  bands: { ...DEFAULT_BANDS },
  quota_accounts_per_am: 40,
  watch_ends_on_days: 30,
  health_drop_alert: 10,
  rollup_parent_health: false,
  scorecard_version: 1,
};

function isMissingRelation(err: unknown): boolean {
  const e = err as { code?: string; message?: string };
  return e.code === '42P01' || /does not exist/i.test(e.message ?? '');
}

function isUndefinedColumn(err: unknown): boolean {
  return (err as { code?: string }).code === '42703';
}

function asPair(value: unknown, fallback: [number, number]): [number, number] {
  if (!Array.isArray(value) || value.length < 2) return fallback;
  const a = Number(value[0]);
  const b = Number(value[1]);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return fallback;
  return [a, b];
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

function parseBands(raw: unknown): AmBandRanges {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_BANDS };
  const row = raw as Record<string, unknown>;
  return {
    healthy: asPair(row.healthy, DEFAULT_BANDS.healthy),
    watch: asPair(row.watch, DEFAULT_BANDS.watch),
    at_risk: asPair(row.at_risk, DEFAULT_BANDS.at_risk),
    critical: asPair(row.critical, DEFAULT_BANDS.critical),
  };
}

function rowToSettings(row: Record<string, unknown>, versionFallback = 1): AmSettings {
  const version = Number(row.scorecard_version);
  return {
    weights: parseWeights(row.weights_json),
    bands: parseBands(row.bands_json),
    quota_accounts_per_am: Number(row.quota_accounts_per_am ?? DEFAULT_SETTINGS.quota_accounts_per_am),
    watch_ends_on_days: Number(row.watch_ends_on_days ?? DEFAULT_SETTINGS.watch_ends_on_days),
    health_drop_alert: Number(row.health_drop_alert ?? DEFAULT_SETTINGS.health_drop_alert),
    rollup_parent_health: Boolean(row.rollup_parent_health),
    scorecard_version: Number.isFinite(version) && version > 0 ? version : versionFallback,
  };
}

export function validateSettingsWeights(weights: AmHealthComponents): 'weights_sum' | null {
  let sum = 0;
  for (const key of WEIGHT_KEYS) {
    const n = Number(weights[key]);
    if (!Number.isFinite(n) || n < 0) return 'weights_sum';
    sum += n;
  }
  return sum === 100 ? null : 'weights_sum';
}

export function validateSettingsBands(bands: AmBandRanges): 'bands_overlap' | null {
  const ranges: Array<[number, number]> = [];
  for (const key of BAND_KEYS) {
    const pair = bands[key];
    if (!Array.isArray(pair) || pair.length < 2) return 'bands_overlap';
    const lo = Number(pair[0]);
    const hi = Number(pair[1]);
    if (!Number.isInteger(lo) || !Number.isInteger(hi) || lo > hi) return 'bands_overlap';
    ranges.push([lo, hi]);
  }
  ranges.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (ranges[0][0] !== 0 || ranges[ranges.length - 1][1] !== 100) return 'bands_overlap';
  for (let i = 1; i < ranges.length; i += 1) {
    if (ranges[i][0] !== ranges[i - 1][1] + 1) return 'bands_overlap';
  }
  return null;
}

@Injectable()
export class AmSettingsRepository implements OnModuleDestroy {
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

  async load(): Promise<AmSettings> {
    try {
      return await this.loadWithVersion();
    } catch (err) {
      if (isUndefinedColumn(err)) {
        return this.loadWithoutVersion();
      }
      if (isMissingRelation(err)) {
        return { ...DEFAULT_SETTINGS, weights: { ...DEFAULT_WEIGHTS }, bands: { ...DEFAULT_BANDS } };
      }
      throw err;
    }
  }

  async save(next: AmSettings, actorStaffId: number): Promise<AmSettings> {
    try {
      return await this.saveWithVersion(next, actorStaffId);
    } catch (err) {
      if (isUndefinedColumn(err)) {
        await this.saveWithoutVersion(next, actorStaffId);
        return { ...next, scorecard_version: 1 };
      }
      if (isMissingRelation(err)) {
        return { ...next, scorecard_version: next.scorecard_version || 1 };
      }
      throw err;
    }
  }

  private async loadWithVersion(): Promise<AmSettings> {
    const result = await this.db.query(
      `SELECT weights_json, bands_json, quota_accounts_per_am, watch_ends_on_days,
              health_drop_alert, rollup_parent_health, scorecard_version
         FROM crm_am_settings
        WHERE tenant_id = $1
        LIMIT 1`,
      [AM_TENANT_ID],
    );
    const row = result.rows[0];
    if (!row) return { ...DEFAULT_SETTINGS, weights: { ...DEFAULT_WEIGHTS }, bands: { ...DEFAULT_BANDS } };
    return rowToSettings(row);
  }

  private async loadWithoutVersion(): Promise<AmSettings> {
    try {
      const result = await this.db.query(
        `SELECT weights_json, bands_json, quota_accounts_per_am, watch_ends_on_days,
                health_drop_alert, rollup_parent_health
           FROM crm_am_settings
          WHERE tenant_id = $1
          LIMIT 1`,
        [AM_TENANT_ID],
      );
      const row = result.rows[0];
      if (!row) return { ...DEFAULT_SETTINGS, weights: { ...DEFAULT_WEIGHTS }, bands: { ...DEFAULT_BANDS } };
      return rowToSettings(row, 1);
    } catch (err) {
      if (isMissingRelation(err)) {
        return { ...DEFAULT_SETTINGS, weights: { ...DEFAULT_WEIGHTS }, bands: { ...DEFAULT_BANDS } };
      }
      throw err;
    }
  }

  private async saveWithVersion(next: AmSettings, actorStaffId: number): Promise<AmSettings> {
    const result = await this.db.query(
      `INSERT INTO crm_am_settings (
         tenant_id, weights_json, bands_json, quota_accounts_per_am, watch_ends_on_days,
         health_drop_alert, rollup_parent_health, updated_at, updated_by_staff_id, scorecard_version
       ) VALUES ($1, $2::jsonb, $3::jsonb, $4, $5, $6, $7, now(), $8, $9)
       ON CONFLICT (tenant_id) DO UPDATE SET
         weights_json = EXCLUDED.weights_json,
         bands_json = EXCLUDED.bands_json,
         quota_accounts_per_am = EXCLUDED.quota_accounts_per_am,
         watch_ends_on_days = EXCLUDED.watch_ends_on_days,
         health_drop_alert = EXCLUDED.health_drop_alert,
         rollup_parent_health = EXCLUDED.rollup_parent_health,
         updated_at = now(),
         updated_by_staff_id = EXCLUDED.updated_by_staff_id,
         scorecard_version = EXCLUDED.scorecard_version
       RETURNING weights_json, bands_json, quota_accounts_per_am, watch_ends_on_days,
                 health_drop_alert, rollup_parent_health, scorecard_version`,
      [
        AM_TENANT_ID,
        JSON.stringify(next.weights),
        JSON.stringify(next.bands),
        next.quota_accounts_per_am,
        next.watch_ends_on_days,
        next.health_drop_alert,
        next.rollup_parent_health,
        actorStaffId > 0 ? actorStaffId : null,
        next.scorecard_version,
      ],
    );
    return rowToSettings(result.rows[0] ?? next);
  }

  private async saveWithoutVersion(next: AmSettings, actorStaffId: number): Promise<void> {
    await this.db.query(
      `INSERT INTO crm_am_settings (
         tenant_id, weights_json, bands_json, quota_accounts_per_am, watch_ends_on_days,
         health_drop_alert, rollup_parent_health, updated_at, updated_by_staff_id
       ) VALUES ($1, $2::jsonb, $3::jsonb, $4, $5, $6, $7, now(), $8)
       ON CONFLICT (tenant_id) DO UPDATE SET
         weights_json = EXCLUDED.weights_json,
         bands_json = EXCLUDED.bands_json,
         quota_accounts_per_am = EXCLUDED.quota_accounts_per_am,
         watch_ends_on_days = EXCLUDED.watch_ends_on_days,
         health_drop_alert = EXCLUDED.health_drop_alert,
         rollup_parent_health = EXCLUDED.rollup_parent_health,
         updated_at = now(),
         updated_by_staff_id = EXCLUDED.updated_by_staff_id`,
      [
        AM_TENANT_ID,
        JSON.stringify(next.weights),
        JSON.stringify(next.bands),
        next.quota_accounts_per_am,
        next.watch_ends_on_days,
        next.health_drop_alert,
        next.rollup_parent_health,
        actorStaffId > 0 ? actorStaffId : null,
      ],
    );
  }
}

@Injectable()
export class AmSettingsService {
  constructor(
    private readonly repo: AmSettingsRepository,
    private readonly audit: AmAuditRepository,
  ) {}

  get(): Promise<AmSettings> {
    return this.repo.load();
  }

  async publish(body: AmPublishSettingsBody, actorStaffId: number): Promise<AmSettings> {
    const weights = parsePublishWeights(body.weights);
    const bands = parsePublishBands(body.bands);
    const weightsErr = validateSettingsWeights(weights);
    if (weightsErr) amThrow(400, { error: weightsErr });
    const bandsErr = validateSettingsBands(bands);
    if (bandsErr) amThrow(400, { error: bandsErr });

    const current = await this.repo.load();
    const next: AmSettings = {
      weights,
      bands,
      quota_accounts_per_am: intOr(body.quota_accounts_per_am, current.quota_accounts_per_am),
      watch_ends_on_days: intOr(body.watch_ends_on_days, current.watch_ends_on_days),
      health_drop_alert: intOr(body.health_drop_alert, current.health_drop_alert),
      rollup_parent_health:
        typeof body.rollup_parent_health === 'boolean'
          ? body.rollup_parent_health
          : current.rollup_parent_health,
      scorecard_version: current.scorecard_version + 1,
    };
    const saved = await this.repo.save(next, actorStaffId);
    await this.audit.insert({
      actor_staff_id: actorStaffId > 0 ? actorStaffId : null,
      action: 'settings.publish',
      entity_type: 'am_settings',
      payload_json: { scorecard_version: saved.scorecard_version },
    });
    return saved;
  }
}

function parsePublishWeights(raw: unknown): AmHealthComponents {
  if (!raw || typeof raw !== 'object') {
    amThrow(400, { error: 'weights_sum' });
  }
  const row = raw as Record<string, unknown>;
  return {
    kpi_delivery: Number(row.kpi_delivery),
    engagement: Number(row.engagement),
    financial: Number(row.financial),
    satisfaction: Number(row.satisfaction),
    contract_support: Number(row.contract_support),
  };
}

function parsePublishBands(raw: unknown): AmBandRanges {
  if (!raw || typeof raw !== 'object') {
    amThrow(400, { error: 'bands_overlap' });
  }
  const row = raw as Record<string, unknown>;
  const pair = (key: keyof AmBandRanges): [number, number] => {
    const value = row[key];
    if (!Array.isArray(value) || value.length < 2) return [Number.NaN, Number.NaN];
    return [Number(value[0]), Number(value[1])];
  };
  return {
    healthy: pair('healthy'),
    watch: pair('watch'),
    at_risk: pair('at_risk'),
    critical: pair('critical'),
  };
}

function intOr(value: unknown, fallback: number): number {
  if (value == null || value === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}
