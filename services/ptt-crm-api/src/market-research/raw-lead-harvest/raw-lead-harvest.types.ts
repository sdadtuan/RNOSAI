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
  fanpage_url: string | null;
  zalo_url: string | null;
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
  readiness_status: string | null;
  readiness_reason_codes: string[];
  account_cluster_key: string | null;
  priority_tier: string | null;
  global_account_key: string | null;
  research_account_id: number | null;
  /** From harvest job (list enrichment). */
  industry_key?: string | null;
  industry_label?: string | null;
  learning_delta: number;
  learning_reasons: string[];
  learning_applied_at: string | null;
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
  website?: string | null;
  fanpage_url?: string | null;
  zalo_url?: string | null;
  contact_title?: string | null;
  accepted_checklist_json?: Record<string, unknown>;
  feedback_code?: FeedbackCode;
  feedback_note?: string;
  dial_outcome?: DialOutcome;
  readiness_status?:
    | 'READY_TO_PUSH'
    | 'NEEDS_REVIEW'
    | 'MISSING_CONTACT'
    | 'DUPLICATE_OR_BLACKLIST';
  readiness_reason_codes?: string[];
  /** Allow READY even when current reasons include BLACKLIST/DNC (staff override). */
  force_ready?: boolean;
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

export type ReclassifyRawLeadsBody = {
  /** Default true: only rows with readiness_status IS NULL. */
  only_unclassified?: boolean;
  /** Reclassify even if already set (ignored when only_unclassified true). */
  force?: boolean;
  job_id?: number;
  lead_ids?: number[];
};

export type EnrichRawLeadsContactsBody = {
  lead_ids?: number[];
  /** Default true when lead_ids omitted. */
  only_missing_contact?: boolean;
  job_id?: number;
  /** Cap Places/scrape work (default 50, max 50). */
  limit?: number;
};

export type BulkAcceptRawLeadsBody = {
  lead_ids: number[];
  accepted_checklist_json?: Record<string, unknown>;
};

export type RecomputePriorityBody = {
  lead_ids?: number[];
  job_id?: number;
  limit?: number;
};

export type ApplyLearningBody = {
  lead_ids?: number[];
  job_id?: number;
  limit?: number;
};

export type MergeAccountsBody = {
  lead_ids?: number[];
  job_id?: number;
  limit?: number;
};

export type ResearchAccountRow = {
  id: number;
  global_account_key: string;
  display_name: string;
  phone_norm: string | null;
  domain: string | null;
  place_id: string | null;
  lead_count: number;
  project_count: number;
  best_priority_tier: string | null;
  crm_lead_id: number | null;
  created_at: string;
  updated_at: string;
};
