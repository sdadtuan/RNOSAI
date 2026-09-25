'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { PageToolbar, StaffPageShell } from '@/components/layout';
import { CsdChatLoginForm } from '@/components/crm/csd/CsdChatLoginForm';
import { CsdChatOnlyLoginForm } from '@/components/crm/csd/CsdChatOnlyLoginForm';
import { CsdChatWorkspace } from '@/components/crm/csd/CsdChatWorkspace';
import { useCsdPageAuth } from '@/components/crm/csd/useCsdPageAuth';
import { clearSession, getStoredUser, hasCap, updateAccessToken, updateStoredUser, type StoredStaffUser } from '@/lib/auth';
import { fetchCsdChatMe, fetchCsdChatUnreadCount, loginCsdChat, openCsdChatSession } from '@/lib/crm/csd-api';
import {
  clearPttChatAccess,
  readPttChatAccess,
  registerPttChatPush,
  syncPttChatBadge,
  writePttChatAccess,
} from '@/lib/crm/csd-chat-native-push';
import { readRnosDesktop } from '@/lib/crm/csd-chat-desktop-bridge';
import { readCsdChatLogin, writeCsdChatLogin } from '@/lib/crm/csd-chat-login-persist';
import { readCsdChatShell, type CsdChatShell } from '@/lib/crm/csd-chat-shell';

function CsdChatNativePage() {
  const searchParams = useSearchParams();
  const initialConversationId = searchParams.get('c');
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [token, setToken] = useState('');
  const [ready, setReady] = useState(false);
  const [chatEnabled, setChatEnabled] = useState<boolean | null>(null);
  const [loginError, setLoginError] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);

  useEffect(() => {
    const saved = readPttChatAccess();
    if (!saved) {
      setReady(true);
      return;
    }
    updateAccessToken(saved);
    setUser(getStoredUser());
    setToken(saved);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    void fetchCsdChatMe(token)
      .then((me) => {
        if (cancelled) return;
        setChatEnabled(me.enabled === true);
        setUser((prev) =>
          prev ?? {
            id: String(me.staff_id),
            email: '',
            display_name: me.display_name_vi || me.username || 'PTT',
            position_id: 0,
            caps: [],
          },
        );
      })
      .catch(() => {
        if (cancelled) return;
        clearPttChatAccess();
        clearSession();
        setToken('');
        setUser(null);
        setChatEnabled(null);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!token || chatEnabled !== true) return;
    void registerPttChatPush(token);
    void syncPttChatBadge(token);
    const timer = window.setInterval(() => {
      void syncPttChatBadge(token);
    }, 8_000);
    return () => window.clearInterval(timer);
  }, [token, chatEnabled]);

  function logout() {
    clearPttChatAccess();
    clearSession();
    setToken('');
    setUser(null);
    setChatEnabled(null);
    setLoginError('');
  }

  const canWrite = hasCap(user, 'csd', 'write');
  const canPlatformManage = Boolean(user && (hasCap(user, 'csd', 'admin') || hasCap(user, 'csd', 'manage')));

  return (
    <StaffPageShell user={user} onLogout={logout} chrome="chat" width="full" loading={!ready}>
      <div className={['csd-chat-page', 'is-shell', token && chatEnabled ? 'is-authed' : ''].filter(Boolean).join(' ')}>
        {chatEnabled === false ? (
          <div className="page-card" data-testid="csd-chat-disabled">
            <p>Tài khoản chat chưa được Admin cấp — liên hệ quản trị.</p>
          </div>
        ) : null}
        {ready && !token ? (
          <CsdChatOnlyLoginForm
            busy={loginBusy}
            error={loginError}
            onSubmit={async (input) => {
              setLoginBusy(true);
              setLoginError('');
              try {
                const out = await openCsdChatSession(input);
                const nextUser: StoredStaffUser = {
                  id: String(out.staff_id),
                  email: out.email,
                  display_name: out.display_name,
                  position_id: out.position_id,
                  caps: out.caps,
                };
                writePttChatAccess(out.access_token);
                updateStoredUser(nextUser);
                updateAccessToken(out.access_token);
                setUser(nextUser);
                setToken(out.access_token);
                setChatEnabled(true);
              } catch (err) {
                setLoginError(
                  err instanceof Error && err.message === 'invalid_chat_credentials'
                    ? 'Sai tên đăng nhập hoặc mật khẩu chat'
                    : 'Không đăng nhập được',
                );
              } finally {
                setLoginBusy(false);
              }
            }}
          />
        ) : null}
        {token && chatEnabled ? (
          <CsdChatWorkspace
            token={token}
            canWrite={canWrite}
            canPlatformManage={canPlatformManage}
            initialConversationId={initialConversationId}
          />
        ) : null}
      </div>
    </StaffPageShell>
  );
}

function CsdChatPageInner() {
  const searchParams = useSearchParams();
  const initialConversationId = searchParams.get('c');
  const { user, token, error, logout, canWrite } = useCsdPageAuth('view');
  const canPlatformManage = Boolean(
    user && (hasCap(user, 'csd', 'admin') || hasCap(user, 'csd', 'manage')),
  );
  const [chatEnabled, setChatEnabled] = useState<boolean | null>(null);
  const [meUsername, setMeUsername] = useState('');
  const [chatAuthed, setChatAuthed] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);
  const [shell, setShell] = useState<CsdChatShell>('crm');

  useEffect(() => {
    setShell(readCsdChatShell());
  }, []);

  useEffect(() => {
    if (shell !== 'desktop' || !token) return;
    let cancelled = false;
    const publish = () => {
      void fetchCsdChatUnreadCount(token)
        .then((out) => {
          if (!cancelled) readRnosDesktop()?.setUnread(out.count);
        })
        .catch(() => undefined);
    };
    publish();
    const timer = window.setInterval(publish, 8_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [shell, token]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    void fetchCsdChatMe(token)
      .then((me) => {
        if (cancelled) return;
        setChatEnabled(me.enabled === true);
        setMeUsername(me.username ?? '');
        setChatAuthed(Boolean(me.enabled && readCsdChatLogin(me.staff_id)));
      })
      .catch(() => {
        if (!cancelled) setChatEnabled(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const chatChrome = shell === 'crm' ? 'crm' : 'chat';

  if (!user) {
    return (
      <StaffPageShell user={null} onLogout={logout} loading chrome={chatChrome}>
        <span />
      </StaffPageShell>
    );
  }

  const disabled = chatEnabled === false;

  return (
    <StaffPageShell
      user={user}
      onLogout={logout}
      chrome={chatChrome}
      breadcrumb={
        chatChrome === 'chat' || chatAuthed
          ? undefined
          : [
              { label: 'CRM', href: '/crm/leads' },
              { label: 'Service Desk', href: '/crm/csd' },
              { label: 'Chat' },
            ]
      }
      width="full"
    >
      <div
        className={[
          'csd-chat-page',
          token && chatEnabled && chatAuthed ? 'is-authed' : '',
          chatChrome === 'chat' ? 'is-shell' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {chatChrome === 'chat' ? null : (
          <PageToolbar title="Chat native" subtitle={chatAuthed ? undefined : 'Hộp thoại — DM, nhóm, khách, dự án'} />
        )}
        {shell === 'pwa' ? (
          <p className="muted" data-testid="csd-chat-pwa-sleep-note">
            Khi điện thoại ngủ, tin mới có thể đến chậm đến lúc mở lại Chat SD. Không có đẩy tin nền.
          </p>
        ) : null}
        {error ? (
          <div className="page-card">
            <p className="error">{error}</p>
          </div>
        ) : null}
        {disabled ? (
          <div className="page-card" data-testid="csd-chat-disabled">
            <p>Tài khoản chat chưa được Admin cấp — liên hệ quản trị.</p>
          </div>
        ) : null}
        {token && chatEnabled && !chatAuthed ? (
          <CsdChatLoginForm
            key={meUsername}
            defaultUsername={meUsername}
            busy={loginBusy}
            error={loginError}
            onSubmit={async (input) => {
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
            }}
          />
        ) : null}
        {token && chatEnabled && chatAuthed ? (
          <CsdChatWorkspace
            token={token}
            canWrite={canWrite}
            canPlatformManage={canPlatformManage}
            initialConversationId={initialConversationId}
          />
        ) : null}
      </div>
    </StaffPageShell>
  );
}

function CsdChatRoute() {
  const [shell, setShell] = useState<CsdChatShell | null>(null);
  useEffect(() => {
    setShell(readCsdChatShell());
  }, []);
  if (shell === null) {
    return (
      <StaffPageShell user={null} onLogout={() => {}} loading chrome="chat">
        <span />
      </StaffPageShell>
    );
  }
  if (shell === 'native') return <CsdChatNativePage />;
  return <CsdChatPageInner />;
}

export default function CsdChatPage() {
  return (
    <Suspense fallback={<StaffPageShell user={null} onLogout={() => {}} loading chrome="chat"><span /></StaffPageShell>}>
      <CsdChatRoute />
    </Suspense>
  );
}
