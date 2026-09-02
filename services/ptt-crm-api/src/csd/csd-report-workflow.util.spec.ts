import { canTransitionReport } from './csd-report-workflow.util';

describe('csd-report-workflow.util', () => {
  describe('canTransitionReport', () => {
    it('blocks monthly draft→sent without bypass', () => {
      expect(canTransitionReport('draft', 'sent', { requires_approval: true, bypass: false })).toBe(false);
      expect(canTransitionReport('draft', 'sent', { requires_approval: false, bypass: false })).toBe(true);
      expect(canTransitionReport('approved', 'sent', { requires_approval: true, bypass: false })).toBe(true);
    });
  });
});
