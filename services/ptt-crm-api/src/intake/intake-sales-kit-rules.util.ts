import {
  BANT_KEYS,
  GO_THRESHOLDS,
  getUiDefinition,
  normalizeIntakeSlug,
} from './intake-definitions.util';
import type { IntakeSessionRow } from './intake.types';

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
  questionItems: Array<{ key: string; text: string }>;
  qualifyChecked: Record<string, boolean>;
  winIntel: Record<string, string>;
  serviceSlug: string;
  isPilot: boolean;
};

export type SalesKitCitation = {
  file_id: string;
  file_name: string;
  folder_path: string;
  excerpt: string;
  score: number;
  kind: string;
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
  citations: SalesKitCitation[];
  stub_mode: boolean;
};

const SALES_KIT_INTENTS: readonly SalesKitIntent[] = [
  'next_question',
  'gap_to_go',
  'win_intel',
  'service_dive',
  'summary_30s',
  'red_flag',
  'freeform',
  'ask_library',
  'battle_card',
  'pricing_band',
];

const WIN_INTEL_KEYS = ['incumbent', 'competitor', 'selection_criteria', 'switch_risk'] as const;

const WIN_INTEL_PROMPTS: Record<(typeof WIN_INTEL_KEYS)[number], string> = {
  incumbent: 'Agency / freelancer đang làm?',
  competitor: 'Đối thủ đang so sánh?',
  selection_criteria: 'Tiêu chí chọn agency?',
  switch_risk: 'Rủi ro nếu đổi agency?',
};

export function isSalesKitIntent(value: unknown): value is SalesKitIntent {
  return typeof value === 'string' && (SALES_KIT_INTENTS as readonly string[]).includes(value);
}

function parseBantFromJson(raw: Record<string, unknown> | undefined): Record<string, number> {
  const bant: Record<string, number> = {};
  for (const key of BANT_KEYS) {
    const n = Number(raw?.[key] ?? 0);
    bant[key] = Number.isFinite(n) ? n : 0;
  }
  return bant;
}

function parseDiscoveryAnswers(
  answersJson: Record<string, unknown> | undefined,
): Record<string, { answer?: string }> {
  const raw = answersJson?.discovery_responses;
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, { answer?: string }> = {};
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    if (val && typeof val === 'object') {
      out[key] = { answer: String((val as Record<string, unknown>).answer ?? '') };
    } else if (typeof val === 'string') {
      out[key] = { answer: val };
    }
  }
  return out;
}

function parseQualifyChecked(
  answersJson: Record<string, unknown> | undefined,
): Record<string, boolean> {
  const raw = answersJson?.qualify_checked;
  if (!raw || typeof raw !== 'object') return {};
  const checked: Record<string, boolean> = {};
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    if (val === true || val === 'true' || val === 1) checked[key] = true;
  }
  return checked;
}

function parseWinIntelAnswers(
  answersJson: Record<string, unknown> | undefined,
): Record<string, string> {
  const raw = answersJson?.win_intel;
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, string> = {};
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof val === 'string') {
      out[key] = val;
      continue;
    }
    if (val && typeof val === 'object') {
      out[key] = String((val as Record<string, unknown>).answer ?? '');
    }
  }
  return out;
}

function questionItemsFromDef(
  items: Array<{ key: string; text: string; critical?: boolean }> | undefined,
): Array<{ key: string; text: string }> {
  return (items ?? [])
    .filter((q) => Boolean(q && typeof q === 'object' && q.key))
    .map((q) => ({ key: String(q.key), text: String(q.text ?? '') }));
}

export function buildRulesInputFromSession(opts: {
  intent: SalesKitIntent;
  message?: string;
  serviceSlug?: string;
  session: Pick<IntakeSessionRow, 'service_slug' | 'mode' | 'bant_json' | 'answers_json'>;
}): SalesKitRulesInput {
  const override = normalizeIntakeSlug(String(opts.serviceSlug ?? '').trim());
  const sessionSlug = normalizeIntakeSlug(String(opts.session.service_slug ?? '').trim()) || '_common';
  const slug = override || sessionSlug;
  const def = getUiDefinition(slug);
  const mode = String(opts.session.mode ?? 'phone').trim() === 'in_person' ? 'in_person' : 'phone';
  const items = (
    mode === 'in_person' ? def.inperson_question_items : def.phone_question_items
  ) as Array<{ key: string; text: string; critical?: boolean }> | undefined;
  const qualifyRaw = Array.isArray(def.qualify_items) ? def.qualify_items : [];
  return {
    intent: opts.intent,
    ...(opts.message !== undefined ? { message: opts.message } : {}),
    bant: parseBantFromJson(opts.session.bant_json),
    discoveryAnswers: parseDiscoveryAnswers(opts.session.answers_json),
    criticalKeys: (items ?? []).filter((q) => q.critical).map((q) => q.key),
    qualifyItems: qualifyRaw
      .filter((q): q is { key: string; text: string } => Boolean(q && typeof q === 'object'))
      .map((q) => ({ key: String(q.key ?? ''), text: String(q.text ?? '') })),
    questionItems: questionItemsFromDef(items),
    qualifyChecked: parseQualifyChecked(opts.session.answers_json),
    winIntel: parseWinIntelAnswers(opts.session.answers_json),
    serviceSlug: slug,
    isPilot: Boolean(def.is_pilot_form),
  };
}

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
  return (
    (input.questionItems ?? []).find((q) => q.key === key)?.text ||
    input.qualifyItems.find((q) => q.key === key)?.text ||
    key
  );
}

function firstUnansweredCritical(input: SalesKitRulesInput) {
  const key = input.criticalKeys.find((k) => isBlank(input.discoveryAnswers[k]?.answer));
  if (!key) return undefined;
  return { key, text: questionText(input, key), tab: 'discovery' as const };
}

function unansweredQualify(input: SalesKitRulesInput, limit = 3) {
  const checked = input.qualifyChecked ?? {};
  return input.qualifyItems
    .filter((q) => !checked[q.key] && isBlank(input.discoveryAnswers[q.key]?.answer))
    .slice(0, limit);
}

function emptyWinIntelKeys(input: SalesKitRulesInput): Array<(typeof WIN_INTEL_KEYS)[number]> {
  const filled = input.winIntel ?? {};
  return WIN_INTEL_KEYS.filter((key) => isBlank(filled[key]));
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

export function emptyLibraryReply(kind: 'ask_library' | 'pricing_band' | 'battle_card'): string {
  if (kind === 'pricing_band') return 'Chưa có bảng giá trong kho. Không bịa số.';
  if (kind === 'battle_card') return 'Chưa có file battle-card trong kho.';
  return 'Chưa có file trong kho. Không bịa giá/case.';
}

export function emptyAskLibraryQueryReply(): string {
  return 'Gõ câu hỏi để hỏi kho. Ví dụ: KH nói đắt.';
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
    case 'win_intel': {
      const empty = emptyWinIntelKeys(input);
      if (!empty.length) {
        return { reply_vi: 'Win intel đã đủ 4 ô.', apply };
      }
      const nextKey = empty[0];
      return {
        reply_vi: `Win intel còn trống: ${empty.join(', ')}. Hỏi agency cũ / tiêu chí chọn.`,
        next_question: {
          key: nextKey,
          text: WIN_INTEL_PROMPTS[nextKey],
          tab: 'win_intel',
        },
        apply,
      };
    }
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
