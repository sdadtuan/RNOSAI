import {
  allowedNextStatuses,
  isStatusTransitionAllowed,
  LeadStatusGateError,
  validateLeadStatusChange,
} from './lead-status-gate.util';

describe('lead-status-gate.util', () => {
  const baseCtx = {
    auditNote: 'Ghi chú audit đủ dài',
    allowOverride: false,
    overrideReason: '',
    b2Complete: true,
    hasOutreachActivity: true,
    needsCleanup: false,
  };

  it('blocks moi → chot (TC-LEAD-07)', () => {
    expect(isStatusTransitionAllowed('moi', 'chot')).toBe(false);
    expect(() =>
      validateLeadStatusChange({
        ...baseCtx,
        oldStatus: 'moi',
        newStatus: 'chot',
      }),
    ).toThrow(LeadStatusGateError);
  });

  it('allows moi → da_lien_he with outreach', () => {
    expect(() =>
      validateLeadStatusChange({
        ...baseCtx,
        oldStatus: 'moi',
        newStatus: 'da_lien_he',
      }),
    ).not.toThrow();
  });

  it('blocks moi → da_lien_he without outreach or B2', () => {
    expect(() =>
      validateLeadStatusChange({
        ...baseCtx,
        oldStatus: 'moi',
        newStatus: 'da_lien_he',
        hasOutreachActivity: false,
        b2Complete: false,
      }),
    ).toThrow(/activity liên hệ/);
  });

  it('requires audit note for chot', () => {
    expect(() =>
      validateLeadStatusChange({
        ...baseCtx,
        oldStatus: 'hen_gap',
        newStatus: 'chot',
        auditNote: 'ab',
      }),
    ).toThrow(/audit note/);
  });

  it('requires B2 complete for chot', () => {
    expect(() =>
      validateLeadStatusChange({
        ...baseCtx,
        oldStatus: 'hen_gap',
        newStatus: 'chot',
        b2Complete: false,
      }),
    ).toThrow(/Hoàn thành B2/);
  });

  it('allows override with reason for GDKD', () => {
    expect(() =>
      validateLeadStatusChange({
        ...baseCtx,
        oldStatus: 'moi',
        newStatus: 'chot',
        allowOverride: true,
        overrideReason: 'GDKD duyệt ngoại lệ deal hot',
        b2Complete: false,
        hasOutreachActivity: false,
        auditNote: 'Chốt ngoại lệ theo GDKD',
      }),
    ).not.toThrow();
  });

  it('lists allowed next statuses from moi', () => {
    expect(allowedNextStatuses('moi')).toEqual(['da_lien_he', 'lost', 'pending_cleanup']);
  });
});
