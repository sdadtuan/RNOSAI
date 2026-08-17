import { describe, expect, it } from 'vitest';
import {
  PORTAL_REPORT_LIST_STALE_BADGE,
  shouldShowReportListStaleBadge,
} from './portal-report-list.util';

describe('portal-report-list.util', () => {
  it('P41 badge copy is list-level not report-expired claim', () => {
    expect(PORTAL_REPORT_LIST_STALE_BADGE).toMatch(/có thể đã lỗi thời/i);
    expect(PORTAL_REPORT_LIST_STALE_BADGE).not.toMatch(/báo cáo hết hạn|ISO|cert/i);
  });

  it('P41 shouldShowReportListStaleBadge only when flag true', () => {
    expect(shouldShowReportListStaleBadge({ has_stale_insights: true })).toBe(true);
    expect(shouldShowReportListStaleBadge({ has_stale_insights: false })).toBe(false);
    expect(shouldShowReportListStaleBadge({})).toBe(false);
  });
});
