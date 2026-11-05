/** Hidden keys in target_market_prof_json — not shown in R5 strategy fields. */
export const PRESALES_AI_DRAFT_AT_KEY = '_presales_ai_draft_at';
export const PRESALES_AI_DRAFT_BY_KEY = '_presales_ai_draft_by';
export const PRESALES_AI_DRAFT_MODEL_KEY = '_presales_ai_draft_model';

export const PRESALES_AI_DRAFT_BADGE_VI = 'Bản nháp — SP duyệt';

export function stampPresalesAiDraftMeta(
  prof: Record<string, string> | undefined,
  actorEmail: string,
  modelName?: string,
): Record<string, string> {
  const next: Record<string, string> = {
    ...(prof ?? {}),
    [PRESALES_AI_DRAFT_AT_KEY]: new Date().toISOString(),
    [PRESALES_AI_DRAFT_BY_KEY]: String(actorEmail || 'unknown').trim() || 'unknown',
  };
  const model = String(modelName ?? '').trim();
  if (model) next[PRESALES_AI_DRAFT_MODEL_KEY] = model;
  return next;
}

export function clearPresalesAiDraftMeta(prof: Record<string, string>): Record<string, string> {
  const next = { ...prof };
  delete next[PRESALES_AI_DRAFT_AT_KEY];
  delete next[PRESALES_AI_DRAFT_BY_KEY];
  delete next[PRESALES_AI_DRAFT_MODEL_KEY];
  return next;
}

export function parseTargetMarketProfJson(raw: unknown): Record<string, string> {
  if (raw == null || raw === '') return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return Object.fromEntries(
      Object.entries(raw as Record<string, unknown>).map(([k, v]) => [k, v == null ? '' : String(v)]),
    );
  }
  try {
    const parsed = JSON.parse(String(raw)) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parseTargetMarketProfJson(parsed);
    }
  } catch {
    /* fall through */
  }
  return {};
}

export function parsePresalesAiDraftMeta(prof: Record<string, string> | null | undefined): {
  is_ai_draft: boolean;
  draft_at: string | null;
  draft_by: string | null;
  badge_vi: string | null;
  model_name: string | null;
} {
  const at = String(prof?.[PRESALES_AI_DRAFT_AT_KEY] ?? '').trim();
  if (!at) {
    return { is_ai_draft: false, draft_at: null, draft_by: null, badge_vi: null, model_name: null };
  }
  return {
    is_ai_draft: true,
    draft_at: at,
    draft_by: String(prof?.[PRESALES_AI_DRAFT_BY_KEY] ?? '').trim() || null,
    badge_vi: PRESALES_AI_DRAFT_BADGE_VI,
    model_name: String(prof?.[PRESALES_AI_DRAFT_MODEL_KEY] ?? '').trim() || null,
  };
}
