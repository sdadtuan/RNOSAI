'use client';

import '@/app/crm/proposals/qt.css';
import { AdminPageShell } from '@/components/admin';
import { AdminServicesPortfolioPanel } from '@/components/admin/AdminServicesPortfolioPanel';
import { hasCap } from '@/lib/auth';
import { canEditSpc, canViewSpcAdmin, useAdminCrmAuth } from '@/lib/admin/use-admin-crm-auth';

export default function AdminServicesPortfolioPage() {
  const { user, token, error, loading, logout } = useAdminCrmAuth(canViewSpcAdmin);
  const canManage =
    canEditSpc(user) ||
    hasCap(user, 'crm_quote.catalog', 'manage') ||
    hasCap(user, 'crm_data_config', 'configure');

  return (
    <AdminPageShell
      user={user}
      onLogout={logout}
      title="Portfolio 21 DV"
      subtitle="L0 service_family — nhóm dịch vụ, SKU CB/TC/CS, publish workflow"
      section="crm-config"
      hideToolbar
      loading={loading}
      breadcrumb={[
        { label: 'Quản trị hệ thống', href: '/admin' },
        { label: 'Dịch vụ & Catalog', href: '/admin/services' },
        { label: 'Portfolio' },
      ]}
    >
      {error ? <p className="error">{error}</p> : null}
      <AdminServicesPortfolioPanel token={token} canManage={canManage} />
    </AdminPageShell>
  );
}
