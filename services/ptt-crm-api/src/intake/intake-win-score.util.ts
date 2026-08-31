export const WIN_SCORE_KEYS = [
  'incumbent',
  'competitor',
  'selection_criteria',
  'switch_risk',
  'champion',
  'next_step',
] as const;

export type WinScoreKey = (typeof WIN_SCORE_KEYS)[number];

export const WIN_THRESHOLDS = { consult: 18, proposal_hint: 24 } as const;

export const WIN_REQUIRED_KEYS = ['incumbent', 'selection_criteria', 'switch_risk'] as const;

export type WinChecklistState = Partial<Record<WinScoreKey, number>>;

export type WinIntelKey = 'incumbent' | 'competitor' | 'selection_criteria' | 'switch_risk';

export type WinIntelEntry = { answer: string; confidence: string };

export type WinIntelState = Record<WinIntelKey, WinIntelEntry>;

export const WIN_INTEL_KEYS: WinIntelKey[] = [
  'incumbent',
  'competitor',
  'selection_criteria',
  'switch_risk',
];

export function intakeWinGateEnabled(): boolean {
  return process.env.PTT_INTAKE_WIN_GATE === '1';
}

const FILLED_CONFIDENCE = new Set(['heard', 'confirmed']);

export function computeWinTotal(win: Record<string, number>): number {
  let total = 0;
  for (const key of WIN_SCORE_KEYS) {
    const score = Number(win[key] ?? 0);
    if (score >= 1 && score <= 5) total += score;
  }
  return total;
}

export function parseWinChecklist(answers: Record<string, unknown> | undefined): WinChecklistState {
  const raw = answers?.win_checklist;
  if (!raw || typeof raw !== 'object') return {};
  const out: WinChecklistState = {};
  for (const key of WIN_SCORE_KEYS) {
    const score = Number((raw as Record<string, unknown>)[key] ?? 0);
    if (score >= 1 && score <= 5) out[key] = score;
  }
  return out;
}

export function scoreWinFromChecklist(checklist: WinChecklistState): Record<string, number> {
  const win: Record<string, number> = {};
  for (const key of WIN_SCORE_KEYS) {
    const score = Number(checklist[key] ?? 0);
    win[key] = score >= 1 && score <= 5 ? score : 0;
  }
  return win;
}

function emptyEntry(): WinIntelEntry {
  return { answer: '', confidence: '' };
}

function parseEntry(raw: unknown): WinIntelEntry {
  if (!raw || typeof raw !== 'object') return emptyEntry();
  const block = raw as Record<string, unknown>;
  return {
    answer: typeof block.answer === 'string' ? block.answer : '',
    confidence: typeof block.confidence === 'string' ? block.confidence : '',
  };
}

export function parseWinIntel(answers: Record<string, unknown> | undefined): WinIntelState {
  const raw = answers?.win_intel;
  const block = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    incumbent: parseEntry(block.incumbent),
    competitor: parseEntry(block.competitor),
    selection_criteria: parseEntry(block.selection_criteria),
    switch_risk: parseEntry(block.switch_risk),
  };
}

function intelFilled(entry: WinIntelEntry | undefined): boolean {
  if (!entry) return false;
  return entry.answer.trim().length >= 8 && FILLED_CONFIDENCE.has(entry.confidence);
}

export function winKeyFilled(input: {
  key: WinScoreKey;
  winIntel: Pick<WinIntelState, 'incumbent' | 'competitor' | 'selection_criteria' | 'switch_risk'>;
  winChecklist: WinChecklistState;
}): boolean {
  const { key, winIntel, winChecklist } = input;
  if (key === 'champion' || key === 'next_step') {
    const score = Number(winChecklist[key] ?? 0);
    return score >= 1 && score <= 5;
  }
  return intelFilled(winIntel[key]);
}

export function missingRequiredWinKeys(input: {
  winIntel: Pick<WinIntelState, 'incumbent' | 'competitor' | 'selection_criteria' | 'switch_risk'>;
  winChecklist: WinChecklistState;
}): WinScoreKey[] {
  return WIN_REQUIRED_KEYS.filter(
    (key) => !winKeyFilled({ key, winIntel: input.winIntel, winChecklist: input.winChecklist }),
  );
}
