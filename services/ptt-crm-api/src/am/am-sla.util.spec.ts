import { addAmBusinessMinutes, computeAmSlaDues } from './am-sla.util';

const VN = {
  workday_start: '08:30',
  workday_end: '17:30',
  workdays: [1, 2, 3, 4, 5],
  holidays: ['2026-09-02'],
};

describe('am-sla.util', () => {
  it('addAmBusinessMinutes skips weekends and VN holidays (ICT)', () => {
    // Tuesday 17:00 ICT + 60 min; Wed 2026-09-02 holiday → Thu 09:00 ICT
    const start = new Date('2026-09-01T10:00:00.000Z');
    const due = addAmBusinessMinutes(start, 60, VN);
    expect(due.toISOString()).toBe('2026-09-03T02:00:00.000Z');
  });

  it('computeAmSlaDues writes first-response and resolve instants', () => {
    const start = new Date('2026-09-01T01:30:00.000Z'); // Tue 08:30 ICT
    const dues = computeAmSlaDues(start, {
      first_response_minutes: 60,
      resolve_minutes: 120,
      workday_start: '08:30',
      workday_end: '17:30',
      workdays: [1, 2, 3, 4, 5],
      holidays: [],
    });
    expect(dues.sla_first_due_at).toBe('2026-09-01T02:30:00.000Z');
    expect(dues.sla_resolve_due_at).toBe('2026-09-01T03:30:00.000Z');
  });
});
