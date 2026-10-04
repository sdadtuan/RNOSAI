import Decimal from 'decimal.js';
import {
  collectActivationMissing,
  previewPricing,
  type PricingItemInput,
  type PricingLevel,
  type PricingLineInput,
  type PricingPreview,
  type PricingRoleInput,
  type PricingSettingsInput,
} from '../pricing/pricing-engine';
import { QuoteError } from './quote-error';

const RANK: Record<PricingLevel, number> = { basic: 1, standard: 2, advanced: 3 };
const LEVEL_NAME: Record<PricingLevel, string> = { basic: 'Cơ bản', standard: 'Tiêu chuẩn', advanced: 'Nâng cao' };

export type QuoteDisplayMode = 'package_only' | 'package_with_scope' | 'item_detail';

export type QuoteSettings = {
  discount_approval_threshold_pct: string | null;
  default_validity_days: number;
  default_display_mode: QuoteDisplayMode;
  custom_line_requires_approval: boolean;
  min_margin_after_discount_pct: string | null;
};

export const DEFAULT_QUOTE_SETTINGS: QuoteSettings = {
  discount_approval_threshold_pct: null,
  default_validity_days: 10,
  default_display_mode: 'package_with_scope',
  custom_line_requires_approval: true,
  min_margin_after_discount_pct: null,
};

export type ScopeCell = { feature: string; basic?: string | null; standard?: string | null; advanced?: string | null };

export type QuoteServiceRef = {
  id?: string;
  code: string;
  name: string;
  exclusions?: string[];
  scope_matrix?: ScopeCell[];
};

export type QuoteItemRef = PricingItemInput & {
  id?: string;
  name: string;
  unit_label: string;
  est_hours_is_assumption?: boolean;
  service_name?: string;
};

export type QuoteLineInput = {
  line_type: 'package' | 'item' | 'custom' | 'ad_budget' | 'third_party';
  service_id?: string | null;
  service_code?: string | null;
  level_code?: PricingLevel | null;
  service_item_id?: string | null;
  item_code?: string | null;
  qty?: string | null;
  discount_pct?: string | null;
  unit_price?: string | null;
  unit_price_override_reason?: string | null;
  description?: string | null;
  item_qty_overrides?: Record<string, string> | null;
  monthly_budget?: string | null;
  months?: string | null;
  third_party_cost?: string | null;
};

export type PricedLine = {
  seq: number;
  line_type: QuoteLineInput['line_type'];
  description: string;
  unit: string;
  qty: string;
  list_unit_price: string | null;
  unit_price: string | null;
  discount_pct: string | null;
  amount: string | null;
  service_code: string | null;
  level_code: string | null;
  item_code: string | null;
  hours: string | null;
  warnings: string[];
  scope: string[];
  exclusions: string[];
  included_items: string[];
};

export type QuoteTotals = {
  lines: PricedLine[];
  totals: {
    fee_subtotal: string | null;
    extra_discount_amount: string | null;
    fee_after_discount: string | null;
    fee_vat: string | null;
    fee_total: string | null;
    grand_total: string | null;
    list_fee_total: string | null;
    ad_budget_total: string | null;
    ads_fee_total: string | null;
    third_party_total: string | null;
    booking_fee_total: string | null;
    passthrough_vat: string | null;
    passthrough_total: string | null;
    cost_total: string | null;
    margin_pct_effective: string | null;
  } | null;
  effective_discount_pct: string | null;
  needs_approval: boolean;
  approval_reasons: string[];
  warnings: string[];
  blockers: string[];
  missing: string[];
  preview: PricingPreview | null;
};

/** crm_proposals.total_vnd is NOT NULL. A missing price is stored as 0; grand_total stays null. */
export function notNullVnd(value: string | null | undefined): string {
  return value == null || value === '' ? '0' : value;
}

function dong(value: Decimal): string {
  return value.toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toFixed(0);
}

function invalid(seq: number, field: string): never {
  throw new QuoteError(422, 'quote_line_invalid', { seq, field });
}

function ratioOrNull(value: string | null | undefined): Decimal | null {
  if (value == null || value === '') return null;
  return new Decimal(value);
}

export function parseThreshold(value: unknown): string | null {
  if (value == null || value === '') return null;
  const text = String(value).trim().replace(',', '.');
  if (!/^\d+(\.\d{1,4})?$/.test(text)) {
    throw new QuoteError(422, 'pct_out_of_range', { field: 'discount_approval_threshold_pct' });
  }
  const parsed = new Decimal(text);
  if (parsed.lt(0) || parsed.gte(1)) {
    throw new QuoteError(422, 'pct_out_of_range', { field: 'discount_approval_threshold_pct' });
  }
  return parsed.toFixed();
}

export function parseValidityDays(value: unknown): number | null {
  if (value == null || value === '') return null;
  const text = String(value).trim();
  if (!/^\d+$/.test(text)) throw new QuoteError(422, 'quote_validity_out_of_range', { field: 'validity_days' });
  const days = Number(text);
  if (days < 1 || days > 30) throw new QuoteError(422, 'quote_validity_out_of_range', { field: 'validity_days' });
  return days;
}

function serviceOf(services: QuoteServiceRef[], line: QuoteLineInput): QuoteServiceRef | undefined {
  return services.find((row) => (line.service_id && row.id === line.service_id) || (line.service_code && row.code === line.service_code));
}

function itemOf(items: QuoteItemRef[], line: QuoteLineInput): QuoteItemRef | undefined {
  return items.find((row) => (line.service_item_id && row.id === line.service_item_id) || (line.item_code && row.code === line.item_code));
}

function scopeLines(service: QuoteServiceRef, level: PricingLevel): string[] {
  return (service.scope_matrix ?? [])
    .map((row) => {
      const text = String(row[level] ?? '').trim();
      if (!text || text === '—') return '';
      return `${row.feature}: ${text}`;
    })
    .filter(Boolean);
}

export function calculateQuote(input: {
  lines: QuoteLineInput[];
  extra_discount_pct?: string | null;
  validity_days?: number | null;
  default_validity_days?: number;
  settings: QuoteSettings;
  roles: PricingRoleInput[] | null;
  pricing: PricingSettingsInput | null;
  version?: { id: string; code: string } | null;
  services: QuoteServiceRef[];
  items: QuoteItemRef[];
}): QuoteTotals {
  const priced: PricedLine[] = [];
  const engineLines: PricingLineInput[] = [];
  const warnings = new Set<string>();
  const packageServices = new Map<string, PricingLevel>();

  input.lines.forEach((line, index) => {
    const seq = index + 1;
    if (line.line_type === 'package') {
      const service = serviceOf(input.services, line);
      const level = line.level_code;
      if (!service) invalid(seq, 'service_id');
      if (!level || !RANK[level]) invalid(seq, 'level_code');
      const qty = line.qty == null || line.qty === '' ? '1' : String(line.qty);
      if (!/^\d+$/.test(qty) || Number(qty) < 1) invalid(seq, 'qty');
      if (packageServices.has(service.code)) warnings.add('package_duplicate_service');
      packageServices.set(service.code, level);
      engineLines.push({
        type: 'package',
        service_code: service.code,
        level,
        qty,
      });
      const overrides = line.item_qty_overrides ?? {};
      const adjustments = Object.entries(overrides).map(([code, value]) => {
        const item = input.items.find((row) => row.code === code);
        return `${code} ${item?.name ?? ''} × ${value} ${item?.unit_label ?? ''}`.trim();
      });
      priced.push({
        seq,
        line_type: 'package',
        description: line.description?.trim() || `Gói ${LEVEL_NAME[level]} – ${service.name}`,
        unit: 'gói',
        qty,
        list_unit_price: null,
        unit_price: null,
        discount_pct: line.discount_pct ?? null,
        amount: null,
        service_code: service.code,
        level_code: level,
        item_code: null,
        hours: null,
        warnings: [],
        scope: [...scopeLines(service, level), ...adjustments],
        exclusions: service.exclusions ?? [],
        included_items: input.items
          .filter((item) => item.service_code === service.code && item.billable && !item.client_only && RANK[item.min_level] <= RANK[level])
          .map((item) => item.name),
      });
      return;
    }
    if (line.line_type === 'item') {
      const item = itemOf(input.items, line);
      if (!item) invalid(seq, 'service_item_id');
      if (!item.billable || item.client_only) invalid(seq, 'service_item_id');
      const qty = line.qty == null || line.qty === '' ? item.default_qty : String(line.qty);
      const qtyDec = new Decimal(qty);
      if (qtyDec.lte(0) || qtyDec.decimalPlaces() > 2) invalid(seq, 'qty');
      engineLines.push({ type: 'item', code: item.code, qty });
      const lineWarnings: string[] = [];
      if (item.est_hours_is_assumption) lineWarnings.push('hours_assumption');
      const packaged = packageServices.get(item.service_code);
      if (packaged && RANK[item.min_level] <= RANK[packaged]) lineWarnings.push('item_already_in_package');
      lineWarnings.forEach((code) => warnings.add(code));
      priced.push({
        seq,
        line_type: 'item',
        description: line.description?.trim() || `${item.code} – ${item.name}`,
        unit: item.unit_label,
        qty,
        list_unit_price: null,
        unit_price: null,
        discount_pct: line.discount_pct ?? null,
        amount: null,
        service_code: item.service_code,
        level_code: null,
        item_code: item.code,
        hours: item.est_hours,
        warnings: lineWarnings,
        scope: [],
        exclusions: [],
        included_items: [],
      });
      return;
    }
    if (line.line_type === 'custom') {
      const qty = line.qty == null || line.qty === '' ? '1' : String(line.qty);
      if (new Decimal(qty).lte(0)) invalid(seq, 'qty');
      if (!line.unit_price) invalid(seq, 'unit_price');
      priced.push({
        seq,
        line_type: 'custom',
        description: line.description?.trim() || 'Tùy chỉnh',
        unit: 'gói',
        qty,
        list_unit_price: line.unit_price,
        unit_price: line.unit_price,
        discount_pct: line.discount_pct ?? null,
        amount: null,
        service_code: null,
        level_code: null,
        item_code: null,
        hours: null,
        warnings: [],
        scope: [],
        exclusions: [],
        included_items: [],
      });
      return;
    }
    if (line.line_type === 'ad_budget') {
      if (!line.monthly_budget) invalid(seq, 'monthly_budget');
      engineLines.push({ type: 'ad_budget', monthly_budget: line.monthly_budget, months: line.months ?? '1' });
      priced.push({
        seq,
        line_type: 'ad_budget',
        description: line.description?.trim() || 'Ngân sách quảng cáo',
        unit: 'tháng',
        qty: line.months ?? '1',
        list_unit_price: line.monthly_budget,
        unit_price: line.monthly_budget,
        discount_pct: null,
        amount: line.monthly_budget,
        service_code: null,
        level_code: null,
        item_code: null,
        hours: null,
        warnings: [],
        scope: [],
        exclusions: [],
        included_items: [],
      });
      return;
    }
    if (!line.third_party_cost) invalid(seq, 'third_party_cost');
    engineLines.push({ type: 'booking', third_party_cost: line.third_party_cost });
    priced.push({
      seq,
      line_type: 'third_party',
      description: line.description?.trim() || 'Bên thứ ba',
      unit: 'khoản',
      qty: '1',
      list_unit_price: line.third_party_cost,
      unit_price: line.third_party_cost,
      discount_pct: null,
      amount: line.third_party_cost,
      service_code: null,
      level_code: null,
      item_code: null,
      hours: null,
      warnings: [],
      scope: [],
      exclusions: [],
      included_items: [],
    });
  });

  const missing = new Set<string>();
  let preview: PricingPreview | null = null;
  if (!input.roles || !input.pricing || !input.version) {
    missing.add('pricing_version');
    warnings.add('pricing_params_incomplete');
  } else {
    for (const key of collectActivationMissing(input.roles, input.pricing, input.items)) missing.add(key);
    if (missing.size) warnings.add('pricing_params_incomplete');
    else {
      preview = previewPricing({
        roles: input.roles,
        settings: input.pricing,
        items: input.items,
        lines: engineLines,
        include_matrix: true,
        extra_discount_pct: input.extra_discount_pct ?? '0',
      });
      for (const key of preview.missing) missing.add(key);
      for (const code of preview.inversions) {
        if (packageServices.has(code)) warnings.add('package_price_inversion');
      }
    }
  }

  if (preview) {
    let engineIndex = 0;
    for (const line of priced) {
      if (line.line_type !== 'package' && line.line_type !== 'item') continue;
      const engine = preview.lines[engineIndex];
      engineIndex += 1;
      if (!engine?.amount) continue;
      const total = new Decimal(engine.amount);
      const qty = new Decimal(line.qty);
      const list = qty.eq(0) ? total : total.div(qty).toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
      line.list_unit_price = list.toFixed(0);
      line.hours = engine.hours;
      const override = input.lines[line.seq - 1]?.unit_price;
      if (override != null && override !== '' && new Decimal(override).lt(list)) {
        if (!input.lines[line.seq - 1]?.unit_price_override_reason?.trim()) invalid(line.seq, 'unit_price_override_reason');
        line.unit_price = new Decimal(override).toFixed(0);
      } else {
        line.unit_price = list.toFixed(0);
      }
    }
  }

  for (const line of priced) {
    if (line.line_type === 'custom' && line.unit_price) {
      line.list_unit_price = line.unit_price;
    }
    if (!line.unit_price || !line.qty) continue;
    if (line.line_type === 'ad_budget' || line.line_type === 'third_party') continue;
    const gross = new Decimal(line.unit_price).mul(line.qty);
    const discount = ratioOrNull(line.discount_pct) ?? new Decimal(0);
    const discountMoney = new Decimal(dong(gross.mul(discount)));
    line.amount = dong(gross.minus(discountMoney));
  }

  const feeLines = priced.filter((line) => line.line_type === 'package' || line.line_type === 'item' || line.line_type === 'custom');
  const ready = missing.size === 0 && feeLines.every((line) => line.amount != null);
  const reasons = new Set<string>();
  let effective: string | null = null;
  let totals: QuoteTotals['totals'] = null;
  if (ready && feeLines.length && preview) {
    const fee = feeLines.reduce((sum, line) => sum.plus(line.amount ?? 0), new Decimal(0));
    const list = feeLines.reduce((sum, line) => sum.plus(new Decimal(line.list_unit_price ?? line.unit_price ?? 0).mul(line.qty)), new Decimal(0));
    const lineDiscount = feeLines.reduce((sum, line) => {
      const gross = new Decimal(line.list_unit_price ?? line.unit_price ?? 0).mul(line.qty);
      return sum.plus(gross.minus(line.amount ?? 0));
    }, new Decimal(0));
    const extraPct = new Decimal(input.extra_discount_pct || '0');
    const extra = new Decimal(dong(fee.mul(extraPct)));
    const after = fee.minus(extra);
    const vatPct = new Decimal(input.pricing?.vat_pct || '0');
    const vat = new Decimal(dong(after.mul(vatPct)));
    const feeTotal = after.plus(vat);
    const ad = priced.filter((line) => line.line_type === 'ad_budget').reduce((sum, line) => sum.plus(line.amount ?? 0), new Decimal(0));
    const third = priced.filter((line) => line.line_type === 'third_party').reduce((sum, line) => sum.plus(line.amount ?? 0), new Decimal(0));
    const adsFee = new Decimal(preview.ads_fee ?? 0);
    const bookingFee = new Decimal(preview.booking_fee ?? 0);
    const passVat = new Decimal(preview.passthrough_vat ?? 0);
    const pass = ad.plus(third).plus(adsFee).plus(bookingFee).plus(passVat);
    effective = list.eq(0) ? '0' : lineDiscount.plus(extra).div(list).toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toFixed();
    totals = {
      fee_subtotal: dong(fee),
      extra_discount_amount: dong(extra),
      fee_after_discount: dong(after),
      fee_vat: dong(vat),
      fee_total: dong(feeTotal),
      grand_total: dong(feeTotal.plus(pass)),
      list_fee_total: dong(list),
      ad_budget_total: dong(ad),
      ads_fee_total: preview.ads_fee,
      third_party_total: dong(third),
      booking_fee_total: preview.booking_fee,
      passthrough_vat: preview.passthrough_vat,
      passthrough_total: dong(pass),
      cost_total: null,
      margin_pct_effective: null,
    };
  } else if (missing.size) {
    totals = null;
  }

  const threshold = input.settings.discount_approval_threshold_pct;
  if (effective && new Decimal(effective).gt(threshold == null ? 0 : threshold)) reasons.add('discount_above_threshold');
  const days = input.validity_days;
  const defaultDays = input.default_validity_days ?? input.settings.default_validity_days;
  if (days != null && days > defaultDays) reasons.add('validity_above_default');
  if (priced.some((line) => line.line_type === 'custom') && input.settings.custom_line_requires_approval) reasons.add('custom_line');
  for (const line of priced) {
    if (line.list_unit_price && line.unit_price && new Decimal(line.unit_price).lt(line.list_unit_price)) reasons.add('price_override');
  }
  const floor = input.settings.min_margin_after_discount_pct;
  if (floor && totals?.margin_pct_effective && new Decimal(totals.margin_pct_effective).lt(floor)) reasons.add('below_margin_floor');

  const blockers: string[] = [];
  if (input.validity_days == null) blockers.push('quote_validity_missing');
  if (!feeLines.length) blockers.push('quote_empty');
  if (missing.size) blockers.push('pricing_params_incomplete');

  return {
    lines: priced,
    totals,
    effective_discount_pct: effective,
    needs_approval: reasons.size > 0,
    approval_reasons: [...reasons],
    warnings: [...warnings],
    blockers,
    missing: [...missing].sort(),
    preview,
  };
}

export function snapshotOf(calc: QuoteTotals, version: { id: string; code: string } | null, threshold: string | null, validityDays: number | null): Record<string, unknown> {
  const rates = Object.fromEntries(
    Object.entries(calc.preview?.rates ?? {}).map(([code, row]) => [code, { rate: row.rate }]),
  );
  return {
    version_id: version?.id ?? null,
    version_code: version?.code ?? null,
    discount_approval_threshold_pct: threshold,
    validity_days: validityDays,
    captured_at: new Date().toISOString(),
    rates,
    lines: calc.lines.map((line) => ({
      line_type: line.line_type,
      service_code: line.service_code,
      level_code: line.level_code,
      item_code: line.item_code,
      hours: line.hours,
      qty: line.qty,
      list_unit_price: line.list_unit_price,
      price_raw: line.amount,
    })),
    totals: calc.totals
      ? {
          fee_subtotal: calc.totals.fee_subtotal,
          fee_vat: calc.totals.fee_vat,
          fee_total: calc.totals.fee_total,
          grand_total: calc.totals.grand_total,
        }
      : null,
  };
}
