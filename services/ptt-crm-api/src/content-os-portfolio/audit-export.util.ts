export const AUDIT_EXPORT_ACTION = 'audit_export';
export const AUDIT_EXPORT_ENTITY = 'portfolio_audit';
export const AUDIT_CSV_HEADER = 'actor,action,entity,created_at';

export type AuditExportRow = {
  actor: string;
  action: string;
  entity: string;
  created_at: string;
};

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function formatAuditExportCsv(
  rows: Array<Partial<AuditExportRow> & Record<string, unknown>>,
): string {
  const lines = [AUDIT_CSV_HEADER];
  for (const row of rows) {
    lines.push(
      [
        csvEscape(String(row.actor ?? '')),
        csvEscape(String(row.action ?? '')),
        csvEscape(String(row.entity ?? '')),
        csvEscape(String(row.created_at ?? '')),
      ].join(','),
    );
  }
  return `${lines.join('\n')}\n`;
}

export function isMissingAuditExportSchema(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const code = String((err as { code?: unknown }).code ?? '');
  if (code !== '42P01' && code !== '42703') return false;
  const message = err instanceof Error ? err.message : String((err as { message?: unknown }).message ?? '');
  const table = String((err as { table?: unknown }).table ?? '');
  return /\bcmkt_audit_exports\b/i.test(`${message} ${table}`);
}
