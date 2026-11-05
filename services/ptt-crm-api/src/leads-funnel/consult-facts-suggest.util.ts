export const CONSULT_CHANNEL_OPTIONS = [
  'Facebook Ads',
  'Google Ads',
  'Zalo',
  'SEO',
  'TikTok',
  'Fanpage',
  'Website / landing',
] as const;

export interface ConsultFactsSuggestInput {
  company: string;
  niche: string;
  need: string;
  serviceLabel: string;
  metrics?: string | null;
  budget?: string | null;
}

export interface ConsultFactsSuggest {
  usp: string;
  goals: string[];
  channels: string[];
  close: string;
}

const MONEY_RE =
  /(?:\d{1,3}(?:\.\d{3})+|\d{1,3}(?:,\d{3})+|\d{7,})(?:\s*(?:đ|vnđ|vnd|đồng))?|\d+(?:[.,]\d+)?\s*(?:triệu|tỷ)(?![\p{L}\p{N}_])/giu;

const GOAL_STUBS = [
  'Tăng số lịch đặt đúng tệp khách — mốc số [cần chốt]',
  'Giảm chi phí mỗi lịch hẹn — mốc [cần chốt]',
  'Tăng tỷ lệ khách đến sau khi để lại số — mốc [cần chốt]',
];

export function buildConsultFactsSuggestCall(input: ConsultFactsSuggestInput): {
  systemPrompt: string;
  userContent: string;
  stubJson: () => Record<string, unknown>;
} {
  const channels = CONSULT_CHANNEL_OPTIONS.join(', ');
  return {
    systemPrompt: [
      'Trả về đúng một object JSON với các khóa usp, goals, channels, close.',
      'usp là một hoặc hai câu tiếng Việt về điểm khác biệt, suy từ ngành và nhu cầu đã cho.',
      'goals là mảng đúng 3 câu mục tiêu đo được. Không bịa số, %, tiền, CPL, giờ, phí. Chỗ cần số thì ghi [cần chốt].',
      `channels là mảng tên kênh, chỉ được chọn trong: ${channels}.`,
      'close là một câu cách chốt đơn, không bịa giá hay phí.',
    ].join(' '),
    userContent: [
      `Công ty: ${input.company}`,
      `Ngành: ${input.niche}`,
      `Nhu cầu: ${input.need}`,
      `Dịch vụ: ${input.serviceLabel}`,
      input.metrics?.trim() ? `Số liệu sales đã ghi: ${input.metrics.trim()}` : '',
      input.budget?.trim() ? `Ngân sách sales đã ghi: ${input.budget.trim()}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
    stubJson: () => stubSuggest(input) as unknown as Record<string, unknown>,
  };
}

export function normalizeConsultFactsSuggest(
  parsed: Record<string, unknown> | null | undefined,
  input: ConsultFactsSuggestInput,
): ConsultFactsSuggest {
  const allowed = collectNumbers(groundedCorpus(input));
  const source = parsed ?? {};
  const usp = clip(scrubNumbers(String(source.usp ?? ''), allowed), 500) || stubUsp(input);
  const goals = normalizeGoals(source.goals, allowed);
  const channels = normalizeChannels(source.channels, input);
  const close = clip(scrubNumbers(String(source.close ?? ''), allowed), 240) || stubClose();
  return { usp, goals, channels, close };
}

function stubSuggest(input: ConsultFactsSuggestInput): ConsultFactsSuggest {
  return {
    usp: stubUsp(input),
    goals: GOAL_STUBS,
    channels: channelsFromFacts(input),
    close: stubClose(),
  };
}

function stubUsp(input: ConsultFactsSuggestInput): string {
  const company = input.company.trim() || 'Khách hàng';
  const niche = input.niche.trim();
  const need = input.need.trim();
  return clip(`${company}${niche ? ` (${niche})` : ''}: ${need}`, 500);
}

function stubClose(): string {
  return 'Khách để lại số điện thoại, AE gọi xác nhận lịch trong ngày.';
}

function normalizeGoals(raw: unknown, allowed: Set<string>): string[] {
  const list = Array.isArray(raw)
    ? raw.map((item) => String(item ?? ''))
    : String(raw ?? '')
        .split('\n')
        .map((item) => item.trim());
  const goals: string[] = [];
  for (const item of list) {
    const text = clip(scrubNumbers(item, allowed), 240);
    if (text && !goals.includes(text)) goals.push(text);
    if (goals.length === 3) break;
  }
  for (const stub of GOAL_STUBS) {
    if (goals.length === 3) break;
    if (!goals.includes(stub)) goals.push(stub);
  }
  return goals;
}

function normalizeChannels(raw: unknown, input: ConsultFactsSuggestInput): string[] {
  const list = Array.isArray(raw) ? raw.map((item) => String(item ?? '')) : String(raw ?? '').split(/[,;\n]/);
  const channels: string[] = [];
  for (const item of list) {
    const known = matchChannel(item);
    if (known && !channels.includes(known)) channels.push(known);
  }
  return channels.length ? channels : channelsFromFacts(input);
}

function channelsFromFacts(input: ConsultFactsSuggestInput): string[] {
  const blob = `${input.need} ${input.niche} ${input.serviceLabel}`.toLowerCase();
  const out: string[] = [];
  const add = (label: (typeof CONSULT_CHANNEL_OPTIONS)[number], keys: string[]) => {
    if (keys.some((key) => blob.includes(key)) && !out.includes(label)) out.push(label);
  };
  add('Facebook Ads', ['facebook', 'fb']);
  add('Google Ads', ['google']);
  add('Zalo', ['zalo']);
  add('SEO', ['seo']);
  add('TikTok', ['tiktok']);
  add('Fanpage', ['fanpage']);
  add('Website / landing', ['website', 'landing']);
  if (blob.includes('ads') || blob.includes('quảng cáo')) {
    add('Facebook Ads', ['ads', 'quảng cáo']);
    add('Google Ads', ['ads', 'quảng cáo']);
  }
  if (!out.length) {
    out.push('Facebook Ads', 'Google Ads');
  }
  return out;
}

function matchChannel(raw: string): string | null {
  const text = raw.trim().toLowerCase();
  if (!text) return null;
  return CONSULT_CHANNEL_OPTIONS.find((option) => option.toLowerCase() === text) ?? null;
}

function groundedCorpus(input: ConsultFactsSuggestInput): string {
  return [input.company, input.niche, input.need, input.metrics, input.budget].map((value) => String(value ?? '')).join('\n');
}

function collectNumbers(text: string): Set<string> {
  const found = new Set<string>();
  for (const match of text.matchAll(/\d{1,3}(?:\.\d{3})+|\d{1,3}(?:,\d{3})+|\d+/g)) {
    const digits = match[0].replace(/\D/g, '');
    if (digits) found.add(digits);
  }
  return found;
}

function scrubNumbers(text: string, allowed: Set<string>): string {
  const money = text.replace(MONEY_RE, (match) => (numberGrounded(match, allowed) ? match : '[cần chốt]'));
  return money
    .replace(/\d+(?:[.,]\d+)?/g, (match) => (numberGrounded(match, allowed) ? match : '[cần chốt]'))
    .replace(/\s+/g, ' ')
    .trim();
}

function numberGrounded(match: string, allowed: Set<string>): boolean {
  const numeric = match.match(/\d[\d.,]*/)?.[0] ?? '';
  const digits = numeric.replace(/\D/g, '');
  return Boolean(digits) && allowed.has(digits);
}

function clip(text: string, max: number): string {
  const trimmed = text.trim();
  return trimmed.length <= max ? trimmed : trimmed.slice(0, max).trim();
}
