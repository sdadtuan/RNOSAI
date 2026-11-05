import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CSD_DOCK_STORAGE_KEY,
  readCsdDockPersist,
  writeCsdDockPersist,
} from './csd-chat-dock-persist';

const memory = new Map<string, string>();

function installSessionStorage() {
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
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: fake });
}

describe('csd-chat-notify-persist', () => {
  beforeEach(() => {
    memory.clear();
    installSessionStorage();
  });

  it('roundtrips notified keys', async () => {
    const { readCsdChatNotified, writeCsdChatNotified } = await import('./csd-chat-notify-persist');
    expect(readCsdChatNotified()).toBeNull();
    writeCsdChatNotified(new Set(['c1:a']));
    expect([...readCsdChatNotified() ?? []]).toEqual(['c1:a']);
  });

  it('showCsdChatDesktopNotify returns false without permission', async () => {
    const { showCsdChatDesktopNotify } = await import('./csd-chat-notify-persist');
    const prev = globalThis.Notification;
    Object.defineProperty(globalThis, 'Notification', {
      configurable: true,
      value: { permission: 'denied' },
    });
    try {
      await expect(
        showCsdChatDesktopNotify({
          title: 'An',
          preview: 'Hi',
          conversationId: 'c1',
          onOpen: () => undefined,
        }),
      ).resolves.toBe(false);
    } finally {
      Object.defineProperty(globalThis, 'Notification', { configurable: true, value: prev });
    }
  });

  it('showCsdChatDesktopNotify uses service worker when registered', async () => {
    const { showCsdChatDesktopNotify } = await import('./csd-chat-notify-persist');
    const showNotification = vi.fn(async () => undefined);
    const prevNotification = globalThis.Notification;
    const prevNavigator = globalThis.navigator;
    Object.defineProperty(globalThis, 'Notification', {
      configurable: true,
      value: { permission: 'granted' },
    });
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: {
        serviceWorker: {
          getRegistration: async () => ({ showNotification }),
        },
      },
    });
    try {
      await expect(
        showCsdChatDesktopNotify({
          title: 'An',
          preview: 'Hi',
          conversationId: 'c1',
          lastMessageAt: 't1',
          onOpen: () => undefined,
        }),
      ).resolves.toBe(true);
      expect(showNotification).toHaveBeenCalledWith(
        'An',
        expect.objectContaining({
          body: 'Hi',
          tag: 'csd-chat:c1:t1',
          data: { url: '/crm/csd/chat?c=c1' },
        }),
      );
    } finally {
      Object.defineProperty(globalThis, 'Notification', { configurable: true, value: prevNotification });
      Object.defineProperty(globalThis, 'navigator', { configurable: true, value: prevNavigator });
    }
  });
});

describe('csd-chat-dock-persist', () => {
  beforeEach(() => {
    memory.clear();
    installSessionStorage();
  });

  it('returns default on bad json', () => {
    sessionStorage.setItem(CSD_DOCK_STORAGE_KEY, '{');
    expect(readCsdDockPersist().open).toBe(false);
    expect(readCsdDockPersist().pane).toBe('list');
  });

  it('roundtrips', () => {
    writeCsdDockPersist({ open: true, tab: 'messages', pane: 'thread', conversationId: 'c1' });
    expect(readCsdDockPersist().conversationId).toBe('c1');
    expect(readCsdDockPersist().open).toBe(true);
    expect(readCsdDockPersist().pane).toBe('thread');
  });
});
