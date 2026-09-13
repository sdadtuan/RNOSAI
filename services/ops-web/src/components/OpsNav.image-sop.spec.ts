import { describe, expect, it } from 'vitest';
import type { StoredStaffUser } from '@/lib/auth';
import { shouldShowImageSopNav } from './ops-nav-image-sop';

function user(caps: Array<{ section: string; action: string }>): StoredStaffUser {
  return {
    id: '1',
    email: 'u@pttads.vn',
    display_name: 'Test',
    position_id: 2,
    caps,
  };
}

describe('shouldShowImageSopNav', () => {
  it('shows when image SOP is enabled and user has crm_img view', () => {
    expect(shouldShowImageSopNav(user([{ section: 'crm_img', action: 'view' }]), true)).toBe(true);
  });

  it('hides when image SOP is disabled even with crm_img view', () => {
    expect(shouldShowImageSopNav(user([{ section: 'crm_img', action: 'view' }]), false)).toBe(false);
  });

  it('hides when enabled but user lacks crm_img view', () => {
    expect(shouldShowImageSopNav(user([{ section: 'crm_board', action: 'view' }]), true)).toBe(false);
  });

  it('hides for null user', () => {
    expect(shouldShowImageSopNav(null, true)).toBe(false);
  });
});
