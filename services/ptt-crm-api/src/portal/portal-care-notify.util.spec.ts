import {
  careAssignedCopy,
  careCaseLink,
  careMessageCopy,
  careReassignedCopy,
  sameAssignee,
  shouldSkipDuplicateMessage,
} from './portal-care-notify.util';

describe('portal-care-notify.util', () => {
  it('builds a conversation or lead deep link', () => {
    expect(careCaseLink('message', 'abc')).toBe('/crm/messages?case=abc');
    expect(careCaseLink('lead', 'id with space')).toBe('/crm/leads?case=id%20with%20space');
  });

  it('writes Vietnamese copy for assign, reassign and new message', () => {
    expect(careAssignedCopy('Lan', 'message').title).toContain('Lan');
    expect(careAssignedCopy('Lan', 'lead').body).toContain('Lead');
    expect(careReassignedCopy('Lan', 'message').title).toMatch(/chuyển sang người khác/);
    expect(careMessageCopy('Lan', 'Xin chào').body).toBe('Xin chào');
  });

  it('dedupes unread message notifications and ignores no-op reassigns', () => {
    expect(shouldSkipDuplicateMessage(true)).toBe(true);
    expect(shouldSkipDuplicateMessage(false)).toBe(false);
    expect(sameAssignee('s1', 's1')).toBe(true);
    expect(sameAssignee('s1', 's2')).toBe(false);
    expect(sameAssignee(null, 's1')).toBe(false);
  });
});
