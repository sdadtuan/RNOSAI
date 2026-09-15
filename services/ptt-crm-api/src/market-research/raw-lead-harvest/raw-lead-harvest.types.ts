export type RawLeadHarvestMode =
  | 'quality'
  | 'volume'
  | 'marketing'
  | 'intent'
  | 'market_graph';

export type FeedbackCode =
  | 'bad_phone'
  | 'bad_email'
  | 'fake_company'
  | 'wrong_geo'
  | 'other';

export type DialOutcome =
  | 'connected'
  | 'wrong_number'
  | 'no_answer'
  | 'gatekeeper'
  | 'email_bounced'
  | 'out_of_business';

export type CreateRawLeadHarvestBody = {
  industry_key: string;
  job_title_key?: string | null;
  province_code?: string | null;
  ward_code?: string | null;
  source_keys: string[];
  channel_keys?: string[];
  /** Required for LLM modes; optional for Places-backed `intent` / `market_graph`. */
  provider?: string;
  model?: string;
  mode?: RawLeadHarvestMode;
  cross_check?: boolean;
  target_count: number;
  notes?: string;
  scan_cap?: number;
};

export type RawLeadHarvestJobRow = {
  id: number;
  project_id: number;
  industry_key: string;
  industry_label: string;
  job_title_key: string;
  job_title_label: string;
  province_code: string;
  province_name: string;
  ward_code: string | null;
  ward_name: string | null;
  sources_json: Array<{ key: string; label: string }>;
  channels_json: Array<{ key: string; label: string }>;
  provider: string;
  model: string;
  mode: RawLeadHarvestMode;
  cross_check: boolean;
  target_count: number;
  scan_cap: number | null;
  notes: string | null;
  status: string;
  error_message: string | null;
  result_count: number;
  rejected_by_gate_count: number;
  stats_json: Record<string, unknown> | null;
  created_by_staff_id: number | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
};

export type RawLeadRow = {
  id: number;
  project_id: number;
  job_id: number;
  company_name: string;
  address: string | null;
  phone: string | null;
  phone_norm: string | null;
  email: string | null;
  contact_title: string | null;
  website: string | null;
  evidence_url: string | null;
  evidence_snippet: string | null;
  source_provider: string | null;
  source_model: string | null;
  search_source_keys: string[];
  search_channel_keys: string[];
  place_id: string | null;
  intent_score: number | null;
  market_entity_id: string | null;
  quality_score: number;
  icp_fit_score: number;
  contactable: boolean;
  status: string;
  feedback_code: string | null;
  feedback_note: string | null;
  dial_outcome: string | null;
  dial_outcome_at: string | null;
  legal_status: string | null;
  classification: string | null;
  crm_lead_id: number | null;
  verify_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type PatchRawLeadBody = {
  status?: 'pending' | 'accepted' | 'rejected';
  company_name?: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  contact_title?: string | null;
  accepted_checklist_json?: Record<string, unknown>;
  feedback_code?: FeedbackCode;
  feedback_note?: string;
  dial_outcome?: DialOutcome;
};

export type ExportRawLeadsBody = {
  lead_ids?: number[];
  include_auto_rejected?: boolean;
  /** default: accepted + contactable only */
  status?: string;
};

export type PushRawLeadsBody = {
  lead_ids: number[];
};
