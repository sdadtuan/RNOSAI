/** P8 — shared result types. */

import type { FieldQualityMeta, FieldQualityStatus } from './ops-field-quality.util';
import type { ConsultReadyBlocker, ServiceStatus } from './ops-consult-ready.util';

export type ServiceRecommendItem = {
  sku: string;
  label: string;
  reason: string;
  when_to_pick?: string;
};

export type ServiceRecommendResult = {
  ok: true;
  phase: 'P8';
  service_status: ServiceStatus;
  primary: ServiceRecommendItem | null;
  alternate: ServiceRecommendItem | null;
  menu: ServiceRecommendItem[];
  confidence: number;
  citations: string[];
  links: string[];
  return_to_am?: boolean;
  blockers?: string[];
};

export type ConsultDraftFieldWritten = {
  key: string;
  status: FieldQualityStatus;
  confidence: number;
  source: string;
};

export type ConsultDraftResult = {
  ok: true;
  phase: 'P8';
  fields_written: ConsultDraftFieldWritten[];
  fields_skipped: Array<{ key: string; reason: string }>;
  consult_ready_preview: boolean;
  blockers: ConsultReadyBlocker[];
  links: string[];
  task_id?: number;
  dry_run?: boolean;
};

export type ReturnToAmResult = {
  ok: true;
  phase: 'P8';
  needs_am_rework: boolean;
  reason_codes: string[];
  message: string;
  assignee_user_id: number | null;
  links: string[];
  dry_run?: boolean;
};

export type ProposalDraftResult = {
  ok: true;
  phase: 'P8';
  proposal_id: number;
  status: 'draft';
  watermark: boolean;
  never_sent: true;
  links: string[];
};

export type ConfirmAssumedResult = {
  ok: true;
  phase: 'P8';
  field: string;
  status: FieldQualityStatus;
  meta: FieldQualityMeta;
};

export type P8QualityBundle = {
  need_pain: FieldQualityMeta;
  icp: FieldQualityMeta;
  service_status: ServiceStatus;
  service_recommendation?: unknown;
  needs_am_rework: boolean;
  return_to_am_blockers: string[];
};
