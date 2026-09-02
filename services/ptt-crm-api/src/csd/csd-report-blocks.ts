export type CsdReportBlock =
  | { type: 'rich_text'; body: string }
  | { type: 'kpi_table'; rows: { metric: string; value: string; target?: string; note?: string }[] }
  | { type: 'chart'; title: string; labels: string[]; values: number[] }
  | { type: 'file'; attachment_id: string; caption?: string }
  | { type: 'ticket_rollup'; ticket_ids: string[]; summary: string };

export type CsdReportSection = { blocks: CsdReportBlock[] };

export function normalizeSection(raw: unknown): CsdReportSection {
  if (raw && typeof raw === 'object' && Array.isArray((raw as CsdReportSection).blocks)) {
    return raw as CsdReportSection;
  }
  if (raw && typeof raw === 'object' && 'body' in (raw as { body?: unknown })) {
    return { blocks: [{ type: 'rich_text', body: String((raw as { body: string }).body ?? '') }] };
  }
  return { blocks: [{ type: 'rich_text', body: '' }] };
}
