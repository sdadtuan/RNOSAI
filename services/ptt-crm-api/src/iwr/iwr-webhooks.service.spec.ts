import { signWebhookBody } from './iwr-w5.repository';

describe('signWebhookBody', () => {
  it('returns stable HMAC-SHA256 hex', () => {
    const sig = signWebhookBody('secret', '{"event":"test"}');
    expect(sig).toMatch(/^[a-f0-9]{64}$/);
    expect(signWebhookBody('secret', '{"event":"test"}')).toBe(sig);
    expect(signWebhookBody('other', '{"event":"test"}')).not.toBe(sig);
  });
});
