import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { createAppPgPool, shouldEndLocalPool } from '../config/pg-pool.factory';
import { AppConfigService } from '../config/app-config.service';
import { ensurePortalMetaInsightsSchema } from '../portal/portal-meta-insights-ddl.util';
import type { BreakdownRow } from './portal-meta-insights.graph';
import { InsightLevel, normalizeAdAccountDigits, type NormalizedInsightRow } from './portal-meta-insights.util';

export type SyncStateRow = {
  last_synced_at: string | null;
  last_error: string | null;
  last_breakdown_warnings: string | null;
  last_since: string | null;
  last_until: string | null;
  rows_upserted: number;
};

export type InsightDbRow = NormalizedInsightRow & {
  external_account_id: string;
};

@Injectable()
export class PortalMetaInsightsRepository implements OnModuleDestroy {
  private readonly log = new Logger(PortalMetaInsightsRepository.name);
  private pool: Pool | null = null;

  constructor(private readonly config: AppConfigService) {}

  private get db(): Pool {
    if (!this.pool) this.pool = createAppPgPool(this.config.databaseUrl);
    return this.pool;
  }

  async onModuleDestroy(): Promise<void> {
    if (shouldEndLocalPool()) await this.pool?.end();
    this.pool = null;
  }

  private async ensure(): Promise<void> {
    await ensurePortalMetaInsightsSchema(this.db, this.log, PortalMetaInsightsRepository.name);
  }

  async clientOwnsAdAccount(clientId: string, accountDigits: string): Promise<boolean> {
    await this.ensure();
    const id = normalizeAdAccountDigits(accountDigits);
    const result = await this.db.query(
      `SELECT 1 FROM portal_client_pages
       WHERE client_id = $1::uuid AND channel = 'ad_account' AND page_id = $2 AND active IS TRUE
       LIMIT 1`,
      [clientId, id],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async upsertInsightRow(clientId: string, accountDigits: string, row: NormalizedInsightRow): Promise<void> {
    await this.ensure();
    const account = normalizeAdAccountDigits(accountDigits);
    await this.db.query(
      `INSERT INTO daily_performance (
          client_id, channel, external_account_id, external_campaign_id, external_campaign_name,
          external_adset_id, external_adset_name, external_ad_id, external_ad_name,
          insight_level, performance_date, currency, spend, impressions, clicks, inline_link_clicks,
          reach, frequency, cpc, cpm, ctr, leads_platform, leads_crm, conversions, conversion_value,
          raw_insights, synced_at, sync_version
        ) VALUES (
          $1::uuid, 'meta', $2, $3, $4,
          $5, $6, $7, $8,
          $9, $10::date, 'VND', $11, $12, $13, $14,
          $15, $16, $17, $18, $19, $20, 0, $21, $22,
          $23::jsonb, NOW(), 1
        )
        ON CONFLICT (client_id, channel, external_campaign_id, external_adset_id, external_ad_id, insight_level, performance_date)
        DO UPDATE SET
          external_account_id = EXCLUDED.external_account_id,
          external_campaign_name = EXCLUDED.external_campaign_name,
          external_adset_name = EXCLUDED.external_adset_name,
          external_ad_name = EXCLUDED.external_ad_name,
          spend = EXCLUDED.spend,
          impressions = EXCLUDED.impressions,
          clicks = EXCLUDED.clicks,
          inline_link_clicks = EXCLUDED.inline_link_clicks,
          reach = EXCLUDED.reach,
          frequency = EXCLUDED.frequency,
          cpc = EXCLUDED.cpc,
          cpm = EXCLUDED.cpm,
          ctr = EXCLUDED.ctr,
          leads_platform = EXCLUDED.leads_platform,
          conversions = EXCLUDED.conversions,
          conversion_value = EXCLUDED.conversion_value,
          raw_insights = EXCLUDED.raw_insights,
          synced_at = NOW()`,
      [
        clientId,
        account,
        row.external_campaign_id,
        row.external_campaign_name,
        row.external_adset_id,
        row.external_adset_name,
        row.external_ad_id,
        row.external_ad_name,
        row.insight_level,
        row.performance_date,
        row.spend,
        row.impressions,
        row.clicks,
        row.inline_link_clicks,
        row.reach,
        row.frequency,
        row.cpc,
        row.cpm,
        row.ctr,
        row.leads_platform,
        row.conversions,
        row.conversion_value,
        JSON.stringify(row.raw_insights),
      ],
    );
  }

  async upsertBreakdownRow(clientId: string, accountDigits: string, row: BreakdownRow): Promise<void> {
    await this.ensure();
    const account = normalizeAdAccountDigits(accountDigits);
    await this.db.query(
      `INSERT INTO daily_performance_breakdown (
          client_id, channel, external_account_id, external_campaign_id, performance_date,
          breakdown_type, breakdown_value, spend, impressions, clicks, leads_platform, raw_insights, synced_at
        ) VALUES (
          $1::uuid, 'meta', $2, $3, $4::date, $5, $6, $7, $8, $9, $10, $11::jsonb, NOW()
        )
        ON CONFLICT ON CONSTRAINT daily_performance_breakdown_unique
        DO UPDATE SET
          external_account_id = EXCLUDED.external_account_id,
          spend = EXCLUDED.spend,
          impressions = EXCLUDED.impressions,
          clicks = EXCLUDED.clicks,
          leads_platform = EXCLUDED.leads_platform,
          raw_insights = EXCLUDED.raw_insights,
          synced_at = NOW()`,
      [
        clientId,
        account,
        row.external_campaign_id,
        row.performance_date,
        row.breakdown_type,
        row.breakdown_value,
        row.spend,
        row.impressions,
        row.clicks,
        row.leads_platform,
        JSON.stringify(row.raw_insights),
      ],
    );
  }

  async readSyncState(clientId: string, accountDigits: string): Promise<SyncStateRow | null> {
    await this.ensure();
    const account = normalizeAdAccountDigits(accountDigits);
    const result = await this.db.query(
      `SELECT last_synced_at, last_error, last_breakdown_warnings, last_since::text, last_until::text, rows_upserted
       FROM meta_ad_account_sync_state
       WHERE client_id = $1::uuid AND external_account_id = $2`,
      [clientId, account],
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      last_synced_at: row.last_synced_at ? new Date(row.last_synced_at).toISOString() : null,
      last_error: row.last_error != null ? String(row.last_error) : null,
      last_breakdown_warnings:
        row.last_breakdown_warnings != null ? String(row.last_breakdown_warnings) : null,
      last_since: row.last_since ? String(row.last_since) : null,
      last_until: row.last_until ? String(row.last_until) : null,
      rows_upserted: Number(row.rows_upserted ?? 0),
    };
  }

  async writeSyncState(
    clientId: string,
    accountDigits: string,
    patch: {
      last_synced_at?: Date | null;
      last_error?: string | null;
      last_breakdown_warnings?: string | null;
      last_since?: string | null;
      last_until?: string | null;
      rows_upserted?: number;
    },
  ): Promise<void> {
    await this.ensure();
    const account = normalizeAdAccountDigits(accountDigits);
    await this.db.query(
      `INSERT INTO meta_ad_account_sync_state (
          client_id, external_account_id, last_synced_at, last_error, last_breakdown_warnings,
          last_since, last_until, rows_upserted, updated_at
        ) VALUES ($1::uuid, $2, $3, $4, $5, $6::date, $7::date, COALESCE($8, 0), NOW())
        ON CONFLICT (client_id, external_account_id)
        DO UPDATE SET
          last_synced_at = COALESCE(EXCLUDED.last_synced_at, meta_ad_account_sync_state.last_synced_at),
          last_error = EXCLUDED.last_error,
          last_breakdown_warnings = EXCLUDED.last_breakdown_warnings,
          last_since = COALESCE(EXCLUDED.last_since, meta_ad_account_sync_state.last_since),
          last_until = COALESCE(EXCLUDED.last_until, meta_ad_account_sync_state.last_until),
          rows_upserted = COALESCE(EXCLUDED.rows_upserted, meta_ad_account_sync_state.rows_upserted),
          updated_at = NOW()`,
      [
        clientId,
        account,
        patch.last_synced_at ?? null,
        patch.last_error ?? null,
        patch.last_breakdown_warnings ?? null,
        patch.last_since ?? null,
        patch.last_until ?? null,
        patch.rows_upserted ?? null,
      ],
    );
  }

  async queryInsights(
    clientId: string,
    accountDigits: string,
    since: string,
    until: string,
    level?: InsightLevel,
  ): Promise<InsightDbRow[]> {
    await this.ensure();
    const account = normalizeAdAccountDigits(accountDigits);
    const levelClause = level ? `AND insight_level = $5` : '';
    const params: unknown[] = [clientId, account, since, until];
    if (level) params.push(level);
    const result = await this.db.query(
      `SELECT insight_level, performance_date::text AS performance_date,
              external_campaign_id, external_campaign_name,
              external_adset_id, external_adset_name, external_ad_id, external_ad_name,
              spend::float8 AS spend, impressions::int AS impressions, clicks::int AS clicks,
              inline_link_clicks::int AS inline_link_clicks,
              reach::int AS reach, frequency::float8 AS frequency,
              cpc::float8 AS cpc, cpm::float8 AS cpm, ctr::float8 AS ctr,
              leads_platform::int AS leads_platform,
              conversions::float8 AS conversions, conversion_value::float8 AS conversion_value,
              raw_insights
       FROM daily_performance
       WHERE client_id = $1::uuid
         AND channel = 'meta'
         AND regexp_replace(COALESCE(external_account_id, ''), '^act_', '', 'i') = $2
         AND performance_date BETWEEN $3::date AND $4::date
         ${levelClause}
       ORDER BY performance_date DESC, spend DESC`,
      params,
    );
    return result.rows.map((r) => ({
      insight_level: r.insight_level as InsightLevel,
      performance_date: String(r.performance_date),
      external_campaign_id: String(r.external_campaign_id ?? ''),
      external_campaign_name: r.external_campaign_name != null ? String(r.external_campaign_name) : null,
      external_adset_id: String(r.external_adset_id ?? ''),
      external_adset_name: r.external_adset_name != null ? String(r.external_adset_name) : null,
      external_ad_id: String(r.external_ad_id ?? ''),
      external_ad_name: r.external_ad_name != null ? String(r.external_ad_name) : null,
      spend: Number(r.spend ?? 0),
      impressions: Number(r.impressions ?? 0),
      clicks: Number(r.clicks ?? 0),
      inline_link_clicks: r.inline_link_clicks != null ? Number(r.inline_link_clicks) : null,
      reach: r.reach != null ? Number(r.reach) : null,
      frequency: r.frequency != null ? Number(r.frequency) : null,
      cpc: r.cpc != null ? Number(r.cpc) : null,
      cpm: r.cpm != null ? Number(r.cpm) : null,
      ctr: r.ctr != null ? Number(r.ctr) : null,
      leads_platform: Number(r.leads_platform ?? 0),
      conversions: Number(r.conversions ?? 0),
      conversion_value: Number(r.conversion_value ?? 0),
      raw_insights: (r.raw_insights ?? {}) as Record<string, unknown>,
      external_account_id: account,
    }));
  }

  async queryBreakdowns(
    clientId: string,
    accountDigits: string,
    since: string,
    until: string,
    breakdownType?: string,
  ): Promise<BreakdownRow[]> {
    await this.ensure();
    const account = normalizeAdAccountDigits(accountDigits);
    const typeClause = breakdownType ? `AND breakdown_type = $5` : '';
    const params: unknown[] = [clientId, account, since, until];
    if (breakdownType) params.push(breakdownType);
    const result = await this.db.query(
      `SELECT external_campaign_id, performance_date::text AS performance_date,
              breakdown_type, breakdown_value,
              spend::float8 AS spend, impressions::int AS impressions, clicks::int AS clicks,
              leads_platform::int AS leads_platform, raw_insights
       FROM daily_performance_breakdown
       WHERE client_id = $1::uuid
         AND channel = 'meta'
         AND regexp_replace(COALESCE(external_account_id, ''), '^act_', '', 'i') = $2
         AND performance_date BETWEEN $3::date AND $4::date
         ${typeClause}
       ORDER BY performance_date DESC, spend DESC
       LIMIT 5000`,
      params,
    );
    return result.rows.map((r) => ({
      external_campaign_id: String(r.external_campaign_id),
      performance_date: String(r.performance_date),
      breakdown_type: r.breakdown_type,
      breakdown_value: String(r.breakdown_value),
      spend: Number(r.spend ?? 0),
      impressions: Number(r.impressions ?? 0),
      clicks: Number(r.clicks ?? 0),
      leads_platform: Number(r.leads_platform ?? 0),
      raw_insights: (r.raw_insights ?? {}) as Record<string, unknown>,
    }));
  }

  async listActiveAdAccountPages(): Promise<Array<{ client_id: string; page_id: string }>> {
    await this.ensure();
    const result = await this.db.query(
      `SELECT client_id::text, page_id FROM portal_client_pages
       WHERE channel = 'ad_account' AND active IS TRUE
       ORDER BY created_at ASC`,
    );
    return result.rows.map((r) => ({ client_id: String(r.client_id), page_id: String(r.page_id) }));
  }
}
