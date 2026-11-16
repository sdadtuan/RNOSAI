/** Sales Discovery brief ? option lists are easy to edit in the constants below. */

export type BudgetAuthority = 'direct' | 'needs_approval' | 'unknown';
export type LeadTemperature = 'hot' | 'warm' | 'cold';

export interface DiscoveryOption {
  value: string;
  label: string;
}

export interface SalesDiscoveryBrief {
  company_name: string;
  industry: string;
  flagship_product: string;
  websites: string;
  contact_name: string;
  phone: string;
  email: string;
  job_title: string;
  budget_authority: BudgetAuthority | '';
  services: string[];
  biggest_problem: string;
  marketing_goal: string;
  priority_product: string;
  target_customers: string;
  region: string;
  channels: string[];
  current_results: string;
  difficulties: string;
  budget_band: string;
  timeline_band: string;
  call_notes: string;
  temperature: LeadTemperature | '';
}

/** Edit these lists to change dropdowns in the Sales Discovery wizard. */
export const DISCOVERY_BUDGET_OPTIONS: DiscoveryOption[] = [
  { value: 'under_10', label: 'Dưới 10 triệu/tháng' },
  { value: '10_30', label: '10–30 triệu/tháng' },
  { value: '30_50', label: '30–50 triệu/tháng' },
  { value: '50_100', label: '50–100 triệu/tháng' },
  { value: 'over_100', label: 'Trên 100 triệu/tháng' },
  { value: 'unknown', label: 'Chưa xác định' },
];

export const DISCOVERY_TIMELINE_OPTIONS: DiscoveryOption[] = [
  { value: 'this_month', label: 'Ngay trong tháng' },
  { value: '1_3', label: '1–3 tháng' },
  { value: '3_6', label: '3–6 tháng' },
  { value: 'unknown', label: 'Chưa xác định' },
];

export const DISCOVERY_CHANNEL_OPTIONS: DiscoveryOption[] = [
  { value: 'facebook', label: 'Facebook' },
  { value: 'google', label: 'Google' },
  { value: 'website', label: 'Website' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'none', label: 'Chưa triển khai' },
];

export const DISCOVERY_AUTHORITY_OPTIONS: Array<{ value: BudgetAuthority; label: string }> = [
  { value: 'direct', label: 'Trực tiếp quyết định' },
  { value: 'needs_approval', label: 'Cần cấp trên phê duyệt' },
  { value: 'unknown', label: 'Chưa xác định' },
];

export const DISCOVERY_TEMPERATURE_OPTIONS: Array<{ value: LeadTemperature; label: string }> = [
  { value: 'hot', label: 'Hot – Muốn triển khai sớm' },
  { value: 'warm', label: 'Warm – Đang cân nhắc' },
  { value: 'cold', label: 'Cold – Chỉ tìm hiểu' },
];

export const DISCOVERY_INDUSTRY_FALLBACK: DiscoveryOption[] = [
  { value: 'spa', label: 'Spa / Làm đẹp' },
  { value: 'bds', label: 'Bất động sản' },
  { value: 'edu', label: 'Giáo dục' },
  { value: 'healthcare', label: 'Y tế / Healthcare' },
  { value: 'fnb', label: 'F&B / Nhà hàng' },
  { value: 'agency', label: 'Agency / Marketing' },
  { value: 'other', label: 'Khác' },
];

export const DISCOVERY_JOB_TITLE_FALLBACK: DiscoveryOption[] = [
  { value: 'owner', label: 'Chủ DN / Owner' },
  { value: 'mkt_director', label: 'Giám đốc Marketing' },
  { value: 'sales_director', label: 'Giám đốc Kinh doanh' },
  { value: 'hr_manager', label: 'Trưởng phòng Nhân sự' },
  { value: 'mkt_manager', label: 'Trưởng phòng Marketing' },
  { value: 'other', label: 'Khác' },
];

/** Main groups (picker headings) and catalog slugs (sub-services with +). Easy to edit. */
export const DISCOVERY_SERVICE_GROUPS: Array<{ key: string; title: string; slugs: string[] }> = [
  {
    key: 'brand',
    title: 'Truyền thông thương hiệu',
    slugs: ['nhan-dien-thuong-hieu', 'tiep-thi-noi-dung', 'thiet-ke-landing-page'],
  },
  {
    key: 'acquire',
    title: 'Thu hút khách hàng tiềm năng',
    slugs: ['quang-cao-facebook', 'dich-vu-seo-tong-the', 'lead-gen', 'van-hanh-tmdt', 'media-planning-ooh'],
  },
  {
    key: 'nurture',
    title: 'Nuôi dưỡng & Tạo chuyển đổi',
    slugs: [
      'nuoi-duong-khach-hang',
      'marketing-automation-nurture',
      'marketing-automation-setup',
      'thiet-lap-crm',
      'email-sms-zalo-marketing',
    ],
  },
  {
    key: 'ai',
    title: 'AI System & Intelligence',
    slugs: ['ai-chatbot-ban-hang', 'ai-system-intelligence', 'dashboard-bao-cao-ai', 'phan-tich-thi-truong'],
  },
  {
    key: 'produce',
    title: 'PR, sản xuất & activation',
    slugs: [
      'pr-booking-bao-chi',
      'san-xuat-video-tvc',
      'kol-koc-booking',
      'su-kien-activation-btl',
      'trade-marketing-posm',
    ],
  },
];

export const DISCOVERY_BRIEF_KEY = 'discovery_brief';

export type DiscoveryRequiredKey = keyof SalesDiscoveryBrief;

/** The 14 required checklist keys (subset of the brief). */
export type DiscoveryChecklistKey = Extract<
  DiscoveryRequiredKey,
  | 'company_name'
  | 'industry'
  | 'flagship_product'
  | 'contact_name'
  | 'phone'
  | 'services'
  | 'biggest_problem'
  | 'marketing_goal'
  | 'target_customers'
  | 'region'
  | 'channels'
  | 'budget_band'
  | 'timeline_band'
  | 'call_notes'
  | 'temperature'
>;

/** All * required fields. Also the "trường cốt lõi" checklist.
 *  Includes every field AI tạo Solution (`clientBriefMissing`) requires:
 *  company_name, industry, biggest_problem, marketing_goal, channels.
 */
export const DISCOVERY_REQUIRED_FIELDS: Array<{
  key: DiscoveryChecklistKey;
  checklist: string;
}> = [
  { key: 'company_name', checklist: 'Tên DN' },
  { key: 'industry', checklist: 'Ngành nghề' },
  { key: 'flagship_product', checklist: 'Sản phẩm chủ lực' },
  { key: 'contact_name', checklist: 'Người liên hệ' },
  { key: 'phone', checklist: 'SĐT' },
  { key: 'services', checklist: 'Dịch vụ quan tâm' },
  { key: 'biggest_problem', checklist: 'Vấn đề KH' },
  { key: 'marketing_goal', checklist: 'Mục tiêu MKT' },
  { key: 'target_customers', checklist: 'KH mục tiêu' },
  { key: 'region', checklist: 'Khu vực' },
  { key: 'channels', checklist: 'Kênh muốn chạy và cách chốt đơn' },
  { key: 'budget_band', checklist: 'Ngân sách' },
  { key: 'timeline_band', checklist: 'Thời gian bắt đầu' },
  { key: 'call_notes', checklist: 'Ghi chú cuộc gọi' },
  { key: 'temperature', checklist: 'Mức độ sẵn sàng' },
];

/** Wizard tab + field testid for every required checklist key. */
export const DISCOVERY_FIELD_FOCUS: Record<DiscoveryChecklistKey, { step: 1 | 2 | 3; testid: string }> = {
  company_name: { step: 1, testid: 'sd-company' },
  industry: { step: 1, testid: 'sd-industry' },
  flagship_product: { step: 1, testid: 'sd-flagship' },
  contact_name: { step: 1, testid: 'sd-contact' },
  phone: { step: 1, testid: 'sd-phone' },
  services: { step: 2, testid: 'sd-service-picker' },
  biggest_problem: { step: 2, testid: 'sd-problem' },
  marketing_goal: { step: 2, testid: 'sd-goal' },
  target_customers: { step: 2, testid: 'sd-audience' },
  region: { step: 2, testid: 'sd-region' },
  channels: { step: 2, testid: 'sd-channels' },
  budget_band: { step: 3, testid: 'sd-budget' },
  timeline_band: { step: 3, testid: 'sd-timeline' },
  call_notes: { step: 3, testid: 'sd-notes' },
  temperature: { step: 3, testid: 'sd-temp' },
};

export function discoveryFieldFocus(key: DiscoveryChecklistKey): {
  step: 1 | 2 | 3;
  testid: string;
} {
  return DISCOVERY_FIELD_FOCUS[key];
}

export function emptySalesDiscoveryBrief(): SalesDiscoveryBrief {
  return {
    company_name: '',
    industry: '',
    flagship_product: '',
    websites: '',
    contact_name: '',
    phone: '',
    email: '',
    job_title: '',
    budget_authority: '',
    services: [],
    biggest_problem: '',
    marketing_goal: '',
    priority_product: '',
    target_customers: '',
    region: '',
    channels: [],
    current_results: '',
    difficulties: '',
    budget_band: '',
    timeline_band: '',
    call_notes: '',
    temperature: '',
  };
}

function asString(value: unknown, trim = true): string {
  const text = String(value ?? '');
  return trim ? text.trim() : text;
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    const one = asString(value);
    return one ? [one] : [];
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of value) {
    const s = asString(item);
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

export function normalizeSalesDiscoveryBrief(
  raw: unknown,
  opts?: { trim?: boolean },
): SalesDiscoveryBrief {
  const trim = opts?.trim !== false;
  const base = emptySalesDiscoveryBrief();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return base;
  const src = raw as Record<string, unknown>;
  base.company_name = asString(src.company_name, trim);
  base.industry = asString(src.industry, trim);
  base.flagship_product = asString(src.flagship_product, trim);
  base.websites = asString(src.websites, trim);
  base.contact_name = asString(src.contact_name, trim);
  base.phone = asString(src.phone, trim);
  base.email = asString(src.email, trim);
  base.job_title = asString(src.job_title, trim);
  const auth = asString(src.budget_authority, true);
  base.budget_authority =
    auth === 'direct' || auth === 'needs_approval' || auth === 'unknown' ? auth : '';
  base.services = asStringList(src.services);
  base.biggest_problem = asString(src.biggest_problem, trim);
  base.marketing_goal = asString(src.marketing_goal, trim);
  base.priority_product = asString(src.priority_product, trim);
  base.target_customers = asString(src.target_customers, trim);
  base.region = asString(src.region, trim);
  let channels = asStringList(src.channels);
  if (channels.includes('none') && channels.length > 1) {
    channels = channels.filter((c) => c !== 'none');
  }
  base.channels = channels;
  base.current_results = asString(src.current_results, trim);
  base.difficulties = asString(src.difficulties, trim);
  base.budget_band = asString(src.budget_band, trim);
  base.timeline_band = asString(src.timeline_band, trim);
  base.call_notes = asString(src.call_notes, trim);
  const temp = asString(src.temperature, true);
  base.temperature = temp === 'hot' || temp === 'warm' || temp === 'cold' ? temp : '';
  return base;
}

function fieldFilled(brief: SalesDiscoveryBrief, key: DiscoveryRequiredKey): boolean {
  const val = brief[key];
  if (Array.isArray(val)) return val.length > 0;
  return asString(val).length > 0;
}

export function discoveryMissingFields(brief: SalesDiscoveryBrief): Array<{ key: DiscoveryChecklistKey; checklist: string }> {
  return DISCOVERY_REQUIRED_FIELDS.filter((row) => !fieldFilled(brief, row.key));
}

export function discoveryProgress(brief: SalesDiscoveryBrief): { filled: number; total: number; missing: string[] } {
  const missing = discoveryMissingFields(brief);
  const total = DISCOVERY_REQUIRED_FIELDS.length;
  return {
    filled: total - missing.length,
    total,
    missing: missing.map((row) => row.checklist),
  };
}

export function isDiscoveryComplete(brief: SalesDiscoveryBrief): boolean {
  return discoveryMissingFields(brief).length === 0;
}

/**
 * Live 5-item Solution readiness checklist. Items 1-4 partition every
 * DISCOVERY_REQUIRED_FIELDS key (the same list Submit to AM / the step-2
 * handoff gate uses). Item 5 is green only when the full gate is satisfied.
 */
export type DiscoverySolutionChecklistKey = 'company' | 'need' | 'goal' | 'budget' | 'ready';

export type DiscoverySolutionChecklistItem = {
  key: DiscoverySolutionChecklistKey;
  label: string;
  ok: boolean;
  filled: number;
  total: number;
  fields: DiscoveryChecklistKey[];
};

export const DISCOVERY_SOLUTION_CHECKLIST: Array<{
  key: DiscoverySolutionChecklistKey;
  label: string;
  fields: DiscoveryChecklistKey[];
}> = [
  {
    key: 'company',
    label: 'Thông tin doanh nghiệp đầy đủ',
    fields: ['company_name', 'industry', 'flagship_product', 'contact_name', 'phone'],
  },
  {
    key: 'need',
    label: 'Nhu cầu & vấn đề rõ ràng',
    fields: ['services', 'biggest_problem'],
  },
  {
    key: 'goal',
    label: 'Mục tiêu & đối tượng khách hàng',
    fields: ['marketing_goal', 'target_customers', 'region', 'channels'],
  },
  {
    key: 'budget',
    label: 'Ngân sách & thời gian triển khai',
    fields: ['budget_band', 'timeline_band', 'call_notes', 'temperature'],
  },
  {
    key: 'ready',
    label: 'Đủ điều kiện làm Solution',
    fields: DISCOVERY_REQUIRED_FIELDS.map((row) => row.key),
  },
];

export function discoverySolutionChecklist(brief: SalesDiscoveryBrief): {
  items: DiscoverySolutionChecklistItem[];
  allOk: boolean;
  filled: number;
  total: number;
} {
  const items = DISCOVERY_SOLUTION_CHECKLIST.map((row) => {
    const filled = row.fields.filter((key) => fieldFilled(brief, key)).length;
    const total = row.fields.length;
    return { ...row, filled, total, ok: total > 0 && filled === total };
  });
  const progress = discoveryProgress(brief);
  return {
    items,
    allOk: items.every((item) => item.ok),
    filled: progress.filled,
    total: progress.total,
  };
}

export function readDiscoveryBriefFromAnswers(answers: unknown): SalesDiscoveryBrief | null {
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) return null;
  const raw = (answers as Record<string, unknown>)[DISCOVERY_BRIEF_KEY];
  if (!raw || typeof raw !== 'object') return null;
  return normalizeSalesDiscoveryBrief(raw);
}

export function sessionHasCompleteDiscovery(answers: unknown): boolean {
  const brief = readDiscoveryBriefFromAnswers(answers);
  return brief ? isDiscoveryComplete(brief) : false;
}

export function isDiscoveryScopeSlug(slug: string): boolean {
  return /^scope:\d+$/i.test(String(slug ?? "").trim());
}

export type DiscoveryServiceLiftGroup = {
  services?: Array<{ slug?: string; children?: Array<{ slug?: string }> }>;
};

/** Map scope:{id} ticks back to the parent catalog service code; drop unknown scope slugs. */
export function liftDiscoveryServiceCodes(
  services: string[],
  groups: DiscoveryServiceLiftGroup[] = [],
): string[] {
  const parentOf = new Map<string, string>();
  for (const group of groups) {
    for (const svc of group.services ?? []) {
      const parent = String(svc.slug ?? "").trim();
      if (!parent) continue;
      for (const child of svc.children ?? []) {
        const childSlug = String(child.slug ?? "").trim();
        if (childSlug) parentOf.set(childSlug, parent);
      }
    }
  }
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of services ?? []) {
    const slug = String(raw ?? "").trim();
    if (!slug) continue;
    const lifted = isDiscoveryScopeSlug(slug) ? parentOf.get(slug) ?? "" : slug;
    if (!lifted || isDiscoveryScopeSlug(lifted)) continue;
    if (seen.has(lifted)) continue;
    seen.add(lifted);
    out.push(lifted);
  }
  return out;
}


export type DiscoveryPickerService = {
  slug: string;
  name: string;
  children?: Array<{ slug: string; name: string }>;
};

export type DiscoveryServiceChip = {
  slug: string;
  title: string;
  parent?: string;
};

/** True when the saved brief includes this service as a parent-level code (slug or legacy name). */
export function isDiscoveryParentSelected(
  selected: string[],
  service: { slug: string; name: string },
): boolean {
  const codes = new Set((selected ?? []).map((s) => String(s ?? '').trim()).filter(Boolean));
  const slug = String(service.slug ?? '').trim();
  const name = String(service.name ?? '').trim();
  return Boolean((slug && codes.has(slug)) || (name && codes.has(name)));
}

/** Stored parent-level code for this service (slug or legacy name), if any. */
export function discoveryParentStoredCode(
  selected: string[],
  service: { slug: string; name: string },
): string | null {
  const codes = (selected ?? []).map((s) => String(s ?? '').trim()).filter(Boolean);
  const slug = String(service.slug ?? '').trim();
  const name = String(service.name ?? '').trim();
  if (slug && codes.includes(slug)) return slug;
  if (name && codes.includes(name)) return name;
  return null;
}

/** Chips for the current selection. Scope picks expose the parent name separately; the stored slug is preserved for remove. */
export function discoveryServiceChips(
  selected: string[],
  groups: Array<{ services?: DiscoveryPickerService[] }> | null | undefined,
): DiscoveryServiceChip[] {
  const catalog: DiscoveryPickerService[] = [];
  for (const group of groups ?? []) {
    for (const svc of group.services ?? []) catalog.push(svc);
  }
  const chips: DiscoveryServiceChip[] = [];
  for (const raw of selected ?? []) {
    const slug = String(raw ?? '').trim();
    if (!slug) continue;
    let found: DiscoveryServiceChip | null = null;
    for (const svc of catalog) {
      if (svc.slug === slug || svc.name === slug) {
        found = { slug, title: svc.name || slug };
        break;
      }
      const child = (svc.children ?? []).find((item) => item.slug === slug || item.name === slug);
      if (child) {
        found = { slug, title: child.name || slug, parent: svc.name };
        break;
      }
    }
    chips.push(found ?? { slug, title: slug });
  }
  return chips;
}

export type DiscoveryServiceChipGroup = {
  parent: string | null;
  items: DiscoveryServiceChip[];
};

/** Group scope chips under their parent service. Standalone (no-scope) services share one unheaded group. */
export function groupDiscoveryServiceChips(chips: DiscoveryServiceChip[]): DiscoveryServiceChipGroup[] {
  const unscoped: DiscoveryServiceChip[] = [];
  const groups: DiscoveryServiceChipGroup[] = [];
  const byParent = new Map<string, DiscoveryServiceChip[]>();
  for (const chip of chips ?? []) {
    const parent = String(chip.parent ?? '').trim();
    if (!parent) {
      unscoped.push(chip);
      continue;
    }
    const existing = byParent.get(parent);
    if (existing) {
      existing.push(chip);
      continue;
    }
    const items = [chip];
    byParent.set(parent, items);
    groups.push({ parent, items });
  }
  return unscoped.length ? [{ parent: null, items: unscoped }, ...groups] : groups;
}

export function primaryServiceSlug(services: string[]): string {
  return asString(services[0] ?? '');
}

export function parseWebsiteBundle(websites: string): { website: string; fanpage: string; tiktok: string } {
  const raw = asString(websites);
  // Pull labeled "Fanpage: …" / "TikTok: …" / "Website: …" first.
  let labeledFanpage = '';
  let labeledTiktok = '';
  let labeledWebsite = '';
  const labeled = raw.replace(
    /(?:^|[\n;,|/·•]|\s)(?:fanpage|facebook|fb)\s*[:：]\s*(\S+)/gi,
    (_, url: string) => {
      if (!labeledFanpage) labeledFanpage = url;
      return ' ';
    },
  ).replace(
    /(?:^|[\n;,|/·•]|\s)(?:tiktok|tt)\s*[:：]\s*(\S+)/gi,
    (_, url: string) => {
      if (!labeledTiktok) labeledTiktok = url;
      return ' ';
    },
  ).replace(
    /(?:^|[\n;,|/·•]|\s)(?:website|web|site|url)\s*[:：]\s*(\S+)/gi,
    (_, url: string) => {
      if (!labeledWebsite) labeledWebsite = url;
      return ' ';
    },
  );
  const tokens = labeled
    .split(/[\s,;|·•]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  let website = labeledWebsite;
  let fanpage = labeledFanpage;
  let tiktok = labeledTiktok;
  const leftover: string[] = [];
  for (const token of tokens) {
    const lower = token.toLowerCase();
    if (
      !fanpage &&
      (lower.includes('facebook.com') ||
        lower.includes('fb.com') ||
        lower.includes('fb.me') ||
        lower.includes('fanpage') ||
        /^fb\.com\//.test(lower))
    ) {
      fanpage = token;
      continue;
    }
    if (!tiktok && (lower.includes('tiktok.com') || lower.includes('tiktok') || lower.startsWith('@') && lower.includes('tiktok'))) {
      tiktok = token;
      continue;
    }
    if (!website && (lower.startsWith('http') || lower.includes('.') || lower.startsWith('www.'))) {
      website = token;
      continue;
    }
    leftover.push(token);
  }
  if (!website && leftover.length) website = leftover.join(' ');
  else if (leftover.length) website = [website, ...leftover].filter(Boolean).join(' ');
  return { website, fanpage, tiktok };
}

export function discoveryIndustryLabel(value: string | null | undefined, options?: DiscoveryOption[]): string {
  const raw = asString(value);
  if (!raw) return '';
  if (options?.length) {
    const hit = options.find((row) => row.value === raw);
    if (hit?.label) return hit.label;
  }
  return optionLabel(DISCOVERY_INDUSTRY_FALLBACK, raw);
}

const DISCOVERY_SERVICE_FALLBACK: Record<string, string> = {
  'nhan-dien-thuong-hieu': 'Nhận diện thương hiệu',
  'tiep-thi-noi-dung': 'Tiếp thị nội dung',
  'thiet-ke-landing-page': 'Thiết kế landing page',
  'quang-cao-facebook': 'Quảng cáo Facebook',
  'dich-vu-seo-tong-the': 'SEO tổng thể',
  'lead-gen': 'Lead generation',
  'van-hanh-tmdt': 'Vận hành TMĐT',
  'media-planning-ooh': 'Media planning / OOH',
  'nuoi-duong-khach-hang': 'Nuôi dưỡng khách hàng',
  'marketing-automation-nurture': 'Marketing automation (nurture)',
  'marketing-automation-setup': 'Marketing automation (setup)',
  'thiet-lap-crm': 'Thiết lập CRM',
  'email-sms-zalo-marketing': 'Email / SMS / Zalo Marketing',
  'ai-chatbot-ban-hang': 'AI chatbot bán hàng',
  'ai-system-intelligence': 'AI System & Intelligence',
  'dashboard-bao-cao-ai': 'Dashboard / Báo cáo AI',
  'phan-tich-thi-truong': 'Phân tích thị trường',
  'pr-booking-bao-chi': 'PR / Booking báo chí',
  'san-xuat-video-tvc': 'Sản xuất video / TVC',
  'kol-koc-booking': 'KOL / KOC booking',
  'su-kien-activation-btl': 'Sự kiện / Activation / BTL',
  'trade-marketing-posm': 'Trade marketing / POSM',
};

export function discoveryServiceLabel(
  slug: string,
  options?: Array<{ slug?: string; value?: string; name?: string; label?: string }>,
): string {
  const raw = asString(slug);
  if (!raw) return '';
  if (options?.length) {
    const hit = options.find((row) => (row.slug || row.value) === raw);
    const label = hit?.name || hit?.label;
    if (label) return label;
  }
  return DISCOVERY_SERVICE_FALLBACK[raw] || raw;
}

export function optionLabel(options: DiscoveryOption[], value: string): string {
  return options.find((row) => row.value === value)?.label || asString(value);
}

export function channelLabels(channels: string[]): string {
  return channels.map((c) => optionLabel(DISCOVERY_CHANNEL_OPTIONS, c)).filter(Boolean).join(', ');
}

export function budgetLabel(value: string): string {
  return optionLabel(DISCOVERY_BUDGET_OPTIONS, value);
}

export function timelineLabel(value: string): string {
  return optionLabel(DISCOVERY_TIMELINE_OPTIONS, value);
}

export function temperatureLabel(value: string): string {
  return (
    DISCOVERY_TEMPERATURE_OPTIONS.find((row) => row.value === value)?.label || asString(value)
  );
}

export function authorityLabel(value: string): string {
  return (
    DISCOVERY_AUTHORITY_OPTIONS.find((row) => row.value === value)?.label || asString(value)
  );
}

export function toggleDiscoveryChannel(current: string[], value: string): string[] {
  if (value === 'none') {
    return current.includes('none') ? [] : ['none'];
  }
  const withoutNone = current.filter((c) => c !== 'none');
  if (withoutNone.includes(value)) return withoutNone.filter((c) => c !== value);
  return [...withoutNone, value];
}

export function addDiscoveryService(current: string[], slug: string): string[] {
  const next = asString(slug);
  if (!next) return current;
  if (current.includes(next)) return current;
  return [...current, next];
}

export function removeDiscoveryService(current: string[], slug: string): string[] {
  return current.filter((s) => s !== slug);
}

export interface DiscoveryPrefillSource {
  company_name?: string | null;
  full_name?: string | null;
  phone?: string | null;
  email?: string | null;
  need?: string | null;
  industry?: string | null;
  industry_slug?: string | null;
  job_title?: string | null;
  brand?: string | null;
  website?: string | null;
  fanpage?: string | null;
  session?: {
    company_name?: string | null;
    contact_name?: string | null;
    contact_role?: string | null;
    lead_temperature?: string | null;
    service_slug?: string | null;
    answers_json?: unknown;
  } | null;
}

export function prefillSalesDiscovery(source: DiscoveryPrefillSource): SalesDiscoveryBrief {
  const fromSession = readDiscoveryBriefFromAnswers(source.session?.answers_json);
  const brief = fromSession ? { ...fromSession } : emptySalesDiscoveryBrief();
  const answers =
    source.session?.answers_json && typeof source.session.answers_json === 'object'
      ? (source.session.answers_json as Record<string, unknown>)
      : {};
  const crm =
    answers.crm_fields && typeof answers.crm_fields === 'object'
      ? (answers.crm_fields as Record<string, unknown>)
      : {};

  if (!brief.company_name) {
    brief.company_name = asString(source.session?.company_name) || asString(source.company_name) || asString(source.brand);
  }
  if (!brief.contact_name) {
    brief.contact_name = asString(source.session?.contact_name) || asString(source.full_name);
  }
  if (!brief.phone) brief.phone = asString(source.phone);
  if (!brief.email) brief.email = asString(source.email);
  if (!brief.job_title) {
    brief.job_title = asString(source.session?.contact_role) || asString(source.job_title);
  }
  if (!brief.industry) {
    brief.industry = asString(source.industry_slug) || asString(source.industry);
  }
  if (!brief.biggest_problem) {
    brief.biggest_problem = asString(crm.need) || asString(answers.need) || asString(source.need);
  }
  if (!brief.temperature) {
    const t = asString(source.session?.lead_temperature);
    if (t === 'hot' || t === 'warm' || t === 'cold') brief.temperature = t;
  }
  const answersHaveExplicitServices = Array.isArray(
    (answers[DISCOVERY_BRIEF_KEY] && typeof answers[DISCOVERY_BRIEF_KEY] === 'object' && !Array.isArray(answers[DISCOVERY_BRIEF_KEY])
      ? (answers[DISCOVERY_BRIEF_KEY] as { services?: unknown }).services
      : undefined),
  );
  // An explicit (even empty) brief.services list wins over a leftover session.service_slug
  // so removing the last selected service, including a scope:{id} tick, does not come back.
  if (!brief.services.length && !answersHaveExplicitServices) {
    const slug = asString(source.session?.service_slug);
    if (slug && slug !== '_common') brief.services = [slug];
  }
  if (!brief.websites) {
    const parts = [asString(source.website), asString(source.fanpage)].filter(Boolean);
    if (parts.length) brief.websites = parts.join('\n');
  }
  if (!brief.call_notes) {
    brief.call_notes = asString(answers.notes) || asString(crm.notes);
  }
  if (!brief.current_results) {
    brief.current_results = asString(crm.current_state) || asString(answers.current_state);
  }
  return normalizeSalesDiscoveryBrief(brief);
}

export function buildDiscoveryCompatAnswers(
  existing: Record<string, unknown> | null | undefined,
  brief: SalesDiscoveryBrief,
): Record<string, unknown> {
  const prev = existing && typeof existing === 'object' && !Array.isArray(existing) ? { ...existing } : {};
  const crm =
    prev.crm_fields && typeof prev.crm_fields === 'object' && !Array.isArray(prev.crm_fields)
      ? { ...(prev.crm_fields as Record<string, unknown>) }
      : {};
  crm.need = brief.biggest_problem;
  crm.notes = brief.call_notes;
  crm.current_state = brief.current_results;
  crm.goal = brief.marketing_goal;
  crm.target_audience = brief.target_customers;
  crm.budget_band = brief.budget_band;
  crm.timeline_band = brief.timeline_band;
  crm.region = brief.region;
  crm.flagship_product = brief.flagship_product;
  crm.priority_product = brief.priority_product;
  crm.difficulties = brief.difficulties;
  crm.budget_authority = brief.budget_authority;
  crm.industry = brief.industry;
  const urls = parseWebsiteBundle(brief.websites);
  crm.website = urls.website;
  crm.fanpage = urls.fanpage;
  crm.tiktok = urls.tiktok;
  return {
    ...prev,
    [DISCOVERY_BRIEF_KEY]: normalizeSalesDiscoveryBrief(brief),
    crm_fields: crm,
    need: brief.biggest_problem,
    notes: brief.call_notes,
    current_state: brief.current_results,
  };
}

export function discoveryConsultFormPatch(brief: SalesDiscoveryBrief): Record<string, unknown> {
  const urls = parseWebsiteBundle(brief.websites);
  const patch: Record<string, unknown> = {};
  if (brief.biggest_problem) {
    patch.need = brief.biggest_problem;
    patch.current_status = brief.biggest_problem;
  }
  if (brief.industry) {
    patch.niche = brief.industry;
    patch.industry = brief.industry;
  }
  if (brief.marketing_goal) patch.goal = brief.marketing_goal;
  if (brief.target_customers) {
    patch.target_audience = brief.target_customers;
    patch.doi_tuong_muc_tieu = brief.target_customers;
  }
  if (brief.budget_band) patch.budget = budgetLabel(brief.budget_band);
  if (brief.flagship_product) patch.flagship_product = brief.flagship_product;
  if (urls.website) {
    patch.website = urls.website;
    patch.domain = urls.website;
    patch.website_url = urls.website;
  }
  if (urls.fanpage) {
    patch.fanpage = urls.fanpage;
    patch.fanpage_url = urls.fanpage;
  }
  if (urls.tiktok) patch.tiktok = urls.tiktok;
  if (brief.channels.length) patch.channels = channelLabels(brief.channels);
  if (brief.current_results) patch.metrics = brief.current_results;
  if (brief.region) patch.region = brief.region;
  if (brief.call_notes) patch.notes = brief.call_notes;
  if (brief.difficulties && brief.current_results) {
    patch.current_status = [brief.biggest_problem, `Kênh: ${channelLabels(brief.channels)}`, `Kết quả: ${brief.current_results}`, `Khó khăn: ${brief.difficulties}`]
      .filter((s) => s && s !== 'Kênh: ')
      .join('\n');
  }
  return patch;
}

export function discoveryClientBriefPatch(brief: SalesDiscoveryBrief): {
  goal: string;
  audience: string;
  channels: string;
  website: string;
  fanpage: string;
  metrics: string;
} {
  const urls = parseWebsiteBundle(brief.websites);
  return {
    goal: brief.marketing_goal,
    audience: brief.target_customers,
    channels: channelLabels(brief.channels),
    website: urls.website,
    fanpage: urls.fanpage,
    metrics: brief.current_results,
  };
}

export function groupCatalogServices<T extends { slug: string; name: string }>(
  services: T[],
): Array<{ key: string; title: string; services: T[] }> {
  const bySlug = new Map(services.map((row) => [row.slug, row]));
  const used = new Set<string>();
  const groups: Array<{ key: string; title: string; services: T[] }> = [];
  for (const group of DISCOVERY_SERVICE_GROUPS) {
    const items = group.slugs.map((slug) => bySlug.get(slug)).filter((row): row is T => Boolean(row));
    for (const item of items) used.add(item.slug);
    if (items.length) groups.push({ key: group.key, title: group.title, services: items });
  }
  const leftover = services.filter((row) => !used.has(row.slug));
  if (leftover.length) {
    groups.push({ key: 'other', title: 'Dịch vụ khác', services: leftover });
  }
  return groups;
}

/** Footer autosave label: 'Đang lưu…' while saving, otherwise 'Đã lưu HH:mm' in Asia/Saigon. */
export function formatDiscoverySaveStatus(
  saving: boolean,
  savedAt: Date | string | number | null | undefined,
): string {
  if (saving) return 'Đang lưu…';
  if (savedAt == null || savedAt === '') return '';
  const date = savedAt instanceof Date ? savedAt : new Date(savedAt);
  if (Number.isNaN(date.getTime())) return 'Đã lưu';
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Saigon',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `Đã lưu ${get('hour')}:${get('minute')}`;
}
