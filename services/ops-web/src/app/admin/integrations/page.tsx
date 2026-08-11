'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { AdminPageShell } from '@/components/admin';
import { fetchAdminIntegrations, fetchAdminIntegrationsHealth, type AdminIntegrationRow } from '@/lib/api';
import { canViewAdminAudit, useAdminCrmAuth } from '@/lib/admin/use-admin-crm-auth';

function statusClass(status: string): string {
  if (status === 'critical') return 'admin-integration-status--critical';
  if (status === 'warning') return 'admin-audit-severity--warning';
  return '';
}

export default function AdminIntegrationsPage() {
  const { user, token, error, loading, logout } = useAdminCrmAuth(canViewAdminAudit);
  const [integrations, setIntegrations] = useState<AdminIntegrationRow[]>([]);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [health, setHealth] = useState<{ expiring_count?: number; critical_count?: number } | null>(null);
  const [loadError, setLoadError] = useState('');

  const reload = useCallback(async () => {
    if (!token) return;
    setLoadError('');
    try {
      const [list, h] = await Promise.all([
        fetchAdminIntegrations(token),
        fetchAdminIntegrationsHealth(token),
      ]);
      setIntegrations(list.integrations);
      setSummary(list.summary);
      setHealth(h);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Tải registry thất bại');
    }
  }, [token]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <AdminPageShell
      user={user}
      onLogout={logout}
      section="crm-config"
      title="Registry tích hợp"
      subtitle="Webhooks · OAuth tokens · SSO"
      breadcrumb={[
        { label: 'Quản trị', href: '/admin' },
        { label: 'Integrations' },
      ]}
      loading={loading}
    >
      <div className="admin-governance-page">
        {error ? <p className="form-error">{error}</p> : null}
        {loadError ? <p className="form-error">{loadError}</p> : null}
        <div className="admin-audit-filters">
          <span className="muted">
            OK {summary.ok ?? 0} · Warning {summary.warning ?? 0} · Critical {summary.critical ?? 0}
            {health ? ` · Expiring ${health.expiring_count ?? 0}` : ''}
          </span>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Tên</th>
              <th>Loại</th>
              <th>Trạng thái</th>
              <th>Chi tiết</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {integrations.map((row) => (
              <tr key={row.id}>
                <td>{row.name}</td>
                <td>{row.kind}</td>
                <td className={statusClass(row.status)}>{row.status}</td>
                <td className="muted">{row.detail}</td>
                <td>
                  {row.redirect_href ? (
                    <Link href={row.redirect_href} className="btn btn-sm btn-ghost">
                      Quản lý
                    </Link>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminPageShell>
  );
}
