/** P7 — shared types for autofill / insight draft / plan review tools. */

export type TmmtOverwriteMode =
  | 'fill_empty_only'
  | 'merge_prefer_presales'
  | 'replace_all_ai';

export type AutofillFieldWritten = {
  key: string;
  source: string;
  confidence: number;
};

export type AutofillFieldSkipped = {
  key: string;
  reason: string;
};

export type PresalesAutofillResult = {
  ok: true;
  wired: true;
  phase: 'P7';
  lifecycle_id: number;
  dry_run: boolean;
  fields_written: AutofillFieldWritten[];
  fields_skipped: AutofillFieldSkipped[];
  tmmt_progress: { before: string; after: string };
  gate_passed: boolean;
  missing_required: string[];
  ai_planner_readiness_hint: number;
  links: string[];
  known: string[];
  assumed: string[];
  unknown: string[];
};

export type InsightDraftResult = {
  ok: true;
  phase: 'P7';
  insight_id: number;
  project_id: number;
  status: 'pending_review';
  summary: string;
  bullets: string[];
  evidence_links: string[];
  cannot_approve_via_tool: true;
  links: string[];
};

export type PlanGenerateReviewResult = {
  ok: true;
  plan_id: number;
  status: 'review';
  phase: 'P7';
  gate_snapshot: { passed: boolean; blockers: Array<{ code: string; detail: string }> };
  links: string[];
};
