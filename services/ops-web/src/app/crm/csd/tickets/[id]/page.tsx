'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { PageToolbar, StaffPageShell } from '@/components/layout';
import { CsdTicketDetail } from '@/components/crm/csd/CsdTicketDetail';
import { useCsdPageAuth } from '@/components/crm/csd/useCsdPageAuth';

export default function CsdTicketDetailPage() {
  const params = useParams<{ id: string }>();
  const ticketId = params.id;
  const { user, token, logout, canWrite } = useCsdPageAuth('view');

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
        { label: 'Ticket', href: '/crm/csd/tickets' },
        { label: ticketId },
      ]}
      width="full"
    >
      <PageToolbar
        title="Chi tiết ticket"
        subtitle="Phản hồi công khai / ghi chú nội bộ"
        actions={
          <Link href="/crm/csd/tickets" className="btn btn-sm btn-secondary">
            Danh sách
          </Link>
        }
      />
      {token ? <CsdTicketDetail token={token} ticketId={ticketId} canWrite={canWrite} /> : null}
    </StaffPageShell>
  );
}
