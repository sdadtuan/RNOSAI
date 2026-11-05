import { isStale, workLeftLabel } from './am-freshness.util';

describe('am-freshness.util', () => {
  it('reports 8h remaining at Tuesday 09:30 ICT', () => {
    expect(workLeftLabel(new Date('2026-09-01T02:30:00.000Z'))).toBe('Giờ LV còn 8h');
  });

  it('reports ngoài giờ on Saturday', () => {
    expect(workLeftLabel(new Date('2026-09-05T03:00:00.000Z'))).toBe('Ngoài giờ LV');
  });

  it('reports 0p after weekday hours', () => {
    expect(workLeftLabel(new Date('2026-09-04T11:00:00.000Z'))).toBe('Giờ LV còn 0p');
  });

  it('marks as_of older than 24h as stale', () => {
    const now = new Date('2026-09-05T10:00:00.000Z');
    expect(isStale(new Date('2026-09-04T09:00:00.000Z'), now)).toBe(true);
    expect(isStale(new Date('2026-09-05T09:30:00.000Z'), now)).toBe(false);
  });
});
