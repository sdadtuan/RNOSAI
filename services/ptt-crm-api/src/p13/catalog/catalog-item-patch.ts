import { decimalText, hoursStepOk } from './catalog-seed';
import type { CatalogRow } from './memory-catalog';

export class CatalogPatchError extends Error {
  readonly status = 422;
  readonly code = 'pct_out_of_range';

  constructor(message: string) {
    super(message);
    this.name = 'CatalogPatchError';
  }
}

export type ItemPatchBody = {
  est_hours?: number;
  min_level?: string;
  billable?: boolean;
  default_qty?: number;
  confirm_hours?: boolean;
};

const LEVELS = new Set(['basic', 'standard', 'advanced']);

export function applyItemPatch(existing: CatalogRow, body: ItemPatchBody): CatalogRow {
  const next: CatalogRow = { ...existing };
  let edited = false;
  if (body.est_hours !== undefined) {
    if (!hoursStepOk(body.est_hours)) throw new CatalogPatchError('Giờ ước tính phải ≥ 0 và bước 0,5');
    next.est_hours = decimalText(body.est_hours);
    edited = true;
  }
  if (body.min_level !== undefined) {
    if (!LEVELS.has(body.min_level)) throw new CatalogPatchError('Cấp tối thiểu không hợp lệ');
    next.min_level = body.min_level;
    edited = true;
  }
  if (body.billable !== undefined) {
    next.billable = body.billable === true;
    edited = true;
  }
  if (body.default_qty !== undefined) {
    if (!hoursStepOk(body.default_qty)) throw new CatalogPatchError('Số lượng mặc định phải ≥ 0 và bước 0,5');
    next.default_qty = decimalText(body.default_qty);
    edited = true;
  }
  if (edited) next.est_hours_source = 'edited';
  if (body.confirm_hours === true) next.est_hours_is_assumption = false;
  return next;
}
