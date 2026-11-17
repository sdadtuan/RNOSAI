'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { PortalPageShell } from '@/components/PortalPageShell';
import { CrmScreen, type CustomerSourceFilter } from '@/components/portal-crm/CrmScreen';
import { PortalPosCustomers } from '@/components/portal-pos/PortalPosCustomers';

function CustomerTabs({ tab, onTab }: { tab: 'pos' | 'care'; onTab: (next: 'pos' | 'care') => void }) {
  return (
    <div className="pos-tabs">
      <button type="button" className={`pos-tab${tab === 'pos' ? ' is-on' : ''}`} onClick={() => onTab('pos')}>
        Khách bán hàng
      </button>
      <button type="button" className={`pos-tab${tab === 'care' ? ' is-on' : ''}`} onClick={() => onTab('care')}>
        Chăm sóc
      </button>
    </div>
  );
}

function CustomersInner() {
  const searchParams = useSearchParams();
  const source = searchParams.get('source');
  const posPhone = searchParams.get('pos') || '';
  const initialSource: CustomerSourceFilter | undefined =
    source === 'lead' || source === 'message' ? source : undefined;
  const [tab, setTab] = useState<'pos' | 'care'>(posPhone || !source ? 'pos' : 'care');

  if (tab === 'care') {
    return (
      <CrmScreen
        view="customers"
        initialCustomerSource={initialSource}
        header={<CustomerTabs tab={tab} onTab={setTab} />}
      />
    );
  }

  return (
    <PortalPageShell breadcrumb={[{ label: 'Cổng khách hàng', href: '/crm' }, { label: 'Khách hàng' }]}>
      {({ token, user }) => (
        <>
          <CustomerTabs tab={tab} onTab={setTab} />
          <PortalPosCustomers token={token} canManage={user.role === 'approver'} initialPhone={posPhone} />
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
