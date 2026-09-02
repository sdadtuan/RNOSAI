'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { PageToolbar, StaffPageShell } from '@/components/layout';
import { CsdChatWorkspace } from '@/components/crm/csd/CsdChatWorkspace';
import { useCsdPageAuth } from '@/components/crm/csd/useCsdPageAuth';

function CsdChatPageInner() {
  const searchParams = useSearchParams();
  const initialConversationId = searchParams.get('c');
  const { user, token, error, logout, canWrite } = useCsdPageAuth('view');

  if (!user) {
    return (
      <StaffPageShell user={null} onLogout={logout} loading>
        <span />
      </StaffPageShell>
    );
  }

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
      <PageToolbar title="Chat native" subtitle="DM, nhóm nội bộ, khách, dự án — tạo ticket từ tin" />
      {error ? (
        <div className="page-card">
          <p className="error">{error}</p>
        </div>
      ) : null}
      {token ? (
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
