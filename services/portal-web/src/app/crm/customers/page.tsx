'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { PortalPageShell } from '@/components/PortalPageShell';
import { CrmScreen, type CustomerSourceFilter } from '@/components/portal-crm/CrmScreen';
import { PortalPosCustomers } from '@/components/portal-pos/PortalPosCustomers';

function CustomersInner() {
  const searchParams = useSearchParams();
  const source = searchParams.get('source');
  const posPhone = searchParams.get('pos') || '';
  const initialSource: CustomerSourceFilter | undefined =
    source === 'lead' || source === 'message' ? source : undefined;
  const [tab, setTab] = useState<'pos' | 'care'>(posPhone || !source ? 'pos' : 'care');

  if (tab === 'care') {
    return (
      <div>
        <div className="pos" style={{ padding: '0.5rem 1rem 0' }}>
          <div className="pos-tabs">
            <button type="button" className="pos-tab" onClick={() => setTab('pos')}>Khách bán hàng</button>
            <button type="button" className="pos-tab is-on">Chăm sóc</button>
          </div>
        </div>
        <CrmScreen view="customers" initialCustomerSource={initialSource} />
      </div>
    );
  }

  return (
    <PortalPageShell breadcrumb={[{ label: 'Cổng khách hàng', href: '/crm' }, { label: 'Khách hàng' }]}>
      {({ token, user }) => (
        <>
          <div className="pos-tabs">
            <button type="button" className="pos-tab is-on">Khách bán hàng</button>
            <button type="button" className="pos-tab" onClick={() => setTab('care')}>Chăm sóc</button>
          </div>
          <PortalPosCustomers token={token} canManage={user.role !== 'staff'} initialPhone={posPhone} />
        </>
      )}
    </PortalPageShell>
  );
}

export default function PortalCustomersPage() {
  return (
    <Suspense fallback={<p className="muted">Đang tải khách hàng…</p>}>
      <CustomersInner />
    </Suspense>
  );
}
