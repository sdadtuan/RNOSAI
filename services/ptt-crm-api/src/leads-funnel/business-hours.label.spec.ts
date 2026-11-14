import {
  buildBusinessCalendar,
  businessCalendarDto,
  businessCalendarLabel,
  businessDaysLabel,
  DEFAULT_BUSINESS_CALENDAR,
  formatClockMinutes,
} from './business-hours.util';

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
    expect(businessCalendarDto(cal)).toEqual({
      days: [1, 2, 3, 4, 5, 6],
      start: '09:00',
      end: '17:00',
      holidays: ['2026-11-20'],
      label: '09:00–17:00 T2–T7',
    });
  });
});
