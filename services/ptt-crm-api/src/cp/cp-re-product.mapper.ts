export type ReProjectRow = {
  id: number | string;
  name?: string | null;
  location_address?: string | null;
  district?: string | null;
  city?: string | null;
  code?: string | null;
};

export type ReProjectProductRow = {
  id: number | string;
  project_id?: number | string;
  unit_code?: string | null;
  tower?: string | null;
  floor?: string | null;
  zone?: string | null;
  typology?: string | null;
  list_price_vnd?: number | string | null;
  net_price_vnd?: number | string | null;
  status?: string | null;
};

export type ReBatchMapContext = {
  hotline?: string | null;
  cta?: string | null;
};

export type ReBatchMapResult = {
  row: Record<string, unknown>;
  error?: string;
};

export type ReBatchMapBatchResult = {
  rows: Array<Record<string, unknown>>;
  skipped: Array<{ id: number | string; reason: string }>;
};

const SKIP_STATUSES = new Set(['sold', 'locked', 'reserved']);

export function formatPriceFromVnd(vnd: number): string {
  if (!Number.isFinite(vnd) || vnd <= 0) return 'từ —';
  const ty = vnd / 1_000_000_000;
  if (ty >= 1) {
    const rounded = Math.round(ty * 10) / 10;
    const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1).replace(/\.0$/, '');
    return `từ ${text} tỷ`;
  }
  const trieu = Math.round(vnd / 1_000_000);
  return `từ ${trieu} triệu`;
}

export function formatLocation(project: ReProjectRow): string {
  const parts = [
    String(project.district ?? '').trim(),
    String(project.city ?? '').trim(),
  ].filter(Boolean);
  if (parts.length) return parts.join(', ');
  return String(project.location_address ?? '').trim() || '—';
}

export function mapReProductToBatchRow(
  product: ReProjectProductRow,
  project: ReProjectRow,
  context: ReBatchMapContext = {},
): ReBatchMapResult {
  const status = String(product.status ?? 'available').toLowerCase();
  if (SKIP_STATUSES.has(status)) {
    return {
      row: {},
      error: `skip_status_${status}`,
    };
  }
  const priceVnd = Number(product.net_price_vnd ?? product.list_price_vnd ?? 0);
  if (!Number.isFinite(priceVnd) || priceVnd <= 0) {
    return { row: {}, error: 'missing_price' };
  }
  const unitCode = String(product.unit_code ?? '').trim();
  const projectName = String(project.name ?? '').trim() || 'Dự án BĐS';
  const row: Record<string, unknown> = {
    re_product_id: product.id,
    unit_code: unitCode,
    project_name: unitCode ? `${projectName} · ${unitCode}` : projectName,
    price_from: formatPriceFromVnd(priceVnd),
    location: formatLocation(project),
    cta: String(context.cta ?? 'Đăng ký tư vấn').trim(),
    hotline: String(context.hotline ?? '1900').trim(),
  };
  return { row };
}

export function mapReProductsToBatchRows(
  products: ReProjectProductRow[],
  project: ReProjectRow,
  opts: ReBatchMapContext & { includeSold?: boolean } = {},
): ReBatchMapBatchResult {
  const rows: Array<Record<string, unknown>> = [];
  const skipped: Array<{ id: number | string; reason: string }> = [];
  products.forEach((product, index) => {
    const status = String(product.status ?? 'available').toLowerCase();
    if (!opts.includeSold && SKIP_STATUSES.has(status)) {
      skipped.push({ id: product.id, reason: `skip_status_${status}` });
      return;
    }
    const mapped = mapReProductToBatchRow(product, project, opts);
    if (mapped.error) {
      skipped.push({ id: product.id, reason: mapped.error });
      return;
    }
    rows.push({ row_no: index + 1, ...mapped.row });
  });
  return { rows, skipped };
}
