import ExcelJS from 'exceljs';

export type RawLeadCsvRow = {
  company_name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  website?: string | null;
  fanpage_url?: string | null;
  zalo_url?: string | null;
  contact_title: string | null;
  evidence_url: string | null;
  quality_score: number;
  icp_fit_score: number;
  source_provider: string | null;
  source_model: string | null;
  search_source_keys?: string[] | null;
  status: string;
};

export const RAW_LEAD_EXPORT_HEADERS = [
  'company_name',
  'address',
  'phone',
  'email',
  'website',
  'fanpage_url',
  'zalo_url',
  'contact_title',
  'evidence_url',
  'quality_score',
  'icp_fit_score',
  'source_provider',
  'source_model',
  'sources',
  'status',
] as const;

const COLUMN_WIDTHS: Record<(typeof RAW_LEAD_EXPORT_HEADERS)[number], number> = {
  company_name: 28,
  address: 40,
  phone: 14,
  email: 26,
  website: 36,
  fanpage_url: 36,
  zalo_url: 32,
  contact_title: 18,
  evidence_url: 36,
  quality_score: 14,
  icp_fit_score: 14,
  source_provider: 16,
  source_model: 16,
  sources: 28,
  status: 12,
};

function cellText(v: unknown): string {
  return v == null ? '' : String(v);
}

export function rawLeadExportRowValues(r: RawLeadCsvRow): string[] {
  const sources = (r.search_source_keys ?? []).join('|');
  return [
    r.company_name,
    cellText(r.address),
    cellText(r.phone),
    cellText(r.email),
    cellText(r.website),
    cellText(r.fanpage_url),
    cellText(r.zalo_url),
    cellText(r.contact_title),
    cellText(r.evidence_url),
    cellText(r.quality_score),
    cellText(r.icp_fit_score),
    cellText(r.source_provider),
    cellText(r.source_model),
    sources,
    r.status,
  ];
}

function csvCell(v: unknown): string {
  const s = cellText(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function buildRawLeadsCsv(rows: RawLeadCsvRow[]): string {
  const lines = [RAW_LEAD_EXPORT_HEADERS.join(',')];
  for (const r of rows) {
    lines.push(rawLeadExportRowValues(r).map(csvCell).join(','));
  }
  return lines.join('\n') + '\n';
}

export async function buildRawLeadsXlsx(rows: RawLeadCsvRow[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Raw leads');
  ws.columns = RAW_LEAD_EXPORT_HEADERS.map((header) => ({
    header,
    key: header,
    width: COLUMN_WIDTHS[header],
  }));
  ws.getRow(1).font = { bold: true };
  for (const r of rows) {
    ws.addRow(rawLeadExportRowValues(r));
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}
