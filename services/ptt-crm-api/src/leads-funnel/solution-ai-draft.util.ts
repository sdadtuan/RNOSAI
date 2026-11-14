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
      const value = rec[alias];
      if (value != null && String(value).trim()) {
        body = String(value).trim();
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
  return SOLUTION_AI_SECTIONS.some((row) => String(rec[row.key] ?? '').trim());
}
