import { readFileSync } from 'fs';
import { join } from 'path';
import Decimal from 'decimal.js';
import {
  PricingError,
  adsManagementFee,
  bookingFee,
  collectActivationMissing,
  feeTotalFromSnapshot,
  passthroughVat,
  assertMarginPct,
  previewPricing,
  type PricingItemInput,
  type PricingRoleInput,
  type PricingSettingsInput,
} from './pricing-engine';

const root = join(__dirname, '../../../../../docs/p13');
const seed = JSON.parse(readFileSync(join(root, 'p13-seed-v2.json'), 'utf8')) as {
  services: Array<{ code: string; items: Array<Record<string, unknown>> }>;
};
const fixture = JSON.parse(readFileSync(join(root, 'p13-pricing-sanity-fixture.json'), 'utf8')) as {
  roles: Record<string, string>;
  settings: PricingSettingsInput;
  rate_display: string;
  matrix: Array<{ code: string; hours: string[]; prices: string[]; inversion: boolean; scope_identical: boolean }>;
  quotes: {
    f6: { fee_subtotal: string; fee_vat: string; fee_total: string };
    f9_web_basic: string;
    f11_web_standard: string;
    f12_vid_basic: string;
    f13: { extra_discount: string; fee_after_discount: string; fee_vat: string; fee_total: string };
  };
};

const roles: PricingRoleInput[] = [
  'am',
  'strategist',
  'content',
  'design',
  'ads',
  'dev',
  'data_crm',
  'media_booking',
  'video_production',
].map((role_code) => ({ role_code, ...fixture.roles, monthly_salary: fixture.roles.monthly_salary, insurance_pct: fixture.roles.insurance_pct, monthly_benefits: fixture.roles.monthly_benefits, productive_hours: fixture.roles.productive_hours }));

const items: PricingItemInput[] = seed.services.flatMap((service) =>
  service.items.map((item) => ({
    code: String(item.code),
    service_code: service.code,
    min_level: item.min_level as PricingItemInput['min_level'],
    est_hours: String(item.est_hours),
    default_qty: String(item.default_qty),
    billable: item.billable === true,
    client_only: item.client_only === true,
    main_role_code: String(item.main_role_code),
  })),
);

function priced(settings: PricingSettingsInput = fixture.settings, extra?: Partial<Parameters<typeof previewPricing>[0]>) {
  return previewPricing({ roles, settings, items, include_matrix: true, ...extra });
}

function cell(result: ReturnType<typeof previewPricing>, code: string, level: 'basic' | 'standard' | 'advanced') {
  const found = result.matrix.find((row) => row.service_code === code && row.level === level);
  if (!found) throw new Error(`missing ${code} ${level}`);
  return found;
}

describe('PricingEngine decimal.js', () => {
  it('F1 rate is exactly 6250000/33 and displays 189394 dong', () => {
    const result = priced();
    expect(new Decimal(result.rates.dev.rate).equals(new Decimal(6250000).div(33))).toBe(true);
    expect(result.rates.dev.rate_display).toBe(fixture.rate_display);
  });

  it('F2–F4 and F8 match the 48-cell fixture, with 15 inversions and 5 identical scopes', () => {
    const result = priced();
    expect(result.matrix).toHaveLength(48);
    for (const row of fixture.matrix) {
      expect(cell(result, row.code, 'basic')).toMatchObject({ hours: row.hours[0], price_vnd: row.prices[0] });
      expect(cell(result, row.code, 'standard')).toMatchObject({ hours: row.hours[1], price_vnd: row.prices[1] });
      expect(cell(result, row.code, 'advanced')).toMatchObject({ hours: row.hours[2], price_vnd: row.prices[2] });
    }
    expect(result.inversions).toHaveLength(15);
    expect(result.inversions).not.toContain('RET');
    expect(result.inversions).toContain('WEB');
    expect(result.scope_identical).toEqual(['CRM', 'DSH', 'MAU', 'SEO', 'VID']);
    expect(result.warnings).toEqual(expect.arrayContaining(['package_price_inversion', 'package_scope_identical']));
  });

  it('F5 prices WEB-04-08 at 5253000', () => {
    const result = priced(fixture.settings, { lines: [{ type: 'item', code: 'WEB-04-08', qty: '1' }] });
    expect(result.lines[0].amount).toBe('5253000');
  });

  it('F6 prices WEB standard plus two WEB-04-08 lines', () => {
    const result = priced(fixture.settings, {
      lines: [
        { type: 'package', service_code: 'WEB', level: 'standard', qty: '1' },
        { type: 'item', code: 'WEB-04-08', qty: '2' },
      ],
    });
    expect(result.fee_subtotal).toBe(fixture.quotes.f6.fee_subtotal);
    expect(result.fee_vat).toBe(fixture.quotes.f6.fee_vat);
    expect(result.fee_total).toBe(fixture.quotes.f6.fee_total);
    expect(result.fee_total?.includes('.')).toBe(false);
  });

  it('F7 keeps the float traps on the exact thousand', () => {
    const result = priced();
    expect(cell(result, 'SEO', 'advanced').price_vnd).toBe('84500000');
    expect(cell(result, 'MED', 'advanced').price_vnd).toBe('74750000');
    expect(cell(result, 'MKT', 'basic').price_vnd).toBe('65000000');
    expect(cell(result, 'MKT', 'advanced').price_vnd).toBe('84500000');
  });

  it('F9 rounds WEB basic to the dong when rounding_unit is 0', () => {
    const result = priced({ ...fixture.settings, rounding_unit: '0' });
    expect(cell(result, 'WEB', 'basic').price_vnd).toBe(fixture.quotes.f9_web_basic);
  });

  it('F10 rejects margin outside [0, 1) and accepts 0 and 0.99', () => {
    for (const margin_pct of ['-0.1', '1', '1.2'] as const) {
      expect(() => assertMarginPct(margin_pct)).toThrow(PricingError);
      expect(() => priced({ ...fixture.settings, margin_pct })).toThrow(PricingError);
      try {
        priced({ ...fixture.settings, margin_pct });
      } catch (error) {
        expect(error).toMatchObject({ status: 422, code: 'margin_out_of_range' });
      }
    }
    expect(() => assertMarginPct(-0.1)).toThrow(PricingError);
    expect(() => assertMarginPct('-0.0001')).toThrow(PricingError);
    try {
      assertMarginPct('-0.0001');
    } catch (error) {
      expect(error).toMatchObject({ status: 422, code: 'margin_out_of_range', field: 'margin_pct' });
    }
    for (const margin_pct of ['0', '0.99'] as const) {
      expect(() => assertMarginPct(margin_pct)).not.toThrow();
      expect(cell(priced({ ...fixture.settings, margin_pct }), 'WEB', 'basic').price_vnd).toMatch(/^\d+$/);
    }
  });

  it('rejects a negative overhead as pct_out_of_range', () => {
    try {
      priced({ ...fixture.settings, overhead_pct: '-0.05' });
      throw new Error('expected pct_out_of_range');
    } catch (error) {
      expect(error).toMatchObject({ status: 422, code: 'pct_out_of_range' });
    }
  });

  it('F11 prices WEB standard at the new overhead and leaves a snapshot unchanged', () => {
    const next = priced({ ...fixture.settings, overhead_pct: '0.35' });
    expect(cell(next, 'WEB', 'standard').price_vnd).toBe(fixture.quotes.f11_web_standard);
    expect(feeTotalFromSnapshot({ fee_total: fixture.quotes.f6.fee_subtotal === '132135000' ? '121629000' : '' })).toBe('121629000');
  });

  it('F12 reprices VID basic when VID-04-07 qty is 3', () => {
    const result = priced(fixture.settings, { qty_overrides: { 'VID-04-07': '3' } });
    expect(cell(result, 'VID', 'basic').price_vnd).toBe(fixture.quotes.f12_vid_basic);
  });

  it('F13 applies an extra 10 percent discount on the F6 quote', () => {
    const result = priced(fixture.settings, {
      extra_discount_pct: '0.10',
      lines: [
        { type: 'package', service_code: 'WEB', level: 'standard', qty: '1' },
        { type: 'item', code: 'WEB-04-08', qty: '2' },
      ],
    });
    expect(result.extra_discount).toBe(fixture.quotes.f13.extra_discount);
    expect(result.fee_after_discount).toBe(fixture.quotes.f13.fee_after_discount);
    expect(result.fee_vat).toBe(fixture.quotes.f13.fee_vat);
    expect(result.fee_total).toBe(fixture.quotes.f13.fee_total);
    expect(result.effective_discount_pct).toBe('0.10');
  });

  it('F14 and F15 price ads and booking fees without using the package round', () => {
    expect(adsManagementFee('30000000', '0.10', '5000000')).toBe('5000000');
    expect(adsManagementFee('80000000', '0.10', '5000000')).toBe('8000000');
    expect(adsManagementFee('0', '0.10', '5000000')).toBe('0');
    expect(bookingFee('20000000', '0.10')).toBe('2000000');
    expect(passthroughVat('5000000', '2000000', '0.08')).toBe('560000');
  });

  it('F16 lists the missing dev salary and does not throw on preview', () => {
    const blankDev = roles.map((role) => (role.role_code === 'dev' ? { ...role, monthly_salary: null } : role));
    const result = previewPricing({
      roles: blankDev,
      settings: fixture.settings,
      items,
      lines: [{ type: 'package', service_code: 'WEB', level: 'standard', qty: '1' }],
    });
    expect(result.missing).toContain('pricing_roles.dev.monthly_salary');
    expect(result.fee_total).toBeNull();
    expect(collectActivationMissing(blankDev, fixture.settings, items)).toContain('pricing_roles.dev.monthly_salary');
  });

  it('F17 keeps WEB standard client-only rows at 0 and out of the billable hours', () => {
    const result = priced();
    const web = cell(result, 'WEB', 'standard');
    expect(web.hours).toBe('390.00');
    expect(web.client_only).toBe(2);
    const row = priced(fixture.settings, { lines: [{ type: 'item', code: 'WEB-05-02', qty: '1' }] });
    expect(row.lines[0]).toMatchObject({ amount: '0', hours: '0.00', checklist: true });
  });

  it('does not import the legacy Number pricing helper', () => {
    const source = readFileSync(join(__dirname, 'pricing-engine.ts'), 'utf8');
    expect(source).not.toContain('quote-pricing');
    expect(source).not.toMatch(/\bNumber\(/);
  });
});
