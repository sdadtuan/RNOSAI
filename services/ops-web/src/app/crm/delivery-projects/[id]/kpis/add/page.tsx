'use client';

import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { DeliveryPageGate } from '@/components/delivery/DeliveryPageGate';
import { DictPickerOverlay } from '@/components/delivery/DictPickerOverlay';
import { KpiHubShell } from '@/components/kpi-hub/KpiHubShell';
import { fetchDeliveryProject } from '@/lib/delivery-projects-api';
import { getAccessToken } from '@/lib/auth';

export default function DeliveryProjectKpisAddPage() {
  const router = useRouter();
  const params = useParams();
  const id = String(params.id ?? '');
  const [token, setToken] = useState('');
  const [label, setLabel] = useState('');

  useEffect(() => {
    const t = getAccessToken();
    if (!t) {
      router.replace('/login');
      return;
    }
    setToken(t);
    void fetchDeliveryProject(t, id).then((row) => {
      setLabel(`${row.code ?? '—'} · ${row.name}`);
    });
  }, [id, router]);

  return (
    <DeliveryPageGate>
      <KpiHubShell
        title="Thêm KPI từ Dictionary"
        subtitle="Chọn KPI Active từ KPI Dictionary Hub"
        breadcrumb={[
          { label: 'Project Delivery', href: '/crm/delivery-projects' },
          { label: 'Chi tiết', href: `/crm/delivery-projects/${id}` },
          { label: 'Thêm KPI' },
        ]}
      >
        <DictPickerOverlay
          open
          projectId={id}
          projectLabel={label}
          token={token}
          onClose={() => router.push(`/crm/delivery-projects/${id}`)}
          onAttached={() => router.push(`/crm/delivery-projects/${id}`)}
        />
      </KpiHubShell>
    </DeliveryPageGate>
  );
}
