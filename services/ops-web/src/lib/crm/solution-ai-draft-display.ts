import { hydratePresalesR5Form } from '@/lib/crm/presales-r5-plan.util';

export const SOLUTION_AI_DRAFT_LABEL = 'Bản nháp AI — AM kiểm tra trước khi nộp';

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

const SKIP_STRATEGY_KEYS = new Set(['mkt_files', 'solution_pack', 'client_brief']);

export type SolutionAiDraftSection = { key: string; label: string; body: string };

export type SolutionAiDraftView = {
  title: string;
  badge: string;
  sections: SolutionAiDraftSection[];
};

function filled(value: string | null | undefined): string {
  return String(value ?? '').trim();
}

export function isAiDraftNotice(message: string | null | undefined): boolean {
  const raw = String(message ?? '').trim();
  if (!raw) return false;
  return /bản nháp(\s+ai)?/i.test(raw) || /sp duyệt/i.test(raw);
}

export function presentSolutionAiDraft(
  plan: Record<string, unknown> | null | undefined,
): SolutionAiDraftView | null {
  if (!plan) return null;
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
    sections,
  };
}
