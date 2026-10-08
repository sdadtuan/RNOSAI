export const R5_FIELD_KEYS = [
  'name',
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
] as const;

export type R5FieldKey = (typeof R5_FIELD_KEYS)[number];

export type R5Fields = Record<R5FieldKey, string>;

const PLACEHOLDERS = new Set(['[cần chốt]', '[cần xác nhận]']);

const METRIC_RE =
  /(\d{1,3}(?:\.\d{3})+|\d{1,3}(?:,\d{3})+|\d+(?:[.,]\d+)?)\s*(?:followers?|fans?|ratings?|reviews?|likes?|views?|subscribers?|comments?|impressions?|reach|sao|người theo dõi|đánh giá|lượt thích|lượt xem|người đăng ký|bình luận)(?![\p{L}\p{N}_])/giu;

const MONEY_RE =
  /(?:\d{1,3}(?:\.\d{3})+|\d{1,3}(?:,\d{3})+|\d{7,})(?:\s*(?:đ|vnđ|vnd|đồng))?|\d+(?:[.,]\d+)?\s*(?:triệu|tỷ)(?![\p{L}\p{N}_])/giu;

export interface ClientPlanSanitizeBrief {
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

export interface ClientPlanSanitizeContext {
  brief: ClientPlanSanitizeBrief;
  sourceText: string;
  imageUrls: string[];
  humanEdited: Partial<R5Fields & { competitors?: string | null }>;
}

export function sanitizeClientPlanDraft(
  draft: Partial<R5Fields & { cover_image_url?: string | null; competitors?: string | null }> | null | undefined,
  ctx: ClientPlanSanitizeContext,
): R5Fields & { cover_image_url: string | null; competitors: string } {
  const source = draft ?? {};
  const briefNumbers = collectNumbers(briefCorpus(ctx.brief));
  const metricNumbers = collectNumbers(`${ctx.sourceText}\n${String(ctx.brief.metrics ?? '')}`);
  const fields = {} as R5Fields;
  for (const key of R5_FIELD_KEYS) {
    const edited = String(ctx.humanEdited[key] ?? '').trim();
    fields[key] = edited
      ? edited
      : scrubFacts(String(source[key] ?? ''), briefNumbers, metricNumbers);
  }
  return {
    ...fields,
    cover_image_url: coverFromList(source.cover_image_url, ctx.imageUrls),
    competitors: sanitizeCompetitors(source.competitors, ctx),
  };
}

function scrubFacts(text: string, briefNumbers: Set<string>, metricNumbers: Set<string>): string {
  const metrics = text.replace(METRIC_RE, (match) => (numberGrounded(match, metricNumbers) ? match : '[cần xác nhận]'));
  return metrics.replace(MONEY_RE, (match) => (numberGrounded(match, briefNumbers) ? match : '[cần chốt]'));
}

function sanitizeCompetitors(
  draftValue: string | null | undefined,
  ctx: ClientPlanSanitizeContext,
): string {
  const edited = String(ctx.humanEdited.competitors ?? '').trim();
  if (edited) return edited;
  const fromBrief = String(ctx.brief.competitors ?? '').trim();
  if (filled(fromBrief)) return fromBrief;
  const text = String(draftValue ?? '').trim();
  if (!filled(text)) return text;
  const source = ctx.sourceText.toLowerCase();
  const kept = text
    .split(/[,;\n|]/)
    .map((part) => part.trim())
    .filter((part) => part && source.includes(part.toLowerCase()));
  return kept.length ? kept.join(', ') : '[cần xác nhận]';
}

function coverFromList(url: string | null | undefined, imageUrls: string[]): string | null {
  const text = String(url ?? '').trim();
  if (!text) return null;
  const allowed = imageUrls.map((item) => String(item).trim()).filter(Boolean);
  if (allowed.includes(text)) return text;
  try {
    const href = new URL(text).href;
    return allowed.find((item) => {
      try {
        return new URL(item).href === href;
      } catch {
        return false;
      }
    }) ?? null;
  } catch {
    return null;
  }
}

function briefCorpus(brief: ClientPlanSanitizeBrief): string {
  return [
    brief.audience,
    brief.usp,
    brief.goal,
    brief.channels,
    brief.retain,
    brief.competitors,
    brief.metrics,
    brief.website,
    brief.fanpage,
    brief.budget,
  ]
    .map((value) => String(value ?? ''))
    .join('\n');
}

function collectNumbers(text: string): Set<string> {
  const found = new Set<string>();
  for (const match of text.matchAll(/\d{1,3}(?:\.\d{3})+|\d{1,3}(?:,\d{3})+|\d+/g)) {
    const digits = match[0].replace(/\D/g, '');
    if (digits) found.add(digits);
  }
  return found;
}

function numberGrounded(match: string, allowed: Set<string>): boolean {
  const numeric = match.match(/\d[\d.,]*/)?.[0] ?? '';
  const digits = numeric.replace(/\D/g, '');
  return Boolean(digits) && allowed.has(digits);
}

function filled(value: string): boolean {
  return value.length > 0 && !PLACEHOLDERS.has(value);
}
