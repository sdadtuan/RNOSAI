import { beforeEach, describe, expect, it } from 'vitest';
import {
  CSD_CHAT_LOGIN_STORAGE_KEY,
  clearCsdChatLogin,
  readCsdChatLogin,
  writeCsdChatLogin,
} from './csd-chat-login-persist';

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

describe('csd-chat-login-persist', () => {
  beforeEach(() => {
    memory.clear();
    installSessionStorage();
  });

  it('returns null when staff id does not match', () => {
    writeCsdChatLogin({ staff_id: 3, username: 'am.chat' });
    expect(readCsdChatLogin(8)).toBeNull();
    expect(readCsdChatLogin(3)?.username).toBe('am.chat');
  });

  it('clears session', () => {
    writeCsdChatLogin({ staff_id: 3, username: 'am.chat' });
    clearCsdChatLogin();
    expect(sessionStorage.getItem(CSD_CHAT_LOGIN_STORAGE_KEY)).toBeNull();
    expect(readCsdChatLogin(3)).toBeNull();
  });
});
