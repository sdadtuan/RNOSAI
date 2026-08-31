import { HttpException } from '@nestjs/common';

/** Flatten Nest HttpException / Error into a user-facing string. */
export function extractHttpErrorMessage(err: unknown, fallback = 'Yêu cầu không hợp lệ'): string {
  if (err instanceof HttpException) {
    const resp = err.getResponse();
    if (typeof resp === 'string' && resp.trim()) return resp.trim();
    if (typeof resp === 'object' && resp !== null) {
      const o = resp as Record<string, unknown>;
      if (typeof o.message === 'string' && o.message.trim()) return o.message.trim();
      if (Array.isArray(o.message) && typeof o.message[0] === 'string') return o.message[0];
      if (typeof o.error === 'string' && o.error.trim() && o.error !== 'Bad Request') return o.error.trim();
    }
    if (err.message && err.message !== 'Bad Request Exception') return err.message;
    return fallback;
  }
  if (err instanceof Error && err.message.trim()) return err.message.trim();
  return fallback;
}
