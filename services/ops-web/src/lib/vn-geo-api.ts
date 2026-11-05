import { API_BASE, ApiError, parseJson } from '@/lib/api';

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function geoFetch<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { ...authHeaders(token), ...(init?.headers as Record<string, string> | undefined) },
  });
  const body = await parseJson<T & { error?: string; message?: string }>(res);
  if (!res.ok) throw new ApiError(body.error ?? body.message ?? 'Geo request failed', res.status);
  return body;
}

export type VnProvinceOption = {
  code: string;
  name: string;
  name_en: string;
  sort_order: number;
  active: boolean;
  source: string;
  ward_count?: number;
};

export type VnWardOption = {
  code: string;
  province_code: string;
  province_name?: string;
  name: string;
  name_en: string;
  sort_order: number;
  active: boolean;
  source: string;
};

export async function fetchVnProvinces(token: string, includeInactive = false): Promise<VnProvinceOption[]> {
  const qs = includeInactive ? '?include_inactive=1' : '';
  const out = await geoFetch<{ provinces: VnProvinceOption[] }>(token, `/api/v1/geo/provinces${qs}`);
  return out.provinces ?? [];
}

export async function fetchVnWards(
  token: string,
  provinceCode?: string,
  includeInactive = false,
): Promise<VnWardOption[]> {
  const params = new URLSearchParams();
  if (provinceCode?.trim()) params.set('province_code', provinceCode.trim());
  if (includeInactive) params.set('include_inactive', '1');
  const qs = params.toString() ? `?${params}` : '';
  const out = await geoFetch<{ wards: VnWardOption[] }>(token, `/api/v1/geo/wards${qs}`);
  return out.wards ?? [];
}

export async function fetchVnAdminProvinces(token: string): Promise<VnProvinceOption[]> {
  const out = await geoFetch<{ provinces: VnProvinceOption[] }>(token, '/api/v1/geo/admin/provinces?include_inactive=1');
  return out.provinces ?? [];
}

export async function fetchVnAdminWards(token: string, provinceCode?: string): Promise<VnWardOption[]> {
  const qs = provinceCode?.trim()
    ? `?province_code=${encodeURIComponent(provinceCode.trim())}&include_inactive=1`
    : '?include_inactive=1';
  const out = await geoFetch<{ wards: VnWardOption[] }>(token, `/api/v1/geo/admin/wards${qs}`);
  return out.wards ?? [];
}

export async function syncVnAdminGeo(token: string): Promise<{ provinces: number; wards: number }> {
  const out = await geoFetch<{ provinces: number; wards: number }>(token, '/api/v1/geo/admin/sync', { method: 'POST' });
  return { provinces: out.provinces ?? 0, wards: out.wards ?? 0 };
}

export async function createVnProvince(
  token: string,
  body: { code: string; name: string; name_en?: string; sort_order?: number; active?: boolean },
): Promise<VnProvinceOption> {
  const out = await geoFetch<{ province: VnProvinceOption }>(token, '/api/v1/geo/admin/provinces', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return out.province;
}

export async function patchVnProvince(
  token: string,
  code: string,
  body: Partial<{ name: string; name_en: string; sort_order: number; active: boolean }>,
): Promise<VnProvinceOption> {
  const out = await geoFetch<{ province: VnProvinceOption }>(token, `/api/v1/geo/admin/provinces/${encodeURIComponent(code)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  return out.province;
}

export async function deleteVnProvince(token: string, code: string): Promise<void> {
  await geoFetch(token, `/api/v1/geo/admin/provinces/${encodeURIComponent(code)}`, { method: 'DELETE' });
}

export async function createVnWard(
  token: string,
  body: { code: string; province_code: string; name: string; name_en?: string; sort_order?: number; active?: boolean },
): Promise<VnWardOption> {
  const out = await geoFetch<{ ward: VnWardOption }>(token, '/api/v1/geo/admin/wards', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return out.ward;
}

export async function patchVnWard(
  token: string,
  code: string,
  body: Partial<{ province_code: string; name: string; name_en: string; sort_order: number; active: boolean }>,
): Promise<VnWardOption> {
  const out = await geoFetch<{ ward: VnWardOption }>(token, `/api/v1/geo/admin/wards/${encodeURIComponent(code)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  return out.ward;
}

export async function deleteVnWard(token: string, code: string): Promise<void> {
  await geoFetch(token, `/api/v1/geo/admin/wards/${encodeURIComponent(code)}`, { method: 'DELETE' });
}
