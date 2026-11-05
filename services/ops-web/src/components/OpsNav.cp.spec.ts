import { describe, expect, it } from 'vitest';
import type { StoredStaffUser } from '@/lib/auth';
import { shouldShowCpNav } from './ops-nav-cp';

function user(caps: Array<{ section: string; action: string }>): StoredStaffUser {
  return {
    id: '1',
    email: 'u@pttads.vn',
    display_name: 'Test',
    position_id: 2,
    caps,
  };
}

describe('shouldShowCpNav', () => {
  it('shows when user has crm_cp view', () => {
    expect(shouldShowCpNav(user([{ section: 'crm_cp', action: 'view' }]))).toBe(true);
  });

  it('shows when user has crm_cp view_all', () => {
    expect(shouldShowCpNav(user([{ section: 'crm_cp', action: 'view_all' }]))).toBe(true);
  });

  it('hides without cp caps', () => {
    expect(shouldShowCpNav(user([{ section: 'crm_board', action: 'view' }]))).toBe(false);
  });
});
