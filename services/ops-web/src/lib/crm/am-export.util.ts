export function amExportTooLargeCopy(code: string): string {
  if (code === 'export_too_large') return 'Export quá 10.000 dòng — thu hẹp bộ lọc.';
  return code;
}

export function escapeAmCsvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}
