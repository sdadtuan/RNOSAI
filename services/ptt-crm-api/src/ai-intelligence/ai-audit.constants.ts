/** Canonical use_case values — mọi AI call phải dùng một trong các giá trị này. */
export const AI_USE_CASE = {
  HEALTH_CHECK: 'health_check',
  SUMMARIZE: 'summarize',
  LEAD_BRIEF: 'lead_brief',
  SCORE_LEAD: 'score_lead',
  SCORE_DEAL: 'score_deal',
  NEXT_BEST_ACTION: 'next_best_action',
  PLAYBOOK_RAG: 'playbook_rag',
  FOLLOW_UP_DRAFT: 'follow_up_draft',
  OVERRIDE_SCORE: 'override_score',
  PIPELINE_RISK_SCAN: 'pipeline_risk_scan',
  FORECAST_SNAPSHOT: 'forecast_snapshot',
  FORECAST_COMMIT: 'forecast_commit',
} as const;

export type AiUseCase = (typeof AI_USE_CASE)[keyof typeof AI_USE_CASE];

/** Error codes persisted in output_json.error_code (RNOS-05). */
export const AI_AUDIT_ERROR = {
  SCHEMA_NOT_READY: 'SCHEMA_NOT_READY',
  LLM_TIMEOUT: 'LLM_TIMEOUT',
  LLM_PROVIDER_ERROR: 'LLM_PROVIDER_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  SCORE_RULES_ERROR: 'SCORE_RULES_ERROR',
  AUDIT_PERSIST_FAILED: 'AUDIT_PERSIST_FAILED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type AiAuditErrorCode = (typeof AI_AUDIT_ERROR)[keyof typeof AI_AUDIT_ERROR];

export const AI_AUDIT_DEFAULT_AGENT = 'ai-intelligence';
