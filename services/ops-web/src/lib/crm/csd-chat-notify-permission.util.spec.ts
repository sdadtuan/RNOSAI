import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import {
  clearCsdNotifyPermissionDismissed,
  csdNotifyPermissionPromptKind,
  shouldShowCsdNotifyPermissionPrompt,
  writeCsdNotifyPermissionDismissed,
} from './csd-chat-notify-permission.util';

describe('csd-chat-notify-permission.util', () => {
  const mem = new Map<string, string>();

  beforeEach(() => {
    mem.clear();
    const fake: Storage = {
      get length() {
        return mem.size;
      },
      clear: () => mem.clear(),
      getItem: (k) => (mem.has(k) ? mem.get(k)! : null),
      setItem: (k, v) => {
        mem.set(k, String(v));
      },
      removeItem: (k) => {
        mem.delete(k);
      },
      key: (i) => [...mem.keys()][i] ?? null,
    };
    Object.defineProperty(globalThis, 'localStorage', { value: fake, configurable: true });
    clearCsdNotifyPermissionDismissed();
  });

  afterEach(() => {
    clearCsdNotifyPermissionDismissed();
  });

  it('maps permission to prompt kind', () => {
    expect(csdNotifyPermissionPromptKind('granted')).toBe('hidden');
    expect(csdNotifyPermissionPromptKind('unsupported')).toBe('hidden');
    expect(csdNotifyPermissionPromptKind('default')).toBe('ask');
    expect(csdNotifyPermissionPromptKind('denied')).toBe('blocked');
  });

  it('hides after dismiss until expiry unless forced', () => {
    const now = 1_700_000_000_000;
    writeCsdNotifyPermissionDismissed(now + 60_000);
    expect(
      shouldShowCsdNotifyPermissionPrompt({ permission: 'default', nowMs: now }),
    ).toBe(false);
    expect(
      shouldShowCsdNotifyPermissionPrompt({ permission: 'default', nowMs: now, force: true }),
    ).toBe(true);
    expect(
      shouldShowCsdNotifyPermissionPrompt({ permission: 'default', nowMs: now + 120_000 }),
    ).toBe(true);
  });
});
