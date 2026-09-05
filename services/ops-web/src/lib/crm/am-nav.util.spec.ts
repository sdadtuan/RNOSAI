import { describe, expect, it } from 'vitest';
import type { StoredStaffUser } from '@/lib/auth';
import { AM_NAV, canSeeAmNav } from './am-nav.util';

function user(caps: Array<{ section: string; action: string }>): StoredStaffUser {
  return {
    id: '1',
    email: 'u@pttads.vn',
    display_name: 'Test',
    position_id: 2,
    caps,
  };
}

describe('canSeeAmNav', () => {
  it('returns false for null or undefined', () => {
    expect(canSeeAmNav(null)).toBe(false);
    expect(canSeeAmNav(undefined)).toBe(false);
  });

  it('returns false for agency-only (fail-closed)', () => {
    expect(canSeeAmNav(user([{ section: 'crm_agency', action: 'view' }]))).toBe(false);
  });

  it('returns true for crm_am.view', () => {
    expect(canSeeAmNav(user([{ section: 'crm_am', action: 'view' }]))).toBe(true);
  });

  it('returns true for crm_am.view_all', () => {
    expect(canSeeAmNav(user([{ section: 'crm_am', action: 'view_all' }]))).toBe(true);
  });
});

describe('AM_NAV', () => {
  it('has 8 items, group order as specified, no badge field', () => {
    expect(AM_NAV).toHaveLength(8);
    expect(AM_NAV.map((item) => item.group)).toEqual([
      'TỔNG QUAN',
      'KHÁCH HÀNG',
      'KHÁCH HÀNG',
      'CÔNG VIỆC',
      'HỢP ĐỒNG',
      'PHÂN TÍCH',
      'PHÂN TÍCH',
      'CẤU HÌNH',
    ]);
    expect(AM_NAV.map((item) => item.href)).toEqual([
      '/crm/account-management',
      '/crm/account-management/clients',
      '/crm/account-management/onboarding',
      '/crm/account-management/work',
      '/crm/account-management/renewals',
      '/crm/account-management/reports',
      '/crm/account-management/health',
      '/crm/account-management/settings',
    ]);
    for (const item of AM_NAV) {
      expect(item).not.toHaveProperty('badge');
    }
  });
});
