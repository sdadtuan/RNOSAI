export type AiTraceSource = {
  id: number;
  pattern: string;
};

export type AiTraceRow = {
  at: string;
  intent: string;
  sources: AiTraceSource[];
  job_id: number;
  status: string;
  run_id?: string;
};

export type AiTraceJobInput = {
  id: number;
  job_type: string;
  status: string;
  created_at: string;
  finished_at: string | null;
  ai_run_id?: string | null;
  input_json?: Record<string, unknown> | null;
};

export type AiTraceRunInput = {
  id?: string | null;
  input_json?: Record<string, unknown> | null;
  created_at?: string | null;
  ended_at?: string | null;
};

export type AiTraceJobRecord = AiTraceJobInput & {
  run?: AiTraceRunInput;
};

const INTENT_LABELS: Record<string, string> = {
  draft_generate: 'Draft generate',
  variant_generate: 'Variant generate',
  regenerate: 'Regenerate',
  repurpose: 'Repurpose',
};

export function mapAiTraceIntent(jobType: string): string {
  const key = String(jobType ?? '').trim();
  return INTENT_LABELS[key] ?? key;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function toIso(value: string | null | undefined): string | null {
  if (value == null || value === '') return null;
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return String(value);
  return new Date(ms).toISOString();
}

export function extractAiTraceSources(json: Record<string, unknown> | null | undefined): AiTraceSource[] {
  const root = asRecord(json);
  if (!root) return [];
  const nested = asRecord(root.brand_context);
  const raw = Array.isArray(root.copilotSources)
    ? root.copilotSources
    : Array.isArray(nested?.copilotSources)
      ? nested.copilotSources
      : [];
  const out: AiTraceSource[] = [];
  for (const item of raw) {
    const row = asRecord(item);
    if (!row) continue;
    const id = Number(row.id);
    if (!Number.isFinite(id)) continue;
    out.push({ id, pattern: typeof row.pattern === 'string' ? row.pattern : '' });
  }
  return out;
}

export function toAiTraceRow(job: AiTraceJobInput, run?: AiTraceRunInput | null): AiTraceRow {
  const sources = extractAiTraceSources(job.input_json);
  const fromRun = sources.length ? [] : extractAiTraceSources(run?.input_json);
  const at =
    toIso(job.finished_at) ??
    toIso(run?.ended_at) ??
    toIso(run?.created_at) ??
    toIso(job.created_at) ??
    '';
  const row: AiTraceRow = {
    at,
    intent: mapAiTraceIntent(job.job_type),
    sources: sources.length ? sources : fromRun,
    job_id: Number(job.id),
    status: String(job.status ?? ''),
  };
  const runId = job.ai_run_id || run?.id || '';
  if (runId) row.run_id = String(runId);
  return row;
}
