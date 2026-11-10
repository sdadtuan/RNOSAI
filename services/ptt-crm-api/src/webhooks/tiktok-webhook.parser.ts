import {
  legacyRowToNormalizedLead,
  parseWebhookJson,
} from './webhook-lead.mapper';
import type { LegacyLeadRow, NormalizedLeadPayload, WebhookParseResultBase } from './webhook-lead.types';

export interface TikTokWebhookConfig {
  webhookKey: string;
}

export interface TikTokParseResult extends WebhookParseResultBase {
  channel: 'tiktok';
}

function cleanEnv(v: string | undefined): string {
  return String(v ?? '').trim();
}

export function tiktokConfigFromEnv(): TikTokWebhookConfig {
  return {
    webhookKey: cleanEnv(
      process.env.CRM_TIKTOK_WEBHOOK_KEY ??
        process.env.PTT_TIKTOK_WEBHOOK_KEY ??
        process.env.TIKTOK_WEBHOOK_KEY,
    ),
  };
}

function changeValue(changes: unknown[], fieldNames: string[]): string {
  if (!Array.isArray(changes)) return '';
  for (const ch of changes) {
    if (!ch || typeof ch !== 'object') continue;
    const row = ch as { field?: unknown; value?: unknown };
    const field = String(row.field ?? '').trim().toLowerCase();
    if (fieldNames.some((n) => n.toLowerCase() === field)) {
      return String(row.value ?? '').trim();
    }
  }
  return '';
}

function entryToLead(entry: Record<string, unknown>): LegacyLeadRow | null {
  const changes = entry.changes;
  const phone =
    changeValue(changes as unknown[], ['phone_number', 'phone', 'mobile']) ||
    changeValue(changes as unknown[], ['số điện thoại']);
  const fullName =
    changeValue(changes as unknown[], ['name', 'full_name', 'họ tên']) ||
    changeValue(changes as unknown[], ['first_name']);
  const email = changeValue(changes as unknown[], ['email', 'e-mail']);
  if (!phone && !email) return null;

  const leadId = String(entry.id ?? '').trim();
  const advertiserId = String(entry.advertiser_id ?? entry.adv_id ?? '').trim();
  const pageId = String(entry.page_id ?? '').trim();
  const campaignId = String(entry.campaign_id ?? '').trim();

  return {
    full_name: fullName,
    phone,
    email,
    utm_campaign: campaignId,
    campaign_id: campaignId,
    source: 'tiktok',
    meta: {
      tiktok_lead_id: leadId || undefined,
      advertiser_id: advertiserId || undefined,
      page_id: pageId || undefined,
      page_name: entry.page_name,
      lead_source: entry.lead_source,
      campaign_name: entry.campaign_name,
      ad_id: entry.ad_id,
      adgroup_id: entry.adgroup_id,
    },
  };
}

/** TikTok Marketing API lead webhook: `{ object: 1, entry: [{ changes: [{field,value}] }] }`. */
export function parseTikTokWebhookPayload(payload: Record<string, unknown>): LegacyLeadRow[] {
  const out: LegacyLeadRow[] = [];

  if (payload.full_name || payload.name || payload.phone || payload.phone_number || payload.email) {
    out.push({
      full_name: String(payload.full_name ?? payload.name ?? ''),
      phone: String(payload.phone ?? payload.phone_number ?? ''),
      email: String(payload.email ?? ''),
      utm_campaign: String(payload.campaign_id ?? payload.utm_campaign ?? ''),
      campaign_id: String(payload.campaign_id ?? ''),
      source: 'tiktok',
      meta: { webhook: 'tiktok_flat' },
    });
    return out;
  }

  const entries = payload.entry;
  if (Array.isArray(entries)) {
    for (const item of entries) {
      if (!item || typeof item !== 'object') continue;
      const row = entryToLead(item as Record<string, unknown>);
      if (row) out.push(row);
    }
  }

  return out;
}

function verifyTikTokKey(
  headers: Record<string, string | string[] | undefined>,
  query: Record<string, string>,
  config: TikTokWebhookConfig,
): boolean {
  if (!config.webhookKey) return true;
  const headerKey = String(headers['x-ptt-webhook-key'] ?? headers['x-tiktok-webhook-key'] ?? '').trim();
  const queryKey = String(query.key ?? query.webhook_key ?? '').trim();
  return headerKey === config.webhookKey || queryKey === config.webhookKey;
}

export function parseTikTokWebhook(input: {
  headers: Record<string, string | string[] | undefined>;
  rawBody: Buffer;
  clientId: string;
  query?: Record<string, string>;
  config?: TikTokWebhookConfig;
}): TikTokParseResult {
  const config = input.config ?? tiktokConfigFromEnv();
  const query = input.query ?? {};
  if (!verifyTikTokKey(input.headers, query, config)) {
    return { verified: false, reject_reason: 'Invalid TikTok webhook key', channel: 'tiktok', leads: [], events: [] };
  }

  const payload = parseWebhookJson(input.rawBody);
  const rows = parseTikTokWebhookPayload(payload);
  const clientId = input.clientId || 'unknown';
  const leads: NormalizedLeadPayload[] = rows.map((row) =>
    legacyRowToNormalizedLead(row, clientId, 'tiktok', { externalIdMetaKeys: ['tiktok_lead_id'] }),
  );
  const events = leads.map((lead) => ({ event_name: 'Lead', external_lead_id: lead.external_lead_id }));

  return { verified: true, channel: 'tiktok', leads, events };
}
