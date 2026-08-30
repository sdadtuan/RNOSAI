import { cardsFromSources } from './ceo-command-briefing.util';

describe('ceo-command-briefing.util', () => {
  it('hides finance cards without cap', () => {
    const { cards } = cardsFromSources({
      finance: { overdue: 2, rev7: 1, rev30: 1 },
      hasFinanceCap: false,
    });
    expect(cards.some((c) => c.source === 'finance')).toBe(false);
  });

  it('ops fail does not throw — degraded only', () => {
    const { cards, reply_vi } = cardsFromSources({
      pipeline: [{ recommendation_id: 'r1', title: 'Deal A' }],
      hasFinanceCap: true,
    });
    expect(cards.length).toBeGreaterThan(0);
    expect(reply_vi.length).toBeLessThanOrEqual(1200);
  });
});
