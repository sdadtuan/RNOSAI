export const COMMON_FORM_SLUG = '_common';

export const BANT_KEYS = [
  'budget',
  'authority',
  'need',
  'timeline',
  'fit',
  'history',
] as const;

export const GO_THRESHOLDS = { go: 24, nurture_min: 18 } as const;

export interface IntakeQuestionItem {
  key: string;
  text: string;
  critical?: boolean;
}

export interface IntakeRedFlagItem {
  key: string;
  text: string;
}

const PHONE_QUESTION_KEYS = [
  'phone_service_interest',
  'phone_domain',
  'phone_pain_point',
  'phone_budget',
  'phone_timeline',
  'phone_decision_maker',
  'phone_prior_attempts',
  'phone_kpi',
  'phone_industry',
  'phone_expectation',
  'phone_deadline',
  'phone_priority_service',
] as const;

const INPERSON_QUESTION_KEYS = [
  'ip_business_goals',
  'ip_icp',
  'ip_pain_solutions',
  'ip_approval_process',
  'ip_competitors',
  'ip_marketing_team',
  'ip_budget_approved',
  'ip_timeline',
  'ip_partner_risk',
  'ip_agency_criteria',
] as const;

const PHONE_CRITICAL_KEYS = new Set<string>([
  'phone_pain_point',
  'phone_budget',
  'phone_decision_maker',
]);

const INPERSON_CRITICAL_KEYS = new Set<string>([
  'ip_pain_solutions',
  'ip_budget_approved',
  'ip_timeline',
]);

const RED_FLAG_KEYS = [
  'rf_unclear_need',
  'rf_no_budget',
  'rf_no_decision_maker',
  'rf_unrealistic_expectation',
  'rf_refuses_info',
  'rf_ghost_followup',
  'rf_freelancer_compare',
  'rf_multi_service_no_priority',
] as const;

function buildQuestionItems(
  texts: string[],
  keys: readonly string[],
  criticalKeys: Set<string>,
): IntakeQuestionItem[] {
  return texts.map((text, index) => ({
    key: keys[index] ?? `q_${String(index).padStart(2, '0')}`,
    text,
    critical: criticalKeys.has(keys[index] ?? ''),
  }));
}

function buildRedFlagItems(texts: string[], keys: readonly string[]): IntakeRedFlagItem[] {
  return texts.map((text, index) => ({
    key: keys[index] ?? `rf_${String(index).padStart(2, '0')}`,
    text,
  }));
}

export const SERVICE_SLUGS = [
  'dich-vu-seo-tong-the',
  'dich-vu-aeo',
  'dich-vu-seo-local',
  'dich-vu-seo-audit',
  'dich-vu-quan-tri-website',
  'thiet-ke-website',
  'thiet-ke-website-tron-goi',
  'thiet-ke-landing-page',
  'quang-cao-facebook',
  'quang-cao-google',
  'thue-tai-khoan-quang-cao',
  'tiep-thi-noi-dung',
] as const;

export const BANT_ROWS: Array<{ label: string; hint: string }> = [
  { label: 'Budget', hint: 'Ngân sách thực tế/tháng hoặc dự án? Ai duyệt chi?' },
  { label: 'Authority', hint: 'Ai ký HĐ? Ai quyết định cuối cùng?' },
  { label: 'Need', hint: 'Pain point #1? Hậu quả nếu không giải quyết?' },
  { label: 'Timeline', hint: 'Khi nào cần bắt đầu? Deadline campaign/go-live?' },
  { label: 'Fit', hint: 'Phù hợp ICP PTT? Scope trong năng lực?' },
  { label: 'History', hint: 'Đã thử gì? Agency cũ? Kết quả?' },
];

const COMMON_SLUG_ALIASES = new Set([
  COMMON_FORM_SLUG,
  '00-form-chung',
  'common',
  'form-chung',
]);

const COMMON_FORM = {
  title: 'Form chung — chưa xác định dịch vụ',
  group: 'Mọi dịch vụ PTT',
  overview:
    'Qualify lead trước khi biết chính xác dịch vụ. Sau khi rõ → chuyển form dịch vụ cụ thể.',
  icp: 'Lead inbound/outbound chưa rõ scope; multi-service; cần discovery trước khi gán lifecycle slug.',
  phone_qs: [
    'Anh/chị đang quan tâm dịch vụ gì? (SEO / Ads / Web / Content / chưa rõ?)',
    'Website/domain hiện tại (nếu có)?',
    'Pain point #1 cần giải quyết gấp nhất?',
    'Ngân sách dự kiến (range/tháng hoặc dự án)? Ai duyệt chi?',
    'Timeline bắt đầu mong muốn?',
    'Ai là decision maker / người ký HĐ?',
    'Đã thử agency hoặc tự làm gì trước đây? Kết quả?',
    'KPI đo thành công là gì (traffic, lead, doanh thu…)?',
    'Ngành / quy mô DN / thị trường chính?',
    'Lead đến từ đâu — kỳ vọng cụ thể từ PTT?',
    'Có deadline campaign / mùa vụ / họp board không?',
    'Dịch vụ nào ưu tiên nhất nếu phải chọn một?',
  ],
  inperson_qs: [
    'Mục tiêu kinh doanh 6–12 tháng tới? KPI đo thành công?',
    'Khách hàng lý tưởng (ICP) của anh/chị là ai?',
    'Điểm đau lớn nhất hiện tại? Đã thử giải pháp nào?',
    'Quy trình duyệt chi / ký HĐ nội bộ như thế nào?',
    'Đối thủ chính? Anh/chị muốn khác biệt ở đâu?',
    'Team marketing hiện tại: ai làm gì? Thiếu gì?',
    'Ngân sách đã duyệt hay đang xin duyệt?',
    'Timeline bắt buộc (campaign, mùa vụ, board meeting)?',
    'Rủi ro lớn nhất nếu chọn sai đối tác?',
    'Tiêu chí chọn agency (giá, case, SLA, báo cáo)?',
  ],
  red_flags: [
    'Chưa rõ nhu cầu — chỉ hỏi giá',
    'Không có ngân sách / từ chối nêu range',
    'Không tiếp cận được decision maker',
    'Kỳ vọng không thực tế (kết quả trong 1–2 tuần)',
    'Từ chối chia sẻ thông tin cơ bản',
    'Ghost sau 2 lần follow-up',
    'So sánh giá với freelancer không cùng scope',
    'Đa dịch vụ nhưng không ưu tiên — khó scope',
  ],
  urgency: [
    'Campaign / mùa vụ sắp tới',
    'Traffic / lead tụt gấp',
    'Website lỗi / downtime',
    'Hết hạn agency cũ',
    'Board / sếp yêu cầu báo cáo gấp',
    'Đối thủ vượt mặt trên digital',
  ],
};

type QualifyItem = { key: string; text: string; critical?: boolean };
type WinIntelPrompt = { key: string; hint: string };

type PilotForm = typeof COMMON_FORM & {
  phone_keys: readonly string[];
  extra_phone_critical: readonly string[];
  inperson_keys: readonly string[];
  red_flag_keys: readonly string[];
  qualify_items: QualifyItem[];
  win_intel_prompts: WinIntelPrompt[];
  l2_preview_keys: string[];
};

const SEO_FORM: PilotForm = {
  title: 'SEO tổng thể',
  group: 'SEO',
  overview:
    'Qualify: ngành · ngân sách/tháng · website domain · nhu cầu cụ thể. Discovery phone thay 12 câu generic.',
  icp: 'Lead cần SEO tổng thể — có hoặc sắp có website/domain, đo traffic / lead / rank.',
  phone_qs: [
    'Website/domain cần SEO hiện tại?',
    'Pain #1 (traffic / lead / rank / brand)?',
    'Ngân sách SEO/tháng (range VND)? Ai duyệt?',
    'Ai ký HĐ / duyệt ngân sách tháng?',
    'Đã có GSC / GA4? Ai giữ quyền?',
    '2–3 đối thủ đang chiếm từ khóa?',
    'Cụm từ khóa / nhóm dịch vụ cần lên?',
    'Đã tự làm / thuê agency SEO? Kết quả?',
    'Mốc cần thấy kết quả (tháng)?',
    'Ngành / khu vực / thị trường chính?',
  ],
  phone_keys: [
    'seo_domain',
    'phone_pain_point',
    'phone_budget',
    'phone_decision_maker',
    'seo_gsc',
    'seo_competitors',
    'seo_keywords',
    'seo_history',
    'phone_timeline',
    'phone_industry',
  ],
  extra_phone_critical: ['seo_domain'],
  inperson_qs: [
    'Mục tiêu 6–12 tháng?',
    'ICP?',
    'Technical/CWV hiện tại?',
    'Đối thủ?',
    'KW volume/difficulty cảm tính?',
    'Ngân sách đã duyệt?',
    'Timeline 3–6 tháng?',
    'Tiêu chí chọn agency SEO?',
  ],
  inperson_keys: [
    'ip_business_goals',
    'ip_icp',
    'ip_pain_solutions',
    'ip_competitors',
    'ip_kw',
    'ip_budget_approved',
    'ip_timeline',
    'ip_agency_criteria',
  ],
  red_flags: [
    ...COMMON_FORM.red_flags,
    'Chưa có website / domain lỗi',
    'Kỳ vọng lên top 1–2 tuần',
  ],
  red_flag_keys: [...RED_FLAG_KEYS, 'rf_seo_no_site', 'rf_seo_expect_week'],
  urgency: [...COMMON_FORM.urgency],
  qualify_items: [
    { key: 'nganh', text: 'ngành' },
    { key: 'ngan_sach', text: 'ngân sách/tháng' },
    { key: 'domain', text: 'website domain' },
    { key: 'nhu_cau', text: 'nhu cầu cụ thể' },
  ],
  win_intel_prompts: [
    { key: 'incumbent', hint: 'agency SEO cũ (báo traffic vs lead)' },
    { key: 'competitor', hint: 'đối thủ rank' },
    { key: 'selection_criteria', hint: 'tiêu chí (case ngành / báo cáo GSC)' },
  ],
  l2_preview_keys: ['gsc_read', 'ga4', 'competitors', 'seed_kw'],
};

const GADS_FORM: PilotForm = {
  title: 'Quảng cáo Google',
  group: 'Google Ads',
  overview:
    'Qualify: ngành/sản phẩm · ngân sách/tháng · loại campaign (Search / Display / Shopping) · đã có Google Ads account.',
  icp: 'Lead chạy hoặc sắp chạy Google Ads — Search / Display / Shopping / Performance Max.',
  phone_qs: [
    'Đã có Google Ads account? Trạng thái?',
    'Pain #1 (CPA / lead / sale / impression)?',
    'Ngân sách Ads + phí quản lý/tháng?',
    'Ai duyệt spend hàng tháng?',
    'Search / Display / Shopping / Performance Max?',
    'Landing / website nhận traffic?',
    'Conversion / GA4 / call tracking đã có?',
    'CPC / CPA / ROAS gần nhất nếu có?',
    'Campaign / mùa vụ bắt đầu khi nào?',
    'Ngành / sản phẩm / khu vực target?',
  ],
  phone_keys: [
    'gads_account',
    'phone_pain_point',
    'phone_budget',
    'phone_decision_maker',
    'gads_type',
    'gads_lp',
    'gads_tracking',
    'gads_history',
    'phone_timeline',
    'phone_industry',
  ],
  extra_phone_critical: ['gads_type'],
  inperson_qs: [
    'ICP search intent?',
    'KW mục tiêu?',
    'Kết quả account hiện tại?',
    'Approval spend?',
    'Tracking gaps?',
    'Tiêu chí chọn (CPA vs agency cũ)?',
  ],
  inperson_keys: [
    'ip_icp',
    'ip_kw',
    'ip_pain_solutions',
    'ip_budget_approved',
    'ip_tracking',
    'ip_agency_criteria',
  ],
  red_flags: [
    ...COMMON_FORM.red_flags,
    'Không đo conversion',
    'Chỉ nói ngân sách/ngày, không khóa tháng',
  ],
  red_flag_keys: [...RED_FLAG_KEYS, 'rf_gads_no_tracking', 'rf_gads_budget_day'],
  urgency: [...COMMON_FORM.urgency],
  qualify_items: [
    { key: 'nganh', text: 'ngành/sản phẩm' },
    { key: 'ngan_sach', text: 'ngân sách/tháng' },
    { key: 'loai_campaign', text: 'loại campaign (Search / Display / Shopping)' },
    { key: 'gads_account', text: 'đã có Google Ads account' },
  ],
  win_intel_prompts: [
    { key: 'incumbent', hint: 'freelancer/agency Ads cũ' },
    { key: 'competitor', hint: 'so sánh CPA' },
    { key: 'switch_risk', hint: 'kỳ vọng ROAS không thực tế' },
  ],
  l2_preview_keys: ['account_read', 'conversion_tracking', 'lp_url', 'cpc_benchmark'],
};

const WEB_FORM: PilotForm = {
  title: 'Thiết kế website',
  group: 'Website',
  overview:
    'Qualify: ngành · loại site (corporate / ecomm / portfolio) · ngân sách dự án · deadline.',
  icp: 'Lead cần thiết kế website — corporate / thương mại / portfolio.',
  phone_qs: [
    'Corporate / thương mại / portfolio / khác?',
    'Pain #1 (rebrand / không ra lead / site cũ)?',
    'Ngân sách thiết kế (range dự án)?',
    'Ai duyệt design / ký HĐ?',
    'Deadline go-live / sự kiện?',
    '2–3 site tham khảo (URL)?',
    'Ước số trang / tính năng must-have?',
    'Đã có logo / guideline?',
    'Ngành / thương hiệu?',
    'Site hiện tại (nếu có) — giữ hay làm mới?',
  ],
  phone_keys: [
    'web_type',
    'phone_pain_point',
    'phone_budget',
    'phone_decision_maker',
    'web_deadline',
    'web_refs',
    'web_pages',
    'web_brand',
    'phone_industry',
    'web_current',
  ],
  extra_phone_critical: ['web_type', 'web_deadline'],
  inperson_qs: [
    'Mục tiêu site?',
    'Đối tượng?',
    'Tính năng?',
    'Số revision kỳ vọng?',
    'Quy trình duyệt design?',
    'Rủi ro delay content?',
  ],
  inperson_keys: [
    'ip_business_goals',
    'ip_icp',
    'ip_pain_solutions',
    'ip_revisions',
    'ip_approval_process',
    'ip_content_delay',
  ],
  red_flags: [
    ...COMMON_FORM.red_flags,
    '“xem giá rồi tính”',
    'Muốn ecomm + app + 50 trang, budget landing',
  ],
  red_flag_keys: [...RED_FLAG_KEYS, 'rf_web_no_budget', 'rf_web_scope_creep'],
  urgency: [...COMMON_FORM.urgency],
  qualify_items: [
    { key: 'nganh', text: 'ngành' },
    { key: 'loai_site', text: 'loại site (corporate / ecomm / portfolio)' },
    { key: 'ngan_sach', text: 'ngân sách dự án' },
    { key: 'deadline', text: 'deadline' },
  ],
  win_intel_prompts: [
    { key: 'incumbent', hint: 'freelancer Figma rẻ' },
    { key: 'switch_risk', hint: 'intern in-house' },
    { key: 'selection_criteria', hint: 'tiêu chí (revision / SLA bàn giao)' },
  ],
  l2_preview_keys: ['brand_assets', 'sitemap_draft', 'ref_urls'],
};

const PILOT: Record<string, PilotForm> = {
  'dich-vu-seo-tong-the': SEO_FORM,
  'quang-cao-google': GADS_FORM,
  'thiet-ke-website': WEB_FORM,
};

export function isCommonSlug(slug: string): boolean {
  return COMMON_SLUG_ALIASES.has(String(slug ?? '').trim().toLowerCase());
}

export function normalizeIntakeSlug(slug: string): string {
  if (isCommonSlug(slug)) return COMMON_FORM_SLUG;
  return String(slug ?? '').trim();
}

export function resolveDefinitionSlug(serviceSlug: string): string {
  if (isCommonSlug(serviceSlug)) return COMMON_FORM_SLUG;
  const s = String(serviceSlug ?? '').trim();
  if ((SERVICE_SLUGS as readonly string[]).includes(s)) return s;
  return COMMON_FORM_SLUG;
}

export function buildBantRowsUi(): Array<{ key: string; label: string; hint: string }> {
  const keyMap: Record<string, string> = {
    Budget: 'budget',
    Authority: 'authority',
    Need: 'need',
    Timeline: 'timeline',
    Fit: 'fit',
    History: 'history',
  };
  return BANT_ROWS.map(({ label, hint }) => ({
    key: keyMap[label] ?? label.toLowerCase(),
    label,
    hint,
  }));
}

export function getCommonFormDefinition(): typeof COMMON_FORM {
  return COMMON_FORM;
}

export function getUiDefinition(slug: string): Record<string, unknown> {
  const defSlug = resolveDefinitionSlug(slug);
  const svc = PILOT[defSlug] ?? COMMON_FORM;
  const phoneKeys = 'phone_keys' in svc ? svc.phone_keys : PHONE_QUESTION_KEYS;
  const phoneCritical = new Set<string>([
    ...PHONE_CRITICAL_KEYS,
    ...('extra_phone_critical' in svc ? svc.extra_phone_critical : []),
  ]);
  const inpersonKeys = 'inperson_keys' in svc ? svc.inperson_keys : INPERSON_QUESTION_KEYS;
  const redFlagKeys = 'red_flag_keys' in svc ? svc.red_flag_keys : RED_FLAG_KEYS;
  const phoneQuestionItems = buildQuestionItems(svc.phone_qs || [], phoneKeys, phoneCritical);
  const inpersonQuestionItems = buildQuestionItems(
    svc.inperson_qs || [],
    inpersonKeys,
    INPERSON_CRITICAL_KEYS,
  );
  const redFlagItems = buildRedFlagItems(svc.red_flags || [], redFlagKeys);
  return {
    slug: defSlug,
    title: svc.title || defSlug,
    group: svc.group || '',
    overview: svc.overview || '',
    icp: svc.icp || '',
    phone_questions: phoneQuestionItems.map((q) => q.text),
    inperson_questions: inpersonQuestionItems.map((q) => q.text),
    phone_question_items: phoneQuestionItems,
    inperson_question_items: inpersonQuestionItems,
    red_flags: redFlagItems.map((f) => f.text),
    red_flag_items: redFlagItems,
    urgency_triggers: [...(svc.urgency || [])],
    bant_rows: buildBantRowsUi(),
    is_common_form: defSlug === COMMON_FORM_SLUG,
    qualify_items: 'qualify_items' in svc ? svc.qualify_items : [],
    win_intel_prompts: 'win_intel_prompts' in svc ? svc.win_intel_prompts : [],
    l2_preview_keys: 'l2_preview_keys' in svc ? svc.l2_preview_keys : [],
    is_pilot_form: Boolean(PILOT[defSlug]),
    schema_version: 3,
  };
}

export function definitionsPayload(): Record<string, unknown> {
  const common = getCommonFormDefinition();
  return {
    slugs: [...SERVICE_SLUGS],
    common_slug: COMMON_FORM_SLUG,
    common: {
      title: common.title,
      phone_questions_count: common.phone_qs.length,
      inperson_questions_count: common.inperson_qs.length,
    },
    bant_rows: BANT_ROWS,
  };
}
