import { describe, expect, it } from 'vitest';
import { AM_360_TABS, am360HasForbiddenTabs, am360WaveCopy, parseAm360Tab } from './am-account-360.util';

describe('AM_360_TABS', () => {
  it('has exactly 10 tabs and no Ads/Portal', () => {
    expect(AM_360_TABS).toHaveLength(10);
    expect(AM_360_TABS.map((tab) => tab.label)).toEqual([
      'Tổng quan',
      'Timeline',
      'Dự án & dịch vụ',
      'Công việc',
      'Hợp đồng & Tài chính',
      'Health & Risk',
      'Cơ hội',
      'Phản hồi',
      'Tài liệu',
      'Audit',
    ]);
    expect(am360HasForbiddenTabs()).toBe(false);
  });

  it('implements overview, finance and audit in Wave 2', () => {
    const implemented = AM_360_TABS.filter((tab) => tab.implemented).map((tab) => tab.id);
    expect(implemented).toEqual(['overview', 'finance', 'audit']);
    expect(am360WaveCopy(AM_360_TABS.find((tab) => tab.id === 'timeline')!)).toBe(
      'Timeline — mở ở Wave 3',
    );
    expect(am360WaveCopy(AM_360_TABS.find((tab) => tab.id === 'opportunities')!)).toBe(
      'Cơ hội — mở ở Wave 4',
    );
  });

  it('defaults unknown tab query to overview', () => {
    expect(parseAm360Tab('ads')).toBe('overview');
    expect(parseAm360Tab('finance')).toBe('finance');
  });
});
