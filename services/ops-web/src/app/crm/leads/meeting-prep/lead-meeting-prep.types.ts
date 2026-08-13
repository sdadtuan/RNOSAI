export type LeadMeetingPrepStatus =
  | 'pending'
  | 'running'
  | 'awaiting_entity_choice'
  | 'ready'
  | 'failed'
  | 'skipped'
  | 'cancelled'
  | 'none';

export type EntityCandidate = {
  id: string;
  url: string;
  label: string;
  phone?: string | null;
  region_hint?: string | null;
  confidence?: string;
};

export type PrepFact =
  | { label: string; value: string; type: 'sourced'; source: string }
  | { label: string; value: string; type: 'inferred' };

export type RecommendedService = {
  dv_code: string;
  name_vi: string;
  department: string;
  reason: string;
  priority: number;
};

export type LeadMeetingPrepResult = {
  company_profile: { summary: string; facts: PrepFact[] };
  contact_profile: { found: false; summary: string; facts: [] };
  website?: { url: string; confidence: string; note?: string | null };
  social_channels?: Array<Record<string, unknown>>;
  recommended_services: RecommendedService[];
  consulting_script: {
    opening: string;
    pain_points: string[];
    key_questions: string[];
    objection_handling: Array<{ objection: string; response: string }>;
  };
  meta: {
    researched_at?: string;
    sources_count?: number;
    model?: string;
    prompt_version?: string;
    prep_stage?: string;
    tavily_credits_used?: number;
    partial_collect?: boolean;
    close_readiness_score?: number;
  };
};

export type LeadMeetingPrepResponse = {
  ok: boolean;
  lead_id: number;
  status: LeadMeetingPrepStatus;
  status_label_vi: string;
  progress: {
    step: string;
    steps_completed: string[];
    message_vi: string;
  };
  prep_stage: string;
  close_readiness_score: number | null;
  entity_candidates: EntityCandidate[] | null;
  result: LeadMeetingPrepResult | null;
  error: string | null;
  prep_version: number;
  updated_at: string | null;
};
