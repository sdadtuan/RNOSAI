/**
 * P11.a growth_sections schema v1.
 * fill_pct: per block, share of important fields that are non-empty and whose
 * owning quality is not `tbd` (arrays: rows with quality !== tbd / row count;
 * empty array = 0). Null money/KPI stays null — never coerced to 0.
 */

export const GROWTH_SCHEMA_VERSION = 1;

export const GROWTH_QUALITIES = ['known', 'assumed', 'tbd'] as const;
export const OFFER_TIERS = [
  'free_value',
  'first_offer',
  'core',
  'upsell',
  'retain',
  'referral',
] as const;
export const COST_GROUPS = [
  'research',
  'content_prod',
  'ads',
  'kol',
  'web_seo',
  'crm',
  'tech_ai',
  'contingency',
] as const;
export const RACI_WORKSTREAMS = [
  'strategy',
  'content',
  'ads',
  'website',
  'crm_cskh',
  'reporting',
] as const;

export const GROWTH_TOP_LEVEL_KEYS = [
  'schema_version',
  'industry_pack_key',
  'service_pack_key',
  'template_version',
  'north_star',
  'kpi_tree',
  'executive_summary',
  'research',
  'icp_segments',
  'journey',
  'positioning',
  'offer_ladder',
  'channel_mix',
  'content_pillars',
  'campaign_table',
  'ops_checklist',
  'retain_journeys',
  'membership',
  'budget_90d',
  'roadmap_90d',
  'calendar_12w',
  'raci',
  'risks',
  'finance_board',
  'approval_checklist',
  'updated_at',
  'updated_by',
  'generated_at',
  'generated_by',
] as const;

const TOP_LEVEL = new Set<string>(GROWTH_TOP_LEVEL_KEYS);
const QUALITY = new Set<string>(GROWTH_QUALITIES);
const TIERS = new Set<string>(OFFER_TIERS);
const COSTS = new Set<string>(COST_GROUPS);
const STREAMS = new Set<string>(RACI_WORKSTREAMS);
const MONEY_KEYS = new Set(['baseline', 'target', 'm1', 'm2', 'm3', 'budget_pct', 'amount', 'budget_vnd']);

export type GrowthFail = { ok: false; error: string; message: string };
export type GrowthOk<T> = { ok: true; value: T; warnings: string[] };

export function emptyGrowthSections(): Record<string, unknown> {
  return {
    schema_version: GROWTH_SCHEMA_VERSION,
    industry_pack_key: null,
    service_pack_key: null,
    template_version: 'strategy_template_v1',
    north_star: {
      metric_key: null,
      label: null,
      baseline: null,
      target: null,
      unit: null,
      owner_staff_id: null,
      source: null,
      quality: 'tbd',
    },
    kpi_tree: [],
    executive_summary: { context: null, problems: [], strategy_pillars: [], quality: 'tbd' },
    research: { opportunity_map: [], competitors: [], customer_insight: null, quality: 'tbd' },
    icp_segments: [],
    journey: [],
    positioning: {
      statement: null,
      proofs: [],
      primary_message: null,
      cta: null,
      quality: 'tbd',
    },
    offer_ladder: [],
    channel_mix: [],
    content_pillars: [],
    campaign_table: [],
    ops_checklist: { website: [], sla: [], livestream: [] },
    retain_journeys: [],
    membership: null,
    budget_90d: { currency: 'VND', months: [], lines: [] },
    roadmap_90d: { d1_30: [], d31_60: [], d61_90: [] },
    calendar_12w: [],
    raci: [],
    risks: [],
    finance_board: [],
    approval_checklist: [],
    updated_at: null,
    updated_by: null,
    generated_at: null,
    generated_by: null,
  };
}

function isPlain(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

/** Empty string and null stay null. Finite numbers, including 0, are kept. */
export function nullableNumber(value: unknown): number | null {
  if (value == null || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function normalizeMoneyFields(node: unknown): void {
  if (Array.isArray(node)) {
    node.forEach(normalizeMoneyFields);
    return;
  }
  if (!isPlain(node)) return;
  for (const key of Object.keys(node)) {
    if (MONEY_KEYS.has(key)) {
      node[key] = nullableNumber(node[key]);
    } else {
      normalizeMoneyFields(node[key]);
    }
  }
}

function deepMerge(base: unknown, patch: unknown): unknown {
  if (Array.isArray(patch)) return structuredClone(patch);
  if (!isPlain(patch)) return patch;
  const out: Record<string, unknown> = isPlain(base) ? { ...base } : {};
  for (const [key, value] of Object.entries(patch)) {
    out[key] = deepMerge(out[key], value);
  }
  return out;
}

function fail(error: string, message: string): GrowthFail {
  return { ok: false, error, message };
}

function assertKnownSources(node: unknown, path: string): GrowthFail | null {
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i += 1) {
      const hit = assertKnownSources(node[i], `${path}[${i}]`);
      if (hit) return hit;
    }
    return null;
  }
  if (!isPlain(node)) return null;
  if (node.quality === 'known' && !String(node.source ?? '').trim()) {
    return fail(
      'source_required_for_known',
      `${path || 'field'} quality=known cần source (Confirm / Insight / Role KPI / manual:…).`,
    );
  }
  for (const [key, value] of Object.entries(node)) {
    const hit = assertKnownSources(value, path ? `${path}.${key}` : key);
    if (hit) return hit;
  }
  return null;
}

function validateShape(sections: Record<string, unknown>): GrowthFail | null {
  const walkQuality = (node: unknown, path: string): GrowthFail | null => {
    if (Array.isArray(node)) {
      for (let i = 0; i < node.length; i += 1) {
        const hit = walkQuality(node[i], `${path}[${i}]`);
        if (hit) return hit;
      }
      return null;
    }
    if (!isPlain(node)) return null;
    if (node.quality != null && !QUALITY.has(String(node.quality))) {
      return fail('invalid_quality', `${path}.quality không hợp lệ`);
    }
    for (const [key, value] of Object.entries(node)) {
      const hit = walkQuality(value, path ? `${path}.${key}` : key);
      if (hit) return hit;
    }
    return null;
  };

  const qualityHit = walkQuality(sections, '');
  if (qualityHit) return qualityHit;

  const offers = sections.offer_ladder;
  if (Array.isArray(offers)) {
    for (const row of offers) {
      if (!isPlain(row)) return fail('invalid_tier', 'offer_ladder row phải là object');
      if (!TIERS.has(String(row.tier ?? ''))) {
        return fail('invalid_tier', `tier không hợp lệ: ${String(row.tier ?? '')}`);
      }
    }
  }

  const budget = sections.budget_90d;
  const lines = isPlain(budget) && Array.isArray(budget.lines) ? budget.lines : [];
  for (const row of lines) {
    if (!isPlain(row)) return fail('invalid_cost_group', 'budget line phải là object');
    if (!COSTS.has(String(row.cost_group ?? ''))) {
      return fail('invalid_cost_group', `cost_group không hợp lệ: ${String(row.cost_group ?? '')}`);
    }
  }

  const raci = sections.raci;
  if (Array.isArray(raci)) {
    for (const row of raci) {
      if (!isPlain(row) || !STREAMS.has(String(row.workstream ?? ''))) {
        return fail('invalid_workstream', `workstream không hợp lệ: ${isPlain(row) ? String(row.workstream ?? '') : ''}`);
      }
    }
  }

  const weeks = sections.calendar_12w;
  if (Array.isArray(weeks)) {
    for (const row of weeks) {
      const week = isPlain(row) ? Number(row.week) : NaN;
      if (!Number.isInteger(week) || week < 1 || week > 12) {
        return fail('invalid_week', 'calendar_12w.week phải từ 1 đến 12');
      }
    }
  }

  return assertKnownSources(sections, '');
}

export function mergeGrowthSections(
  current: unknown,
  patch: Record<string, unknown>,
): GrowthOk<Record<string, unknown>> | GrowthFail {
  const warnings: string[] = [];
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (!TOP_LEVEL.has(key)) {
      warnings.push(`unknown_field_stripped:${key}`);
      continue;
    }
    clean[key] = value;
  }
  const base = isPlain(current) && current.schema_version === 1 ? current : emptyGrowthSections();
  const merged = deepMerge(base, clean) as Record<string, unknown>;
  merged.schema_version = GROWTH_SCHEMA_VERSION;
  normalizeMoneyFields(merged);
  const invalid = validateShape(merged);
  if (invalid) return invalid;
  return { ok: true, value: merged, warnings };
}

function filledText(value: unknown): boolean {
  return value != null && String(value).trim() !== '';
}

function qualityFilled(row: unknown): boolean {
  if (!isPlain(row)) return filledText(row);
  if (row.quality === 'tbd') return false;
  return Object.entries(row).some(([key, value]) => key !== 'quality' && key !== 'source' && filledText(value));
}

function arrayFill(rows: unknown): number {
  if (!Array.isArray(rows) || rows.length === 0) return 0;
  const hit = rows.filter((row) => qualityFilled(row)).length;
  return Math.round((hit / rows.length) * 100);
}

export function growthFillPct(sections: Record<string, unknown>): Record<string, number> {
  const star = isPlain(sections.north_star) ? sections.north_star : {};
  const starKeys = ['label', 'metric_key', 'baseline', 'target', 'unit'];
  const starHit = star.quality === 'tbd' ? 0 : starKeys.filter((key) => filledText(star[key]) || typeof star[key] === 'number').length;
  const starPct = star.quality === 'tbd' ? 0 : Math.round((starHit / starKeys.length) * 100);
  const budget = isPlain(sections.budget_90d) ? sections.budget_90d : {};
  const roadmap = isPlain(sections.roadmap_90d) ? sections.roadmap_90d : null;
  const roadmapFilled = Boolean(
    roadmap &&
      ['d1_30', 'd31_60', 'd61_90'].some(
        (key) => Array.isArray(roadmap[key]) && (roadmap[key] as unknown[]).length > 0,
      ),
  );
  return {
    north_star: starPct,
    kpi_tree: arrayFill(sections.kpi_tree),
    executive_summary: isPlain(sections.executive_summary) && sections.executive_summary.quality !== 'tbd' && filledText(sections.executive_summary.context) ? 100 : 0,
    research: isPlain(sections.research) && sections.research.quality !== 'tbd' && filledText(sections.research.customer_insight) ? 100 : 0,
    icp_segments: arrayFill(sections.icp_segments),
    journey: arrayFill(sections.journey),
    positioning: isPlain(sections.positioning) && sections.positioning.quality !== 'tbd' && filledText(sections.positioning.statement) ? 100 : 0,
    offer_ladder: arrayFill(sections.offer_ladder),
    channel_mix: arrayFill(sections.channel_mix),
    content_pillars: arrayFill(sections.content_pillars),
    campaign_table: arrayFill(sections.campaign_table),
    budget_90d: arrayFill(budget.lines),
    roadmap_90d: roadmapFilled ? 100 : 0,
    calendar_12w: arrayFill(sections.calendar_12w),
    raci: arrayFill(sections.raci),
    risks: arrayFill(sections.risks),
    finance_board: arrayFill(sections.finance_board),
  };
}

export function growthSoftWarnings(sections: Record<string, unknown>): string[] {
  const warnings: string[] = [];
  const star = isPlain(sections.north_star) ? sections.north_star : {};
  if (!filledText(star.label)) warnings.push('north_star_missing');
  const lines = isPlain(sections.budget_90d) && Array.isArray(sections.budget_90d.lines)
    ? sections.budget_90d.lines
    : [];
  const budgetEmpty =
    lines.length === 0 ||
    lines.every((row) => !isPlain(row) || (row.m1 == null && row.m2 == null && row.m3 == null));
  if (budgetEmpty) warnings.push('budget_90d_empty');
  const weeks = Array.isArray(sections.calendar_12w) ? sections.calendar_12w : [];
  const calendarEmpty =
    weeks.length === 0 ||
    weeks.every((row) => !isPlain(row) || !Object.entries(row).some(([key, value]) => key !== 'week' && key !== 'quality' && filledText(value)));
  if (calendarEmpty) warnings.push('calendar_12w_empty');
  if (!Array.isArray(sections.raci) || sections.raci.length === 0) warnings.push('raci_empty');
  if (warnings.length > 0) warnings.push('growth_sections_incomplete');
  return warnings;
}

/** Pack defaults must not present client money/KPI numbers. Text examples are allowed. */
export function packDefaultsHaveFakeNumbers(value: unknown, path = ''): string | null {
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      const hit = packDefaultsHaveFakeNumbers(value[i], `${path}[${i}]`);
      if (hit) return hit;
    }
    return null;
  }
  if (!isPlain(value)) return null;
  for (const [key, child] of Object.entries(value)) {
    const here = path ? `${path}.${key}` : key;
    if (['baseline', 'target', 'm1', 'm2', 'm3', 'amount', 'budget_vnd'].includes(key) && typeof child === 'number') {
      return here;
    }
    if (key === 'budget_pct' && child != null) return here;
    const nested = packDefaultsHaveFakeNumbers(child, here);
    if (nested) return nested;
  }
  return null;
}
