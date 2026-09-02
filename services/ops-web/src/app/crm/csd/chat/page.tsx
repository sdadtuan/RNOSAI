'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { PageToolbar, StaffPageShell } from '@/components/layout';
import { CsdChatWorkspace } from '@/components/crm/csd/CsdChatWorkspace';
import { useCsdPageAuth } from '@/components/crm/csd/useCsdPageAuth';
import { fetchCsdChatMe } from '@/lib/crm/csd-api';

function CsdChatPageInner() {
  const searchParams = useSearchParams();
  const initialConversationId = searchParams.get('c');
  const { user, token, error, logout, canWrite } = useCsdPageAuth('view');
  const [chatEnabled, setChatEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    void fetchCsdChatMe(token)
      .then((me) => {
        if (!cancelled) setChatEnabled(me.enabled === true);
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
      breadcrumb={[
        { label: 'CRM', href: '/crm/leads' },
        { label: 'Service Desk', href: '/crm/csd' },
        { label: 'Chat' },
      ]}
      width="full"
    >
      <PageToolbar title="Chat native" subtitle="Hộp thoại — DM, nhóm, khách, dự án" />
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
      {token && chatEnabled ? (
        <CsdChatWorkspace token={token} canWrite={canWrite} initialConversationId={initialConversationId} />
      ) : null}
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
