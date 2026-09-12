import { API_BASE, ApiError } from '@/lib/api';

export const MSOS_DISABLED_ERROR = 'media_os_disabled';

export async function msosFetch(
  token: string,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  const res = await fetch(`${API_BASE}/api/crm/media-os${normalized}`, {
    ...init,
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });
  if (res.status === 404) {
    const body = (await res.clone().json().catch(() => null)) as { error?: string } | null;
    if (body?.error === MSOS_DISABLED_ERROR) {
      throw new ApiError('Media OS chưa bật', 404);
    }
  }
  return res;
}
