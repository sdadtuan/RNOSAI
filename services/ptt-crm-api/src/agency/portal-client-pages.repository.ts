import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { createAppPgPool, shouldEndLocalPool } from '../config/pg-pool.factory';
import { AppConfigService } from '../config/app-config.service';
import {
  PortalClientPage,
  PortalPageCampaign,
  PortalPageCreative,
  PortalPageLead,
  PortalPageMessage,
  PortalPageReportRow,
} from './portal-client-pages.types';
import { ensurePortalCrmLocalSchema } from '../portal/portal-crm-local-ddl.util';

function iso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return value == null ? '' : String(value);
}

function mapPage(row: Record<string, unknown>): PortalClientPage {
  return {
    id: String(row.id),
    client_id: String(row.client_id),
    channel:
      row.channel === 'zalo' || row.channel === 'google' || row.channel === 'tiktok' || row.channel === 'ad_account'
        ? row.channel
        : 'facebook',
    page_id: String(row.page_id),
    page_name: String(row.page_name ?? ''),
    active: row.active === true || row.active === 't' || row.active === 1,
    created_at: iso(row.created_at),
  };
}

@Injectable()
export class PortalClientPagesRepository implements OnModuleDestroy {
  private readonly log = new Logger(PortalClientPagesRepository.name);
  private pool: Pool | null = null;

  constructor(private readonly config: AppConfigService) {}

  private get db(): Pool {
    if (!this.pool) {
      this.pool = createAppPgPool(this.config.databaseUrl);
    }
    return this.pool;
  }

  onModuleDestroy(): void {
    if (shouldEndLocalPool()) void this.pool?.end();
    this.pool = null;
  }

  async ensure(): Promise<void> {
    await ensurePortalCrmLocalSchema(this.db, this.log, PortalClientPagesRepository.name);
  }

  async clientExists(clientId: string): Promise<boolean> {
    const result = await this.db.query(`SELECT 1 FROM clients WHERE id = $1::uuid LIMIT 1`, [clientId]);
    return (result.rowCount ?? 0) > 0;
  }

  async listByClient(clientId: string): Promise<PortalClientPage[]> {
    await this.ensure();
    const result = await this.db.query(
      `SELECT id, client_id, channel, page_id, page_name, active, created_at
       FROM portal_client_pages
       WHERE client_id = $1::uuid
       ORDER BY channel ASC, page_name ASC, page_id ASC`,
      [clientId],
    );
    return result.rows.map((row) => mapPage(row as Record<string, unknown>));
  }

  async findByChannelPage(channel: string, pageId: string): Promise<PortalClientPage | null> {
    await this.ensure();
    const result = await this.db.query(
      `SELECT id, client_id, channel, page_id, page_name, active, created_at
       FROM portal_client_pages WHERE channel = $1 AND page_id = $2 LIMIT 1`,
      [channel, pageId],
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? mapPage(row) : null;
  }

  async findForClient(
    clientId: string,
    pageId: string,
    channel?: 'facebook' | 'zalo' | 'google' | 'tiktok' | 'ad_account',
  ): Promise<PortalClientPage | null> {
    await this.ensure();
    if (channel) {
      const result = await this.db.query(
        `SELECT id, client_id, channel, page_id, page_name, active, created_at
         FROM portal_client_pages
         WHERE client_id = $1::uuid AND page_id = $2 AND channel = $3
         LIMIT 1`,
        [clientId, pageId, channel],
      );
      const row = result.rows[0] as Record<string, unknown> | undefined;
      return row ? mapPage(row) : null;
    }
    const result = await this.db.query(
      `SELECT id, client_id, channel, page_id, page_name, active, created_at
       FROM portal_client_pages
       WHERE client_id = $1::uuid AND page_id = $2
       ORDER BY CASE WHEN channel = 'ad_account' THEN 0 ELSE 1 END, created_at ASC
       LIMIT 1`,
      [clientId, pageId],
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? mapPage(row) : null;
  }

  async listActiveAdAccounts(clientId: string): Promise<PortalClientPage[]> {
    const pages = await this.listByClient(clientId);
    return pages.filter((page) => page.channel === 'ad_account' && page.active);
  }

  async insert(clientId: string, channel: string, pageId: string, pageName: string): Promise<PortalClientPage> {
    await this.ensure();
    const result = await this.db.query(
      `INSERT INTO portal_client_pages (client_id, channel, page_id, page_name)
       VALUES ($1::uuid, $2, $3, $4)
       RETURNING id, client_id, channel, page_id, page_name, active, created_at`,
      [clientId, channel, pageId, pageName],
    );
    return mapPage(result.rows[0] as Record<string, unknown>);
  }

  async findById(clientId: string, rowId: string): Promise<PortalClientPage | null> {
    await this.ensure();
    const result = await this.db.query(
      `SELECT id, client_id, channel, page_id, page_name, active, created_at
       FROM portal_client_pages
       WHERE client_id = $1::uuid AND id = $2::uuid
       LIMIT 1`,
      [clientId, rowId],
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? mapPage(row) : null;
  }

  async update(
    clientId: string,
    rowId: string,
    next: { channel: string; pageId: string; pageName: string },
  ): Promise<PortalClientPage | null> {
    await this.ensure();
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      const current = await client.query(
        `SELECT page_id FROM portal_client_pages WHERE client_id = $1::uuid AND id = $2::uuid FOR UPDATE`,
        [clientId, rowId],
      );
      const oldPageId = String(current.rows[0]?.page_id ?? '');
      if (!oldPageId) {
        await client.query('ROLLBACK');
        return null;
      }
      const result = await client.query(
        `UPDATE portal_client_pages
         SET channel = $3, page_id = $4, page_name = $5, updated_at = NOW()
         WHERE client_id = $1::uuid AND id = $2::uuid
         RETURNING id, client_id, channel, page_id, page_name, active, created_at`,
        [clientId, rowId, next.channel, next.pageId, next.pageName],
      );
      if (oldPageId !== next.pageId) {
        await client.query(
          `UPDATE portal_page_leads SET page_id = $3 WHERE client_id = $1::uuid AND page_id = $2`,
          [clientId, oldPageId, next.pageId],
        );
        await client.query(
          `UPDATE portal_page_messages SET page_id = $3 WHERE client_id = $1::uuid AND page_id = $2`,
          [clientId, oldPageId, next.pageId],
        );
      }
      await client.query('COMMIT');
      return mapPage(result.rows[0] as Record<string, unknown>);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async remove(clientId: string, pageId: string): Promise<boolean> {
    await this.ensure();
    const result = await this.db.query(
      `DELETE FROM portal_client_pages WHERE client_id = $1::uuid AND page_id = $2`,
      [clientId, pageId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async removeById(clientId: string, rowId: string): Promise<boolean> {
    await this.ensure();
    const result = await this.db.query(
      `DELETE FROM portal_client_pages WHERE client_id = $1::uuid AND id = $2::uuid`,
      [clientId, rowId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async listLeads(clientId: string, pageId: string): Promise<PortalPageLead[]> {
    await this.ensure();
    const result = await this.db.query(
      `SELECT id, page_id, external_lead_id, full_name, phone, email, campaign_name, campaign_id, created_at
       FROM portal_page_leads
       WHERE client_id = $1::uuid AND page_id = $2
       ORDER BY created_at DESC
       LIMIT 200`,
      [clientId, pageId],
    );
    return result.rows.map((row) => ({
      id: String(row.id),
      page_id: String(row.page_id),
      external_lead_id: String(row.external_lead_id ?? ''),
      full_name: String(row.full_name ?? ''),
      phone: String(row.phone ?? ''),
      email: String(row.email ?? ''),
      campaign_name: String(row.campaign_name ?? ''),
      campaign_id: String(row.campaign_id ?? ''),
      created_at: iso(row.created_at),
    }));
  }

  async listLeadsForAdAccounts(clientId: string, accountIds: string[]): Promise<PortalPageLead[]> {
    if (!accountIds.length) return [];
    await this.ensure();
    try {
      const result = await this.db.query(
        `SELECT l.id, l.page_id, l.external_lead_id, l.full_name, l.phone, l.email,
                l.campaign_name, l.campaign_id, l.created_at
         FROM portal_page_leads l
         WHERE l.client_id = $1::uuid
           AND (
             (
               NULLIF(TRIM(l.campaign_id), '') IS NOT NULL
               AND l.campaign_id IN (
                 SELECT DISTINCT dp.external_campaign_id
                 FROM daily_performance dp
                 WHERE dp.client_id = $1::uuid
                   AND regexp_replace(COALESCE(dp.external_account_id, ''), '^act_', '', 'i') = ANY($2::text[])
               )
             )
             OR (
               NULLIF(TRIM(l.ad_id), '') IS NOT NULL
               AND EXISTS (
                 SELECT 1
                 FROM meta_ad_creative_links m
                 INNER JOIN daily_performance dp
                   ON dp.client_id = m.client_id
                  AND dp.external_campaign_id = m.external_campaign_id
                 WHERE m.client_id = $1::uuid
                   AND m.external_ad_id = l.ad_id
                   AND m.is_active IS TRUE
                   AND regexp_replace(COALESCE(dp.external_account_id, ''), '^act_', '', 'i') = ANY($2::text[])
               )
             )
           )
         ORDER BY l.created_at DESC
         LIMIT 200`,
        [clientId, accountIds],
      );
      return result.rows.map((row) => ({
        id: String(row.id),
        page_id: String(row.page_id),
        external_lead_id: String(row.external_lead_id ?? ''),
        full_name: String(row.full_name ?? ''),
        phone: String(row.phone ?? ''),
        email: String(row.email ?? ''),
        campaign_name: String(row.campaign_name ?? ''),
        campaign_id: String(row.campaign_id ?? ''),
        created_at: iso(row.created_at),
      }));
    } catch {
      const result = await this.db.query(
        `SELECT l.id, l.page_id, l.external_lead_id, l.full_name, l.phone, l.email,
                l.campaign_name, l.campaign_id, l.created_at
         FROM portal_page_leads l
         WHERE l.client_id = $1::uuid
           AND NULLIF(TRIM(l.campaign_id), '') IS NOT NULL
           AND l.campaign_id IN (
             SELECT DISTINCT dp.external_campaign_id
             FROM daily_performance dp
             WHERE dp.client_id = $1::uuid
               AND regexp_replace(COALESCE(dp.external_account_id, ''), '^act_', '', 'i') = ANY($2::text[])
           )
         ORDER BY l.created_at DESC
         LIMIT 200`,
        [clientId, accountIds],
      );
      return result.rows.map((row) => ({
        id: String(row.id),
        page_id: String(row.page_id),
        external_lead_id: String(row.external_lead_id ?? ''),
        full_name: String(row.full_name ?? ''),
        phone: String(row.phone ?? ''),
        email: String(row.email ?? ''),
        campaign_name: String(row.campaign_name ?? ''),
        campaign_id: String(row.campaign_id ?? ''),
        created_at: iso(row.created_at),
      }));
    }
  }

  async insertLead(
    clientId: string,
    pageId: string,
    input: { full_name: string; phone: string; email: string; campaign_name: string },
  ): Promise<PortalPageLead> {
    await this.ensure();
    const result = await this.db.query(
      `INSERT INTO portal_page_leads (client_id, page_id, full_name, phone, email, campaign_name)
       VALUES ($1::uuid, $2, $3, $4, $5, $6)
       RETURNING id, page_id, external_lead_id, full_name, phone, email, campaign_name, campaign_id, created_at`,
      [clientId, pageId, input.full_name, input.phone, input.email, input.campaign_name],
    );
    const row = result.rows[0] as Record<string, unknown>;
    return {
      id: String(row.id),
      page_id: String(row.page_id),
      external_lead_id: String(row.external_lead_id ?? ''),
      full_name: String(row.full_name ?? ''),
      phone: String(row.phone ?? ''),
      email: String(row.email ?? ''),
      campaign_name: String(row.campaign_name ?? ''),
      campaign_id: String(row.campaign_id ?? ''),
      created_at: iso(row.created_at),
    };
  }

  async listMessages(clientId: string, pageId: string): Promise<PortalPageMessage[]> {
    await this.ensure();
    const result = await this.db.query(
      `SELECT id, page_id, sender_name, body, received_at
       FROM portal_page_messages
       WHERE client_id = $1::uuid AND page_id = $2
       ORDER BY received_at DESC
       LIMIT 200`,
      [clientId, pageId],
    );
    return result.rows.map((row) => ({
      id: String(row.id),
      page_id: String(row.page_id),
      sender_name: String(row.sender_name ?? ''),
      body: String(row.body ?? ''),
      received_at: iso(row.received_at),
    }));
  }

  async listReports(clientId: string, accountIds: string[]): Promise<PortalPageReportRow[]> {
    if (!accountIds.length) return [];
    try {
      const result = await this.db.query(
        `SELECT performance_date::text AS performance_date,
                COALESCE(SUM(spend), 0)::float8 AS spend,
                COALESCE(SUM(impressions), 0)::float8 AS impressions,
                COALESCE(SUM(clicks), 0)::float8 AS clicks,
                COALESCE(SUM(leads_platform), 0)::int AS leads_platform
         FROM daily_performance
         WHERE client_id = $1::uuid
           AND regexp_replace(COALESCE(external_account_id, ''), '^act_', '', 'i') = ANY($2::text[])
           AND insight_level = 'account'
           AND performance_date >= CURRENT_DATE - INTERVAL '30 days'
         GROUP BY performance_date
         ORDER BY performance_date DESC
         LIMIT 30`,
        [clientId, accountIds],
      );
      return result.rows.map((row) => ({
        performance_date: String(row.performance_date ?? ''),
        spend: Number(row.spend ?? 0),
        impressions: Number(row.impressions ?? 0),
        clicks: Number(row.clicks ?? 0),
        leads_platform: Number(row.leads_platform ?? 0),
      }));
    } catch {
      return [];
    }
  }

  async listCampaigns(clientId: string, accountIds: string[]): Promise<PortalPageCampaign[]> {
    if (!accountIds.length) return [];
    try {
      const result = await this.db.query(
        `SELECT external_campaign_id,
                MAX(COALESCE(external_campaign_name, '')) AS name,
                COALESCE(SUM(spend), 0)::float8 AS spend,
                COALESCE(SUM(impressions), 0)::float8 AS impressions,
                COALESCE(SUM(clicks), 0)::float8 AS clicks
         FROM daily_performance
         WHERE client_id = $1::uuid
           AND regexp_replace(COALESCE(external_account_id, ''), '^act_', '', 'i') = ANY($2::text[])
           AND insight_level = 'campaign'
           AND performance_date >= CURRENT_DATE - INTERVAL '30 days'
         GROUP BY external_campaign_id
         ORDER BY SUM(spend) DESC
         LIMIT 50`,
        [clientId, accountIds],
      );
      return result.rows.map((row) => ({
        external_campaign_id: String(row.external_campaign_id ?? ''),
        name: String(row.name ?? ''),
        spend: Number(row.spend ?? 0),
        impressions: Number(row.impressions ?? 0),
        clicks: Number(row.clicks ?? 0),
      }));
    } catch {
      return [];
    }
  }

  async listCreatives(clientId: string): Promise<PortalPageCreative[]> {
    try {
      const result = await this.db.query(
        `SELECT id::text AS id, status::text AS status
         FROM creatives
         WHERE client_id = $1::uuid
         ORDER BY created_at DESC NULLS LAST
         LIMIT 40`,
        [clientId],
      );
      return result.rows.map((row) => ({
        id: String(row.id),
        status: String(row.status ?? ''),
      }));
    } catch {
      return [];
    }
  }
}
