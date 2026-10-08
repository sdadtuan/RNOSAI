import { parseTargetMarketProfJson } from './presales-ai-draft-meta.util';

export const CLIENT_BRIEF_KEY = 'client_brief';

const PLACEHOLDERS = new Set(['[cần chốt]', '[cần xác nhận]']);

export interface ClientPlanBrief {
  audience: string;
  usp: string;
  goal: string;
  channels: string;
  retain: string;
  competitors: string;
  metrics: string;
  website: string;
  fanpage: string;
  saved_after_ai: boolean;
  human_edited_keys: string[];
}

export interface ClientPlanLeadFacts {
  company_name?: string | null;
  niche?: string | null;
  need?: string | null;
}

export function emptyClientBrief(): ClientPlanBrief {
  return {
    audience: '',
    usp: '',
    goal: '',
    channels: '',
    retain: '',
    competitors: '',
    metrics: '',
    website: '',
    fanpage: '',
    saved_after_ai: false,
    human_edited_keys: [],
  };
}

export function briefFieldFilled(value: unknown): boolean {
  const text = String(value ?? '').trim();
  return text.length > 0 && !PLACEHOLDERS.has(text);
}

export function readClientBrief(profJson: unknown): ClientPlanBrief {
  const prof = parseTargetMarketProfJson(profJson);
  const raw = String(prof[CLIENT_BRIEF_KEY] ?? '').trim();
  if (!raw) return emptyClientBrief();
  try {
    return normalizeClientBrief(JSON.parse(raw));
  } catch {
    return emptyClientBrief();
  }
}

export function writeClientBrief(
  prof: Record<string, string>,
  brief: Partial<ClientPlanBrief>,
): Record<string, string> {
  const current = readClientBrief(prof);
  return {
    ...prof,
    [CLIENT_BRIEF_KEY]: JSON.stringify(normalizeClientBrief({ ...current, ...brief })),
  };
}

export function clientBriefMissing(
  brief: Partial<ClientPlanBrief>,
  lead: ClientPlanLeadFacts,
): string[] {
  const missing: string[] = [];
  if (!briefFieldFilled(lead.company_name)) missing.push('Tên công ty trên hồ sơ lead');
  if (!briefFieldFilled(lead.niche)) missing.push('Ngành KH');
  if (!briefFieldFilled(lead.need)) missing.push('Nhu cầu cụ thể');
  if (!briefFieldFilled(brief.usp)) missing.push('Điểm khác biệt');
  if (!briefFieldFilled(brief.goal)) missing.push('Mục tiêu đo được');
  if (!briefFieldFilled(brief.channels)) missing.push('Kênh muốn chạy và cách chốt đơn');
  return missing;
}

export function leadQualifyFacts(
  tasks: Array<{ form_data?: Record<string, unknown> | null }>,
): { niche: string; need: string } {
  const form = tasks[0]?.form_data ?? {};
  return {
    niche: String(form.niche ?? form.industry ?? '').trim(),
    need: String(form.need ?? '').trim(),
  };
}

export function prefillClientBriefFromTasks(
  brief: Partial<ClientPlanBrief>,
  tasks: Array<{ form_data?: Record<string, unknown> | null }>,
): ClientPlanBrief {
  const next = normalizeClientBrief(brief);
  for (const task of tasks) {
    const form = task.form_data ?? {};
    if (!briefFieldFilled(next.usp)) {
      const usp = String(form.usp ?? form.product_usp ?? '').trim();
      if (briefFieldFilled(usp)) next.usp = usp;
    }
    if (!briefFieldFilled(next.competitors)) {
      const rivals = String(form.top_competitors ?? form.competitors ?? '').trim();
      if (briefFieldFilled(rivals)) next.competitors = rivals;
    }
    if (!briefFieldFilled(next.website)) {
      const site = String(form.domain ?? form.website ?? form.website_url ?? '').trim();
      if (briefFieldFilled(site)) next.website = site;
    }
    if (!briefFieldFilled(next.fanpage)) {
      const page = String(form.fanpage ?? form.fanpage_url ?? '').trim();
      if (briefFieldFilled(page)) next.fanpage = page;
    }
  }
  return next;
}

function normalizeClientBrief(raw: Partial<ClientPlanBrief> | null | undefined): ClientPlanBrief {
  const base = emptyClientBrief();
  const source = raw ?? {};
  const textKeys = [
    'audience',
    'usp',
    'goal',
    'channels',
    'retain',
    'competitors',
    'metrics',
    'website',
    'fanpage',
  ] as const;
  for (const key of textKeys) {
    base[key] = String(source[key] ?? '').trim();
  }
  base.saved_after_ai = source.saved_after_ai === true;
  base.human_edited_keys = Array.isArray(source.human_edited_keys)
    ? source.human_edited_keys.map((key) => String(key).trim()).filter(Boolean)
    : [];
  return base;
}
