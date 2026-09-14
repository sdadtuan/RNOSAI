import { describe, expect, it } from 'vitest';
import type { StoredStaffUser } from '@/lib/auth';
import { shouldShowImageSopNav, shouldShowImageSopNavWithFe } from './ops-nav-image-sop';

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

  it('shows when user has crm_img view_all and API flag is on', () => {
    expect(shouldShowImageSopNav(user([{ section: 'crm_img', action: 'view_all' }]), true)).toBe(true);
  });

  it('hides when image SOP is disabled even with crm_img view', () => {
    expect(shouldShowImageSopNav(user([{ section: 'crm_img', action: 'view' }]), false)).toBe(false);
  });

  it('hides when enabled but user lacks crm_img caps', () => {
    expect(shouldShowImageSopNav(user([{ section: 'crm_board', action: 'view' }]), true)).toBe(false);
    expect(shouldShowImageSopNav(user([{ section: 'crm_cp', action: 'view' }]), true)).toBe(false);
  });

  it('hides for null user', () => {
    expect(shouldShowImageSopNav(null, true)).toBe(false);
  });
});

describe('shouldShowImageSopNavWithFe', () => {
  it('respects NEXT_PUBLIC_CP_IMAGE_SOP at build time', () => {
    const prev = process.env.NEXT_PUBLIC_CP_IMAGE_SOP;
    process.env.NEXT_PUBLIC_CP_IMAGE_SOP = '1';
    expect(shouldShowImageSopNavWithFe(user([{ section: 'crm_img', action: 'view' }]))).toBe(true);
    expect(shouldShowImageSopNavWithFe(user([{ section: 'crm_cp', action: 'view' }]))).toBe(false);
    process.env.NEXT_PUBLIC_CP_IMAGE_SOP = prev;
  });
});
