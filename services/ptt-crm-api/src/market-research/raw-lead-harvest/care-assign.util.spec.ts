import {
  assertAssignableForCare,
  normalizeCareStatus,
  shouldRevokeAssignedCare,
} from './care-assign.util';

describe('care-assign.util', () => {
  it('defaults null care_status to awaiting_assign', () => {
    expect(normalizeCareStatus(null)).toBe('awaiting_assign');
    expect(normalizeCareStatus('assigned')).toBe('assigned');
  });

  it('revokes assigned after 3 days without contact update', () => {
    const now = new Date('2026-09-22T10:00:00.000Z');
    expect(
      shouldRevokeAssignedCare({
        care_status: 'assigned',
        care_contact_status: 'pending',
        assigned_at: '2026-09-18T09:00:00.000Z',
        now,
      }),
    ).toBe(true);
  });

  it('does not revoke when contacted within 3 days', () => {
    const now = new Date('2026-09-22T10:00:00.000Z');
    expect(
      shouldRevokeAssignedCare({
        care_status: 'assigned',
        care_contact_status: 'contacted',
        assigned_at: '2026-09-18T09:00:00.000Z',
        now,
      }),
    ).toBe(false);
  });

  it('does not revoke before 3 days', () => {
    const now = new Date('2026-09-22T10:00:00.000Z');
    expect(
      shouldRevokeAssignedCare({
        care_status: 'assigned',
        care_contact_status: 'pending',
        assigned_at: '2026-09-20T12:00:00.000Z',
        now,
      }),
    ).toBe(false);
  });

  it('blocks assign when already assigned or in CRM', () => {
    expect(assertAssignableForCare({ care_status: 'assigned' }).ok).toBe(false);
    expect(assertAssignableForCare({ crm_lead_id: 9 }).ok).toBe(false);
    expect(assertAssignableForCare({ care_status: 'awaiting_assign' }).ok).toBe(
      true,
    );
    expect(assertAssignableForCare({ care_status: 'revoked' }).ok).toBe(true);
  });
});
