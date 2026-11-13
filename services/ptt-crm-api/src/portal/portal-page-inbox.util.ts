import { Logger } from '@nestjs/common';
import { parseLeadFieldData } from './portal-lead-fields.util';
import {
  classifyGraphPath,
  extractGraphErrorCode,
  noteGraphError,
  noteGraphHeaders,
  recordGraphCall,
  shouldPauseGraph,
} from './portal-graph-usage';
export type PulledLead = {
  external_id: string;
  full_name: string;
  phone: string;
  email: string;
  campaign_name: string;
  campaign_id: string;
  ad_id: string;
  adset_id?: string;
  form_id?: string;
  answers: Array<{ name: string; value: string }>;
  created_at: string;
};

export type PulledMessage = {
  external_id: string;
  sender_name: string;
  sender_psid: string;
  body: string;
  received_at: string;
  direction: 'in' | 'out';
  attachments: Array<{ type: string; url: string; mime_type: string; name: string }>;
};

export type FacebookInboxCursors = {
  conv_after: string;
  form_after: string;
};

export type PullFacebookPageResult = {
  leads: PulledLead[];
  messages: PulledMessage[];
  leadError: string;
  messageError: string;
  cursors: FacebookInboxCursors;
  hasMore: boolean;
  hops: number;
};

export const FACEBOOK_INBOX_MAX_HOPS = 10;
export const FACEBOOK_BACKFILL_TIMEOUT_MS = 45_000;

type GraphField = { name?: string; values?: string[] };
type GraphLead = {
  id?: string;
  created_time?: string;
  field_data?: GraphField[];
  ad_id?: string;
  adset_id?: string;
  campaign_id?: string;
  form_id?: string;
};
type GraphAttachment = {
  mime_type?: string;
  sticker_id?: number;
  name?: string;
  type?: string;
  file_url?: string;
  url?: string;
  image_data?: { url?: string; preview_url?: string };
  video_data?: { url?: string };
};
type GraphMessage = {
  id?: string;
  message?: string;
  created_time?: string;
  from?: { id?: string; name?: string };
  attachments?: { data?: GraphAttachment[] };
};

type PullMode = 'incremental' | 'backfill';

export async function pullFacebookPage(
  pageId: string,
  pageToken: string,
  options?: {
    mode?: PullMode;
    cursors?: Partial<FacebookInboxCursors>;
    maxHops?: number;
  },
): Promise<PullFacebookPageResult> {
  const mode = options?.mode ?? 'incremental';
  const maxHops = options?.maxHops ?? (mode === 'backfill' ? FACEBOOK_INBOX_MAX_HOPS : 1);
  const cursors = {
    conv_after: String(options?.cursors?.conv_after ?? '').trim(),
    form_after: String(options?.cursors?.form_after ?? '').trim(),
  };

  if (mode === 'incremental') {
    const [leadPull, messagePull] = await Promise.all([
      pullLeads(pageId, pageToken, 'incremental', '', 1).catch((err: unknown) => ({
        rows: [] as PulledLead[],
        error: err instanceof Error ? err.message : 'Không đọc được lead từ Facebook.',
        cursors: { form_after: '' },
        hasMore: false,
        hops: 0,
      })),
      pullMessages(pageId, pageToken, 'incremental', '', 1).catch((err: unknown) => ({
        rows: [] as PulledMessage[],
        error: err instanceof Error ? err.message : 'Không đọc được tin nhắn từ Facebook.',
        cursors: { conv_after: '' },
        hasMore: false,
        hops: 0,
      })),
    ]);
    return {
      leads: leadPull.rows,
      messages: messagePull.rows,
      leadError: leadPull.error,
      messageError: messagePull.error,
      cursors: { conv_after: '', form_after: '' },
      hasMore: false,
      hops: leadPull.hops + messagePull.hops,
    };
  }

  const messagePull = await pullMessages(pageId, pageToken, 'backfill', cursors.conv_after, maxHops).catch((err: unknown) => ({
    rows: [] as PulledMessage[],
    error: err instanceof Error ? err.message : 'Không đọc được tin nhắn từ Facebook.',
    cursors: { conv_after: cursors.conv_after },
    hasMore: false,
    hops: 0,
  }));
  const leadBudget = Math.max(0, maxHops - messagePull.hops);
  const leadPull = await pullLeads(pageId, pageToken, 'backfill', cursors.form_after, leadBudget).catch((err: unknown) => ({
    rows: [] as PulledLead[],
    error: err instanceof Error ? err.message : 'Không đọc được lead từ Facebook.',
    cursors: { form_after: cursors.form_after },
    hasMore: false,
    hops: 0,
  }));
  return {
    leads: leadPull.rows,
    messages: messagePull.rows,
    leadError: leadPull.error,
    messageError: messagePull.error,
    cursors: {
      conv_after: messagePull.cursors.conv_after,
      form_after: leadPull.cursors.form_after,
    },
    hasMore: leadPull.hasMore || messagePull.hasMore,
    hops: messagePull.hops + leadPull.hops,
  };
}

export type GraphFacebookSendError = {
  message?: string;
  code?: number;
  error_subcode?: number;
  fbtrace_id?: string;
  type?: string;
};

const facebookSendLog = new Logger('PortalFacebookSend');

export function redactGraphErrorText(value: string): string {
  return String(value ?? '')
    .replace(/access_token=[^&\s"'\\]+/gi, 'access_token=<redacted>')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer <redacted>')
    .replace(/EAA[A-Za-z0-9]+/g, '<token>');
}

export function logFacebookSendError(
  error?: GraphFacebookSendError,
  extra?: { httpStatus?: number },
): void {
  const message = redactGraphErrorText(String(error?.message ?? '')).slice(0, 240);
  const code = Number(error?.code ?? 0) || '';
  const sub = Number(error?.error_subcode ?? 0) || '';
  const trace = String(error?.fbtrace_id ?? '').slice(0, 64);
  const http = extra?.httpStatus ?? '';
  facebookSendLog.warn(
    `facebook send failed http=${http} code=${code} subcode=${sub} fbtrace=${trace} message=${message}`,
  );
}

export async function sendFacebookText(
  pageId: string,
  token: string,
  psid: string,
  text: string,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    const response = await fetch(`https://graph.facebook.com/v21.0/${encodeURIComponent(pageId)}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { id: psid },
        messaging_type: 'RESPONSE',
        message: { text },
      }),
      signal: AbortSignal.timeout(8000),
    });
    const body = (await response.json().catch(() => null)) as {
      message_id?: string;
      error?: GraphFacebookSendError;
    } | null;
    const id = String(body?.message_id ?? '').trim();
    if (response.ok && id) return { ok: true, id };
    logFacebookSendError(body?.error, { httpStatus: response.status });
    return { ok: false, error: facebookSendError(body?.error) };
  } catch {
    return { ok: false, error: 'Không gửi được tới Facebook. Thử lại.' };
  }
}

export function facebookSendError(error?: GraphFacebookSendError): string {
  const message = String(error?.message ?? '');
  const code = Number(error?.code ?? 0);
  const sub = Number(error?.error_subcode ?? 0);
  if (sub === 2018278 || /outside of allowed window/i.test(message)) {
    return 'Facebook không chuyển tin vì khách chưa nhắn trong 24 giờ (mã 10/2018278 — ngoài cửa sổ 24 giờ).';
  }
  if (/not admins, developers or testers|app is live|permission is reviewed/i.test(message)) {
    return 'Người nhận không phải admin/tester của app, hoặc pages_messaging chưa được duyệt quyền nâng cao nên Facebook từ chối gửi tin.';
  }
  if (code === 190 || /session has expired|expired.*token|invalid oauth|invalid access token/i.test(message)) {
    return 'Token của Page đã hết hạn hoặc bị thu hồi (mã 190). Cần lưu lại token Business Manager.';
  }
  if (code === 10 || code === 200 || /pages_messaging|permission|not authorized|does not have permission|capability to make this api call/i.test(message)) {
    return 'pages_messaging chưa được duyệt quyền nâng cao, nên Facebook từ chối gửi tin (kể cả khi token đã có quyền chuẩn).';
  }
  if (message) {
    return `Facebook không nhận tin này. (${code || 'err'}${sub ? '/' + sub : ''})`;
  }
  return 'Facebook không nhận tin này.';
}

async function graphGet(path: string, token: string, timeoutMs = 8000): Promise<{ body: Record<string, unknown> | null; error: string }> {
  if (shouldPauseGraph()) {
    return { body: null, error: 'Facebook tam dung goi API vi gan dat gioi han. Thu lai sau.' };
  }
  try {
    const joiner = path.includes('?') ? '&' : '?';
    recordGraphCall(classifyGraphPath(path));
    const response = await fetch(`https://graph.facebook.com/v21.0/${path}${joiner}access_token=${encodeURIComponent(token)}`, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    noteGraphHeaders(response.headers);
    if (!response.ok || !body) {
      const error = graphErrorText(body);
      noteGraphError(error, extractGraphErrorCode(body));
      return { body: null, error };
    }
    return { body, error: '' };
  } catch {
    return { body: null, error: '' };
  }
}

async function graphGetUrl(url: string, timeoutMs = 8000): Promise<{ body: Record<string, unknown> | null; error: string }> {
  if (shouldPauseGraph()) {
    return { body: null, error: 'Facebook tam dung goi API vi gan dat gioi han. Thu lai sau.' };
  }
  try {
    recordGraphCall(classifyGraphPath(url));
    const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    noteGraphHeaders(response.headers);
    if (!response.ok || !body) {
      const error = graphErrorText(body);
      noteGraphError(error, extractGraphErrorCode(body));
      return { body: null, error };
    }
    return { body, error: '' };
  } catch {
    return { body: null, error: '' };
  }
}

function graphErrorText(body: Record<string, unknown> | null): string {
  const error = body?.error;
  if (!error || typeof error !== 'object') return '';
  const message = String((error as { message?: string }).message ?? '');
  if (/access_token/i.test(message)) return '';
  return message.slice(0, 160);
}

function pagingAfter(body: Record<string, unknown> | null): string {
  const paging = body?.paging;
  if (!paging || typeof paging !== 'object') return '';
  const cursors = (paging as { cursors?: { after?: string } }).cursors;
  return String(cursors?.after ?? '').trim();
}

function pagingNext(body: Record<string, unknown> | null): string {
  const paging = body?.paging;
  if (!paging || typeof paging !== 'object') return '';
  return String((paging as { next?: string }).next ?? '').trim();
}

function backfillDeadline(): number {
  return Date.now() + FACEBOOK_BACKFILL_TIMEOUT_MS;
}

function fieldValue(fields: GraphField[] | undefined, names: string[]): string {
  const wanted = new Set(names);
  const hit = (fields ?? []).find((field) => wanted.has(String(field.name ?? '')));
  return String(hit?.values?.[0] ?? '').trim();
}


function messageAttachments(message: GraphMessage): PulledMessage['attachments'] {
  const out: PulledMessage['attachments'] = [];
  for (const item of message.attachments?.data ?? []) {
    const url = String(
      item.image_data?.url ?? item.image_data?.preview_url ?? item.video_data?.url ?? item.file_url ?? item.url ?? '',
    ).trim();
    if (!url) continue;
    const mime = String(item.mime_type ?? '');
    const isImage = /^image\//i.test(mime) || Boolean(item.image_data) || /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(url);
    out.push({
      type: isImage ? 'image' : String(item.type ?? mime ?? 'file'),
      url,
      mime_type: mime,
      name: String(item.name ?? '').slice(0, 200),
    });
  }
  return out;
}

function messageBody(message: GraphMessage): string {
  const text = String(message.message ?? '').trim();
  const files = messageAttachments(message);
  const urls = files.filter((item) => item.type === 'image').map((item) => item.url);
  if (text && urls.length) return `${text.slice(0, 3500)}\n${urls.join('\n')}`.slice(0, 4000);
  if (text) return text.slice(0, 4000);
  if (urls.length) return urls.join('\n').slice(0, 4000);
  const attachments = message.attachments?.data ?? [];
  if (!attachments.length) return '';
  const hasSticker = attachments.some((item) => item.sticker_id != null);
  return hasSticker ? '[sticker]' : '[ảnh/sticker]';
}

function mapLead(lead: GraphLead, formName: string): PulledLead | null {
  const id = String(lead.id ?? '').trim();
  if (!id) return null;
  const parsed = parseLeadFieldData(lead.field_data);
  return {
    external_id: id.slice(0, 64),
    full_name: parsed.full_name.slice(0, 200),
    phone: parsed.phone.slice(0, 40),
    email: parsed.email.slice(0, 200),
    campaign_name: formName.slice(0, 200),
    campaign_id: String(lead.campaign_id ?? '').slice(0, 64),
    ad_id: String(lead.ad_id ?? '').slice(0, 64),
    adset_id: String(lead.adset_id ?? '').slice(0, 64),
    form_id: String(lead.form_id ?? '').slice(0, 64),
    answers: parsed.answers,
    created_at: String(lead.created_time ?? ''),
  };
}

function mapThreadMessages(
  pageId: string,
  thread: {
    participants?: { data?: Array<{ id?: string; name?: string }> };
    messages?: { data?: GraphMessage[] };
  },
): PulledMessage[] {
  const customer = (thread.participants?.data ?? []).find((person) => String(person.id ?? '') !== pageId);
  const customerName = String(customer?.name ?? '').trim() || 'Khách';
  const customerPsid = String(customer?.id ?? '').trim().slice(0, 64);
  const messages: PulledMessage[] = [];
  for (const message of thread.messages?.data ?? []) {
    const id = String(message.id ?? '').trim();
    if (!id) continue;
    const body = messageBody(message);
    const fromId = String(message.from?.id ?? '');
    messages.push({
      external_id: id,
      sender_name: customerName.slice(0, 200),
      sender_psid: customerPsid,
      body,
      received_at: String(message.created_time ?? ''),
      direction: fromId && fromId !== pageId ? 'in' : 'out',
      attachments: messageAttachments(message),
    });
  }
  return messages;
}

const CONV_FIELDS =
  'participants,messages.limit(12){id,message,from,created_time,attachments{mime_type,name,image_data,file_url,video_data,url}}';
const LEAD_FIELDS = 'id,created_time,field_data,ad_id,adset_id,campaign_id,form_id';

async function pullLeads(
  pageId: string,
  token: string,
  mode: PullMode,
  startAfter = '',
  maxHopsOverride?: number,
): Promise<{
  rows: PulledLead[];
  error: string;
  cursors: { form_after: string };
  hasMore: boolean;
  hops: number;
}> {
  const maxHops = maxHopsOverride ?? (mode === 'backfill' ? FACEBOOK_INBOX_MAX_HOPS : 1);
  const deadline = mode === 'backfill' ? backfillDeadline() : 0;
  let hops = 0;
  let after = startAfter.trim();
  let hasMore = false;
  let error = '';
  const leads: PulledLead[] = [];

  if (mode === 'backfill' && maxHops <= 0) {
    return { rows: leads, error: '', cursors: { form_after: after }, hasMore: Boolean(after), hops: 0 };
  }

  if (mode === 'incremental') {
    const result = await graphGet(
      `${encodeURIComponent(pageId)}/leadgen_forms?fields=name,leads.limit(20){${LEAD_FIELDS}}&limit=8`,
      token,
    );
    hops = 1;
    if (result.error) {
      const denied = /permission|leads_retrieval|#200|pages_manage_ads|pages_show_list/i.test(result.error);
      return {
        rows: [],
        error: denied ? 'Token chưa có quyền đọc lead của Page.' : 'Facebook không trả lead của Page.',
        cursors: { form_after: '' },
        hasMore: false,
        hops,
      };
    }
    const forms = Array.isArray(result.body?.data)
      ? (result.body?.data as Array<{ name?: string; leads?: { data?: GraphLead[] } }>)
      : [];
    for (const form of forms) {
      const formName = String(form.name ?? '');
      for (const lead of form.leads?.data ?? []) {
        const row = mapLead(lead, formName);
        if (row) leads.push(row);
      }
    }
    return { rows: leads, error: '', cursors: { form_after: '' }, hasMore: false, hops };
  }

  let nextUrl = '';
  while (hops < maxHops && Date.now() < deadline) {
    let result: { body: Record<string, unknown> | null; error: string };
    if (nextUrl) {
      result = await graphGetUrl(nextUrl, 12_000);
      nextUrl = '';
    } else {
      const path = after
        ? `${encodeURIComponent(pageId)}/leadgen_forms?fields=id,name&limit=8&after=${encodeURIComponent(after)}`
        : `${encodeURIComponent(pageId)}/leadgen_forms?fields=id,name&limit=8`;
      result = await graphGet(path, token, 12_000);
    }
    hops += 1;
    if (result.error) {
      const denied = /permission|leads_retrieval|#200|pages_manage_ads|pages_show_list/i.test(result.error);
      error = denied ? 'Token chưa có quyền đọc lead của Page.' : 'Facebook không trả lead của Page.';
      break;
    }
    const forms = Array.isArray(result.body?.data) ? (result.body?.data as Array<{ id?: string; name?: string }>) : [];
    for (const form of forms) {
      if (hops >= maxHops) break;
      const formId = String(form.id ?? '').trim();
      const formName = String(form.name ?? '');
      if (!formId) continue;
      let leadAfter = '';
      let leadNext = '';
      while (hops < maxHops && Date.now() < deadline) {
        let leadResult: { body: Record<string, unknown> | null; error: string };
        if (leadNext) {
          leadResult = await graphGetUrl(leadNext, 12_000);
          leadNext = '';
        } else {
          const leadPath = leadAfter
            ? `${encodeURIComponent(formId)}/leads?fields=${LEAD_FIELDS}&limit=20&after=${encodeURIComponent(leadAfter)}`
            : `${encodeURIComponent(formId)}/leads?fields=${LEAD_FIELDS}&limit=20`;
          leadResult = await graphGet(leadPath, token, 12_000);
        }
        hops += 1;
        const batch = Array.isArray(leadResult.body?.data) ? (leadResult.body?.data as GraphLead[]) : [];
        for (const lead of batch) {
          const row = mapLead(lead, formName);
          if (row) leads.push(row);
        }
        leadAfter = pagingAfter(leadResult.body);
        const leadNextUrl = pagingNext(leadResult.body);
        if (leadNextUrl) {
          leadNext = leadNextUrl;
          hasMore = true;
          continue;
        }
        if (leadAfter) {
          hasMore = true;
          continue;
        }
        break;
      }
    }
    after = pagingAfter(result.body);
    const formsNext = pagingNext(result.body);
    if (formsNext) {
      nextUrl = formsNext;
      hasMore = true;
      if (hops >= maxHops) {
        return { rows: leads, error, cursors: { form_after: after }, hasMore: true, hops };
      }
      continue;
    }
    if (!after) {
      return { rows: leads, error, cursors: { form_after: '' }, hasMore: false, hops };
    }
    hasMore = true;
    if (hops >= maxHops) {
      return { rows: leads, error, cursors: { form_after: after }, hasMore: true, hops };
    }
  }

  return { rows: leads, error, cursors: { form_after: after }, hasMore, hops };
}

async function pullMessages(
  pageId: string,
  token: string,
  mode: PullMode,
  startAfter = '',
  maxHopsOverride?: number,
): Promise<{
  rows: PulledMessage[];
  error: string;
  cursors: { conv_after: string };
  hasMore: boolean;
  hops: number;
}> {
  const maxHops = maxHopsOverride ?? (mode === 'backfill' ? FACEBOOK_INBOX_MAX_HOPS : 1);
  const deadline = mode === 'backfill' ? backfillDeadline() : 0;
  let hops = 0;
  let after = startAfter.trim();
  let hasMore = false;
  let error = '';
  const messages: PulledMessage[] = [];

  if (mode === 'backfill' && maxHops <= 0) {
    return { rows: messages, error: '', cursors: { conv_after: after }, hasMore: Boolean(after), hops: 0 };
  }

  if (mode === 'incremental') {
    const result = await graphGet(`${encodeURIComponent(pageId)}/conversations?fields=${CONV_FIELDS}&limit=20`, token, 8000);
    hops = 1;
    if (result.error) {
      const denied = /permission|pages_messaging|#200|pages_manage_metadata|conversations/i.test(result.error);
      return {
        rows: [],
        error: denied
          ? 'Token chưa có quyền đọc tin nhắn Messenger của Page.'
          : result.error || 'Facebook không trả tin nhắn của Page.',
        cursors: { conv_after: '' },
        hasMore: false,
        hops,
      };
    }
    const threads = Array.isArray(result.body?.data)
      ? (result.body?.data as Array<{
          participants?: { data?: Array<{ id?: string; name?: string }> };
          messages?: { data?: GraphMessage[] };
        }>)
      : [];
    for (const thread of threads) {
      messages.push(...mapThreadMessages(pageId, thread));
    }
    return { rows: messages, error: '', cursors: { conv_after: '' }, hasMore: false, hops };
  }

  let nextUrl = '';
  while (hops < maxHops && Date.now() < deadline) {
    let result: { body: Record<string, unknown> | null; error: string };
    if (nextUrl) {
      result = await graphGetUrl(nextUrl, 12_000);
      nextUrl = '';
    } else {
      const path = after
        ? `${encodeURIComponent(pageId)}/conversations?fields=${CONV_FIELDS}&limit=25&after=${encodeURIComponent(after)}`
        : `${encodeURIComponent(pageId)}/conversations?fields=${CONV_FIELDS}&limit=25`;
      result = await graphGet(path, token, 12_000);
    }
    hops += 1;
    if (result.error) {
      const denied = /permission|pages_messaging|#200|pages_manage_metadata|conversations/i.test(result.error);
      return {
        rows: [],
        error: denied
          ? 'Token chưa có quyền đọc tin nhắn Messenger của Page.'
          : result.error || 'Facebook không trả tin nhắn của Page.',
        cursors: { conv_after: after },
        hasMore: false,
        hops,
      };
    }
    const threads = Array.isArray(result.body?.data)
      ? (result.body?.data as Array<{
          participants?: { data?: Array<{ id?: string; name?: string }> };
          messages?: { data?: GraphMessage[] };
        }>)
      : [];
    for (const thread of threads) {
      messages.push(...mapThreadMessages(pageId, thread));
    }
    after = pagingAfter(result.body);
    const convNext = pagingNext(result.body);
    if (convNext) {
      nextUrl = convNext;
      hasMore = true;
      if (hops >= maxHops) {
        return { rows: messages, error, cursors: { conv_after: after }, hasMore: true, hops };
      }
      continue;
    }
    if (!after) {
      return { rows: messages, error, cursors: { conv_after: '' }, hasMore: false, hops };
    }
    hasMore = true;
    if (hops >= maxHops) {
      return { rows: messages, error, cursors: { conv_after: after }, hasMore: true, hops };
    }
  }

  return { rows: messages, error, cursors: { conv_after: after }, hasMore, hops };
}

/**
 * Production: POST …/api/portal/crm/meta/webhook với PTT_META_WEBHOOK_VERIFY_TOKEN.
 * Không gọi Graph subscribed_apps từ local — cấu hình callback trên Meta App Dashboard khi deploy.
 */
export function registerFacebookPageWebhookPlaceholder(_pageId: string, _callbackUrl: string): void {
  return;
}
