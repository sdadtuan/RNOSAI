import { addBusinessMinutes, classifySlaStatus, localParts, makeLocalDate } from './csd-sla.util';
import type { CsdSlaPolicySlice } from './csd.types';

const basePolicy: CsdSlaPolicySlice = {
  workday_start: '09:00',
  workday_end: '18:00',
  workdays: [1, 2, 3, 4, 5],
  holidays: [],
  at_risk_pct: 70,
  near_breach_pct: 90,
};

function localTimeLabel(d: Date): string {
  const parts = localParts(d);
  const hour = Math.floor(parts.minutes / 60);
  const minute = parts.minutes % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

describe('csd-sla.util', () => {
  it('adds 60 business minutes on Tuesday 09:00 to 10:00', () => {
    const start = makeLocalDate('2026-09-01', 9 * 60);
    const result = addBusinessMinutes(start, 60, basePolicy);
    expect(localTimeLabel(result)).toBe('10:00');
  });

  it('rolls Friday 17:30 + 60m to Monday 09:30', () => {
    const start = makeLocalDate('2026-09-04', 17 * 60 + 30);
    const result = addBusinessMinutes(start, 60, basePolicy);
    expect(localParts(result).dateKey).toBe('2026-09-07');
    expect(localTimeLabel(result)).toBe('09:30');
  });

  it('skips holidays when adding business minutes', () => {
    const policy: CsdSlaPolicySlice = {
      ...basePolicy,
      holidays: ['2026-09-02'],
    };
    const start = makeLocalDate('2026-09-01', 17 * 60);
    const result = addBusinessMinutes(start, 120, policy);
    expect(localParts(result).dateKey).toBe('2026-09-03');
    expect(localTimeLabel(result)).toBe('10:00');
  });

  it('classifies near_breach at 91%', () => {
    expect(classifySlaStatus(91, false)).toBe('near_breach');
  });

  it('classifies paused when timer is paused', () => {
    expect(classifySlaStatus(0, true)).toBe('paused');
  });

  it('classifies on_track below at_risk threshold', () => {
    expect(classifySlaStatus(50, false)).toBe('on_track');
  });

  it('classifies at_risk between 70 and 89', () => {
    expect(classifySlaStatus(75, false)).toBe('at_risk');
  });

  it('classifies breached at 100%', () => {
    expect(classifySlaStatus(100, false)).toBe('breached');
  });
});
