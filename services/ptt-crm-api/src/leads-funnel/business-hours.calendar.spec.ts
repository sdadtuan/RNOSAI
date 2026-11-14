import {
  acceptDueAt,
  addBusinessDays,
  addBusinessHours,
  buildBusinessCalendar,
  businessCalendar,
  DEFAULT_BUSINESS_CALENDAR,
  isInsideBusinessHours,
  resetBusinessCalendars,
  setBusinessCalendars,
} from './business-hours.util';
import { customerResponseDueAt, revisionDueAt } from './handoff-sla.util';
import { solutionWorkDueAt } from './solution-case.util';
import { currentSolutionWorkSettings, setSolutionClockSettings, solutionRevisionHours } from './team-sla-solution-settings';
import { composeBusinessCalendars } from '../team-sla/business-calendar.util';

/** T2–T7, 09:00–17:00 (non-default calendar). */
const MON_SAT_9_17 = buildBusinessCalendar({ days: [1, 2, 3, 4, 5, 6], start: '09:00', end: '17:00' });
/** Asia/Saigon wall time → Date. */
const ict = (iso: string) => new Date(`${iso}+07:00`);

afterEach(() => {
  resetBusinessCalendars();
  setSolutionClockSettings(null);
});

describe('business calendar from settings (T2–T7 09:00–17:00)', () => {
  it('counts Saturday as a working day and stops at 17:00', () => {
    // Fri 13/11 16:00 + 2h: 1h Friday, 1h Saturday from 09:00.
    expect(addBusinessHours(ict('2026-11-13T16:00:00'), 2, MON_SAT_9_17).toISOString()).toBe('2026-11-14T03:00:00.000Z');
    // Default calendar: 16:00 + 2h = 18:00 the same Friday.
    expect(addBusinessHours(ict('2026-11-13T16:00:00'), 2).toISOString()).toBe('2026-11-13T11:00:00.000Z');
  });

  it('skips Sunday and starts the next day at 09:00', () => {
    expect(addBusinessHours(ict('2026-11-14T16:30:00'), 1, MON_SAT_9_17).toISOString()).toBe('2026-11-16T02:30:00.000Z');
  });

  it('skips holidays from the config', () => {
    const withHoliday = buildBusinessCalendar({ days: [1, 2, 3, 4, 5, 6], start: '09:00', end: '17:00', holidays: ['2026-11-16'] });
    expect(addBusinessHours(ict('2026-11-14T16:30:00'), 1, withHoliday).toISOString()).toBe('2026-11-17T02:30:00.000Z');
    expect(isInsideBusinessHours(ict('2026-11-16T10:00:00'), withHoliday)).toBe(false);
  });

  it('one business day is one shift (8h here)', () => {
    expect(addBusinessDays(ict('2026-11-16T09:00:00'), 1, MON_SAT_9_17).toISOString()).toBe('2026-11-16T10:00:00.000Z');
  });

  it('accept clock reopens at the configured shift start', () => {
    expect(acceptDueAt(ict('2026-11-14T17:10:00'), 15, MON_SAT_9_17).toISOString()).toBe('2026-11-16T02:00:00.000Z');
    expect(acceptDueAt(ict('2026-11-14T08:00:00'), 15, MON_SAT_9_17).toISOString()).toBe('2026-11-14T02:00:00.000Z');
    expect(acceptDueAt(ict('2026-11-16T10:00:00'), 15, MON_SAT_9_17).toISOString()).toBe('2026-11-16T03:15:00.000Z');
  });

  it('loaded calendars become the default for callers that pass none', () => {
    setBusinessCalendars({ default: MON_SAT_9_17 });
    expect(addBusinessHours(ict('2026-11-13T16:00:00'), 2).toISOString()).toBe('2026-11-14T03:00:00.000Z');
    expect(businessCalendar('marketing')).toBe(MON_SAT_9_17);
    resetBusinessCalendars();
    expect(businessCalendar()).toBe(DEFAULT_BUSINESS_CALENDAR);
  });

  it('Solution work clock uses the Marketing calendar (Saturday before cut-off)', () => {
    const settings = { cutoffTime: '15:30', beforeCutoffHours: 4, afterCutoffTime: '11:00' };
    // Sat 10:00 is a working day here: + 4h = 14:00 Saturday.
    expect(solutionWorkDueAt(ict('2026-11-14T10:00:00'), settings, MON_SAT_9_17).toISOString()).toBe('2026-11-14T07:00:00.000Z');
    // Default calendar: Saturday is off → Monday 11:00.
    expect(solutionWorkDueAt(ict('2026-11-14T10:00:00'), settings).toISOString()).toBe('2026-11-16T04:00:00.000Z');
    // Via the loaded team calendar.
    setBusinessCalendars({ groups: { marketing: MON_SAT_9_17 } });
    expect(solutionWorkDueAt(ict('2026-11-14T10:00:00'), settings).toISOString()).toBe('2026-11-14T07:00:00.000Z');
  });

  it('Solution received on a holiday is due at the after-cut-off time on the next working day', () => {
    const cal = buildBusinessCalendar({ days: [1, 2, 3, 4, 5], start: '08:30', end: '18:30', holidays: ['2026-11-16'] });
    expect(solutionWorkDueAt(ict('2026-11-16T09:00:00'), { afterCutoffTime: '11:00' }, cal).toISOString()).toBe(
      '2026-11-17T04:00:00.000Z',
    );
  });

  it('revision deadline uses "Hạn sửa Solutions (giờ)" from config', () => {
    setSolutionClockSettings({ revisionHours: 3 });
    expect(solutionRevisionHours()).toBe(3);
    expect(revisionDueAt(ict('2026-11-16T15:00:00'), solutionRevisionHours(), MON_SAT_9_17).toISOString()).toBe(
      '2026-11-17T03:00:00.000Z',
    );
    setSolutionClockSettings({});
    expect(solutionRevisionHours()).toBe(2);
  });

  it('customer response clock follows the Sale dịch vụ calendar', () => {
    setBusinessCalendars({ groups: { sale_service: MON_SAT_9_17 } });
    // Fri 13/11 15:00 + 8h: 2h Friday + 6h Saturday → Sat 15:00.
    expect(customerResponseDueAt(ict('2026-11-13T15:00:00')).toISOString()).toBe('2026-11-14T08:00:00.000Z');
  });
});

describe('buildBusinessCalendar', () => {
  it('falls back for blank / invalid parts', () => {
    expect(buildBusinessCalendar({ days: [], start: '', end: '' })).toEqual(DEFAULT_BUSINESS_CALENDAR);
    expect(buildBusinessCalendar({ days: [9, 0], start: '18:00', end: '09:00' })).toEqual(DEFAULT_BUSINESS_CALENDAR);
    expect(buildBusinessCalendar({ holidays: ['2026-09-02', 'bad', '2026-09-02T00:00:00Z'] }).holidays).toEqual(['2026-09-02']);
  });
});

describe('composeBusinessCalendars', () => {
  const doc = {
    version: 1,
    profiles: [
      { code: 'sale_service', calendar: { days: [1, 2, 3, 4, 5, 6], start: '09:00', end: '17:00' }, marketing: {} },
      {
        code: 'marketing',
        calendar: { days: [1, 2, 3, 4, 5], start: '08:00', end: '17:30' },
        marketing: {
          solution_cutoff_time: '15:00',
          solution_before_cutoff_hours: 3,
          solution_after_cutoff_time: '10:00',
          revision_hours: 4,
        },
      },
      { code: 'sale_real_estate', calendar: { days: [1, 2, 3, 4, 5], start: '', end: '' }, marketing: {} },
    ],
  } as never;

  it('maps the per-team calendars, shared holidays and Marketing Solution clocks', () => {
    const snap = composeBusinessCalendars(
      { working_hours: { days: [1, 2, 3, 4, 5], start: '08:30', end: '18:30' }, holidays: ['2026-09-02'] },
      doc,
    );
    expect(snap.default.holidays).toEqual(['2026-09-02']);
    expect(snap.groups.sale_service).toMatchObject({ days: [1, 2, 3, 4, 5, 6], startMin: 540, endMin: 1020, holidays: ['2026-09-02'] });
    expect(snap.groups.marketing).toMatchObject({ startMin: 480, endMin: 1050 });
    // Blank shift → system default hours.
    expect(snap.groups.sale_real_estate).toMatchObject({ startMin: 510, endMin: 1110 });
    expect(snap.solution).toEqual({
      cutoffTime: '15:00',
      beforeCutoffHours: 3,
      afterCutoffTime: '10:00',
      workStartTime: '08:00',
      revisionHours: 4,
    });
  });

  it('missing config keeps T2–T6 08:30–18:30', () => {
    const snap = composeBusinessCalendars(null, null);
    expect(snap.default).toEqual(DEFAULT_BUSINESS_CALENDAR);
    expect(snap.groups).toEqual({});
    expect(currentSolutionWorkSettings()).toBeDefined();
  });
});
