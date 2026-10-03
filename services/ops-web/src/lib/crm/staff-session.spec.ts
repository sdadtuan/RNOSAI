import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const staffMe = vi.fn();
const staffRefresh = vi.fn();

vi.mock('@/lib/api', () => ({
  staffMe: (...args: unknown[]) => staffMe(...args),
  staffRefresh: (...args: unknown[]) => staffRefresh(...args),
}));

import {
  applyStaffLoginResponse,
  clearSession,
  getAccessToken,
  getRefreshToken,
  getStoredUser,
} from '@/lib/auth';
import {
  accessTokenExpired,
  ensureStaffAccessToken,
  noteBackgroundUnauthorized,
  resetStaffSessionRefreshForTests,
  staffTokenForBackground,
} from './staff-session';

function jwt(expSec: number): string {
  const payload = btoa(JSON.stringify({ exp: expSec })).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `hdr.${payload}.sig`;
}

const memory = new Map<string, string>();

function installBrowserStorage() {
  memory.clear();
  const fake: Storage = {
    get length() {
      return memory.size;
    },
    clear() {
      memory.clear();
    },
    getItem(key: string) {
      return memory.get(key) ?? null;
    },
    key(index: number) {
      return [...memory.keys()][index] ?? null;
    },
    removeItem(key: string) {
      memory.delete(key);
    },
    setItem(key: string, value: string) {
      memory.set(key, value);
    },
  };
  Object.defineProperty(globalThis, 'window', { configurable: true, value: globalThis });
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: fake });
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      get cookie() {
        return '';
      },
      set cookie(_v: string) {
        /* no-op for middleware cookie sync */
      },
    },
  });
}

const user = {
  id: 'u1',
  email: 'admin@pttads.vn',
  display_name: 'Admin',
  position_id: 1,
  caps: [{ section: 'crm_content', action: 'view' }],
};

describe('ensureStaffAccessToken', () => {
  beforeEach(() => {
    installBrowserStorage();
    resetStaffSessionRefreshForTests();
    clearSession();
    staffMe.mockReset();
    staffRefresh.mockReset();
  });

  afterEach(() => {
    clearSession();
    resetStaffSessionRefreshForTests();
  });

  it('persists rotated refresh token so a second concurrent refresh does not clear session', async () => {
    applyStaffLoginResponse({
      access_token: 'access-old',
      refresh_token: 'refresh-old',
      user,
    });
    staffMe.mockImplementation(async (token: string) => {
      if (token === 'access-old') throw new Error('expired');
      return user;
    });
    staffRefresh.mockImplementation(async (token: string) => {
      if (token !== 'refresh-old') throw new Error('stale refresh');
      return {
        access_token: 'access-new',
        refresh_token: 'refresh-new',
        token_type: 'Bearer',
        expires_in: 3600,
        refresh_expires_in: 86400,
        user,
      };
    });

    const [a, b] = await Promise.all([ensureStaffAccessToken(), ensureStaffAccessToken()]);
    expect(a.token).toBe('access-new');
    expect(b.token).toBe('access-new');
    expect(a.cleared).toBe(false);
    expect(b.cleared).toBe(false);
    expect(getAccessToken()).toBe('access-new');
    expect(getRefreshToken()).toBe('refresh-new');
    expect(getStoredUser()?.email).toBe('admin@pttads.vn');
    expect(staffRefresh).toHaveBeenCalledTimes(1);
  });

  it('refreshes an expired access token before background polls and stops after a 401', async () => {
    const expired = jwt(Math.floor(Date.now() / 1000) - 60);
    const fresh = jwt(Math.floor(Date.now() / 1000) + 3600);
    applyStaffLoginResponse({ access_token: expired, refresh_token: 'refresh-old', user });
    staffRefresh.mockResolvedValue({
      access_token: fresh,
      refresh_token: 'refresh-new',
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_expires_in: 86400,
      user,
    });
    expect(accessTokenExpired(expired)).toBe(true);
    expect(accessTokenExpired(fresh)).toBe(false);
    await expect(staffTokenForBackground()).resolves.toBe(fresh);
    expect(staffMe).not.toHaveBeenCalled();
    noteBackgroundUnauthorized(fresh);
    await expect(staffTokenForBackground()).resolves.toBeNull();
  });
});

describe('applyStaffLoginResponse', () => {
  beforeEach(() => {
    installBrowserStorage();
    clearSession();
  });
  afterEach(() => clearSession());

  it('stores access and refresh together', () => {
    applyStaffLoginResponse({
      access_token: 'a1',
      refresh_token: 'r1',
      user,
    });
    expect(getAccessToken()).toBe('a1');
    expect(getRefreshToken()).toBe('r1');
  });
});
