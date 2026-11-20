import {
  assertEligibleLeadOwner,
  ELIGIBLE_LEAD_OWNER_SQL,
  isEligibleLeadOwner,
} from './eligible-lead-owner';

describe('eligible-lead-owner', () => {
  it('requires active, can_receive_leads = true, and non-paused intake in SQL', () => {
    expect(ELIGIBLE_LEAD_OWNER_SQL).toMatch(/s\.active IS TRUE/);
    expect(ELIGIBLE_LEAD_OWNER_SQL).toMatch(/COALESCE\(s\.can_receive_leads,\s*FALSE\) IS TRUE/);
    expect(ELIGIBLE_LEAD_OWNER_SQL).toMatch(/crm_ae_intake/);
  });

  it('returns false and throws when unticked staff is checked', async () => {
    const query = jest.fn(async () => ({ rows: [] }));
    await expect(isEligibleLeadOwner(query, 57)).resolves.toBe(false);
    await expect(assertEligibleLeadOwner(query, 57)).rejects.toThrow(/chưa bật nhận lead/);
  });

  it('returns true when eligible staff is found', async () => {
    const query = jest.fn(async () => ({ rows: [{ id: 2 }] }));
    await expect(isEligibleLeadOwner(query, 2)).resolves.toBe(true);
    await expect(assertEligibleLeadOwner(query, 2)).resolves.toBeUndefined();
  });
});
