export type MsosHealthDto = {
  ok: true;
  reseller: boolean;
  connector_write: boolean;
};

export type MsosPartnerRow = {
  id: string;
  display_code: string;
  legal_name: string;
  status: string;
  kyc_pass: boolean;
  created_at: string;
  created_by: number | null;
};

export type MsosInventoryRow = {
  id: string;
  display_code: string;
  name: string;
  owner_kind: 'ptt' | 'partner';
  partner_id: string | null;
  property_host: string | null;
  status: string;
  created_at: string;
};

export type MsosPlacementRow = {
  id: string;
  inventory_id: string;
  name: string;
  format: string;
  device: string | null;
  geo: string | null;
  unit_kind: string;
  brand_safety_tier: string;
  backup_required: boolean;
  max_weight_kb: number | null;
  created_at: string;
};

export type CreatePartnerInput = {
  legal_name: string;
  staffId?: number | null;
};

export type CreateInventoryInput = {
  name: string;
  owner_kind: 'ptt' | 'partner';
  partner_id?: string | null;
  property_host?: string | null;
};

export type CreatePlacementInput = {
  inventory_id: string;
  name: string;
  format: string;
  unit_kind: string;
  backup_required?: boolean;
  max_weight_kb?: number | null;
  device?: string | null;
  geo?: string | null;
};

export type MsosRateCardRow = {
  id: string;
  display_code: string;
  owner_kind: 'ptt' | 'partner';
  partner_id: string | null;
  created_at: string;
};

export type MsosRateVersionRow = {
  id: string;
  rate_card_id: string;
  version: number;
  status: 'draft' | 'published' | 'expired';
  published_at: string | null;
  published_by: number | null;
  unit_price_vnd: number;
  currency: string;
};

export type CreateRateCardInput = {
  owner_kind: 'ptt' | 'partner';
  partner_id?: string | null;
};

export type CreateRateVersionInput = {
  unit_price_vnd: number;
};

export type CapacityBucketInput = {
  date: string;
  total_qty: number;
};

export type MsosCalendarDay = {
  date: string;
  total: number;
  reserved_hard: number;
  reserved_soft: number;
  conflict: boolean;
};

export type MsosPackageLineInput = {
  placement_id: string;
  rate_version_id: string;
  qty: number;
  period_start: string;
  period_end: string;
};

export type CreatePackageInput = {
  client_id: string;
  commercial_ref?: string | null;
  sell_vnd?: number;
  hide_buy_side?: boolean;
  lines: MsosPackageLineInput[];
  staffId?: number | null;
};

export type MsosPackageLineRow = {
  id: string;
  package_id: string;
  placement_id: string;
  rate_version_id: string;
  qty: number;
  period_start: string;
  period_end: string;
};

export type MsosPackageRow = {
  id: string;
  display_code: string;
  client_id: string;
  commercial_ref: string | null;
  sell_vnd: number;
  hide_buy_side: boolean;
  created_at: string;
  created_by: number | null;
  lines?: MsosPackageLineRow[];
};

export type ReservePackageInput = {
  placement_id: string;
  bucket_date: string;
  kind: 'soft' | 'hard' | 'waitlist';
  qty: number;
};

export type MsosReservationRow = {
  id: string;
  package_id: string;
  placement_id: string;
  bucket_date: string;
  kind: 'soft' | 'hard' | 'waitlist';
  qty: number;
  expires_at: string | null;
  released_at: string | null;
  created_at: string;
};
