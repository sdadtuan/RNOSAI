export const SOLUTION_AI_NOT_CONFIGURED = 'Chưa cấu hình AI';
export const SOLUTION_AI_PENDING_LABEL = 'Đang chờ AI viết';

export const SOLUTION_AI_SECTIONS = [
  { key: 'context', label: 'Bối cảnh khách hàng' },
  { key: 'goals', label: 'Mục tiêu / KPI' },
  { key: 'service_strategy', label: 'Chiến lược theo từng dịch vụ–hạng mục' },
  { key: 'monthly_plan', label: 'Kế hoạch theo tháng' },
  { key: 'budget_split', label: 'Phân bổ ngân sách' },
  { key: 'prelim_quote', label: 'Báo giá sơ bộ' },
  { key: 'risks', label: 'Rủi ro / điểm cần AM xác nhận' },
] as const;

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
  job?: unknown;
};

export function emptySolutionAiSections(): SolutionAiSections {
  return {
    context: '',
    goals: '',
    service_strategy: '',
    monthly_plan: '',
    budget_split: '',
    prelim_quote: '',
    risks: '',
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

export function mergeSolutionAiIntoStrategy(
  strategy: Record<string, string>,
  packed: SolutionAiPacked,
): Record<string, string> {
  return { ...strategy, solution_ai: JSON.stringify(packSolutionAi(packed)) };
}

export function normalizeSolutionAiSections(raw: unknown): SolutionAiSections {
  const rec =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const out = emptySolutionAiSections();
  for (const row of SOLUTION_AI_SECTIONS) {
    const aliases = [row.key, row.label, row.key.replace('_', '')];
    let body = '';
    for (const alias of aliases) {
      if (rec[alias] == null) continue;
      const formatted = formatSolutionAiSectionText(rec[alias], row.key);
      if (formatted) {
        body = formatted;
        break;
      }
    }
    out[row.key] = body;
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
    'Bạn là chuyên gia presales marketing tại Việt Nam.',
    'Viết một bản Solution sơ bộ bằng tiếng Việt, mạch lạc, cụ thể, không sao chép nguyên văn đầu vào.',
    'Trả về JSON với các khóa: title và sections.',
    'sections phải có đủ 7 khóa: context, goals, service_strategy, monthly_plan, budget_split, prelim_quote, risks.',
    'Mỗi giá trị trong sections PHẢI là một chuỗi văn bản thuần (string). Không trả object hoặc array cho bất kỳ mục nào.',
    'Trong mỗi chuỗi, dùng xuống dòng và gạch đầu dòng "- ". Ví dụ service_strategy: "- SEO: ...\\n- Meta Ads: ..."; monthly_plan: "Tháng 1: ...\\nTháng 2: ..."; budget_split: "- Content: 30 triệu (25%)\\n- Ads: 90 triệu (75%)".',
    'Ý nghĩa: Bối cảnh khách hàng; Mục tiêu / KPI; Chiến lược theo từng dịch vụ–hạng mục; Kế hoạch theo tháng; Phân bổ ngân sách; Báo giá sơ bộ; Rủi ro / điểm cần AM xác nhận.',
    'Nếu chưa có giá catalog, ghi rõ đây là ước tính và cần AM xác nhận.',
    'Không gửi email cho khách. Không bịa số liệu không có trong đầu vào; nêu rõ điểm còn thiếu trong risks.',
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
  if (key === 'monthly_plan' || looksLikeMonth(rec)) {
    return formatMonthLine(rec, index, sectionKey, depth);
  }
  if (key === 'budget_split' || looksLikeBudget(rec)) {
    const line = formatBudgetLine(rec, sectionKey, depth);
    return line && !alreadyListed(line) ? `- ${line}` : line;
  }
  if (key === 'service_strategy' || looksLikeService(rec)) {
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
  if (key === 'monthly_plan' || (keys.length > 0 && keys.every((item) => isMonthKey(item) || MONTH_INDEX_KEYS.includes(item) || MONTH_BODY_KEYS.includes(item) || MONTH_LABEL_KEYS.includes(item)))) {
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
  if (key === 'budget_split' || looksLikeBudget(rec)) {
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
  if (key === 'service_strategy' || looksLikeService(rec)) {
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
