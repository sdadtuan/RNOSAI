/**
 * P11 export model. Fills growth_sections, then TMMT/Insight/Role KPI, then [[TBD]].
 * Never invents baseline, target, budget, CPL, or revenue.
 */

import { COST_GROUPS } from './growth-sections.util';

export const GROWTH_DOC_SECTIONS = [
  { id: 0, key: 'cover', title: '0. Bìa' },
  { id: 1, key: 'executive', title: '1. Tóm tắt điều hành' },
  { id: 2, key: 'research', title: '2. Nghiên cứu khách hàng' },
  { id: 3, key: 'icp', title: '3. Nhóm khách ưu tiên' },
  { id: 4, key: 'journey', title: '4. Hành trình khách hàng' },
  { id: 5, key: 'positioning', title: '5. Định vị và thông điệp' },
  { id: 6, key: 'offer', title: '6. Thang offer' },
  { id: 7, key: 'channel', title: '7. Kênh' },
  { id: 8, key: 'content', title: '8. Trụ nội dung' },
  { id: 9, key: 'campaign', title: '9. Bảng chiến dịch' },
  { id: 10, key: 'ops', title: '10. Vận hành' },
  { id: 11, key: 'retain', title: '11. Giữ chân khách' },
  { id: 12, key: 'budget', title: '12. Ngân sách 90 ngày' },
  { id: 13, key: 'roadmap', title: '13. Lộ trình 90 ngày' },
  { id: 14, key: 'calendar', title: '14. Lịch 12 tuần' },
  { id: 15, key: 'pack', title: '15. Ưu tiên theo ngành' },
  { id: 16, key: 'checklist', title: '16. Checklist phê duyệt' },
  { id: 17, key: 'finance', title: '17. Bảng tài chính' },
] as const;

const APPROVED = new Set(['approved', 'approved_internal', 'approved_client_facing', 'published']);
const KNOWN_TMMT = new Set(['assumed_confirmed', 'validated']);

export type ExportQuality = 'known' | 'assumed' | 'tbd';

export type GrowthExportInput = {
  planId: number;
  brandName: string | null;
  serviceType: string | null;
  periodLabel: string | null;
  planStatus: string | null;
  ownerName: string | null;
  geo: string | null;
  industryPackKey: string | null;
  industryPackName?: string | null;
  servicePackKey: string | null;
  packJourney: string | null;
  packPriorities: string | null;
  growthSections: unknown;
  includeEmptyTables: boolean;
  tmmt: Record<string, { text: string; status: string }>;
  insight: { id: number; status: string; statement: string; observation: string; interpretation: string } | null;
  roleKpi: { label: string; target: number | null; baseline: number | null; unit: string } | null;
  campaignNames: string[];
  measurementExists: boolean;
};

type Line = { path: string; quality: ExportQuality; text: string };

function isPlain(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function text(value: unknown): string {
  return String(value ?? '').trim();
}

/** Drop CRM dumps before any cell or token is written. */
export function sanitizeExportText(value: string): string {
  let out = String(value ?? '');
  const strips = [
    /Presales insight draft for[^.]{0,120}\.\s*/gi,
    /Core message:\s*/gi,
    /Sources?:\s*[^.]{0,180}(?:\.|$)/gi,
    /Status:\s*[^.]{0,80}(?:\.|$)/gi,
    /Geography resolved in\s*/gi,
    /Contract value\s*[\d.,]+\s*₫?\s*(?:\([^)]*\))?/gi,
    /media\/fee split unknown/gi,
    /\bChannel:\s*[A-Za-z][A-Za-z0-9 _-]*/gi,
    /TMMT(?:\s+[A-Za-z]+){0,4}\s*\d+\s*\/\s*\d+/gi,
    /Intake\/BANT\s*\d+\s*\/\s*\d+/gi,
    /\bBANT\s*\d+\s*\/\s*\d+/gi,
    /contract\s*#\d+/gi,
    /P11 verification/gi,
    /winning_plan_gate\w*/gi,
    /gate\s*=\s*\S+/gi,
    /\bOwner\/GM\s*·\s*/gi,
    /\bGo\b/g,
  ];
  for (const pattern of strips) out = out.replace(pattern, ' ');
  out = out.replace(/\s*·\s*(?:·\s*)+/g, ' · ');
  out = out.replace(/^(?:\s*·\s*)+|(?:\s*·\s*)+$/g, ' ');
  out = out.replace(/\s+/g, ' ').trim();
  if (/P11 verification|winning_plan_gate|gate\s*=|\bTMMT\b|\bBANT\b|Contract value|Geography resolved/i.test(out)) return '';
  if (/^[{\[]/.test(out) && /"[A-Za-z0-9_]+"\s*:/.test(out)) return '';
  return out;
}

function usableLabel(value: unknown): string | null {
  const clean = sanitizeExportText(text(value));
  if (!clean || /^[a-z0-9]+(?:[_-][a-z0-9]+)+$/.test(clean)) return null;
  return clean;
}

export function displayBrand(name: string | null): string | null {
  const raw = sanitizeExportText(text(name));
  if (!raw) return null;
  const head = raw.split(/\s+[—–]\s+|\s+-\s+Plan\b/i)[0]?.trim() ?? '';
  return head || null;
}

export function planStatusLabel(status: string | null): string | null {
  switch (text(status).toLowerCase()) {
    case 'draft':
    case 'new':
      return 'Dự thảo';
    case 'in_review':
    case 'review':
      return 'Đang xem xét';
    case 'approved':
      return 'Đã phê duyệt';
    case 'active':
    case 'implementing':
      return 'Đang triển khai';
    default:
      return null;
  }
}

export type GrowthTemplateFill = {
  versionLabel: string;
  issuedOn: string;
  brand: string | null;
  industry: string | null;
  geo: string | null;
  period: string | null;
  owner: string | null;
  statusLabel: string | null;
  tokens: Record<string, string>;
  goals: Array<{ row: string; baseline: string; target: string }>;
  icp: string[];
  journeyNotes: string[];
  offers: Array<{ row: string; example: string }>;
  positioning: { benefit: string; difference: string; proof: string; promise: string };
  campaigns: string[];
  calendar: Record<string, string>;
  budget: Array<{ row: string; m1: string; m2: string; m3: string }>;
  risks: string[];
  retain: string[];
  pack: { industry: string; journey: string; priorities: string } | null;
  checklist: boolean[];
};

function arr(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isPlain) : [];
}

function token(name: string): string {
  return `[[${name}]]`;
}

function paint(value: unknown, quality: ExportQuality, placeholder: string): string {
  const body = sanitizeExportText(text(value));
  if (!body) return placeholder;
  if (quality === 'assumed') return `[Assumed] ${body}`;
  if (quality === 'tbd') return placeholder;
  return body;
}

function knownNumber(value: unknown, quality: unknown): string | null {
  if (quality !== 'known' || typeof value !== 'number' || !Number.isFinite(value)) return null;
  return String(value);
}

function fieldQuality(row: Record<string, unknown> | null, fallback: ExportQuality): ExportQuality {
  const quality = String(row?.quality ?? '');
  if (quality === 'known' || quality === 'assumed' || quality === 'tbd') return quality;
  return fallback;
}

export function buildGrowthExportModel(input: GrowthExportInput) {
  const warnings: string[] = [];
  const sectionsJson = isPlain(input.growthSections) ? input.growthSections : null;
  if (!sectionsJson) warnings.push('growth_sections_empty');
  const growth = sectionsJson ?? {};
  if (!input.insight) warnings.push('insight_missing');
  else if (!APPROVED.has(input.insight.status)) warnings.push('insight_not_approved');
  if (!input.campaignNames.length && arr(growth.campaign_table).length === 0) warnings.push('hub_campaign_map_empty');

  const tmmt = (key: string) => {
    const row = input.tmmt[key];
    const value = text(row?.text);
    const known = Boolean(value) && KNOWN_TMMT.has(String(row?.status ?? ''));
    return { text: value, quality: (known ? 'known' : value ? 'assumed' : 'tbd') as ExportQuality };
  };

  const star = isPlain(growth.north_star) ? growth.north_star : {};
  const kpi = input.roleKpi;
  const starLabel = text(star.label) || text(kpi?.label);
  const starQuality = text(star.label)
    ? fieldQuality(star, 'tbd')
    : kpi?.label
      ? 'known'
      : 'tbd';
  const starTarget =
    typeof star.target === 'number'
      ? star.target
      : star.target == null && kpi?.target != null
        ? kpi.target
        : null;
  const starBaseline =
    typeof star.baseline === 'number'
      ? star.baseline
      : star.baseline == null && kpi?.baseline != null
        ? kpi.baseline
        : null;
  const targetKnown = knownNumber(starTarget, starQuality === 'known' || (star.target == null && kpi?.target != null) ? 'known' : starQuality);
  const baselineKnown = knownNumber(
    starBaseline,
    starQuality === 'known' || (star.baseline == null && kpi?.baseline != null) ? 'known' : starQuality,
  );
  if (targetKnown == null) warnings.push('north_star_target_missing');

  const executive = isPlain(growth.executive_summary) ? growth.executive_summary : {};
  const market = tmmt('market_context');
  const context = text(executive.context) || market.text;
  const contextQuality = text(executive.context) ? fieldQuality(executive, 'tbd') : market.quality;

  const research = isPlain(growth.research) ? growth.research : {};
  const pains = tmmt('pains_desired_outcomes');
  const insightApproved = Boolean(input.insight && APPROVED.has(input.insight.status));
  const insightText = input.insight
    ? [input.insight.statement, input.insight.interpretation].map(text).filter(Boolean).join(' — ')
    : '';
  const customerInsight = text(research.customer_insight) || (insightApproved ? insightText : '') || pains.text;
  const customerQuality = text(research.customer_insight)
    ? fieldQuality(research, 'tbd')
    : insightApproved && insightText
      ? 'known'
      : pains.quality;

  const positioning = isPlain(growth.positioning) ? growth.positioning : {};
  const statement = text(positioning.statement) || text(input.insight?.statement);
  const statementQuality = text(positioning.statement)
    ? fieldQuality(positioning, 'tbd')
    : insightApproved && text(input.insight?.statement)
      ? 'known'
      : text(input.insight?.statement)
        ? 'assumed'
        : 'tbd';
  const proofs = Array.isArray(positioning.proofs)
    ? positioning.proofs.map((item) => text(item)).filter(Boolean)
    : text(input.insight?.observation)
      ? [text(input.insight?.observation)]
      : [];
  const proofQuality = Array.isArray(positioning.proofs) && proofs.length ? fieldQuality(positioning, 'assumed') : insightApproved ? 'known' : 'tbd';

  const icpRows = arr(growth.icp_segments);
  const icpTmmt = tmmt('segmentation_icp');
  const journeyRows = arr(growth.journey);
  const offerRows = arr(growth.offer_ladder);
  const channelRows = arr(growth.channel_mix);
  const contentRows = arr(growth.content_pillars);
  const campaignRows = arr(growth.campaign_table);
  const retainRows = arr(growth.retain_journeys);
  const riskRows = arr(growth.risks);
  const financeRows = arr(growth.finance_board);
  const raciRows = arr(growth.raci);
  const calendarRows = arr(growth.calendar_12w);
  const roadmap = isPlain(growth.roadmap_90d) ? growth.roadmap_90d : {};
  const budget = isPlain(growth.budget_90d) ? growth.budget_90d : {};
  const budgetLines = arr(budget.lines);
  const ops = isPlain(growth.ops_checklist) ? growth.ops_checklist : {};

  const buckets: Record<ExportQuality, string[]> = { known: [], assumed: [], tbd: [] };
  const grouped = new Map<string, Line[]>();
  const push = (section: string, path: string, quality: ExportQuality, body: string) => {
    const line: Line = { path, quality, text: body };
    buckets[quality].push(path);
    const list = grouped.get(section) ?? [];
    list.push(line);
    grouped.set(section, list);
  };

  const brandClean = displayBrand(input.brandName);
  const brand = paint(brandClean, brandClean ? 'known' : 'tbd', token('TÊN_THƯƠNG_HIỆU'));
  push('cover', 'cover.brand', brandClean ? 'known' : 'tbd', `Thương hiệu: ${brand}`);
  push('cover', 'cover.client', brandClean ? 'known' : 'tbd', `Khách hàng: ${brand}`);
  push('cover', 'cover.geo', input.geo ? 'known' : 'tbd', `Thị trường: ${paint(input.geo, input.geo ? 'known' : 'tbd', token('TBD'))}`);
  push('cover', 'cover.period', input.periodLabel ? 'known' : 'tbd', `Kỳ: ${paint(input.periodLabel, input.periodLabel ? 'known' : 'tbd', token('TBD'))}`);
  const statusLabel = planStatusLabel(input.planStatus);
  push('cover', 'cover.status', statusLabel ? 'known' : 'tbd', `Trạng thái: ${paint(statusLabel, statusLabel ? 'known' : 'tbd', token('TBD'))}`);
  push('cover', 'cover.owner', input.ownerName ? 'known' : 'tbd', `AM: ${paint(input.ownerName, input.ownerName ? 'known' : 'tbd', token('TBD'))}`);
  push(
    'cover',
    'cover.pack',
    input.industryPackKey ? 'known' : 'tbd',
    `Pack: ${paint(input.industryPackKey, input.industryPackKey ? 'known' : 'tbd', token('TBD'))}`,
  );

  push('executive', 'executive_summary.context', contextQuality, paint(context, contextQuality, token('TBD')));
  const problems = Array.isArray(executive.problems) ? executive.problems.map((item) => text(item)).filter(Boolean) : [];
  if (problems.length) {
    problems.forEach((item, index) =>
      push('executive', `executive_summary.problems[${index}]`, fieldQuality(executive, 'assumed'), paint(item, fieldQuality(executive, 'assumed'), token('TBD'))),
    );
  } else push('executive', 'executive_summary.problems', 'tbd', token('TBD'));

  push(
    'executive',
    'north_star.label',
    starLabel ? starQuality : 'tbd',
    `Chỉ số: ${paint(starLabel, starLabel ? starQuality : 'tbd', token('CHỈ_SỐ_QUAN_TRỌNG_NHẤT'))}`,
  );
  push(
    'executive',
    'north_star.target',
    targetKnown ? 'known' : 'tbd',
    `Mục tiêu: ${targetKnown ?? token('CHỈ_SỐ_QUAN_TRỌNG_NHẤT')}`,
  );
  push(
    'executive',
    'north_star.baseline',
    baselineKnown ? 'known' : 'tbd',
    `Hiện tại: ${baselineKnown ?? token('TBD')}`,
  );
  const kpiTree = arr(growth.kpi_tree);
  if (kpiTree.length) {
    kpiTree.forEach((row, index) =>
      push('executive', `kpi_tree[${index}].label`, fieldQuality(row, 'tbd'), paint(row.label, fieldQuality(row, 'tbd'), token('CHỈ_SỐ_HỖ_TRỢ'))),
    );
  } else push('executive', 'kpi_tree', 'tbd', token('CHỈ_SỐ_HỖ_TRỢ'));

  push('research', 'research.customer_insight', customerQuality, paint(customerInsight, customerQuality, token('NỖI_ĐAU_KHÁCH')));
  push('research', 'research.data', customerQuality === 'tbd' ? 'tbd' : customerQuality, paint(customerInsight, customerQuality, token('DỮ_LIỆU_KHÁCH')));
  const competitors = arr(research.competitors);
  if (competitors.length) {
    competitors.forEach((row, index) =>
      push('research', `research.competitors[${index}]`, fieldQuality(research, 'assumed'), paint(row.name ?? row.note, fieldQuality(research, 'assumed'), token('TBD'))),
    );
  } else push('research', 'research.competitors', 'tbd', token('TBD'));

  if (icpRows.length) {
    icpRows.forEach((row, index) =>
      push('icp', `icp_segments[${index}].name`, fieldQuality(row, 'assumed'), paint(row.name, fieldQuality(row, 'assumed'), token('NHÓM_KHÁCH_HÀNG_MỤC_TIÊU'))),
    );
  } else {
    push('icp', 'icp_segments', icpTmmt.quality, paint(icpTmmt.text, icpTmmt.quality, token('NHÓM_KHÁCH_HÀNG_MỤC_TIÊU')));
  }

  if (journeyRows.length) {
    journeyRows.forEach((row, index) =>
      push('journey', `journey[${index}].stage`, fieldQuality(row, 'assumed'), paint(`${text(row.stage)} — ${text(row.customer_thinks)}`, fieldQuality(row, 'assumed'), token('TBD'))),
    );
  } else push('journey', 'journey', 'tbd', token('TBD'));

  const serviceLabel = usableLabel(input.serviceType);
  push('positioning', 'positioning.service', serviceLabel ? 'known' : 'tbd', `Dịch vụ: ${paint(serviceLabel, serviceLabel ? 'known' : 'tbd', token('LOẠI_SẢN_PHẨM/DỊCH_VỤ'))}`);
  push('positioning', 'positioning.statement', statementQuality, paint(statement, statementQuality, token('LỢI_ÍCH_CHÍNH')));
  push('positioning', 'positioning.difference', statementQuality, paint(statement, statementQuality, token('ĐIỂM_KHÁC_BIỆT')));
  push('positioning', 'positioning.primary_message', text(positioning.primary_message) ? statementQuality : 'tbd', paint(positioning.primary_message, text(positioning.primary_message) ? statementQuality : 'tbd', token('THÔNG_ĐIỆP_CHÍNH')));
  for (let index = 0; index < 3; index += 1) {
    const proof = proofs[index] ?? '';
    push('positioning', `positioning.proofs[${index}]`, proof ? proofQuality : 'tbd', paint(proof, proof ? proofQuality : 'tbd', token(`BẰNG_CHỨNG_${index + 1}`)));
  }
  push('positioning', 'positioning.cta', text(positioning.cta) ? fieldQuality(positioning, 'assumed') : 'tbd', paint(positioning.cta, text(positioning.cta) ? fieldQuality(positioning, 'assumed') : 'tbd', token('LỜI_KÊU_GỌI')));

  if (offerRows.length) {
    offerRows.forEach((row, index) =>
      push('offer', `offer_ladder[${index}].tier`, fieldQuality(row, 'assumed'), paint(`${text(row.tier)}: ${text(row.example) || text(row.goal)}`, fieldQuality(row, 'assumed'), token('TBD'))),
    );
  } else push('offer', 'offer_ladder', 'tbd', token('TBD'));

  if (channelRows.length) {
    channelRows.forEach((row, index) => {
      const quality = fieldQuality(row, 'assumed');
      const pct = knownNumber(row.budget_pct, quality) ?? token('TBD');
      push('channel', `channel_mix[${index}].budget_pct`, knownNumber(row.budget_pct, quality) ? 'known' : 'tbd', `${text(row.channel_key) || token('TBD')} — ${pct}`);
    });
  } else push('channel', 'channel_mix', 'tbd', token('TBD'));

  if (contentRows.length) {
    contentRows.forEach((row, index) =>
      push('content', `content_pillars[${index}].name`, fieldQuality(row, 'assumed'), paint(row.name, fieldQuality(row, 'assumed'), token('TBD'))),
    );
  } else push('content', 'content_pillars', 'tbd', token('TBD'));

  const campaignSource = campaignRows.length
    ? campaignRows.map((row) => ({ name: text(row.name), quality: fieldQuality(row, 'known') }))
    : input.campaignNames.map((name) => ({ name, quality: 'known' as ExportQuality }));
  if (campaignSource.length) {
    campaignSource.forEach((row, index) => push('campaign', `campaign_table[${index}].name`, row.quality, paint(row.name, row.quality, token('TBD'))));
  } else push('campaign', 'campaign_table', 'tbd', token('TBD'));

  const sla = arr(ops.sla);
  if (sla.length) {
    sla.forEach((row, index) =>
      push('ops', `ops_checklist.sla[${index}]`, fieldQuality(row, 'assumed'), paint(`${text(row.lead_type)}: ${text(row.response_target)}`, fieldQuality(row, 'assumed'), token('TBD'))),
    );
  } else push('ops', 'ops_checklist', 'tbd', token('TBD'));

  if (retainRows.length) {
    retainRows.forEach((row, index) =>
      push('retain', `retain_journeys[${index}]`, fieldQuality(row, 'assumed'), paint(row.name ?? row.stage, fieldQuality(row, 'assumed'), token('TBD'))),
    );
  } else push('retain', 'retain_journeys', 'tbd', token('TBD'));

  const linesForBudget = budgetLines.length
    ? budgetLines
    : input.includeEmptyTables
      ? COST_GROUPS.map((cost_group) => ({ cost_group, m1: null, m2: null, m3: null, quality: 'tbd' }))
      : [];
  if (!linesForBudget.some((row) => ['m1', 'm2', 'm3'].some((key) => typeof row[key] === 'number'))) warnings.push('budget_90d_empty');
  if (linesForBudget.length) {
    linesForBudget.forEach((row, index) => {
      const quality = fieldQuality(row, 'tbd');
      const cells = ['m1', 'm2', 'm3'].map((key) => knownNumber(row[key], quality) ?? token('TBD')).join(' / ');
      push('budget', `budget_90d.lines[${index}]`, quality === 'known' && cells.includes('[[') ? 'tbd' : quality, `${text(row.cost_group)}: ${cells}`);
    });
  } else push('budget', 'budget_90d.lines', 'tbd', token('TBD'));

  const phases: Array<[string, unknown]> = [
    ['d1_30', roadmap.d1_30],
    ['d31_60', roadmap.d31_60],
    ['d61_90', roadmap.d61_90],
  ];
  const roadmapQuality = fieldQuality(roadmap, 'assumed');
  let roadmapPrinted = false;
  for (const [key, value] of phases) {
    const items = Array.isArray(value) ? value.map((item) => text(item)).filter(Boolean) : [];
    if (!items.length) continue;
    roadmapPrinted = true;
    push('roadmap', `roadmap_90d.${key}`, roadmapQuality, paint(items.join('; '), roadmapQuality, token('TBD')));
  }
  if (!roadmapPrinted) push('roadmap', 'roadmap_90d', 'tbd', token('TBD'));

  const weeks = input.includeEmptyTables ? Array.from({ length: 12 }, (_, index) => index + 1) : calendarRows.map((row) => Number(row.week)).filter((week) => week >= 1);
  if (!weeks.length) push('calendar', 'calendar_12w', 'tbd', token('TBD'));
  for (const week of weeks) {
    const row = calendarRows.find((item) => Number(item.week) === week) ?? null;
    const focus = text(row?.focus);
    const quality = focus ? fieldQuality(row, 'tbd') : 'tbd';
    push('calendar', `calendar_12w[${week}].focus`, quality, `Tuần ${week}: ${paint(focus, quality, token('TBD'))}`);
  }

  push('pack', 'pack.key', input.industryPackKey ? 'known' : 'tbd', `Ngành: ${paint(input.industryPackKey, input.industryPackKey ? 'known' : 'tbd', token('TBD'))}`);
  push('pack', 'pack.journey_focus', input.packJourney ? 'assumed' : 'tbd', paint(input.packJourney, input.packJourney ? 'assumed' : 'tbd', token('TBD')));
  push('pack', 'pack.marketing_priorities', input.packPriorities ? 'assumed' : 'tbd', paint(input.packPriorities, input.packPriorities ? 'assumed' : 'tbd', token('TBD')));

  const offerReady = offerRows.some((row) => text(row.example) || text(row.goal) || text(row.tier));
  const budgetKnown = budgetLines.some(
    (row) => row.quality === 'known' && ['m1', 'm2', 'm3'].some((key) => typeof row[key] === 'number'),
  );
  const checklist: Array<{ item: string; checked: boolean }> = [
    { item: 'Mục tiêu + North Star rõ', checked: Boolean(starLabel) && (Boolean(targetKnown) || star.human_checked === true) },
    { item: 'Có dữ liệu hiện tại', checked: Boolean(baselineKnown) || input.measurementExists },
    { item: 'Chọn nhóm khách ưu tiên', checked: icpRows.length > 0 || Boolean(icpTmmt.text) },
    { item: 'Nhận định có chứng minh hoặc ghi Assumed', checked: Boolean(customerInsight) },
    { item: 'Message + offer duyệt', checked: statementQuality === 'known' && offerReady },
    { item: 'Web/CRM/sales sẵn sàng', checked: ops.human_confirmed === true },
    { item: 'Theo dõi nguồn/campaign', checked: campaignSource.length > 0 },
    { item: 'NS + người PT + duyệt', checked: budgetKnown || raciRows.some((row) => row.staff_id != null) },
    { item: 'Giữ khách', checked: retainRows.length > 0 },
    { item: 'Rủi ro', checked: riskRows.length > 0 },
    { item: 'Lịch họp/báo cáo', checked: calendarRows.length > 0 || roadmapPrinted },
  ];
  checklist.forEach((item, index) =>
    push('checklist', `approval_checklist[${index}]`, item.checked ? 'known' : 'tbd', `${item.checked ? '[x]' : '[ ]'} ${item.item}`),
  );

  if (financeRows.length) {
    financeRows.forEach((row, index) => {
      const quality = fieldQuality(row, 'tbd');
      const amount = knownNumber(row.target, quality) ?? token('TBD');
      push('finance', `finance_board[${index}].target`, knownNumber(row.target, quality) ? 'known' : 'tbd', `${text(row.metric_label)}: ${amount}`);
    });
  } else push('finance', 'finance_board', 'tbd', token('TBD'));

  const industryLabel = sanitizeExportText(text(input.industryPackName) || text(input.industryPackKey));
  const goalRow = goalRowForLabel(starLabel);
  const goals =
    goalRow && (baselineKnown || targetKnown)
      ? [{ row: goalRow, baseline: baselineKnown ?? '', target: targetKnown ?? '' }]
      : [];
  const offerMap: Record<string, string> = {
    free: 'Giá trị miễn phí',
    lead: 'Giá trị miễn phí',
    trial: 'Ưu đãi lần đầu',
    first: 'Ưu đãi lần đầu',
    core: 'Gói chính',
    main: 'Gói chính',
    upsell: 'Mua thêm',
    retain: 'Khách quay lại',
    referral: 'Giới thiệu',
  };
  const budgetMap: Record<string, string> = {
    research: 'Nghiên cứu và chiến lược',
    content_prod: 'Nội dung và sản xuất',
    ads: 'Quảng cáo',
    kol: 'KOL/KOC/đối tác',
    web_seo: 'Website/SEO/tối ưu',
    crm: 'CRM/chăm sóc khách',
    tech_ai: 'Công nghệ/dữ liệu/AI',
    contingency: 'Dự phòng/thử nghiệm',
  };
  const journeyStages = ['Biết đến', 'Quan tâm', 'Ra quyết định', 'Trải nghiệm', 'Quay lại', 'Giới thiệu'];
  const filledOrEmpty = (value: string, placeholder: string) => (value.startsWith('[[') ? '' : value || placeholder);
  const starText = starLabel
    ? [paint(starLabel, starQuality, ''), targetKnown ?? ''].filter(Boolean).join(' — ')
    : '';
  const supportText = kpiTree
    .map((row) => paint(row.label, fieldQuality(row, 'tbd'), ''))
    .filter((item) => item && !item.startsWith('[['))
    .join('; ');
  const proofText = proofs
    .map((item) => paint(item, proofQuality, ''))
    .filter((item) => item && !item.startsWith('[['))
    .join('; ');
  const painText = paint(customerInsight, customerQuality, token('NỖI_ĐAU_HOẶC_MÂU_THUẪN'));
  const benefitText = paint(statement, statementQuality, token('LỢI_ÍCH_CHÍNH'));
  const sameBlob = (left: string, right: string) => {
    const norm = (value: string) => value.replace(/^\[Assumed\]\s*/, '').trim();
    return Boolean(norm(left)) && norm(left) === norm(right);
  };
  const tokens: Record<string, string> = {
    TÊN_THƯƠNG_HIỆU: brand,
    'CHỈ_SỐ_QUAN_TRỌNG_NHẤT': starText || token('CHỈ_SỐ_QUAN_TRỌNG_NHẤT'),
    'CHỈ_SỐ_HỖ_TRỢ': supportText || token('CHỈ_SỐ_HỖ_TRỢ'),
    'DỮ_LIỆU_HOẶC_HÀNH_VI_QUAN_SÁT': token('DỮ_LIỆU_HOẶC_HÀNH_VI_QUAN_SÁT'),
    'NỖI_ĐAU_HOẶC_MÂU_THUẪN': painText,
    'ĐỘNG_CƠ_SÂU_XA': paint(input.insight?.interpretation, customerQuality, token('ĐỘNG_CƠ_SÂU_XA')),
    'HÀNH_ĐỘNG_CỤ_THỂ': paint(positioning.cta, text(positioning.cta) ? fieldQuality(positioning, 'assumed') : 'tbd', token('HÀNH_ĐỘNG_CỤ_THỂ')),
    'NHÓM_KHÁCH_HÀNG_MỤC_TIÊU': icpRows.length
      ? paint(icpRows[0]?.name, fieldQuality(icpRows[0] ?? null, 'assumed'), token('NHÓM_KHÁCH_HÀNG_MỤC_TIÊU'))
      : paint(icpTmmt.text, icpTmmt.quality, token('NHÓM_KHÁCH_HÀNG_MỤC_TIÊU')),
    'LOẠI_SẢN_PHẨM/DỊCH_VỤ': paint(serviceLabel, serviceLabel ? 'known' : 'tbd', token('LOẠI_SẢN_PHẨM/DỊCH_VỤ')),
    'LỢI_ÍCH_CHÍNH': sameBlob(benefitText, painText) ? token('LỢI_ÍCH_CHÍNH') : benefitText,
    'ĐIỂM_KHÁC_BIỆT': token('ĐIỂM_KHÁC_BIỆT'),
    'BẰNG_CHỨNG': proofText || token('BẰNG_CHỨNG'),
    'THÔNG_ĐIỆP_CHÍNH': paint(positioning.primary_message, text(positioning.primary_message) ? statementQuality : 'tbd', token('THÔNG_ĐIỆP_CHÍNH')),
    'LỜI_KÊU_GỌI': paint(positioning.cta, text(positioning.cta) ? fieldQuality(positioning, 'assumed') : 'tbd', token('LỜI_KÊU_GỌI')),
  };
  proofs.forEach((item, index) => {
    tokens[`BẰNG_CHỨNG_${index + 1}`] = paint(item, item ? proofQuality : 'tbd', token(`BẰNG_CHỨNG_${index + 1}`));
  });
  const templateFill: Omit<GrowthTemplateFill, 'versionLabel' | 'issuedOn'> = {
    brand: brandClean,
    industry: industryLabel || null,
    geo: text(input.geo) ? paint(input.geo, 'known', '') : null,
    period: text(input.periodLabel) ? paint(input.periodLabel, 'known', '') : null,
    owner: text(input.ownerName) ? paint(input.ownerName, 'known', '') : null,
    statusLabel,
    tokens,
    goals,
    icp: icpRows
      .map((row) => paint(row.name, fieldQuality(row, 'assumed'), ''))
      .filter((item) => item && !item.startsWith('[['))
      .slice(0, 3),
    journeyNotes: journeyRows
      .map((row) => paint(row.customer_thinks ?? row.stage, fieldQuality(row, 'assumed'), ''))
      .filter((item) => item && !item.startsWith('[['))
      .slice(0, journeyStages.length),
    offers: offerRows
      .map((row) => {
        const tier = text(row.tier).toLowerCase();
        const rowLabel = offerMap[tier];
        const example = paint(text(row.example) || text(row.goal), fieldQuality(row, 'assumed'), '');
        if (!rowLabel || !example || example.startsWith('[[')) return null;
        return { row: rowLabel, example };
      })
      .filter((row): row is { row: string; example: string } => row != null),
    positioning: {
      benefit: sameBlob(benefitText, painText) ? '' : filledOrEmpty(benefitText, ''),
      difference: '',
      proof: proofText,
      promise: filledOrEmpty(paint(positioning.primary_message, text(positioning.primary_message) ? statementQuality : 'tbd', ''), ''),
    },
    campaigns: campaignSource
      .filter((row) => row.quality === 'known')
      .map((row) => paint(row.name, 'known', ''))
      .filter((item) => item && !item.startsWith('[[')),
    calendar: Object.fromEntries(
      calendarRows
        .map((row) => {
          const focus = text(row.focus);
          if (!focus || fieldQuality(row, 'tbd') === 'tbd') return null;
          const painted = paint(focus, fieldQuality(row, 'tbd'), '');
          if (!painted || painted.startsWith('[[')) return null;
          return [String(row.week), painted] as const;
        })
        .filter((row): row is readonly [string, string] => row != null),
    ),
    budget: budgetLines
      .map((row) => {
        const quality = fieldQuality(row, 'tbd');
        const label = budgetMap[text(row.cost_group)] ?? '';
        const m1 = knownNumber(row.m1, quality) ?? '';
        const m2 = knownNumber(row.m2, quality) ?? '';
        const m3 = knownNumber(row.m3, quality) ?? '';
        if (!label || (!m1 && !m2 && !m3)) return null;
        return { row: label, m1, m2, m3 };
      })
      .filter((row): row is { row: string; m1: string; m2: string; m3: string } => row != null),
    risks: riskRows
      .map((row) => paint(row.risk, fieldQuality(row, 'assumed'), ''))
      .filter((item) => item && !item.startsWith('[['))
      .slice(0, 7),
    retain: retainRows
      .map((row) => paint(row.name ?? row.stage, fieldQuality(row, 'assumed'), ''))
      .filter((item) => item && !item.startsWith('[['))
      .slice(0, 6),
    pack: industryLabel
      ? {
          industry: industryLabel,
          journey: input.packJourney ? paint(input.packJourney, 'assumed', '') : '',
          priorities: input.packPriorities ? paint(input.packPriorities, 'assumed', '') : '',
        }
      : null,
    checklist: checklist.map((item) => item.checked),
  };
  const missingForOps: string[] = [];
  if (!baselineKnown) missingForOps.push('north_star.baseline');
  if (!targetKnown) missingForOps.push('north_star.target');
  const everyM1 = budgetLines.length > 0 && budgetLines.every((row) => knownNumber(row.m1, fieldQuality(row, 'tbd')));
  if (!everyM1) missingForOps.push('budget_90d.lines[*].m1');
  const everyPct = channelRows.length > 0 && channelRows.every((row) => knownNumber(row.budget_pct, fieldQuality(row, 'tbd')));
  if (!everyPct) missingForOps.push('channel_mix[*].budget_pct');
  if (!campaignSource.some((row) => row.quality === 'known' && text(row.name))) missingForOps.push('campaign_table');
  if (!calendarRows.some((row) => text(row.focus) && fieldQuality(row, 'tbd') === 'known')) missingForOps.push('calendar_12w[*].focus');
  if (!retainRows.some((row) => fieldQuality(row, 'assumed') === 'known' && text(row.name ?? row.stage))) missingForOps.push('retain_journeys');

  const rendered = GROWTH_DOC_SECTIONS.map((section) => {
    const lines = grouped.get(section.key) ?? [];
    const filled = lines.filter((line) => line.quality !== 'tbd').length;
    return {
      id: section.id,
      title: section.title,
      fill_pct: lines.length ? Math.round((filled / lines.length) * 100) : 0,
      missing: lines.filter((line) => line.quality === 'tbd').map((line) => line.path),
      lines: lines.map((line) => line.text),
    };
  });

  return {
    ok: true as const,
    phase: 'P11' as const,
    plan_id: input.planId,
    industry_pack_key: input.industryPackKey,
    service_pack_key: input.servicePackKey,
    template_version: 'strategy_template_v1' as const,
    coverage: buckets,
    sections: rendered,
    checklist,
    warnings,
    missing_for_ops: missingForOps,
    deploy_ready: missingForOps.length === 0,
    template_fill: templateFill,
  };
}

function goalRowForLabel(label: string): string | null {
  const key = label.toLowerCase();
  if (/doanh thu|revenue/.test(key)) return 'Doanh thu / tổng giá trị bán hàng';
  if (/tiềm năng|booking|lead|đặt lịch/.test(key)) return 'Khách hàng tiềm năng đủ điều kiện';
  if (/quay lại|tái mua/.test(key)) return 'Tỷ lệ khách quay lại';
  if (/cpl|chi phí để có/.test(key)) return 'Chi phí để có một khách hàng mới';
  return null;
}
