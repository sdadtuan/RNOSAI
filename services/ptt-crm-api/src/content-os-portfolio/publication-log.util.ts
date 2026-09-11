import { HttpException } from '@nestjs/common';

export function nextPublicationRetryN(maxRetry: number | null | undefined): number {
  const n = Number(maxRetry);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.floor(n) + 1;
}

function errorCodeFromResponse(res: string | object): string {
  if (typeof res === 'string' && res.trim()) return res;
  if (res && typeof res === 'object') {
    const rec = res as { error?: unknown; message?: unknown };
    if (typeof rec.error === 'string' && rec.error.trim()) return rec.error;
    if (typeof rec.message === 'string' && rec.message.trim()) return rec.message;
  }
  return '';
}

export function publicationLogFromError(err: unknown): { error: string; http_status: number | null } {
  if (err instanceof HttpException) {
    const http_status = err.getStatus();
    const code = errorCodeFromResponse(err.getResponse());
    return { error: code || err.message, http_status };
  }
  if (err instanceof Error && err.message.trim()) {
    return { error: err.message, http_status: null };
  }
  return { error: 'publish_failed', http_status: null };
}
