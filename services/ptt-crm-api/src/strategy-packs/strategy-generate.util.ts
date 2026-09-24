/**
 * P11 generate_draft — pure merge. Never invents baseline/target/budget/CPL.
 * Known only when the caller passes a confirmed TMMT field, approved insight, or a Role KPI number.
 */

import { COST_GROUPS, OFFER_TIERS, RACI_WORKSTREAMS, emptyGrowthSections } from './growth-sections.util';

export const GENERATE_MODES = ['fill_empty_only', 'refresh_assumed', 'replace_all_ai'] as const;
export type GenerateMode = (typeof GENERATE_MODES)[number];

const KNOWN_TMMT = new Set(['assumed_confirmed', 'validated']);
const APPROVED_INSIGHT = new Set(['approved', 'approved_internal', 'approved_client_facing', 'published']);

export const INDUSTRY_INFER_RULES: Array<{ key: string; needles: string[] }> = [
  { key: 'auto_detailing', needles: ['detailing', 'detail'] },
  { key: 'education', needles: ['education', 'tuyển sinh', 'tuyen sinh', 'school', 'giáo dục', 'giao duc'] },
  { key: 'spa_beauty', needles: ['spa', 'beauty', 'thẩm mỹ', 'tham my'] },
  { key: 'fnb', needles: ['f&b', 'fnb', 'nhà hàng', 'nha hang'] },
  { key: 'real_estate', needles: ['bất động sản', 'bat dong san', 'real estate'] },
  { key: 'retail_ecommerce', needles: ['ecommerce', 'thương mại điện tử', 'thuong mai dien tu', 'bán lẻ', 'ban le'] },
  { key: 'b2b_services', needles: ['b2b'] },
];

export type PackRef = { key: string; is_active: boolean; defaults_json: Record<string, unknown> };

export type GenerateInput = {
  planId: number;
  lifecycleId: number | null;
  overwriteMode: GenerateMode;
  requestedIndustryKey: string | null;
  requestedServiceKey: string | null;
  planIndustryKey: string | null;
  planServiceKey: string | null;
  lifecycleIndustryKey: string | null;
  lifecycleServiceKey: string | null;
  inferText: string;
  current: unknown;
  industryPacks: PackRef[];
  servicePacks: PackRef[];
  tmmt: Record<string, { text: string; status: string }>;
  planObjective: string;
  insight: {
    id: number;
    status: string;
    statement: string;
    observation: string;
    interpretation: string;
    implication: string;
  } | null;
  roleKpis: Array<{
    id: number;
    kpi_label: string;
    kpi_key: string;
    target_value: number | null;
    baseline: number | null;
    unit: string;
  }>;
  campaignNames: string[];
};

function isPlain(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function text(value: unknown): string {
  return String(value ?? '').trim();
}

export type PackFallbackWarning = {
  code: 'pack_generic_fallback';
  pack_kind: 'industry' | 'service';
  requested_key: string | null;
  reason: 'not_found' | 'inactive' | 'unresolved';
  resolved_key: string;
};

function lookupPack(packs: PackRef[], key: string | null): PackRef | null {
  const name = text(key);
  if (!name) return null;
  return packs.find((pack) => pack.key === name) ?? null;
}

function activePack(packs: PackRef[], key: string | null): PackRef | null {
  const found = lookupPack(packs, key);
  return found?.is_active ? found : null;
}

function serviceFallbackKey(packs: PackRef[], fallback: string): string {
  return activePack(packs, 'generic')?.key ?? activePack(packs, fallback)?.key ?? fallback;
}

export function resolvePackKey(input: {
  requested: string | null;
  planKey: string | null;
  lifecycleKey: string | null;
  packs: PackRef[];
  inferText: string;
  fallback: string;
  packKind: 'industry' | 'service';
  allowInfer: boolean;
}): { key: string; warning: PackFallbackWarning | null } {
  const requested = text(input.requested);
  if (requested) {
    const found = lookupPack(input.packs, requested);
    if (found?.is_active) return { key: found.key, warning: null };
    const resolved = input.packKind === 'service' ? serviceFallbackKey(input.packs, input.fallback) : 'generic';
    return {
      key: resolved,
      warning: {
        code: 'pack_generic_fallback',
        pack_kind: input.packKind,
        requested_key: requested,
        reason: found ? 'inactive' : 'not_found',
        resolved_key: resolved,
      },
    };
  }

  const chained = activePack(input.packs, input.planKey) ?? activePack(input.packs, input.lifecycleKey);
  if (chained) return { key: chained.key, warning: null };
  if (input.allowInfer) {
    const hay = input.inferText.toLowerCase();
    for (const rule of INDUSTRY_INFER_RULES) {
      if (rule.needles.some((needle) => hay.includes(needle)) && activePack(input.packs, rule.key)) {
        return { key: rule.key, warning: null };
      }
    }
  }
  const resolved = input.packKind === 'service' ? serviceFallbackKey(input.packs, input.fallback) : (activePack(input.packs, input.fallback)?.key ?? input.fallback);
  const warnOnFallback = input.packKind === 'industry' || resolved === 'generic';
  return {
    key: resolved,
    warning: warnOnFallback
      ? {
          code: 'pack_generic_fallback',
          pack_kind: input.packKind,
          requested_key: null,
          reason: 'unresolved',
          resolved_key: resolved,
        }
      : null,
  };
}

function emptyCell(value: unknown): boolean {
  if (value == null || value === '') return true;
  if (Array.isArray(value)) return value.length === 0;
  if (!isPlain(value)) return false;
  if (value.human_locked === true) return false;
  if (value.quality && value.quality !== 'tbd') return false;
  return Object.entries(value).every(([key, child]) =>
    ['quality', 'source', 'generated_by', 'human_locked'].includes(key) ? true : child == null || child === '' || (Array.isArray(child) && child.length === 0),
  );
}

function shouldWrite(existing: unknown, mode: GenerateMode): boolean {
  if (isPlain(existing) && existing.human_locked === true) return false;
  if (isPlain(existing) && existing.quality === 'known') return false;
  if (emptyCell(existing)) return true;
  if (mode === 'fill_empty_only') return false;
  if (mode === 'refresh_assumed') return isPlain(existing) && existing.quality === 'assumed';
  if (!isPlain(existing)) return false;
  if (existing.quality === 'tbd') return true;
  return existing.generated_by === 'ai';
}

function arr(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function mergeKeyed(
  existing: unknown,
  proposed: Array<Record<string, unknown>>,
  keyField: string,
  mode: GenerateMode,
): Array<Record<string, unknown>> {
  const out = arr(existing).filter(isPlain).map((row) => ({ ...row }));
  const index = new Map<string, number>();
  out.forEach((row, i) => {
    if (row[keyField] != null) index.set(String(row[keyField]), i);
  });
  for (const row of proposed) {
    const key = String(row[keyField] ?? '');
    if (!key) continue;
    const at = index.get(key);
    if (at == null) {
      out.push(row);
      index.set(key, out.length - 1);
      continue;
    }
    if (shouldWrite(out[at], mode)) out[at] = { ...out[at], ...row };
  }
  return out;
}

function field(tmmt: GenerateInput['tmmt'], key: string): { text: string; known: boolean } {
  const row = tmmt[key];
  const value = text(row?.text);
  return { text: value, known: Boolean(value) && KNOWN_TMMT.has(String(row?.status ?? '')) };
}

function asStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => text(item)).filter(Boolean) : [];
}

function hasKnownNumber(node: unknown, keys: string[]): boolean {
  if (!isPlain(node) || node.quality !== 'known') return false;
  return keys.some((key) => typeof node[key] === 'number');
}

function approvalChecklist(sections: Record<string, unknown>) {
  const star = isPlain(sections.north_star) ? sections.north_star : {};
  const research = isPlain(sections.research) ? sections.research : {};
  const positioning = isPlain(sections.positioning) ? sections.positioning : {};
  const budget = isPlain(sections.budget_90d) ? sections.budget_90d : {};
  const lines = arr(budget.lines).filter(isPlain);
  const offers = arr(sections.offer_ladder);
  const icp = arr(sections.icp_segments);
  const risks = arr(sections.risks);
  const retain = arr(sections.retain_journeys);
  const campaigns = arr(sections.campaign_table);
  const raci = arr(sections.raci).filter(isPlain);
  const roadmap = isPlain(sections.roadmap_90d) ? sections.roadmap_90d : {};
  const calendar = arr(sections.calendar_12w);
  const items: Array<[string, boolean]> = [
    ['Mục tiêu + North Star rõ', Boolean(text(star.label)) && (typeof star.target === 'number' && star.quality === 'known')],
    ['Có dữ liệu hiện tại', hasKnownNumber(star, ['baseline'])],
    ['Chọn nhóm khách ưu tiên', icp.length > 0],
    ['Nhận định có chứng minh hoặc ghi Assumed', Boolean(text(research.customer_insight))],
    ['Message + offer duyệt', positioning.quality === 'known' && offers.length > 0],
    ['Web/CRM/sales sẵn sàng', false],
    ['Theo dõi nguồn/campaign', campaigns.length > 0],
    ['NS + người PT + duyệt', lines.some((row) => ['m1', 'm2', 'm3'].some((key) => typeof row[key] === 'number' && row.quality === 'known')) || raci.some((row) => row.staff_id != null)],
    ['Giữ khách', retain.length > 0],
    ['Rủi ro', risks.length > 0],
    ['Lịch họp/báo cáo', calendar.length > 0 || asStrings(roadmap.d1_30).length > 0],
  ];
  return items.map(([label, checked]) => ({ item: label, checked, quality: 'tbd' }));
}

export function buildGenerateDraft(input: GenerateInput) {
  const warnings: Array<string | PackFallbackWarning> = [];
  const industry = resolvePackKey({
    requested: input.requestedIndustryKey,
    planKey: input.planIndustryKey,
    lifecycleKey: input.lifecycleIndustryKey,
    packs: input.industryPacks,
    inferText: input.inferText,
    fallback: 'generic',
    packKind: 'industry',
    allowInfer: true,
  });
  if (industry.warning) warnings.push(industry.warning);

  const serviceResolved = resolvePackKey({
    requested: input.requestedServiceKey,
    planKey: input.planServiceKey,
    lifecycleKey: input.lifecycleServiceKey,
    packs: input.servicePacks,
    inferText: '',
    fallback: 'growth_full',
    packKind: 'service',
    allowInfer: false,
  });
  const serviceKey = serviceResolved.key;
  if (serviceResolved.warning) warnings.push(serviceResolved.warning);

  const pack = input.industryPacks.find((row) => row.key === industry.key) ?? null;
  const defaults = pack?.defaults_json ?? {};
  const base = isPlain(input.current) ? structuredClone(input.current) : emptyGrowthSections();
  const mode = input.overwriteMode;

  const insightApproved = Boolean(input.insight && APPROVED_INSIGHT.has(input.insight.status));
  if (!input.insight) warnings.push('insight_missing');
  else if (!insightApproved) warnings.push('insight_not_approved');

  const kpi = input.roleKpis.find((row) => row.target_value != null || row.baseline != null) ?? null;
  const suggestion = arr(defaults.north_star_suggestions).find(isPlain) ?? {};
  const market = field(input.tmmt, 'market_context');
  const icp = field(input.tmmt, 'segmentation_icp');
  const pains = field(input.tmmt, 'pains_desired_outcomes');

  const northStar = {
    metric_key: kpi?.kpi_key ?? (text(suggestion.metric_key) || null),
    label: kpi?.kpi_label || text(suggestion.label) || null,
    baseline: kpi?.baseline ?? null,
    target: kpi?.target_value ?? null,
    unit: kpi?.unit || text(suggestion.unit) || null,
    owner_staff_id: null,
    source: kpi ? `role_kpi:${kpi.id}` : `pack:${industry.key}`,
    quality: kpi ? 'known' : text(suggestion.label) ? 'assumed' : 'tbd',
    generated_by: kpi ? 'role_kpi' : 'ai',
  };
  if (northStar.target == null) warnings.push('north_star_target_missing');

  const problems = insightApproved
    ? [input.insight?.implication, input.insight?.observation].map(text).filter(Boolean)
    : asStrings((defaults.executive_summary_hints as { typical_problems?: unknown } | undefined)?.typical_problems);
  const pillars = asStrings((defaults.executive_summary_hints as { pillar_templates?: unknown } | undefined)?.pillar_templates);
  const contextText = market.text || text(input.planObjective) || null;
  const problemsKnown = insightApproved && problems.length > 0;

  const executive = {
    context: contextText,
    problems,
    strategy_pillars: pillars,
    quality: market.known || problemsKnown ? 'known' : contextText || problems.length ? 'assumed' : 'tbd',
    source: market.known
      ? 'tmmt.market_context'
      : problemsKnown
        ? `insight:${input.insight?.id}`
        : `pack:${industry.key}`,
    generated_by: market.known ? 'tmmt' : problemsKnown ? 'insight' : 'ai',
  };

  const research = {
    opportunity_map: [],
    competitors: [],
    customer_insight: insightApproved
      ? [input.insight?.statement, input.insight?.interpretation].map(text).filter(Boolean).join(' — ') || null
      : pains.text || null,
    quality: insightApproved || pains.known ? 'known' : pains.text ? 'assumed' : 'tbd',
    source: insightApproved ? `insight:${input.insight?.id}` : pains.known ? 'tmmt.pains_desired_outcomes' : `pack:${industry.key}`,
    generated_by: insightApproved || pains.known ? 'crm' : 'ai',
  };

  const packSegments = arr((defaults.icp_hints as { segments?: unknown } | undefined)?.segments).filter(isPlain);
  const icpRows = icp.text
    ? [{ name: icp.text, description: '', needs: '', barriers: '', quality: icp.known ? 'known' : 'assumed', source: 'tmmt.segmentation_icp', generated_by: icp.known ? 'tmmt' : 'ai' }]
    : packSegments.map((row) => ({
        name: text(row.name) || 'Nhóm khách gợi ý',
        description: text(row.description),
        needs: text(row.needs),
        barriers: text(row.barriers),
        quality: 'assumed',
        source: `pack:${industry.key}`,
        generated_by: 'ai',
      }));

  const journeyRows = arr(defaults.journey_stages).filter(isPlain).map((row) => ({
    stage: text(row.stage) || 'aware',
    customer_thinks: text(row.customer_thinks),
    touchpoints: text(row.touchpoints),
    kpi_key: text(row.kpi_key),
    quality: 'assumed',
    source: `pack:${industry.key}`,
    generated_by: 'ai',
  }));

  const positioning = {
    statement: insightApproved ? text(input.insight?.statement) || null : text(input.insight?.statement) || null,
    proofs: insightApproved && text(input.insight?.observation) ? [text(input.insight?.observation)] : [],
    primary_message: null,
    cta: 'Đăng ký tư vấn',
    quality: insightApproved && text(input.insight?.statement) ? 'known' : text(input.insight?.statement) ? 'assumed' : 'tbd',
    source: input.insight ? `insight:${input.insight.id}` : `pack:${industry.key}`,
    generated_by: insightApproved ? 'insight' : 'ai',
  };

  const offerRows = arr(defaults.offer_ladder_examples).filter(isPlain).map((row) => ({
    tier: OFFER_TIERS.includes(text(row.tier) as (typeof OFFER_TIERS)[number]) ? text(row.tier) : 'core',
    goal: text(row.goal),
    example: text(row.example),
    customer_action: text(row.customer_action),
    quality: 'assumed',
    source: `pack:${industry.key}`,
    generated_by: 'ai',
  }));

  const channelRows = arr(defaults.channel_mix_defaults).filter(isPlain).map((row) => ({
    channel_key: text(row.channel_key) || 'owned',
    role: text(row.role),
    activities: text(row.activities),
    budget_pct: null,
    quality: 'assumed',
    source: `pack:${industry.key}`,
    generated_by: 'ai',
  }));

  const contentRows = arr(defaults.content_pillars).filter(isPlain).map((row) => ({
    name: text(row.name),
    purpose: text(row.purpose),
    examples: text(row.examples),
    quality: 'assumed',
    source: `pack:${industry.key}`,
    generated_by: 'ai',
  }));

  const campaignRows = input.campaignNames.map(text).filter(Boolean).map((name) => ({
    name,
    objective: null,
    quality: 'known',
    source: 'crm.campaign',
    generated_by: 'crm',
  }));

  const slaRows = arr(defaults.sla_defaults).filter(isPlain).map((row) => ({
    lead_type: text(row.lead_type) || 'hot',
    response_target: text(row.response_target),
    owner_role: text(row.owner_role),
    quality: 'assumed',
    source: `pack:${industry.key}`,
    generated_by: 'ai',
  }));

  const budgetLines = COST_GROUPS.map((cost_group) => ({
    cost_group,
    m1: null,
    m2: null,
    m3: null,
    quality: 'tbd',
    source: null,
    generated_by: 'ai',
  }));

  const calendar = Array.from({ length: 12 }, (_, index) => ({
    week: index + 1,
    focus: null,
    quality: 'tbd',
    generated_by: 'ai',
  }));

  const raciRows = RACI_WORKSTREAMS.map((workstream) => ({
    workstream,
    staff_id: null,
    quality: 'assumed',
    source: `pack:${industry.key}`,
    generated_by: 'ai',
  }));

  const riskRows = arr(defaults.risk_defaults).filter(isPlain).map((row) => ({
    risk: text(row.risk),
    early_signal: text(row.early_signal),
    mitigation: text(row.mitigation),
    quality: 'assumed',
    source: `pack:${industry.key}`,
    generated_by: 'ai',
  }));

  const roadmapPack = isPlain(defaults.roadmap_90d_skeleton) ? defaults.roadmap_90d_skeleton : {};
  const next: Record<string, unknown> = {
    ...base,
    schema_version: 1,
    industry_pack_key: industry.key,
    service_pack_key: serviceKey,
    template_version: 'strategy_template_v1',
    generated_at: new Date().toISOString(),
    generated_by: 'ai',
  };

  if (shouldWrite(base.north_star, mode)) next.north_star = northStar;
  if (shouldWrite(base.executive_summary, mode)) next.executive_summary = executive;
  if (shouldWrite(base.research, mode)) next.research = research;
  if (shouldWrite(base.positioning, mode)) next.positioning = positioning;
  next.icp_segments = mergeKeyed(base.icp_segments, icpRows, 'name', mode);
  next.journey = mergeKeyed(base.journey, journeyRows, 'stage', mode);
  next.offer_ladder = mergeKeyed(base.offer_ladder, offerRows, 'tier', mode);
  next.channel_mix = mergeKeyed(base.channel_mix, channelRows, 'channel_key', mode);
  next.content_pillars = mergeKeyed(base.content_pillars, contentRows, 'name', mode);
  next.campaign_table = mergeKeyed(base.campaign_table, campaignRows, 'name', mode);
  const ops = isPlain(base.ops_checklist) ? base.ops_checklist : { website: [], sla: [], livestream: [] };
  const websiteSkeleton = [
    { question: 'Website đã có form nhận lịch chưa?', quality: 'assumed', source: `pack:${industry.key}`, generated_by: 'ai' },
    { question: 'CRM đã gán người phụ trách lead chưa?', quality: 'assumed', source: `pack:${industry.key}`, generated_by: 'ai' },
  ];
  next.ops_checklist = {
    ...ops,
    website: arr(ops.website).length ? ops.website : websiteSkeleton,
    sla: mergeKeyed(ops.sla, slaRows, 'lead_type', mode),
  };
  const prevBudget = isPlain(base.budget_90d) ? base.budget_90d : {};
  next.budget_90d = {
    currency: prevBudget.currency ?? 'VND',
    months: Array.isArray(prevBudget.months) ? prevBudget.months : [],
    lines: mergeKeyed(prevBudget.lines, budgetLines, 'cost_group', mode),
  };
  if (shouldWrite(base.roadmap_90d, mode)) {
    next.roadmap_90d = {
      d1_30: asStrings(roadmapPack.d1_30),
      d31_60: asStrings(roadmapPack.d31_60),
      d61_90: asStrings(roadmapPack.d61_90),
      quality: 'assumed',
      source: `pack:${industry.key}`,
      generated_by: 'ai',
    };
  }
  next.calendar_12w = mergeKeyed(base.calendar_12w, calendar, 'week', mode);
  next.raci = mergeKeyed(base.raci, raciRows, 'workstream', mode);
  next.risks = mergeKeyed(base.risks, riskRows, 'risk', mode);
  if (emptyCell(base.finance_board)) {
    next.finance_board = [
      { group: 'revenue', metric_label: 'Doanh thu', baseline: null, target: null, quality: 'tbd', generated_by: 'ai' },
      { group: 'cost', metric_label: 'Chi phí', baseline: null, target: null, quality: 'tbd', generated_by: 'ai' },
    ];
  }
  if (emptyCell(base.approval_checklist)) {
    next.approval_checklist = approvalChecklist(next);
  }

  const coverage = { known: [] as string[], assumed: [] as string[], tbd: [] as string[] };
  const walk = (node: unknown, path: string) => {
    if (Array.isArray(node)) {
      node.forEach((item, index) => walk(item, `${path}[${index}]`));
      return;
    }
    if (!isPlain(node) || !node.quality) return;
    const bucket = node.quality === 'known' ? 'known' : node.quality === 'assumed' ? 'assumed' : 'tbd';
    coverage[bucket].push(path);
    for (const key of ['baseline', 'target', 'm1', 'm2', 'm3', 'budget_pct']) {
      if (key in node && node[key] == null) coverage.tbd.push(`${path}.${key}`);
    }
  };
  for (const key of ['north_star', 'executive_summary', 'research', 'positioning', 'icp_segments', 'journey', 'offer_ladder', 'channel_mix', 'content_pillars', 'campaign_table', 'budget_90d', 'calendar_12w', 'raci', 'risks', 'finance_board']) {
    walk(key === 'budget_90d' ? (next.budget_90d as { lines?: unknown }).lines : next[key], key === 'budget_90d' ? 'budget_90d.lines' : key);
  }

  const blocks = ['north_star', 'executive_summary', 'research', 'icp_segments', 'journey', 'positioning', 'offer_ladder', 'channel_mix', 'content_pillars', 'campaign_table', 'budget_90d', 'roadmap_90d', 'calendar_12w', 'raci', 'risks'].filter(
    (key) => JSON.stringify(base[key] ?? null) !== JSON.stringify(next[key] ?? null),
  );

  return {
    ok: true as const,
    phase: 'P11' as const,
    plan_id: input.planId,
    industry_pack_key: industry.key,
    service_pack_key: serviceKey,
    growth_sections: next,
    coverage,
    blocks_touched: blocks,
    warnings,
    links: [
      { rel: 'plan', href: `/crm/marketing-plan/${input.planId}` },
      ...(input.lifecycleId ? [{ rel: 'lifecycle', href: `/crm/service-lifecycle/${input.lifecycleId}` }] : []),
      ...(input.insight ? [{ rel: 'insight', href: `/crm/research/insights/${input.insight.id}` }] : []),
    ],
  };
}
