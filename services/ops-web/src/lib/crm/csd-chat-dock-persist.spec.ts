import { beforeEach, describe, expect, it } from 'vitest';
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
