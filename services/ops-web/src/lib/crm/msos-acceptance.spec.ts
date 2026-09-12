import { describe, expect, it } from 'vitest';
import { MSOS_EMPTY, MSOS_UI_DENYLIST } from './msos-empty';
import { canEnableInvoiceButton, canEnableLiveButton } from './msos-gates-ui';

/**
 * MSOS W1+WIN FE acceptance — denylist, empty copy, gate button helpers.
 */
describe('MSOS FE acceptance', () => {
  it('empty copy has no demo ids from denylist', () => {
    const blob = JSON.stringify(MSOS_EMPTY);
    for (const n of MSOS_UI_DENYLIST) {
      expect(blob).not.toContain(n);
    }
  });

  it('denylist entries are non-empty and unique', () => {
    expect(MSOS_UI_DENYLIST.length).toBeGreaterThan(0);
    expect(new Set(MSOS_UI_DENYLIST).size).toBe(MSOS_UI_DENYLIST.length);
  });

  it('canEnableLiveButton requires GT-P01 and GT-P02 pass', () => {
    expect(
      canEnableLiveButton([
        { id: 'GT-P01', pass: true },
        { id: 'GT-P02', pass: true },
        { id: 'GT-P03', pass: false },
      ]),
    ).toBe(true);
    expect(
      canEnableLiveButton([
        { id: 'GT-P01', pass: true },
        { id: 'GT-P02', pass: false },
      ]),
    ).toBe(false);
    expect(canEnableLiveButton([])).toBe(false);
  });

  it('canEnableInvoiceButton requires official pack and no material discrepancy block', () => {
    expect(canEnableInvoiceButton({ packOfficial: true, discrepancyBlock: false })).toBe(true);
    expect(canEnableInvoiceButton({ packOfficial: false, discrepancyBlock: false })).toBe(false);
    expect(canEnableInvoiceButton({ packOfficial: true, discrepancyBlock: true })).toBe(false);
    expect(canEnableInvoiceButton({ packOfficial: false, discrepancyBlock: true })).toBe(false);
  });
});
