export type ProposalStatus = 'draft' | 'sent' | 'accepted' | 'rejected';

export const PROPOSAL_STATUS_FLOW: Record<ProposalStatus, ProposalStatus[]> = {
  draft: ['sent', 'rejected'],
  sent: ['accepted', 'rejected', 'draft'],
  accepted: [],
  rejected: ['draft'],
};

export interface ProposalRow {
  id: number;
  customer_id: number;
  lead_id: number | null;
  presales_id: number | null;
  lifecycle_id: number | null;
  service_slugs: string[];
  total_vnd: number;
  timeline_months: number;
  notes: string;
  ai_output: Record<string, unknown>;
  generated?: boolean;
  status: ProposalStatus | string;
  valid_until: string | null;
  price_adjustment_reason: string;
  created_at: string;
  updated_at: string;
  quote_code?: string | null;
  current_version_id?: string | null;
  row_version?: number;
  title?: string | null;
  objective?: string | null;
  audience?: string | null;
  campaign_period?: string | null;
  agency_client_id?: string | null;
}

export interface QuoteLineItemRow {
  id: number;
  proposal_id: number;
  dv_code: string;
  sku_code: string | null;
  package_tier: string;
  service_slug: string;
  reference_price_min: number;
  reference_price_max: number;
  final_price_vnd: number;
  scope_notes: string;
  lifecycle_id: number | null;
  sort_order: number;
  item_type?: string;
  media_vnd?: number;
  client_visible?: boolean;
  catalog_snapshot_json?: Record<string, unknown>;
  qty?: number;
  cost_labor_vnd?: number;
  cost_outsource_vnd?: number;
  cost_other_vnd?: number;
}

export interface QuoteLineInput {
  dv_code?: string;
  sku_code?: string;
  package_tier?: string;
  final_price_vnd?: number;
  scope_notes?: string;
  item_type?: string;
  media_vnd?: number;
  client_visible?: boolean;
  catalog_snapshot_json?: Record<string, unknown>;
  qty?: number;
  unit_price_vnd?: number;
  discount_vnd?: number;
  cost_labor_vnd?: number | null;
  cost_outsource_vnd?: number | null;
  cost_other_vnd?: number | null;
}

export interface CreateProposalBody {
  customer_id?: number;
  lead_id?: number;
  presales_id?: number;
  service_slug?: string;
  package_tier?: string;
  auto_lines?: boolean;
  service_slugs?: string[];
  lines?: QuoteLineInput[];
  total_vnd?: number;
  timeline_months?: number;
  notes?: string;
  lifecycle_id?: number | null;
  valid_until?: string | null;
  title?: string;
  source?: 'lead' | 'am360' | 'blank';
  agency_client_id?: string;
  quote_type?: string;
  lead_party?: {
    company_name?: string;
    company_address?: string;
    phone?: string;
    email?: string;
    logo_asset_id?: string | null;
  };
}

export interface PatchProposalStatusBody {
  status: ProposalStatus;
  price_adjustment_reason?: string;
  spawn_week?: boolean;
  lost_reason?: string;
}

export interface PutQuoteLinesBody {
  lines: QuoteLineInput[];
  price_adjustment_reason?: string;
}
