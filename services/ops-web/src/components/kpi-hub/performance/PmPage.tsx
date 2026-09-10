'use client';

import type { ReactNode } from 'react';
import { KpiHubPageGate } from '@/components/kpi-hub/KpiHubPageGate';
import { KpiHubShell } from '@/components/kpi-hub/KpiHubShell';

type Props = {
  title: string;
  subtitle: string;
  crumb: string;
  actions?: ReactNode;
  children: ReactNode;
};

export function PmPage({ title, subtitle, crumb, actions, children }: Props) {
  return (
    <KpiHubPageGate section="crm_kpi_hub">
      <KpiHubShell
        title={title}
        subtitle={subtitle}
        breadcrumb={[{ label: 'KPI Hub' }, { label: 'Hiệu suất' }, { label: crumb }]}
        actions={actions}
        searchPlaceholder="Tìm KPI, owner, client, quote, campaign…"
      >
        {children}
      </KpiHubShell>
    </KpiHubPageGate>
  );
}

export function pmBadge(status: string): string {
  if (status === 'green' || status === 'approved' || status === 'Healthy' || status === 'Verified') {
    return 'kpi-hub-badge kpi-hub-badge--pass';
  }
  if (status === 'yellow' || status === 'watch' || /Stale|Pending|Review/i.test(status)) {
    return 'kpi-hub-badge kpi-hub-badge--amber';
  }
  if (status === 'red' || status === 'critical') return 'kpi-hub-badge kpi-hub-badge--critical';
  return 'kpi-hub-badge kpi-hub-badge--gray';
}

export function pmStatusLabel(status: string): string {
  if (status === 'green') return 'Xanh';
  if (status === 'yellow') return 'Vàng';
  if (status === 'red') return 'Đỏ';
  if (status === 'approved') return 'Approved';
  if (status === 'no_data') return 'Chưa có dữ liệu';
  return status;
}
