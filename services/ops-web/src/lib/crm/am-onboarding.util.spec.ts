import { describe, expect, it } from 'vitest';
import {
  AM_ONBOARDING_TABS,
  amGoLiveBlocked,
  parseAmOnboardingTab,
} from './am-onboarding.util';

describe('am-onboarding', () => {
  it('uses six workspace nav labels', () => {
    expect(AM_ONBOARDING_TABS.map((tab) => tab.label)).toEqual([
      'Tổng quan',
      'Checklist',
      'Milestones',
      'Stakeholders',
      'Tài liệu',
      'Activity',
    ]);
  });

  it('parses workspace tab from URL or defaults to overview', () => {
    expect(parseAmOnboardingTab('checklist')).toBe('checklist');
    expect(parseAmOnboardingTab('milestones')).toBe('milestones');
    expect(parseAmOnboardingTab('unknown')).toBe('overview');
    expect(parseAmOnboardingTab(null)).toBe('overview');
  });

  it('blocks go-live when a required item is open and override is off', () => {
    const items = [
      {
        id: 'a',
        kind: 'checklist' as const,
        required: true,
        done: false,
      },
    ];
    expect(amGoLiveBlocked(items, false)).toBe(true);
    expect(amGoLiveBlocked(items, true)).toBe(false);
    expect(amGoLiveBlocked([{ ...items[0], done: true }], false)).toBe(false);
    expect(amGoLiveBlocked([{ ...items[0], required: false }], false)).toBe(false);
  });
});
