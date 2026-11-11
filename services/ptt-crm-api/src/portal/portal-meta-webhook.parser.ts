import type { PulledLead, PulledMessage } from './portal-page-inbox.util';

export type PortalMetaWebhookMessage = {
  page_id: string;
  message: PulledMessage;
};

export type PortalMetaWebhookLeadHint = {
  page_id: string;
  leadgen_id: string;
  form_id: string;
};

function isoFromMs(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return new Date().toISOString();
  return new Date(ms).toISOString();
}

export function parsePortalMetaMessagingPayload(payload: Record<string, unknown>): {
  messages: PortalMetaWebhookMessage[];
  leadHints: PortalMetaWebhookLeadHint[];
} {
  const messages: PortalMetaWebhookMessage[] = [];
  const leadHints: PortalMetaWebhookLeadHint[] = [];
  const entries = payload.entry;
  if (!Array.isArray(entries)) return { messages, leadHints };

  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') continue;
    const pageId = String((entry as { id?: string }).id ?? '').trim();
    const messaging = (entry as { messaging?: unknown }).messaging;
    if (Array.isArray(messaging)) {
      for (const item of messaging) {
        if (!item || typeof item !== 'object') continue;
        const row = item as {
          sender?: { id?: string; name?: string };
          message?: { mid?: string; text?: string };
          timestamp?: number;
        };
        const mid = String(row.message?.mid ?? '').trim();
        const text = String(row.message?.text ?? '').trim();
        if (!mid && !text) continue;
        const psid = String(row.sender?.id ?? '').trim();
        const rawTs = Number(row.timestamp ?? 0);
        const ts = isoFromMs(rawTs > 1e12 ? rawTs : rawTs * 1000);
        messages.push({
          page_id: pageId,
          message: {
            external_id: mid || `webhook:${pageId}:${psid}:${ts}`,
            sender_name: String(row.sender?.name ?? '').trim() || psid || 'Khách',
            sender_psid: psid,
            body: text || '(tin không chữ)',
            received_at: ts,
            direction: 'in',
          },
        });
      }
    }

    const changes = (entry as { changes?: unknown }).changes;
    if (!Array.isArray(changes)) continue;
    for (const change of changes) {
      if (!change || typeof change !== 'object') continue;
      const ch = change as { field?: string; value?: Record<string, unknown> };
      if (ch.field === 'leadgen') {
        const val = ch.value ?? {};
        const leadgenId = String(val.leadgen_id ?? '').trim();
        if (!leadgenId) continue;
        leadHints.push({
          page_id: String(val.page_id ?? pageId).trim(),
          leadgen_id: leadgenId,
          form_id: String(val.form_id ?? '').trim(),
        });
        continue;
      }
      if (ch.field === 'messages' || ch.field === 'messaging') {
        const val = ch.value ?? {};
        const mid = String(val.mid ?? val.message_id ?? '').trim();
        const text = String(val.text ?? val.message ?? '').trim();
        const sender = val.sender && typeof val.sender === 'object' ? (val.sender as { id?: string; name?: string }) : {};
        const psid = String(sender.id ?? '').trim();
        if (!mid && !text) continue;
        const page = String(val.page_id ?? pageId).trim();
        messages.push({
          page_id: page,
          message: {
            external_id: mid || `webhook:${page}:${psid}:${Date.now()}`,
            sender_name: String(sender.name ?? '').trim() || psid || 'Khách',
            sender_psid: psid,
            body: text || '(tin không chữ)',
            received_at: new Date().toISOString(),
            direction: 'in',
          },
        });
      }
    }
  }

  return { messages, leadHints };
}

export function graphLeadRowToPulled(
  leadgenId: string,
  row: { full_name?: string; phone?: string; email?: string; meta?: Record<string, unknown> },
  createdAt?: string,
): PulledLead {
  return {
    external_id: leadgenId,
    full_name: String(row.full_name ?? ''),
    phone: String(row.phone ?? ''),
    email: String(row.email ?? ''),
    campaign_name: String(row.meta?.facebook_form_id ?? 'Facebook Lead'),
    campaign_id: '',
    ad_id: String(row.meta?.facebook_ad_id ?? '').slice(0, 64),
    answers: [],
    created_at: createdAt || new Date().toISOString(),
  };
}
