import { API_BASE, parseJson, ApiError } from '@/lib/api';

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export interface HrStaffIdentityDto {
  staff_id?: number;
  legal_name?: string;
  dob?: string | null;
  gender?: string;
  nationality?: string;
  cccd?: string;
  cccd_issued_on?: string | null;
  cccd_issued_by?: string;
  tax_code?: string;
  bank_name?: string;
  bank_account?: string;
  bank_holder?: string;
  timeclock_pin?: string;
  cccd_masked?: boolean;
  pii_masked?: boolean;
}

export interface HrStaffAddressDto {
  id?: number;
  staff_id?: number;
  kind: 'permanent' | 'temporary' | 'contact';
  province_code?: string;
  district_code?: string;
  ward_code?: string;
  line1?: string;
  same_as_permanent?: boolean;
}

export interface HrStaffProfileDto {
  ok: true;
  staff: {
    id: number;
    name: string;
    phone: string;
    email: string;
    job_title: string;
    department: string;
    internal_code: string;
    active: number;
    dept_name: string;
    started_on: string;
  };
  identity: HrStaffIdentityDto;
  addresses: HrStaffAddressDto[];
  completeness_pct: number;
  can_view_pii: boolean;
  can_edit_pii: boolean;
  can_edit_roster: boolean;
}

export async function fetchHrStaffProfile(token: string, staffId: number): Promise<HrStaffProfileDto> {
  const res = await fetch(`${API_BASE}/api/v1/hr/staff/${staffId}/profile`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  const body = await parseJson<HrStaffProfileDto & { error?: string }>(res);
  if (!res.ok) throw new ApiError(body.error ?? 'Không tải được hồ sơ NV', res.status);
  return body;
}

export async function patchHrStaffIdentity(
  token: string,
  staffId: number,
  payload: HrStaffIdentityDto,
): Promise<{ ok: true; identity: HrStaffIdentityDto; completeness_pct: number }> {
  const res = await fetch(`${API_BASE}/api/v1/hr/staff/${staffId}/identity`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  const body = await parseJson<{ ok: true; identity: HrStaffIdentityDto; completeness_pct: number; error?: string }>(
    res,
  );
  if (!res.ok) throw new ApiError(body.error ?? 'Lưu định danh thất bại', res.status);
  return body;
}

export async function putHrStaffAddresses(
  token: string,
  staffId: number,
  addresses: HrStaffAddressDto[],
): Promise<{ ok: true; addresses: HrStaffAddressDto[]; completeness_pct: number }> {
  const res = await fetch(`${API_BASE}/api/v1/hr/staff/${staffId}/addresses`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify({ addresses }),
  });
  const body = await parseJson<{
    ok: true;
    addresses: HrStaffAddressDto[];
    completeness_pct: number;
    error?: string;
  }>(res);
  if (!res.ok) throw new ApiError(body.error ?? 'Lưu địa chỉ thất bại', res.status);
  return body;
}
