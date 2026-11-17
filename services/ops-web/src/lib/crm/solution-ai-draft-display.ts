import { hydratePresalesR5Form } from '@/lib/crm/presales-r5-plan.util';

export const SOLUTION_AI_DRAFT_LABEL = 'Bản nháp AI — AM kiểm tra trước khi nộp';
export const SOLUTION_AI_PENDING_LABEL = 'Đang chờ AI viết';

export const SOLUTION_AI_SECTIONS = [
  { key: 'executive_summary', label: 'Tóm tắt điều hành' },
  { key: 'client_context', label: 'Bối cảnh khách hàng' },
  { key: 'objectives', label: 'Mục tiêu và KPI' },
  { key: 'strategy', label: 'Chiến lược' },
  { key: 'channel_plan', label: 'Kế hoạch kênh' },
  { key: 'timeline', label: 'Lộ trình' },
  { key: 'budget', label: 'Ngân sách và liên kết báo giá' },
  { key: 'team', label: 'Đội ngũ PTT' },
  { key: 'risks', label: 'Rủi ro và giả định' },
  { key: 'next_steps', label: 'Bước tiếp theo' },
] as const;

const SOLUTION_AI_SECTION_ALIASES: Record<string, string[]> = {
  executive_summary: ['executive_summary', 'tom_tat'],
  client_context: ['client_context', 'context'],
  objectives: ['objectives', 'goals'],
  strategy: ['strategy', 'service_strategy'],
  channel_plan: ['channel_plan'],
  timeline: ['timeline', 'monthly_plan'],
  budget: ['budget', 'budget_split', 'prelim_quote'],
  team: ['team'],
  risks: ['risks'],
  next_steps: ['next_steps'],
};

const SECTION_LABELS: Record<string, string> = {
  north_star: 'North Star',
  objectives: 'Mục tiêu chiến lược',
  target_market: 'Thị trường mục tiêu',
  market_message: 'Thông điệp thị trường',
  media_reach: 'Kênh tiếp cận / Media',
  conversion_strategy: 'Chiến lược chuyển đổi',
  retention_system: 'Hệ thống giữ chân',
  nurture_system: 'Nuôi dưỡng lead',
  world_class_experience: 'Trải nghiệm đẳng cấp',
  lifecycle_extension: 'Gia hạn lifecycle',
  referral_engine: 'Giới thiệu / Referral',
};

const SKIP_STRATEGY_KEYS = new Set(['mkt_files', 'solution_pack', 'client_brief', 'solution_ai']);

export type SolutionAiDraftSection = { key: string; label: string; body: string };

export type SolutionAiDraftView = {
  title: string;
  badge: string;
  status: 'pending' | 'ready' | 'error' | 'legacy';
  source?: 'llm' | 'agent' | 'legacy';
  requestedAt?: string;
  packedJson?: string;
  warnings?: string[];
  sections: SolutionAiDraftSection[];
};

function filled(value: string | null | undefined): string {
  return String(value ?? '').trim();
}

export function isAiDraftNotice(message: string | null | undefined): boolean {
  const raw = String(message ?? '').trim();
  if (!raw) return false;
  return /bản nháp(\s+ai)?/i.test(raw) || /sp duyệt/i.test(raw) || /đang chờ ai viết/i.test(raw);
}

export function formatSolutionAiTime(iso: string | null | undefined): string {
  const raw = String(iso ?? '').trim();
  if (!raw) return '';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('vi-VN', {
    timeZone: 'Asia/Saigon',
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function parsePackedSolutionAi(plan: Record<string, unknown> | null | undefined): {
  title?: string;
  status: 'pending' | 'ready' | 'error';
  source?: 'llm' | 'agent';
  requested_at?: string;
  sections: Record<string, string>;
  warnings: string[];
} | null {
  if (!plan) return null;
  const framework = (plan.strategy_framework ?? plan.strategy_framework_json) as unknown;
  const rec =
    typeof framework === 'string'
      ? (safeJson(framework) as Record<string, unknown> | null)
      : framework && typeof framework === 'object' && !Array.isArray(framework)
        ? (framework as Record<string, unknown>)
        : null;
  if (!rec) return null;
  const packed = typeof rec.solution_ai === 'string' ? safeJson(rec.solution_ai) : rec.solution_ai;
  if (!packed || typeof packed !== 'object' || Array.isArray(packed)) return null;
  const row = packed as Record<string, unknown>;
  const statusRaw = String(row.status ?? '').trim();
  const status: 'pending' | 'ready' | 'error' =
    statusRaw === 'pending' || statusRaw === 'error' ? statusRaw : 'ready';
  const source = String(row.source ?? '').trim() === 'agent' ? 'agent' : 'llm';
  const sectionRaw =
    row.sections && typeof row.sections === 'object' && !Array.isArray(row.sections)
      ? (row.sections as Record<string, unknown>)
      : row;
  const sections: Record<string, string> = {};
  for (const item of SOLUTION_AI_SECTIONS) {
    const aliases = SOLUTION_AI_SECTION_ALIASES[item.key] ?? [item.key];
    const parts: string[] = [];
    for (const alias of aliases) {
      const text = formatSolutionAiSectionText(sectionRaw[alias], item.key);
      if (text && !parts.includes(text)) parts.push(text);
    }
    sections[item.key] = item.key === 'budget' ? parts.join('\n') : (parts[0] ?? '');
  }
  const warnings = Array.isArray(row.warnings)
    ? row.warnings.map((item) => String(item ?? '').trim()).filter(Boolean)
    : [];
  return {
    title: filled(row.title as string | undefined) || undefined,
    status,
    source,
    requested_at: filled(row.requested_at as string | undefined) || undefined,
    sections,
    warnings,
  };
}

/** Ready (non-pending) 7-section AI Solution draft counts as a Solution file for Nộp. */
export function solutionAiDraftIsReady(plan: Record<string, unknown> | null | undefined): boolean {
  const packed = parsePackedSolutionAi(plan);
  if (!packed || packed.status === 'pending' || packed.status === 'error') return false;
  return Object.values(packed.sections).some((body) => String(body ?? "").trim());
}

export function presentSolutionAiDraft(
  plan: Record<string, unknown> | null | undefined,
): SolutionAiDraftView | null {
  if (!plan) return null;
  const packed = parsePackedSolutionAi(plan);
  if (packed) {
    const pending = packed.status === 'pending';
    const when = formatSolutionAiTime(packed.requested_at);
    return {
      title: packed.title || 'Bản nháp Solution',
      badge: pending ? (when ? `${SOLUTION_AI_PENDING_LABEL} · ${when}` : SOLUTION_AI_PENDING_LABEL) : SOLUTION_AI_DRAFT_LABEL,
      status: packed.status,
      source: packed.source,
      requestedAt: packed.requested_at,
      packedJson: JSON.stringify(packed),
      warnings: packed.warnings,
      sections: SOLUTION_AI_SECTIONS.map((item) => ({
        key: item.key,
        label: item.label,
        body: packed.sections[item.key] || '',
      })).filter((item) => item.body.trim()),
    };
  }
  const hydrated = hydratePresalesR5Form(plan);
  const sections: SolutionAiDraftSection[] = [];
  const north = filled(hydrated.planNorthStar);
  if (north) sections.push({ key: 'north_star', label: SECTION_LABELS.north_star, body: north });
  const objectives = filled(hydrated.planObjectives);
  if (objectives) sections.push({ key: 'objectives', label: SECTION_LABELS.objectives, body: objectives });
  for (const [key, label] of Object.entries(SECTION_LABELS)) {
    if (key === 'north_star' || key === 'objectives' || SKIP_STRATEGY_KEYS.has(key)) continue;
    const body = filled(hydrated.planStrategy[key]);
    if (!body || body.startsWith('[') || body.startsWith('{')) continue;
    sections.push({ key, label, body });
  }
  const title = filled(hydrated.planName);
  if (!title && sections.length === 0) return null;
  return {
    title: title || 'Bản nháp Solution',
    badge: SOLUTION_AI_DRAFT_LABEL,
    status: 'legacy',
    source: 'legacy',
    sections,
  };
}

function safeJson(raw: unknown): unknown {
  if (typeof raw !== 'string') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

const OBJECT_STRING = /^\[object [A-Za-z]+\]$/;

const SERVICE_NAME_KEYS = ['service', 'service_name', 'dich_vu', 'ten_dich_vu', 'name', 'label', 'title', 'slug', 'hang_muc', 'item', 'category'];
const SERVICE_BODY_KEYS = ['strategy', 'chien_luoc', 'plan', 'approach', 'description', 'content', 'detail', 'details', 'text', 'body', 'note', 'notes', 'noi_dung', 'mo_ta'];
const MONTH_INDEX_KEYS = ['month', 'thang', 'month_index', 'month_no', 'month_number', 'ky', 'period', 'giai_doan'];
const MONTH_LABEL_KEYS = ['month_label', 'label', 'title', 'name', 'phase'];
const MONTH_BODY_KEYS = ['plan', 'activities', 'activity', 'items', 'noi_dung', 'content', 'description', 'text', 'body', 'focus', 'muc_tieu', 'cong_viec', 'actions'];
const BUDGET_ITEM_KEYS = ['item', 'hang_muc', 'name', 'label', 'service', 'category', 'khoan', 'title'];
const BUDGET_AMOUNT_KEYS = ['amount', 'so_tien', 'value', 'budget', 'cost', 'price', 'money', 'tong', 'total'];
const BUDGET_PERCENT_KEYS = ['percent', 'percentage', 'pct', 'ty_le', 'ty_trong', 'share', 'ratio', 'weight'];
const WRAPPER_KEYS = ['items', 'months', 'services', 'sections', 'data', 'plans', 'hang_muc', 'phan_bo', 'rows', 'list', 'entries'];

/** Turn LLM objects/arrays into readable Vietnamese plain text. Never returns "[object Object]". */
export function formatSolutionAiSectionText(value: unknown, sectionKey = ''): string {
  return formatValue(value, sectionKey, 0).trim();
}

function formatValue(value: unknown, sectionKey: string, depth: number): string {
  if (value == null || value === '') return '';
  if (depth > 6) return '';
  if (typeof value === 'string') {
    const text = value.trim();
    if (!text || OBJECT_STRING.test(text)) return '';
    if (
      (text.startsWith('{') && text.endsWith('}')) ||
      (text.startsWith('[') && text.endsWith(']'))
    ) {
      try {
        return formatValue(JSON.parse(text), sectionKey, depth + 1);
      } catch {
        return text;
      }
    }
    return text;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === 'boolean') return value ? 'Có' : 'Không';
  if (Array.isArray(value)) {
    return value
      .map((item, index) => formatArrayItem(item, sectionKey, index, depth + 1))
      .map((line) => line.trim())
      .filter(Boolean)
      .join('\n');
  }
  if (typeof value === 'object') {
    return formatSectionObject(value as Record<string, unknown>, sectionKey, depth + 1);
  }
  return '';
}

function formatArrayItem(item: unknown, sectionKey: string, index: number, depth: number): string {
  if (item == null || item === '') return '';
  if (typeof item !== 'object') {
    const text = formatValue(item, sectionKey, depth);
    if (!text) return '';
    return alreadyListed(text) ? text : `- ${text}`;
  }
  const rec = item as Record<string, unknown>;
  const key = sectionKey.toLowerCase();
  if (key === 'monthly_plan' || key === 'timeline' || looksLikeMonth(rec)) {
    return formatMonthLine(rec, index, sectionKey, depth);
  }
  if (key === 'budget_split' || key === 'budget' || key === 'prelim_quote' || looksLikeBudget(rec)) {
    const line = formatBudgetLine(rec, sectionKey, depth);
    return line && !alreadyListed(line) ? `- ${line}` : line;
  }
  if (key === 'service_strategy' || key === 'strategy' || key === 'channel_plan' || looksLikeService(rec)) {
    const line = formatServiceLine(rec, sectionKey, depth);
    return line && !alreadyListed(line) ? `- ${line}` : line;
  }
  const line = formatSectionObject(rec, sectionKey, depth);
  if (!line) return '';
  if (line.includes('\n')) return line;
  return alreadyListed(line) ? line : `- ${line}`;
}

function formatSectionObject(rec: Record<string, unknown>, sectionKey: string, depth: number): string {
  const keys = Object.keys(rec).filter((key) => rec[key] != null && rec[key] !== '');
  if (!keys.length) return '';
  for (const wrap of WRAPPER_KEYS) {
    if (keys.length === 1 && Array.isArray(rec[wrap])) {
      return formatValue(rec[wrap], sectionKey, depth);
    }
  }
  const key = sectionKey.toLowerCase();
  if (key === 'monthly_plan' || key === 'timeline' || (keys.length > 0 && keys.every((item) => isMonthKey(item) || MONTH_INDEX_KEYS.includes(item) || MONTH_BODY_KEYS.includes(item) || MONTH_LABEL_KEYS.includes(item)))) {
    if (looksLikeMonth(rec) && !keys.every((item) => isMonthKey(item))) {
      return formatMonthLine(rec, 0, sectionKey, depth);
    }
    if (keys.some((item) => isMonthKey(item))) {
      return keys
        .map((item) => {
          const body = formatValue(rec[item], sectionKey, depth);
          if (!body) return '';
          return `${normalizeMonthLabel(item)}: ${body}`;
        })
        .filter(Boolean)
        .join('\n');
    }
  }
  if (key === 'budget_split' || key === 'budget' || key === 'prelim_quote' || looksLikeBudget(rec)) {
    if (looksLikeBudget(rec) && !keys.every((item) => isPlainLeaf(rec[item]))) {
      const own = formatBudgetLine(rec, sectionKey, depth);
      if (own) return own;
    }
    if (keys.length && keys.every((item) => isPlainLeaf(rec[item]) || isBudgetish(rec[item]))) {
      return keys
        .map((item) => {
          const raw = rec[item];
          if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
            const line = formatBudgetLine({ name: item, ...(raw as Record<string, unknown>) }, sectionKey, depth);
            return line ? (alreadyListed(line) ? line : `- ${line}`) : '';
          }
          const body = formatValue(raw, sectionKey, depth);
          if (!body) return '';
          const line = `${prettyKey(item)}: ${body}`;
          return alreadyListed(line) ? line : `- ${line}`;
        })
        .filter(Boolean)
        .join('\n');
    }
  }
  if (key === 'service_strategy' || key === 'strategy' || key === 'channel_plan' || looksLikeService(rec)) {
    if (looksLikeService(rec) && hasAny(rec, SERVICE_NAME_KEYS) && hasAny(rec, SERVICE_BODY_KEYS)) {
      return formatServiceLine(rec, sectionKey, depth);
    }
    if (keys.length && keys.every((item) => isPlainLeaf(rec[item]) || typeof rec[item] === 'object')) {
      const asMap = keys
        .map((item) => {
          const body = formatValue(rec[item], sectionKey, depth);
          if (!body) return '';
          const line = `${prettyKey(item)}: ${body}`;
          return alreadyListed(line) ? line : `- ${line}`;
        })
        .filter(Boolean);
      if (asMap.length) return asMap.join('\n');
    }
  }
  if (looksLikeMonth(rec)) return formatMonthLine(rec, 0, sectionKey, depth);
  if (looksLikeBudget(rec)) return formatBudgetLine(rec, sectionKey, depth);
  if (looksLikeService(rec)) return formatServiceLine(rec, sectionKey, depth);

  return keys
    .map((item) => {
      const body = formatValue(rec[item], sectionKey, depth);
      if (!body) return '';
      if (isMonthKey(item)) return `${normalizeMonthLabel(item)}: ${body}`;
      return body.includes('\n') ? `${prettyKey(item)}:\n${body}` : `${prettyKey(item)}: ${body}`;
    })
    .filter(Boolean)
    .join('\n');
}

function formatServiceLine(rec: Record<string, unknown>, sectionKey: string, depth: number): string {
  const name = pickText(rec, SERVICE_NAME_KEYS, sectionKey, depth);
  const body = pickText(rec, SERVICE_BODY_KEYS, sectionKey, depth) || leftoverText(rec, [...SERVICE_NAME_KEYS], sectionKey, depth);
  if (name && body) return `${name}: ${body}`;
  return name || body;
}

function formatMonthLine(rec: Record<string, unknown>, index: number, sectionKey: string, depth: number): string {
  const rawIndex = pickRaw(rec, MONTH_INDEX_KEYS);
  const labelFromKey = pickText(rec, MONTH_LABEL_KEYS, sectionKey, depth);
  const num = typeof rawIndex === 'number' ? rawIndex : Number.parseInt(String(rawIndex ?? '').replace(/[^\d]/g, ''), 10);
  const label =
    (labelFromKey && !/^\d+$/.test(labelFromKey) ? labelFromKey : '') ||
    (Number.isFinite(num) && num > 0 ? `Tháng ${num}` : labelFromKey) ||
    (index >= 0 ? `Tháng ${index + 1}` : 'Tháng');
  const body = pickText(rec, MONTH_BODY_KEYS, sectionKey, depth) || leftoverText(rec, [...MONTH_INDEX_KEYS, ...MONTH_LABEL_KEYS], sectionKey, depth);
  return body ? `${label}: ${body}` : label;
}

function formatBudgetLine(rec: Record<string, unknown>, sectionKey: string, depth: number): string {
  const item = pickText(rec, BUDGET_ITEM_KEYS, sectionKey, depth) || 'Hạng mục';
  const amount = formatMoney(pickRaw(rec, BUDGET_AMOUNT_KEYS));
  const percent = formatPercent(pickRaw(rec, BUDGET_PERCENT_KEYS));
  if (amount && percent) return `${item}: ${amount} (${percent})`;
  if (amount) return `${item}: ${amount}`;
  if (percent) return `${item}: ${percent}`;
  const rest = leftoverText(rec, [...BUDGET_ITEM_KEYS], sectionKey, depth);
  return rest ? `${item}: ${rest}` : item === 'Hạng mục' ? rest : item;
}

function pickRaw(rec: Record<string, unknown>, keys: string[]): unknown {
  const lower = new Map(Object.keys(rec).map((key) => [key.toLowerCase(), rec[key]]));
  for (const key of keys) {
    if (lower.has(key) && lower.get(key) != null && lower.get(key) !== '') return lower.get(key);
  }
  return undefined;
}

function pickText(rec: Record<string, unknown>, keys: string[], sectionKey: string, depth: number): string {
  const raw = pickRaw(rec, keys);
  if (raw == null || typeof raw === 'object') {
    return typeof raw === 'object' && raw ? formatValue(raw, sectionKey, depth) : '';
  }
  return formatValue(raw, sectionKey, depth);
}

function leftoverText(rec: Record<string, unknown>, skip: string[], sectionKey: string, depth: number): string {
  const skipped = new Set(skip.map((key) => key.toLowerCase()));
  return Object.keys(rec)
    .filter((key) => !skipped.has(key.toLowerCase()))
    .map((key) => {
      const body = formatValue(rec[key], sectionKey, depth);
      if (!body) return '';
      if (isPlainLeaf(rec[key])) return body;
      return body.includes('\n') ? `${prettyKey(key)}:\n${body}` : `${prettyKey(key)}: ${body}`;
    })
    .filter(Boolean)
    .join('; ');
}

function formatMoney(value: unknown): string {
  if (value == null || value === '') return '';
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Intl.NumberFormat('vi-VN').format(value);
  }
  if (typeof value === 'string') return value.trim();
  return '';
}

function formatPercent(value: unknown): string {
  if (value == null || value === '') return '';
  if (typeof value === 'number' && Number.isFinite(value)) {
    const n = value > 0 && value <= 1 ? value * 100 : value;
    const rounded = Math.round(n * 10) / 10;
    return `${String(rounded).replace(/\.0$/, '')}%`;
  }
  const text = String(value).trim();
  if (!text || OBJECT_STRING.test(text)) return '';
  return /%$/.test(text) ? text : `${text}%`;
}

function hasAny(rec: Record<string, unknown>, keys: string[]): boolean {
  return pickRaw(rec, keys) != null;
}

function looksLikeService(rec: Record<string, unknown>): boolean {
  return hasAny(rec, SERVICE_NAME_KEYS) || hasAny(rec, SERVICE_BODY_KEYS);
}

function looksLikeMonth(rec: Record<string, unknown>): boolean {
  return hasAny(rec, MONTH_INDEX_KEYS) || hasAny(rec, MONTH_BODY_KEYS) || Object.keys(rec).some((key) => isMonthKey(key));
}

function looksLikeBudget(rec: Record<string, unknown>): boolean {
  return hasAny(rec, BUDGET_AMOUNT_KEYS) || hasAny(rec, BUDGET_PERCENT_KEYS) || hasAny(rec, BUDGET_ITEM_KEYS);
}

function isBudgetish(value: unknown): boolean {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) && looksLikeBudget(value as Record<string, unknown>));
}

function isPlainLeaf(value: unknown): boolean {
  return value == null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

function isMonthKey(key: string): boolean {
  return /^(tháng|thang|month|t)\s*[-_]?\s*\d+$/i.test(key.trim()) || /^t\d+$/i.test(key.trim());
}

function normalizeMonthLabel(key: string): string {
  const match = String(key).trim().match(/(\d+)/);
  if (match) return `Tháng ${Number(match[1])}`;
  return prettyKey(key);
}

function prettyKey(key: string): string {
  const text = String(key ?? '').replace(/[_-]+/g, ' ').trim();
  if (!text) return 'Mục';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function alreadyListed(text: string): boolean {
  return /^\s*(?:[-*•–]|\d+[.)])\s+/.test(text);
}
