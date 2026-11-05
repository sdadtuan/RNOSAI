export type GlossaryCreateBody = {
  term: string;
  locale: string;
  brand_id: string;
  lifecycle_id: number;
  preferred?: string;
};

export type GlossaryDraftPatch = {
  term?: string;
  locale?: string;
  brand_id?: string;
  preferred?: string;
};

function requiredText(value: unknown, error: string): string {
  const text = String(value ?? '').trim();
  if (!text) {
    throw new Error(error);
  }
  return text;
}

export function parseGlossaryCreate(body: Record<string, unknown>): GlossaryCreateBody {
  const row = body && typeof body === 'object' ? body : {};
  const term = requiredText(row.term, 'term_required');
  const locale = requiredText(row.locale, 'locale_required');
  const brand_id = requiredText(row.brand_id, 'brand_id_required');
  const lifecycle_id = Number(row.lifecycle_id);
  if (!Number.isInteger(lifecycle_id) || lifecycle_id <= 0) {
    throw new Error('lifecycle_id_required');
  }
  const parsed: GlossaryCreateBody = { term, locale, brand_id, lifecycle_id };
  const preferred = String(row.preferred ?? '').trim();
  if (preferred) parsed.preferred = preferred;
  return parsed;
}

export function parseGlossaryDraftPatch(body: Record<string, unknown>): GlossaryDraftPatch {
  const row = body && typeof body === 'object' ? body : {};
  const patch: GlossaryDraftPatch = {};
  if (row.term != null) patch.term = requiredText(row.term, 'term_required');
  if (row.locale != null) patch.locale = requiredText(row.locale, 'locale_required');
  if (row.brand_id != null) patch.brand_id = requiredText(row.brand_id, 'brand_id_required');
  if (row.preferred != null) patch.preferred = String(row.preferred).trim();
  return patch;
}

export function requiredBrandLocale(body: Record<string, unknown>): { brand_id: string; locale: string } {
  const row = body && typeof body === 'object' ? body : {};
  return {
    brand_id: requiredText(row.brand_id, 'brand_id_required'),
    locale: requiredText(row.locale, 'locale_required'),
  };
}
