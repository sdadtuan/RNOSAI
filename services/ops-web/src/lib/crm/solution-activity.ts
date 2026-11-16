import type { SolutionAttachment } from '@/lib/crm/solution-file-display';
import type { SolutionAiDraftView } from '@/lib/crm/solution-ai-draft-display';

/** Client-side view of the AI Solution job (POST in flight → plan pending → ready/error). */
export type SolutionAiJobPhase = 'idle' | 'running' | 'failed';

/** Live state of the Solution actions panel, mirrored into the step-3 top card. */
export type SolutionDeskActivity = {
  files: SolutionAttachment[];
  aiDraft: SolutionAiDraftView | null;
  ai: { phase: SolutionAiJobPhase; startedAt: number | null; error: string };
  upload: { phase: 'idle' | 'reading' | 'uploading'; percent: number | null; name: string; size: number };
};

/** Typical AI Solution duration: direct LLM call vs. external agent webhook job. */
export const SOLUTION_AI_TYPICAL_MS = { llm: 60_000, agent: 180_000 } as const;

/**
 * Estimated progress when the job has no real percentage: smooth ease-out on elapsed time
 * (~74% at the typical duration, ~90% at 2x), never above 95% until the job is done.
 */
export function estimateSolutionAiPercent(elapsedMs: number, typicalMs: number): number {
  const typical = typicalMs > 0 ? typicalMs : SOLUTION_AI_TYPICAL_MS.llm;
  const t = Math.max(0, elapsedMs) / typical;
  const pct = 95 * (1 - Math.exp(-1.5 * t));
  return Math.max(3, Math.min(95, Math.round(pct)));
}

export type SolutionAiCardState =
  | { kind: 'none' }
  | { kind: 'running'; startedAt: number; typicalMs: number; queuedAtAgent: boolean }
  | { kind: 'failed'; error: string }
  | { kind: 'done'; draft: SolutionAiDraftView };

/** Resolve what the top card shows for the AI Solution document. */
export function resolveSolutionAiCardState(activity: SolutionDeskActivity | null, nowMs: number): SolutionAiCardState {
  if (!activity) return { kind: 'none' };
  const { ai, aiDraft } = activity;
  if (ai.phase === 'running') {
    return {
      kind: 'running',
      startedAt: ai.startedAt ?? nowMs,
      typicalMs: SOLUTION_AI_TYPICAL_MS.llm,
      queuedAtAgent: false,
    };
  }
  if (ai.phase === 'failed') return { kind: 'failed', error: ai.error || 'AI chưa tạo được Solution.' };
  if (!aiDraft) return { kind: 'none' };
  if (aiDraft.status === 'pending') {
    const requested = aiDraft.requestedAt ? Date.parse(aiDraft.requestedAt) : NaN;
    return {
      kind: 'running',
      startedAt: Number.isFinite(requested) ? requested : nowMs,
      typicalMs: aiDraft.source === 'agent' ? SOLUTION_AI_TYPICAL_MS.agent : SOLUTION_AI_TYPICAL_MS.llm,
      queuedAtAgent: aiDraft.source === 'agent',
    };
  }
  if (aiDraft.status === 'error') return { kind: 'failed', error: 'AI chưa tạo được Solution. Bấm Thử lại.' };
  if (aiDraft.source === 'legacy') return { kind: 'none' };
  if (!aiDraft.sections.some((row) => row.body.trim())) return { kind: 'none' };
  return { kind: 'done', draft: aiDraft };
}