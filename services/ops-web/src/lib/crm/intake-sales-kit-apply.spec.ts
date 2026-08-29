import { describe, expect, it } from 'vitest';
import { emptyDiscoveryForMode } from './intake-discovery';
import { applySalesKitToForm } from './intake-sales-kit-apply';
import { emptyWinIntel } from './intake-win-intel';

describe('applySalesKitToForm', () => {
  it('does not write bant unless selected', () => {
    const cur = { discovery: emptyDiscoveryForMode('phone'), winIntel: emptyWinIntel(), bant: { budget: 1 } };
    const next = applySalesKitToForm(cur, { bant_hints: { budget: 4 } }, {
      discovery: false,
      winIntel: false,
      bantHints: false,
    });
    expect(next.bant.budget).toBe(1);
  });

  it('writes bant when selected', () => {
    const cur = { discovery: emptyDiscoveryForMode('phone'), winIntel: emptyWinIntel(), bant: { budget: 1 } };
    const next = applySalesKitToForm(cur, { bant_hints: { budget: 4 } }, {
      discovery: false,
      winIntel: false,
      bantHints: true,
    });
    expect(next.bant.budget).toBe(4);
  });

  it('writes discovery when selected', () => {
    const cur = { discovery: emptyDiscoveryForMode('phone'), winIntel: emptyWinIntel(), bant: { budget: 1 } };
    const next = applySalesKitToForm(
      cur,
      { discovery: [{ key: 'phone_pain_point', answer: 'Thiếu lead' }] },
      { discovery: true, winIntel: false, bantHints: false },
    );
    expect(next.discovery.responses.phone_pain_point.answer).toBe('Thiếu lead');
    expect(cur.discovery.responses.phone_pain_point).toBeUndefined();
  });

  it('does not write win intel unless selected', () => {
    const cur = { discovery: emptyDiscoveryForMode('phone'), winIntel: emptyWinIntel(), bant: { budget: 1 } };
    const next = applySalesKitToForm(cur, { win_intel: { incumbent: 'Agency A' } }, {
      discovery: false,
      winIntel: false,
      bantHints: false,
    });
    expect(next.winIntel.incumbent.answer).toBe('');
  });
});
