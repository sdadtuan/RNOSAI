import { describe, expect, it } from 'vitest';
import {
  amDelegationErrorCopy,
  amDelegationFormError,
  amDelegationUntilLabel,
} from './am-delegation.util';

describe('am-delegation.util', () => {
  it('builds owner label ủy quyền đến YYYY-MM-DD', () => {
    expect(amDelegationUntilLabel('2026-09-10')).toBe('ủy quyền đến 2026-09-10');
    expect(amDelegationUntilLabel(null)).toBeNull();
    expect(amDelegationUntilLabel('')).toBeNull();
  });

  it('rejects self, inverted range, and missing fields', () => {
    expect(
      amDelegationFormError({
        from_staff_id: 7,
        to_staff_id: 7,
        starts_on: '2026-09-05',
        ends_on: '2026-09-10',
      }),
    ).toBe('delegation_self');
    expect(
      amDelegationFormError({
        to_staff_id: 8,
        starts_on: '2026-09-10',
        ends_on: '2026-09-05',
      }),
    ).toBe('ends_before_starts');
    expect(amDelegationFormError({ starts_on: '2026-09-05', ends_on: '2026-09-10' })).toBe(
      'to_staff_id_required',
    );
    expect(amDelegationFormError({ to_staff_id: 8 })).toBe('dates_required');
    expect(
      amDelegationFormError({
        to_staff_id: 8,
        starts_on: '2026-09-05',
        ends_on: '2026-09-10',
      }),
    ).toBeNull();
  });

  it('maps known error codes to copy', () => {
    expect(amDelegationErrorCopy('delegation_self')).toMatch(/chính mình/);
  });
});
