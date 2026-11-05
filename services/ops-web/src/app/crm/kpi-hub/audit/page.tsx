'use client';

import { KpiHubPageGate } from '@/components/kpi-hub/KpiHubPageGate';
import { KpiHubShell } from '@/components/kpi-hub/KpiHubShell';

export default function KpiHubAuditPage() {
  return (
    <KpiHubPageGate section="crm_kpi_hub">
      <KpiHubShell
        title="Audit Log"
        subtitle="Nhật ký thay đổi KPI Hub và Delivery."
        breadcrumb={[{ label: 'Phân tích' }, { label: 'Audit Log' }]}
      >
        <div className="kpi-hub-empty" data-testid="hub-audit">
          <p>Chưa có sự kiện.</p>
        </div>
      </KpiHubShell>
    </KpiHubPageGate>
  );
}
