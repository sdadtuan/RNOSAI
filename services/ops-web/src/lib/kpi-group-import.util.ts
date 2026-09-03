import type { CreateKpiGroupBody } from '@/lib/kpi-groups-api';
import { kpiGroupErrorMessage } from '@/lib/kpi-group-util';

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

export const KPI_GROUP_IMPORT_TEMPLATE = `${KPI_GROUP_IMPORT_COLUMNS.join(',')}\nGROWTH_SAMPLE,Nhóm mẫu,Mô tả ngắn,ORGANIZATION,INCREASE,#17B6A4,target,1,DRAFT,,,COUNT;PERCENT,CRM;MANUAL`;

export type KpiGroupImportPreviewRow = {
  row_number: number;
  body: CreateKpiGroupBody;
  valid: boolean;
  error?: string;
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
  rows: CreateKpiGroupBody[];
  preview: KpiGroupImportPreviewRow[];
  headerError?: string;
} {
  const raw = String(text ?? '').replace(/^\uFEFF/, '');
  const lines = raw.split(/\r?\n/).filter((line) => line.trim());
  const preview: KpiGroupImportPreviewRow[] = [];

  if (!lines.length) {
    return { rows: [], preview: [], headerError: 'File CSV trống' };
  }

  const header = lines[0].split(',').map((c) => c.trim().toLowerCase());
  const expected = KPI_GROUP_IMPORT_COLUMNS.map((c) => c.toLowerCase());
  const headerOk =
    header.length === expected.length && expected.every((col, i) => header[i] === col);
  if (!headerOk) {
    return {
      rows: [],
      preview: [],
      headerError: 'Header CSV không đúng mẫu. Tải file mẫu và thử lại.',
    };
  }

  const rows: CreateKpiGroupBody[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const rowNumber = i + 1;
    const cells = lines[i].split(',').map((c) => c.trim());
    if (cells.length !== expected.length) {
      preview.push({
        row_number: rowNumber,
        body: {
          code: '',
          name: '',
          scope_type: 'ORGANIZATION',
          default_direction: 'INCREASE',
          color: '#17B6A4',
        },
        valid: false,
        error: 'Số cột không khớp header',
      });
      continue;
    }
    const rec: Record<string, string> = {};
    for (let c = 0; c < expected.length; c += 1) {
      rec[KPI_GROUP_IMPORT_COLUMNS[c]] = cells[c] ?? '';
    }

    const body: CreateKpiGroupBody = {
      code: rec.code.trim().toUpperCase(),
      name: rec.name.trim(),
      description: rec.description.trim() || undefined,
      scope_type: rec.scope_type.trim().toUpperCase() as CreateKpiGroupBody['scope_type'],
      default_direction: rec.default_direction.trim().toUpperCase() as CreateKpiGroupBody['default_direction'],
      color: rec.color.trim() || '#17B6A4',
      icon: rec.icon.trim() || undefined,
      display_order: rec.display_order.trim() ? Number(rec.display_order.trim()) : undefined,
      status: (rec.status.trim().toUpperCase() || 'DRAFT') as CreateKpiGroupBody['status'],
      department_ids: splitNumberList(rec.department_ids).map(String),
      position_ids: splitNumberList(rec.position_ids),
      suggested_unit_types: splitList(rec.suggested_unit_types).map((v) => v.toUpperCase()),
      data_domains: splitList(rec.data_domains).map((v) => v.toUpperCase()),
    };

    const err = validateImportRow(body);
    if (err) {
      preview.push({ row_number: rowNumber, body, valid: false, error: err });
      continue;
    }
    preview.push({ row_number: rowNumber, body, valid: true });
    rows.push(body);
  }

  return { rows, preview };
}

function validateImportRow(body: CreateKpiGroupBody): string | undefined {
  if (!/^[A-Z0-9_]{3,50}$/.test(body.code)) {
    return kpiGroupErrorMessage('KPI_GROUP_CODE_INVALID');
  }
  if (body.name.trim().length < 3) {
    return kpiGroupErrorMessage('KPI_GROUP_NAME_REQUIRED');
  }
  if (body.scope_type === 'DEPARTMENT' && !(body.department_ids?.length)) {
    return kpiGroupErrorMessage('KPI_GROUP_SCOPE_REQUIRED');
  }
  if (
    body.scope_type === 'POSITION' &&
    !(body.department_ids?.length || body.position_ids?.length)
  ) {
    return kpiGroupErrorMessage('KPI_GROUP_SCOPE_REQUIRED');
  }
  return undefined;
}

export function downloadKpiGroupImportTemplate(): void {
  const blob = new Blob([KPI_GROUP_IMPORT_TEMPLATE], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'kpi-groups-import-template.csv';
  a.click();
  URL.revokeObjectURL(url);
}
