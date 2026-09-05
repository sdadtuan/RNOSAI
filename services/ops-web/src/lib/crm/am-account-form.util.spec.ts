import { describe, expect, it, vi } from 'vitest';
import {
  amAccountEditHref,
  amAccountFormCtas,
  amAccountSaveId,
  amConfirmLeave,
  amDraftStatus,
  amGuardDirtyClick,
  amOnboardingHref,
  amOwnerStaffPatch,
  amPrimaryContactError,
  hasAmPrimaryContact,
} from './am-account-form.util';

describe('am-account-form', () => {
  it('requires a primary contact when lifecycle is Active', () => {
    expect(hasAmPrimaryContact([])).toBe(false);
    expect(hasAmPrimaryContact([{ is_primary: false, full_name: 'An' }])).toBe(false);
    expect(hasAmPrimaryContact([{ is_primary: true, full_name: 'An' }])).toBe(true);
    expect(amPrimaryContactError('active', [])).toBe('primary_contact_required');
    expect(amPrimaryContactError('pending_handover', [])).toBe('');
    expect(amPrimaryContactError('active', [{ is_primary: true, full_name: 'An' }])).toBe('');
  });

  it('maps draft save to pending and onboarding CTA to the placeholder', () => {
    expect(amDraftStatus()).toBe('pending_handover');
    expect(amOnboardingHref('19d722af-0000-4000-8000-000000000001')).toBe(
      '/crm/account-management/onboarding?agency_client_id=19d722af-0000-4000-8000-000000000001',
    );
    expect(amAccountFormCtas()).toEqual(['Hủy', 'Lưu nháp', 'Lưu và tạo onboarding', 'Lưu']);
  });

  it('confirms dirty leave with window confirm (BR-024)', () => {
    const confirm = vi.fn(() => false);
    expect(amConfirmLeave(false, confirm)).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
    expect(amConfirmLeave(true, confirm)).toBe(false);
    expect(confirm).toHaveBeenCalled();
  });

  it('switches create retry onto the created edit id', () => {
    expect(amAccountSaveId(undefined, undefined)).toBe('');
    expect(amAccountSaveId(undefined, '19d722af-0000-4000-8000-000000000002')).toBe(
      '19d722af-0000-4000-8000-000000000002',
    );
    expect(amAccountSaveId('19d722af-0000-4000-8000-000000000002', 'other')).toBe(
      '19d722af-0000-4000-8000-000000000002',
    );
    expect(amAccountEditHref('19d722af-0000-4000-8000-000000000002')).toBe(
      '/crm/account-management/clients/19d722af-0000-4000-8000-000000000002/edit',
    );
  });

  it('intercepts in-app exits when the form is dirty', () => {
    const ev = { preventDefault: vi.fn() };
    expect(amGuardDirtyClick(ev, true, () => false)).toBe(false);
    expect(ev.preventDefault).toHaveBeenCalled();
    ev.preventDefault.mockClear();
    expect(amGuardDirtyClick(ev, true, () => true)).toBe(true);
    expect(ev.preventDefault).not.toHaveBeenCalled();
    expect(amGuardDirtyClick(ev, false, () => false)).toBe(true);
  });

  it('does not let edit-only reassign owner_staff_id', () => {
    expect(amOwnerStaffPatch('99', '7', false)).toEqual({ error: 'assign_required' });
    expect(amOwnerStaffPatch('7', '7', false)).toEqual({});
    expect(amOwnerStaffPatch('99', '7', true)).toEqual({ owner_staff_id: 99 });
  });
});
