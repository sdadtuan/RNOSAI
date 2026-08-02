'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { PendingApprovalsWidget } from '@/components/PendingApprovalsWidget';
import { PortalAiReportSummary } from '@/components/PortalAiReportSummary';
import { PerformancePanel } from '@/components/PerformancePanel';
import { PageToolbar } from '@/components/layout';
import { PortalPageShell } from '@/components/PortalPageShell';
import {
  fetchPortalNotificationSummary,
  portalSeoStatus,
  type PortalNotificationSummaryResponse,
} from '@/lib/api';
import { usePortalEmailNav } from '@/hooks/usePortalEmailNav';
import { usePortalSeoNav } from '@/hooks/usePortalSeoNav';

export default function DashboardPage() {
  return (
    <PortalPageShell breadcrumb={[{ label: 'Client Portal', href: '/dashboard' }, { label: 'Performance' }]}>
      {({ token }) => <DashboardContent token={token} />}
    </PortalPageShell>
  );
}

function DashboardContent({ token }: { token: string }) {
  const seoEnabled = usePortalSeoNav(token);
  const { pendingEmail } = usePortalEmailNav(token);
  const [summary, setSummary] = useState<PortalNotificationSummaryResponse | null>(null);
  const [seoPending, setSeoPending] = useState(0);

  useEffect(() => {
    void fetchPortalNotificationSummary(token)
      .then(setSummary)
      .catch(() => setSummary(null));
  }, [token]);

  useEffect(() => {
    if (!seoEnabled) {
      setSeoPending(0);
      return;
    }
    void portalSeoStatus(token)
      .then((status) => setSeoPending(Number(status.pending_client_review ?? 0)))
      .catch(() => setSeoPending(0));
  }, [token, seoEnabled]);

  return (
    <div className="page-card">
      <PageToolbar
        title="Performance tổng hợp"
        subtitle="Meta · Google · Zalo — CPL và chi tiêu theo chiến dịch"
      />
      <PortalAiReportSummary token={token} />
      <PendingApprovalsWidget summary={summary} seoPending={seoPending} emailPending={pendingEmail} />
      <PerformancePanel token={token} title="Bảng hiệu suất" subtitle="Tất cả kênh" />
      <p className="muted portal-dashboard-links">
        <Link href="/notifications">Trung tâm thông báo</Link>
        {' · '}
        <Link href="/creatives">Creative inbox</Link>
      </p>
    </div>
  );
}
