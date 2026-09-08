/** node-pg / Nest serializes JSONB as an object; String(obj) is "[object Object]". */
export function parsePresalesJsonRecord(raw: unknown): Record<string, string> {
  if (raw == null || raw === '') return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return Object.fromEntries(
      Object.entries(raw as Record<string, unknown>).map(([k, v]) => [k, v == null ? '' : String(v)]),
    );
  }
  try {
    const parsed = JSON.parse(String(raw)) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsePresalesJsonRecord(parsed);
    }
  } catch {
    /* fall through */
  }
  return {};
}

export function hydratePresalesR5Form(plan: Record<string, unknown> | null | undefined): {
  planName: string;
  planNorthStar: string;
  planObjectives: string;
  planStrategy: Record<string, string>;
} {
  const row = plan ?? {};
  const fromJson = parsePresalesJsonRecord(row.strategy_framework_json);
  const fromDecoded = parsePresalesJsonRecord(row.strategy_framework);
  return {
    planName: String(row.name ?? ''),
    planNorthStar: String(row.north_star ?? ''),
    planObjectives: String(row.objectives ?? ''),
    planStrategy: { ...fromJson, ...fromDecoded },
  };
}

export function shouldHydratePresalesMarketingPlan(input: {
  fetchOnMount: boolean;
  hasSyncFunnel: boolean;
  stage?: string | null;
}): boolean {
  if (input.stage !== 'consult' && input.stage !== 'proposal') return false;
  return input.fetchOnMount || input.hasSyncFunnel;
}
