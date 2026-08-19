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
  wallet_pct: number;
  expiring_count: number;
  can_view_pii: boolean;
  can_edit_pii: boolean;
  can_edit_roster: boolean;
  can_view_docs: boolean;
  can_edit_docs: boolean;
  can_view_contract?: boolean;
  can_edit_contract?: boolean;
  can_view_insurance?: boolean;
  can_edit_insurance?: boolean;
  active_contract?: HrActiveContractSummaryDto | null;
  insurance_summary?: HrInsuranceSummaryDto | null;
}

export interface HrInsuranceSummaryDto {
  bhyt_valid_to: string | null;
  bhyt_expiring_soon: boolean;
}

export interface HrStaffInsuranceDto {
  staff_id: number;
  bhxh_book_no: string;
  bhxh_book_no_masked?: boolean;
  bhxh_joined_on: string | null;
  bhxh_status: string;
  bhxh_document_id: number | null;
  bhxh_document_title?: string | null;
  bhyt_card_no: string;
  bhyt_card_no_masked?: boolean;
  bhyt_valid_from: string | null;
  bhyt_valid_to: string | null;
  bhyt_clinic_name: string;
  bhyt_document_id: number | null;
  bhyt_document_title?: string | null;
  bhtn_joined_on: string | null;
  bhtn_status: string;
  bhtn_document_id: number | null;
  bhtn_document_title?: string | null;
  notes: string;
}

export interface HrInsurancePeriodDto {
  id: number;
  staff_id: number;
  kind: string;
  period_year: number;
  period_month: number;
  salary_base: number | null;
  salary_masked?: boolean;
  notes: string;
}

export interface HrActiveContractSummaryDto {
  id: number;
  contract_no: string;
  kind: string;
  status: string;
  effective_on: string | null;
  expires_on: string | null;
  expiring_soon: boolean;
}

export interface HrLaborAppendixDto {
  id: number;
  contract_id: number;
  appendix_no: string;
  signed_on: string | null;
  effective_on: string | null;
  summary: string;
  salary_gross: number | null;
  salary_masked?: boolean;
  document_id: number | null;
  document_title?: string | null;
}

export interface HrLaborContractDto {
  id: number;
  staff_id: number;
  contract_no: string;
  kind: string;
  signed_on: string | null;
  effective_on: string | null;
  expires_on: string | null;
  salary_gross: number | null;
  salary_masked?: boolean;
  currency: string;
  work_place: string;
  job_title_legal: string;
  status: string;
  document_id: number | null;
  document_title?: string | null;
  notes: string;
  appendices: HrLaborAppendixDto[];
}

export interface HrDocTypeDto {
  type_code: string;
  label: string;
  category: string;
  is_system: boolean;
  is_required_onboard: boolean;
}

export interface HrDocWalletFileDto {
  id: number;
  original_name: string;
  mime_type: string;
  size_bytes: number;
}

export interface HrDocWalletCardDto {
  id: number;
  type_code: string;
  type_label?: string;
  type_category?: string;
  title: string;
  doc_no: string;
  issuer: string;
  issued_on: string | null;
  expires_on: string | null;
  status: string;
  pinned: boolean;
  file_count: number;
  files: HrDocWalletFileDto[];
  education?: {
    level: string;
    major: string;
    school: string;
    graduated_on: string | null;
    classification: string;
    training_form: string;
  } | null;
  notes?: string;
}

export interface HrWalletRosterStatDto {
  staff_id: number;
  wallet_pct: number;
  expiring_count: number;
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

export async function fetchHrDocTypes(token: string): Promise<{ types: HrDocTypeDto[] }> {
  const res = await fetch(`${API_BASE}/api/v1/hr/doc-types`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  const body = await parseJson<{ ok: true; types: HrDocTypeDto[]; error?: string }>(res);
  if (!res.ok) throw new ApiError(body.error ?? 'Không tải catalog giấy tờ', res.status);
  return { types: body.types ?? [] };
}

export async function fetchHrStaffWallet(
  token: string,
  staffId: number,
  query?: { category?: string; expiring_only?: boolean; education_only?: boolean; missing_files?: boolean },
): Promise<{ cards: HrDocWalletCardDto[]; wallet_pct: number; expiring_count: number }> {
  const qs = new URLSearchParams();
  if (query?.category) qs.set('category', query.category);
  if (query?.expiring_only) qs.set('expiring_only', '1');
  if (query?.education_only) qs.set('education_only', '1');
  if (query?.missing_files) qs.set('missing_files', '1');
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const res = await fetch(`${API_BASE}/api/v1/hr/staff/${staffId}/wallet${suffix}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  const body = await parseJson<{
    ok: true;
    cards: HrDocWalletCardDto[];
    wallet_pct: number;
    expiring_count: number;
    error?: string;
  }>(res);
  if (!res.ok) throw new ApiError(body.error ?? 'Không tải ví giấy tờ', res.status);
  return { cards: body.cards ?? [], wallet_pct: body.wallet_pct ?? 0, expiring_count: body.expiring_count ?? 0 };
}

export async function createHrWalletCard(
  token: string,
  staffId: number,
  payload: Record<string, unknown>,
): Promise<HrDocWalletCardDto> {
  const res = await fetch(`${API_BASE}/api/v1/hr/staff/${staffId}/wallet`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  const body = await parseJson<{ ok: true; card: HrDocWalletCardDto; error?: string }>(res);
  if (!res.ok) throw new ApiError(body.error ?? 'Tạo thẻ thất bại', res.status);
  return body.card;
}

export async function patchHrWalletCard(
  token: string,
  staffId: number,
  cardId: number,
  payload: Record<string, unknown>,
): Promise<HrDocWalletCardDto | null> {
  const res = await fetch(`${API_BASE}/api/v1/hr/staff/${staffId}/wallet/${cardId}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  const body = await parseJson<{ ok: true; card?: HrDocWalletCardDto; deleted?: boolean; error?: string }>(res);
  if (!res.ok) throw new ApiError(body.error ?? 'Cập nhật thẻ thất bại', res.status);
  return body.card ?? null;
}

export async function uploadHrWalletFile(
  token: string,
  staffId: number,
  cardId: number,
  file: File,
): Promise<HrDocWalletFileDto> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API_BASE}/api/v1/hr/staff/${staffId}/wallet/${cardId}/files`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const body = await parseJson<{ ok: true; file: HrDocWalletFileDto; error?: string }>(res);
  if (!res.ok) throw new ApiError(body.error ?? 'Upload thất bại', res.status);
  return body.file;
}

export function hrWalletFileUrl(staffId: number, cardId: number, fileId: number): string {
  return `${API_BASE}/api/v1/hr/staff/${staffId}/wallet/${cardId}/files/${fileId}`;
}

export async function fetchHrWalletRosterStats(
  token: string,
  staffIds: number[],
): Promise<HrWalletRosterStatDto[]> {
  if (!staffIds.length) return [];
  const res = await fetch(
    `${API_BASE}/api/v1/hr/staff/wallet-roster-stats?ids=${staffIds.join(',')}`,
    { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' },
  );
  const body = await parseJson<{ ok: true; items: HrWalletRosterStatDto[]; error?: string }>(res);
  if (!res.ok) return [];
  return body.items ?? [];
}

export async function fetchHrLaborContracts(
  token: string,
  staffId: number,
): Promise<{ contracts: HrLaborContractDto[]; active_contract: HrActiveContractSummaryDto | null }> {
  const res = await fetch(`${API_BASE}/api/v1/hr/staff/${staffId}/contracts`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  const body = await parseJson<{
    ok: true;
    contracts: HrLaborContractDto[];
    active_contract: HrActiveContractSummaryDto | null;
    error?: string;
  }>(res);
  if (!res.ok) throw new ApiError(body.error ?? 'Không tải hợp đồng', res.status);
  return { contracts: body.contracts ?? [], active_contract: body.active_contract ?? null };
}

export async function createHrLaborContract(
  token: string,
  staffId: number,
  payload: Record<string, unknown>,
): Promise<HrLaborContractDto> {
  const res = await fetch(`${API_BASE}/api/v1/hr/staff/${staffId}/contracts`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  const body = await parseJson<{ ok: true; contract: HrLaborContractDto; error?: string }>(res);
  if (!res.ok) throw new ApiError(body.error ?? 'Tạo hợp đồng thất bại', res.status);
  return body.contract;
}

export async function patchHrLaborContract(
  token: string,
  staffId: number,
  contractId: number,
  payload: Record<string, unknown>,
): Promise<HrLaborContractDto> {
  const res = await fetch(`${API_BASE}/api/v1/hr/staff/${staffId}/contracts/${contractId}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  const body = await parseJson<{ ok: true; contract: HrLaborContractDto; error?: string }>(res);
  if (!res.ok) throw new ApiError(body.error ?? 'Cập nhật hợp đồng thất bại', res.status);
  return body.contract;
}

export async function createHrLaborAppendix(
  token: string,
  staffId: number,
  contractId: number,
  payload: Record<string, unknown>,
): Promise<HrLaborAppendixDto> {
  const res = await fetch(`${API_BASE}/api/v1/hr/staff/${staffId}/contracts/${contractId}/appendices`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  const body = await parseJson<{ ok: true; appendix: HrLaborAppendixDto; error?: string }>(res);
  if (!res.ok) throw new ApiError(body.error ?? 'Tạo phụ lục thất bại', res.status);
  return body.appendix;
}

export async function patchHrLaborAppendix(
  token: string,
  staffId: number,
  contractId: number,
  appendixId: number,
  payload: Record<string, unknown>,
): Promise<HrLaborAppendixDto> {
  const res = await fetch(
    `${API_BASE}/api/v1/hr/staff/${staffId}/contracts/${contractId}/appendices/${appendixId}`,
    {
      method: 'PATCH',
      headers: authHeaders(token),
      body: JSON.stringify(payload),
    },
  );
  const body = await parseJson<{ ok: true; appendix: HrLaborAppendixDto; error?: string }>(res);
  if (!res.ok) throw new ApiError(body.error ?? 'Cập nhật phụ lục thất bại', res.status);
  return body.appendix;
}

export async function fetchHrStaffInsurance(
  token: string,
  staffId: number,
): Promise<{
  register: HrStaffInsuranceDto;
  periods: HrInsurancePeriodDto[];
  summary: HrInsuranceSummaryDto | null;
}> {
  const res = await fetch(`${API_BASE}/api/v1/hr/staff/${staffId}/insurance`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  const body = await parseJson<{
    ok: true;
    register: HrStaffInsuranceDto;
    periods: HrInsurancePeriodDto[];
    summary: HrInsuranceSummaryDto | null;
    error?: string;
  }>(res);
  if (!res.ok) throw new ApiError(body.error ?? 'Không tải sổ bảo hiểm', res.status);
  return {
    register: body.register,
    periods: body.periods ?? [],
    summary: body.summary ?? null,
  };
}

export async function putHrStaffInsurance(
  token: string,
  staffId: number,
  payload: Record<string, unknown>,
): Promise<{ register: HrStaffInsuranceDto; summary: HrInsuranceSummaryDto | null }> {
  const res = await fetch(`${API_BASE}/api/v1/hr/staff/${staffId}/insurance`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  const body = await parseJson<{
    ok: true;
    register: HrStaffInsuranceDto;
    summary: HrInsuranceSummaryDto | null;
    error?: string;
  }>(res);
  if (!res.ok) throw new ApiError(body.error ?? 'Lưu sổ BH thất bại', res.status);
  return { register: body.register, summary: body.summary ?? null };
}

export async function createHrInsurancePeriod(
  token: string,
  staffId: number,
  payload: Record<string, unknown>,
): Promise<HrInsurancePeriodDto> {
  const res = await fetch(`${API_BASE}/api/v1/hr/staff/${staffId}/insurance/periods`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  const body = await parseJson<{ ok: true; period: HrInsurancePeriodDto; error?: string }>(res);
  if (!res.ok) throw new ApiError(body.error ?? 'Thêm kỳ đóng thất bại', res.status);
  return body.period;
}
