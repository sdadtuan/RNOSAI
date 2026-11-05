export type WinIntelKey = 'incumbent' | 'competitor' | 'selection_criteria' | 'switch_risk';

export type WinIntelEntry = { answer: string; confidence: string };

export type WinIntelState = Record<WinIntelKey, WinIntelEntry>;

export const WIN_INTEL_KEYS: WinIntelKey[] = [
  'incumbent',
  'competitor',
  'selection_criteria',
  'switch_risk',
];

function emptyEntry(): WinIntelEntry {
  return { answer: '', confidence: '' };
}

export function emptyWinIntel(): WinIntelState {
  return {
    incumbent: emptyEntry(),
    competitor: emptyEntry(),
    selection_criteria: emptyEntry(),
    switch_risk: emptyEntry(),
  };
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

export function mergeWinIntelPatch(
  existing: Record<string, unknown> | undefined,
  winIntel: WinIntelState,
): Record<string, unknown> {
  return {
    ...(existing ?? {}),
    win_intel: {
      incumbent: { answer: winIntel.incumbent.answer, confidence: winIntel.incumbent.confidence },
      competitor: { answer: winIntel.competitor.answer, confidence: winIntel.competitor.confidence },
      selection_criteria: {
        answer: winIntel.selection_criteria.answer,
        confidence: winIntel.selection_criteria.confidence,
      },
      switch_risk: {
        answer: winIntel.switch_risk.answer,
        confidence: winIntel.switch_risk.confidence,
      },
    },
  };
}

export function parseQualifyChecked(
  answers: Record<string, unknown> | undefined,
): Record<string, boolean> {
  const raw = answers?.qualify_checked;
  if (!raw || typeof raw !== 'object') return {};
  const checked: Record<string, boolean> = {};
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    if (val === true || val === 'true' || val === 1) checked[key] = true;
  }
  return checked;
}

export function mergeQualifyCheckedPatch(
  existing: Record<string, unknown> | undefined,
  qualifyChecked: Record<string, boolean>,
): Record<string, unknown> {
  return {
    ...(existing ?? {}),
    qualify_checked: qualifyChecked,
  };
}
