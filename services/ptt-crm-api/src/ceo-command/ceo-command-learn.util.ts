import { normalizeLearnQuestion } from '../intake/sales-kit-learn.util';
import { KIT_MONEY_PATTERN } from '../intake/intake-sales-kit-llm.util';
import type { CeoTurnRow } from './ceo-command-turns.repository';

export function ceoAnswerHasForbiddenMoney(answer: string, kind: string): boolean {
  if (kind === 'metric_note') return false;
  KIT_MONEY_PATTERN.lastIndex = 0;
  return KIT_MONEY_PATTERN.test(answer);
}

export function candidateFromDownTurn(turn: CeoTurnRow): {
  folder_key: string;
  kind: string;
  question: string;
  answer: string;
  source_turn_id: string;
} | null {
  const question =
    String(turn.user_text ?? '').trim() ||
    String(turn.reply_vi ?? '').trim().slice(0, 80);
  const answer = String(turn.reply_vi ?? '').trim().slice(0, 800);
  if (!question || !answer) return null;
  if (ceoAnswerHasForbiddenMoney(answer, 'qa')) return null;
  return {
    folder_key: '_common/qa',
    kind: 'qa',
    question,
    answer,
    source_turn_id: turn.id,
  };
}

export { normalizeLearnQuestion };
