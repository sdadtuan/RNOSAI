/** When to show the in-app “enable browser notifications” prompt. */

const DISMISS_KEY = 'csd.chat.notifyPermission.dismissedUntil.v1';
const DISMISS_MS = 7 * 24 * 60 * 60 * 1000;

export const CSD_CHAT_NEED_NOTIFY_PERMISSION_EVENT = 'csd-chat:need-notify-permission';

export type CsdNotifyPermissionPromptKind = 'ask' | 'blocked' | 'hidden';

export function csdNotifyPermissionPromptKind(
  permission: NotificationPermission | 'unsupported',
): CsdNotifyPermissionPromptKind {
  if (permission === 'unsupported' || permission === 'granted') return 'hidden';
  if (permission === 'denied') return 'blocked';
  return 'ask';
}

function localStore(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}

export function readCsdNotifyPermissionDismissedUntil(): number {
  const raw = localStore()?.getItem(DISMISS_KEY);
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

export function writeCsdNotifyPermissionDismissed(untilMs = Date.now() + DISMISS_MS): void {
  try {
    localStore()?.setItem(DISMISS_KEY, String(untilMs));
  } catch {
    /* ignore */
  }
}

export function clearCsdNotifyPermissionDismissed(): void {
  try {
    localStore()?.removeItem(DISMISS_KEY);
  } catch {
    /* ignore */
  }
}

export function shouldShowCsdNotifyPermissionPrompt(input: {
  permission: NotificationPermission | 'unsupported';
  nowMs?: number;
  force?: boolean;
}): boolean {
  const kind = csdNotifyPermissionPromptKind(input.permission);
  if (kind === 'hidden') return false;
  if (input.force) return true;
  const now = input.nowMs ?? Date.now();
  return now >= readCsdNotifyPermissionDismissedUntil();
}

export function dispatchCsdNeedNotifyPermission(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(CSD_CHAT_NEED_NOTIFY_PERMISSION_EVENT));
}
