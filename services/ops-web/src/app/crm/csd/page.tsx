'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { PageToolbar, StaffPageShell } from '@/components/layout';
import { CsdTicketList } from '@/components/crm/csd/CsdTicketList';
import { useCsdPageAuth } from '@/components/crm/csd/useCsdPageAuth';
import { fetchCsdDashboard, type CsdDashboardPayload } from '@/lib/crm/csd-api';

export default function CsdDashboardPage() {
  const { user, token, error, setError, logout } = useCsdPageAuth('view');
  const [dash, setDash] = useState<CsdDashboardPayload | null>(null);

  useEffect(() => {
    if (!token) return;
    void (async () => {
      try {
        const out = await fetchCsdDashboard(token);
        setDash(out);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải dashboard thất bại');
      }
    })();
  }, [token, setError]);

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
        { label: 'Service Desk' },
      ]}
    >
      <PageToolbar
        title="Service Desk"
        subtitle="Ticket agency · chat · email · báo cáo — tách biệt Ticket CS"
        actions={
          <Link href="/crm/csd/tickets" className="btn btn-sm">
            Xem ticket
          </Link>
        }
      />

      <div className="page-card stack-gap" data-testid="csd-dashboard">
        {error ? <p className="error">{error}</p> : null}
        <div className="csd-kpi-grid">
          <Link href="/crm/csd/tickets" className="csd-kpi-card">
            <span className="csd-kpi-card__label">Cần xử lý</span>
            <strong className="csd-kpi-card__value">{dash?.need_action ?? '—'}</strong>
          </Link>
          <Link href="/crm/csd/tickets?sla=at_risk" className="csd-kpi-card">
            <span className="csd-kpi-card__label">SLA rủi ro</span>
            <strong className="csd-kpi-card__value">{dash?.sla_risk ?? '—'}</strong>
          </Link>
          <Link href="/crm/csd/reports" className="csd-kpi-card">
            <span className="csd-kpi-card__label">Báo cáo đến hạn</span>
            <strong className="csd-kpi-card__value">{dash?.reports_due ?? '—'}</strong>
          </Link>
          <Link href="/crm/csd/email/unmatched" className="csd-kpi-card">
            <span className="csd-kpi-card__label">Email chờ xử lý</span>
            <strong className="csd-kpi-card__value">{dash?.inbox_waiting ?? '—'}</strong>
          </Link>
        </div>

        <div>
          <h3 className="kpi-section-title">Ticket ưu tiên</h3>
          <CsdTicketList items={dash?.top_tickets ?? []} />
        </div>
      </div>
    </StaffPageShell>
  );
}
