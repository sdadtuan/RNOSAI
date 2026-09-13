import { HttpException } from '@nestjs/common';

export function throwMagnificDisconnected(): never {
  const body = { error: 'magnific_disconnected', gate: 'GT-M01' };
  throw Object.assign(new HttpException(body, 409), body);
}

export function requireMagnificSecret(value: unknown): string {
  const text = String(value ?? '').trim();
  if (!text) throwMagnificDisconnected();
  return text;
}

export function assertMagnificHttpStatus(status: number): void {
  if (status === 401) throwMagnificDisconnected();
}

export function redactMagnificSecret(text: string, secret: string): string {
  const token = String(secret ?? '');
  if (!token) return text;
  return text.split(token).join('[redacted]');
}

export function logMagnificSafe(
  log: ((message: string) => void) | undefined,
  message: string,
  secret: string,
): void {
  if (!log) return;
  log(redactMagnificSecret(message, secret));
}

export function unwrapProviderPayload(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return {};
  const rec = payload as Record<string, unknown>;
  const fromResult = rec.result != null ? unwrapContent(rec.result) : rec;
  return unwrapContent(fromResult);
}

export function parseCredits(payload: unknown): number | null {
  const rec = unwrapProviderPayload(payload);
  const raw = rec.credits ?? rec.balance ?? rec.remaining
    ?? (rec.account && typeof rec.account === 'object'
      ? (rec.account as Record<string, unknown>).credits
      : undefined);
  const number = Number(raw);
  return Number.isFinite(number) ? number : null;
}

export function parseExternalRunId(payload: unknown): string {
  const rec = unwrapProviderPayload(payload);
  const raw = rec.id ?? rec.run_id ?? rec.creation_id ?? rec.external_run_id ?? rec.job_id;
  return String(raw ?? '').trim();
}

export function parseOutputUrls(payload: unknown): string[] {
  const rec = unwrapProviderPayload(payload);
  const lists = [rec.output_urls, rec.outputUrls, rec.urls, rec.outputs];
  const urls: string[] = [];
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      if (typeof item === 'string' && item.trim()) urls.push(item.trim());
      else if (item && typeof item === 'object') {
        const url = String((item as Record<string, unknown>).url ?? '').trim();
        if (url) urls.push(url);
      }
    }
  }
  const single = String(rec.output_url ?? rec.url ?? '').trim();
  if (single) urls.push(single);
  return [...new Set(urls)];
}

export function parseActualCredits(payload: unknown): number | null {
  const rec = unwrapProviderPayload(payload);
  const raw = rec.actual_credits ?? rec.credits_used ?? rec.credits;
  const number = Number(raw);
  return Number.isFinite(number) ? number : null;
}

export const MAGNIFIC_WAIT_POLL_MS = 3_000;
export const MAGNIFIC_STATUS_TIMEOUT_MS = 15_000;

export function parseMagnificTerminalFailure(payload: unknown): string | null {
  const rec = unwrapProviderPayload(payload);
  const status = String(rec.status ?? rec.state ?? '').toLowerCase();
  if (['failed', 'error', 'cancelled', 'canceled'].includes(status)) {
    return String(rec.error ?? rec.message ?? rec.error_message ?? status);
  }
  return null;
}

export function parseFlowRunIdentifier(payload: unknown): string {
  const rec = unwrapProviderPayload(payload);
  const raw = rec.workflow_run_identifier
    ?? rec.workflowRunIdentifier
    ?? rec.run_id
    ?? rec.id;
  return String(raw ?? '').trim();
}

export function parseFlowRunStatus(payload: unknown): string {
  const rec = unwrapProviderPayload(payload);
  return String(rec.status ?? rec.state ?? '').trim();
}

export function parseFlowResultMediaUrls(payload: unknown): string[] {
  const rec = unwrapProviderPayload(payload);
  const result = rec.result != null && typeof rec.result === 'object' && !Array.isArray(rec.result)
    ? rec.result as Record<string, unknown>
    : rec;
  const urls = [
    ...parseUrlList(result.videos),
    ...parseUrlList(result.images),
  ];
  return [...new Set(urls)];
}

export type MagnificFlowListItem = {
  sqid: string;
  name: string;
  total_cost: number | null;
};

export type MagnificFlowInputSchema = {
  api_key: string;
  type: string;
  required: boolean;
};

export type MagnificFlowDetail = {
  sqid: string;
  name: string;
  inputs: MagnificFlowInputSchema[];
  total_cost: number | null;
};

export function parseFlowListItems(payload: unknown): MagnificFlowListItem[] {
  const rec = unwrapProviderPayload(payload);
  const data = Array.isArray(rec.data)
    ? rec.data
    : Array.isArray(rec.items)
      ? rec.items
      : Array.isArray(rec.flows)
        ? rec.flows
        : [];
  const items: MagnificFlowListItem[] = [];
  for (const entry of data) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const row = entry as Record<string, unknown>;
    const sqid = String(row.sqid ?? row.id ?? row.flow_id ?? '').trim();
    if (!sqid) continue;
    const totalRaw = row.total_cost ?? (
      row.tool_metadata && typeof row.tool_metadata === 'object'
        ? (row.tool_metadata as Record<string, unknown>).total_cost
        : undefined
    );
    const total = Number(totalRaw);
    items.push({
      sqid,
      name: String(row.name ?? row.title ?? sqid).trim(),
      total_cost: Number.isFinite(total) ? Math.trunc(total) : null,
    });
  }
  return items;
}

export function parseFlowDetail(payload: unknown, fallbackSqid = ''): MagnificFlowDetail | null {
  const rec = unwrapProviderPayload(payload);
  const sqid = String(rec.sqid ?? rec.id ?? rec.flow_id ?? fallbackSqid).trim();
  if (!sqid) return null;
  const inputsRaw = Array.isArray(rec.inputs)
    ? rec.inputs
    : Array.isArray(rec.input_schema)
      ? rec.input_schema
      : [];
  const inputs: MagnificFlowInputSchema[] = [];
  for (const entry of inputsRaw) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const row = entry as Record<string, unknown>;
    const apiKey = String(row.api_key ?? row.key ?? row.id ?? '').trim();
    if (!apiKey) continue;
    inputs.push({
      api_key: apiKey,
      type: String(row.type ?? row.input_type ?? 'text').trim(),
      required: row.required === true || row.required === 'true',
    });
  }
  const totalRaw = rec.total_cost ?? (
    rec.tool_metadata && typeof rec.tool_metadata === 'object'
      ? (rec.tool_metadata as Record<string, unknown>).total_cost
      : undefined
  );
  const total = Number(totalRaw);
  return {
    sqid,
    name: String(rec.name ?? rec.title ?? sqid).trim(),
    inputs,
    total_cost: Number.isFinite(total) ? Math.trunc(total) : null,
  };
}

function parseUrlList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const urls: string[] = [];
  for (const item of value) {
    if (typeof item === 'string' && item.trim()) urls.push(item.trim());
    else if (item && typeof item === 'object') {
      const url = String((item as Record<string, unknown>).url ?? '').trim();
      if (url) urls.push(url);
    }
  }
  return urls;
}

export function throwMagnificWaitFailed(reason: 'wait_timeout' | 'vendor_failed'): never {
  const body = { error: 'ASSET_SYNC_FAILED', error_class: 'ASSET_SYNC_FAILED', reason };
  throw Object.assign(new HttpException(body, 409), body);
}

export function magnificDownloadAuthHeaders(
  url: string,
  secret: string,
  env: NodeJS.ProcessEnv = process.env,
): Record<string, string> {
  if (!shouldAttachMagnificDownloadAuth(url, env)) return {};
  return { Authorization: `Bearer ${secret}` };
}

export function assertMagnificDownloadAllowed(
  url: string,
  env: NodeJS.ProcessEnv = process.env,
): void {
  if (shouldAttachMagnificDownloadAuth(url, env)) return;
  const body = { error: 'magnific_download_host_blocked' };
  throw Object.assign(new HttpException(body, 409), body);
}

export function shouldAttachMagnificDownloadAuth(
  url: string,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const target = originOf(url);
  if (!target) return false;
  const extra = String(env.MAGNIFIC_DOWNLOAD_ALLOWLIST ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  const allowed = [
    'https://mcp.magnific.com',
    String(env.MAGNIFIC_REST_BASE ?? '').trim(),
    ...extra,
  ];
  return allowed.some((base) => originOf(base) === target);
}

export async function readDownloadBody(res: Response): Promise<{ bytes: Buffer; mime: string }> {
  const mime = String(res.headers.get('content-type') ?? '').split(';')[0].trim()
    || 'application/octet-stream';
  const raw = await res.arrayBuffer();
  const bytes = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
  return { bytes, mime };
}

function originOf(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function unwrapContent(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const rec = value as Record<string, unknown>;
  if (Array.isArray(rec.content)) {
    const textPart = rec.content.find((item) =>
      item && typeof item === 'object' && typeof (item as { text?: unknown }).text === 'string',
    ) as { text?: string } | undefined;
    if (textPart?.text) {
      try {
        const parsed = JSON.parse(textPart.text) as unknown;
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return parsed as Record<string, unknown>;
        }
      } catch {
        return rec;
      }
    }
  }
  if (rec.structuredContent && typeof rec.structuredContent === 'object' && !Array.isArray(rec.structuredContent)) {
    return rec.structuredContent as Record<string, unknown>;
  }
  return rec;
}
