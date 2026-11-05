import { KIT_MONEY_PATTERN } from './intake-sales-kit-llm.util';
import { folderKeyOk } from './sales-kit-library.util';

export function normalizeLearnQuestion(q: string): string {
  return String(q ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
}

export function answerHasForbiddenMoney(
  answer: string,
  kind: 'qa' | 'battle_card' | 'pricing',
): boolean {
  if (kind === 'pricing') return false;
  KIT_MONEY_PATTERN.lastIndex = 0;
  return KIT_MONEY_PATTERN.test(answer);
}

export function learnFolderKey(serviceSlug: string): string {
  const slug = String(serviceSlug ?? '').trim();
  const key = `${slug}/qa`;
  return folderKeyOk(key) ? key : '_common/qa';
}

export function candidateFromDownTurn(input: {
  turn: { id: string; user_text: string; reply_vi: string; citations_json: unknown };
  serviceSlug: string;
  sessionId: number;
  leadId: number | null;
}): {
  kind: 'qa';
  folder_key: string;
  question: string;
  answer: string;
  source_session_id: number;
  source_lead_id: number | null;
  source_turn_id: string;
} | null {
  const question =
    String(input.turn.user_text ?? '').trim() ||
    String(input.turn.reply_vi ?? '').trim().slice(0, 80);
  const answer = String(input.turn.reply_vi ?? '').trim().slice(0, 800);
  if (!question || !answer) return null;
  if (answerHasForbiddenMoney(answer, 'qa')) return null;
  return {
    kind: 'qa',
    folder_key: learnFolderKey(input.serviceSlug),
    question,
    answer,
    source_session_id: input.sessionId,
    source_lead_id: input.leadId,
    source_turn_id: input.turn.id,
  };
}

type LearnCitation = { kind?: string };

function citationKinds(raw: unknown): Set<string> {
  const out = new Set<string>();
  if (!Array.isArray(raw)) return out;
  for (const item of raw) {
    if (item && typeof item === 'object' && 'kind' in item) {
      out.add(String((item as LearnCitation).kind ?? '').trim());
    }
  }
  return out;
}

export function candidatesFromCompletedSession(input: {
  session: {
    id: number;
    lead_id: number | null;
    service_slug?: string;
    decision?: string | null;
    decision_reason?: string | null;
  };
  upTurns: Array<{
    id: string;
    user_text: string;
    reply_vi: string;
    citations_json: unknown;
  }>;
}): Array<{
  kind: 'qa' | 'battle_card' | 'pricing';
  folder_key: string;
  question: string;
  answer: string;
  source_turn_id: string | null;
  source_session_id: number;
  source_lead_id: number | null;
}> {
  const slug = String(input.session.service_slug ?? '').trim();
  const baseFolder = learnFolderKey(slug);
  const out: Array<{
    kind: 'qa' | 'battle_card' | 'pricing';
    folder_key: string;
    question: string;
    answer: string;
    source_turn_id: string | null;
    source_session_id: number;
    source_lead_id: number | null;
  }> = [];
  const seen = new Set<string>();

  const push = (row: {
    kind: 'qa' | 'battle_card' | 'pricing';
    folder_key: string;
    question: string;
    answer: string;
    source_turn_id: string | null;
  }) => {
    if (out.length >= 3) return;
    const key = normalizeLearnQuestion(row.question);
    if (!key || seen.has(key)) return;
    if (row.kind !== 'pricing' && answerHasForbiddenMoney(row.answer, row.kind)) return;
    seen.add(key);
    out.push({
      ...row,
      source_session_id: input.session.id,
      source_lead_id: input.session.lead_id,
    });
  };

  const decision = String(input.session.decision ?? '').trim();
  const reason = String(input.session.decision_reason ?? '').trim();
  if (decision && reason) {
    push({
      kind: 'qa',
      folder_key: baseFolder,
      question: `Vì sao ${decision}?`,
      answer: reason.slice(0, 800),
      source_turn_id: null,
    });
  }

  for (const turn of input.upTurns) {
    if (out.length >= 3) break;
    const question =
      String(turn.user_text ?? '').trim() ||
      String(turn.reply_vi ?? '').trim().slice(0, 80);
    const answer = String(turn.reply_vi ?? '').trim().slice(0, 800);
    if (!question || !answer) continue;
    const kinds = citationKinds(turn.citations_json);
    const kind: 'qa' | 'battle_card' | 'pricing' = kinds.has('pricing')
      ? 'pricing'
      : kinds.has('battle_card')
        ? 'battle_card'
        : 'qa';
    const folder_key =
      kind === 'pricing'
        ? folderKeyOk(`${slug}/pricing`)
          ? `${slug}/pricing`
          : '_common/pricing'
        : kind === 'battle_card'
          ? folderKeyOk(`${slug}/battle-cards`)
            ? `${slug}/battle-cards`
            : '_common/battle-cards'
          : baseFolder;
    if (kind === 'pricing' && !kinds.has('pricing')) {
      push({
        kind: 'qa',
        folder_key: baseFolder,
        question,
        answer: 'KH hỏi giá — neo gói, hỏi ngân sách.',
        source_turn_id: turn.id,
      });
      continue;
    }
    push({
      kind,
      folder_key,
      question,
      answer,
      source_turn_id: turn.id,
    });
  }

  return out;
}
