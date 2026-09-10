import { buildLedgers, formatLedgerDisplay, isMaterialQuotedDelta, quotedDeltaPct } from './performance-ledgers';

describe('performance-ledgers', () => {
  it('formats ledger display strings for UI mockup', () => {
    expect(formatLedgerDisplay('quoted', { value: 100000, label: 'Quoted' })).toBe('≤100K CPL');
    expect(
      formatLedgerDisplay('verified', { value: null, label: 'Pending', pendingActual: 128000 }),
    ).toBe('128K · Pending');
  });

  it('keeps Quoted / Assigned / Verified separate and never promotes pending (AC-PM-07)', () => {
    const ledgers = buildLedgers({
      quoted_target: 100000,
      assigned_target: 85000,
      verified_actual: null,
      pending_actual: 128000,
      quality: 'stale',
    });
    expect(ledgers.quoted).toEqual({ value: 100000, label: 'Quoted' });
    expect(ledgers.assigned).toEqual({ value: 85000, label: 'Assigned' });
    expect(ledgers.verified).toEqual({ value: null, label: 'Pending' });
  });

  it('quoted vs assigned is material CO; quoted vs actual is registry column', () => {
    expect(quotedDeltaPct(100000, 85000)).toBe(-15);
    expect(quotedDeltaPct(100000, 128000)).toBe(28);
    expect(isMaterialQuotedDelta(-15, 10)).toBe(true);
    expect(isMaterialQuotedDelta(8, 10)).toBe(false);
    expect(quotedDeltaPct(0, 100)).toBeNull();
    expect(quotedDeltaPct(null, 100)).toBeNull();
  });

  it('verified quality exposes actual on verified ledger only', () => {
    const ledgers = buildLedgers({
      quoted_target: 160000,
      assigned_target: 160000,
      verified_actual: 149000,
      quality: 'verified',
    });
    expect(ledgers.verified).toEqual({ value: 149000, label: 'Verified' });
  });
});
