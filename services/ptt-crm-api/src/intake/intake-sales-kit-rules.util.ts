import { BANT_KEYS, GO_THRESHOLDS } from './intake-definitions.util';

export type SalesKitIntent =
  | 'next_question'
  | 'gap_to_go'
  | 'win_intel'
  | 'service_dive'
  | 'summary_30s'
  | 'red_flag'
  | 'freeform'
  | 'ask_library'
  | 'battle_card'
  | 'pricing_band';

export type SalesKitRulesInput = {
  intent: SalesKitIntent;
  message?: string;
  bant: Record<string, number>;
  discoveryAnswers: Record<string, { answer?: string }>;
  criticalKeys: string[];
  qualifyItems: Array<{ key: string; text: string }>;
  serviceSlug: string;
  isPilot: boolean;
};

export type SalesKitRulesOutput = {
  reply_vi: string;
  next_question?: { key: string; text: string; tab: 'discovery' | 'qualify' | 'win_intel' };
  apply: {
    discovery?: Array<{ key: string; answer: string }>;
    win_intel?: Partial<Record<string, string>>;
    ai_summary?: string;
    bant_hints?: Partial<Record<string, number>>;
    red_flags?: string[];
  };
  gap: { total: number; to_go: number; weakest: string[] };
  citations: [];
  stub_mode: true;
};

const WIN_INTEL_KEYS = ['incumbent', 'competitor', 'selection_criteria', 'switch_risk'] as const;

function isBlank(value?: string): boolean {
  return !String(value ?? '').trim();
}

function bantScore(bant: Record<string, number>, key: string): number {
  const n = Number(bant[key] ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function bantOrder(key: string): number {
  const i = (BANT_KEYS as readonly string[]).indexOf(key);
  return i < 0 ? 99 : i;
}

function computeGap(bant: Record<string, number>): SalesKitRulesOutput['gap'] {
  let total = 0;
  const scored: Array<{ key: string; score: number }> = [];
  const missing: string[] = [];
  for (const key of BANT_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(bant, key)) {
      missing.push(key);
      continue;
    }
    const score = bantScore(bant, key);
    total += score;
    if (score <= 2) scored.push({ key, score });
  }
  scored.sort((a, b) => a.score - b.score || bantOrder(a.key) - bantOrder(b.key));
  return {
    total,
    to_go: Math.max(0, GO_THRESHOLDS.go - total),
    weakest: [...scored.map((s) => s.key), ...missing],
  };
}

function questionText(input: SalesKitRulesInput, key: string): string {
  return input.qualifyItems.find((q) => q.key === key)?.text ?? key;
}

function firstUnansweredCritical(input: SalesKitRulesInput) {
  const key = input.criticalKeys.find((k) => isBlank(input.discoveryAnswers[k]?.answer));
  if (!key) return undefined;
  return { key, text: questionText(input, key), tab: 'discovery' as const };
}

function unansweredQualify(input: SalesKitRulesInput, limit = 3) {
  return input.qualifyItems.filter((q) => isBlank(input.discoveryAnswers[q.key]?.answer)).slice(0, limit);
}

function discoverySnippets(input: SalesKitRulesInput, limit = 3): string[] {
  const out: string[] = [];
  for (const [key, row] of Object.entries(input.discoveryAnswers)) {
    const answer = String(row?.answer ?? '').trim();
    if (!answer) continue;
    out.push(`${key}: ${answer}`);
    if (out.length >= limit) break;
  }
  return out;
}

function emptyLibraryReply(kind: 'ask_library' | 'pricing_band' | 'battle_card'): string {
  if (kind === 'pricing_band') return 'Chưa có bảng giá trong kho. Không bịa số.';
  if (kind === 'battle_card') return 'Chưa có file battle-card trong kho.';
  return 'Chưa có file trong kho. Không bịa giá/case.';
}

function replyForIntent(input: SalesKitRulesInput, gap: SalesKitRulesOutput['gap']): {
  reply_vi: string;
  next_question?: SalesKitRulesOutput['next_question'];
  apply: SalesKitRulesOutput['apply'];
} {
  const apply: SalesKitRulesOutput['apply'] = {};
  switch (input.intent) {
    case 'gap_to_go': {
      const weakest = gap.weakest.length ? gap.weakest.join(', ') : 'không';
      return {
        reply_vi: `Còn ${gap.to_go} điểm để Go. Tiêu chí yếu: ${weakest}. Ưu tiên hỏi ngân sách / Budget.`,
        apply,
      };
    }
    case 'next_question': {
      const next_question = firstUnansweredCritical(input);
      return {
        reply_vi: next_question
          ? `Câu tiếp theo (${next_question.key}): ${next_question.text}`
          : 'Đã hỏi hết câu critical.',
        next_question,
        apply,
      };
    }
    case 'service_dive': {
      if (!input.isPilot) {
        return {
          reply_vi:
            'Chưa có playbook slug này — dùng form chung. Chọn SEO / Google Ads / Website để kit sâu.',
          apply,
        };
      }
      const open = unansweredQualify(input);
      const next_question = open[0]
        ? { key: open[0].key, text: open[0].text, tab: 'qualify' as const }
        : undefined;
      return {
        reply_vi: open.length
          ? `Deep-dive ${input.serviceSlug}: ${open.map((q) => q.text).join(' · ')}`
          : `Đã hỏi qualify ${input.serviceSlug}.`,
        next_question,
        apply,
      };
    }
    case 'summary_30s': {
      const parts = [`BANT ${gap.total}/30 · DV ${input.serviceSlug}`, ...discoverySnippets(input)];
      const reply_vi = parts.join(' · ');
      return { reply_vi, apply: { ai_summary: reply_vi } };
    }
    case 'win_intel':
      return {
        reply_vi: `Win intel còn trống: ${WIN_INTEL_KEYS.join(', ')}. Hỏi agency cũ / tiêu chí chọn.`,
        next_question: { key: 'incumbent', text: 'Agency / freelancer đang làm?', tab: 'win_intel' },
        apply,
      };
    case 'red_flag':
      return {
        reply_vi: 'Đối chiếu red flag với pain / ngân sách / DM trên phiên. Không tự tick.',
        apply,
      };
    case 'ask_library':
    case 'pricing_band':
    case 'battle_card':
      return { reply_vi: emptyLibraryReply(input.intent), apply };
    case 'freeform':
    default:
      return {
        reply_vi: input.message?.trim()
          ? 'Giữ trong qualify/handoff. Hỏi kho khi cần giá/case — hiện chưa có file.'
          : 'Chọn chip: câu tiếp theo, gap-to-Go, hoặc deep-dive dịch vụ.',
        apply,
      };
  }
}

export function runSalesKitRules(input: SalesKitRulesInput): SalesKitRulesOutput {
  const gap = computeGap(input.bant);
  const { reply_vi, next_question, apply } = replyForIntent(input, gap);
  return {
    reply_vi,
    ...(next_question ? { next_question } : {}),
    apply,
    gap,
    citations: [],
    stub_mode: true,
  };
}
