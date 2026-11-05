'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { KpiGroupConfirmDialogs, type KpiGroupConfirmState } from '@/components/kpi-groups/KpiGroupConfirmDialogs';
import { KpiGroupFilterBar, type KpiGroupFilters } from '@/components/kpi-groups/KpiGroupFilterBar';
import { KpiGroupImportModal } from '@/components/kpi-groups/KpiGroupImportModal';
import { KpiGroupSummaryCards } from '@/components/kpi-groups/KpiGroupSummaryCards';
import { KpiGroupTable, type KpiGroupRowAction } from '@/components/kpi-groups/KpiGroupTable';
import { KpiGroupTipsPanel } from '@/components/kpi-groups/KpiGroupTipsPanel';
import { HubPageLayout, StaffPageShell } from '@/components/layout';
import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  getStoredUser,
  hasCap,
  updateAccessToken,
  updateStoredUser,
  type StoredStaffUser,
} from '@/lib/auth';
import { fetchStaffOrgDepartments, staffMe, staffRefresh } from '@/lib/api';
import type { StaffDepartmentRow } from '@/lib/api';
import {
  changeKpiGroupStatus,
  deleteKpiGroup,
  duplicateKpiGroup,
  fetchKpiGroupSummary,
  fetchKpiGroups,
  reorderKpiGroups,
  type KpiGroupListItem,
  type KpiGroupSummary,
} from '@/lib/kpi-groups-api';

const DEFAULT_FILTERS: KpiGroupFilters = {
  q: '',
  status: '',
  department_id: '',
  scope_type: '',
};

export default function KpiGroupsListPage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [rows, setRows] = useState<KpiGroupListItem[]>([]);
  const [summary, setSummary] = useState<KpiGroupSummary | null>(null);
  const [departments, setDepartments] = useState<StaffDepartmentRow[]>([]);
  const [filters, setFilters] = useState<KpiGroupFilters>(DEFAULT_FILTERS);
  const [applied, setApplied] = useState<KpiGroupFilters>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState<KpiGroupConfirmState>(null);
  const [importOpen, setImportOpen] = useState(false);

  const canManage = Boolean(user && hasCap(user, 'crm_kpi_groups', 'manage'));
  const canConfigure = Boolean(
    user &&
      (hasCap(user, 'crm_kpi_groups', 'configure') || hasCap(user, 'crm_kpi_groups', 'manage')),
  );
  const filtersAreDefault =
    !applied.q && !applied.status && !applied.department_id && !applied.scope_type;
  const canReorder = canConfigure && filtersAreDefault && page === 1;

  const ensureAuth = useCallback(async (): Promise<string | null> => {
    let access = getAccessToken();
    if (!access) {
      router.replace('/login');
      return null;
    }
    const cached = getStoredUser();
    if (cached) setUser(cached);
    try {
      const me = await staffMe(access);
      setUser(me);
      updateStoredUser(me);
      if (!hasCap(me, 'crm_kpi_groups', 'view')) {
        setError('Không có quyền xem Nhóm KPI');
        return null;
      }
      return access;
    } catch {
      const refresh = getRefreshToken();
      if (!refresh) {
        clearSession();
        router.replace('/login');
        return null;
      }
      const out = await staffRefresh(refresh);
      updateAccessToken(out.access_token);
      access = out.access_token;
      const me = await staffMe(access);
      setUser(me);
      updateStoredUser(me);
      return access;
    }
  }, [router]);

  const reload = useCallback(
    async (access: string) => {
      const [list, sum, depts] = await Promise.all([
        fetchKpiGroups(access, {
          page,
          page_size: pageSize,
          q: applied.q || undefined,
          status: applied.status || undefined,
          department_id: applied.department_id || undefined,
          scope_type: applied.scope_type || undefined,
          sort: 'display_order:asc',
        }),
        fetchKpiGroupSummary(access).catch(() => ({ total: 0, active: 0, draft: 0, inactive: 0 })),
        fetchStaffOrgDepartments(access).catch(() => []),
      ]);
      setRows(list.data);
      setTotal(list.meta.total);
      setTotalPages(list.meta.total_pages);
      setSummary(sum);
      setDepartments(depts);
    },
    [applied, page, pageSize],
  );

  useEffect(() => {
    void (async () => {
      const access = await ensureAuth();
      if (!access) return;
      setLoading(true);
      setError('');
      try {
        await reload(access);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải danh sách Nhóm KPI thất bại');
      } finally {
        setLoading(false);
      }
    })();
  }, [ensureAuth, reload]);

  function logout() {
    clearSession();
    router.push('/login');
  }

  function onRowAction(action: KpiGroupRowAction, row: KpiGroupListItem) {
    if (action === 'view' || action === 'edit') {
      router.push(`/crm/kpi/groups/${row.id}${action === 'edit' ? '?edit=1' : ''}`);
      return;
    }
    if (action === 'duplicate') {
      setConfirm({ kind: 'duplicate', row });
      return;
    }
    if (action === 'deactivate') {
      setConfirm({ kind: 'deactivate', row });
      return;
    }
    if (action === 'activate') {
      setConfirm({ kind: 'activate', row });
      return;
    }
    if (action === 'delete') {
      setConfirm({ kind: 'delete', row });
    }
  }

  async function onConfirmDialog(state: NonNullable<KpiGroupConfirmState>) {
    const access = getAccessToken();
    if (!access) return;
    setBusy(true);
    setError('');
    try {
      if (state.kind === 'deactivate') {
        await changeKpiGroupStatus(access, state.row.id, 'INACTIVE');
      } else if (state.kind === 'activate') {
        await changeKpiGroupStatus(access, state.row.id, 'ACTIVE');
      } else if (state.kind === 'delete') {
        if (state.row.usage_count > 0) {
          setConfirm(null);
          return;
        }
        await deleteKpiGroup(access, state.row.id);
      } else if (state.kind === 'duplicate') {
        const suffix = Date.now().toString().slice(-4);
        const code = `${state.row.code}_${suffix}`.slice(0, 50);
        const name = `${state.row.name} — bản sao`.slice(0, 100);
        const created = await duplicateKpiGroup(access, state.row.id, { code, name });
        setConfirm(null);
        router.push(`/crm/kpi/groups/${created.id}`);
        return;
      }
      setConfirm(null);
      await reload(access);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Thao tác thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function onReorder(items: Array<{ id: string; display_order: number }>) {
    const access = getAccessToken();
    if (!access) return;
    setBusy(true);
    setError('');
    try {
      await reorderKpiGroups(access, items);
      await reload(access);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sắp xếp thất bại');
      throw err;
    } finally {
      setBusy(false);
    }
  }

  return (
    <StaffPageShell
      user={user}
      onLogout={logout}
      loading={!user}
      width="wide"
      breadcrumb={[
        { label: 'KPI & Hiệu suất', href: '/crm/kpi' },
        { label: 'Cấu hình' },
        { label: 'Nhóm KPI', href: '/crm/kpi/groups' },
      ]}
    >
      <HubPageLayout
        title="Nhóm KPI"
        subtitle="Chuẩn hóa danh mục phân loại chỉ tiêu và phạm vi áp dụng KPI trong doanh nghiệp."
        actions={
          <div className="kpi-group-list-actions">
            {canConfigure ? (
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                disabled={busy}
                onClick={() => setImportOpen(true)}
              >
                Nhập dữ liệu
              </button>
            ) : null}
            {canManage ? (
              <Link href="/crm/kpi/groups/new" className="btn btn-primary btn-sm">
                + Thêm Nhóm KPI
              </Link>
            ) : null}
          </div>
        }
      >
        <div className="kpi-group-list-layout">
          <div className="kpi-group-list-main stack-gap">
            <KpiGroupSummaryCards summary={summary} loading={loading} />

            <KpiGroupFilterBar
              filters={filters}
              departments={departments}
              onChange={setFilters}
              onSearch={() => {
                setApplied(filters);
                setPage(1);
              }}
              onClear={() => {
                setFilters(DEFAULT_FILTERS);
                setApplied(DEFAULT_FILTERS);
                setPage(1);
              }}
            />

            {loading ? <p className="muted">Đang tải…</p> : null}
            {error ? <p className="error">{error}</p> : null}

            {rows.length ? (
              <>
                <KpiGroupTable
                  rows={rows}
                  canManage={canManage}
                  canReorder={canReorder}
                  busy={busy}
                  onAction={onRowAction}
                  onReorder={onReorder}
                />
                <div className="kpi-group-pagination">
                  <span className="muted">
                    {total.toLocaleString('vi-VN')} nhóm · trang {page}/{totalPages || 1}
                  </span>
                  <div className="kpi-group-pagination__controls">
                    <select
                      className="kpi-group-filter-select"
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value));
                        setPage(1);
                      }}
                      aria-label="Số bản ghi mỗi trang"
                    >
                      {[20, 50, 100].map((n) => (
                        <option key={n} value={n}>
                          {n}/trang
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="btn btn-xs btn-ghost"
                      disabled={page <= 1 || busy}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      Trước
                    </button>
                    <button
                      type="button"
                      className="btn btn-xs btn-ghost"
                      disabled={page >= totalPages || busy}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Sau
                    </button>
                  </div>
                </div>
              </>
            ) : !loading ? (
              <div className="kpi-group-empty">
                <h3>Chưa có Nhóm KPI nào</h3>
                <p>Tạo nhóm KPI để chuẩn hóa cách phân loại chỉ tiêu và báo cáo hiệu suất.</p>
                {canManage ? (
                  <Link href="/crm/kpi/groups/new" className="btn btn-primary btn-sm">
                    Tạo Nhóm KPI đầu tiên
                  </Link>
                ) : null}
              </div>
            ) : null}

            {!canManage ? (
              <p className="muted">Bạn có quyền xem. Cần cap `crm_kpi_groups.manage` để thêm/sửa.</p>
            ) : null}
          </div>
          <KpiGroupTipsPanel />
        </div>
      </HubPageLayout>

      <KpiGroupConfirmDialogs
        state={confirm}
        busy={busy}
        onClose={() => setConfirm(null)}
        onConfirm={(s) => void onConfirmDialog(s)}
      />

      {importOpen && getAccessToken() ? (
        <KpiGroupImportModal
          open={importOpen}
          token={getAccessToken()!}
          busy={busy}
          onClose={() => setImportOpen(false)}
          onImported={() => {
            const access = getAccessToken();
            if (access) void reload(access);
          }}
        />
      ) : null}
    </StaffPageShell>
  );
}
