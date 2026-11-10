import { createHmac, timingSafeEqual } from 'crypto';
import {
  cleanEnv,
  legacyRowToNormalizedLead,
  parseWebhookJson,
} from './webhook-lead.mapper';
import type { LegacyLeadRow, NormalizedLeadPayload, WebhookParseResultBase } from './webhook-lead.types';
import { resolveZaloParties, zaloEventSignatureFailure } from './zalo-oa-envelope';

export interface ZaloWebhookConfig {
  webhookSecret: string;
  alternateSecrets?: string[];
}

export interface ZaloParseResult extends WebhookParseResultBase {
  channel: 'zalo';
}

export function zaloConfigFromEnv(): ZaloWebhookConfig {
  const webhookSecret = cleanEnv(process.env.CRM_ZALO_WEBHOOK_SECRET ?? process.env.ZALO_OA_SECRET);
  const appSecret = cleanEnv(process.env.PTT_ZALO_APP_SECRET);
  return {
    webhookSecret,
    alternateSecrets: appSecret && appSecret !== webhookSecret ? [appSecret] : [],
  };
}

function headerText(value: string | string[] | undefined): string {
  if (!value) return '';
  return (Array.isArray(value) ? value : [value]).join(',');
}

const PHONE_IN_TEXT = /(?:^|\D)((?:\+?84|0)(?:3|5|7|8|9)\d{8})(?!\d)/;

function phoneFromText(text: string): string {
  return text.match(PHONE_IN_TEXT)?.[1] ?? '';
}

function phoneFromValue(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const digits = String(Math.trunc(value));
    return phoneFromText(digits) || (digits.length >= 9 && digits.length <= 12 ? digits : '');
  }
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  return phoneFromText(trimmed) || (trimmed.replace(/\D/g, '').length >= 9 ? trimmed : '');
}

function phoneFromRecord(info: Record<string, unknown>): string {
  for (const key of ['phone', 'phone_number', 'mobile', 'sdt', 'tel', 'user_phone']) {
    const found = phoneFromValue(info[key]);
    if (found) return found;
  }
  for (const key of ['text', 'message', 'note', 'content']) {
    const raw = info[key];
    if (typeof raw === 'string') {
      const found = phoneFromText(raw);
      if (found) return found;
    }
  }
  return '';
}

export function verifyZaloSignature(
  rawBody: Buffer,
  signatureHeader: string | undefined,
  secret: string,
): boolean {
  if (!secret) return true;
  if (!signatureHeader) return false;
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader.trim().toLowerCase()));
  } catch {
    return expected.toLowerCase() === signatureHeader.trim().toLowerCase();
  }
}

function zaloCampaignFromPayload(payload: Record<string, unknown>, info: Record<string, unknown> | string): string {
  if (info && typeof info === 'object') {
    for (const key of ['campaign_id', 'zalo_campaign_id', 'ads_campaign_id', 'campaign']) {
      const val = String(info[key] ?? '').trim();
      if (val) return val;
    }
  }
  for (const key of ['campaign_id', 'zalo_campaign_id', 'utm_campaign', 'campaign']) {
    const val = String(payload[key] ?? '').trim();
    if (val) return val;
  }
  const meta = payload.meta;
  if (meta && typeof meta === 'object') {
    for (const key of ['campaign_id', 'zalo_campaign_id', 'campaign']) {
      const val = String((meta as Record<string, unknown>)[key] ?? '').trim();
      if (val) return val;
    }
  }
  return '';
}

function zaloRegion(info: Record<string, unknown>): string {
  const full = info.full_address;
  if (full && typeof full === 'object' && !Array.isArray(full)) {
    const address = full as Record<string, unknown>;
    const parts = [address.user_address, address.user_ward, address.user_district, address.user_city]
      .map((part) => String(part ?? '').trim())
      .filter(Boolean);
    if (parts.length) return parts.join(', ');
  }
  return String(info.address ?? info.city ?? info.region ?? '').trim();
}

export function parseZaloWebhookPayload(payload: Record<string, unknown>): LegacyLeadRow[] {
  const out: LegacyLeadRow[] = [];

  if (payload.full_name || payload.name || payload.phone) {
    const campaignId = zaloCampaignFromPayload(payload, {});
    out.push({
      full_name: String(payload.full_name ?? payload.name ?? ''),
      phone: String(payload.phone ?? ''),
      email: String(payload.email ?? ''),
      need: String(payload.need ?? payload.message ?? ''),
      product_interest: String(payload.product_interest ?? ''),
      region: String(payload.region ?? ''),
      utm_campaign: String(payload.utm_campaign ?? campaignId ?? ''),
      campaign_id: campaignId,
      oa_id: resolveZaloParties(payload, String(payload.event_name ?? payload.event ?? '')).oaId,
      source: 'zalo',
      meta:
        payload.meta && typeof payload.meta === 'object'
          ? (payload.meta as Record<string, unknown>)
          : { webhook: 'zalo' },
    });
    return out;
  }

  const event = String(payload.event_name ?? payload.event ?? '').toLowerCase();
  const infoRaw = payload.info ?? payload.data ?? payload.message ?? {};
  if (infoRaw && typeof infoRaw === 'object' && !Array.isArray(infoRaw)) {
    const info = infoRaw as Record<string, unknown>;
    const campaignId = zaloCampaignFromPayload(payload, info);
    const parties = resolveZaloParties(payload, event);
    const phone = phoneFromRecord(info);
    const email = String(info.email ?? '').trim();
    if (phone || email) {
      const meta: Record<string, unknown> = {
        zalo_event: event,
        oa_id: parties.oaId || null,
        user_id: parties.userId || null,
      };
      if (campaignId) meta.campaign_id = campaignId;
      out.push({
        full_name: String(info.name ?? info.full_name ?? payload.sender_name ?? ''),
        phone,
        email,
        need: String(info.note ?? info.message ?? '').trim(),
        region: zaloRegion(info),
        utm_campaign: String(info.utm_campaign ?? campaignId ?? ''),
        campaign_id: campaignId,
        oa_id: parties.oaId,
        source: 'zalo',
        meta,
      });
    }
  } else if (typeof infoRaw === 'string') {
    const phone = phoneFromText(infoRaw);
    if (phone) {
      const parties = resolveZaloParties(payload, event);
      out.push({
        full_name: String(payload.sender_name ?? ''),
        phone,
        email: '',
        source: 'zalo',
        oa_id: parties.oaId,
        meta: { zalo_event: event, user_id: parties.userId || null },
      });
    }
  }

  const events = payload.events;
  if (Array.isArray(events)) {
    for (const item of events) {
      if (item && typeof item === 'object') {
        out.push(...parseZaloWebhookPayload(item as Record<string, unknown>));
      }
    }
  }

  return out;
}

export function parseZaloWebhook(input: {
  headers: Record<string, string | string[] | undefined>;
  rawBody: Buffer;
  clientId: string;
  config?: ZaloWebhookConfig;
}): ZaloParseResult {
  const config = input.config ?? zaloConfigFromEnv();
  const legacySig = headerText(input.headers['x-zalo-signature'] ?? input.headers['X-Zalo-Signature']);
  const eventSig = headerText(input.headers['x-zevent-signature'] ?? input.headers['X-ZEvent-Signature']);
  const secrets = [config.webhookSecret, ...(config.alternateSecrets ?? [])].filter(Boolean);
  const legacyOk = secrets.some((secret) => verifyZaloSignature(input.rawBody, legacySig, secret));
  const eventFailure = zaloEventSignatureFailure(input.rawBody, eventSig, secrets);
  const verified = !secrets.length || legacyOk || eventFailure === null;

  if (!verified) {
    return {
      verified: false,
      reject_reason: `Invalid Zalo signature (${eventFailure ?? 'mismatch'})`,
      channel: 'zalo',
      leads: [],
      events: [],
    };
  }

  const payload = parseWebhookJson(input.rawBody);
  const rows = parseZaloWebhookPayload(payload);
  const clientId = input.clientId || 'unknown';
  const leads: NormalizedLeadPayload[] = rows.map((row) =>
    legacyRowToNormalizedLead(row, clientId, 'zalo', { externalIdMetaKeys: ['zalo_lead_id'] }),
  );
  const events = leads.map((lead) => ({ event_name: 'Lead', external_lead_id: lead.external_lead_id }));

  return { verified: true, channel: 'zalo', leads, events };
}
