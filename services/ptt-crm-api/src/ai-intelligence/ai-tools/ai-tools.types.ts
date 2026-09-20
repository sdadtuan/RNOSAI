export const AI_TOOLS_MIGRATION_VERSION = '2026-07-27-rnos33-ai-tools';

export interface AiToolApiKeyRecord {
  id: string;
  name: string;
  key_prefix: string;
  client_id: string | null;
  allowed_tools: string[];
  rate_limit_per_min: number;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  revoked_at: string | null;
}

export interface AiToolApiKeyCreateResult {
  id: string;
  plaintextKey: string;
  keyPrefix: string;
}

export interface AiToolCallLogInsert {
  apiKeyId?: string | null;
  toolName: string;
  inputJson?: Record<string, unknown>;
  outputJson?: Record<string, unknown>;
  status: string;
  latencyMs?: number | null;
  agentRunId?: string | null;
}

export interface AiToolCallLogRecord {
  id: string;
  api_key_id: string | null;
  tool_name: string;
  input_json: Record<string, unknown>;
  output_json: Record<string, unknown>;
  status: string;
  latency_ms: number | null;
  agent_run_id: string | null;
  created_at: string;
}

/** MCP-compatible tool descriptor (registry metadata). */
export interface AiToolDescriptor {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  mutating: boolean;
  requiredCaps: string[];
}

export interface AiToolApiKeyScope {
  id: string;
  client_id: string | null;
  allowed_tools: string[];
}

export interface AiToolCallContext {
  apiKey: AiToolApiKeyScope;
  actorId?: string | null;
  correlationId?: string | null;
  /** Set when caller sends X-AI-Human-Approved: 1 (PO-52 write gate). */
  humanApproved?: boolean;
}

export interface AiToolExecutionContext {
  apiKeyId: string;
  clientId: string | null;
  actorId: string | null;
  correlationId: string;
  humanApproved?: boolean;
}

/** SRS PO-52 allowlist (Ops Module) + P4/P5 + role KPI drafts. */
export const OPS_AI_TOOL_ALLOWLIST = [
  'marketing_plan.read',
  'marketing_plan.write_draft',
  'service_delivery.read',
  'service_delivery.propose_transition',
  'delivery_project.read',
  'kpi_campaign.read',
  'task.create_draft',
  'task.update_draft',
  'plan.breakdown_to_roles',
  'kpi_target.write_draft',
  'kpi_target.read',
  'presales.context.read',
] as const;

/** Default allowlist for strategist / PM agent policies (P6). */
export const P6_STRATEGIST_PM_TOOL_ALLOWLIST = [
  ...OPS_AI_TOOL_ALLOWLIST,
] as const;

export const P6_AGENT_POLICY_PRESETS = [
  {
    agent_code: 'ptt-ops-strategist',
    allowed_tools: [...P6_STRATEGIST_PM_TOOL_ALLOWLIST],
    require_human_approval: true,
    pii_block_fields: ['phone', 'email', 'national_id', 'address'],
    spend_cap_usd_monthly: 50,
  },
  {
    agent_code: 'ptt-ops-pm',
    allowed_tools: [...P6_STRATEGIST_PM_TOOL_ALLOWLIST],
    require_human_approval: true,
    pii_block_fields: ['phone', 'email', 'national_id', 'address'],
    spend_cap_usd_monthly: 50,
  },
] as const;

/** SRS PO-53 — never register; reject on call / key create. */
export const OPS_AI_TOOL_DENYLIST = [
  'email.send',
  'proposal.send',
  'stage.transition',
] as const;

export interface AiToolDefinition extends AiToolDescriptor {
  handler: (
    input: Record<string, unknown>,
    context: AiToolExecutionContext,
  ) => Promise<unknown>;
}
