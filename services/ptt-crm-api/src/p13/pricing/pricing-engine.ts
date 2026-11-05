import Decimal from 'decimal.js';

Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

export const P13_PRICING_ROLE_CODES = [
  'am',
  'strategist',
  'content',
  'design',
  'ads',
  'dev',
  'data_crm',
  'media_booking',
  'video_production',
] as const;

const LEVEL_RANK = { basic: 1, standard: 2, advanced: 3 } as const;
export type PricingLevel = keyof typeof LEVEL_RANK;

export class PricingError extends Error {
  readonly status: number;
  readonly code: string;
  readonly missing: string[];
  readonly field?: string;

  constructor(status: number, code: string, missing: string[] = [], field?: string) {
    super(code);
    this.name = 'PricingError';
    this.status = status;
    this.code = code;
    this.missing = missing;
    this.field = field;
  }
}

export type PricingRoleInput = {
  role_code: string;
  monthly_salary: string | null;
  insurance_pct: string | null;
  monthly_benefits: string | null;
  productive_hours: string | null;
};

export type PricingSettingsInput = {
  overhead_pct: string | null;
  margin_pct: string | null;
  vat_pct: string | null;
  rounding_unit: string | null;
  discount_basic_pct: string | null;
  discount_standard_pct: string | null;
  discount_advanced_pct: string | null;
  ads_fee_pct: string | null;
  ads_fee_min_monthly: string | null;
  booking_fee_pct: string | null;
};

export type PricingItemInput = {
  code: string;
  service_code: string;
  min_level: PricingLevel;
  est_hours: string;
  default_qty: string;
  billable: boolean;
  client_only: boolean;
  main_role_code: string;
};

export type PricingLineInput =
  | { type: 'package'; service_code: string; level: PricingLevel; qty?: string }
  | { type: 'item'; code: string; qty?: string }
  | { type: 'ad_budget'; monthly_budget: string; months?: string }
  | { type: 'booking'; third_party_cost: string };

export type PricingPreviewInput = {
  roles: PricingRoleInput[];
  settings: PricingSettingsInput;
  items: PricingItemInput[];
  lines?: PricingLineInput[];
  include_matrix?: boolean;
  extra_discount_pct?: string | null;
  qty_overrides?: Record<string, string>;
};

export type MatrixCell = {
  service_code: string;
  level: PricingLevel;
  hours: string;
  price_vnd: string | null;
  client_only: number;
};

export type PricingPreview = {
  rates: Record<string, { rate: string; rate_display: string }>;
  matrix: MatrixCell[];
  inversions: string[];
  scope_identical: string[];
  warnings: string[];
  missing: string[];
  lines: Array<{ type: string; ref: string; amount: string | null; hours: string; checklist: boolean }>;
  fee_subtotal: string | null;
  extra_discount: string | null;
  fee_after_discount: string | null;
  fee_vat: string | null;
  fee_total: string | null;
  effective_discount_pct: string | null;
  ads_fee: string | null;
  booking_fee: string | null;
  passthrough_vat: string | null;
};

const PCT_FIELDS: Array<keyof PricingSettingsInput> = [
  'vat_pct',
  'discount_basic_pct',
  'discount_standard_pct',
  'discount_advanced_pct',
  'ads_fee_pct',
  'booking_fee_pct',
];

function dec(value: Decimal.Value): Decimal {
  return new Decimal(value);
}

function money(value: Decimal): string {
  return value.toFixed(0);
}

function halfUpDong(value: Decimal): Decimal {
  return value.toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
}

function roundVnd(raw: Decimal, unitRaw: string): Decimal {
  const normalized = raw.toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
  const unit = dec(unitRaw);
  if (unit.isZero()) return halfUpDong(normalized);
  return normalized.div(unit).ceil().mul(unit);
}

function present(value: string | null | undefined): value is string {
  return value != null && value !== '';
}

function assertPct(value: string, code: string): void {
  const parsed = dec(value);
  if (parsed.lt(0) || parsed.gte(1)) throw new PricingError(422, code);
}

export function assertMarginPct(value: string | number | null | undefined): void {
  if (value == null || value === '') return;
  const text = String(value).trim().replace(',', '.');
  if (!text || text === '-' || text === '+' || text === '.') {
    throw new PricingError(422, 'margin_out_of_range', [], 'margin_pct');
  }
  let parsed: Decimal;
  try {
    parsed = dec(text);
  } catch {
    throw new PricingError(422, 'margin_out_of_range', [], 'margin_pct');
  }
  if (parsed.lt(0) || parsed.gte(1)) throw new PricingError(422, 'margin_out_of_range', [], 'margin_pct');
}

export function assertPricingInputs(roles: PricingRoleInput[], settings: PricingSettingsInput): void {
  assertMarginPct(settings.margin_pct);
  if (present(settings.overhead_pct) && dec(settings.overhead_pct).lt(0)) {
    throw new PricingError(422, 'pct_out_of_range');
  }
  for (const field of PCT_FIELDS) {
    const value = settings[field];
    if (present(value)) assertPct(value, 'pct_out_of_range');
  }
  if (present(settings.rounding_unit) && dec(settings.rounding_unit).lt(0)) {
    throw new PricingError(422, 'pct_out_of_range');
  }
  if (present(settings.ads_fee_min_monthly) && dec(settings.ads_fee_min_monthly).lt(0)) {
    throw new PricingError(422, 'pct_out_of_range');
  }
  for (const role of roles) {
    if (present(role.monthly_salary) && dec(role.monthly_salary).lt(0)) throw new PricingError(422, 'pct_out_of_range');
    if (present(role.monthly_benefits) && dec(role.monthly_benefits).lt(0)) throw new PricingError(422, 'pct_out_of_range');
    if (present(role.insurance_pct)) assertPct(role.insurance_pct, 'pct_out_of_range');
    if (present(role.productive_hours) && dec(role.productive_hours).lte(0)) throw new PricingError(422, 'pct_out_of_range');
  }
}

function roleMissing(role: PricingRoleInput): string[] {
  const missing: string[] = [];
  const prefix = `pricing_roles.${role.role_code}`;
  if (!present(role.monthly_salary)) missing.push(`${prefix}.monthly_salary`);
  if (!present(role.insurance_pct)) missing.push(`${prefix}.insurance_pct`);
  if (!present(role.monthly_benefits)) missing.push(`${prefix}.monthly_benefits`);
  if (!present(role.productive_hours)) missing.push(`${prefix}.productive_hours`);
  return missing;
}

export function roleRate(role: PricingRoleInput): { rate: Decimal; rate_display: string } | null {
  if (roleMissing(role).length) return null;
  const rate = dec(role.monthly_salary as string)
    .mul(dec(1).plus(role.insurance_pct as string))
    .plus(role.monthly_benefits as string)
    .div(role.productive_hours as string);
  return { rate, rate_display: halfUpDong(rate).toFixed(0) };
}

function settingsMissing(settings: PricingSettingsInput, levels: PricingLevel[]): string[] {
  const missing: string[] = [];
  if (!present(settings.overhead_pct)) missing.push('pricing_settings.overhead_pct');
  if (!present(settings.margin_pct)) missing.push('pricing_settings.margin_pct');
  if (!present(settings.vat_pct)) missing.push('pricing_settings.vat_pct');
  if (!present(settings.rounding_unit)) missing.push('pricing_settings.rounding_unit');
  const discountKey: Record<PricingLevel, keyof PricingSettingsInput> = {
    basic: 'discount_basic_pct',
    standard: 'discount_standard_pct',
    advanced: 'discount_advanced_pct',
  };
  for (const level of levels) {
    if (!present(settings[discountKey[level]])) missing.push(`pricing_settings.${discountKey[level]}`);
  }
  return missing;
}

function sellFactor(settings: PricingSettingsInput): Decimal | null {
  if (!present(settings.overhead_pct) || !present(settings.margin_pct)) return null;
  return dec(1).plus(settings.overhead_pct).div(dec(1).minus(settings.margin_pct));
}

function discountOf(settings: PricingSettingsInput, level: PricingLevel): string | null {
  if (level === 'basic') return settings.discount_basic_pct;
  if (level === 'standard') return settings.discount_standard_pct;
  return settings.discount_advanced_pct;
}

function grouped(items: PricingItemInput[]): Map<string, PricingItemInput[]> {
  const map = new Map<string, PricingItemInput[]>();
  for (const item of items) {
    const list = map.get(item.service_code) ?? [];
    list.push(item);
    map.set(item.service_code, list);
  }
  return map;
}

export function collectActivationMissing(
  roles: PricingRoleInput[],
  settings: PricingSettingsInput,
  items: PricingItemInput[],
): string[] {
  const byCode = new Map(roles.map((role) => [role.role_code, role]));
  const needed = new Set<string>(P13_PRICING_ROLE_CODES);
  for (const item of items) {
    if (item.billable) needed.add(item.main_role_code);
  }
  const missing: string[] = [];
  for (const code of needed) {
    const role = byCode.get(code);
    if (!role) {
      missing.push(`pricing_roles.${code}.monthly_salary`);
      continue;
    }
    missing.push(...roleMissing(role));
  }
  missing.push(...settingsMissing(settings, ['basic', 'standard', 'advanced']));
  return missing;
}

export function feeTotalFromSnapshot(snapshot: { fee_total: string }): string {
  return snapshot.fee_total;
}

export function adsManagementFee(monthlyBudget: string, pct: string, minMonthly: string, months = '1'): string {
  const budget = dec(monthlyBudget);
  if (budget.lte(0)) return '0';
  return money(halfUpDong(Decimal.max(budget.mul(pct), dec(minMonthly)).mul(months)));
}

export function bookingFee(thirdPartyCost: string, pct: string): string {
  return money(halfUpDong(dec(thirdPartyCost).mul(pct)));
}

export function passthroughVat(adsFee: string, booking: string, vatPct: string): string {
  return money(halfUpDong(dec(adsFee).plus(booking).mul(vatPct)));
}

export function previewPricing(input: PricingPreviewInput): PricingPreview {
  assertPricingInputs(input.roles, input.settings);
  const roles = new Map(input.roles.map((role) => [role.role_code, role]));
  const rates: PricingPreview['rates'] = {};
  for (const role of input.roles) {
    const computed = roleRate(role);
    if (computed) rates[role.role_code] = { rate: computed.rate.toFixed(), rate_display: computed.rate_display };
  }
  const factor = sellFactor(input.settings);
  const unit = input.settings.rounding_unit;
  const services = grouped(input.items);
  const matrix: MatrixCell[] = [];
  const inversions: string[] = [];
  const scopeIdentical: string[] = [];
  const missing = new Set<string>();

  for (const [serviceCode, serviceItems] of services) {
    const prices: Partial<Record<PricingLevel, string | null>> = {};
    for (const level of ['basic', 'standard', 'advanced'] as const) {
      const cell = packageCell(serviceItems, level, roles, factor, unit, input.settings, missing, input.qty_overrides);
      prices[level] = cell.price_vnd;
      matrix.push({ service_code: serviceCode, level, ...cell });
    }
    if (prices.advanced && prices.standard && dec(prices.advanced).lt(prices.standard)) inversions.push(serviceCode);
    if (scopeKey(serviceItems, 'standard') === scopeKey(serviceItems, 'advanced')) scopeIdentical.push(serviceCode);
  }

  const lines: PricingPreview['lines'] = [];
  let fee = new Decimal(0);
  let feeReady = true;
  let ads: string | null = null;
  let booking: string | null = null;
  for (const line of input.lines ?? []) {
    if (line.type === 'package') {
      const cell = matrix.find((row) => row.service_code === line.service_code && row.level === line.level);
      const qty = line.qty ?? '1';
      if (!cell?.price_vnd) {
        feeReady = false;
        lines.push({ type: line.type, ref: `${line.service_code}:${line.level}`, amount: null, hours: cell?.hours ?? '0.00', checklist: false });
      } else {
        const amount = dec(cell.price_vnd).mul(qty);
        fee = fee.plus(amount);
        lines.push({ type: line.type, ref: `${line.service_code}:${line.level}`, amount: money(amount), hours: cell.hours, checklist: false });
      }
      continue;
    }
    if (line.type === 'item') {
      const item = input.items.find((row) => row.code === line.code);
      if (!item) {
        feeReady = false;
        lines.push({ type: line.type, ref: line.code, amount: null, hours: '0.00', checklist: false });
        continue;
      }
      const priced = priceItem(item, line.qty ?? item.default_qty, roles, factor, unit, missing);
      if (!priced.amount) feeReady = false;
      else fee = fee.plus(priced.amount);
      lines.push({ type: line.type, ref: item.code, amount: priced.amount, hours: priced.hours, checklist: priced.checklist });
      continue;
    }
    if (line.type === 'ad_budget') {
      if (!present(input.settings.ads_fee_pct) || !present(input.settings.ads_fee_min_monthly)) {
        missing.add('pricing_settings.ads_fee_pct');
        ads = null;
      } else {
        ads = adsManagementFee(line.monthly_budget, input.settings.ads_fee_pct, input.settings.ads_fee_min_monthly, line.months ?? '1');
      }
      continue;
    }
    if (!present(input.settings.booking_fee_pct)) {
      missing.add('pricing_settings.booking_fee_pct');
      booking = null;
    } else {
      booking = bookingFee(line.third_party_cost, input.settings.booking_fee_pct);
    }
  }

  const usedLevels = (input.lines ?? []).flatMap((line) => (line.type === 'package' ? [line.level] : []));
  for (const key of settingsMissing(input.settings, usedLevels.length ? usedLevels : [])) missing.add(key);

  let extra: string | null = null;
  let after: string | null = null;
  let vat: string | null = null;
  let total: string | null = null;
  if (feeReady && present(input.settings.vat_pct) && (input.lines ?? []).every((line) => line.type === 'package' || line.type === 'item' || feeReady)) {
    const pct = present(input.extra_discount_pct) ? input.extra_discount_pct : '0';
    extra = money(halfUpDong(fee.mul(pct)));
    after = money(fee.minus(extra));
    vat = money(halfUpDong(dec(after).mul(input.settings.vat_pct)));
    total = money(dec(after).plus(vat));
  } else if ((input.lines ?? []).some((line) => line.type === 'package' || line.type === 'item')) {
    feeReady = false;
  }

  const passVat =
    ads != null && booking != null && present(input.settings.vat_pct)
      ? passthroughVat(ads, booking, input.settings.vat_pct)
      : null;

  const warnings = [
    ...inversions.map(() => 'package_price_inversion'),
    ...scopeIdentical.map(() => 'package_scope_identical'),
  ];

  return {
    rates,
    matrix: input.include_matrix === false ? [] : matrix,
    inversions,
    scope_identical: scopeIdentical.sort(),
    warnings: [...new Set(warnings)],
    missing: [...missing].sort(),
    lines,
    fee_subtotal: feeReady && input.lines?.length ? money(fee) : input.lines?.length ? null : null,
    extra_discount: extra,
    fee_after_discount: after,
    fee_vat: vat,
    fee_total: total,
    effective_discount_pct: present(input.extra_discount_pct) ? input.extra_discount_pct : null,
    ads_fee: ads,
    booking_fee: booking,
    passthrough_vat: passVat,
  };
}

function scopeKey(items: PricingItemInput[], level: PricingLevel): string {
  return items
    .filter((item) => item.billable && LEVEL_RANK[item.min_level] <= LEVEL_RANK[level])
    .map((item) => item.code)
    .sort()
    .join(',');
}

function packageCell(
  items: PricingItemInput[],
  level: PricingLevel,
  roles: Map<string, PricingRoleInput>,
  factor: Decimal | null,
  unit: string | null,
  settings: PricingSettingsInput,
  missing: Set<string>,
  overrides?: Record<string, string>,
): { hours: string; price_vnd: string | null; client_only: number } {
  let hours = dec(0);
  let raw = dec(0);
  let clientOnly = 0;
  let blocked = false;
  for (const item of items) {
    if (LEVEL_RANK[item.min_level] > LEVEL_RANK[level]) continue;
    if (item.client_only || !item.billable) {
      if (item.client_only) clientOnly += 1;
      continue;
    }
    const qty = overrides?.[item.code] ?? item.default_qty;
    hours = hours.plus(dec(item.est_hours).mul(qty));
    const role = roles.get(item.main_role_code);
    const computed = role ? roleRate(role) : null;
    if (!role || !computed) {
      blocked = true;
      if (role) for (const key of roleMissing(role)) missing.add(key);
      else missing.add(`pricing_roles.${item.main_role_code}.monthly_salary`);
      continue;
    }
    if (!factor) blocked = true;
    else raw = raw.plus(dec(item.est_hours).mul(qty).mul(computed.rate).mul(factor));
  }
  const discount = discountOf(settings, level);
  if (!present(discount)) {
    blocked = true;
    missing.add(`pricing_settings.discount_${level}_pct`);
  }
  if (!present(unit) || !factor) blocked = true;
  const price = blocked || !present(discount) || !present(unit) ? null : money(roundVnd(raw.mul(dec(1).minus(discount)), unit));
  return { hours: hours.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2), price_vnd: price, client_only: clientOnly };
}

function priceItem(
  item: PricingItemInput,
  qty: string,
  roles: Map<string, PricingRoleInput>,
  factor: Decimal | null,
  unit: string | null,
  missing: Set<string>,
): { amount: string | null; hours: string; checklist: boolean } {
  if (!item.billable || item.client_only) {
    return { amount: '0', hours: '0.00', checklist: true };
  }
  const hours = dec(item.est_hours).mul(qty).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
  const role = roles.get(item.main_role_code);
  const computed = role ? roleRate(role) : null;
  if (!role || !computed || !factor || !present(unit)) {
    if (role) for (const key of roleMissing(role)) missing.add(key);
    else missing.add(`pricing_roles.${item.main_role_code}.monthly_salary`);
    return { amount: null, hours, checklist: false };
  }
  const raw = dec(item.est_hours).mul(qty).mul(computed.rate).mul(factor);
  return { amount: money(roundVnd(raw, unit)), hours, checklist: true };
}
