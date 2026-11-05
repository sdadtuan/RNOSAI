import { describe, expect, it } from 'vitest';
import { canSeeP13Catalog } from './flags';
import type { StoredStaffUser } from '@/lib/auth';

function user(partial: Partial<StoredStaffUser>): StoredStaffUser {
  return { id: '1', email: 'a@b.c', display_name: 'A', position_id: 1, ...partial };
}

describe('p13 menu', () => {
  it('stays hidden when the flag is off', () => {
    expect(
      canSeeP13Catalog(
        user({
          feature_flags: { p13_enabled: false },
          caps: [{ section: 'p13_catalog', action: 'view' }],
        }),
      ),
    ).toBe(false);
  });

  it('shows the catalog when the flag and cap are on', () => {
    expect(
      canSeeP13Catalog(
        user({
          feature_flags: { p13_enabled: true },
          caps: [{ section: 'p13_catalog', action: 'view' }],
        }),
      ),
    ).toBe(true);
  });
});
