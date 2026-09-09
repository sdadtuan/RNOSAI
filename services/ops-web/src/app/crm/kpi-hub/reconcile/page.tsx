'use client';

import { useEffect, useState } from 'react';
import { KpiHubPageGate } from '@/components/kpi-hub/KpiHubPageGate';
import { KpiHubShell } from '@/components/kpi-hub/KpiHubShell';
import { ServiceKpiReconcileTable } from '@/components/kpi-hub/service-kpi/ServiceKpiReconcileTable';
import { getAccessToken } from '@/lib/auth';
import { fetchServiceKpiReconcile } from '@/lib/service-kpi-api';
import type { ServiceKpiReconcileRow } from '@/lib/service-kpi-types';

export default function KpiHubReconcilePage() {
  const token = getAccessToken() ?? '';
  const [sourceId, setSourceId] = useState('');
  const [rows, setRows] = useState<ServiceKpiReconcileRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !sourceId.trim()) {
      setRows([]);
      return;
    }
    setLoading(true);
    setError(null);
    void fetchServiceKpiReconcile(token, sourceId.trim())
      .then((res) => setRows(res.rows))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Lỗi reconcile'))
      .finally(() => setLoading(false));
  }, [token, sourceId]);

  return (
    <KpiHubPageGate section="crm_kpi_hub">
      <KpiHubShell
        title="Quoted vs Actual"
        subtitle="Đối soát 3 sổ Quoted · Delivered · Reported và hành vi publish"
        breadcrumb={[{ label: 'KPI Hub' }, { label: 'Service KPI' }, { label: 'Quoted vs Actual' }]}
        searchPlaceholder="Nhập source_id quote line…"
      >
        <label className="kpi-hub-field" style={{ maxWidth: 420, marginBottom: 16 }}>
          <span>Source ID (quote line)</span>
          <input
            value={sourceId}
            onChange={(e) => setSourceId(e.target.value)}
            placeholder="Ví dụ: line-1 hoặc ID từ Quote Builder"
          />
        </label>
        {loading ? <p className="kpi-hub-muted">Đang tải…</p> : null}
        {error ? <p className="kpi-hub-form-error">{error}</p> : null}
        <ServiceKpiReconcileTable rows={rows} sourceId={sourceId.trim()} />
      </KpiHubShell>
    </KpiHubPageGate>
  );
}
