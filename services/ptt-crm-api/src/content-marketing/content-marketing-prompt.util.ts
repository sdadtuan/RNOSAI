import { createHash } from 'crypto';
import type { CmktItemRow } from './content-marketing.types';

export const CMKT_PROMPT_VERSION = 'cmkt-v1';

export type CmktPromptProfile =
  | 'blog_website'
  | 'social_fb'
  | 'social_fb_carousel'
  | 'social_li'
  | 'social_li_carousel'
  | 'video_short'
  | 'email_broadcast'
  | 'ad_meta'
  | 'ad_google'
  | 'generic';

export type CmktGenerateTone = 'professional_friendly' | 'bold' | 'casual' | 'formal';
export type CmktGenerateLength = 'short' | 'medium' | 'long';

export type CmktGenerateInput = {
  tone?: CmktGenerateTone;
  length?: CmktGenerateLength;
  goal?: string;
  include_outline?: boolean;
  variant_count?: number;
};

const PROFILE_RULES: Record<CmktPromptProfile, string> = {
  blog_website: 'Blog SEO-friendly: H1 rõ, intro hook, 3–5 sections, CTA cuối bài.',
  social_fb: 'Facebook social_post: hook ≤125 ký tự; body ≤500; 1 CTA; hashtag ≤5.',
  social_fb_carousel: 'Facebook carousel: 5 slide titles + caption ngắn.',
  social_li: 'LinkedIn social_post: thought leadership, hook chuyên nghiệp, body ≤700.',
  social_li_carousel: 'LinkedIn carousel: 5 slide headlines + caption.',
  video_short: 'Short video script: hook 3s, beats, CTA cuối ≤60s.',
  email_broadcast: 'Newsletter email: subject ≤50, preheader, scannable sections, 1 CTA.',
  ad_meta: 'Meta ad: headline ≤40, primary text ngắn, CTA chuẩn Meta.',
  ad_google: 'Google RSA: headline ≤30×3, description ≤90.',
  generic: 'Content marketing draft theo brand voice và funnel goal.',
};

export function resolvePromptProfile(channel: string, format: string): CmktPromptProfile {
  if (channel === 'website' && format === 'blog') return 'blog_website';
  if (channel === 'facebook' && format === 'social_post') return 'social_fb';
  if (channel === 'facebook' && format === 'carousel') return 'social_fb_carousel';
  if (channel === 'linkedin' && format === 'social_post') return 'social_li';
  if (channel === 'linkedin' && format === 'carousel') return 'social_li_carousel';
  if (channel === 'short_video' && format === 'video_script') return 'video_short';
  if ((channel === 'newsletter' || channel === 'drip') && format === 'email') return 'email_broadcast';
  if (channel === 'meta_ads' && format === 'ad_copy') return 'ad_meta';
  if (channel === 'google_ads' && format === 'ad_copy') return 'ad_google';
  return 'generic';
}

export function hashPrompt(system: string, user: string): string {
  return createHash('sha256').update(`${CMKT_PROMPT_VERSION}\n${system}\n${user}`).digest('hex').slice(0, 32);
}

export function buildDraftSystemPrompt(profile: CmktPromptProfile): string {
  return [
    'You are a senior content marketer for B2B brands in Vietnam.',
    `Profile: ${profile}. Rules: ${PROFILE_RULES[profile]}`,
    'Return JSON: { "markdown": string, "outline"?: string[] }',
  ].join('\n');
}

export function buildVariantsSystemPrompt(profile: CmktPromptProfile): string {
  return [
    'You generate headline/hook/CTA variants for content marketing.',
    `Profile: ${profile}. Rules: ${PROFILE_RULES[profile]}`,
    'Return JSON: { "variants": string[] } with distinct options.',
  ].join('\n');
}

export function buildDraftUserPrompt(
  item: CmktItemRow,
  brandContext: Record<string, unknown>,
  input: CmktGenerateInput,
): string {
  const brand = String(brandContext.brand_name ?? 'Thương hiệu').trim();
  const tone = input.tone ?? 'professional_friendly';
  const length = input.length ?? 'medium';
  const goal = input.goal || item.funnel_goal || 'engagement';
  const hook = String(item.brief_json?.hook ?? '').trim();
  return [
    `Brand: ${brand}`,
    brandContext.objective ? `Objective: ${brandContext.objective}` : '',
    brandContext.usp ? `USP: ${brandContext.usp}` : '',
    brandContext.tone_lock ? `Tone lock: ${brandContext.tone_lock}` : '',
    `Title: ${item.title}`,
    `Channel: ${item.channel} / ${item.format}`,
    `Funnel goal: ${goal}`,
    `Tone: ${tone}, Length: ${length}`,
    hook ? `Seed hook: ${hook}` : '',
    input.include_outline !== false ? 'Include outline sections in markdown.' : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildVariantsUserPrompt(
  item: CmktItemRow,
  brandContext: Record<string, unknown>,
  input: CmktGenerateInput,
): string {
  const count = Math.min(Math.max(Number(input.variant_count ?? 3), 3), 5);
  const brand = String(brandContext.brand_name ?? 'Thương hiệu').trim();
  return [
    `Brand: ${brand}`,
    `Title: ${item.title}`,
    `Channel: ${item.channel} / ${item.format}`,
    `Goal: ${input.goal || item.funnel_goal || 'engagement'}`,
    `Generate exactly ${count} distinct hook/headline variants (Vietnamese).`,
    item.body_json?.markdown ? `Current body excerpt: ${String(item.body_json.markdown).slice(0, 280)}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildDraftStub(
  item: CmktItemRow,
  brandContext: Record<string, unknown>,
  input: CmktGenerateInput,
): Record<string, unknown> {
  const brand = String(brandContext.brand_name ?? 'Thương hiệu').trim();
  const hook = String(item.brief_json?.hook ?? item.title).trim();
  const goal = input.goal || item.funnel_goal || 'engagement';
  const outline = [
    `Giới thiệu ${brand}`,
    `Vấn đề & insight (${goal})`,
    'Giải pháp / giá trị',
    'CTA',
  ];
  const markdown = [
    `# ${item.title}`,
    '',
    `**${hook || `Khám phá ${brand} — giải pháp cho ${goal}`}**`,
    '',
    `## ${outline[0]}`,
    '',
    `${brand} giúp doanh nghiệp đạt mục tiêu ${goal} với nội dung nhất quán trên ${item.channel}.`,
    '',
    `## ${outline[1]}`,
    '',
    'Insight ngắn gọn cho đối tượng B2B — pain point và cơ hội.',
    '',
    `## ${outline[2]}`,
    '',
    String(brandContext.usp ?? 'USP cốt lõi — lợi ích đo lường được.'),
    '',
    `## ${outline[3]}`,
    '',
    '👉 Liên hệ / đăng ký để nhận tư vấn.',
  ].join('\n');
  return { markdown, outline };
}

export function buildVariantsStub(item: CmktItemRow, input: CmktGenerateInput): Record<string, unknown> {
  const count = Math.min(Math.max(Number(input.variant_count ?? 3), 3), 5);
  const base = String(item.title).slice(0, 80);
  const variants: string[] = [];
  for (let i = 0; i < count; i++) {
    variants.push(`${base} — góc nhìn ${i + 1}: ${item.funnel_goal || 'engagement'}`);
  }
  return { variants };
}

export function normalizeDraftOutput(
  parsed: Record<string, unknown>,
  fallback: Record<string, unknown>,
): { markdown: string; outline?: string[] } {
  const markdown = String(parsed.markdown ?? fallback.markdown ?? '').trim();
  const outline = Array.isArray(parsed.outline)
    ? parsed.outline.map((x) => String(x))
    : (fallback.outline as string[] | undefined);
  return { markdown, outline };
}

export function normalizeVariantsOutput(
  parsed: Record<string, unknown>,
  fallback: Record<string, unknown>,
  minCount = 3,
): string[] {
  const raw = Array.isArray(parsed.variants) ? parsed.variants : fallback.variants;
  const variants = (raw as unknown[]).map((v) => String(v).trim()).filter(Boolean);
  const fallbackVariants = Array.isArray(fallback.variants) ? (fallback.variants as string[]) : [];
  while (variants.length < minCount) {
    variants.push(`${fallbackVariants[0] ?? 'Variant'} ${variants.length + 1}`);
  }
  return variants.slice(0, 5);
}
