export const PRELIMINARY_STRATEGY_KEYS = [
  'market_message',
  'media_reach',
  'conversion_strategy',
] as const;

export const PRELIMINARY_SUMMARY_FIELDS = ['north_star', 'objectives'] as const;

export const STRATEGY_FRAMEWORK_KEYS = [
  'target_market',
  'market_message',
  'media_reach',
  'retention_system',
  'nurture_system',
  'conversion_strategy',
  'world_class_experience',
  'lifecycle_extension',
  'referral_engine',
] as const;

export function defaultStrategyJson(): Record<string, string> {
  return Object.fromEntries(STRATEGY_FRAMEWORK_KEYS.map((k) => [k, '']));
}

/** node-pg returns JSONB as an object; String(obj) is "[object Object]". */
export function parsePresalesJsonRecord(raw: unknown): Record<string, string> {
  if (raw == null || raw === '') return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return Object.fromEntries(
      Object.entries(raw as Record<string, unknown>).map(([k, v]) => [k, v == null ? '' : String(v)]),
    );
  }
  try {
    const parsed = JSON.parse(String(raw)) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsePresalesJsonRecord(parsed);
    }
  } catch {
    /* fall through */
  }
  return {};
}

export function validatePreliminaryPlan(plan: {
  name?: string | null;
  north_star?: string | null;
  objectives?: string | null;
  strategy_framework_json?: string | Record<string, string> | null;
} | null): { ok: boolean; complete: boolean; messages: string[] } {
  if (!plan) {
    return { ok: false, complete: false, messages: ['Chưa có Kế hoạch MKT sơ bộ — điền form Báo giá.'] };
  }
  const messages: string[] = [];
  const name = String(plan.name || '').trim();
  if (!name) messages.push('Nhập tên kế hoạch MKT sơ bộ.');
  if (!String(plan.north_star || '').trim() && !String(plan.objectives || '').trim()) {
    messages.push('Nhập North Star hoặc Mục tiêu chiến lược.');
  }
  const sf = parsePresalesJsonRecord(plan.strategy_framework_json);
  for (const key of PRELIMINARY_STRATEGY_KEYS) {
    if (!String(sf[key] || '').trim()) {
      messages.push(`Điền khối chiến lược: ${key}.`);
    }
  }
  return { ok: messages.length === 0, complete: messages.length === 0, messages };
}

export function planContentFromRow(plan: Record<string, unknown>): {
  name: string;
  north_star: string;
  objectives: string;
  strategy_framework: Record<string, string>;
} {
  return {
    name: String(plan.name || ''),
    north_star: String(plan.north_star || ''),
    objectives: String(plan.objectives || ''),
    strategy_framework: parsePresalesJsonRecord(plan.strategy_framework_json),
  };
}
