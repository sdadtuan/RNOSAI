'use client';

import { useCallback, useEffect, useState } from 'react';
import { PageToolbar, StaffPageShell } from '@/components/layout';
import { CsdEmailInbox } from '@/components/crm/csd/CsdEmailInbox';
import { useCsdPageAuth } from '@/components/crm/csd/useCsdPageAuth';
import { fetchCsdUnmatchedEmails, type CsdEmailRow } from '@/lib/crm/csd-api';

export default function CsdEmailUnmatchedPage() {
  const { user, token, error, setError, logout } = useCsdPageAuth('view');
  const [items, setItems] = useState<CsdEmailRow[]>([]);

  const reload = useCallback(async () => {
    if (!token) return;
    try {
      const out = await fetchCsdUnmatchedEmails(token);
      setItems(out.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tải email chưa khớp thất bại');
    }
  }, [token, setError]);

  useEffect(() => {
    void reload();
  }, [reload]);

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
        { label: 'Email', href: '/crm/csd/email' },
        { label: 'Chưa khớp' },
      ]}
    >
      <PageToolbar title="Email chưa khớp khách" subtitle="Cần gán client hoặc tạo ticket thủ công" />
      <div className="page-card stack-gap">
        {error ? <p className="error">{error}</p> : null}
        <CsdEmailInbox items={items} />
      </div>
    </StaffPageShell>
  );
}
