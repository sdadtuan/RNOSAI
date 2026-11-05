const NOTIFIED_KEY = 'csd.chat.notified.v1';
const VIEWING_KEY = 'csd.chat.viewing.v1';

export const CSD_CHAT_OPEN_EVENT = 'csd-chat:open';

function store(): Storage | null {
  try {
    if (typeof sessionStorage === 'undefined') return null;
    return sessionStorage;
  } catch {
    return null;
  }
}

export function readCsdChatNotified(): Set<string> | null {
  const raw = store()?.getItem(NOTIFIED_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    return new Set(parsed.filter((x): x is string => typeof x === 'string'));
  } catch {
    return null;
  }
}

export function writeCsdChatNotified(keys: Set<string>): void {
  try {
    store()?.setItem(NOTIFIED_KEY, JSON.stringify([...keys]));
  } catch {
    /* ignore quota / private mode */
  }
}

export function readCsdChatViewing(): string | null {
  const raw = store()?.getItem(VIEWING_KEY);
  return raw && raw.trim() ? raw : null;
}

export function writeCsdChatViewing(id: string | null): void {
  const s = store();
  if (!s) return;
  try {
    if (id) s.setItem(VIEWING_KEY, id);
    else s.removeItem(VIEWING_KEY);
  } catch {
    /* ignore */
  }
}

export function dispatchCsdChatOpen(conversationId: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(CSD_CHAT_OPEN_EVENT, { detail: { conversationId } }));
}

export function notificationPermission(): NotificationPermission | 'unsupported' {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission;
}

export async function requestCsdChatNotifyPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof Notification === 'undefined') return 'unsupported';
  if (Notification.permission !== 'default') return Notification.permission;
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

export function csdChatMessageNotifyTag(conversationId: string, lastMessageAt?: string | null): string {
  const stamp = (lastMessageAt ?? '').trim() || String(Date.now());
  return `csd-chat:${conversationId}:${stamp}`;
}

export function csdChatCallNotifyTag(fromUserId: string): string {
  return `csd-call:${fromUserId || 'unknown'}`;
}

function csdChatNotifyTargetUrl(kind: 'message' | 'call', conversationId: string): string {
  if (kind === 'call') return '/crm/csd/chat';
  return `/crm/csd/chat?c=${encodeURIComponent(conversationId)}`;
}

/**
 * Shows an OS / PWA notification. Returns false when nothing was shown so callers
 * can keep an in-app toast fallback (sound-only is not enough).
 */
export async function showCsdChatDesktopNotify(input: {
  title: string;
  preview: string;
  conversationId: string;
  onOpen: (conversationId: string) => void;
  kind?: 'message' | 'call';
  requireInteraction?: boolean;
  lastMessageAt?: string | null;
}): Promise<boolean> {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return false;
  const kind = input.kind ?? 'message';
  const tag =
    kind === 'call'
      ? csdChatCallNotifyTag(input.conversationId)
      : csdChatMessageNotifyTag(input.conversationId, input.lastMessageAt);
  const targetUrl = csdChatNotifyTargetUrl(kind, input.conversationId);
  const baseOptions: NotificationOptions = {
    body: input.preview,
    tag,
    data: { url: targetUrl },
    requireInteraction: input.requireInteraction ?? kind === 'call',
  };

  // Prefer Service Worker when registered — more reliable while the CRM tab is backgrounded (PWA).
  try {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg?.showNotification) {
        await reg.showNotification(input.title, {
          ...baseOptions,
          renotify: true,
        } as NotificationOptions);
        return true;
      }
    }
  } catch {
    /* fall through to Notification constructor */
  }

  const bindClick = (note: Notification) => {
    note.onclick = () => {
      window.focus();
      input.onOpen(input.conversationId);
      note.close();
    };
  };

  try {
    const note = new Notification(input.title, {
      ...baseOptions,
      renotify: true,
    } as NotificationOptions);
    bindClick(note);
    return true;
  } catch {
    try {
      // Some browsers reject non-standard options (e.g. renotify).
      const note = new Notification(input.title, baseOptions);
      bindClick(note);
      return true;
    } catch {
      return false;
    }
  }
}

/** Best-effort close of an earlier notification by tag (Chrome supports this). */
export function closeCsdChatDesktopNotifyByTag(tag: string): void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  void navigator.serviceWorker?.getRegistrations?.().then((regs) => {
    for (const reg of regs) {
      void reg.getNotifications?.({ tag }).then((notes) => {
        for (const n of notes) n.close();
      });
    }
  });
}
