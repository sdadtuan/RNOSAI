'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PortalPageShell } from '@/components/PortalPageShell';
import { PortalPosOrderForm } from '@/components/portal-pos/PortalPosOrderForm';
import { isPortalReadOnly, VIEWER_READ_ONLY_HINT } from '@/lib/portal-role';

function NewOrderForm() {
  const router = useRouter();
  const search = useSearchParams();
  const phone = search.get('phone') ?? '';
  const name = search.get('name') ?? '';
  return (
    <PortalPageShell breadcrumb={[{ label: 'Cổng khách hàng', href: '/crm' }, { label: 'Đơn hàng', href: '/crm/orders' }, { label: 'Tạo đơn' }]}>
      {({ token, user }) => (
        <div className="pos" style={{ maxWidth: 720 }}>
          <h1>Tạo đơn hàng</h1>
          {isPortalReadOnly(user.role) ? <p className="pos-hint">{VIEWER_READ_ONLY_HINT}</p> : null}
          <fieldset className="portal-ro" disabled={isPortalReadOnly(user.role)}>
            <PortalPosOrderForm
              token={token}
              confirmOnCreate={false}
              prefill={{ phone, name }}
              onCreated={(o) => router.push(`/crm/orders/${o.id}`)}
            />
          </fieldset>
        </div>
      )}
    </PortalPageShell>
  );
}

export default function NewOrderPage() {
  return (
    <Suspense fallback={<p className="muted">Đang tải đơn…</p>}>
      <NewOrderForm />
    </Suspense>
  );
}
