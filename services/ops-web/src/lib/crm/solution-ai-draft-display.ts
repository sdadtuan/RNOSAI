import { hydratePresalesR5Form } from '@/lib/crm/presales-r5-plan.util';

export const SOLUTION_AI_DRAFT_LABEL = 'Bản nháp AI — AM kiểm tra trước khi nộp';
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
    sections[item.key] = filled(sectionRaw[item.key] as string | undefined);
  }
  return {
    title: filled(row.title as string | undefined) || undefined,
    status,
    source,
    requested_at: filled(row.requested_at as string | undefined) || undefined,
    sections,
  };
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
      sections: SOLUTION_AI_SECTIONS.map((item) => ({
        key: item.key,
        label: item.label,
        body: packed.sections[item.key] || '',
      })),
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
