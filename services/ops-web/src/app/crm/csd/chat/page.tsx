'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { PageToolbar, StaffPageShell } from '@/components/layout';
import { CsdChatLoginForm } from '@/components/crm/csd/CsdChatLoginForm';
import { CsdChatWorkspace } from '@/components/crm/csd/CsdChatWorkspace';
import { useCsdPageAuth } from '@/components/crm/csd/useCsdPageAuth';
import { fetchCsdChatMe, loginCsdChat } from '@/lib/crm/csd-api';
import { readCsdChatLogin, writeCsdChatLogin } from '@/lib/crm/csd-chat-login-persist';

function CsdChatPageInner() {
  const searchParams = useSearchParams();
  const initialConversationId = searchParams.get('c');
  const { user, token, error, logout, canWrite } = useCsdPageAuth('view');
  const [chatEnabled, setChatEnabled] = useState<boolean | null>(null);
  const [meUsername, setMeUsername] = useState('');
  const [chatAuthed, setChatAuthed] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);

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

  if (!user) {
    return (
      <StaffPageShell user={null} onLogout={logout} loading>
        <span />
      </StaffPageShell>
    );
  }

  const disabled = chatEnabled === false;

  return (
    <StaffPageShell
      user={user}
      onLogout={logout}
      breadcrumb={
        chatAuthed
          ? undefined
          : [
              { label: 'CRM', href: '/crm/leads' },
              { label: 'Service Desk', href: '/crm/csd' },
              { label: 'Chat' },
            ]
      }
      width="full"
    >
      <div className={token && chatEnabled && chatAuthed ? 'csd-chat-page is-authed' : 'csd-chat-page'}>
        <PageToolbar title="Chat native" subtitle={chatAuthed ? undefined : 'Hộp thoại — DM, nhóm, khách, dự án'} />
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
          <CsdChatWorkspace token={token} canWrite={canWrite} initialConversationId={initialConversationId} />
        ) : null}
      </div>
    </StaffPageShell>
  );
}

export default function CsdChatPage() {
  return (
    <Suspense fallback={<StaffPageShell user={null} onLogout={() => {}} loading><span /></StaffPageShell>}>
      <CsdChatPageInner />
    </Suspense>
  );
}
