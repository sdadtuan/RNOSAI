export const AUDIT_EXPORT_ACTION = 'audit_export';
export const AUDIT_EXPORT_ENTITY = 'portfolio_audit';
export const HARD_DELETE_ACTION = 'hard_delete';
export const AUDIT_CSV_HEADER = 'actor,action,entity,created_at,item_id,id';

export type AuditExportRow = {
  actor: string;
  action: string;
  entity: string;
  created_at: string;
  item_id?: number | null;
  id?: number | null;
};

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function csvCell(value: unknown): string {
  if (value == null || value === '') return '';
  return csvEscape(String(value));
}

export function formatAuditExportCsv(
  rows: Array<Partial<AuditExportRow> & Record<string, unknown>>,
): string {
  const lines = [AUDIT_CSV_HEADER];
  for (const row of rows) {
    lines.push(
      [
        csvCell(row.actor),
        csvCell(row.action),
        csvCell(row.entity),
        csvCell(row.created_at),
        csvCell(row.item_id),
        csvCell(row.id),
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

export function isMissingAuditActivitySchema(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const code = String((err as { code?: unknown }).code ?? '');
  if (code !== '42P01' && code !== '42703') return false;
  const message = err instanceof Error ? err.message : String((err as { message?: unknown }).message ?? '');
  const table = String((err as { table?: unknown }).table ?? '');
  return /\bcmkt_content_item_versions\b|\bcmkt_publication_logs\b|\bcmkt_sla_events\b/i.test(
    `${message} ${table}`,
  );
}
