import { BadRequestException } from '@nestjs/common';
import {
  normalizePortalStaffPhone,
  parsePortalStaffInput,
  parsePortalStaffPatch,
  staffCanSeeNotification,
} from './portal-staff.util';

describe('normalizePortalStaffPhone', () => {
  it('strips spaces and punctuation, keeps a leading plus', () => {
    expect(normalizePortalStaffPhone('090 123 4567')).toBe('0901234567');
    expect(normalizePortalStaffPhone('+84 90-123-4567')).toBe('+84901234567');
    expect(normalizePortalStaffPhone('  ')).toBe('');
  });
});

describe('parsePortalStaffInput', () => {
  it('defaults role to staff and accepts name, email and phone', () => {
    const out = parsePortalStaffInput({
      name: 'Minh Thu',
      email: 'minhthu@demo.local',
      phone: '090 111 2222',
    });
    expect(out).toEqual({
      name: 'Minh Thu',
      email: 'minhthu@demo.local',
      phone: '0901112222',
      role: 'staff',
    });
  });

  it('allows viewer role and optional password of at least 8 chars', () => {
    const out = parsePortalStaffInput({
      email: 'view@demo.local',
      role: 'viewer',
      password: 'password1',
    });
    expect(out.role).toBe('viewer');
    expect(out.password).toBe('password1');
  });

  it('rejects missing email and phone', () => {
    expect(() => parsePortalStaffInput({})).toThrow(BadRequestException);
  });

  it('rejects phone-only because Portal login needs email', () => {
    try {
      parsePortalStaffInput({ phone: '0901234567' });
      fail('expected error');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).getResponse()).toMatchObject({ error: 'email_required_for_login' });
    }
  });

  it('rejects creating an approver and short passwords', () => {
    expect(() => parsePortalStaffInput({ email: 'a@x.com', role: 'approver' })).toThrow(BadRequestException);
    expect(() => parsePortalStaffInput({ email: 'a@x.com', password: 'short' })).toThrow(BadRequestException);
  });
});

describe('parsePortalStaffPatch', () => {
  it('accepts a partial name/phone/role update and ignores omitted fields', () => {
    const out = parsePortalStaffPatch({ name: '  Mai  ', phone: '090 222 3333', role: 'viewer' });
    expect(out).toEqual({
      name: 'Mai',
      phone: '0902223333',
      role: 'viewer',
      reset_password: false,
    });
    expect(out.email).toBeUndefined();
  });

  it('allows clearing the phone and validates a new email', () => {
    const out = parsePortalStaffPatch({ phone: '  ', email: 'Mai@Demo.Local' });
    expect(out.phone).toBe('');
    expect(out.email).toBe('mai@demo.local');
  });

  it('rejects approver role, invalid email, and short reset passwords', () => {
    expect(() => parsePortalStaffPatch({ role: 'approver' })).toThrow(BadRequestException);
    expect(() => parsePortalStaffPatch({ email: 'not-an-email' })).toThrow(BadRequestException);
    expect(() => parsePortalStaffPatch({ password: 'short' })).toThrow(BadRequestException);
  });

  it('treats a provided password as a reset', () => {
    const out = parsePortalStaffPatch({ password: 'password1' });
    expect(out.reset_password).toBe(true);
    expect(out.password).toBe('password1');
  });
});

describe('staffCanSeeNotification', () => {
  it('lets a staff member see only their targeted rows plus allowed broadcasts', () => {
    expect(
      staffCanSeeNotification({ role: 'staff', viewerId: 's1', portalUserId: 's1', category: 'care_assigned' }),
    ).toBe(true);
    expect(
      staffCanSeeNotification({ role: 'staff', viewerId: 's1', portalUserId: 's2', category: 'care_assigned' }),
    ).toBe(false);
    expect(
      staffCanSeeNotification({
        role: 'staff',
        viewerId: 's1',
        portalUserId: null,
        category: 'campaign_milestone',
      }),
    ).toBe(true);
    expect(
      staffCanSeeNotification({ role: 'staff', viewerId: 's1', portalUserId: null, category: 'creative_pending' }),
    ).toBe(false);
    expect(
      staffCanSeeNotification({ role: 'approver', viewerId: 'a1', portalUserId: null, category: 'creative_pending' }),
    ).toBe(true);
  });
});
