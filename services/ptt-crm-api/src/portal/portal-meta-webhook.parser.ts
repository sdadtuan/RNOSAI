import type { PulledLead, PulledMessage } from './portal-page-inbox.util';
import type { PulledComment } from './portal-page-comments.util';

export type PortalMetaWebhookMessage = {
  page_id: string;
  message: PulledMessage;
};

export type PortalMetaWebhookComment = {
  page_id: string;
  comment: PulledComment;
};

export type PortalMetaWebhookLeadHint = {
  page_id: string;
  leadgen_id: string;
  form_id: string;
};

export type PortalMetaWebhookParseResult = {
  messages: PortalMetaWebhookMessage[];
  comments: PortalMetaWebhookComment[];
  leadHints: PortalMetaWebhookLeadHint[];
};

function isoFromMs(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return new Date().toISOString();
  return new Date(ms).toISOString();
}

function isoFromUnixOrIso(value: unknown): string {
  if (typeof value === 'number') {
    return isoFromMs(value > 1e12 ? value : value * 1000);
  }
  const text = String(value ?? '').trim();
  if (!text) return new Date().toISOString();
  const asNum = Number(text);
  if (Number.isFinite(asNum) && asNum > 0 && /^\d+$/.test(text)) {
    return isoFromMs(asNum > 1e12 ? asNum : asNum * 1000);
  }
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function attachmentsFromMessage(message: Record<string, unknown> | null): PulledMessage['attachments'] {
  const list = message && Array.isArray(message.attachments) ? message.attachments : [];
  const out: NonNullable<PulledMessage['attachments']> = [];
  for (const item of list) {
    const row = asRecord(item);
    if (!row) continue;
    const payload = asRecord(row.payload) ?? {};
    const url = String(payload.url ?? row.url ?? '').trim();
    const type = String(row.type ?? payload.type ?? 'file').trim() || 'file';
    out.push({
      type,
      url,
      mime_type: String(payload.mime_type ?? row.mime_type ?? '').trim(),
      name: String(payload.title ?? payload.name ?? row.name ?? type).trim(),
    });
  }
  return out;
}

function pushMessage(
  messages: PortalMetaWebhookMessage[],
  pageId: string,
  input: {
    mid?: string;
    text?: string;
    psid?: string;
    name?: string;
    ts?: string;
    direction: 'in' | 'out';
    attachments?: PulledMessage['attachments'];
  },
): void {
  const mid = String(input.mid ?? '').trim();
  const text = String(input.text ?? '').trim();
  const attachments = input.attachments ?? [];
  if (!mid && !text && !attachments.length) return;
  const psid = String(input.psid ?? '').trim();
  const ts = input.ts || new Date().toISOString();
  messages.push({
    page_id: pageId,
    message: {
      external_id: mid || `webhook:${pageId}:${psid}:${ts}`,
      sender_name: String(input.name ?? '').trim() || psid || 'Khách',
      sender_psid: psid,
      body: text || (attachments.length ? `[${attachments[0].type || 'tệp'}]` : '(tin không chữ)'),
      received_at: ts,
      direction: input.direction,
      attachments,
    },
  });
}

function parseMessagingEvent(pageId: string, item: unknown): PortalMetaWebhookMessage | null {
  const row = asRecord(item);
  if (!row) return null;
  const sender = asRecord(row.sender) ?? {};
  const recipient = asRecord(row.recipient) ?? {};
  const message = asRecord(row.message);
  const postback = asRecord(row.postback);
  const rawTs = Number(row.timestamp ?? 0);
  const ts = isoFromMs(rawTs > 1e12 ? rawTs : rawTs * 1000);

  if (message) {
    const isEcho = message.is_echo === true;
    const mid = String(message.mid ?? '').trim();
    const text = String(message.text ?? '').trim();
    const attachments = attachmentsFromMessage(message);
    const customerId = isEcho
      ? String(recipient.id ?? '').trim()
      : String(sender.id ?? '').trim();
    const customerName = isEcho
      ? String(recipient.name ?? sender.name ?? '').trim()
      : String(sender.name ?? '').trim();
    const parsed: PortalMetaWebhookMessage[] = [];
    pushMessage(parsed, pageId, {
      mid,
      text,
      psid: customerId,
      name: customerName,
      ts,
      direction: isEcho ? 'out' : 'in',
      attachments,
    });
    return parsed[0] ?? null;
  }

  if (postback) {
    const mid = String(postback.mid ?? postback.payload ?? '').trim();
    const text = String(postback.title ?? postback.payload ?? '').trim();
    const parsed: PortalMetaWebhookMessage[] = [];
    pushMessage(parsed, pageId, {
      mid: mid ? (String(postback.mid ?? '').trim() || `postback:${mid}`) : '',
      text: text || 'postback',
      psid: String(sender.id ?? '').trim(),
      name: String(sender.name ?? '').trim(),
      ts,
      direction: 'in',
    });
    return parsed[0] ?? null;
  }

  return null;
}

function parseFeedComment(pageId: string, value: Record<string, unknown>): PortalMetaWebhookComment | null {
  const item = String(value.item ?? '').trim().toLowerCase();
  const verb = String(value.verb ?? 'add').trim().toLowerCase();
  if (item && item !== 'comment' && item !== 'reply') return null;
  if (verb && verb !== 'add' && verb !== 'edited') return null;
  const commentId = String(value.comment_id ?? value.id ?? '').trim();
  if (!commentId) return null;
  const from = asRecord(value.from) ?? {};
  const postId = String(value.post_id ?? value.parent_id ?? '').trim();
  const parentId = String(value.parent_id ?? '').trim();
  return {
    page_id: pageId,
    comment: {
      comment_id: commentId,
      page_id: pageId,
      post_id: postId || parentId,
      parent_id: parentId === postId ? '' : parentId,
      from_name: String(from.name ?? '').trim() || 'Khách',
      from_id: String(from.id ?? '').trim(),
      message: String(value.message ?? value.comment ?? '').trim(),
      created_time: isoFromUnixOrIso(value.created_time ?? value.created ?? Date.now()),
      is_hidden: value.is_hidden === true,
      replied: false,
      can_hide: true,
      can_reply: true,
      can_reply_privately: true,
    },
  };
}

export function parsePortalMetaMessagingPayload(payload: Record<string, unknown>): PortalMetaWebhookParseResult {
  const messages: PortalMetaWebhookMessage[] = [];
  const comments: PortalMetaWebhookComment[] = [];
  const leadHints: PortalMetaWebhookLeadHint[] = [];
  const entries = payload.entry;
  if (!Array.isArray(entries)) return { messages, comments, leadHints };

  for (const entry of entries) {
    const block = asRecord(entry);
    if (!block) continue;
    const pageId = String(block.id ?? '').trim();
    const messaging = block.messaging;
    if (Array.isArray(messaging)) {
      for (const item of messaging) {
        const parsed = parseMessagingEvent(pageId, item);
        if (parsed) messages.push(parsed);
      }
    }

    const changes = block.changes;
    if (!Array.isArray(changes)) continue;
    for (const change of changes) {
      const ch = asRecord(change);
      if (!ch) continue;
      const field = String(ch.field ?? '').trim();
      const val = asRecord(ch.value) ?? {};
      if (field === 'leadgen') {
        const leadgenId = String(val.leadgen_id ?? '').trim();
        if (!leadgenId) continue;
        leadHints.push({
          page_id: String(val.page_id ?? pageId).trim(),
          leadgen_id: leadgenId,
          form_id: String(val.form_id ?? '').trim(),
        });
        continue;
      }
      if (field === 'feed') {
        const comment = parseFeedComment(String(val.page_id ?? pageId).trim() || pageId, val);
        if (comment) comments.push(comment);
        continue;
      }
      if (field === 'messages' || field === 'messaging') {
        const mid = String(val.mid ?? val.message_id ?? '').trim();
        const text = String(val.text ?? val.message ?? '').trim();
        const sender = asRecord(val.sender) ?? {};
        const psid = String(sender.id ?? '').trim();
        if (!mid && !text) continue;
        const page = String(val.page_id ?? pageId).trim();
        pushMessage(messages, page, {
          mid,
          text,
          psid,
          name: String(sender.name ?? '').trim(),
          ts: isoFromUnixOrIso(val.created_time ?? val.timestamp ?? Date.now()),
          direction: val.is_echo === true ? 'out' : 'in',
        });
      }
    }
  }

  return { messages, comments, leadHints };
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
