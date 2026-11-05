import { DEFAULT_PTT_SETTINGS } from './quote-settings.service';
import {
  discountBpsFromTotals,
  evaluateQuotePolicy,
  type QuotePolicySettings,
} from './quote-policy.util';

const SETTINGS: QuotePolicySettings = {
  gm_floor_bps: Number(DEFAULT_PTT_SETTINGS.gm_floor_bps),
  discount_auto_bps: Number(DEFAULT_PTT_SETTINGS.discount_auto_bps),
  director_value_vnd: Number(DEFAULT_PTT_SETTINGS.director_value_vnd),
  payment_term_max_days: Number(DEFAULT_PTT_SETTINGS.payment_term_max_days),
};

function sectionsOf(totals: Parameters<typeof evaluateQuotePolicy>[1], flags?: Parameters<typeof evaluateQuotePolicy>[2]) {
  return evaluateQuotePolicy(SETTINGS, totals, flags).map((step) => step.section);
}

describe('quote-policy.util', () => {
  it('AC-03: GM 2240 bps below floor 2500 routes Finance + GDKD', () => {
    const steps = evaluateQuotePolicy(SETTINGS, {
      fee_vnd: 100_000_000,
      discount_vnd: 0,
      payable_vnd: 108_000_000,
      gm_bps: 2240,
    });

    expect(SETTINGS.gm_floor_bps).toBe(2500);
    expect(steps.map((s) => s.section)).toEqual(expect.arrayContaining(['Finance', 'GDKD']));
    expect(steps.some((s) => s.trigger === 'gm_floor' && s.section === 'Finance')).toBe(true);
    expect(steps.some((s) => s.trigger === 'gm_floor' && s.section === 'GDKD')).toBe(true);
  });

  it('BR-QT-006: zero-price dummy line does not hide discount/GM breach (totals after recalc)', () => {
    const real = {
      fee_vnd: 100_000_000,
      discount_vnd: 8_000_000,
      payable_vnd: 99_360_000,
      gm_bps: 2240,
    };
    const dummyLine = { fee_vnd: 0, discount_vnd: 0, payable_vnd: 0, gm_bps: null };
    const afterRecalc = {
      fee_vnd: real.fee_vnd + dummyLine.fee_vnd,
      discount_vnd: real.discount_vnd + dummyLine.discount_vnd,
      payable_vnd: real.payable_vnd + dummyLine.payable_vnd,
      gm_bps: real.gm_bps,
    };

    expect(discountBpsFromTotals(afterRecalc.fee_vnd, afterRecalc.discount_vnd)).toBe(800);
    expect(discountBpsFromTotals(dummyLine.fee_vnd, dummyLine.discount_vnd)).toBe(0);

    const fromTotals = sectionsOf(afterRecalc, { has_zero_price: true });
    const fromDummyOnly = sectionsOf(dummyLine, { has_zero_price: true });

    expect(fromTotals).toEqual(expect.arrayContaining(['Finance', 'GDKD', 'AM Lead', 'AD']));
    expect(fromDummyOnly).not.toEqual(expect.arrayContaining(['GDKD']));
    expect(fromDummyOnly).not.toEqual(expect.arrayContaining(['AM Lead']));
  });

  it('uses settings thresholds, not hard-coded 25% / 200tr', () => {
    const tight: QuotePolicySettings = {
      gm_floor_bps: 3000,
      discount_auto_bps: 200,
      director_value_vnd: 50_000_000,
      payment_term_max_days: 30,
    };
    const steps = evaluateQuotePolicy(
      tight,
      { fee_vnd: 100_000_000, discount_vnd: 3_000_000, payable_vnd: 60_000_000, gm_bps: 2800 },
      { payment_term_days: 45 },
    );
    const sections = steps.map((s) => s.section);
    expect(sections).toEqual(expect.arrayContaining(['AM Lead', 'AD', 'GDKD', 'Finance']));
    expect(steps.some((s) => s.triggers.includes('director_value'))).toBe(true);
    expect(steps.some((s) => s.triggers.includes('payment_term'))).toBe(true);
    expect(steps.some((s) => s.triggers.includes('gm_floor'))).toBe(true);
  });

  it('happy path discount ≤ auto and GM ≥ floor is Sales Manager only', () => {
    expect(
      sectionsOf({
        fee_vnd: 80_000_000,
        discount_vnd: 4_000_000,
        payable_vnd: 82_080_000,
        gm_bps: 2500,
      }),
    ).toEqual(['Sales Manager']);
  });

  it('kpi_contract_block routes Finance, GDKD, and AD (Strategy)', () => {
    const steps = evaluateQuotePolicy(
      SETTINGS,
      { fee_vnd: 100_000_000, discount_vnd: 0, payable_vnd: 108_000_000, gm_bps: 2240 },
      { kpi_contract_block: true },
    );
    expect(steps.map((s) => s.section)).toEqual(expect.arrayContaining(['Finance', 'GDKD', 'AD']));
    expect(steps.some((s) => s.trigger === 'kpi_contract')).toBe(true);
  });

  it('clause divergence routes Legal; custom/zero/missing cost routes Finance', () => {
    const base = {
      fee_vnd: 10_000_000,
      discount_vnd: 0,
      payable_vnd: 10_800_000,
      gm_bps: 3000,
    };
    expect(sectionsOf(base, { clause_diverged: true })).toEqual(
      expect.arrayContaining(['Legal', 'Sales Manager']),
    );
    expect(sectionsOf(base, { has_custom: true })).toEqual(expect.arrayContaining(['Finance']));
    expect(sectionsOf(base, { cost_missing: true })).toEqual(expect.arrayContaining(['Finance']));
  });
});
