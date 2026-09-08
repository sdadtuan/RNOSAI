import { describe, expect, it } from 'vitest';
import type { StoredStaffUser } from '@/lib/auth';
import { QT_NAV, canSeeQtNav } from './qt-nav.util';

function user(caps: Array<{ section: string; action: string }>): StoredStaffUser {
  return {
    id: '1',
    email: 'u@pttads.vn',
    display_name: 'Test',
    position_id: 2,
    caps,
  };
}

describe('canSeeQtNav', () => {
  it('fails closed without a user or quote capability', () => {
    expect(canSeeQtNav(null)).toBe(false);
    expect(canSeeQtNav(undefined)).toBe(false);
    expect(canSeeQtNav(user([{ section: 'crm_agency', action: 'view' }]))).toBe(false);
  });

  it('allows crm_quote.view, crm_quote.view_all, and crm_board.view compat', () => {
    expect(canSeeQtNav(user([{ section: 'crm_quote', action: 'view' }]))).toBe(true);
    expect(canSeeQtNav(user([{ section: 'crm_quote', action: 'view_all' }]))).toBe(true);
    expect(canSeeQtNav(user([{ section: 'crm_board', action: 'view' }]))).toBe(true);
  });
});

describe('QT_NAV', () => {
  it('has exactly seven items and no Studio entry', () => {
    expect(QT_NAV).toHaveLength(7);
    expect(QT_NAV.map((item) => item.id)).toEqual([
      'overview',
      'list',
      'new',
      'catalog',
      'approvals',
      'reports',
      'settings',
    ]);
    expect(QT_NAV.map((item) => item.label)).toEqual([
      'Tổng quan',
      'Báo giá',
      'Tạo báo giá',
      'Service Catalog',
      'Phê duyệt',
      'Báo cáo',
      'Cấu hình',
    ]);
    expect(QT_NAV.map((item) => item.href)).toEqual([
      '/crm/proposals',
      '/crm/proposals/list',
      '/crm/proposals/new',
      '/crm/proposals/catalog',
      '/crm/proposals/approvals',
      '/crm/proposals/reports',
      '/crm/proposals/settings',
    ]);
    expect(QT_NAV.some((item) => /studio/i.test(item.id) || /studio/i.test(item.label) || /studio/i.test(item.href))).toBe(
      false,
    );
  });
});
