import { describe, expect, it } from 'vitest';
import type { StoredStaffUser } from '@/lib/auth';
import {
  REVOPS_MOBILE_NAV,
  REVOPS_NAV_GROUPS,
  activeRevopsHref,
  canSeeRevopsNav,
} from './revops-nav.util';

function user(caps: Array<{ section: string; action: string }>): StoredStaffUser {
  return { id: '1', email: 'u@pttads.vn', display_name: 'Test', position_id: 2, caps };
}

describe('REVOPS_NAV_GROUPS', () => {
  const items = REVOPS_NAV_GROUPS.flatMap((g) => g.items);
  it('has 4 groups and 12 items', () => {
    expect(REVOPS_NAV_GROUPS.map((g) => g.title)).toEqual([
      'TỔNG QUAN',
      'DOANH THU',
      'HIỆU SUẤT',
      'QUẢN TRỊ',
    ]);
    expect(items).toHaveLength(12);
  });
  it('locks prod hrefs', () => {
    expect(items.map((i) => [i.id, i.href])).toEqual([
      ['dashboard', '/crm/revenue-ops'],
      ['leads', '/crm/leads?revops=1'],
      ['pipeline', '/crm/revenue-ops/pipeline'],
      ['accounts', '/crm/account-management/clients?revops=1'],
      ['handover', '/crm/leads/handover?revops=1'],
      ['renewal', '/crm/account-management/renewals?revops=1'],
      ['kpi', '/crm/kpi-hub/sales?revops=1'],
      ['sla', '/crm/revenue-ops/sla'],
      ['reports', '/crm/revenue-ops/reports'],
      ['territory', '/crm/revenue-ops/territory'],
      ['approvals', '/crm/revenue-ops/approvals'],
      ['settings', '/crm/revenue-ops/settings'],
    ]);
  });
  it('mobile has 5 shortcuts', () => {
    expect(REVOPS_MOBILE_NAV.map((i) => i.id)).toEqual([
      'dashboard',
      'leads',
      'pipeline',
      'accounts',
      'kpi',
    ]);
  });
});

describe('activeRevopsHref', () => {
  it('matches command center exactly', () => {
    expect(activeRevopsHref('/crm/revenue-ops')).toBe('/crm/revenue-ops');
  });
  it('matches nested sla', () => {
    expect(activeRevopsHref('/crm/revenue-ops/sla')).toBe('/crm/revenue-ops/sla');
  });
  it('matches embed leads', () => {
    expect(activeRevopsHref('/crm/leads')).toBe('/crm/leads?revops=1');
  });
});

describe('canSeeRevopsNav', () => {
  it('fail-closed', () => {
    expect(canSeeRevopsNav(null)).toBe(false);
    expect(canSeeRevopsNav(user([{ section: 'crm_leads', action: 'view' }]))).toBe(false);
  });
  it('true for crm_revops.view', () => {
    expect(canSeeRevopsNav(user([{ section: 'crm_revops', action: 'view' }]))).toBe(true);
  });
});
