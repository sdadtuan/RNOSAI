import { describe, expect, it } from 'vitest';
import { loginHrefWithNext } from './login-next.util';

describe('loginHrefWithNext', () => {
  it('keeps the desktop shell and conversation on the return path', () => {
    expect(loginHrefWithNext('/crm/csd/chat?shell=desktop&c=abc')).toBe(
      '/login?next=%2Fcrm%2Fcsd%2Fchat%3Fshell%3Ddesktop%26c%3Dabc',
    );
  });

  it('rejects an off-site return path', () => {
    expect(loginHrefWithNext('https://evil.example/crm/csd/chat')).toBe('/login');
  });
});
