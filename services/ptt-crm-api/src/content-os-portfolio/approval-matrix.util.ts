export const DEFAULT_CLAIM_LEXEMES = ['cam kết sinh lời', 'giá rẻ', 'số 1'] as const;

export type ApprovalMatrixAttrs = {
  riskLevel: string;
  claimCategories: string[];
  paidIntent: boolean;
  paidOk: boolean;
  marketCount: number;
};

export type ApprovalMatrixResult = { steps: string[]; gateBlockers: string[] };

export function applyApprovalMatrix(attrs: {
  riskLevel: string;
  claimCategories: string[];
  paidIntent: boolean;
  paidOk: boolean;
  marketCount: number;
}): { steps: string[]; gateBlockers: string[] } {
  const steps = ['owner'];
  if (['Brand-Sensitive', 'Regulated'].includes(attrs.riskLevel)) steps.push('content_lead');
  if (attrs.claimCategories.some((c) => ['Financial', 'Health', 'Legal'].includes(c))) {
    steps.push('legal');
  }
  steps.push('account_director', 'client');
  const gateBlockers: string[] = [];
  if (attrs.paidIntent && !attrs.paidOk) gateBlockers.push('Paid media rights invalid');
  return { steps, gateBlockers };
}

export function detectClaimLexemes(
  text: string,
  lexemes: readonly string[] = DEFAULT_CLAIM_LEXEMES,
): string[] {
  const hay = String(text ?? '').toLowerCase();
  return lexemes.filter((lexeme) => hay.includes(lexeme.toLowerCase()));
}

export function collectClaimScanText(
  brief?: Record<string, unknown> | null,
  body?: { markdown?: string; html?: string; variants?: string[] } | null,
): string {
  const restricted = brief?.restricted;
  const restrictedText = Array.isArray(restricted)
    ? restricted.map((entry) => String(entry ?? '')).join(' ')
    : String(restricted ?? '');
  const bodyParts = [body?.markdown, body?.html, ...(body?.variants ?? [])].filter(Boolean);
  return `${restrictedText}\n${bodyParts.join(' ')}`;
}

export function claimCategoriesForItem(
  brief?: Record<string, unknown> | null,
  body?: { markdown?: string; html?: string; variants?: string[] } | null,
  lexemes: readonly string[] = DEFAULT_CLAIM_LEXEMES,
): string[] {
  return detectClaimLexemes(collectClaimScanText(brief, body), lexemes).length ? ['Legal'] : [];
}

const PAID_CHANNELS = new Set(['meta_ads', 'google_ads']);

export function resolvePaidIntent(
  item: {
    channel?: string | null;
    format?: string | null;
    brief_json?: Record<string, unknown> | null;
  },
  rights: Array<{ paid_ok?: boolean }>,
): boolean {
  const channel = String(item.channel ?? '').trim().toLowerCase();
  const format = String(item.format ?? '').trim().toLowerCase();
  if (PAID_CHANNELS.has(channel) || format === 'ad_copy' || channel.includes('paid')) return true;
  const brief = item.brief_json ?? {};
  if (brief.paid === true || brief.paid_intent === true || brief.paid_media === true) return true;
  const intent = String(brief.distribution ?? brief.intent ?? '').toLowerCase();
  if (intent.includes('paid')) return true;
  return rights.some((row) => row.paid_ok === true);
}

export function resolvePaidOk(
  paidIntent: boolean,
  rights: Array<{ paid_ok?: boolean }>,
): boolean {
  if (!paidIntent) return true;
  return !rights.some((row) => row.paid_ok === false);
}

export function resolveMarketCount(brief?: Record<string, unknown> | null): number {
  const markets = brief?.markets;
  return Array.isArray(markets) ? markets.length : 1;
}

export type ApprovalMatrixItemInput = {
  risk_level?: string | null;
  channel?: string | null;
  format?: string | null;
  brief_json?: Record<string, unknown> | null;
  body_json?: { markdown?: string; html?: string; variants?: string[] } | null;
};

export function buildApprovalMatrixForItem(
  item: ApprovalMatrixItemInput,
  rights: Array<{ paid_ok?: boolean }> = [],
): { approval_matrix: ApprovalMatrixResult; claim_hits: string[] } {
  const claim_hits = detectClaimLexemes(collectClaimScanText(item.brief_json, item.body_json));
  const claimCategories = claim_hits.length ? ['Legal'] : [];
  const paidIntent = resolvePaidIntent(item, rights);
  const paidOk = resolvePaidOk(paidIntent, rights);
  return {
    claim_hits,
    approval_matrix: applyApprovalMatrix({
      riskLevel: item.risk_level ?? 'Normal',
      claimCategories,
      paidIntent,
      paidOk,
      marketCount: resolveMarketCount(item.brief_json),
    }),
  };
}

export function attachApprovalMatrix<T extends ApprovalMatrixItemInput>(
  item: T,
  rights: Array<{ paid_ok?: boolean }> = [],
): T & { approval_matrix: ApprovalMatrixResult; claim_hits: string[] } {
  return { ...item, ...buildApprovalMatrixForItem(item, rights) };
}
