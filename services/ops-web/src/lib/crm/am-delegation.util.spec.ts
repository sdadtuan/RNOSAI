import { describe, expect, it } from 'vitest';
import {
  amDelegationCrmStaffByEmail,
  amDelegationCrmStaffId,
  amDelegationErrorCopy,
  amDelegationFormError,
  amDelegationSelectOptions,
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

  it('does not submit a UUID roster id as NaN and accepts a mapped crm_staff id', () => {
    const uuid = '6f1d2c90-1111-4000-8000-0000000000aa';
    expect(Number(uuid)).toBeNaN();
    expect(amDelegationCrmStaffId({ id: uuid, email: 'am@ptt.vn' })).toBeNull();
    expect(
      amDelegationFormError({
        to_staff_id: Number(uuid),
        starts_on: '2026-09-05',
        ends_on: '2026-09-10',
      }),
    ).toBe('to_staff_id_required');

    const byEmail = amDelegationCrmStaffByEmail([{ id: 42, email: 'am@ptt.vn' }]);
    const mapped = amDelegationCrmStaffId({ id: uuid, email: 'am@ptt.vn' }, byEmail);
    expect(mapped).toBe(42);
    expect(
      amDelegationFormError({
        to_staff_id: mapped,
        starts_on: '2026-09-05',
        ends_on: '2026-09-10',
      }),
    ).toBeNull();

    const options = amDelegationSelectOptions(
      [{ id: uuid, email: 'am@ptt.vn', display_name: 'AM One' }],
      byEmail,
    );
    expect(options).toEqual([{ crm_staff_id: 42, label: 'AM One', email: 'am@ptt.vn' }]);
    expect(options[0]?.crm_staff_id).not.toBeNaN();
  });
});
