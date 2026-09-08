const EXACT_STRIP = new Set([
  'cost',
  'margin',
  'gm_bps',
  'nsr',
  'nsr_vnd',
  'direct_cost_vnd',
  'approval',
  'approvals',
  'approval_id',
  'pending_approval',
]);

function shouldStripKey(key: string): boolean {
  const k = key.toLowerCase();
  if (EXACT_STRIP.has(k)) return true;
  if (k.startsWith('cost_') || k.startsWith('approval_')) return true;
  return false;
}

export function stripPublicQuote<T>(input: T): T {
  if (Array.isArray(input)) {
    return input.map((item) => stripPublicQuote(item)) as T;
  }
  if (!input || typeof input !== 'object') return input;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (shouldStripKey(key)) continue;
    out[key] = stripPublicQuote(value);
  }
  return out as T;
}
