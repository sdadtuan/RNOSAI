export const SOLUTION_AI_NOT_CONFIGURED = 'Chưa cấu hình AI';
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

/** Older drafts used these keys. Read them into the agency structure; do not drop the text. */
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

export type SolutionAiSectionKey = (typeof SOLUTION_AI_SECTIONS)[number]['key'];

export type SolutionAiSections = Record<SolutionAiSectionKey, string>;

export type SolutionAiSource = 'llm' | 'agent';
export type SolutionAiStatus = 'pending' | 'ready' | 'error';

export type SolutionAiPacked = {
  status: SolutionAiStatus;
  source: SolutionAiSource;
  job_id?: string;
  requested_at?: string;
  completed_at?: string;
  title?: string;
  sections: SolutionAiSections;
  warnings?: string[];
  job?: unknown;
};

export function emptySolutionAiSections(): SolutionAiSections {
  return {
    executive_summary: '',
    client_context: '',
    objectives: '',
    strategy: '',
    channel_plan: '',
    timeline: '',
    budget: '',
    team: '',
    risks: '',
    next_steps: '',
  };
}

export function packSolutionAi(input: SolutionAiPacked): SolutionAiPacked {
  return {
    status: input.status,
    source: input.source,
    job_id: input.job_id,
    requested_at: input.requested_at,
    completed_at: input.completed_at,
    title: input.title,
    sections: { ...emptySolutionAiSections(), ...normalizeSolutionAiSections(input.sections) },
    warnings: Array.isArray(input.warnings) ? input.warnings.map((item) => String(item).trim()).filter(Boolean) : undefined,
    job: input.job,
  };
}

export function parseSolutionAi(raw: unknown): SolutionAiPacked | null {
  const value = unwrapJson(raw);
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const rec = value as Record<string, unknown>;
  const status = String(rec.status ?? '').trim();
  const source = String(rec.source ?? '').trim();
  if (status !== 'pending' && status !== 'ready' && status !== 'error') {
    if (!rec.sections && !hasAnySection(rec)) return null;
  }
  const sections = normalizeSolutionAiSections(rec.sections ?? rec);
  const hasBody = Object.values(sections).some((text) => text.trim());
  const resolvedStatus: SolutionAiStatus =
    status === 'pending' || status === 'ready' || status === 'error'
      ? status
      : hasBody
        ? 'ready'
        : 'pending';
  const resolvedSource: SolutionAiSource = source === 'agent' ? 'agent' : 'llm';
  return packSolutionAi({
    status: resolvedStatus,
    source: resolvedSource,
    job_id: String(rec.job_id ?? '').trim() || undefined,
    requested_at: String(rec.requested_at ?? '').trim() || undefined,
    completed_at: String(rec.completed_at ?? '').trim() || undefined,
    title: String(rec.title ?? '').trim() || undefined,
    sections,
    warnings: Array.isArray(rec.warnings) ? rec.warnings.map((item) => String(item)) : undefined,
    job: rec.job,
  });
}

export function parseSolutionAiFromStrategy(strategy: unknown): SolutionAiPacked | null {
  if (!strategy) return null;
  if (typeof strategy === 'string') {
    const parsed = unwrapJson(strategy);
    if (parsed && typeof parsed === 'object' && parsed !== null && 'solution_ai' in parsed) {
      return parseSolutionAi((parsed as Record<string, unknown>).solution_ai);
    }
    return parseSolutionAi(parsed);
  }
  if (typeof strategy === 'object' && !Array.isArray(strategy)) {
    const rec = strategy as Record<string, unknown>;
    return parseSolutionAi(rec.solution_ai ?? rec);
  }
  return null;
}

/** Ready 7-section AI Solution draft counts as a Solution file for Nộp. */
export function solutionAiDraftCountsAsSolution(strategy: unknown): boolean {
  const packed = parseSolutionAiFromStrategy(strategy);
  if (!packed || packed.status === 'pending' || packed.status === 'error') return false;
  return Object.values(packed.sections).some((text) => String(text ?? "").trim());
}

export function mergeSolutionAiIntoStrategy(
  strategy: Record<string, string>,
  packed: SolutionAiPacked,
): Record<string, string> {
  return { ...strategy, solution_ai: JSON.stringify(packSolutionAi(packed)) };
}

function foldSectionKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const SECTION_KEY_BY_FOLD = new Map<string, SolutionAiSectionKey>();
for (const row of SOLUTION_AI_SECTIONS) {
  SECTION_KEY_BY_FOLD.set(foldSectionKey(row.key), row.key);
  SECTION_KEY_BY_FOLD.set(foldSectionKey(row.label), row.key);
  for (const alias of SOLUTION_AI_SECTION_ALIASES[row.key] ?? []) {
    SECTION_KEY_BY_FOLD.set(foldSectionKey(alias), row.key);
  }
}

function sectionRecord(raw: unknown): Record<string, unknown> {
  if (Array.isArray(raw)) {
    const rec: Record<string, unknown> = {};
    for (const item of raw) {
      if (!item || typeof item !== 'object') continue;
      const row = item as Record<string, unknown>;
      const key = String(row.key ?? row.id ?? row.label ?? row.name ?? row.title ?? '').trim();
      const body = row.body ?? row.content ?? row.text ?? row.value ?? row.markdown ?? row.section;
      if (key) rec[key] = body ?? row;
    }
    return rec;
  }
  if (raw && typeof raw === 'object') return { ...(raw as Record<string, unknown>) };
  return {};
}

export function normalizeSolutionAiSections(raw: unknown): SolutionAiSections {
  const rec = sectionRecord(raw);
  const out = emptySolutionAiSections();
  const buckets = new Map<SolutionAiSectionKey, string[]>();
  for (const [key, value] of Object.entries(rec)) {
    const sectionKey = SECTION_KEY_BY_FOLD.get(foldSectionKey(key));
    if (!sectionKey || value == null) continue;
    const formatted = formatSolutionAiSectionText(value, sectionKey);
    if (!formatted) continue;
    const list = buckets.get(sectionKey) ?? [];
    if (!list.includes(formatted)) list.push(formatted);
    buckets.set(sectionKey, list);
  }
  for (const row of SOLUTION_AI_SECTIONS) {
    const parts = buckets.get(row.key) ?? [];
    out[row.key] = row.key === 'budget' ? parts.join('\n') : (parts[0] ?? '');
  }
  return out;
}

export function buildSolutionAiDraftCall(input: {
  companyName?: string;
  briefText: string;
  discoveryText: string;
  serviceLines: string;
  budgetLabel: string;
  timelineLabel: string;
  callNotes: string;
  attachmentText: string;
  sourceText: string;
}): { systemPrompt: string; userContent: string } {
  const systemPrompt = [
    'Bạn là giám đốc chiến lược của PTT Ads, agency marketing tại Việt Nam.',
    'Viết Solution tiếng Việt, giọng agency, mạch lạc, đủ để AM mang đi họp khách.',
    'Chỉ dùng sự kiện có trong đầu vào. Không bịa số liệu, tên người, KPI, ngân sách hay cam kết.',
    'Chỗ thiếu dữ liệu phải giữ nguyên cụm [Cần bổ sung: ...], không đoán.',
    'Trả về JSON với title và sections.',
    'sections đủ 10 khóa: executive_summary, client_context, objectives, strategy, channel_plan, timeline, budget, team, risks, next_steps.',
    'Mỗi giá trị là một chuỗi. Xuống dòng và gạch đầu dòng "- " khi liệt kê.',
    'Gắn thương hiệu PTT Ads ở tóm tắt và đội ngũ. Không gửi email cho khách.',
  ].join(' ');

  const userContent = [
    `Công ty: ${input.companyName?.trim() || '(chưa rõ)'}`,
    '',
    '=== Brief / USP / mục tiêu ===',
    input.briefText.trim() || '(trống)',
    '',
    '=== Sales Discovery ===',
    input.discoveryText.trim() || '(trống)',
    '',
    '=== Dịch vụ / hạng mục (tên, không chỉ slug) ===',
    input.serviceLines.trim() || '(chưa chọn)',
    '',
    `Ngân sách: ${input.budgetLabel.trim() || '(chưa chốt)'}`,
    `Timeline: ${input.timelineLabel.trim() || '(chưa chốt)'}`,
    '',
    '=== Ghi chú cuộc gọi ===',
    input.callNotes.trim() || '(không có)',
    '',
    '=== Tài liệu đính kèm (PDF đã trích text) ===',
    input.attachmentText.trim() || '(không có hoặc không đọc được)',
    '',
    '=== Website / fanpage đã thu thập ===',
    input.sourceText.trim() || '(không có)',
  ].join('\n');

  return { systemPrompt, userContent };
}

function unwrapJson(raw: unknown): unknown {
  if (typeof raw !== 'string') return raw;
  const text = raw.trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return raw;
  }
}

function hasAnySection(rec: Record<string, unknown>): boolean {
  return SOLUTION_AI_SECTIONS.some((row) => formatSolutionAiSectionText(rec[row.key], row.key).trim());
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

export type AgencySolutionFacts = {
  companyName?: string;
  industry?: string;
  contactName?: string;
  need?: string;
  goal?: string;
  channels?: string;
  audience?: string;
  usp?: string;
  services?: string;
  budget?: string;
  timeline?: string;
  currentResults?: string;
  difficulties?: string;
  callNotes?: string;
  competitors?: string;
  metrics?: string;
  website?: string;
  missing?: string[];
};

function fact(value: string | undefined, label: string): string {
  const text = String(value ?? '').trim();
  return text || `[Cần bổ sung: ${label}]`;
}

/** Agency-grade Solution from supplied facts only. Missing facts stay as marked placeholders. */
export function composeAgencySolution(input: AgencySolutionFacts): {
  title: string;
  sections: SolutionAiSections;
} {
  const company = fact(input.companyName, 'Tên công ty');
  const industry = fact(input.industry, 'Ngành');
  const need = fact(input.need, 'Nhu cầu cụ thể');
  const goal = fact(input.goal, 'Mục tiêu đo được');
  const channels = fact(input.channels, 'Kênh muốn chạy và cách chốt đơn');
  const audience = fact(input.audience, 'Khách hàng mục tiêu');
  const services = fact(input.services, 'Dịch vụ quan tâm');
  const budget = fact(input.budget, 'Ngân sách');
  const timeline = fact(input.timeline, 'Thời điểm triển khai');
  const usp = fact(input.usp, 'Điểm khác biệt');
  const current = fact(input.currentResults, 'Kết quả marketing hiện tại');
  const hard = fact(input.difficulties, 'Khó khăn hiện tại');
  const notes = fact(input.callNotes, 'Ghi chú cuộc gọi');
  const rivals = fact(input.competitors, 'Đối thủ');
  const metrics = fact(input.metrics, 'Chỉ số đang theo dõi');
  const site = fact(input.website, 'Website / fanpage');
  const missing = (input.missing ?? []).map((item) => String(item).trim()).filter(Boolean);
  const gapLine = missing.length
    ? missing.map((item) => `- [Cần bổ sung: ${item}]`).join('\n')
    : '- Không có mục bắt buộc nào bị bỏ trống trong hồ sơ đã nộp.';

  const sections = emptySolutionAiSections();
  const channelItems = String(input.channels ?? '')
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter((item) => item && !item.startsWith('['));
  const channelBlock = channelItems.length
    ? channelItems.map((item) => `- ${item}: giữ đúng kênh khách đã chọn. Cách chốt đơn chỉ ghi nếu brief đã nói; không thêm ngân sách hay KPI riêng cho kênh.`).join('\n')
    : `- ${channels}`;
  sections.executive_summary = [
    `PTT Ads soạn Solution này cho ${company} để AM và Sales dùng trong buổi chốt.`,
    `Khách thuộc ngành ${industry}. Vấn đề Sales đã ghi nhận: ${need}.`,
    `Mục tiêu đo được trên Sales Brief: ${goal}.`,
    `Hạng mục PTT sẽ làm, đúng danh sách khách quan tâm: ${services}.`,
    `Ngân sách khách nêu: ${budget}. Thời điểm muốn triển khai: ${timeline}.`,
    'Toàn bộ con số và tên trong tài liệu đều lấy từ hồ sơ. Chỗ chưa có dữ liệu được đánh dấu [Cần bổ sung] và không phải cam kết của PTT.',
  ].join('\n');
  sections.client_context = [
    `- Công ty: ${company}`,
    `- Ngành: ${industry}`,
    `- Website / fanpage: ${site}`,
    `- Người liên hệ: ${fact(input.contactName, 'Người liên hệ')}`,
    `- Điểm khác biệt đã ghi: ${usp}`,
    `- Đối thủ đã ghi: ${rivals}`,
    `- Nhu cầu: ${need}`,
  ].join('\n');
  sections.objectives = [
    `- Mục tiêu đo được: ${goal}`,
    `- Chỉ số đang theo dõi: ${metrics}`,
    '- KPI chốt (doanh thu, CPL, số lead, ROAS) chỉ ghi khi có trong brief. Chưa có thì giữ placeholder, không đặt số mục tiêu mới.',
  ].join('\n');
  sections.strategy = [
    `- Xuất phát từ vấn đề: ${need}`,
    `- Thông điệp bám điểm khác biệt: ${usp}`,
    `- Dịch vụ PTT đề xuất triển khai theo đúng hạng mục khách chọn: ${services}`,
    '- Không thêm gói dịch vụ ngoài danh sách trên.',
  ].join('\n');
  sections.channel_plan = [
    'Kênh dưới đây là kênh khách đã chọn trên Sales Brief. Không thêm kênh ngoài danh sách.',
    channelBlock,
    `- Cách chốt đơn / ghi chú kênh: ${channels}`,
    `- Kết quả marketing hiện tại: ${current}`,
    `- Khách hàng mục tiêu: ${audience}`,
  ].join('\n');
  sections.timeline = [
    `- Thời điểm khách muốn triển khai: ${timeline}`,
    '- Mốc chi tiết (tuần 1 audit, tuần 2 lên nội dung, tuần 3 chạy) chỉ lập khi brief đã có thời điểm. Nếu còn placeholder, AM chốt lịch với khách trước khi đưa vào báo giá.',
  ].join('\n');
  sections.budget = [
    `- Ngân sách trên hồ sơ: ${budget}`,
    '- Đây chưa phải báo giá. AM lập báo giá từ catalog sau khi Solution được Sales xác nhận.',
    '- Không chia phần trăm ngân sách khi hồ sơ không ghi cơ cấu chi.',
  ].join('\n');
  sections.team = [
    '- PTT Ads: AM phụ trách giữ quan hệ và báo giá; Marketing thực hiện Solution theo hạng mục đã chọn.',
    '- Tên từng người chỉ ghi khi hệ thống đã gán. Không điền tên giả định.',
  ].join('\n');
  sections.risks = [
    `- Khó khăn khách đã nêu: ${hard}`,
    `- Ghi chú cuộc gọi: ${notes}`,
    gapLine,
    '- Mọi mục [Cần bổ sung] là giả định chưa được khách xác nhận. AM không được trình bày các mục đó như sự thật.',
  ].join('\n');
  sections.next_steps = [
    '- AM đọc lại các mục [Cần bổ sung] với Sales.',
    '- Sales bổ sung brief nếu khách đã nói nhưng chưa ghi.',
    '- Khi đủ việc sẽ làm và kết quả khách nhận, AM nộp Solution rồi lập báo giá.',
  ].join('\n');
  return {
    title: `Solution PTT Ads — ${String(input.companyName ?? '').trim() || 'Khách hàng'}`,
    sections,
  };
}
