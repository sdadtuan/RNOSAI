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

export type CreateIoInput = {
  rate_version_id: string;
  period_start: string;
  period_end: string;
  qty: number;
  sell_vnd?: number;
  buy_vnd?: number;
  tier?: string;
  staffId?: number | null;
};

export type MsosBrandSafetySnapshotRow = {
  id: string;
  tier: string;
  alcohol_pharma_banned: boolean;
  exclusions_json: unknown;
  locked_at: string;
};

export type MsosInsertionOrderRow = {
  id: string;
  display_code: string;
  package_id: string;
  media_line_id: string | null;
  client_id: string;
  rate_version_id: string;
  safety_snapshot_id: string;
  period_start: string;
  period_end: string;
  qty: number;
  sell_vnd: number;
  buy_vnd: number;
  partner_confirmed_at: string | null;
  partner_confirm_ref: string | null;
  issued_at: string | null;
  issued_by: number | null;
  status: 'draft' | 'issued' | 'confirmed' | 'cancelled';
};

export type SafetyChangeInput = {
  tier: string;
  exclusions_json?: unknown[];
  alcohol_pharma_banned?: boolean;
  staffId?: number | null;
};

export type CreateMediaLineInput = {
  package_id: string;
  io_id?: string | null;
  commercial_ref?: string | null;
  connector_external_id?: string | null;
  tracking_owner_staff_id?: number | null;
  staffId?: number | null;
};

export type MsosMediaLineRow = {
  id: string;
  display_code: string;
  package_id: string;
  io_id: string | null;
  client_id: string;
  commercial_ref: string | null;
  connector_external_id: string | null;
  tracking_owner_staff_id: number | null;
  status: string;
  live_at: string | null;
  live_by: number | null;
  p03_override_by: number | null;
  p03_override_at: string | null;
  created_at: string;
};

export type GoLiveInput = {
  confirm: boolean;
  actor: 'human' | 'ai';
};

export type UpsertTrafficInput = {
  creative_id?: string | null;
  width_px?: number | null;
  height_px?: number | null;
  weight_kb?: number | null;
  click_url?: string | null;
  backup_attached?: boolean;
};

export type MsosTrafficPackRow = {
  id: string;
  display_code: string;
  media_line_id: string;
  creative_id: string | null;
  width_px: number | null;
  height_px: number | null;
  weight_kb: number | null;
  click_url: string | null;
  backup_attached: boolean;
  status: string;
  reject_reason: string | null;
  updated_at: string;
};

export type CreateEvidenceInput = {
  media_line_id: string;
  source: string;
  hash?: string | null;
  captured_at: string;
  storage_key?: string | null;
  staffId?: number | null;
};

export type MsosEvidenceRow = {
  id: string;
  display_code: string;
  media_line_id: string;
  source: string;
  hash: string | null;
  captured_at: string;
  storage_key: string | null;
  created_by: number | null;
  created_at: string;
};

export type CreateEvidencePackInput = {
  media_line_id: string;
};

export type MsosEvidencePackRow = {
  id: string;
  display_code: string;
  media_line_id: string;
  status: 'draft' | 'official';
  official_at: string | null;
  created_at: string;
};

export type CreateDiscrepancyInput = {
  report_qty?: number | null;
  evidence_qty?: number | null;
  actual_qty?: number | null;
  tolerance_bps?: number;
  hypothesis?: string | null;
  owner_staff_id?: number | null;
};

export type MsosDiscrepancyCaseRow = {
  id: string;
  display_code: string;
  media_line_id: string;
  io_qty: number;
  report_qty: number | null;
  evidence_qty: number | null;
  tolerance_bps: number;
  material: boolean;
  hypothesis: string | null;
  owner_staff_id: number | null;
  status: string;
  created_at: string;
};

export type CreateMakeGoodInput = {
  qty: number;
  value_vnd?: number;
  staffId?: number | null;
};

export type MsosMakeGoodRow = {
  id: string;
  display_code: string;
  discrepancy_id: string;
  media_line_id: string;
  qty: number;
  value_vnd: number;
  capacity_reserved: boolean;
  closed_at: string | null;
  created_by: number | null;
  created_at: string;
};

export type ReserveMakeGoodCapacityInput = {
  placement_id: string;
  bucket_date: string;
};

export type CreateOutcomeLinkInput = {
  media_line_id: string;
  lead_id?: string | null;
  sale_id?: string | null;
  model?: string | null;
};

export type MsosOutcomeLinkRow = {
  id: string;
  display_code: string;
  media_line_id: string;
  lead_id: string | null;
  sale_id: string | null;
  model: string | null;
  match_status: 'matched' | 'unmatched';
  created_at: string;
};

export type MsosMarginInputs = {
  gross_sell_vnd: number;
  discount_vnd: number;
  media_cost_vnd: number;
  make_good_cost_vnd: number;
  rebate_accrued_vnd: number;
  service_cost_vnd: number;
};

export type MsosMarginSnapshotRow = {
  id: string;
  media_line_id: string;
  gross_sell_vnd: number;
  discount_vnd: number;
  media_cost_vnd: number;
  make_good_cost_vnd: number;
  rebate_accrued_vnd: number;
  service_cost_vnd: number;
  contribution_vnd: number;
  contribution_bps: number;
  closed: boolean;
  created_at: string;
};

export type MsosMarginDto = MsosMarginInputs & {
  contribution_vnd: number;
  contribution_bps: number;
  closed: boolean;
  snapshot_id: string | null;
};

export type MsosFinanceRequestRow = {
  id: string;
  media_line_id: string;
  evidence_pack_id: string | null;
  requested_by: number;
  status: 'requested' | 'accepted' | 'rejected';
  invoice_id: string | null;
  created_at: string;
};

export type MsosExceptionRow = {
  id: string;
  priority: 'P0' | 'P1' | 'P2';
  kind: string;
  media_line_id: string | null;
  placement_id: string | null;
  title: string;
  evidence_text: string;
  open: boolean;
  created_at: string;
};

export type MsosScorecardRow = {
  id: string;
  partner_id: string;
  delivery_bps: number | null;
  discrepancy_bps: number | null;
  safety_incidents: number;
  score: number;
  computed_at: string;
};

export type MsosEligibilityRow = {
  partner_id: string;
  kyc_pass: boolean;
  scorecard_pass: boolean;
  rate_published: boolean;
  reseller_open: boolean;
};

export type MsosEligibilityDto = MsosEligibilityRow & {
  locked: boolean;
};
