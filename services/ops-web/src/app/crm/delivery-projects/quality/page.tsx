'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DeliveryPageGate } from '@/components/delivery/DeliveryPageGate';
import { DeliveryQualityPanel } from '@/components/delivery/DeliveryQualityPanel';
import { KpiHubShell } from '@/components/kpi-hub/KpiHubShell';
import { fetchDeliveryQuality, type DeliveryQualitySnapshotRow } from '@/lib/delivery-projects-api';
import { clearSession, getAccessToken, getRefreshToken, updateAccessToken } from '@/lib/auth';
import { staffRefresh } from '@/lib/api';

export default function DeliveryQualityPage() {
  const router = useRouter();
  const [items, setItems] = useState<DeliveryQualitySnapshotRow[]>([]);
  const [period, setPeriod] = useState(() => new Date().toISOString().slice(0, 7));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    let token = getAccessToken();
    if (!token) {
      router.replace('/login');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const out = await fetchDeliveryQuality(token, period);
      setItems(out.items);
    } catch {
      const refresh = getRefreshToken();
      if (!refresh) {
        clearSession();
        router.replace('/login');
        return;
      }
      try {
        const out = await staffRefresh(refresh);
        updateAccessToken(out.access_token);
        const data = await fetchDeliveryQuality(out.access_token, period);
        setItems(data.items);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải quality thất bại');
      }
    } finally {
      setLoading(false);
    }
  }, [period, router]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <DeliveryPageGate>
      <KpiHubShell
        title="Delivery Quality"
        subtitle="Điểm chất lượng bàn giao từ milestone và change request."
        breadcrumb={[
          { label: 'Project Delivery', href: '/crm/delivery-projects' },
          { label: 'Delivery Quality' },
        ]}
        actions={
          <input
            type="month"
            className="delivery-filter-input"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            aria-label="Kỳ tháng"
          />
        }
      >
        {error ? <p className="error">{error}</p> : null}
        <DeliveryQualityPanel items={items} loading={loading} />
        <p className="delivery-hint">
          <Link href="/crm/delivery-projects" className="delivery-link">
            ← Quay lại danh mục
          </Link>
        </p>
      </KpiHubShell>
    </DeliveryPageGate>
  );
}
