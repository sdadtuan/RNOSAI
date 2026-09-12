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

export async function readDownloadBody(res: Response): Promise<{ bytes: Buffer; mime: string }> {
  const mime = String(res.headers.get('content-type') ?? '').split(';')[0].trim()
    || 'application/octet-stream';
  const raw = await res.arrayBuffer();
  const bytes = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
  return { bytes, mime };
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
