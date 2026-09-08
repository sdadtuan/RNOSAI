import { API_BASE, ApiError, parseJson } from '@/lib/api';

export class QtApiError extends ApiError {
  constructor(
    message: string,
    status: number,
    readonly code?: string,
  ) {
    super(message, status);
    this.name = 'QtApiError';
  }
}

export async function qtFetch<T>(
  token: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    ...((init?.headers as Record<string, string> | undefined) ?? {}),
  };
  if (init?.body && !headers['Content-Type'] && typeof init.body === 'string') {
    headers['Content-Type'] = 'application/json';
  }
  const suffix = path.startsWith('/') ? path : `/${path}`;
  const res = await fetch(`${API_BASE}/api/crm/proposals${suffix}`, {
    ...init,
    headers,
    cache: 'no-store',
  });
  const body = await parseJson<T & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new QtApiError(body.error ?? body.message ?? 'QT request failed', res.status, body.error);
  }
  return body;
}
