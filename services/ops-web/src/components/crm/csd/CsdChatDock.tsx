'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { CsdChatLoginForm } from '@/components/crm/csd/CsdChatLoginForm';
import { CsdChatWorkspace } from '@/components/crm/csd/CsdChatWorkspace';
import { getAccessToken, hasCap, type StoredStaffUser } from '@/lib/auth';
import { fetchCsdChatMe, fetchCsdChatUnreadCount, loginCsdChat } from '@/lib/crm/csd-api';
import { readCsdDockPersist, writeCsdDockPersist } from '@/lib/crm/csd-chat-dock-persist';
import { readCsdChatLogin, writeCsdChatLogin } from '@/lib/crm/csd-chat-login-persist';
import { CSD_CHAT_OPEN_EVENT, requestCsdChatNotifyPermission } from '@/lib/crm/csd-chat-notify-persist';

export function CsdChatDock({ user }: { user: StoredStaffUser | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const token = getAccessToken() ?? '';
  const canWrite = hasCap(user, 'csd', 'write');
  const canView = hasCap(user, 'csd', 'view');
  const [meEnabled, setMeEnabled] = useState<boolean | null>(null);
  const [meUsername, setMeUsername] = useState('');
  const [chatAuthed, setChatAuthed] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);
  const hidden = !user || !canView || pathname === '/crm/csd/chat' || !token || meEnabled !== true;

  const initial = readCsdDockPersist();
  const [open, setOpen] = useState(false);
  const [focusId, setFocusId] = useState<string | null>(initial.conversationId);
  const [unread, setUnread] = useState(0);

  const persist = useCallback((next: { open?: boolean; conversationId?: string | null }) => {
    const current = readCsdDockPersist();
    writeCsdDockPersist({
      open: next.open ?? current.open,
      tab: current.tab,
      pane: current.pane,
      conversationId: next.conversationId !== undefined ? next.conversationId : current.conversationId,
    });
  }, []);

  useEffect(() => {
    if (!user || !canView || !token || pathname === '/crm/csd/chat') {
      setMeEnabled(false);
      return;
    }
    let cancelled = false;
    void fetchCsdChatMe(token)
      .then((me) => {
        if (cancelled) return;
        setMeEnabled(me.enabled === true);
        setMeUsername(me.username ?? '');
        setChatAuthed(Boolean(me.enabled && readCsdChatLogin(me.staff_id)));
      })
      .catch(() => {
        if (!cancelled) setMeEnabled(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, canView, token, pathname]);

  useEffect(() => {
    if (hidden || !token) return;
    let cancelled = false;
    const load = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      void fetchCsdChatUnreadCount(token)
        .then((out) => {
          if (!cancelled) setUnread(Number(out.count ?? 0));
        })
        .catch(() => {
          /* keep last badge */
        });
    };
    load();
    const timer = window.setInterval(load, 15_000);
    const onVis = () => {
      if (document.visibilityState === 'visible') load();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [hidden, token]);

  useEffect(() => {
    if (hidden || !open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      setOpen(false);
      persist({ open: false });
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hidden, open, persist]);

  useEffect(() => {
    function onOpen(ev: Event) {
      const id = (ev as CustomEvent<{ conversationId?: string }>).detail?.conversationId;
      if (!id) return;
      setFocusId(id);
      setOpen(true);
      persist({ open: true, conversationId: id });
      writeCsdDockPersist({
        ...readCsdDockPersist(),
        open: true,
        tab: 'messages',
        pane: 'thread',
        conversationId: id,
      });
    }
    window.addEventListener(CSD_CHAT_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(CSD_CHAT_OPEN_EVENT, onOpen);
  }, [persist]);

  if (hidden) return null;

  async function handleChatLogin(input: { username: string; password: string }) {
    setLoginBusy(true);
    setLoginError('');
    try {
      const out = await loginCsdChat(token, input);
      writeCsdChatLogin({ staff_id: out.staff_id, username: out.username });
      setChatAuthed(true);
    } catch (err) {
      setLoginError(
        err instanceof Error && err.message === 'invalid_chat_credentials'
          ? 'Sai tên đăng nhập hoặc mật khẩu chat'
          : err instanceof Error
            ? err.message
            : 'Không đăng nhập được Chat',
      );
    } finally {
      setLoginBusy(false);
    }
  }

  function minimize() {
    setOpen(false);
    persist({ open: false, conversationId: readCsdDockPersist().conversationId });
  }

  function openDialog() {
    setOpen(true);
    persist({ open: true, conversationId: readCsdDockPersist().conversationId });
    void requestCsdChatNotifyPermission();
  }

  function openPage() {
    const id = readCsdDockPersist().conversationId;
    setOpen(false);
    persist({ open: false, conversationId: id });
    router.push(id ? `/crm/csd/chat?c=${id}` : '/crm/csd/chat');
  }

  return (
    <>
      {!open ? (
        <button
          type="button"
          className="csd-chat-launcher"
          data-testid="csd-chat-launcher"
          aria-label="Chat"
          aria-expanded={false}
          onClick={openDialog}
        >
          Chat
          {unread > 0 ? (
            <span className="csd-chat-launcher__badge" aria-label={`${unread} hội thoại chưa đọc`}>
              {unread > 99 ? '99+' : unread}
            </span>
          ) : null}
        </button>
      ) : (
        <div className="csd-chat-dock-backdrop" role="presentation" onClick={minimize}>
          <div
            className="csd-chat-dock csd-chat-dock--window"
            id="csd-chat-dock"
            role="dialog"
            aria-label="Chat Service Desk"
            data-testid="csd-chat-dock"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="csd-chat-dock__head">
              <strong>Chat</strong>
              <div className="csd-chat-dock__head-actions">
                <button type="button" className="btn btn-sm btn-secondary" onClick={openPage}>
                  Mở trang
                </button>
                <button type="button" className="btn btn-sm btn-secondary" aria-label="Thu nhỏ" onClick={minimize}>
                  —
                </button>
              </div>
            </header>
            <div className="csd-chat-dock__body">
              {!chatAuthed ? (
                <CsdChatLoginForm
                  key={meUsername}
                  compact
                  defaultUsername={meUsername}
                  busy={loginBusy}
                  error={loginError}
                  onSubmit={handleChatLogin}
                />
              ) : (
                <CsdChatWorkspace
                  token={token}
                  canWrite={canWrite}
                  initialConversationId={focusId}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
