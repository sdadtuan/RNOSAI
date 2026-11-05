export interface ClientPlanDeckPlan {
  name?: string | null;
  north_star?: string | null;
  objectives?: string | null;
  strategy_framework?: Record<string, string> | null;
  cover_image_url?: string | null;
  competitors?: string | null;
}

export interface ClientPlanDeckBrief {
  audience?: string | null;
  usp?: string | null;
  goal?: string | null;
  channels?: string | null;
  retain?: string | null;
  competitors?: string | null;
  metrics?: string | null;
  website?: string | null;
  fanpage?: string | null;
  budget?: string | null;
}

export interface ClientPlanDeckLead {
  company_name?: string | null;
  service_label?: string | null;
  niche?: string | null;
  need?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
}

export interface ClientPlanSlide {
  id: string;
  kicker: string;
  title: string;
  body: string[];
  footer: string;
  source: string;
  imageUrl: string | null;
  cover: boolean;
}

const TOKEN_CONFIRM = '[cần xác nhận]';
const TOKEN_LOCK = '[cần chốt]';

export function clientPlanExportFilename(clientName: string, ext: 'pptx' | 'pdf' = 'pptx'): string {
  const slug =
    String(clientName ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .replace(/[^a-zA-Z0-9]+/g, '') || 'Khach';
  return `PTT_${slug}_KeHoachMarketing.${ext}`;
}

export function buildClientPlanDeck(
  plan: ClientPlanDeckPlan,
  brief: ClientPlanDeckBrief,
  lead: ClientPlanDeckLead,
): { slides: ClientPlanSlide[] } {
  const client = text(lead.company_name) || 'Khách hàng';
  const framework = plan.strategy_framework ?? {};
  const north = text(plan.north_star) || TOKEN_CONFIRM;
  const objectives = text(plan.objectives);
  const target = text(framework.target_market) || text(brief.audience) || TOKEN_CONFIRM;
  const message = text(framework.market_message) || TOKEN_CONFIRM;
  const media = text(framework.media_reach);
  const conversion = text(framework.conversion_strategy) || TOKEN_CONFIRM;
  const nurture = text(framework.nurture_system) || TOKEN_CONFIRM;
  const retention = text(framework.retention_system) || TOKEN_CONFIRM;
  const experience = text(framework.world_class_experience) || TOKEN_CONFIRM;
  const lifecycle = text(framework.lifecycle_extension) || TOKEN_CONFIRM;
  const referral = text(framework.referral_engine) || TOKEN_CONFIRM;
  const rivals = text(plan.competitors) || text(brief.competitors) || TOKEN_CONFIRM;
  const budget = moneyLine(brief.budget);
  const channels = splitList(text(brief.channels) || media);
  const groups = target === TOKEN_CONFIRM ? [] : splitList(target, /[;\n]/).slice(0, 4);
  const month = monthLabel(new Date());
  const coverImage = text(plan.cover_image_url) || null;

  const drafts: Array<Omit<ClientPlanSlide, 'footer'> & { footer?: string }> = [
    {
      id: 'cover',
      kicker: 'PTT ADVERTISING',
      title: 'Kế hoạch tiếp thị tích hợp',
      body: [client, text(lead.address), text(lead.phone) ? `Điện thoại: ${text(lead.phone)}` : '', `PTT Advertising Solutions · ${month}`].filter(Boolean),
      source: 'lead.company_name',
      imageUrl: coverImage,
      cover: true,
    },
    {
      id: 'toc',
      kicker: 'MỤC LỤC',
      title: 'Nội dung',
      body: [
        'I Tóm tắt yêu cầu',
        'II Hiện trạng',
        'III Khách hàng mục tiêu',
        'IV Đối thủ',
        'V Điểm bán và dịch vụ',
        'VI Chiến lược truyền thông',
        '01 Chỉ số dẫn đường',
        '02 Phễu chuyển đổi',
        '03 Nuôi khách',
        '04 Giữ chân',
        '05 Vòng đời',
        '06 Giới thiệu',
        '07 Trải nghiệm',
        'VII 90 ngày',
        'VIII Ngân sách và KPI',
      ],
      source: 'toc',
      imageUrl: null,
      cover: false,
    },
    section('I', 'Tóm tắt yêu cầu', [
      `Dịch vụ: ${text(lead.service_label) || '—'}.`,
      `Nhu cầu: ${text(lead.need) || TOKEN_CONFIRM}`,
      `Ngân sách: ${budget}. Một dòng, không tách ads / phí / sản xuất.`,
      `Kênh: ${text(brief.channels) || '—'}`,
    ], 'brief'),
    section('II', 'Hiện trạng', [
      text(brief.website) ? `Website: ${text(brief.website)}` : 'Chưa có website.',
      text(brief.fanpage) ? `Fanpage: ${text(brief.fanpage)}` : '',
      text(brief.metrics) || TOKEN_CONFIRM,
    ].filter(Boolean), 'brief.metrics'),
    section(
      'III',
      'Khách hàng mục tiêu',
      groups.length ? groups.map((group, index) => `P${index + 1}. ${group}`) : [target],
      'target_market',
    ),
    section('IV', 'Đối thủ', [rivals], 'competitors'),
    section('V', 'Điểm bán và dịch vụ', [message, `Giá gói: ${TOKEN_LOCK}`], 'market_message'),
    section('VI', 'Chiến lược truyền thông', channels.length ? channels : [media || TOKEN_CONFIRM], 'media_reach'),
    section('01', 'Chỉ số dẫn đường', [north, objectives && objectives !== north ? objectives : ''].filter(Boolean), 'north_star'),
    section('02', 'Phễu chuyển đổi', splitList(conversion).length ? splitList(conversion) : [conversion], 'conversion_strategy'),
    section('03', 'Nuôi khách', [nurture], 'nurture_system'),
    section('04', 'Giữ chân', [retention], 'retention_system'),
    section('05', 'Vòng đời', exactToken(lifecycle) ? [lifecycle] : [lifecycle], 'lifecycle_extension'),
    section('06', 'Giới thiệu', exactToken(referral) ? [referral] : [referral], 'referral_engine'),
    section('07', 'Trải nghiệm', exactToken(experience) ? [experience] : splitList(experience, /[\n;]/), 'world_class_experience'),
    section('VII', '90 ngày', ninetyDays({ north, conversion, nurture, retention, experience }), 'chapters-01-07'),
    section('VIII', 'Ngân sách và KPI', [
      `Ngân sách đã nhập: ${budget}`,
      `North Star: ${north}`,
      `Phí PTT: ${TOKEN_LOCK}`,
      `CPL: ${TOKEN_LOCK}`,
      `Số hợp đồng: ${TOKEN_LOCK}`,
      'Giám đốc PTT chốt',
    ], 'brief.budget'),
    section('thanks', client, [text(lead.phone), text(lead.email)].filter(Boolean), 'lead'),
  ];

  const slides = drafts.map((slide, index) => ({
    ...slide,
    body: slide.body.map((line) => line.trim()).filter(Boolean),
    footer: `PTT Advertising · ${client} · ${index + 1}`,
    imageUrl: slide.cover ? slide.imageUrl : null,
  }));
  const thanks = slides[slides.length - 1];
  if (thanks) thanks.kicker = 'CẢM ƠN';
  return { slides };
}

function section(id: string, title: string, body: string[], source: string): Omit<ClientPlanSlide, 'footer'> {
  return { id, kicker: id, title, body, source, imageUrl: null, cover: false };
}

function ninetyDays(input: {
  north: string;
  conversion: string;
  nurture: string;
  retention: string;
  experience: string;
}): string[] {
  return [
    `30 ngày: ${usable([input.north, input.conversion])}`,
    `60 ngày: ${usable([input.nurture, input.retention])}`,
    `90 ngày: ${usable([input.experience])}. Không thêm chỉ số mới.`,
  ];
}

function usable(parts: string[]): string {
  const kept = parts.map((part) => part.trim()).filter((part) => part && !exactToken(part));
  return kept.join('; ') || TOKEN_CONFIRM;
}

function moneyLine(budget: string | null | undefined): string {
  const value = text(budget);
  if (!value || exactToken(value)) return TOKEN_LOCK;
  return value;
}

function exactToken(value: string): boolean {
  return value === TOKEN_CONFIRM || value === TOKEN_LOCK;
}

function splitList(value: string, pattern = /[,\n]/): string[] {
  return value
    .split(pattern)
    .map((part) => part.trim())
    .filter((part) => part && !exactToken(part));
}

function text(value: string | null | undefined): string {
  return String(value ?? '').trim();
}

function monthLabel(date: Date): string {
  return `Tháng ${date.getMonth() + 1}/${date.getFullYear()}`;
}
