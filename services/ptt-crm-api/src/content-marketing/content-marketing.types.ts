import type {
  CMKT_CHANNELS,
  CMKT_FORMATS,
  CMKT_ITEM_STATUSES,
  CMKT_P0_CHANNEL_DEFAULTS,
} from './content-marketing.constants';

export type CmktItemStatus = (typeof CMKT_ITEM_STATUSES)[number];
export type CmktChannel = (typeof CMKT_CHANNELS)[number];
export type CmktFormat = (typeof CMKT_FORMATS)[number];
export type CmktChannelDefault = (typeof CMKT_P0_CHANNEL_DEFAULTS)[number];

export type CmktBodyJson = {
  markdown?: string;
  html?: string;
  variants?: string[];
};

export type CmktIdeaRow = {
  id: number;
  lifecycle_id: number;
  pillar_id: number | null;
  title: string;
  hook: string;
  target_goal: string;
  channel_hints: string[];
  source: string;
  status: string;
  meta_json: Record<string, unknown>;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type CmktItemRow = {
  id: number;
  lifecycle_id: number;
  idea_id: number | null;
  parent_item_id: number | null;
  title: string;
  format: string;
  channel: string;
  funnel_goal: string;
  status: string;
  assignee_sp: number | null;
  assignee_qa: number | null;
  brief_json: Record<string, unknown>;
  body_json: CmktBodyJson;
  selected_variant_idx: number | null;
  quality_score_json: Record<string, unknown>;
  seo_bridge_id: number | null;
  email_bridge_id: number | null;
  published_url: string | null;
  published_at: string | null;
  due_at: string | null;
  in_review_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type CmktItemVersionRow = {
  id: number;
  item_id: number;
  version_no: number;
  body_json: CmktBodyJson;
  changed_by: string;
  change_reason: string;
  created_at: string;
};

export type CmktSnapshotSummary = {
  id: number;
  sealed: boolean;
  pillars_count: number;
  ingested_at: string;
  marketing_plan_id: number | null;
  source_hash?: string;
  planner_drift?: boolean;
};

export type CmktContextCounts = {
  ideas: number;
  items_by_status: Record<string, number>;
  draft: number;
  in_review: number;
  published_mtd: number;
  in_review_sla_breach: number;
};

export type CmktContextFlags = {
  ai_enabled: boolean;
  approval_required: boolean;
  media_enabled: boolean;
  client_gate: boolean;
  fe_enabled: boolean;
};

export type CmktContextPayload = {
  ok: boolean;
  lifecycle_id: number;
  service_slug: string;
  stage: string;
  enabled: boolean;
  snapshot: CmktSnapshotSummary | null;
  counts: CmktContextCounts;
  flags: CmktContextFlags;
  channel_defaults: CmktChannelDefault[];
};

export type CmktActiveSnapshotRow = {
  id: number;
  sealed: boolean;
  ingested_at: Date;
  marketing_plan_id: number | null;
  pillars_count: number;
  source_hash: string;
  ingested_by: string;
  snapshot_json: Record<string, unknown>;
  brand_context_json: Record<string, unknown>;
};

export type CmktPillarRow = {
  id: number;
  lifecycle_id: number;
  snapshot_id: number | null;
  name: string;
  goal: string;
  topics_json: string[];
  sort_order: number;
  active: boolean;
};

export type CmktIngestResult = {
  ok: boolean;
  snapshot_id: number;
  ideas_created: number;
  pillars_upserted: number;
  warnings: string[];
};

export type CmktPlanSnapshotPayload = {
  snapshot: {
    id: number;
    lifecycle_id: number;
    marketing_plan_id: number | null;
    sealed: boolean;
    source_hash: string;
    ingested_at: string;
    ingested_by: string;
    snapshot_json: Record<string, unknown>;
    brand_context_json: Record<string, unknown>;
  } | null;
  pillars: CmktPillarRow[];
  planner: {
    marketing_plan_id: number | null;
    has_applied_plan: boolean;
    current_source_hash: string | null;
    drift: boolean;
  };
};
