/** Minimal DiscoverResult validation on Nest side (mirrors discover_schema.py). */
export function validateDiscoverResultShape(result: Record<string, unknown>): void {
  const status = String(result.discover_status ?? '');
  if (!['found_single', 'found_multiple', 'not_found', 'tier1_only'].includes(status)) {
    throw new Error('discover_status invalid');
  }
  const meta = result.meta as Record<string, unknown> | undefined;
  if (!meta || String(meta.prompt_version ?? '') !== 'lmp-discover-v1') {
    throw new Error('meta.prompt_version must be lmp-discover-v1');
  }
  if (!String(result.discover_message_vi ?? '').trim()) {
    throw new Error('discover_message_vi required');
  }
  const candidates = result.candidates;
  if (!Array.isArray(candidates)) {
    throw new Error('candidates must be array');
  }
  if (status === 'not_found' && candidates.length !== 0) {
    throw new Error('not_found requires empty candidates');
  }
  if (status === 'found_single' && candidates.length < 1) {
    throw new Error('found_single requires at least one candidate');
  }
}
