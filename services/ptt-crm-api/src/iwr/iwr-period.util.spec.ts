import { iwrPeriodForTemplate, isIwrLate, isIwrWorkday, vnYmd } from './iwr-period.util';

describe('iwr-period.util', () => {
  it('vnYmd uses Asia/Ho_Chi_Minh', () => {
    expect(vnYmd(new Date('2026-09-03T17:30:00+07:00'))).toBe('2026-09-03');
    expect(vnYmd(new Date('2026-09-03T00:30:00+07:00'))).toBe('2026-09-03');
  });

  it('weekend is not a workday', () => {
    expect(isIwrWorkday('2026-09-04')).toBe(true);
    expect(isIwrWorkday('2026-09-05')).toBe(false);
    expect(isIwrWorkday('2026-09-06')).toBe(false);
  });

  it('daily due is 17:00 VN same day', () => {
    const p = iwrPeriodForTemplate('daily_work', new Date('2026-09-03T09:00:00+07:00'));
    expect(p).toEqual({
      period_start: '2026-09-03',
      period_end: '2026-09-03',
      due_at: '2026-09-03T17:00:00.000+07:00',
    });
  });

  it('weekly is Mon–Fri due Friday 17:00 VN', () => {
    const p = iwrPeriodForTemplate('weekly_work', new Date('2026-09-03T09:00:00+07:00'));
    expect(p.period_start).toBe('2026-08-31');
    expect(p.period_end).toBe('2026-09-04');
    expect(p.due_at).toBe('2026-09-04T17:00:00.000+07:00');
  });

  it('marks late after due', () => {
    expect(isIwrLate(new Date('2026-09-03T17:00:01+07:00'), new Date('2026-09-03T17:00:00+07:00'))).toBe(
      true,
    );
    expect(isIwrLate(new Date('2026-09-03T16:59:59+07:00'), new Date('2026-09-03T17:00:00+07:00'))).toBe(
      false,
    );
  });
});
