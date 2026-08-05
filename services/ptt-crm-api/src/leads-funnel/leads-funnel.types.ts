export const CONTACT_OK_CARE_STATUS = 'da_lien_he_thanh_cong';

export const PRESALES_STAGES = ['lead', 'consult', 'proposal'] as const;
export type PresalesStage = (typeof PRESALES_STAGES)[number];

export interface CareStageUi {
  key: string;
  label: string;
  hint: string;
  index: number;
  done: boolean;
  current: boolean;
  completed_at: string;
}

export interface CarePipelineState {
  current_stage_key: string;
  current_stage_label: string;
  current_stage_hint: string;
  current_stage_index: number;
  stages_done: Record<string, string>;
  stages: CareStageUi[];
  all_complete: boolean;
  /** True when a B2 care report with status da_lien_he_thanh_cong exists (step 1). */
  contact_ok_reported: boolean;
  /** B2 reports with care_status != da_lien_he_thanh_cong. */
  b2_negative_report_count?: number;
  last_b2_care_status?: string;
  last_b2_care_status_label?: string;
}

export interface PresalesCareGateState {
  complete: boolean;
  stages: Array<{ key: string; label: string; index: number; done: boolean; completed_at: string }>;
  missing_keys: string[];
  missing_labels: string[];
  message: string;
  current_stage_key: string;
}

export interface ReviewQueuePublicState {
  active: boolean;
  reason?: string;
  queued_at?: string;
  assigned_at?: string;
  deadline_hours?: number;
  previous_owner_id?: number | null;
  hours_waiting?: number | null;
  message?: string;
}

export interface LeadFunnelRow {
  id: number;
  full_name: string;
  phone: string;
  email: string;
  status: string;
  source?: string;
  channel?: string;
  client_id?: string | null;
  owner_id: number | null;
  meta_json: string;
  care_stage_current: string;
  care_stages_done_json: string;
  is_duplicate: number;
  first_assigned_at?: string;
  updated_at?: string;
}

import type { LeadFlowKind } from './lead-flow-kind.util';

export interface LeadFunnelSnapshot {
  lead_id: number;
  lead_flow_kind: LeadFlowKind;
  care_pipeline: CarePipelineState;
  presales_care_gate: PresalesCareGateState;
  review_queue: ReviewQueuePublicState;
  presales_on_lead_enabled: boolean;
  presales: PresalesSnapshot | null;
}

export interface PresalesTaskRow {
  id: number;
  presales_id: number;
  stage: string;
  step_index: number;
  title: string;
  description: string;
  form_fields: unknown[];
  form_data: Record<string, unknown>;
  ai_prompt_key: string;
  ai_output: string;
  is_done: boolean;
  done_at: string;
  notes: string;
}

export interface PresalesRow {
  id: number;
  lead_id: number;
  service_slug: string;
  stage: PresalesStage;
  status: string;
  assigned_am: number | null;
  lifecycle_id: number | null;
  stage_entered_at: string;
  notes: string;
  draft_marketing_plan_id: number | null;
}

export interface PresalesSnapshot {
  presales: PresalesRow;
  tasks: Record<string, PresalesTaskRow[]>;
  progress: Record<string, { total: number; done: number }>;
  advance: {
    current_stage: string;
    next_stage: string | null;
    can_advance_forward: boolean;
    block_reason: string;
    current_complete: boolean;
    current_done: number;
    current_total: number;
    status: string;
  };
}

export interface CompleteCareStageBody {
  stage: string;
  note: string;
  care_status?: string;
  care_contact_type?: string;
  content?: string;
}

export interface ReleaseReviewQueueBody {
  mode: 'auto' | 'manual';
  owner_id?: number;
  note?: string;
}

export interface EnsurePresalesBody {
  service_slug: string;
}

export interface AdvancePresalesBody {
  to_stage?: PresalesStage;
  confirm?: boolean;
  override_reason?: string;
}

export interface PatchPresalesTaskBody {
  is_done?: boolean;
  notes?: string;
  form_data?: Record<string, unknown>;
}

export interface PatchMarketingPlanBody {
  name?: string;
  north_star?: string;
  objectives?: string;
  strategy_framework?: Record<string, string>;
}

export interface ConsultPrefillBody {
  overwrite?: boolean;
}

export interface PresalesAiAssistBody {
  form_context?: Record<string, unknown>;
}
