'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DeliveryCapacityPanel } from '@/components/delivery/DeliveryCapacityPanel';
import { DeliveryPageGate } from '@/components/delivery/DeliveryPageGate';
import { KpiHubShell } from '@/components/kpi-hub/KpiHubShell';
import { fetchDeliveryCapacity, type CapacityTeamRow } from '@/lib/delivery-projects-api';
import { clearSession, getAccessToken, getRefreshToken, updateAccessToken } from '@/lib/auth';
import { staffRefresh } from '@/lib/api';

export default function DeliveryCapacityPage() {
  const router = useRouter();
  const [teams, setTeams] = useState<CapacityTeamRow[]>([]);
  const [range, setRange] = useState<{ start: string; end: string } | null>(null);
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
      const out = await fetchDeliveryCapacity(token, 4);
      setTeams(out.teams);
      setRange(out.range);
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
        const data = await fetchDeliveryCapacity(out.access_token, 4);
        setTeams(data.teams);
        setRange(data.range);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải capacity thất bại');
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
        title="Capacity Planning"
        subtitle="Phân bổ nguồn lực theo team — cảnh báo quá tải trên 100%."
        breadcrumb={[
          { label: 'Project Delivery', href: '/crm/delivery-projects' },
          { label: 'Capacity Planning' },
        ]}
      >
        {range ? (
          <p className="delivery-hint">
            Kỳ: {range.start} → {range.end}
          </p>
        ) : null}
        {error ? <p className="error">{error}</p> : null}
        <DeliveryCapacityPanel teams={teams} loading={loading} />
        <p className="delivery-hint">
          <Link href="/crm/delivery-projects" className="delivery-link">
            ← Quay lại danh mục
          </Link>
        </p>
      </KpiHubShell>
    </DeliveryPageGate>
  );
}
