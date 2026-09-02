export type CsdDockTab = 'messages' | 'contacts' | 'requests';
export type CsdDockPane = 'list' | 'thread';

export type CsdDockPersist = {
  open: boolean;
  tab: CsdDockTab;
  pane: CsdDockPane;
  conversationId: string | null;
};

export const CSD_DOCK_STORAGE_KEY = 'csd.chat.dock.v1';

export const CSD_DOCK_PERSIST_DEFAULT: CsdDockPersist = {
  open: false,
  tab: 'messages',
  pane: 'list',
  conversationId: null,
};

function storage(): Storage | null {
  try {
    if (typeof sessionStorage === 'undefined') return null;
    return sessionStorage;
  } catch {
    return null;
  }
}

function asPersist(raw: unknown): CsdDockPersist {
  if (!raw || typeof raw !== 'object') return { ...CSD_DOCK_PERSIST_DEFAULT };
  const row = raw as Partial<CsdDockPersist>;
  const tab = row.tab === 'contacts' || row.tab === 'requests' || row.tab === 'messages' ? row.tab : 'messages';
  const pane = row.pane === 'thread' || row.pane === 'list' ? row.pane : 'list';
  const conversationId = typeof row.conversationId === 'string' && row.conversationId ? row.conversationId : null;
  return {
    open: row.open === true,
    tab,
    pane,
    conversationId,
  };
}

export function readCsdDockPersist(): CsdDockPersist {
  const store = storage();
  if (!store) return { ...CSD_DOCK_PERSIST_DEFAULT };
  try {
    const raw = store.getItem(CSD_DOCK_STORAGE_KEY);
    if (!raw) return { ...CSD_DOCK_PERSIST_DEFAULT };
    return asPersist(JSON.parse(raw));
  } catch {
    return { ...CSD_DOCK_PERSIST_DEFAULT };
  }
}

export function writeCsdDockPersist(next: CsdDockPersist): void {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(CSD_DOCK_STORAGE_KEY, JSON.stringify(asPersist(next)));
  } catch {
    /* ignore quota / private mode */
  }
}
