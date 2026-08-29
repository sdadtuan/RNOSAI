export type IntakeLeadContextDto = {
  lead_id: number;
  full_name: string;
  company_name: string | null;
  industry: string | null;
  industry_slug: string | null;
  funnel_service_slug: string | null;
  presales_stage: string | null;
  l2_docs: unknown[];
  prep: { status: string; prep_stage: string; pain_excerpt: string } | null;
};

export function parseLeadMetaIndustry(meta: unknown): {
  company_name: string | null;
  industry: string | null;
  industry_slug: string | null;
} {
  let obj: Record<string, unknown> = {};
  if (typeof meta === 'string') {
    try {
      obj = JSON.parse(meta) as Record<string, unknown>;
    } catch {
      obj = {};
    }
  } else if (meta && typeof meta === 'object') {
    obj = meta as Record<string, unknown>;
  }
  const company = String(obj.company_name ?? obj.company ?? '').trim() || null;
  const industry = String(obj.industry ?? '').trim() || null;
  const industry_slug = String(obj.industry_slug ?? '').trim() || null;
  return { company_name: company, industry, industry_slug };
}
