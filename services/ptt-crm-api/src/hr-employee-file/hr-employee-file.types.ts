export type HrAddressKind = 'permanent' | 'temporary' | 'contact';

export interface HrStaffIdentityRow {
  staff_id: number;
  legal_name: string;
  dob: string | null;
  gender: string;
  nationality: string;
  cccd: string;
  cccd_issued_on: string | null;
  cccd_issued_by: string;
  tax_code: string;
  bank_name: string;
  bank_account: string;
  bank_holder: string;
  timeclock_pin: string;
  created_at: string;
  updated_at: string;
}

export interface HrStaffAddressRow {
  id: number;
  staff_id: number;
  kind: HrAddressKind;
  province_code: string;
  district_code: string;
  ward_code: string;
  line1: string;
  same_as_permanent: boolean;
  created_at: string;
  updated_at: string;
}

export interface PatchHrStaffIdentityBody {
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
}

export interface PutHrStaffAddressInput {
  kind: HrAddressKind;
  province_code?: string;
  district_code?: string;
  ward_code?: string;
  line1?: string;
  same_as_permanent?: boolean;
}

export interface PutHrStaffAddressesBody {
  addresses: PutHrStaffAddressInput[];
}

export interface HrStaffProfileStaffSummary {
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
}

export interface HrStaffProfileResponse {
  ok: true;
  staff: HrStaffProfileStaffSummary;
  identity: Partial<HrStaffIdentityRow> & { cccd_masked?: boolean; pii_masked?: boolean };
  addresses: HrStaffAddressRow[];
  completeness_pct: number;
  wallet_pct: number;
  expiring_count: number;
  can_view_pii: boolean;
  can_edit_pii: boolean;
  can_edit_roster: boolean;
  can_view_docs: boolean;
  can_edit_docs: boolean;
}

export const HR_PII_IDENTITY_FIELDS = [
  'cccd',
  'tax_code',
  'bank_name',
  'bank_account',
  'bank_holder',
] as const;

export type HrPiiIdentityField = (typeof HR_PII_IDENTITY_FIELDS)[number];
