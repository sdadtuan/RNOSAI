import { briefFieldFilled, type ClientPlanBrief, type ClientPlanLeadFacts } from './client-plan-brief.util';
import {
  R5_FIELD_KEYS,
  sanitizeClientPlanDraft,
  type ClientPlanSanitizeBrief,
  type R5FieldKey,
  type R5Fields,
} from './client-plan-sanitize.util';

const MODEL_KEYS = [
  'north_star',
  'objectives',
  'target_market',
  'market_message',
  'media_reach',
  'conversion_strategy',
  'retention_system',
  'nurture_system',
  'world_class_experience',
  'lifecycle_extension',
  'referral_engine',
  'competitors',
  'cover_image_url',
] as const;

export type ClientPlanModelKey = (typeof MODEL_KEYS)[number];

export interface ClientPlanDraftLocked extends Partial<R5Fields> {
  competitors?: string;
  cover_image_url?: string | null;
}

export interface ClientPlanDraftCall {
  schemaKeys: ClientPlanModelKey[];
  locked: ClientPlanDraftLocked;
  systemPrompt: string;
  userContent: string;
  imageUrls: string[];
  brief: ClientPlanSanitizeBrief;
  sourceText: string;
  humanEdited: Partial<R5Fields>;
  hasPublicSource: boolean;
  stubJson: () => Record<string, unknown>;
}

export function selectClientPlanModel(input: {
  hasPublicSource: boolean;
  mktAiModel?: string | null;
  llmModel?: string | null;
}): { model: string; vision: boolean } {
  const mkt = String(input.mktAiModel ?? '').trim();
  if (input.hasPublicSource && mkt) return { model: mkt, vision: true };
  if (!input.hasPublicSource) return { model: 'gpt-4o-mini', vision: false };
  return { model: String(input.llmModel ?? '').trim() || 'gpt-4o-mini', vision: false };
}

export function humanEditedR5Fields(
  keys: string[],
  content: { name: string; north_star: string; objectives: string; strategy_framework: Record<string, string> },
): Partial<R5Fields> {
  const out: Partial<R5Fields> = {};
  for (const key of keys) {
    const value =
      key === 'name'
        ? content.name
        : key === 'north_star'
          ? content.north_star
          : key === 'objectives'
            ? content.objectives
            : content.strategy_framework[key];
    if (String(value ?? '').trim()) out[key as R5FieldKey] = String(value).trim();
  }
  return out;
}

export function buildClientPlanDraftCall(input: {
  brief: ClientPlanBrief;
  lead: ClientPlanLeadFacts;
  serviceLabel: string;
  sourceText: string;
  imageUrls: string[];
  humanEdited: Partial<R5Fields>;
  hasPublicSource: boolean;
  budget?: string | null;
}): ClientPlanDraftCall {
  const company = String(input.lead.company_name ?? '').trim() || 'Khách hàng';
  const service = String(input.serviceLabel ?? '').trim();
  const locked: ClientPlanDraftLocked = {
    name: `KH MKT sơ bộ — ${company}${service ? ` (${service})` : ''}`,
  };
  if (!input.hasPublicSource || briefFieldFilled(input.brief.audience)) {
    locked.target_market = briefFieldFilled(input.brief.audience)
      ? input.brief.audience.trim()
      : '[cần xác nhận]';
  }
  if (!input.hasPublicSource || briefFieldFilled(input.brief.competitors)) {
    locked.competitors = briefFieldFilled(input.brief.competitors)
      ? input.brief.competitors.trim()
      : '[cần xác nhận]';
  }
  if (!input.hasPublicSource) locked.cover_image_url = null;
  if (!briefFieldFilled(input.brief.retain)) {
    locked.lifecycle_extension = '[cần xác nhận]';
    locked.referral_engine = '[cần xác nhận]';
  }
  for (const key of R5_FIELD_KEYS) {
    const edited = String(input.humanEdited[key] ?? '').trim();
    if (edited) locked[key] = edited;
  }

  const schemaKeys = MODEL_KEYS.filter((key) => !Object.prototype.hasOwnProperty.call(locked, key));
  const brief = toSanitizeBrief(input.brief, input.budget);
  const sourceText = String(input.sourceText ?? '');
  const imageUrls = input.imageUrls.map((url) => String(url).trim()).filter(Boolean);
  return {
    schemaKeys,
    locked,
    systemPrompt: [
      'Trả về đúng một object JSON.',
      `Chỉ các khóa: ${schemaKeys.join(', ')}.`,
      'Không bịa số tiền, follower, rating, tên đối thủ hoặc URL ảnh.',
      'Ảnh bìa chỉ được là một URL trong danh sách đã cho, hoặc null.',
    ].join(' '),
    userContent: buildUserContent(input, company, sourceText, imageUrls),
    imageUrls,
    brief,
    sourceText,
    humanEdited: input.humanEdited,
    hasPublicSource: input.hasPublicSource,
    stubJson: () => stubDraft(schemaKeys, input, imageUrls),
  };
}

export function mergeClientPlanModelDraft(
  modelJson: Record<string, unknown>,
  built: ClientPlanDraftCall,
): R5Fields & { cover_image_url: string | null; competitors: string } {
  const draft: Partial<R5Fields & { cover_image_url?: string | null; competitors?: string }> = {};
  for (const key of built.schemaKeys) {
    const raw = modelJson[key];
    if (key === 'cover_image_url') {
      draft.cover_image_url = raw == null || !String(raw).trim() ? null : String(raw).trim();
    } else if (key === 'competitors') {
      draft.competitors = String(raw ?? '');
    } else {
      draft[key] = String(raw ?? '');
    }
  }
  for (const key of R5_FIELD_KEYS) {
    const value = built.locked[key];
    if (value != null && String(value).trim()) draft[key] = String(value).trim();
  }
  if (built.locked.competitors != null) draft.competitors = built.locked.competitors;
  if (Object.prototype.hasOwnProperty.call(built.locked, 'cover_image_url')) {
    draft.cover_image_url = built.locked.cover_image_url ?? null;
  }
  return sanitizeClientPlanDraft(draft, {
    brief: built.brief,
    sourceText: built.sourceText,
    imageUrls: built.imageUrls,
    humanEdited: built.humanEdited,
  });
}

function toSanitizeBrief(brief: ClientPlanBrief, budget?: string | null): ClientPlanSanitizeBrief {
  return {
    audience: brief.audience,
    usp: brief.usp,
    goal: brief.goal,
    channels: brief.channels,
    retain: brief.retain,
    competitors: brief.competitors,
    metrics: brief.metrics,
    website: brief.website,
    fanpage: brief.fanpage,
    budget,
  };
}

function buildUserContent(
  input: {
    brief: ClientPlanBrief;
    lead: ClientPlanLeadFacts;
    budget?: string | null;
  },
  company: string,
  sourceText: string,
  imageUrls: string[],
): string {
  return [
    `Công ty: ${company}`,
    `Ngành: ${String(input.lead.niche ?? '').trim()}`,
    `Nhu cầu: ${String(input.lead.need ?? '').trim()}`,
    `Điểm khác biệt: ${input.brief.usp}`,
    `Mục tiêu: ${input.brief.goal}`,
    `Kênh và cách chốt: ${input.brief.channels}`,
    `Khách của họ: ${input.brief.audience}`,
    `Khách cũ: ${input.brief.retain}`,
    `Đối thủ sales đã ghi: ${input.brief.competitors}`,
    `Số liệu sales đã ghi: ${input.brief.metrics}`,
    input.budget ? `Ngân sách: ${input.budget}` : '',
    input.brief.website?.trim() ? `Website: ${input.brief.website.trim()}` : '',
    input.brief.fanpage?.trim() ? `Fanpage: ${input.brief.fanpage.trim()}` : '',
    sourceText.trim()
      ? `Nội dung trang đã tải:\n${sourceText}`
      : input.brief.website?.trim() || input.brief.fanpage?.trim()
        ? 'Chưa đọc được nội dung trang. Viết từ link và thông tin sales đã ghi, không bịa số.'
        : 'Không có website hoặc fanpage.',
    imageUrls.length ? `Ảnh được phép: ${imageUrls.join(', ')}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function stubDraft(
  schemaKeys: readonly ClientPlanModelKey[],
  input: { brief: ClientPlanBrief; lead: ClientPlanLeadFacts },
  imageUrls: string[],
): Record<string, unknown> {
  const stub: Record<string, unknown> = {};
  for (const key of schemaKeys) {
    if (key === 'cover_image_url') stub[key] = imageUrls[0] ?? null;
    else if (key === 'north_star') stub[key] = input.brief.goal;
    else if (key === 'objectives') {
      stub[key] = [input.lead.need, input.brief.goal, input.brief.usp].filter(Boolean).join('\n');
    } else if (key === 'market_message') stub[key] = [input.brief.usp, input.lead.niche].filter(Boolean).join(' — ');
    else if (key === 'media_reach' || key === 'conversion_strategy' || key === 'nurture_system') {
      stub[key] = input.brief.channels;
    } else if (key === 'retention_system') stub[key] = input.brief.retain || `[đề xuất] ${String(input.lead.need ?? '').trim()}`.trim();
    else if (key === 'world_class_experience') stub[key] = input.brief.usp;
    else if (key === 'target_market') stub[key] = input.brief.audience;
    else stub[key] = '';
  }
  return stub;
}
