import { BANT_KEYS } from './intake-definitions.util';
import { WIN_SCORE_KEYS } from './intake-win-score.util';

export function normalizeScoreQuote(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

export function formCorpus(input: {
  discoveryAnswers: string[];
  winAnswers: string[];
  commitmentTexts: string[];
}): string {
  return [...input.discoveryAnswers, ...input.winAnswers, ...input.commitmentTexts].join(' ');
}

export type ScoreSuggestion = { score: 1 | 2 | 3 | 4 | 5; quote: string };

type RejectReason = 'empty_quote' | 'quote_not_in_form' | 'bad_score';

type RejectedEntry = { layer: 'bant' | 'win'; key: string; reason: RejectReason };

function isValidScore(score: unknown): score is 1 | 2 | 3 | 4 | 5 {
  return typeof score === 'number' && Number.isInteger(score) && score >= 1 && score <= 5;
}

function filterLayerSuggestions(input: {
  layer: 'bant' | 'win';
  allowedKeys: readonly string[];
  corpus: string;
  suggestions?: Partial<Record<string, ScoreSuggestion>>;
}): {
  suggestions: Partial<Record<string, ScoreSuggestion>>;
  rejected: RejectedEntry[];
} {
  const kept: Partial<Record<string, ScoreSuggestion>> = {};
  const rejected: RejectedEntry[] = [];
  const normalizedCorpus = normalizeScoreQuote(input.corpus);

  for (const [key, suggestion] of Object.entries(input.suggestions ?? {})) {
    if (!input.allowedKeys.includes(key)) continue;
    if (!suggestion) continue;

    if (!isValidScore(suggestion.score)) {
      rejected.push({ layer: input.layer, key, reason: 'bad_score' });
      continue;
    }

    if (suggestion.quote.trim().length === 0) {
      rejected.push({ layer: input.layer, key, reason: 'empty_quote' });
      continue;
    }

    const normalizedQuote = normalizeScoreQuote(suggestion.quote);
    if (!normalizedCorpus.includes(normalizedQuote)) {
      rejected.push({ layer: input.layer, key, reason: 'quote_not_in_form' });
      continue;
    }

    kept[key] = { score: suggestion.score, quote: suggestion.quote };
  }

  return { suggestions: kept, rejected };
}

export function filterScoreSuggestions(input: {
  corpus: string;
  bant?: Partial<Record<string, ScoreSuggestion>>;
  win?: Partial<Record<string, ScoreSuggestion>>;
}): {
  suggestions: { bant?: Partial<Record<string, ScoreSuggestion>>; win?: Partial<Record<string, ScoreSuggestion>> };
  rejected: RejectedEntry[];
} {
  const bant = filterLayerSuggestions({
    layer: 'bant',
    allowedKeys: BANT_KEYS,
    corpus: input.corpus,
    suggestions: input.bant,
  });
  const win = filterLayerSuggestions({
    layer: 'win',
    allowedKeys: WIN_SCORE_KEYS,
    corpus: input.corpus,
    suggestions: input.win,
  });

  const suggestions: {
    bant?: Partial<Record<string, ScoreSuggestion>>;
    win?: Partial<Record<string, ScoreSuggestion>>;
  } = {};
  if (Object.keys(bant.suggestions).length > 0) suggestions.bant = bant.suggestions;
  if (Object.keys(win.suggestions).length > 0) suggestions.win = win.suggestions;

  return {
    suggestions,
    rejected: [...bant.rejected, ...win.rejected],
  };
}
