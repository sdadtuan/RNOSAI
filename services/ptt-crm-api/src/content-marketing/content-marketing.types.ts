import type { CMKT_CHANNELS, CMKT_ITEM_STATUSES, CMKT_P0_CHANNEL_DEFAULTS } from './content-marketing.constants';

export type CmktItemStatus = (typeof CMKT_ITEM_STATUSES)[number];
export type CmktChannel = (typeof CMKT_CHANNELS)[number];
export type CmktChannelDefault = (typeof CMKT_P0_CHANNEL_DEFAULTS)[number];

export type CmktSnapshotSummary = {
  id: number;
  sealed: boolean;
  pillars_count: number;
  ingested_at: string;
  marketing_plan_id: number | null;
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
};
