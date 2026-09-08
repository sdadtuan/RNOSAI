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

function isHiddenClientOption(value: unknown, parentKey?: string): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const obj = value as Record<string, unknown>;
  if (obj.client_visible !== false && obj.client_visible !== 'f') return false;
  if (parentKey === 'options') return true;
  return (
    Object.prototype.hasOwnProperty.call(obj, 'option_key') &&
    Object.prototype.hasOwnProperty.call(obj, 'recommended')
  );
}

export function stripPublicQuote<T>(input: T): T {
  return stripInner(input) as T;
}

function stripInner(input: unknown, parentKey?: string): unknown {
  if (Array.isArray(input)) {
    return input
      .filter((item) => !isHiddenClientOption(item, parentKey))
      .map((item) => stripInner(item));
  }
  if (!input || typeof input !== 'object') return input;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (shouldStripKey(key)) continue;
    if (!Array.isArray(value) && isHiddenClientOption(value, key)) continue;
    out[key] = stripInner(value, key);
  }
  return out;
}
