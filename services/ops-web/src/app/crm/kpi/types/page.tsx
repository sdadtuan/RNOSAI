'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { KpiTypeConfirmDialogs, type KpiTypeConfirmState } from '@/components/kpi-types/KpiTypeConfirmDialogs';
import { KpiTypeFilterBar, type KpiTypeFilters } from '@/components/kpi-types/KpiTypeFilterBar';
import { KpiTypeSummaryCards } from '@/components/kpi-types/KpiTypeSummaryCards';
import { KpiTypeTable, type KpiTypeRowAction } from '@/components/kpi-types/KpiTypeTable';
import { KpiTypeTipsPanel } from '@/components/kpi-types/KpiTypeTipsPanel';
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
import { staffMe, staffRefresh } from '@/lib/api';
import { fetchKpiGroups, type KpiGroupListItem } from '@/lib/kpi-groups-api';
import {
  changeKpiTypeStatus,
  deleteKpiType,
  duplicateKpiType,
  fetchKpiTypeSummary,
  fetchKpiTypes,
  type KpiTypeListItem,
  type KpiTypeSummary,
} from '@/lib/kpi-types-api';

const DEFAULT_FILTERS: KpiTypeFilters = {
  q: '',
  status: '',
  kpi_group_id: '',
  calculation_mode: '',
  direction: '',
};

export default function KpiTypesListPage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [rows, setRows] = useState<KpiTypeListItem[]>([]);
  const [summary, setSummary] = useState<KpiTypeSummary | null>(null);
  const [groups, setGroups] = useState<KpiGroupListItem[]>([]);
  const [filters, setFilters] = useState<KpiTypeFilters>(DEFAULT_FILTERS);
  const [applied, setApplied] = useState<KpiTypeFilters>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState<KpiTypeConfirmState>(null);

  const canManage = Boolean(user && hasCap(user, 'crm_kpi_types', 'manage'));

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
      if (!hasCap(me, 'crm_kpi_types', 'view')) {
        setError('Không có quyền xem KPI Type');
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
      const [list, sum, groupRes] = await Promise.all([
        fetchKpiTypes(access, {
          page,
          page_size: pageSize,
          q: applied.q || undefined,
          status: applied.status || undefined,
          kpi_group_id: applied.kpi_group_id || undefined,
          calculation_mode: applied.calculation_mode || undefined,
          direction: applied.direction || undefined,
          sort: 'display_order:asc',
        }),
        fetchKpiTypeSummary(access).catch(() => ({ total: 0, active: 0, draft: 0, auto: 0 })),
        fetchKpiGroups(access, { status: 'ACTIVE', page_size: 100 }).catch(() => ({ data: [] })),
      ]);
      setRows(list.data);
      setTotal(list.meta.total);
      setTotalPages(list.meta.total_pages);
      setSummary(sum);
      setGroups(groupRes.data);
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
        setError(err instanceof Error ? err.message : 'Tải danh sách KPI Type thất bại');
      } finally {
        setLoading(false);
      }
    })();
  }, [ensureAuth, reload]);

  function onRowAction(action: KpiTypeRowAction, row: KpiTypeListItem) {
    if (action === 'view' || action === 'edit') {
      router.push(`/crm/kpi/types/${row.id}${action === 'edit' ? '?edit=1' : ''}`);
      return;
    }
    setConfirm({ kind: action, row });
  }

  async function onConfirmDialog(state: NonNullable<KpiTypeConfirmState>) {
    if (state.kind === 'apply-group' || !('row' in state)) return;
    const access = getAccessToken();
    if (!access) return;
    setBusy(true);
    setError('');
    try {
      if (state.kind === 'deactivate') await changeKpiTypeStatus(access, state.row.id, 'INACTIVE');
      else if (state.kind === 'activate') await changeKpiTypeStatus(access, state.row.id, 'ACTIVE');
      else if (state.kind === 'delete') {
        if (state.row.usage_count > 0) {
          setConfirm(null);
          return;
        }
        await deleteKpiType(access, state.row.id);
      } else if (state.kind === 'duplicate') {
        const suffix = Date.now().toString().slice(-4);
        const created = await duplicateKpiType(access, state.row.id, {
          code: `${state.row.code}_${suffix}`.slice(0, 80),
          name: `${state.row.name} — bản sao`.slice(0, 150),
        });
        setConfirm(null);
        router.push(`/crm/kpi/types/${created.id}`);
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

  return (
    <StaffPageShell
      user={user}
      onLogout={() => {
        clearSession();
        router.push('/login');
      }}
      loading={!user}
      width="wide"
      breadcrumb={[
        { label: 'KPI & Hiệu suất', href: '/crm/kpi' },
        { label: 'Cấu hình' },
        { label: 'KPI Type', href: '/crm/kpi/types' },
      ]}
    >
      <HubPageLayout
        title="Thiết lập KPI Type"
        subtitle="Chuẩn hóa loại chỉ tiêu, công thức và nguồn dữ liệu dùng cho KPI trong doanh nghiệp."
        actions={
          canManage ? (
            <Link href="/crm/kpi/types/new" className="btn btn-primary btn-sm">
              + Thêm KPI Type
            </Link>
          ) : null
        }
      >
        <div className="kpi-type-list-layout">
          <div className="kpi-type-list-main stack-gap">
            <KpiTypeSummaryCards summary={summary} loading={loading} />
            <KpiTypeFilterBar
              filters={filters}
              groups={groups.map((g) => ({ id: g.id, name: g.name, code: g.code, color: g.color }))}
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
                <KpiTypeTable rows={rows} canManage={canManage} busy={busy} onAction={onRowAction} />
                <div className="kpi-type-pagination">
                  <span className="muted">
                    {total.toLocaleString('vi-VN')} loại · trang {page}/{totalPages || 1}
                  </span>
                  <div className="kpi-type-pagination__controls">
                    <select
                      className="kpi-type-filter-select"
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value));
                        setPage(1);
                      }}
                    >
                      {[20, 50, 100].map((n) => (
                        <option key={n} value={n}>
                          {n}/trang
                        </option>
                      ))}
                    </select>
                    <button type="button" className="btn btn-xs btn-ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                      Trước
                    </button>
                    <button
                      type="button"
                      className="btn btn-xs btn-ghost"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Sau
                    </button>
                  </div>
                </div>
              </>
            ) : !loading ? (
              <div className="kpi-type-empty">
                <h3>Chưa có KPI Type nào</h3>
                <p>Tạo loại chỉ tiêu để chuẩn hóa công thức và nguồn dữ liệu.</p>
                {canManage ? (
                  <Link href="/crm/kpi/types/new" className="btn btn-primary btn-sm">
                    Tạo KPI Type đầu tiên
                  </Link>
                ) : null}
              </div>
            ) : null}
          </div>
          <KpiTypeTipsPanel />
        </div>
      </HubPageLayout>
      <KpiTypeConfirmDialogs state={confirm} busy={busy} onClose={() => setConfirm(null)} onConfirm={(s) => void onConfirmDialog(s)} />
    </StaffPageShell>
  );
}
