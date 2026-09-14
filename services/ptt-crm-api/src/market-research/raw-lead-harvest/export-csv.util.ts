export type RawLeadCsvRow = {
  company_name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  contact_title: string | null;
  evidence_url: string | null;
  quality_score: number;
  icp_fit_score: number;
  source_provider: string | null;
  source_model: string | null;
  search_source_keys?: string[] | null;
  status: string;
};

const HEADERS = [
  'company_name',
  'address',
  'phone',
  'email',
  'contact_title',
  'evidence_url',
  'quality_score',
  'icp_fit_score',
  'source_provider',
  'source_model',
  'sources',
  'status',
] as const;

function csvCell(v: unknown): string {
  const s = v == null ? '' : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function buildRawLeadsCsv(rows: RawLeadCsvRow[]): string {
  const lines = [HEADERS.join(',')];
  for (const r of rows) {
    const sources = (r.search_source_keys ?? []).join('|');
    lines.push(
      [
        r.company_name,
        r.address,
        r.phone,
        r.email,
        r.contact_title,
        r.evidence_url,
        r.quality_score,
        r.icp_fit_score,
        r.source_provider,
        r.source_model,
        sources,
        r.status,
      ]
        .map(csvCell)
        .join(','),
    );
  }
  return lines.join('\n') + '\n';
}
