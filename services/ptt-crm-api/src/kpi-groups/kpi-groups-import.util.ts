import type { CreateKpiGroupBody, KpiGroupScopeType, KpiGroupStatus } from './kpi-groups.types';
import { validateCreateKpiGroupBody } from './kpi-groups.validation';

export const KPI_GROUP_IMPORT_COLUMNS = [
  'code',
  'name',
  'description',
  'scope_type',
  'default_direction',
  'color',
  'icon',
  'display_order',
  'status',
  'department_ids',
  'position_ids',
  'suggested_unit_types',
  'data_domains',
] as const;

export type KpiGroupImportCsvRow = {
  row_number: number;
  body: CreateKpiGroupBody;
};

export type KpiGroupImportRowError = {
  row_number: number;
  code?: string;
  error: string;
};

function splitList(raw: string | undefined): string[] {
  return String(raw ?? '')
    .split(/[;|]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function splitNumberList(raw: string | undefined): number[] {
  return splitList(raw)
    .map((s) => Number(s))
    .filter((n) => Number.isFinite(n) && n > 0);
}

export function parseKpiGroupImportCsv(text: string): {
  rows: KpiGroupImportCsvRow[];
  errors: KpiGroupImportRowError[];
} {
  const raw = String(text ?? '').replace(/^\uFEFF/, '');
  const lines = raw.split(/\r?\n/).filter((line) => line.trim());
  const errors: KpiGroupImportRowError[] = [];
  const rows: KpiGroupImportCsvRow[] = [];

  if (!lines.length) {
    return { rows, errors: [{ row_number: 1, error: 'KPI_GROUP_IMPORT_EMPTY' }] };
  }

  const header = lines[0].split(',').map((c) => c.trim().toLowerCase());
  const expected = KPI_GROUP_IMPORT_COLUMNS.map((c) => c.toLowerCase());
  const headerOk =
    header.length === expected.length && expected.every((col, i) => header[i] === col);
  if (!headerOk) {
    return { rows, errors: [{ row_number: 1, error: 'KPI_GROUP_IMPORT_HEADER_INVALID' }] };
  }

  for (let i = 1; i < lines.length; i += 1) {
    const rowNumber = i + 1;
    const cells = lines[i].split(',').map((c) => c.trim());
    if (cells.length !== expected.length) {
      errors.push({ row_number: rowNumber, error: 'KPI_GROUP_IMPORT_ROW_COLUMNS' });
      continue;
    }
    const rec: Record<string, string> = {};
    for (let c = 0; c < expected.length; c += 1) {
      rec[KPI_GROUP_IMPORT_COLUMNS[c]] = cells[c] ?? '';
    }

    const code = rec.code.trim().toUpperCase();
    const displayOrderRaw = rec.display_order.trim();
    const body: CreateKpiGroupBody = {
      code,
      name: rec.name.trim(),
      description: rec.description.trim() || undefined,
      scope_type: rec.scope_type.trim().toUpperCase() as KpiGroupScopeType,
      default_direction: rec.default_direction.trim().toUpperCase() as CreateKpiGroupBody['default_direction'],
      color: rec.color.trim() || '#17B6A4',
      icon: rec.icon.trim() || undefined,
      display_order: displayOrderRaw ? Number(displayOrderRaw) : undefined,
      status: (rec.status.trim().toUpperCase() || 'DRAFT') as KpiGroupStatus,
      department_ids: splitNumberList(rec.department_ids),
      position_ids: splitNumberList(rec.position_ids),
      suggested_unit_types: splitList(rec.suggested_unit_types).map((v) => v.toUpperCase()),
      data_domains: splitList(rec.data_domains).map((v) => v.toUpperCase()),
    };

    const validationErr = validateCreateKpiGroupBody(body);
    if (validationErr) {
      errors.push({ row_number: rowNumber, code, error: validationErr });
      continue;
    }
    rows.push({ row_number: rowNumber, body });
  }

  return { rows, errors };
}
