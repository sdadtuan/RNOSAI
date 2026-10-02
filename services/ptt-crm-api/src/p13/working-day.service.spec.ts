import { WorkingDayService } from './working-day.service';

describe('WorkingDayService', () => {
  it('counts Monday 2026-10-05 plus 6 working days as 2026-10-12', () => {
    const calendar = new WorkingDayService();
    expect(calendar.addWorkingDays('2026-10-05', 6)).toBe('2026-10-12');
    expect(calendar.workingDaysBetween('2026-10-05', '2026-10-12')).toBe(6);
    expect(calendar.isWorkingDay('2026-10-10')).toBe(false);
  });

  it('skips a Thursday holiday and lands on 2026-10-13', () => {
    const calendar = new WorkingDayService(new Set(['2026-10-08']));
    expect(calendar.isWorkingDay('2026-10-08')).toBe(false);
    expect(calendar.addWorkingDays('2026-10-05', 6)).toBe('2026-10-13');
  });

  it('does not treat an empty holiday set as a blocker', () => {
    expect(new WorkingDayService(new Set()).isWorkingDay('2026-10-05')).toBe(true);
  });
});
