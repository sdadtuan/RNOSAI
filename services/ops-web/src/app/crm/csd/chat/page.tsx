'use client';

import { PageToolbar, StaffPageShell } from '@/components/layout';
import { CsdChatWorkspace } from '@/components/crm/csd/CsdChatWorkspace';
import { useCsdPageAuth } from '@/components/crm/csd/useCsdPageAuth';

export default function CsdChatPage() {
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
      {token ? <CsdChatWorkspace token={token} canWrite={canWrite} /> : null}
    </StaffPageShell>
  );
}
