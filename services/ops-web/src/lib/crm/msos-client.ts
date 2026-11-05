import { ApiError, parseJson } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import { msosFetch } from './msos-api';

export async function msosGet<T>(path: string): Promise<T> {
  const token = getAccessToken();
  if (!token) throw new ApiError('Chưa đăng nhập', 401);
  const res = await msosFetch(token, path);
  const body = await parseJson<T & { error?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.error ?? 'Request failed', res.status);
  }
  return body;
}

export async function msosMutate<T>(path: string, init: RequestInit): Promise<T> {
  const token = getAccessToken();
  if (!token) throw new ApiError('Chưa đăng nhập', 401);
  const res = await msosFetch(token, path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  const body = await parseJson<T & { error?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.error ?? 'Request failed', res.status);
  }
  return body;
}
