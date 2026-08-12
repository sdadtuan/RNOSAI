export type SpcOfferStatus = 'draft' | 'published' | 'archived';
export type SpcTier = 'CB' | 'TC' | 'CS';

export type SpcPricingModel = Record<string, unknown>;

export type SpcFamilyRow = {
  dv_code: string;
  name_vi: string;
  department: string;
  role_vi: string;
  service_type: string;
  description_vi: string;
  risks_json: unknown[];
  depends_on_dv: unknown[];
  readiness: string;
  sort_order: number;
  active: boolean;
  updated_at: string;
};

export type SpcOfferRow = {
  sku_code: string;
  dv_code: string;
  tier: SpcTier;
  label_vi: string;
  scope_summary_vi: string;
  pricing_model: SpcPricingModel;
  duration_hint_vi: string;
  status: SpcOfferStatus;
  published_version: number;
  draft_pricing_model: SpcPricingModel | null;
  draft_scope_summary_vi: string | null;
  has_pending_draft: boolean;
  sort_order: number;
  active: boolean;
  updated_at: string;
};

export type SpcOfferLineRow = {
  line_code: string;
  sku_code: string;
  label_vi: string;
  description_vi: string;
  unit: string;
  included_by_default: boolean;
  sort_order: number;
  active: boolean;
};

export type SpcPortfolioItem = {
  dv_code: string;
  name_vi: string;
  department: string;
  readiness: string;
  service_type: string;
  offer_count: number;
  published_count: number;
  draft_count: number;
};

export type SpcFamilyDetail = SpcFamilyRow & {
  offers: SpcOfferRow[];
  phase_count: number;
  kpi_count: number;
};

export type SpcOfferDetail = SpcOfferRow & {
  lines: SpcOfferLineRow[];
};

export type SpcPublishLogRow = {
  id: number;
  entity_type: string;
  entity_key: string;
  action: string;
  from_version: number | null;
  to_version: number | null;
  actor_email: string;
  diff_json: Record<string, unknown>;
  created_at: string;
};

export type SpcPatchOfferBody = {
  label_vi?: string;
  scope_summary_vi?: string;
  pricing_model?: SpcPricingModel;
  duration_hint_vi?: string;
};

export type SpcPublishBody = {
  entity: 'offer' | 'family';
  key: string;
};
