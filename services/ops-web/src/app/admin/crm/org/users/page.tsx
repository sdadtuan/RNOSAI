'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AdminPageShell } from '@/components/admin';
import { AdminOrgSubNav } from '@/components/rbac/AdminOrgSubNav';
import { fetchStaffOrgUsers, type StaffOrgUserSummary } from '@/lib/api';
import { canViewOrgAdmin, useAdminCrmAuth } from '@/lib/admin/use-admin-crm-auth';

export default function AdminOrgUsersPage() {
  const { user, token, error, loading, logout } = useAdminCrmAuth(canViewOrgAdmin);
  const [rows, setRows] = useState<StaffOrgUserSummary[]>([]);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (!token) return;
    void fetchStaffOrgUsers(token)
      .then(setRows)
      .catch((err) => setLoadError(err instanceof Error ? err.message : 'Tải thất bại'));
  }, [token]);

  return (
    <AdminPageShell
      user={user}
      onLogout={logout}
      section="crm-config"
      title="Nhân viên"
      subtitle="Danh sách tài khoản staff — wizard onboard WIN-2-B"
      breadcrumb={[
        { label: 'Cấu hình CRM', href: '/admin/crm/custom-fields' },
        { label: 'Tổ chức', href: '/admin/crm/org/users' },
        { label: 'Nhân viên' },
      ]}
      loading={loading}
      actions={
        <span className="muted" style={{ fontSize: '0.875rem' }}>
          Onboard wizard — Sprint WIN-2-B
        </span>
      }
    >
      <AdminOrgSubNav />
      {error ? <p className="form-error">{error}</p> : null}
      {loadError ? <p className="form-error">{loadError}</p> : null}

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Tên</th>
              <th>Email</th>
              <th>Chức vụ · Functions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.display_name}</td>
                <td>{row.email}</td>
                <td>
                  {row.position_code ?? row.position_id}
                  {row.job_functions?.length ? ` · ${row.job_functions.join(', ')}` : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="muted" style={{ marginTop: '1rem' }}>
        Gán job function:{' '}
        <Link href="/admin/crm/permissions/users">Phân quyền → Gán user</Link>
      </p>
    </AdminPageShell>
  );
}
