import { canTransition, mapLegacyStatus } from './quote-status.util';

describe('quote-status.util', () => {
  it('legacy sent maps to sent', () => {
    expect(mapLegacyStatus('sent')).toBe('sent');
  });

  it('maps remaining legacy statuses onto the 14-status set', () => {
    expect(mapLegacyStatus('draft')).toBe('draft');
    expect(mapLegacyStatus('accepted')).toBe('accepted');
    expect(mapLegacyStatus('rejected')).toBe('rejected');
  });

  it('allows required SRS transitions', () => {
    expect(canTransition('draft', 'pending_approval')).toBe(true);
    expect(canTransition('pending_approval', 'approved')).toBe(true);
    expect(canTransition('approved', 'sent')).toBe(true);
    expect(canTransition('sent', 'accepted')).toBe(true);
    expect(canTransition('viewed', 'accepted')).toBe(true);
    expect(canTransition('negotiation', 'accepted')).toBe(true);
    expect(canTransition('sent', 'expired')).toBe(true);
  });

  it('blocks skipping approval and leaving terminal states', () => {
    expect(canTransition('draft', 'sent')).toBe(false);
    expect(canTransition('accepted', 'draft')).toBe(false);
    expect(canTransition('archived', 'draft')).toBe(false);
  });
});
