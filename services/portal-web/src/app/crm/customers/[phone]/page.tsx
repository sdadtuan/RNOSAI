'use client';

import { useParams } from 'next/navigation';
import { PortalPageShell } from '@/components/PortalPageShell';
import { PortalPosCustomerDetail } from '@/components/portal-pos/PortalPosCustomerDetail';

export default function CustomerDetailPage() {
  const params = useParams<{ phone: string }>();
  let phone = String(params.phone ?? '');
  try {
    phone = decodeURIComponent(phone);
  } catch {
    phone = String(params.phone ?? '');
  }

  return (
    <PortalPageShell breadcrumb={[{ label: 'Cổng khách hàng', href: '/crm' }, { label: 'Khách hàng', href: '/crm/customers' }, { label: 'Hồ sơ' }]}>
      {({ token, user }) => (
        <PortalPosCustomerDetail
          token={token}
          phone={phone}
          canManage={user.role === 'approver'}
          readOnly={user.role === 'viewer'}
        />
      )}
    </PortalPageShell>
  );
}
