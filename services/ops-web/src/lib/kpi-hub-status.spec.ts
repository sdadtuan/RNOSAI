import { describe, expect, it } from 'vitest';
import {
  deriveHubStatus,
  freshnessStatus,
  hasFormulaCycle,
  ratioPeriod,
} from './kpi-hub-status';

describe('kpi-hub-status (ops-web)', () => {
  it('CPL 142k → ACHIEVED', () => {
    expect(
      deriveHubStatus({
        direction: 'LOWER_IS_BETTER',
        actual: 142000,
        target: 150000,
        warning: 180000,
        critical: 220000,
      }),
    ).toBe('ACHIEVED');
  });

  it('ratio blank-if-zero', () => {
    expect(ratioPeriod(100, 0, true)).toBeNull();
  });

  it('cycle detection', () => {
    expect(hasFormulaCycle([{ from: 'A', to: 'B' }, { from: 'B', to: 'A' }])).toBe(true);
  });

  it('SharePoint delayed', () => {
    expect(
      freshnessStatus(
        new Date('2026-09-04T06:30:00+07:00'),
        60,
        false,
        new Date('2026-09-04T08:45:00+07:00'),
      ),
    ).toBe('DELAYED');
  });
});
