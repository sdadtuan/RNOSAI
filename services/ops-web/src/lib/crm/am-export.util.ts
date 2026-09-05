export function amExportTooLargeCopy(code: string): string {
  if (code === 'export_too_large') return 'Export quá 10.000 dòng — thu hẹp bộ lọc.';
  return code;
}

export function escapeAmCsvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function amExportDownloadCsv(out: string | { csv: string }): string {
  return typeof out === 'string' ? out : out.csv;
}

export function amExportCsvFromResponse(contentType: string | null | undefined, body: string): string {
  const type = String(contentType ?? '').toLowerCase();
  if (type.includes('text/csv')) return body;
  const parsed = JSON.parse(body) as { csv?: unknown };
  if (typeof parsed.csv === 'string') return parsed.csv;
  throw new Error('invalid_export');
}
