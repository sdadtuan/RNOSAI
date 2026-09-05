import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import { AM_TENANT_ID } from './am-audit.repository';
import { DEFAULT_WEIGHTS } from './am-health.util';
import type { AmHealthComponents } from './am.types';

export type AmBandRanges = {
  healthy: [number, number];
  watch: [number, number];
  at_risk: [number, number];
  critical: [number, number];
};

export type AmSettings = {
  weights: AmHealthComponents;
  bands: AmBandRanges;
  quota_accounts_per_am: number;
  watch_ends_on_days: number;
  health_drop_alert: number;
  rollup_parent_health: boolean;
};

const DEFAULT_BANDS: AmBandRanges = {
  healthy: [80, 100],
  watch: [60, 79],
  at_risk: [40, 59],
  critical: [0, 39],
};

const DEFAULT_SETTINGS: AmSettings = {
  weights: { ...DEFAULT_WEIGHTS },
  bands: DEFAULT_BANDS,
  quota_accounts_per_am: 40,
  watch_ends_on_days: 30,
  health_drop_alert: 10,
  rollup_parent_health: false,
};

function isMissingRelation(err: unknown): boolean {
  const e = err as { code?: string; message?: string };
  return e.code === '42P01' || /does not exist/i.test(e.message ?? '');
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
  if (!raw || typeof raw !== 'object') return DEFAULT_BANDS;
  const row = raw as Record<string, unknown>;
  return {
    healthy: asPair(row.healthy, DEFAULT_BANDS.healthy),
    watch: asPair(row.watch, DEFAULT_BANDS.watch),
    at_risk: asPair(row.at_risk, DEFAULT_BANDS.at_risk),
    critical: asPair(row.critical, DEFAULT_BANDS.critical),
  };
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
      return {
        weights: parseWeights(row.weights_json),
        bands: parseBands(row.bands_json),
        quota_accounts_per_am: Number(row.quota_accounts_per_am ?? DEFAULT_SETTINGS.quota_accounts_per_am),
        watch_ends_on_days: Number(row.watch_ends_on_days ?? DEFAULT_SETTINGS.watch_ends_on_days),
        health_drop_alert: Number(row.health_drop_alert ?? DEFAULT_SETTINGS.health_drop_alert),
        rollup_parent_health: Boolean(row.rollup_parent_health),
      };
    } catch (err) {
      if (isMissingRelation(err)) {
        return { ...DEFAULT_SETTINGS, weights: { ...DEFAULT_WEIGHTS }, bands: { ...DEFAULT_BANDS } };
      }
      throw err;
    }
  }
}

@Injectable()
export class AmSettingsService {
  constructor(private readonly repo: AmSettingsRepository) {}

  get(): Promise<AmSettings> {
    return this.repo.load();
  }
}
