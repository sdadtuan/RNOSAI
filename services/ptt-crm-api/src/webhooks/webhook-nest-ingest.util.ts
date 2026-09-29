import type { CreateLeadV1Body } from '../leads/leads.types';
import type { B2bPreparedLead } from '../b2b-projects/b2b-ingest.service';
import type { NormalizedLeadPayload } from './webhook-lead.types';

export type WebhookIngestLead = NormalizedLeadPayload &
  Partial<Pick<B2bPreparedLead, 'b2b_project_id' | 'owner_company_id' | 'lead_flow_kind'>>;

export function defaultSourceForWebhookChannel(channel: string): string {
  const c = String(channel ?? '')
    .trim()
    .toLowerCase();
  if (c === 'meta' || c === 'facebook') return 'facebook';
  if (c === 'zalo') return 'zalo';
  if (c === 'google') return 'google';
  return c || 'webhook';
}

export function preparedLeadToCreateBody(lead: WebhookIngestLead): CreateLeadV1Body {
  const phone = String(lead.contact?.phone ?? '').trim();
  const email = String(lead.contact?.email ?? '').trim();
  const name = String(lead.contact?.full_name ?? '').trim() || phone || email || 'Lead webhook';
  const channel = String(lead.channel ?? 'meta').trim() || 'meta';
  const b2bProjectId = String(lead.b2b_project_id ?? '').trim() || null;
  const leadFlowKind = lead.lead_flow_kind === 'b2b_prospect' ? 'b2b_prospect' : undefined;
  const clientIdRaw = String(lead.client_id ?? '').trim();
  const clientId =
    b2bProjectId || !clientIdRaw || clientIdRaw === 'unknown' ? null : clientIdRaw;

  const rawMeta =
    lead.raw && typeof lead.raw === 'object' && lead.raw.meta && typeof lead.raw.meta === 'object'
      ? (lead.raw.meta as Record<string, unknown>)
      : {};

  return {
    full_name: name.slice(0, 500),
    phone: phone || undefined,
    email: email || undefined,
    status: 'moi',
    source: defaultSourceForWebhookChannel(channel),
    channel,
    client_id: clientId,
    campaign_id: lead.external_campaign_id ?? null,
    external_lead_id: String(lead.external_lead_id ?? '').trim() || null,
    lead_flow_kind: leadFlowKind,
    b2b_project_id: b2bProjectId,
    owner_company_id: lead.owner_company_id ?? null,
    meta: {
      ingest_path: 'nest_webhook',
      created_via: 'webhook_nest_ingest',
      idempotency_key: lead.idempotency_key,
      occurred_at: lead.occurred_at,
      external_form_id: lead.external_form_id ?? null,
      webhook_raw_meta: rawMeta,
      ...(lead.utm ? { utm: lead.utm } : {}),
    },
  };
}
