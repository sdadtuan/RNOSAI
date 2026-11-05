export type CpClosedLoopRow = {
  re_project_id: number | null;
  re_project_name: string | null;
  cp_project_id: string;
  cp_project_name: string | null;
  spend: number | null;
  valid_leads: number | null;
  cpl: number | null;
  source: string;
  freshness: string | null;
};

export function parseReProjectIdFromTags(tags: unknown): number | null {
  if (!Array.isArray(tags)) return null;
  for (const tag of tags) {
    const match = String(tag).match(/^re_project:(\d+)$/);
    if (match) {
      const id = Number(match[1]);
      return Number.isFinite(id) && id > 0 ? id : null;
    }
  }
  return null;
}

export function computeClosedLoopCpl(
  spend: number | null,
  leads: number | null,
): number | null {
  if (spend == null || leads == null || leads <= 0) return null;
  return Math.round(spend / leads);
}

export function mapClosedLoopRow(input: Record<string, unknown>): CpClosedLoopRow {
  const spend = finiteNumber(input.spend);
  const validLeads = finiteNumber(input.valid_leads);
  const hasAds = spend != null || validLeads != null;
  return {
    re_project_id: finiteInt(input.re_project_id),
    re_project_name: nullableText(input.re_project_name),
    cp_project_id: String(input.cp_project_id ?? ''),
    cp_project_name: nullableText(input.cp_project_name),
    spend,
    valid_leads: validLeads,
    cpl: computeClosedLoopCpl(spend, validLeads),
    source: hasAds ? 'ads_ops+crm_leads' : 'chưa ingest',
    freshness: nullableText(input.synced_at),
  };
}

function finiteNumber(value: unknown): number | null {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function finiteInt(value: unknown): number | null {
  const number = finiteNumber(value);
  if (number == null || !Number.isInteger(number) || number <= 0) return null;
  return number;
}

function nullableText(value: unknown): string | null {
  const text = String(value ?? '').trim();
  return text || null;
}
