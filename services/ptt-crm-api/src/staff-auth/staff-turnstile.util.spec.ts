import { verifyStaffTurnstileToken } from './staff-turnstile.util';

describe('verifyStaffTurnstileToken', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('returns false when token empty', async () => {
    await expect(verifyStaffTurnstileToken('secret', '')).resolves.toBe(false);
  });

  it('returns true when siteverify success', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    }) as typeof fetch;
    await expect(verifyStaffTurnstileToken('secret', 'token', '1.2.3.4')).resolves.toBe(true);
  });

  it('returns false when siteverify fails', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: false, 'error-codes': ['invalid-input-response'] }),
    }) as typeof fetch;
    await expect(verifyStaffTurnstileToken('secret', 'bad')).resolves.toBe(false);
  });
});
