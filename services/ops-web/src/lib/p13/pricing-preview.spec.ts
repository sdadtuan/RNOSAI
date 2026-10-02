import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
import {
  buildPreviewBody,
  formatVnd,
  preferredVersionId,
  previewExportPayload,
  previewFieldError,
  trialFromFixture,
  trialFromVersion,
} from './pricing-preview';

const fixture = JSON.parse(readFileSync(join(here, '../../../../../docs/p13/p13-pricing-sanity-fixture.json'), 'utf8')) as {
  matrix: Array<{ code: string; prices: string[]; inversion: boolean; scope_identical: boolean }>;
  quotes: {
    f6: { fee_subtotal: string; fee_vat: string; fee_total: string };
    f9_web_basic: string;
    f11_web_standard: string;
  };
};

function price(code: string, index: number): string {
  const row = fixture.matrix.find((item) => item.code === code);
  if (!row) throw new Error(code);
  return row.prices[index] ?? '';
}

describe('pricing preview trial', () => {
  it('loads the test fixture without treating it as a saved version', () => {
    const form = trialFromFixture();
    expect(form.roles).toHaveLength(9);
    expect(form.roles.every((role) => role.monthly_salary === '20000000')).toBe(true);
    expect(form.roles[0]).toMatchObject({ insurance_pct: '0.20', monthly_benefits: '1000000', productive_hours: '132' });
    expect(form.settings).toMatchObject({
      overhead_pct: '0.30',
      margin_pct: '0.25',
      vat_pct: '0.08',
      discount_standard_pct: '0.05',
      discount_advanced_pct: '0.10',
      rounding_unit: '1000',
    });
    const body = buildPreviewBody(form, [], 'version-1');
    expect(body.include_matrix).toBe(true);
    expect(JSON.stringify(body)).not.toContain('updated_at');
    expect(JSON.stringify(previewExportPayload(body, { ok: true }))).not.toMatch(/token|Bearer/i);
  });

  it('formats server amounts and the fixture matrix without using Number', () => {
    expect(formatVnd(price('WEB', 0))).toBe('119.495.000');
    expect(formatVnd(price('WEB', 1))).toBe('121.629.000');
    expect(formatVnd(price('WEB', 2))).toBe('117.591.000');
    expect(formatVnd('5253000')).toBe('5.253.000');
    expect(formatVnd(fixture.quotes.f6.fee_subtotal)).toBe('132.135.000');
    expect(formatVnd(fixture.quotes.f6.fee_vat)).toBe('10.570.800');
    expect(formatVnd(fixture.quotes.f6.fee_total)).toBe('142.705.800');
    expect(formatVnd(price('SEO', 2))).toBe('84.500.000');
    expect(formatVnd(price('MED', 2))).toBe('74.750.000');
    expect(formatVnd(price('MKT', 0))).toBe('65.000.000');
    expect(formatVnd(fixture.quotes.f9_web_basic)).toBe('119.494.949');
    expect(formatVnd(fixture.quotes.f11_web_standard)).toBe('126.307.000');
    const source = readFileSync(join(here, 'pricing-preview.ts'), 'utf8');
    expect(source).not.toMatch(/\bNumber\(/);
  });

  it('builds the F6 trial lines, a zero rounding unit, a higher overhead, and a margin of 1', () => {
    const form = trialFromFixture();
    const lines = buildPreviewBody(form, [
      { key: '1', type: 'package', service_code: 'WEB', level: 'standard', item_code: '', qty: '1' },
      { key: '2', type: 'item', service_code: '', level: 'basic', item_code: 'WEB-04-08', qty: '2' },
    ], 'version-1');
    expect(lines.lines).toEqual([
      { type: 'package', service_code: 'WEB', level: 'standard', qty: '1' },
      { type: 'item', code: 'WEB-04-08', qty: '2' },
    ]);
    const rounded = buildPreviewBody({ ...form, settings: { ...form.settings, rounding_unit: '0' } }, [], 'version-1');
    expect(rounded.params_override.settings.rounding_unit).toBe('0');
    const overhead = buildPreviewBody({ ...form, settings: { ...form.settings, overhead_pct: '0.35' } }, [], 'version-1');
    expect(overhead.params_override.settings.overhead_pct).toBe('0.35');
    const margin = buildPreviewBody({ ...form, settings: { ...form.settings, margin_pct: '1' } }, [], 'version-1');
    expect(margin.params_override.settings.margin_pct).toBe('1');
    expect(previewFieldError('margin_out_of_range')).toEqual({ margin_pct: 'margin_out_of_range' });
  });

  it('keeps blank version fields empty and prefers PV-2026-01', () => {
    const form = trialFromVersion([{ role_code: 'dev', monthly_salary: null, productive_hours: '132' }], { margin_pct: null, rounding_unit: null });
    expect(form.roles.find((role) => role.role_code === 'dev')?.monthly_salary).toBe('');
    expect(form.settings.margin_pct).toBe('');
    expect(preferredVersionId([{ id: 'a', code: 'PV-2026-02' }, { id: 'b', code: 'PV-2026-01' }])).toBe('b');
  });

  it('marks 15 inversions except RET and the five identical scopes', () => {
    const inverted = fixture.matrix.filter((row) => row.inversion).map((row) => row.code);
    expect(inverted).toHaveLength(15);
    expect(inverted).not.toContain('RET');
    expect(fixture.matrix.filter((row) => row.scope_identical).map((row) => row.code).sort()).toEqual(['CRM', 'DSH', 'MAU', 'SEO', 'VID']);
  });

  it('does not save, clone, or activate from the trial frame', () => {
    const panel = readFileSync(join(here, '../../app/crm/pricing/PricePreviewPanel.tsx'), 'utf8');
    expect(panel).toContain('previewP13Pricing');
    expect(panel).not.toMatch(/patchP13Pricing|activateP13Pricing|cloneP13Pricing|createP13PricingDraft|localStorage/);
    const api = readFileSync(join(here, 'api.ts'), 'utf8');
    const helper = api.slice(api.indexOf('export function previewP13Pricing'), api.indexOf('export function fetchP13PricingMatrix'));
    expect(helper).toContain('/api/crm/p13/pricing/preview');
    expect(helper).not.toMatch(/versions\/|activate|clone/);
  });
});
