import { describe, expect, it } from 'vitest';
import {
  STAFF_REPORT_VERSION_STALE_BADGE,
  shouldShowStaffVersionStaleBadge,
} from './staff-report-list.util';

describe('staff-report-list.util', () => {
  it('P43 badge copy is list-level not report-expired claim', () => {
    expect(STAFF_REPORT_VERSION_STALE_BADGE).toMatch(/có thể đã lỗi thời/i);
    expect(STAFF_REPORT_VERSION_STALE_BADGE).not.toMatch(/báo cáo hết hạn|ISO|cert/i);
  });

  it('P43 shouldShowStaffVersionStaleBadge only when true', () => {
    expect(shouldShowStaffVersionStaleBadge(true)).toBe(true);
    expect(shouldShowStaffVersionStaleBadge(false)).toBe(false);
  });
});
