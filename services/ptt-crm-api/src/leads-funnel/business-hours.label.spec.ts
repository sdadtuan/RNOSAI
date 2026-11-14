import {
  buildBusinessCalendar,
  businessCalendarDto,
  businessCalendarLabel,
  businessDaysLabel,
  DEFAULT_BUSINESS_CALENDAR,
  formatClockMinutes,
  resetBusinessCalendars,
  setBusinessCalendars,
} from './business-hours.util';
import { buildHandoffSlaView } from './handoff-sla.util';
import { solutionWorkRuleText } from './solution-case.util';

describe('business calendar labels', () => {
  it('formats the default calendar', () => {
    expect(formatClockMinutes(510)).toBe('08:30');
    expect(businessCalendarLabel(DEFAULT_BUSINESS_CALENDAR)).toBe('08:30–18:30 T2–T6');
  });

  it('follows a non-default calendar', () => {
    const cal = buildBusinessCalendar({ days: [1, 2, 3, 4, 5, 6], start: '09:00', end: '17:00', holidays: ['2026-11-20'] });
    expect(businessCalendarLabel(cal)).toBe('09:00–17:00 T2–T7');
    expect(businessDaysLabel([1, 3, 5])).toBe('T2, T4, T6');
    expect(businessDaysLabel([6, 7])).toBe('T7, CN');
    expect(solutionWorkRuleText({ cutoffTime: '16:00', beforeCutoffHours: 3, afterCutoffTime: '10:00' })).toBe(
      'Trước 16:00: 3 giờ làm việc. Sau 16:00 hoặc ngày nghỉ: 10:00 ngày làm việc kế tiếp.',
    );
    expect(businessCalendarDto(cal)).toEqual({
      days: [1, 2, 3, 4, 5, 6],
      start: '09:00',
      end: '17:00',
      holidays: ['2026-11-20'],
      label: '09:00–17:00 T2–T7',
    });
  });
});

type Src = Parameters<typeof buildHandoffSlaView>[0];

describe('clock copy follows config', () => {
  afterEach(() => resetBusinessCalendars());

  it('revision / CEO / customer messages use the loaded calendars', () => {
    const sat = buildBusinessCalendar({ days: [1, 2, 3, 4, 5, 6], start: '09:00', end: '17:00', holidays: [] });
    setBusinessCalendars({ default: sat, groups: { marketing: sat, sale_service: sat } });
    const now = new Date('2026-11-16T03:00:00.000Z');
    const revision = buildHandoffSlaView(
      {
        handoffStatus: 'with_solution',
        solutionRevisionDueAt: '2026-11-16T05:00:00.000Z',
        workSettings: { revisionHours: 3 },
      } as unknown as Src,
      now,
    ).clocks.find((c) => c.key === 'solution_revision');
    expect(JSON.stringify(revision)).toContain('3 giờ làm việc (09:00–17:00 T2–T7)');
    const ceo = buildHandoffSlaView({ quoteSentBackAt: '2026-11-16T02:00:00.000Z' } as unknown as Src, now).clocks.find((c) => c.key === 'ceo_approve');
    expect(JSON.stringify(ceo)).toContain('(09:00–17:00 T2–T7)');
  });
});
