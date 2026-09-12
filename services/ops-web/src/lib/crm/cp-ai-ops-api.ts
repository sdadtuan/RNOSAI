import { cpFetch, formatCpApiError } from './cp-api';
import { dash } from './cp-format';
import type { MagnificProvider } from './cp-ai-ops-panes.util';

export type CpJobDraftInput = {
  project_id: string;
  provider: MagnificProvider;
  inputs: Record<string, unknown>;
  idempotency_key: string;
  template_id?: string;
  task_id?: string;
};

export type CpJobDraftResult = {
  job_id: string;
  status: string;
  estimate: { credits: number | null; duration_sec: number | null };
  requires_confirmation: boolean;
};

export type CpMagnificJob = {
  id?: string;
  job_id?: string;
  status?: string;
  state?: string;
  asset_id?: string | null;
  ingested?: number | null;
  stage_log_json?: Record<string, unknown> | string | null;
};

function jobPath(jobId: string, suffix = '') {
  return `/jobs/${encodeURIComponent(jobId)}${suffix}`;
}

export function draftMagnificJob(token: string, input: CpJobDraftInput) {
  return cpFetch<CpJobDraftResult>(token, '/jobs/draft', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function confirmMagnificJob(token: string, jobId: string, confirm: boolean) {
  return cpFetch<CpMagnificJob>(token, jobPath(jobId, '/confirm'), {
    method: 'POST',
    body: JSON.stringify({ confirm }),
  });
}

export function submitMagnificJob(token: string, jobId: string) {
  return cpFetch<CpMagnificJob>(token, jobPath(jobId, '/submit'), {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export function getMagnificJob(token: string, jobId: string) {
  return cpFetch<CpMagnificJob>(token, jobPath(jobId));
}

export type ComfyProviderHealth =
  | { comfy: { ok: true; vram_mb: number | null; checked_at: string } }
  | { comfy: { ok: false; reason: 'gpu_building'; checked_at?: string } };

export function getProviderHealth(token: string) {
  return cpFetch<ComfyProviderHealth>(token, '/provider-health');
}

function stageLogOf(job: CpMagnificJob): Record<string, unknown> {
  const raw = job.stage_log_json;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
  }
  return {};
}

export function extractJobAssetId(job: CpMagnificJob): string | null {
  const direct = String(job.asset_id ?? '').trim();
  if (direct) return direct;
  const nested = String(stageLogOf(job).asset_id ?? '').trim();
  return nested || null;
}

export function formatMagnificEstimate(estimate: {
  credits: number | null;
  duration_sec: number | null;
}): string {
  return `${dash(estimate.credits)} credit · ${dash(estimate.duration_sec)} giây`;
}

export function magnificCompletionNotice(job: CpMagnificJob): string {
  const assetId = extractJobAssetId(job);
  if (job.ingested === 0 || !assetId) return 'Chưa ingest';
  return `Asset ${assetId}`;
}

export function formatMagnificConfirmError(error: unknown): string {
  const message = formatCpApiError(error, 'Cần xác nhận của người');
  if (message.includes('human_confirm_required')) {
    return `Cần xác nhận của người (human_confirm_required)`;
  }
  return message;
}
