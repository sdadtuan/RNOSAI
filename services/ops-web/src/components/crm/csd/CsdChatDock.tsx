'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { CsdChatAvatar } from '@/components/crm/csd/CsdChatAvatar';
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
  const [meStaffId, setMeStaffId] = useState<number | null>(null);
  const [meUsername, setMeUsername] = useState('');
  const [meDisplayName, setMeDisplayName] = useState('');
  const [chatAuthed, setChatAuthed] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);
  const hidden = !user || !canView || pathname === '/crm/csd/chat' || !token || meEnabled !== true;

  const initial = readCsdDockPersist();
  const [open, setOpen] = useState(false);
  const [sessionMounted, setSessionMounted] = useState(false);
  const [focusConversationId, setFocusConversationId] = useState<string | null>(initial.conversationId);
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
        setMeStaffId(me.staff_id);
        setMeUsername(me.username ?? '');
        setMeDisplayName(String(me.display_name_vi ?? '').trim());
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
    if (chatAuthed) setSessionMounted(true);
  }, [chatAuthed]);

  useEffect(() => {
    function onOpen(ev: Event) {
      const id = (ev as CustomEvent<{ conversationId?: string }>).detail?.conversationId;
      if (!id) return;
      setFocusConversationId(id);
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

  const headUserName =
    meDisplayName ||
    user?.display_name ||
    meUsername ||
    user?.email ||
    '';

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

  function renderDockWindow(showWorkspace: boolean) {
    return (
      <div
        className="csd-chat-dock csd-chat-dock--window"
        id="csd-chat-dock"
        role="dialog"
        aria-label="Chat Service Desk"
        data-testid="csd-chat-dock"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="csd-chat-dock__head">
          <div className="csd-chat-dock__head-brand">
            <span className="csd-chat-dock__logo" aria-hidden>
              <span className="csd-chat-tab-ico csd-chat-tab-ico--msg" />
            </span>
            <div className="csd-chat-dock__head-copy">
              <strong>Chat</strong>
              {headUserName ? (
                <span className="csd-chat-dock__user" data-testid="csd-chat-dock-user">
                  {headUserName}
                </span>
              ) : null}
            </div>
          </div>
          <div className="csd-chat-dock__head-actions">
            <button
              type="button"
              className="csd-chat-dock__icon-btn csd-chat-dock__icon-btn--open"
              aria-label="Mở trang"
              title="Mở trang"
              onClick={openPage}
            >
              <span className="csd-chat-dock-ico csd-chat-dock-ico--open" aria-hidden />
            </button>
            <button
              type="button"
              className="csd-chat-dock__icon-btn csd-chat-dock__icon-btn--minimize"
              aria-label="Thu nhỏ"
              title="Thu nhỏ"
              onClick={minimize}
            >
              <span className="csd-chat-dock-ico csd-chat-dock-ico--minimize" aria-hidden />
            </button>
            {headUserName ? (
              <CsdChatAvatar
                token={token}
                name={headUserName}
                seed={meStaffId ?? user?.id ?? headUserName}
                staffId={meStaffId ?? (user?.id ? Number(user.id) : null)}
                hasAvatar={user?.has_avatar}
                avatarUpdatedAt={user?.avatar_updated_at}
                className="csd-chat-avatar csd-chat-avatar--dock-head"
              />
            ) : null}
          </div>
        </header>
        <div className="csd-chat-dock__body">
          {showWorkspace ? (
            <CsdChatWorkspace
              token={token}
              canWrite={canWrite}
              dockPersist
              initialConversationId={focusConversationId}
              onConversationChange={setFocusConversationId}
            />
          ) : (
            <CsdChatLoginForm
              key={meUsername}
              compact
              defaultUsername={meUsername}
              busy={loginBusy}
              error={loginError}
              onSubmit={handleChatLogin}
            />
          )}
        </div>
      </div>
    );
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
      ) : null}

      {open && !chatAuthed ? (
        <div className="csd-chat-dock-backdrop is-open" role="presentation" onClick={minimize}>
          {renderDockWindow(false)}
        </div>
      ) : null}

      {sessionMounted ? (
        <div
          className={`csd-chat-dock-backdrop${open ? ' is-open' : ''}`}
          role="presentation"
          aria-hidden={!open}
          onClick={open ? minimize : undefined}
        >
          {renderDockWindow(true)}
        </div>
      ) : null}
    </>
  );
}
