import { fetchCsdChatUnreadCount, registerCsdChatDevice } from '@/lib/crm/csd-api';

const CHAT_TOKEN_KEY = 'ptt.chat.access';

export function readPttChatAccess(): string {
  if (typeof window === 'undefined') return '';
  return sessionStorage.getItem(CHAT_TOKEN_KEY) ?? '';
}

export function writePttChatAccess(token: string): void {
  sessionStorage.setItem(CHAT_TOKEN_KEY, token);
}

export function clearPttChatAccess(): void {
  sessionStorage.removeItem(CHAT_TOKEN_KEY);
}

export async function registerPttChatPush(accessToken: string): Promise<void> {
  if (!accessToken || typeof window === 'undefined') return;
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (!Capacitor.isNativePlatform()) return;
    const { PushNotifications } = await import('@capacitor/push-notifications');
    const perm = await PushNotifications.requestPermissions();
    if (perm.receive !== 'granted') return;
    await PushNotifications.addListener('registration', (event) => {
      const platform = Capacitor.getPlatform() === 'ios' ? 'ios' : 'android';
      void registerCsdChatDevice(accessToken, { platform, token: event.value }).catch(() => undefined);
    });
    await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      const conversationId = action.notification.data?.conversation_id;
      if (!conversationId) return;
      const next = new URL('/crm/csd/chat', window.location.origin);
      next.searchParams.set('shell', 'native');
      next.searchParams.set('c', String(conversationId));
      window.location.assign(next.toString());
    });
    await PushNotifications.register();
  } catch {
    // The phone build is the only place the native bridge exists.
  }
}

export async function syncPttChatBadge(accessToken: string): Promise<void> {
  if (!accessToken) return;
  try {
    const { count } = await fetchCsdChatUnreadCount(accessToken);
    const { Capacitor } = await import('@capacitor/core');
    if (!Capacitor.isNativePlatform()) return;
    const { Badge } = await import('@capawesome/capacitor-badge');
    if (count > 0) await Badge.set({ count });
    else await Badge.clear();
  } catch {
    // Badge is optional until the store build includes the plugin.
  }
}
