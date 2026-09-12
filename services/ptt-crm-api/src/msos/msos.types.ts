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
