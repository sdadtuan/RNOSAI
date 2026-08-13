export type LeadMeetingPrepStatus =
  | 'pending'
  | 'running'
  | 'awaiting_entity_choice'
  | 'ready'
  | 'failed'
  | 'skipped'
  | 'cancelled';

export type LeadMeetingPrepStage = 'm1_first_strike' | 'm2_qualify_win' | 'm3_pre_close';

export interface LeadPrepContextRow {
  lead_id: number;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  status: string | null;
  source: string | null;
  channel: string | null;
  client_id: string | null;
  is_duplicate: boolean | null;
  meta_json: Record<string, unknown>;
}

export interface LeadMeetingPrepInput {
  lead_id: number;
  full_name: string;
  phone: string;
  email: string;
  company_name: string;
  industry: string;
  marketing_budget: string;
  problem: string;
  website_url?: string;
  social_urls?: string;
  client_id?: string | null;
  channel?: string | null;
  source?: string | null;
}

export interface LeadMeetingPrepRow {
  id: number;
  lead_id: number;
  status: LeadMeetingPrepStatus;
  skip_reason: string | null;
  input_snapshot_json: Record<string, unknown>;
  collect_json: Record<string, unknown>;
  entity_candidates_json: unknown[];
  selected_entity_id: string | null;
  result_json: Record<string, unknown>;
  error_message: string | null;
  prep_version: number;
  synth_version: number;
  tavily_credits_used: number;
  apify_runs: number;
  prep_stage: LeadMeetingPrepStage;
  close_readiness_score: number | null;
  win_outcome_json: Record<string, unknown>;
  ai_agent_run_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface EnqueueLeadMeetingPrepInput {
  leadId: number;
  clientId?: string | null;
  correlationId?: string | null;
  prepStage?: LeadMeetingPrepStage;
  mode?: 'full' | 'resume_entity' | 'strategize_arm';
  selectedEntityId?: string | null;
  force?: boolean;
}

export interface RunLeadMeetingPrepBody {
  force?: boolean;
  website_url?: string;
  social_urls?: string;
}

export interface SelectEntityBody {
  entity_id: string;
}
