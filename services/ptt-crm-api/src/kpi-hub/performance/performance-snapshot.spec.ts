import { assertNotClosed, assertRowVersion, freezeSnapshot } from './performance-snapshot';

describe('performance-snapshot', () => {
  it('hash is stable across key order and ignores closed_at (AC-PM-06)', () => {
    const a = freezeSnapshot({ scorecard_id: 'sc-1', period: 'Q4-2026', items: [{ id: 'a', score: 80, weight: 100 }] });
    const b = freezeSnapshot({ items: [{ weight: 100, score: 80, id: 'a' }], period: 'Q4-2026', scorecard_id: 'sc-1' });
    expect(a.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(a.hash).toBe(b.hash);
    expect(a.hash).toBe(freezeSnapshot(a.payload).hash);
    expect(a.closed_at).toMatch(/T/);
  });

  it('mutate after close requires reopen; stale row_version throws', () => {
    expect(() => assertNotClosed('closed')).toThrow(/reopen_required/);
    expect(() => assertNotClosed('open')).not.toThrow();
    expect(() => assertRowVersion(3, 2)).toThrow(/stale_version/);
    expect(() => assertRowVersion(3, 3)).not.toThrow();
  });
});
