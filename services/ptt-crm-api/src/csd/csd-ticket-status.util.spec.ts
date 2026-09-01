import { canStartWork, canTransitionTicket } from './csd-ticket-status.util';

describe('csd-ticket-status.util', () => {
  describe('canTransitionTicket', () => {
    it('allows new to assigned', () => {
      expect(canTransitionTicket('new', 'assigned')).toBe(true);
    });

    it('denies closed to in_progress', () => {
      expect(canTransitionTicket('closed', 'in_progress')).toBe(false);
    });

    it('allows draft to new', () => {
      expect(canTransitionTicket('draft', 'new')).toBe(true);
    });

    it('allows in_progress to resolved', () => {
      expect(canTransitionTicket('in_progress', 'resolved')).toBe(true);
    });

    it('allows reopened to assigned', () => {
      expect(canTransitionTicket('reopened', 'assigned')).toBe(true);
    });

    it('denies cancelled transitions', () => {
      expect(canTransitionTicket('cancelled', 'new')).toBe(false);
    });
  });

  describe('canStartWork', () => {
    it('denies out_of_scope', () => {
      expect(canStartWork('out_of_scope', false)).toBe(false);
    });

    it('allows in_scope without approval', () => {
      expect(canStartWork('in_scope', false)).toBe(true);
    });

    it('requires approval for billable', () => {
      expect(canStartWork('billable', false)).toBe(false);
      expect(canStartWork('billable', true)).toBe(true);
    });

    it('requires approval for included_by_exception', () => {
      expect(canStartWork('included_by_exception', false)).toBe(false);
      expect(canStartWork('included_by_exception', true)).toBe(true);
    });
  });
});
