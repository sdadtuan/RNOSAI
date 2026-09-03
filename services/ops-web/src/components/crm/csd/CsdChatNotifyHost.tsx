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
import { avatarHue, initialsFromName } from '@/lib/crm/csd-chat-display';

const POLL_MS = 15_000;

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

    const load = () => {
      if (cancelled) return;
      void fetchCsdConversations(token, { filter: 'unread' })
        .then((out) => {
          if (cancelled) return;
          const viewingId = readCsdChatViewing();
          const next = nextCsdChatIncoming({
            previousNotified: notifiedRef.current,
            items: out.items ?? [],
            viewingId,
          });
          notifiedRef.current = next.notified;
          writeCsdChatNotified(next.notified);
          if (!next.incoming.length) return;
          const channel = csdChatNotifyChannel(
            typeof document !== 'undefined' ? document.visibilityState : 'visible',
            notificationPermission(),
          );
          if (channel === 'toast') {
            setToasts((prev) => {
              const seen = new Set(prev.map((t) => t.conversationId));
              return [...next.incoming.filter((row) => !seen.has(row.conversationId)), ...prev].slice(0, 3);
            });
          } else if (channel === 'desktop') {
            for (const row of next.incoming) {
              showCsdChatDesktopNotify({
                title: row.title,
                preview: row.preview,
                conversationId: row.conversationId,
                onOpen: openConversation,
              });
            }
          }
        })
        .catch(() => undefined);
    };

    load();
    const timer = window.setInterval(load, POLL_MS);
    const onVis = () => {
      if (document.visibilityState === 'visible') load();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
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
          <span className="csd-chat-notify__avatar" style={{ background: `hsl(${avatarHue(row.conversationId)} 42% 46%)` }}>
            {initialsFromName(row.title)}
          </span>
          <span className="csd-chat-notify__copy">
            <strong>{row.title}</strong>
            <span>{row.preview}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
