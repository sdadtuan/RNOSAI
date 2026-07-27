import { AiAgentRunInsert, AiAgentRunRecord, AiAgentRunRow, AiAgentRunStatus } from '../ai-intelligence.types';

export const ORCHESTRATOR_MIGRATION_VERSION = '2026-07-27-rnos31-orchestrator';

export type AiOrchestrationStatus = 'running' | 'succeeded' | 'failed' | 'cancelled';

export type AiOrchestrationTriggerType = 'manual' | 'cron' | 'webhook' | 'workflow';

export interface AiOrchestrationInsert {
  clientId?: string | null;
  triggerType: AiOrchestrationTriggerType;
  triggerRef?: string | null;
  planKey: string;
  status?: AiOrchestrationStatus;
  inputJson?: Record<string, unknown>;
  outputJson?: Record<string, unknown>;
  correlationId?: string | null;
  actorId?: string | null;
}

export interface AiOrchestrationRow {
  id: string;
}

export interface AiOrchestrationRecord {
  id: string;
  client_id: string | null;
  trigger_type: AiOrchestrationTriggerType;
  trigger_ref: string | null;
  plan_key: string;
  status: AiOrchestrationStatus;
  input_json: Record<string, unknown>;
  output_json: Record<string, unknown>;
  correlation_id: string | null;
  actor_id: string | null;
  started_at: string;
  ended_at: string | null;
  created_at: string;
}

export interface AiOrchestrationChildRunInsert extends AiAgentRunInsert {
  parentRunId: string;
  orchestrationId: string;
  stepKey: string;
  stepIndex: number;
}

export interface AiOrchestrationTree {
  orchestration: AiOrchestrationRecord;
  parentRun: AiAgentRunRecord | null;
  children: AiAgentRunRecord[];
}

export type { AiAgentRunRecord, AiAgentRunRow, AiAgentRunStatus };
