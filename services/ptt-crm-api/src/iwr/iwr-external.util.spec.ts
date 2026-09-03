import { isExternalEmailAllowed } from './iwr-external.util';

describe('iwr-external.util', () => {
  it('rejects gmail when not on allowlist', () => {
    expect(isExternalEmailAllowed('user@gmail.com', ['client.com'])).toBe(false);
  });

  it('allows domain on allowlist', () => {
    expect(isExternalEmailAllowed('a@client.com', ['client.com'])).toBe(true);
  });
});
