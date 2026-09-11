import { HttpException } from '@nestjs/common';

export const PUBLICATION_LOG_RETRY_UNIQUE = 'cmkt_publication_logs_item_retry_uq';

/** Single-statement insert: retry_n = COALESCE(MAX(retry_n),0)+1 for that item_id. */
export const PUBLICATION_LOG_INSERT_SQL = `INSERT INTO cmkt_publication_logs (item_id, error, retry_n, post_id, http_status)
         SELECT $1, $2,
                COALESCE((SELECT MAX(retry_n) FROM cmkt_publication_logs WHERE item_id = $1), 0) + 1,
                $3, $4
         RETURNING id, item_id, attempted_at, error, retry_n, post_id, http_status`;

export function nextPublicationRetryN(maxRetry: number | null | undefined): number {
  const n = Number(maxRetry);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.floor(n) + 1;
}

export function isPublicationRetryNCollision(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const rec = err as { code?: unknown; constraint?: unknown };
  if (rec.code !== '23505') return false;
  if (rec.constraint == null || rec.constraint === '') return true;
  return rec.constraint === PUBLICATION_LOG_RETRY_UNIQUE;
}

export async function insertPublicationLogWithRetry<T>(
  insertOnce: () => Promise<T>,
  maxAttempts = 8,
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return await insertOnce();
    } catch (err) {
      lastErr = err;
      if (!isPublicationRetryNCollision(err)) throw err;
    }
  }
  throw lastErr;
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
