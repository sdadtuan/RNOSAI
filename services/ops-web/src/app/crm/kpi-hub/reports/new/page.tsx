'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { KpiHubPageGate } from '@/components/kpi-hub/KpiHubPageGate';
import { KpiHubShell } from '@/components/kpi-hub/KpiHubShell';
import { KpiHubReportWizard } from '@/components/kpi-hub/reports/KpiHubReportWizard';
import { getAccessToken } from '@/lib/auth';
import { createKpiHubReport } from '@/lib/kpi-hub-api';

export default function KpiHubReportNewPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <KpiHubPageGate section="crm_kpi_hub_reports">
      <KpiHubShell
        title="Tạo báo cáo mới"
        subtitle="Wizard 3 bước: mẫu, widget, lịch gửi"
        breadcrumb={[
          { label: 'KPI Hub', href: '/crm/kpi-hub' },
          { label: 'Báo cáo', href: '/crm/kpi-hub/reports' },
          { label: 'Tạo mới' },
        ]}
        actions={
          <Link href="/crm/kpi-hub/reports" className="kpi-hub-btn kpi-hub-btn--ghost">
            Hủy
          </Link>
        }
      >
        {error ? <p className="error">{error}</p> : null}
        <KpiHubReportWizard
          submitting={submitting}
          onSubmit={async (payload) => {
            const token = getAccessToken();
            if (!token) return;
            setSubmitting(true);
            setError(null);
            try {
              await createKpiHubReport(token, payload);
              router.push('/crm/kpi-hub/reports');
            } catch (err: unknown) {
              setError(err instanceof Error ? err.message : 'Tạo báo cáo thất bại');
            } finally {
              setSubmitting(false);
            }
          }}
        />
      </KpiHubShell>
    </KpiHubPageGate>
  );
}
