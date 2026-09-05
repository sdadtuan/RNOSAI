import { describe, expect, it } from 'vitest';
import { isAmDashboardLoading, shouldShowEmptyWidget } from './am-dashboard.util';

describe('isAmDashboardLoading', () => {
  it('is true only while loading without data', () => {
    expect(isAmDashboardLoading(true, null)).toBe(true);
    expect(isAmDashboardLoading(true, { kpis: {} })).toBe(false);
    expect(isAmDashboardLoading(false, null)).toBe(false);
  });
});

describe('shouldShowEmptyWidget', () => {
  it('hides empty copy while loading or on error', () => {
    expect(shouldShowEmptyWidget(true, '', [])).toBe(false);
    expect(shouldShowEmptyWidget(false, 'fail', [])).toBe(false);
  });

  it('retry after error: cleared error + loading hides empty copy', () => {
    // loadCenter clears error and sets loading before refetch
    expect(shouldShowEmptyWidget(true, '', [])).toBe(false);
  });

  it('shows empty copy after a successful empty load', () => {
    expect(shouldShowEmptyWidget(false, '', [])).toBe(true);
    expect(shouldShowEmptyWidget(false, '', [{}])).toBe(false);
  });
});
