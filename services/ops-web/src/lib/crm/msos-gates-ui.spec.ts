import { describe, expect, it } from 'vitest';
import { canEnableInvoiceButton, canEnableLiveButton } from './msos-gates-ui';

describe('msos gates ui', () => {
  it('enables Live only when GT-P01 and GT-P02 pass', () => {
    expect(
      canEnableLiveButton([
        { id: 'GT-P01', pass: true },
        { id: 'GT-P02', pass: true },
      ]),
    ).toBe(true);
    expect(
      canEnableLiveButton([
        { id: 'GT-P01', pass: true },
        { id: 'GT-P02', pass: false },
      ]),
    ).toBe(false);
    expect(
      canEnableLiveButton([
        { id: 'GT-P01', pass: false },
        { id: 'GT-P02', pass: true },
      ]),
    ).toBe(false);
  });

  it('enables invoice only when pack official and no material discrepancy block', () => {
    expect(canEnableInvoiceButton({ packOfficial: true, discrepancyBlock: false })).toBe(true);
    expect(canEnableInvoiceButton({ packOfficial: false, discrepancyBlock: false })).toBe(false);
    expect(canEnableInvoiceButton({ packOfficial: true, discrepancyBlock: true })).toBe(false);
  });
});
