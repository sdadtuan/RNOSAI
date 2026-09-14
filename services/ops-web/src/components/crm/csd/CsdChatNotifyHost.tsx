'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { getAccessToken, hasCap, type StoredStaffUser } from '@/lib/auth';
import { fetchCsdChatMe, fetchCsdConversations } from '@/lib/crm/csd-api';
import {
  csdChatNotifyChannel,
  nextCsdChatIncoming,
  type CsdChatIncoming,
} from '@/lib/crm/csd-chat-notify';
import {
  dispatchCsdChatOpen,
  notificationPermission,
  readCsdChatNotified,
  readCsdChatViewing,
  showCsdChatDesktopNotify,
  writeCsdChatNotified,
} from '@/lib/crm/csd-chat-notify-persist';
import { playCsdChatMessageTone } from '@/lib/crm/csd-chat-notify-sound.util';
import { CsdChatAvatar } from '@/components/crm/csd/CsdChatAvatar';

const POLL_MS = 8_000;
const POLL_MS_HIDDEN = 5_000;

type CsdChatNotifyHostProps = {
  user: StoredStaffUser | null;
};

export function CsdChatNotifyHost({ user }: CsdChatNotifyHostProps) {
  const pathname = usePathname();
  const router = useRouter();
  const token = getAccessToken() ?? '';
  const canView = hasCap(user, 'csd', 'view');
  const [enabled, setEnabled] = useState(false);
  const [toasts, setToasts] = useState<CsdChatIncoming[]>([]);
  const notifiedRef = useRef<Set<string> | null>(readCsdChatNotified());

  const openConversation = useCallback(
    (conversationId: string) => {
      setToasts((prev) => prev.filter((t) => t.conversationId !== conversationId));
      if (pathname === '/crm/csd/chat') {
        router.push(`/crm/csd/chat?c=${conversationId}`);
        return;
      }
      dispatchCsdChatOpen(conversationId);
    },
    [pathname, router],
  );

  useEffect(() => {
    if (!user || !canView || !token) {
      setEnabled(false);
      return;
    }
    let cancelled = false;
    void fetchCsdChatMe(token)
      .then((me) => {
        if (!cancelled) setEnabled(me.enabled === true);
      })
      .catch(() => {
        if (!cancelled) setEnabled(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, canView, token]);

  useEffect(() => {
    if (!enabled || !token) return;
    let cancelled = false;
    let timer: number | null = null;

    const schedule = () => {
      if (timer != null) window.clearInterval(timer);
      const ms =
        typeof document !== 'undefined' && document.visibilityState === 'hidden'
          ? POLL_MS_HIDDEN
          : POLL_MS;
      timer = window.setInterval(load, ms);
    };

    const load = () => {
      if (cancelled) return;
      void fetchCsdConversations(token, { filter: 'unread' })
        .then((out) => {
          if (cancelled) return;
          const tabHidden =
            typeof document !== 'undefined' && document.visibilityState === 'hidden';
          const viewingId = readCsdChatViewing();
          const next = nextCsdChatIncoming({
            previousNotified: notifiedRef.current,
            items: out.items ?? [],
            viewingId,
            tabHidden,
          });
          if (!next.incoming.length) {
            notifiedRef.current = next.notified;
            writeCsdChatNotified(next.notified);
            return;
          }
          const channel = csdChatNotifyChannel(
            tabHidden ? 'hidden' : 'visible',
            notificationPermission(),
          );
          // Do not mark delivered when we cannot show/play — retry next poll.
          if (channel === 'none') return;

          playCsdChatMessageTone();
          if (channel === 'toast') {
            setToasts((prev) => {
              const incomingIds = new Set(next.incoming.map((row) => row.conversationId));
              const rest = prev.filter((t) => !incomingIds.has(t.conversationId));
              return [...next.incoming, ...rest].slice(0, 3);
            });
          } else if (channel === 'desktop') {
            for (const row of next.incoming) {
              showCsdChatDesktopNotify({
                title: row.title,
                preview: row.preview,
                conversationId: row.conversationId,
                lastMessageAt: row.lastMessageAt,
                kind: 'message',
                onOpen: openConversation,
              });
            }
          }
          notifiedRef.current = next.notified;
          writeCsdChatNotified(next.notified);
        })
        .catch(() => undefined);
    };

    load();
    schedule();
    const onVis = () => {
      if (document.visibilityState === 'visible') load();
      schedule();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelled = true;
      if (timer != null) window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [enabled, token, openConversation]);

  useEffect(() => {
    if (toasts.length === 0) return;
    const timer = window.setTimeout(() => {
      setToasts((prev) => prev.slice(0, -1));
    }, 6000);
    return () => window.clearTimeout(timer);
  }, [toasts]);

  if (toasts.length === 0) return null;

  return (
    <div className="csd-chat-notify" data-testid="csd-chat-notify" aria-live="polite">
      {toasts.map((row) => (
        <button
          key={`${row.conversationId}:${row.lastMessageAt ?? ''}`}
          type="button"
          className="csd-chat-notify__toast"
          data-testid="csd-chat-notify-toast"
          onClick={() => openConversation(row.conversationId)}
        >
          <CsdChatAvatar
            token={token}
            name={row.title}
            seed={row.avatarStaffId ?? row.conversationId}
            staffId={row.avatarStaffId ?? null}
            hasAvatar={row.avatarHasPhoto}
            avatarUpdatedAt={row.avatarUpdatedAt}
            className="csd-chat-notify__avatar csd-chat-avatar"
          />
          <span className="csd-chat-notify__copy">
            <strong>{row.title}</strong>
            <span>{row.preview}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
