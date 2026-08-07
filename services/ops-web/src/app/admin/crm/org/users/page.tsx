'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AdminPageShell } from '@/components/admin';
import { AdminOrgSubNav } from '@/components/rbac/AdminOrgSubNav';
import { UserIdentityCard } from '@/components/rbac/UserIdentityCard';
import { WinDrawer } from '@/components/win';
import {
  fetchStaffOrgJobFunctionCatalog,
  fetchStaffOrgPositions,
  fetchStaffOrgUsers,
  type StaffOrgPositionRow,
  type StaffOrgUserSummary,
} from '@/lib/api';
import {
  canEditOrgUsers,
  canViewOrgAdmin,
  useAdminCrmAuth,
} from '@/lib/admin/use-admin-crm-auth';

const PAGE_SIZE = 20;

export default function AdminOrgUsersPage() {
  const { user, token, error, loading, logout } = useAdminCrmAuth(canViewOrgAdmin);
  const [rows, setRows] = useState<StaffOrgUserSummary[]>([]);
  const [positions, setPositions] = useState<StaffOrgPositionRow[]>([]);
  const [catalog, setCatalog] = useState<Array<{ code: string; label: string }>>([]);
  const [loadError, setLoadError] = useState('');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<StaffOrgUserSummary | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const canEdit = canEditOrgUsers(user);

  const reload = useCallback(async (access: string, search?: string) => {
    const [users, pos, fnCatalog] = await Promise.all([
      fetchStaffOrgUsers(access, { q: search, includeInactive: true }),
      fetchStaffOrgPositions(access),
      fetchStaffOrgJobFunctionCatalog(access),
    ]);
    setRows(users);
    setPositions(pos);
    setCatalog(fnCatalog.map((f) => ({ code: f.code, label: f.label })));
  }, []);

  useEffect(() => {
    if (!token) return;
    void reload(token, query).catch((err) =>
      setLoadError(err instanceof Error ? err.message : 'Tải thất bại'),
    );
  }, [token, query, reload]);

  const pageRows = useMemo(() => {
    const start = page * PAGE_SIZE;
    return rows.slice(start, start + PAGE_SIZE);
  }, [rows, page]);

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));

  function openUser(row: StaffOrgUserSummary) {
    setSelected(row);
    setDrawerOpen(true);
  }

  return (
    <AdminPageShell
      user={user}
      onLogout={logout}
      section="crm-config"
      title="Nhân viên"
      subtitle="Tài khoản staff + onboard wizard"
      breadcrumb={[
        { label: 'Cấu hình CRM', href: '/admin/crm/custom-fields' },
        { label: 'Tổ chức', href: '/admin/crm/org/users' },
        { label: 'Nhân viên' },
      ]}
      loading={loading}
      actions={
        canEdit ? (
          <Link href="/admin/crm/org/users/new" className="btn btn-primary btn-sm">
            + Onboard NV
          </Link>
        ) : null
      }
    >
      <AdminOrgSubNav />
      {error ? <p className="form-error">{error}</p> : null}
      {loadError ? <p className="form-error">{loadError}</p> : null}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(q.trim());
          setPage(0);
        }}
        style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tìm tên / email…"
          style={{ flex: 1 }}
        />
        <button type="submit" className="btn btn-sm">
          Tìm
        </button>
      </form>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Tên</th>
              <th>Email</th>
              <th>Chức vụ · Team · Functions</th>
              <th>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row) => (
              <tr key={row.id}>
                <td>
                  <button type="button" className="btn btn-link" onClick={() => openUser(row)}>
                    {row.display_name}
                  </button>
                </td>
                <td>{row.email}</td>
                <td>
                  {row.position_code ?? row.position_id}
                  {row.team_codes?.length ? ` · ${row.team_codes.join(', ')}` : ''}
                  {row.job_functions?.length ? ` · ${row.job_functions.join(', ')}` : ''}
                </td>
                <td>{row.active === false ? 'Ngưng' : 'Hoạt động'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pageCount > 1 ? (
        <div className="win-filter-chips" style={{ marginTop: '0.75rem' }}>
          {Array.from({ length: pageCount }, (_, i) => (
            <button
              key={i}
              type="button"
              className={`chip${page === i ? ' is-active' : ''}`}
              onClick={() => setPage(i)}
            >
              {i + 1}
            </button>
          ))}
        </div>
      ) : null}

      {token && selected ? (
        <WinDrawer
          open={drawerOpen}
          title={selected.display_name}
          onClose={() => setDrawerOpen(false)}
        >
          <UserIdentityCard
            token={token}
            user={selected}
            positions={positions}
            functionOptions={catalog}
            canEdit={canEdit}
            onSaved={(updated) => {
              setSelected(updated);
              void reload(token, query);
            }}
            onOffboarded={() => {
              setDrawerOpen(false);
              void reload(token, query);
            }}
          />
        </WinDrawer>
      ) : null}
    </AdminPageShell>
  );
}
