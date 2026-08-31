import type { WinChecklistState } from '@/lib/crm/intake-win-checklist';
import { WIN_INTEL_KEYS, type WinIntelState } from '@/lib/crm/intake-win-intel';
import type { WinScoreKey } from '@/lib/crm/intake-win-score';

export const WIN_REQUIRED_KEYS = ['incumbent', 'selection_criteria', 'switch_risk'] as const;

const FILLED_CONFIDENCE = new Set(['heard', 'confirmed']);

function isWinIntelKey(
  key: WinScoreKey,
): key is 'incumbent' | 'competitor' | 'selection_criteria' | 'switch_risk' {
  return (WIN_INTEL_KEYS as readonly string[]).includes(key);
}

function intelFilled(entry: { answer: string; confidence: string } | undefined): boolean {
  if (!entry) return false;
  return entry.answer.trim().length >= 8 && FILLED_CONFIDENCE.has(entry.confidence);
}

export function winKeyFilled(input: {
  key: WinScoreKey;
  winIntel: Pick<WinIntelState, 'incumbent' | 'competitor' | 'selection_criteria' | 'switch_risk'>;
  winChecklist: WinChecklistState;
}): boolean {
  const { key, winIntel, winChecklist } = input;
  if (isWinIntelKey(key)) {
    return intelFilled(winIntel[key]);
  }
  const score = Number(winChecklist[key] ?? 0);
  return score >= 1 && score <= 5;
}

export function missingRequiredWinKeys(input: {
  winIntel: Pick<WinIntelState, 'incumbent' | 'competitor' | 'selection_criteria' | 'switch_risk'>;
  winChecklist: WinChecklistState;
}): WinScoreKey[] {
  return WIN_REQUIRED_KEYS.filter(
    (key) => !winKeyFilled({ key, winIntel: input.winIntel, winChecklist: input.winChecklist }),
  );
}

export function winGapToConsult(total: number): number {
  return Math.max(0, 18 - total);
}

export function winConsultLabel(total: number): string {
  if (total >= 18) return 'Đủ đạn Tư vấn';
  return `Còn ${winGapToConsult(total)} để thắng`;
}
