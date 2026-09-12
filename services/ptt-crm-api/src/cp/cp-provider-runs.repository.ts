import { HttpException } from '@nestjs/common';
import type { CpAiOpsProvider } from './cp-ai-ops.types';

const CP_AI_OPS_PROVIDERS = new Set<string>([
  'stub',
  'weavy',
  'magnific_mcp',
  'magnific_rest',
  'comfyui',
]);

export type InsertProviderRunInput = {
  jobId?: string | null;
  workOrderId?: string | null;
  provider: CpAiOpsProvider;
  mode: 'manual' | 'auto';
  externalRunId?: string | null;
  toolOrWorkflow?: string | null;
  estimateCredits?: number | null;
  status?: string;
};

export type CpProviderRunsQueryPort = {
  query(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: Record<string, unknown>[]; rowCount?: number | null }>;
};

export async function insertProviderRun(
  input: InsertProviderRunInput,
  query: CpProviderRunsQueryPort,
): Promise<{ id: string }> {
  if (!CP_AI_OPS_PROVIDERS.has(input.provider)) {
    const body = { error: 'invalid_provider' };
    throw Object.assign(new HttpException(body, 400), body);
  }

  const result = await query.query(
    `INSERT INTO crm_cp_provider_runs (
       job_id, work_order_id, provider, mode, external_run_id,
       tool_or_workflow, estimate_credits, status
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id`,
    [
      input.jobId ?? null,
      input.workOrderId ?? null,
      input.provider,
      input.mode,
      input.externalRunId ?? null,
      input.toolOrWorkflow ?? null,
      input.estimateCredits ?? null,
      input.status ?? 'started',
    ],
  );

  return { id: String(result.rows[0]?.id ?? '') };
}
