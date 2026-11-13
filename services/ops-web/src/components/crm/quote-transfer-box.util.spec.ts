import { describe, expect, it } from 'vitest';
import { shouldShowQuoteTransferBox } from './quote-transfer-box.util';

const base = {
  viewerIsCeo: true,
  viewerIsSuperAdmin: false,
  expectedRole: 'AM',
  candidateCount: 2,
  assigneeStaffId: 11,
};

describe('shouldShowQuoteTransferBox', () => {
  it('hides the AM box for CEO when the lead already has an AM', () => {
    expect(shouldShowQuoteTransferBox(base)).toBe(false);
  });

  it('keeps the box for SUPER-ADMIN even when an AM is assigned', () => {
    expect(shouldShowQuoteTransferBox({ ...base, viewerIsSuperAdmin: true })).toBe(true);
  });

  it('shows the box for CEO when no AM is assigned yet', () => {
    expect(shouldShowQuoteTransferBox({ ...base, assigneeStaffId: null })).toBe(true);
    expect(shouldShowQuoteTransferBox({ ...base, assigneeStaffId: 0 })).toBe(true);
  });

  it('still shows a Sale transfer box when a Sale assignee is set', () => {
    expect(
      shouldShowQuoteTransferBox({
        ...base,
        expectedRole: 'Sale',
        assigneeStaffId: 8,
      }),
    ).toBe(true);
  });

  it('hides when the viewer is not CEO', () => {
    expect(shouldShowQuoteTransferBox({ ...base, viewerIsCeo: false, assigneeStaffId: null })).toBe(false);
  });
});
