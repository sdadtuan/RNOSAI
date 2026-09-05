import { describe, expect, it } from 'vitest';
import type { StoredStaffUser } from '@/lib/auth';
import {
  accountCell,
  activeAccountView,
  applyAccountView,
  AM_ACCOUNT_VIEWS,
  canAssignAmAccounts,
  canSeeUnassignedAccounts,
  canShareAmView,
  parentChildLabel,
  viewQueryFromSearch,
  visibleAccountViews,
} from './am-accounts-views.util';

function user(caps: Array<{ section: string; action: string }>): StoredStaffUser {
  return {
    id: '1',
    email: 'u@pttads.vn',
    display_name: 'Test',
    position_id: 2,
    caps,
  };
}

describe('accountCell', () => {
  it('renders empty values as an em dash', () => {
    expect(accountCell(null)).toBe('—');
    expect(accountCell(undefined)).toBe('—');
    expect(accountCell('')).toBe('—');
  });
});

describe('parentChildLabel', () => {
  it('shows child count on parent rows', () => {
    expect(parentChildLabel(3, true)).toBe('3');
    expect(parentChildLabel(0, false)).toBeNull();
  });
});

describe('saved-view chips as URL presets', () => {
  it('does not hard-code account rows', () => {
    expect(AM_ACCOUNT_VIEWS.every((view) => !('rows' in view))).toBe(true);
    expect(AM_ACCOUNT_VIEWS.map((view) => view.label)).toEqual([
      'Tất cả',
      'Của tôi',
      'Cần chú ý',
      'Gia hạn 90 ngày',
      'Chưa gán owner',
      'Parent group',
    ]);
  });

  it('matches Của tôi from owner=me', () => {
    expect(activeAccountView(new URLSearchParams('owner=me'))).toBe('mine');
  });

  it('applies Gia hạn 90 ngày as sort+window query', () => {
    const renewal = AM_ACCOUNT_VIEWS.find((view) => view.id === 'renewal90')!;
    const next = applyAccountView(new URLSearchParams('scope=all&q=an'), renewal);
    expect(next.get('sort')).toBe('ends_on');
    expect(next.get('ends_within')).toBe('90');
    expect(next.get('scope')).toBe('all');
    expect(next.get('owner')).toBeNull();
  });

  it('hides unassigned chip from view-only users', () => {
    const viewOnly = user([{ section: 'crm_am', action: 'view' }]);
    expect(canSeeUnassignedAccounts(viewOnly)).toBe(false);
    expect(visibleAccountViews(viewOnly).some((view) => view.id === 'unassigned')).toBe(false);
    expect(
      visibleAccountViews(user([{ section: 'crm_am', action: 'assign' }])).some(
        (view) => view.id === 'unassigned',
      ),
    ).toBe(true);
  });
});

describe('saved view + transfer caps', () => {
  it('hides bulk assign from view-only users', () => {
    const viewOnly = user([{ section: 'crm_am', action: 'view' }]);
    expect(canAssignAmAccounts(viewOnly)).toBe(false);
    expect(canShareAmView(viewOnly)).toBe(false);
    expect(canAssignAmAccounts(user([{ section: 'crm_am', action: 'assign' }]))).toBe(true);
    expect(
      canShareAmView(
        user([
          { section: 'crm_am', action: 'assign' },
          { section: 'crm_am', action: 'view_all' },
        ]),
      ),
    ).toBe(true);
  });

  it('drops page from saved query_json', () => {
    expect(viewQueryFromSearch(new URLSearchParams('owner=me&page=2&q=an'))).toEqual({
      owner: 'me',
      q: 'an',
    });
  });
});
