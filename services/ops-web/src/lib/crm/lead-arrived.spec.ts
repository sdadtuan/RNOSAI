import { describe, expect, it } from 'vitest';
import { formatLeadArrived } from './lead-arrived';

describe('formatLeadArrived', () => {
  it('shows the arrival clock in Vietnam time', () => {
    expect(formatLeadArrived({ received_at: '2026-10-17T06:35:00.000Z' })).toBe('2026-10-17 13:35');
  });

  it('prefers received_at over created_at', () => {
    expect(
      formatLeadArrived({
        received_at: '2026-10-17T01:00:00.000Z',
        created_at: '2026-10-18T01:00:00.000Z',
      }),
    ).toBe('2026-10-17 08:00');
  });

  it('keeps a date-only value as a date', () => {
    expect(formatLeadArrived({ received_at: '2026-10-17' })).toBe('2026-10-17');
  });

  it('returns a dash when no time is stored', () => {
    expect(formatLeadArrived({})).toBe('—');
  });
});
