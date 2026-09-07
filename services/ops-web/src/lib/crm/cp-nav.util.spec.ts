import { describe, expect, it } from 'vitest';
import type { StoredStaffUser } from '@/lib/auth';
import { CP_NAV, canSeeCpNav } from './cp-nav.util';

function user(caps: Array<{ section: string; action: string }>): StoredStaffUser {
  return {
    id: '1',
    email: 'u@pttads.vn',
    display_name: 'Test',
    position_id: 2,
    caps,
  };
}

describe('canSeeCpNav', () => {
  it('fails closed without a user or creative production capability', () => {
    expect(canSeeCpNav(null)).toBe(false);
    expect(canSeeCpNav(undefined)).toBe(false);
    expect(canSeeCpNav(user([{ section: 'crm_agency', action: 'view' }]))).toBe(false);
  });

  it('allows crm_cp.view and crm_cp.view_all', () => {
    expect(canSeeCpNav(user([{ section: 'crm_cp', action: 'view' }]))).toBe(true);
    expect(canSeeCpNav(user([{ section: 'crm_cp', action: 'view_all' }]))).toBe(true);
  });
});

describe('CP_NAV', () => {
  it('has the required eight ids and labels without badges', () => {
    expect(CP_NAV).toHaveLength(8);
    expect(CP_NAV.map((item) => item.id)).toEqual([
      'overview',
      'projects',
      'video',
      'media',
      'brand',
      'calendar',
      'reports',
      'settings',
    ]);
    expect(CP_NAV.map((item) => item.label)).toEqual([
      'Tổng quan',
      'Dự án',
      'Video AI',
      'Thư viện',
      'Brand Kit',
      'Lịch xuất bản',
      'Báo cáo',
      'Cấu hình',
    ]);
    for (const item of CP_NAV) {
      expect(item).not.toHaveProperty('badge');
    }
  });
});
