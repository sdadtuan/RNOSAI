/** DV01–21 operating playbook. 13 nav groups are a filter — not new families. */

export const QT_CATALOG_NAV_GROUPS = [
  'strategy',
  'branding',
  'content',
  'production',
  'performance',
  'web',
  'seo',
  'crm',
  'retention',
  'pr',
  'event',
  'sales',
  'data',
] as const;

export type QuoteCatalogNavGroup = (typeof QT_CATALOG_NAV_GROUPS)[number];
export type QuoteCatalogGroup = QuoteCatalogNavGroup | 'package';
export type QuoteDvKpiKind = 'committed' | 'forecast' | 'optimization';

export type QuoteDvKpi = {
  name: string;
  value: string;
  kind: QuoteDvKpiKind;
};

export type QuoteDvPlaybook = {
  dv_code: string;
  group: QuoteCatalogNavGroup;
  summary: string;
  owner: string;
  effort: string;
  duration: string;
  kickoff: string;
  timeline_notes: string;
  cta: string[];
  uta: string;
  included: string[];
  excluded: string[];
  assume: string[];
  deliverables: string[];
  kpis: QuoteDvKpi[];
  channel_lines: string[];
  media_pass_through: boolean;
};

export const QT_PORTFOLIO_DV_CODES = Array.from(
  { length: 21 },
  (_, i) => `DV${String(i + 1).padStart(2, '0')}`,
);

/** Official Portfolio names from ops-dv01-dv21-route-map. */
export const QT_DV_NAME_VI: Record<string, string> = {
  DV01: 'Hệ thống nhận diện Thương hiệu',
  DV02: 'Chiến lược nội dung & Mạng xã hội',
  DV03: 'Website & Landing Page',
  DV04: 'Quảng cáo tối ưu chuyển đổi',
  DV05: 'Tối ưu SEO & AEO',
  DV06: 'Nuôi dưỡng & Tạo chuyển đổi',
  DV07: 'AI Chatbot & Trợ lý bán hàng AI',
  DV08: 'Thiết lập & Tích hợp hệ thống CRM',
  DV09: 'Tự động hoá nuôi dưỡng khách hàng',
  DV10: 'AI System & Intelligence',
  DV11: 'Thiết lập Marketing Automation',
  DV12: 'Báo cáo phân tích thị trường',
  DV13: 'Bảng điều khiển & Báo cáo AI',
  DV14: 'PR & Booking báo chí',
  DV15: 'Sản xuất Video/TVC quảng cáo',
  DV16: 'Booking & Quản lý KOL/KOC',
  DV17: 'Tổ chức Sự kiện & Activation (BTL)',
  DV18: 'Media Planning & Booking quảng cáo diện rộng',
  DV19: 'Vận hành & Quảng cáo trên sàn TMĐT',
  DV20: 'Email / SMS / Zalo ZNS Marketing đa kênh',
  DV21: 'Trade Marketing & POSM tại điểm bán',
};

export const QT_DV_NAV_GROUP: Record<string, QuoteCatalogNavGroup> = {
  DV01: 'branding',
  DV02: 'content',
  DV03: 'web',
  DV04: 'performance',
  DV05: 'seo',
  DV06: 'retention',
  DV07: 'crm',
  DV08: 'crm',
  DV09: 'crm',
  DV10: 'crm',
  DV11: 'crm',
  DV12: 'strategy',
  DV13: 'data',
  DV14: 'pr',
  DV15: 'production',
  DV16: 'pr',
  DV17: 'event',
  DV18: 'performance',
  DV19: 'performance',
  DV20: 'retention',
  DV21: 'event',
};

const GROUP_KEYWORDS: Array<[RegExp, QuoteCatalogGroup]> = [
  [/package|ngành|nganh|growth[\s-]?launch/i, 'package'],
  [/brand[\s-]?film|reels|video|image|sản xuất|san xuat|\btvc\b|vid-tpl-01|storyboard/i, 'production'],
  [
    /strateg|research|nghiên cứu|nghien cuu|thị[\s-]?trường|thi[\s-]?truong|phân[\s-]?tích[\s-]?thị[\s-]?trường|phan[\s-]?tich[\s-]?thi[\s-]?truong/i,
    'strategy',
  ],
  [/brand|nhận diện|nhan dien|identity|creative|key visual/i, 'branding'],
  [/content|social|nội dung|noi dung|mạng xã hội|mang xa hoi/i, 'content'],
  [/performance|media|\bads\b|quảng cáo|quang cao|meta|google|tiktok|tmđt|tmdt|sàn/i, 'performance'],
  [/web|landing|\blp\b|cro|website/i, 'web'],
  [/\bseo\b|\baeo\b|organic/i, 'seo'],
  [/email|retention|nurture|nuôi dưỡng|nuoi duong|zalo|sms|zns/i, 'retention'],
  [/\bcrm\b|automation|chatbot/i, 'crm'],
  [/\bpr\b|kol|koc|báo chí|bao chi|reputation/i, 'pr'],
  [/event|sự kiện|su kien|activation|\bbtl\b|posm|trade/i, 'event'],
  [/sales|enablement|playbook|bán hàng|ban hang/i, 'sales'],
  [/data|analytics|dashboard|pixel|báo cáo|bao cao/i, 'data'],
];

export function skuCodesFor(dvCode: string): string[] {
  const dv = String(dvCode ?? '')
    .trim()
    .toUpperCase();
  if (!dv) return [];
  return [`${dv}-CB`, `${dv}-TC`, `${dv}-CS`];
}

export function resolveQuoteCatalogGroup(
  dvCode: string,
  name: string,
  slug: string,
): QuoteCatalogGroup {
  const hay = `${name} ${slug}`;
  if (/package|ngành|nganh|growth[\s-]?launch/i.test(hay)) return 'package';
  if (/brand[\s-]?film|reels|video[\s-]?storyboard|vid-tpl-01/i.test(hay)) return 'production';
  const dv = String(dvCode ?? '')
    .trim()
    .toUpperCase();
  if (QT_DV_NAV_GROUP[dv]) return QT_DV_NAV_GROUP[dv];
  for (const [pattern, group] of GROUP_KEYWORDS) {
    if (pattern.test(hay)) return group;
  }
  return 'strategy';
}

function pb(
  dv_code: string,
  group: QuoteCatalogNavGroup,
  rest: Omit<QuoteDvPlaybook, 'dv_code' | 'group'>,
): QuoteDvPlaybook {
  return { dv_code, group, ...rest };
}

export const QT_DV_PLAYBOOKS: Record<string, QuoteDvPlaybook> = {
  DV01: pb('DV01', 'branding', {
    summary: 'Nhận diện: positioning, identity, KV. Bán theo gói CB/TC/CS — không tách 3 family.',
    owner: 'Brand Lead',
    effort: '88–240 giờ tùy gói',
    duration: '03–08 tuần',
    kickoff: 'Discovery + một đầu mối duyệt',
    timeline_notes: 'Identity CS (240h) tách trademark/in ấn. KV = line/add-on, 02 vòng sửa.',
    cta: ['Đặt lịch brand workshop', 'Xem case study'],
    uta: 'Không gồm đăng ký nhãn hiệu, in ấn, naming legal.',
    included: ['Discovery / message house', '01–03 creative direction theo gói', 'Guideline hoặc KV master'],
    excluded: ['Trademark', 'Printing/production', '3D/motion phức tạp'],
    assume: ['Một decision maker tổng hợp feedback.', 'Client có brand direction trước kick-off.'],
    deliverables: ['Positioning/message', 'Logo/VIS hoặc KV', 'Mockup ứng dụng', 'Guideline PDF'],
    kpis: [
      { name: 'Creative directions', value: 'Theo gói', kind: 'committed' },
      { name: 'Guideline / KV master', value: '01', kind: 'committed' },
      { name: 'Revision', value: '02 rounds', kind: 'committed' },
    ],
    channel_lines: ['Positioning (CB)', 'Identity refresh (TC)', 'KV campaign (CS/add-on)'],
    media_pass_through: false,
  }),
  DV02: pb('DV02', 'content', {
    summary: 'Content & social retainer. Social / copy / LinkedIn là line hoặc gói, không phải DV mới.',
    owner: 'Content Lead',
    effort: '52–64 giờ/tháng',
    duration: 'Retainer 03 tháng',
    kickoff: 'Content plan + guideline + lịch duyệt batch',
    timeline_notes: 'Khách duyệt batch trong 02 ngày làm việc. Trễ duyệt = trễ publish.',
    cta: ['Xem portfolio', 'Đặt lịch tư vấn', 'Nhắn tin Fanpage'],
    uta: 'Reach/ER là tối ưu, không SLA. Media/KOL/sales chốt đơn tách.',
    included: ['Content monthly plan', 'Copy/design theo gói', 'Publish support', 'Monthly report'],
    excluded: ['Media budget', 'KOL/studio/talent', 'Sales closing'],
    assume: ['Client duyệt batch nội dung trong 02 ngày làm việc.'],
    deliverables: ['Content plan', 'Static/carousel', 'Reels basic (nếu gói có)', 'Community', 'Report'],
    kpis: [
      { name: 'Post delivery', value: 'Theo gói CB/TC/CS', kind: 'committed' },
      { name: 'Reach / ER', value: 'Mục tiêu tối ưu', kind: 'optimization' },
      { name: 'Inbound B2B', value: 'Forecast nếu có LinkedIn line', kind: 'forecast' },
    ],
    channel_lines: ['Social retainer', 'Conversion copy / LP', 'LinkedIn thought leadership'],
    media_pass_through: false,
  }),
  DV03: pb('DV03', 'web', {
    summary: 'Website, landing page, CRO. LP đi cặp Ads; website = project; CRO cần traffic.',
    owner: 'Web Lead',
    effort: '68–320 giờ tùy gói',
    duration: '02–12 tuần',
    kickoff: 'Sitemap / brief / access hosting-CMS',
    timeline_notes: 'LP TC: 01 page + form + GA4/GTM. Website CS: trần 20 trang.',
    cta: ['Nhận tư vấn', 'Xem prototype', 'Nhận báo giá'],
    uta: 'Copywriting, domain/hosting, tool A/B tách. CVR lift là forecast.',
    included: ['UX/UI theo gói', 'Build responsive', 'Form/CRM routing (LP)', 'QA/handover'],
    excluded: ['Copywriting', 'Domain/hosting', 'Custom app', 'Testing tool license'],
    assume: ['Client cấp copy/assets và access hosting/CMS đúng hạn.', 'CRO cần đủ traffic để test.'],
    deliverables: ['Wireframe/UI', 'Page/CMS', 'Tracking event', 'QA document'],
    kpis: [
      { name: 'Pages / LP', value: 'Theo gói', kind: 'committed' },
      { name: 'Form capture test', value: '100%', kind: 'committed' },
      { name: 'CVR uplift', value: 'Forecast', kind: 'forecast' },
    ],
    channel_lines: ['Landing page', 'Corporate website', 'CRO / A/B plan'],
    media_pass_through: false,
  }),
  DV04: pb('DV04', 'performance', {
    summary: 'Paid media. Meta / Google / TikTok là slug kênh trong cùng DV — fee tách media.',
    owner: 'Performance Lead',
    effort: '44–52 giờ/tháng',
    duration: 'Retainer 03 tháng',
    kickoff: 'Pixel/CAPI + LP sống + SLA xử lý lead',
    timeline_notes: 'Không launch nếu tracking/LP chết. TikTok cần kho video (DV15 hoặc client).',
    cta: ['Đăng ký tư vấn', 'Nhận báo giá', 'Đặt lịch xem dự án'],
    uta: 'CPL/CTR là tối ưu. Lead là forecast. Media budget pass-through.',
    included: ['Campaign architecture', 'Creative test', 'Daily optimization', 'Dashboard + weekly report'],
    excluded: ['Media budget', 'Landing page production', 'Sales closing', 'Video production'],
    assume: ['Media budget, landing page và lead response SLA đã chốt.', 'TikTok: account/pixel + source video đủ.'],
    deliverables: ['Campaign/ad set', 'A/B matrix', 'Live dashboard', 'Weekly report'],
    kpis: [
      { name: 'Campaign sets / weekly reports', value: 'Theo gói', kind: 'committed' },
      { name: 'CTR / CPL', value: 'Mục tiêu tối ưu', kind: 'optimization' },
      { name: 'Leads', value: 'Forecast', kind: 'forecast' },
    ],
    channel_lines: ['Meta Ads', 'Google Search', 'TikTok Ads / Spark'],
    media_pass_through: true,
  }),
  DV05: pb('DV05', 'seo', {
    summary: 'SEO & AEO. Audit ≠ viết bài ≠ AEO — 3 line, 1 family. Cấm cam kết rank.',
    owner: 'SEO Lead',
    effort: '44–72 giờ / kỳ',
    duration: 'Audit 01–02 tuần · Content/AEO retainer 03 tháng',
    kickoff: 'Access GSC/GA4/CMS',
    timeline_notes: 'Fix kỹ thuật là việc dev client hoặc line riêng.',
    cta: ['Nhận SEO audit', 'Nhận keyword plan', 'Nhận AEO audit'],
    uta: 'Không bảo lãnh ranking / AI mention. Mention AEO là proxy.',
    included: ['Audit hoặc cluster + bài theo gói', 'On-page cơ bản', 'Backlog / schema brief'],
    excluded: ['Developer implementation', 'Backlink', 'Guaranteed ranking'],
    assume: ['Có access GSC/GA4/CMS.', 'Nền tảng technical chấp nhận được trước khi scale content.'],
    deliverables: ['Crawl/backlog hoặc bài SEO', 'On-page check', 'Monthly report'],
    kpis: [
      { name: 'Audit / articles / pages optimized', value: 'Theo gói', kind: 'committed' },
      { name: 'Organic traffic / AI visibility', value: 'Forecast', kind: 'forecast' },
    ],
    channel_lines: ['Technical SEO audit', 'SEO content', 'AEO/GEO'],
    media_pass_through: false,
  }),
  DV06: pb('DV06', 'retention', {
    summary: 'Nurture / reactivation. Voucher và sending fee do khách. Repeat order là forecast.',
    owner: 'CRM Marketing Lead',
    effort: '56 giờ / campaign',
    duration: '04–06 tuần / campaign',
    kickoff: 'RFM + consent + cơ chế offer',
    timeline_notes: 'Sales follow-up không nằm trong fee.',
    cta: ['Nhận reactivation audit', 'Quay lại nhận ưu đãi'],
    uta: 'Repeat booking/order là forecast. Voucher funding tách.',
    included: ['Segment analysis', '03 journeys', 'Offer/copy template', 'Campaign report'],
    excluded: ['Voucher funding', 'Sending fee', 'Sales follow-up'],
    assume: ['CRM data, consent và offer mechanism sẵn.'],
    deliverables: ['RFM/segment', 'Message sequence', 'Automation setup', 'Report'],
    kpis: [
      { name: 'Journeys', value: '03', kind: 'committed' },
      { name: 'Reactivation rate', value: 'Target', kind: 'optimization' },
      { name: 'Repeat order', value: 'Forecast', kind: 'forecast' },
    ],
    channel_lines: ['Reactivation campaign', 'Conversion nurture'],
    media_pass_through: false,
  }),
  DV07: pb('DV07', 'crm', {
    summary: 'AI chatbot / trợ lý bán hàng. Không bán trùng DV10. LLM fee pass-through.',
    owner: 'AI / CRM Lead',
    effort: '240 giờ impl',
    duration: '06–10 tuần',
    kickoff: 'Use-case + KB owner',
    timeline_notes: 'Human CS không nằm trong fee. Containment là tối ưu.',
    cta: ['Chat với AI demo', 'Đặt lịch AI workshop'],
    uta: 'Không cam kết containment. KB do khách duyệt/cập nhật.',
    included: ['Agent config', 'Knowledge base', 'Flows + CRM handoff', 'QA dashboard'],
    excluded: ['LLM API fee', 'Custom integration', 'Human agent operation'],
    assume: ['Knowledge source được duyệt và có owner cập nhật.'],
    deliverables: ['Prompt/guardrail', 'KB', 'Conversation flows', 'Handoff'],
    kpis: [
      { name: 'Intent / KB coverage', value: 'Theo gói', kind: 'committed' },
      { name: 'First response', value: '<10s', kind: 'optimization' },
      { name: 'Containment', value: 'Target', kind: 'optimization' },
    ],
    channel_lines: ['FAQ agent', 'Lead qualify', 'CS handoff'],
    media_pass_through: true,
  }),
  DV08: pb('DV08', 'crm', {
    summary: 'CRM implementation + lead funnel. Project, không retainer tháng.',
    owner: 'CRM Lead',
    effort: '360 giờ',
    duration: '08–12 tuần',
    kickoff: 'Chỉ định admin + data owner + access tích hợp',
    timeline_notes: 'License CRM và clean data ngoài scope. Routing <5 phút là tối ưu sales.',
    cta: ['Đặt lịch CRM discovery', 'Nhận blueprint mẫu'],
    uta: 'Custom dev / license / data cleansing ngoài scope đã chốt — add-on.',
    included: ['CRM blueprint', 'Pipeline/field', 'Lead routing', 'Import template', 'Dashboard + training'],
    excluded: ['Custom development', 'Third-party license', 'Data cleansing ngoài scope'],
    assume: ['Client chỉ định admin, data owner và access tích hợp.'],
    deliverables: ['Blueprint', 'Pipelines', 'Routing', 'Dashboards', 'Training'],
    kpis: [
      { name: 'Pipelines configured', value: 'Theo gói', kind: 'committed' },
      { name: 'Lead routing SLA', value: '<5 phút', kind: 'optimization' },
      { name: 'User activation', value: '≥80%', kind: 'optimization' },
    ],
    channel_lines: ['Pipeline + field', 'Lead routing', 'Role/dashboard'],
    media_pass_through: false,
  }),
  DV09: pb('DV09', 'crm', {
    summary: 'Tự động hoá nuôi dưỡng. Phân biệt DV11 (marketing automation impl) — không bán trùng cùng deal.',
    owner: 'Automation Lead',
    effort: '120–180 giờ',
    duration: '04–06 tuần',
    kickoff: 'Consent + field CRM',
    timeline_notes: 'Phí gửi tin pass-through. Conversion là forecast.',
    cta: ['Kích hoạt journey', 'Nhận automation audit'],
    uta: 'SMS/Zalo/email sending fee tách. Cần consent hợp lệ.',
    included: ['Journey blueprint', 'Segments', 'Templates', 'Dashboard'],
    excluded: ['Sending fee', 'CRM license', 'Copy/design ngoài template'],
    assume: ['CRM data fields và consent sẵn.'],
    deliverables: ['Journey map', 'Triggers', 'Templates', 'Scoring (nếu gói)'],
    kpis: [
      { name: 'Journeys / segments', value: 'Theo gói', kind: 'committed' },
      { name: 'Automation conversion', value: 'Forecast', kind: 'forecast' },
    ],
    channel_lines: ['Lead nurture', 'Lifecycle drip'],
    media_pass_through: true,
  }),
  DV10: pb('DV10', 'crm', {
    summary: 'AI system & intelligence (nền tảng). Conversation agent thuộc DV07.',
    owner: 'AI Lead',
    effort: 'Theo discovery',
    duration: '06–12 tuần',
    kickoff: 'Use-case + data owner + guardrail',
    timeline_notes: 'Không Active nếu trùng scope DV07 trên cùng deal mà chưa tách line.',
    cta: ['Đặt lịch AI discovery'],
    uta: 'LLM/infra fee pass-through. Outcome intelligence là proxy.',
    included: ['Architecture', 'Guardrail', 'Use-case blueprint', 'QA'],
    excluded: ['LLM API fee', 'Human ops', 'Custom model training trừ khi scope'],
    assume: ['Data owner và nguồn được duyệt.'],
    deliverables: ['Blueprint', 'Guardrail doc', 'Pilot use-case'],
    kpis: [
      { name: 'Use-cases delivered', value: 'Theo gói', kind: 'committed' },
      { name: 'Decision quality', value: 'Proxy', kind: 'forecast' },
    ],
    channel_lines: ['Intelligence layer', 'Decision support'],
    media_pass_through: true,
  }),
  DV11: pb('DV11', 'crm', {
    summary: 'Marketing automation implementation (platform). Journey vận hành tháng thuộc DV09/DV20.',
    owner: 'Automation Lead',
    effort: '180 giờ',
    duration: '04–06 tuần',
    kickoff: 'Chọn platform + consent + field',
    timeline_notes: 'Không bán chồng DV09 trên cùng phạm vi journey.',
    cta: ['Nhận automation blueprint'],
    uta: 'License platform tách. Conversion forecast.',
    included: ['Platform setup', 'Journey map', 'Template starter', 'Handover'],
    excluded: ['Sending fee', 'Ongoing retainer gửi campaign'],
    assume: ['Consent và data fields sẵn.'],
    deliverables: ['Platform config', '08 journeys starter', 'Dashboard'],
    kpis: [
      { name: 'Journeys configured', value: 'Theo gói', kind: 'committed' },
      { name: 'Automation conversion', value: 'Forecast', kind: 'forecast' },
    ],
    channel_lines: ['Platform impl', 'Starter journeys'],
    media_pass_through: true,
  }),
  DV12: pb('DV12', 'strategy', {
    summary: 'Research / audit / GTM. Cửa vào — không bán execution cùng line.',
    owner: 'Strategy Lead',
    effort: '64–96 giờ',
    duration: '02–04 tuần',
    kickoff: 'Access data/kênh + stakeholder workshop',
    timeline_notes: 'Media buying, campaign, identity execution bán DV04/DV01/DV02.',
    cta: ['Đặt lịch Growth Audit', 'Đặt lịch GTM workshop'],
    uta: 'Opportunity / launch outcome là forecast. Nghiên cứu định lượng trả phí tách.',
    included: ['Workshop', 'Audit hoặc GTM deck', 'Backlog / ICP / channel plan'],
    excluded: ['Campaign execution', 'Media budget', 'Quantitative research trả phí'],
    assume: ['Client cấp quyền truy cập dữ liệu. Stakeholder phản hồi đúng hạn.'],
    deliverables: ['Scorecard hoặc GTM deck', 'Priority backlog', '90-day roadmap'],
    kpis: [
      { name: 'Strategy deck / audit', value: '01', kind: 'committed' },
      { name: 'Priority issues / ICP', value: 'Theo gói', kind: 'committed' },
      { name: 'Growth opportunity', value: 'Forecast', kind: 'forecast' },
    ],
    channel_lines: ['Growth audit', 'GTM strategy'],
    media_pass_through: false,
  }),
  DV13: pb('DV13', 'data', {
    summary: 'Dashboard / báo cáo. GA4/GTM setup nền thuộc line tracking — thường đi trước Ads.',
    owner: 'Analytics Lead',
    effort: '52–108 giờ',
    duration: '02–06 tuần',
    kickoff: 'Access web/ads/CRM + data owner',
    timeline_notes: 'BI license, warehouse, clean data tách. Freshness là tối ưu.',
    cta: ['Nhận tracking checklist', 'Xem dashboard mẫu'],
    uta: 'Server-side / custom warehouse tách. Data accuracy là target.',
    included: ['Measurement plan hoặc dashboard', 'Event/KPI dictionary', 'QA + training'],
    excluded: ['BI license', 'Custom DWH', 'Source data cleaning'],
    assume: ['Access website/platforms và data owner sẵn.'],
    deliverables: ['Tracking plan hoặc 03 dashboards', 'UTM/KPI dict', 'QA doc'],
    kpis: [
      { name: 'Events / dashboards', value: 'Theo gói', kind: 'committed' },
      { name: 'Data freshness', value: 'Target', kind: 'optimization' },
    ],
    channel_lines: ['GA4/GTM setup', 'Performance dashboard'],
    media_pass_through: false,
  }),
  DV14: pb('DV14', 'pr', {
    summary: 'PR & báo chí. Cam kết outreach, không cam kết lên báo. Legal duyệt trước gửi.',
    owner: 'PR Lead',
    effort: '60 giờ / campaign',
    duration: '03–04 tuần',
    kickoff: 'Angle + legal/compliance',
    timeline_notes: 'Media buying / event production tách (DV18/DV17).',
    cta: ['Đọc thông cáo', 'Liên hệ báo chí'],
    uta: 'Coverage là forecast. Media quyết định độc lập.',
    included: ['PR angle', '01 press release', 'Media list + outreach', 'Coverage report'],
    excluded: ['Guaranteed publication', 'Media buying', 'Event production'],
    assume: ['Nội dung được legal/compliance duyệt.'],
    deliverables: ['Press release', 'Outreach log', 'Coverage report'],
    kpis: [
      { name: 'Press release / outreach', value: '01 / 80', kind: 'committed' },
      { name: 'Media coverage', value: 'Forecast', kind: 'forecast' },
    ],
    channel_lines: ['Press release', 'Media relations', 'ORM add-on'],
    media_pass_through: false,
  }),
  DV15: pb('DV15', 'production', {
    summary: 'Video/TVC/ảnh/live. Reels · Brand Film · Photo · Live là line. Template VID-TPL-01.',
    owner: 'Production Lead',
    effort: '06 giờ/video · 220 giờ brand film',
    duration: 'Theo batch hoặc 06–08 tuần (film)',
    kickoff: 'Chốt script/talent/location trước pre-pro (film)',
    timeline_notes: 'Revision đúng gói. Talent/studio/VFX/raw tách. Convert → Video SOP / CP.',
    cta: ['Xem video mẫu', 'Đặt lịch sản xuất', 'ĐẶT LỊCH TƯ VẤN'],
    uta: 'Watch rate / views là tối ưu hoặc forecast. Raw footage không bàn giao trừ khi mua.',
    included: ['Script/shot list', 'Edit theo format', 'Subtitle (Reels)', 'Revision theo gói'],
    excluded: ['Talent/studio/props', '3D/VFX', 'Music license cao cấp', 'Host/KOL live'],
    assume: ['Feedback gộp theo vòng. Film: budget/talent/location chốt trước pre-pro.'],
    deliverables: ['Master + cutdown theo gói', 'Cover/subtitle', 'Export 9:16/16:9'],
    kpis: [
      { name: 'Video / photo delivery', value: 'Theo gói', kind: 'committed' },
      { name: 'Revision rounds', value: '02–03', kind: 'committed' },
      { name: 'Watch rate', value: '≥35%', kind: 'optimization' },
    ],
    channel_lines: ['Short-form Reels', 'Brand Film', 'Product photo', 'Livestream'],
    media_pass_through: false,
  }),
  DV16: pb('DV16', 'pr', {
    summary: 'KOL/KOC. 2 offer: brand (PR) vs performance/affiliate. Creator fee luôn pass-through.',
    owner: 'KOL Lead',
    effort: '40–52 giờ / campaign',
    duration: 'Theo campaign',
    kickoff: 'Brief + compliance + tracking code',
    timeline_notes: 'Không cam kết view/sale. Rate creator thay đổi theo thời điểm.',
    cta: ['Xem creator shortlist', 'Nhận proposal KOL'],
    uta: 'Agency fee theo proposal. Creator fee / usage right tách. Performance forecast.',
    included: ['Strategy + shortlist', 'Booking coordination', 'Brief/compliance', 'Report'],
    excluded: ['Creator fee', 'Travel/sample', 'Usage right buyout'],
    assume: ['Availability/rate creator không lock outcome.'],
    deliverables: ['Shortlist', 'Contracts coord', 'Content checklist', 'Report'],
    kpis: [
      { name: 'Shortlist / content completion', value: '20–30 / 100%', kind: 'committed' },
      { name: 'Reach / code conversion', value: 'Forecast', kind: 'forecast' },
    ],
    channel_lines: ['Brand KOL booking', 'Performance / affiliate KOL'],
    media_pass_through: true,
  }),
  DV17: pb('DV17', 'event', {
    summary: 'Event & activation. Fee agency tách venue/vendor/talent/permit.',
    owner: 'Event Lead',
    effort: '180–280 giờ',
    duration: '04–10 tuần',
    kickoff: 'Chốt budget + venue + approval timeline',
    timeline_notes: 'Launch vs roadshow là 2 line. Lead/attendance forecast.',
    cta: ['Đăng ký sự kiện', 'Nhận activation plan'],
    uta: 'Guest/lead là forecast. Permit/insurance trừ khi scope.',
    included: ['Concept/rundown', 'Coordination venue/stage hoặc booth', 'On-site ops', 'Recap'],
    excluded: ['Venue/vendor cost', 'Talent/KOL', 'Gift/sample', 'Permit trừ khi scope'],
    assume: ['Budget, venue/location và inventory sẵn trước deploy.'],
    deliverables: ['Concept', 'Rundown', 'Guest/QR flow', 'Recap report'],
    kpis: [
      { name: 'Event / activation days', value: 'Theo gói', kind: 'committed' },
      { name: 'Attendance / leads', value: 'Forecast', kind: 'forecast' },
    ],
    channel_lines: ['Product launch', 'Roadshow / sampling'],
    media_pass_through: true,
  }),
  DV18: pb('DV18', 'performance', {
    summary: 'Media planning & booking diện rộng. Planning ≠ DV04 performance ops.',
    owner: 'Media Lead',
    effort: '40 giờ / plan',
    duration: '01–02 tuần (plan) · booking theo campaign',
    kickoff: 'Budget band + audience',
    timeline_notes: 'Reach estimate phụ thuộc inventory/season. Buying pass-through.',
    cta: ['Nhận media plan', 'Đặt lịch tư vấn'],
    uta: 'Reach là forecast. Creative production tách (DV01/DV15).',
    included: ['Channel mix', 'Budget allocation', 'Measurement plan'],
    excluded: ['Creative production', 'Performance ops hàng ngày (DV04) trừ khi scope'],
    assume: ['Estimate phụ thuộc inventory, seasonality, benchmark nền tảng.'],
    deliverables: ['Media plan', 'Calendar', 'Measurement framework'],
    kpis: [
      { name: 'Media plan', value: '01', kind: 'committed' },
      { name: 'Reach estimate', value: 'Scenario', kind: 'forecast' },
    ],
    channel_lines: ['Media strategy', 'Mass media booking'],
    media_pass_through: true,
  }),
  DV19: pb('DV19', 'performance', {
    summary: 'Vận hành & ads sàn TMĐT (kể cả TikTok Shop). Đây là DV chính thức — không để Custom/Draft mãi.',
    owner: 'Commerce Lead',
    effort: 'Theo gói CB/TC/CS',
    duration: 'Retainer tháng',
    kickoff: 'Shop account + SKU + policy sàn + rate/cost card',
    timeline_notes: 'Thiếu Rate+Cost thì status Draft, không add Quote khách. Kích hoạt khi đủ scope.',
    cta: ['Nhận đề xuất vận hành shop', 'Đặt lịch commerce discovery'],
    uta: 'GMV là forecast. Affiliate/live ngoài scope trừ khi bán line.',
    included: ['Shop ops blueprint', 'Listing/optimization theo gói', 'Ads sàn cơ bản', 'Weekly GMV report'],
    excluded: ['Inventory/fulfillment', 'Creator fee', 'Platform ads budget'],
    assume: ['Commercial hoàn thiện Rate Card + Cost Card trước Active.', 'SKU và policy sàn sẵn.'],
    deliverables: ['Ops playbook', 'Listing QA', 'Ads setup', 'Report'],
    kpis: [
      { name: 'Ops cadence / reports', value: 'Theo gói', kind: 'committed' },
      { name: 'GMV', value: 'Forecast', kind: 'forecast' },
    ],
    channel_lines: ['TikTok Shop', 'Shopee/Lazada ads', 'Livestream commerce coord'],
    media_pass_through: true,
  }),
  DV20: pb('DV20', 'retention', {
    summary: 'Email / SMS / Zalo ZNS. Không gửi nếu thiếu consent.',
    owner: 'Lifecycle Lead',
    effort: '48 giờ/tháng',
    duration: 'Retainer 03 tháng',
    kickoff: 'Consent + ESP/ZNS + segment',
    timeline_notes: 'Open/CTR tối ưu. Platform fee tách.',
    cta: ['Nhận email audit', 'Đăng ký ưu đãi'],
    uta: 'Cấm gửi tệp không consent. SMS/ZNS cost tách.',
    included: ['Lifecycle plan', 'Campaign theo gói', 'Segmentation', 'Monthly report'],
    excluded: ['ESP/ZNS fee', 'Data cleansing', 'SMS/Zalo cost'],
    assume: ['Consent và contact data hợp pháp/usable.'],
    deliverables: ['Templates', 'Sends theo cadence', 'A/B subject', 'Report'],
    kpis: [
      { name: 'Campaigns / tháng', value: 'Theo gói', kind: 'committed' },
      { name: 'Open / CTR', value: '≥25% / ≥2,5%', kind: 'optimization' },
    ],
    channel_lines: ['Email lifecycle', 'ZNS / SMS'],
    media_pass_through: true,
  }),
  DV21: pb('DV21', 'event', {
    summary: 'Trade marketing & POSM. Thường là line kèm DV01 KV hoặc DV17 activation.',
    owner: 'Trade Lead',
    effort: 'Theo số điểm bán',
    duration: 'Theo campaign',
    kickoff: 'Artwork + số điểm + permit',
    timeline_notes: 'In ấn/sản xuất POSM là pass-through trừ khi gói gồm.',
    cta: ['Nhận POSM plan'],
    uta: 'Print/production vendor tách. Interaction forecast.',
    included: ['POSM concept', 'Adaptation từ KV', 'Deployment coord theo gói'],
    excluded: ['Print run', 'Location fee', 'Gift/sample'],
    assume: ['KV/guideline sẵn (DV01) nếu không mua kèm.'],
    deliverables: ['Artwork POSM', 'Vendor brief', 'Deployment report'],
    kpis: [
      { name: 'SKU POSM / locations', value: 'Theo gói', kind: 'committed' },
      { name: 'Interaction', value: 'Forecast', kind: 'forecast' },
    ],
    channel_lines: ['POSM kit', 'In-store activation'],
    media_pass_through: true,
  }),
};

export function getDvPlaybook(dvCode: string): QuoteDvPlaybook | null {
  const dv = String(dvCode ?? '')
    .trim()
    .toUpperCase();
  return QT_DV_PLAYBOOKS[dv] ?? null;
}

export function formatPlaybookKpis(playbook: QuoteDvPlaybook, kind: QuoteDvKpiKind): string | null {
  const rows = playbook.kpis.filter((row) => row.kind === kind);
  if (!rows.length) return null;
  return rows.map((row) => `${row.name}: ${row.value}`).join(' · ');
}

export function firstNonEmpty(...values: Array<unknown>): string | null {
  for (const value of values) {
    if (value == null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return null;
}

export function mergeCatalogLists(primary: string[], fallback: string[]): string[] | null {
  const picked = primary.length ? primary : fallback;
  return picked.length ? picked : null;
}
