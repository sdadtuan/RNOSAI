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

  it('tower red cards have hrefs from red exception payload only', () => {
    const towerRed = [
      { title_vi: 'Lead A quá hạn', href: '/crm/leads/1', suggest_action: 'assign_lead' },
      { title_vi: 'Lead B quá hạn', href: '/crm/leads/2', suggest_action: null },
    ];
    const { cards } = cardsFromSources({
      towerRed,
      opsAlerts: [{ id: 99, title: 'Ops alert' }],
      hasFinanceCap: false,
    });
    const allowedHrefs = new Set(towerRed.map((ex) => ex.href));
    for (const card of cards.filter((c) => c.source === 'tower')) {
      expect(allowedHrefs.has(card.href)).toBe(true);
      expect(card.severity).toBe('red');
    }
  });

  it('tower red cards take priority before ops/pipeline within max 8', () => {
    const towerRed = Array.from({ length: 5 }, (_, i) => ({
      title_vi: `Tower red ${i}`,
      href: `/crm/tower/${i}`,
      suggest_action: 'remind_staff' as const,
    }));
    const opsAlerts = Array.from({ length: 6 }, (_, i) => ({
      id: i + 1,
      title: `Alert ${i}`,
    }));
    const pipeline = Array.from({ length: 4 }, (_, i) => ({
      recommendation_id: `r${i}`,
      title: `Deal ${i}`,
    }));
    const { cards } = cardsFromSources({
      towerRed,
      opsAlerts,
      pipeline,
      hasFinanceCap: false,
    });
    expect(cards).toHaveLength(8);
    expect(cards.slice(0, 5).every((c) => c.source === 'tower')).toBe(true);
    expect(cards.some((c) => c.source === 'ops_alerts')).toBe(true);
  });
});
