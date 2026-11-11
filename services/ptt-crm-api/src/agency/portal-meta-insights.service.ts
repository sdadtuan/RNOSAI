import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { MetaBusinessTokenService } from './meta-business-token.service';
import { fetchAllBreakdowns, fetchInsightsForWindow } from './portal-meta-insights.graph';
import { PortalMetaInsightsRepository } from './portal-meta-insights.repository';
import {
  addDays,
  buildSyncStateFromErrors,
  chunkDateRange,
  INSIGHT_LEVELS,
  InsightLevel,
  isoDateOnly,
  normalizeAdAccountDigits,
  summarizeBreakdownWarnings,
} from './portal-meta-insights.util';
import { PortalClientPagesRepository } from './portal-client-pages.repository';

export type SyncRowsByLevel = Record<InsightLevel | 'breakdown', number>;

export type SyncOutcome = {
  ok: boolean;
  account_id: string;
  since: string;
  until: string;
  rows: SyncRowsByLevel;
  last_synced_at: string | null;
  error?: string;
  breakdown_warnings?: string;
};

const MAX_RANGE_DAYS = 37 * 30;
const CHUNK_DAYS = 30;
const DEFAULT_BACKFILL_DAYS = 90;
const INCREMENTAL_OVERLAP_DAYS = 3;

@Injectable()
export class PortalMetaInsightsService {
  constructor(
    private readonly repo: PortalMetaInsightsRepository,
    private readonly tokenService: MetaBusinessTokenService,
    private readonly pagesRepo: PortalClientPagesRepository,
  ) {}

  private async requireOwnedAccount(clientId: string, accountIdRaw: string): Promise<string> {
    const digits = normalizeAdAccountDigits(accountIdRaw);
    if (!/^\d{6,32}$/.test(digits)) throw new BadRequestException({ error: 'invalid_account_id' });
    const owns = await this.repo.clientOwnsAdAccount(clientId, digits);
    if (!owns) throw new NotFoundException({ error: 'account_not_found' });
    return digits;
  }

  private resolveRange(body?: { since?: string; until?: string }, incremental = false): { since: string; until: string } {
    const today = isoDateOnly(new Date());
    let until = String(body?.until ?? today).slice(0, 10);
    let since = String(body?.since ?? '').slice(0, 10);
    if (!since) {
      since = incremental
        ? addDays(until, -(INCREMENTAL_OVERLAP_DAYS - 1))
        : addDays(until, -(DEFAULT_BACKFILL_DAYS - 1));
    }
    if (since > until) throw new BadRequestException({ error: 'invalid_date_range' });
    const span = Math.ceil((Date.parse(until) - Date.parse(since)) / 86400000) + 1;
    if (span > MAX_RANGE_DAYS) throw new BadRequestException({ error: 'date_range_too_large' });
    return { since, until };
  }

  async syncAccount(
    clientId: string,
    accountIdRaw: string,
    body?: { since?: string; until?: string },
    options?: { incremental?: boolean },
  ): Promise<SyncOutcome> {
    const accountId = await this.requireOwnedAccount(clientId, accountIdRaw);
    const { since, until } = this.resolveRange(body, options?.incremental ?? false);

    let accessToken: string;
    try {
      accessToken = await this.tokenService.getAccessToken();
    } catch (err) {
      let message = 'business_token_unreadable';
      if (err instanceof BadRequestException) {
        const body = err.getResponse();
        message =
          typeof body === 'object' && body && 'error' in body
            ? String((body as { error?: string }).error ?? 'business_token_missing')
            : 'business_token_missing';
      }
      await this.repo.writeSyncState(clientId, accountId, {
        last_error: message,
        last_since: since,
        last_until: until,
      });
      return {
        ok: false,
        account_id: accountId,
        since,
        until,
        rows: { account: 0, campaign: 0, adset: 0, ad: 0, breakdown: 0 },
        last_synced_at: null,
        error: message,
      };
    }

    const rows: SyncRowsByLevel = { account: 0, campaign: 0, adset: 0, ad: 0, breakdown: 0 };
    let fatalError: string | null = null;
    const windows = chunkDateRange(since, until, CHUNK_DAYS);

    for (const window of windows) {
      if (fatalError) break;
      for (const level of INSIGHT_LEVELS) {
        const fetched = await fetchInsightsForWindow(accessToken, accountId, level, window.since, window.until);
        if (!fetched.ok) {
          fatalError = fetched.error;
          break;
        }
        for (const row of fetched.rows) {
          await this.repo.upsertInsightRow(clientId, accountId, row);
          rows[level] += 1;
        }
      }
    }

    const breakdownErrors: string[] = [];
    if (!fatalError) {
      for (const window of windows) {
        const bd = await fetchAllBreakdowns(accessToken, accountId, window.since, window.until);
        breakdownErrors.push(...bd.errors);
        for (const row of bd.rows) {
          await this.repo.upsertBreakdownRow(clientId, accountId, row);
          rows.breakdown += 1;
        }
      }
    }

    const now = new Date();
    const syncErrors = buildSyncStateFromErrors(fatalError, breakdownErrors);
    const totalRows = rows.account + rows.campaign + rows.adset + rows.ad + rows.breakdown;

    await this.repo.writeSyncState(clientId, accountId, {
      last_synced_at: fatalError ? null : now,
      last_error: syncErrors.last_error,
      last_breakdown_warnings: syncErrors.last_breakdown_warnings,
      last_since: since,
      last_until: until,
      rows_upserted: totalRows,
    });

    const state = await this.repo.readSyncState(clientId, accountId);

    const breakdownWarnings = fatalError ? undefined : summarizeBreakdownWarnings(breakdownErrors) ?? undefined;

    return {
      ok: !fatalError,
      account_id: accountId,
      since,
      until,
      rows,
      last_synced_at: state?.last_synced_at ?? (fatalError ? null : now.toISOString()),
      error: fatalError ?? undefined,
      breakdown_warnings: breakdownWarnings,
    };
  }

  async syncActiveAccountsIncremental(): Promise<
    Array<{ client_id: string; account_id: string; ok: boolean; rows: number; error?: string }>
  > {
    const pages = await this.repo.listActiveAdAccountPages();
    const out: Array<{ client_id: string; account_id: string; ok: boolean; rows: number; error?: string }> = [];
    for (const page of pages) {
      try {
        const result = await this.syncAccount(page.client_id, page.page_id, undefined, { incremental: true });
        const rows =
          result.rows.account + result.rows.campaign + result.rows.adset + result.rows.ad + result.rows.breakdown;
        out.push({
          client_id: page.client_id,
          account_id: result.account_id,
          ok: result.ok,
          rows,
          error: result.error,
        });
      } catch (err) {
        out.push({
          client_id: page.client_id,
          account_id: page.page_id,
          ok: false,
          rows: 0,
          error: err instanceof Error ? err.message : 'sync_failed',
        });
      }
    }
    return out;
  }

  async getInsights(
    clientId: string,
    accountIdRaw: string,
    query: { since?: string; until?: string; level?: string },
  ): Promise<Record<string, unknown>> {
    const accountId = await this.requireOwnedAccount(clientId, accountIdRaw);
    const { since, until } = this.resolveRange({ since: query.since, until: query.until });

    const accountRows = await this.repo.queryInsights(clientId, accountId, since, until, 'account');
    const campaignRows = await this.repo.queryInsights(clientId, accountId, since, until, 'campaign');
    const adsetRows = await this.repo.queryInsights(clientId, accountId, since, until, 'adset');
    const adRows = await this.repo.queryInsights(clientId, accountId, since, until, 'ad');
    const breakdowns = await this.repo.queryBreakdowns(clientId, accountId, since, until);

    const kpi = this.aggregateKpi(accountRows.length ? accountRows : campaignRows);
    const daily = this.dailySeries(accountRows.length ? accountRows : campaignRows);

    const leads = await this.pagesRepo.listLeadsForAdAccounts(clientId, [accountId]);
    const leadsInRange = leads.filter((l) => {
      const day = String(l.created_at ?? '').slice(0, 10);
      return day >= since && day <= until;
    });

    const sync = await this.repo.readSyncState(clientId, accountId);

    return {
      ok: true,
      account_id: accountId,
      since,
      until,
      kpi,
      daily,
      tables: {
        campaign: this.aggregateEntityTable(campaignRows, 'external_campaign_id', 'external_campaign_name'),
        adset: this.aggregateEntityTable(adsetRows, 'external_adset_id', 'external_adset_name'),
        ad: this.aggregateEntityTable(adRows, 'external_ad_id', 'external_ad_name'),
      },
      breakdowns: this.aggregateBreakdowns(breakdowns),
      leads: leadsInRange,
      sync: sync
        ? {
            last_synced_at: sync.last_synced_at,
            last_error: sync.last_error,
            last_breakdown_warnings: sync.last_breakdown_warnings,
            last_since: sync.last_since,
            last_until: sync.last_until,
          }
        : { last_synced_at: null, last_error: null, last_breakdown_warnings: null },
    };
  }

  buildCsv(
    clientId: string,
    accountIdRaw: string,
    query: { since?: string; until?: string; level?: string },
  ): Promise<string> {
    return this.getInsights(clientId, accountIdRaw, query).then((payload) => {
      const level = (query.level ?? 'campaign') as 'campaign' | 'adset' | 'ad';
      const table =
        level === 'adset'
          ? (payload.tables as { adset: unknown[] }).adset
          : level === 'ad'
            ? (payload.tables as { ad: unknown[] }).ad
            : (payload.tables as { campaign: unknown[] }).campaign;
      const headers = ['id', 'name', 'spend', 'impressions', 'clicks', 'ctr', 'cpc', 'cpm', 'leads_platform'];
      const lines = [headers.join(',')];
      for (const row of table as Array<Record<string, unknown>>) {
        lines.push(
          [
            row.id,
            `"${String(row.name ?? '').replace(/"/g, '""')}"`,
            row.spend,
            row.impressions,
            row.clicks,
            row.ctr ?? '',
            row.cpc ?? '',
            row.cpm ?? '',
            row.leads_platform,
          ].join(','),
        );
      }
      return lines.join('\n');
    });
  }

  private aggregateKpi(rows: Array<{ spend: number; impressions: number; clicks: number; reach: number | null; ctr: number | null; cpc: number | null; cpm: number | null; leads_platform: number; conversions: number; conversion_value: number }>) {
    const spend = rows.reduce((s, r) => s + r.spend, 0);
    const impressions = rows.reduce((s, r) => s + r.impressions, 0);
    const clicks = rows.reduce((s, r) => s + r.clicks, 0);
    const reach = rows.reduce((s, r) => s + (r.reach ?? 0), 0);
    const leads = rows.reduce((s, r) => s + r.leads_platform, 0);
    const purchases = rows.reduce((s, r) => s + r.conversions, 0);
    const conversionValue = rows.reduce((s, r) => s + r.conversion_value, 0);
    const ctr = impressions > 0 ? clicks / impressions : null;
    const cpc = clicks > 0 ? spend / clicks : null;
    const cpm = impressions > 0 ? (spend / impressions) * 1000 : null;
    const cpl = leads > 0 ? spend / leads : null;
    const roas = spend > 0 && conversionValue > 0 ? conversionValue / spend : null;
    return { spend, impressions, reach, clicks, ctr, cpc, cpm, leads_platform: leads, cpl, purchases, conversion_value: conversionValue, roas };
  }

  private dailySeries(
    rows: Array<{ performance_date: string; spend: number; leads_platform: number }>,
  ): Array<{ date: string; spend: number; leads_platform: number }> {
    const map = new Map<string, { spend: number; leads_platform: number }>();
    for (const r of rows) {
      const cur = map.get(r.performance_date) ?? { spend: 0, leads_platform: 0 };
      cur.spend += r.spend;
      cur.leads_platform += r.leads_platform;
      map.set(r.performance_date, cur);
    }
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, v]) => ({ date, spend: v.spend, leads_platform: v.leads_platform }));
  }

  private aggregateEntityTable(
    rows: Array<{
      external_campaign_id: string;
      external_campaign_name: string | null;
      external_adset_id: string;
      external_adset_name: string | null;
      external_ad_id: string;
      external_ad_name: string | null;
      spend: number;
      impressions: number;
      clicks: number;
      ctr: number | null;
      cpc: number | null;
      cpm: number | null;
      leads_platform: number;
    }>,
    idKey: 'external_campaign_id' | 'external_adset_id' | 'external_ad_id',
    nameKey: 'external_campaign_name' | 'external_adset_name' | 'external_ad_name',
  ) {
    const map = new Map<string, Record<string, number | string | null>>();
    for (const r of rows) {
      const id = String(r[idKey] ?? '');
      if (!id) continue;
      const cur = map.get(id) ?? {
        id,
        name: (r[nameKey] as string | null) ?? id,
        spend: 0,
        impressions: 0,
        clicks: 0,
        leads_platform: 0,
        ctr: null as number | null,
        cpc: null as number | null,
        cpm: null as number | null,
      };
      cur.spend = Number(cur.spend) + r.spend;
      cur.impressions = Number(cur.impressions) + r.impressions;
      cur.clicks = Number(cur.clicks) + r.clicks;
      cur.leads_platform = Number(cur.leads_platform) + r.leads_platform;
      map.set(id, cur);
    }
    return [...map.values()].map((row) => {
      const spend = Number(row.spend);
      const impressions = Number(row.impressions);
      const clicks = Number(row.clicks);
      const leads = Number(row.leads_platform);
      return {
        ...row,
        ctr: impressions > 0 ? clicks / impressions : null,
        cpc: clicks > 0 ? spend / clicks : null,
        cpm: impressions > 0 ? (spend / impressions) * 1000 : null,
        cpl: leads > 0 ? spend / leads : null,
      };
    });
  }

  private aggregateBreakdowns(
    rows: Array<{
      breakdown_type: string;
      breakdown_value: string;
      spend: number;
      impressions: number;
      clicks: number;
      leads_platform: number;
    }>,
  ) {
    const byType = new Map<string, Map<string, { spend: number; impressions: number; clicks: number; leads_platform: number }>>();
    for (const r of rows) {
      const tMap = byType.get(r.breakdown_type) ?? new Map();
      const cur = tMap.get(r.breakdown_value) ?? { spend: 0, impressions: 0, clicks: 0, leads_platform: 0 };
      cur.spend += r.spend;
      cur.impressions += r.impressions;
      cur.clicks += r.clicks;
      cur.leads_platform += r.leads_platform;
      tMap.set(r.breakdown_value, cur);
      byType.set(r.breakdown_type, tMap);
    }
    const out: Record<string, Array<{ value: string; spend: number; impressions: number; clicks: number; leads_platform: number }>> = {};
    for (const [type, values] of byType) {
      out[type] = [...values.entries()]
        .map(([value, m]) => ({ value, ...m }))
        .sort((a, b) => b.spend - a.spend);
    }
    return out;
  }
}
