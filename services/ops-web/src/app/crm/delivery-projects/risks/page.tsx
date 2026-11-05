'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DeliveryPageGate } from '@/components/delivery/DeliveryPageGate';
import { DeliveryRiskPanel } from '@/components/delivery/DeliveryRiskPanel';
import { KpiHubShell } from '@/components/kpi-hub/KpiHubShell';
import { fetchDeliveryRisks, type DeliveryRiskRow } from '@/lib/delivery-projects-api';
import { clearSession, getAccessToken, getRefreshToken, updateAccessToken } from '@/lib/auth';
import { staffRefresh } from '@/lib/api';

export default function DeliveryRisksPage() {
  const router = useRouter();
  const [items, setItems] = useState<DeliveryRiskRow[]>([]);
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
      const out = await fetchDeliveryRisks(token);
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
        const data = await fetchDeliveryRisks(out.access_token);
        setItems(data.items);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải Risk Register thất bại');
      }
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <DeliveryPageGate>
      <KpiHubShell
        title="Risk Register"
        subtitle="Theo dõi rủi ro bàn giao trên toàn danh mục dự án."
        breadcrumb={[
          { label: 'Project Delivery', href: '/crm/delivery-projects' },
          { label: 'Risk Register' },
        ]}
      >
        {error ? <p className="error">{error}</p> : null}
        <DeliveryRiskPanel items={items} loading={loading} />
        <p className="delivery-hint">
          <Link href="/crm/delivery-projects" className="delivery-link">
            ← Quay lại danh mục
          </Link>
        </p>
      </KpiHubShell>
    </DeliveryPageGate>
  );
}
