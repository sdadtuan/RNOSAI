import type { IntakeSessionRow } from '@/lib/api';

/** Normalize the various list envelopes the intake sessions API has returned. */
export function normalizeIntakeSessionList(out: unknown): IntakeSessionRow[] {
  if (Array.isArray(out)) return out as IntakeSessionRow[];
  if (out && typeof out === 'object') {
    const rec = out as Record<string, unknown>;
    for (const key of ['sessions', 'items', 'data', 'rows', 'results']) {
      const val = rec[key];
      if (Array.isArray(val)) return val as IntakeSessionRow[];
    }
  }
  return [];
}

function byIdDesc(a: IntakeSessionRow, b: IntakeSessionRow): number {
  return (b.id ?? 0) - (a.id ?? 0);
}

/**
 * Pick the session the Sales Discovery embed should open.
 * A completed session always wins (read-only "Đã nộp" view). Drafts are only
 * used when nothing has been submitted yet. Never invent a second draft.
 */
export function pickWorkingSession(
  sessions: IntakeSessionRow[],
  preferredId?: number,
): IntakeSessionRow | null {
  const list = Array.isArray(sessions) ? sessions : [];
  if (preferredId) {
    const preferred = list.find((row) => row.id === preferredId);
    if (preferred) return preferred;
  }
  const done = list.filter((row) => row.status === 'completed').sort(byIdDesc);
  if (done[0]) return done[0];
  const drafts = list.filter((row) => row.status === 'draft').sort(byIdDesc);
  return drafts[0] ?? null;
}

/** Create a draft only when the lead has neither a completed session nor an existing draft. */
export function shouldCreateIntakeDraft(sessions: IntakeSessionRow[]): boolean {
  const list = Array.isArray(sessions) ? sessions : [];
  return !list.some((row) => row.status === 'completed' || row.status === 'draft');
}