export type RawLeadHarvestMode = 'quality' | 'volume';

export type CreateRawLeadHarvestBody = {
  industry_key: string;
  job_title_key: string;
  province_code: string;
  ward_code?: string | null;
  source_keys: string[];
  channel_keys?: string[];
  provider: string;
  model: string;
  mode?: RawLeadHarvestMode;
  cross_check?: boolean;
  target_count: number;
  notes?: string;
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
  notes: string | null;
  status: string;
  error_message: string | null;
  result_count: number;
  rejected_by_gate_count: number;
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
  email: string | null;
  contact_title: string | null;
  website: string | null;
  evidence_url: string | null;
  evidence_snippet: string | null;
  source_provider: string | null;
  source_model: string | null;
  quality_score: number;
  icp_fit_score: number;
  contactable: boolean;
  status: string;
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
};
