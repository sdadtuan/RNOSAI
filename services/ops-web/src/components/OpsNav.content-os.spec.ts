import { describe, expect, it } from 'vitest';
import type { StoredStaffUser } from '@/lib/auth';
import { shouldShowContentOsNav } from './ops-nav-content-os';

function user(caps: Array<{ section: string; action: string }>): StoredStaffUser {
  return {
    id: '1',
    email: 'u@pttads.vn',
    display_name: 'Test',
    position_id: 2,
    caps,
  };
}

function restoreFlag(prev: string | undefined) {
  if (prev === undefined) {
    delete process.env.NEXT_PUBLIC_CONTENT_MARKETING;
  } else {
    process.env.NEXT_PUBLIC_CONTENT_MARKETING = prev;
  }
}

describe('shouldShowContentOsNav', () => {
  it('shows when flag is on and user has board + content view', () => {
    const prev = process.env.NEXT_PUBLIC_CONTENT_MARKETING;
    try {
      process.env.NEXT_PUBLIC_CONTENT_MARKETING = '1';
      expect(
        shouldShowContentOsNav(
          user([
            { section: 'crm_board', action: 'view' },
            { section: 'crm_content', action: 'view' },
          ]),
        ),
      ).toBe(true);
    } finally {
      restoreFlag(prev);
    }
  });

  it('hides when flag is off', () => {
    const prev = process.env.NEXT_PUBLIC_CONTENT_MARKETING;
    try {
      process.env.NEXT_PUBLIC_CONTENT_MARKETING = '0';
      expect(
        shouldShowContentOsNav(
          user([
            { section: 'crm_board', action: 'view' },
            { section: 'crm_content', action: 'view' },
          ]),
        ),
      ).toBe(false);
    } finally {
      restoreFlag(prev);
    }
  });

  it('hides for board view alone even when flag is on', () => {
    const prev = process.env.NEXT_PUBLIC_CONTENT_MARKETING;
    try {
      process.env.NEXT_PUBLIC_CONTENT_MARKETING = '1';
      expect(shouldShowContentOsNav(user([{ section: 'crm_board', action: 'view' }]))).toBe(false);
    } finally {
      restoreFlag(prev);
    }
  });
});
