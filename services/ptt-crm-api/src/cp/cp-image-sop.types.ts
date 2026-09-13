export type ImgIntent =
  | 'hero_lifestyle'
  | 'product_lock'
  | 'text_cta'
  | 'upscale_print'
  | 'bg_cutout'
  | 'format_pack'
  | 'human_art'
  | 'i2v_handoff';

export type ImgStage = 'explore' | 'select' | 'refine' | 'upscale' | 'pack' | 'qc';

export type ImgProvider =
  | 'magnific_rest'
  | 'magnific_mcp'
  | 'comfyui'
  | 'weavy'
  | 'local';

export type ImgRecipeStage = {
  stage: ImgStage;
  capability: string;
  provider: ImgProvider;
  required: boolean;
  estimate_credits?: number | null;
};

export type ImgSopRow = {
  id: string;
  code: string;
  name: string;
  category: string;
  status: string;
  risk_tier: string;
  data_class: string;
  version: string | null;
  version_id: string | null;
  intent: string | null;
};

export type ImgProjectRow = {
  id: string;
  tenant_id: string;
  cp_project_id: string | null;
  agency_client_id: number;
  service_lifecycle_id: string | null;
  sop_version_id: string | null;
  name: string;
  status: string;
  brief_json: Record<string, unknown>;
  brand_kit_id: string | null;
  g1_at: string | null;
  g2_at: string | null;
  g3_at: string | null;
  created_by_staff_id: number;
  created_at: string;
};

export type ImgProjectInsert = {
  agency_client_id: number;
  service_lifecycle_id?: string | null;
  sop_version_id?: string | null;
  name: string;
  brief_json?: Record<string, unknown>;
  created_by_staff_id: number;
  cp_project_id?: string | null;
};

export type ImgJobRow = {
  id: string;
  project_id: string;
  frame_id: string | null;
  cp_render_job_id: string | null;
  provider: string;
  route_decision_json: Record<string, unknown>;
  state: string;
  estimate_credits: number | null;
  output_asset_id: string | null;
  idempotency_key: string | null;
  winner_asset_id?: string | null;
  intent?: string | null;
  format_pack_json?: Record<string, unknown> | null;
};

export type ImgJobInsert = {
  project_id: string;
  frame_id?: string | null;
  provider: string;
  route_decision_json?: Record<string, unknown>;
  state?: string;
  estimate_credits?: number | null;
  idempotency_key: string;
};

export type ImgStageInsert = {
  job_id: string;
  stage: ImgStage;
  sort_order: number;
  capability: string;
  provider: string;
  state?: string;
  cp_render_job_id?: string | null;
  estimate_credits?: number | null;
};

export type ImgJobStageRow = {
  id: string;
  job_id: string;
  stage: string;
  sort_order: number;
  capability: string;
  provider: string;
  state: string;
  cp_render_job_id: string | null;
};

export type ImgQualityInsert = {
  asset_id: string;
  profile_key: string;
  scores_json: Record<string, unknown>;
  decision: string;
};

export type ImgGateInsert = {
  project_id: string;
  gate_num: 1 | 2 | 3;
  action: string;
  actor_staff_id: number;
  checklist_json?: Record<string, unknown>;
};

export type ImgQcDimension =
  | 'technical'
  | 'product_fidelity'
  | 'brand_fit'
  | 'creative_fit'
  | 'text_cta_vn'
  | 'compliance'
  | 'delivery';

export type ImgQcProfile =
  | 'brand_kv_v1'
  | 'product_fidelity_v2'
  | 'social_cta_vn_v1';
