import { describe, expect, it } from 'vitest';
import type { StoredStaffUser } from '@/lib/auth';
import { amCsHealthStripAvg, canSeeAmHealthStrip } from './am-cs-health-strip.util';

function user(caps: Array<{ section: string; action: string }>): StoredStaffUser {
  return {
    id: '1',
    email: 'u@pttads.vn',
    display_name: 'Test',
    position_id: 2,
    caps,
  };
}

describe('canSeeAmHealthStrip', () => {
  it('shows the strip only with crm_am.view', () => {
    expect(canSeeAmHealthStrip(user([{ section: 'crm_agency', action: 'view' }]))).toBe(false);
    expect(canSeeAmHealthStrip(user([{ section: 'crm_am', action: 'view' }]))).toBe(true);
  });
});

describe('amCsHealthStripAvg', () => {
  it('uses the latest non-null sparkline avg', () => {
    expect(
      amCsHealthStripAvg([
        { as_of: '2026-07-01', avg: 70 },
        { as_of: '2026-08-01', avg: null },
        { as_of: '2026-09-01', avg: 72.5 },
      ]),
    ).toBe(72.5);
  });

  it('returns null when sparkline is empty', () => {
    expect(amCsHealthStripAvg([])).toBeNull();
    expect(amCsHealthStripAvg(null)).toBeNull();
  });
});
