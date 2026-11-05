export type CsdChatLoginPersist = {
  staff_id: number;
  username: string;
};

export const CSD_CHAT_LOGIN_STORAGE_KEY = 'csd.chat.login.v1';

function storage(): Storage | null {
  try {
    if (typeof sessionStorage === 'undefined') return null;
    return sessionStorage;
  } catch {
    return null;
  }
}

export function readCsdChatLogin(staffId: number): CsdChatLoginPersist | null {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(CSD_CHAT_LOGIN_STORAGE_KEY);
    if (!raw) return null;
    const row = JSON.parse(raw) as Partial<CsdChatLoginPersist>;
    const id = Number(row.staff_id);
    const username = typeof row.username === 'string' ? row.username.trim() : '';
    if (!Number.isInteger(id) || id <= 0 || id !== staffId || !username) return null;
    return { staff_id: id, username };
  } catch {
    return null;
  }
}

export function writeCsdChatLogin(next: CsdChatLoginPersist): void {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(CSD_CHAT_LOGIN_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore quota / private mode */
  }
}

export function clearCsdChatLogin(): void {
  const store = storage();
  if (!store) return;
  try {
    store.removeItem(CSD_CHAT_LOGIN_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
