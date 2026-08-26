'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { B2bProjectFormModal, type B2bProjectFormValues } from '@/components/b2b/B2bProjectFormModal';
import {
  FilterBar,
  FilterBarActions,
  FilterBarSearch,
  HubPageLayout,
  SegmentedControl,
  StaffPageShell,
} from '@/components/layout';
import {
  createB2bProject,
  deleteB2bProject,
  fetchB2bProject,
  fetchB2bProjects,
  patchB2bProject,
  type B2bProjectListItem,
} from '@/lib/b2b-projects-api';
import {
  b2bProjectStatusBadgeClass,
  labelB2bProjectStatus,
  type B2bProjectStatus,
} from '@/lib/b2b-project-util';
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

type StatusFilter = 'all' | B2bProjectStatus;
type ModalMode = 'create' | 'edit' | null;

const STATUS_FILTERS: Array<{ id: StatusFilter; label: string }> = [
  { id: 'all', label: 'Tất cả' },
  { id: 'active', label: 'Đang chạy' },
  { id: 'draft', label: 'Nháp' },
  { id: 'paused', label: 'Tạm dừng' },
  { id: 'archived', label: 'Lưu trữ' },
];

export default function CrmB2bProjectsPage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [rows, setRows] = useState<B2bProjectListItem[]>([]);
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [editProject, setEditProject] = useState<B2bProjectListItem | null>(null);

  const canManage = Boolean(user && hasCap(user, 'crm_b2b_projects', 'manage'));

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
      if (!hasCap(me, 'crm_b2b_projects', 'view')) {
        setError('Không có quyền Dự án PTT');
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
      const list = await fetchB2bProjects(access, statusFilter === 'all' ? undefined : statusFilter);
      const needle = query.trim().toLowerCase();
      setRows(
        needle
          ? list.filter(
              (p) =>
                p.name.toLowerCase().includes(needle) ||
                p.code.toLowerCase().includes(needle) ||
                labelB2bProjectStatus(p.status).toLowerCase().includes(needle),
            )
          : list,
      );
    },
    [query, statusFilter],
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
        setError(err instanceof Error ? err.message : 'Tải dự án thất bại');
      } finally {
        setLoading(false);
      }
    })();
  }, [ensureAuth, reload]);

  async function onSaveModal(values: B2bProjectFormValues) {
    const access = getAccessToken();
    if (!access) return;
    setSaving(true);
    setFormError('');
    try {
      if (modalMode === 'create') {
        await createB2bProject(access, {
          code: values.code,
          name: values.name,
          status: values.status,
          manual_ingest_enabled: values.manual_ingest_enabled,
          ai_call_enabled: values.ai_call_enabled,
        });
      } else if (editProject) {
        await patchB2bProject(access, editProject.id, {
          name: values.name,
          status: values.status,
          manual_ingest_enabled: values.manual_ingest_enabled,
          ai_call_enabled: values.ai_call_enabled,
        });
      }
      setModalMode(null);
      setEditProject(null);
      await reload(access);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Lưu dự án thất bại');
    } finally {
      setSaving(false);
    }
  }

  async function openEdit(project: B2bProjectListItem) {
    const access = getAccessToken();
    if (!access) return;
    setFormError('');
    try {
      const detail = await fetchB2bProject(access, project.id);
      setEditProject(detail);
      setModalMode('edit');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tải chi tiết dự án thất bại');
    }
  }

  async function togglePause(project: B2bProjectListItem) {
    const access = getAccessToken();
    if (!access) return;
    const nextStatus: B2bProjectStatus = project.status === 'active' ? 'paused' : 'active';
    const label = nextStatus === 'paused' ? 'tạm dừng' : 'kích hoạt lại';
    if (!window.confirm(`${nextStatus === 'paused' ? 'Dừng' : 'Kích hoạt'} dự án "${project.name}"?`)) return;
    setSaving(true);
    setError('');
    try {
      await patchB2bProject(access, project.id, { status: nextStatus });
      await reload(access);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Không thể ${label} dự án`);
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(project: B2bProjectListItem) {
    if (
      !window.confirm(
        `Xóa dự án "${project.name}" (${project.code})?\nLead gắn dự án sẽ được gỡ liên kết, không xóa lead.`,
      )
    ) {
      return;
    }
    const access = getAccessToken();
    if (!access) return;
    setSaving(true);
    setError('');
    try {
      await deleteB2bProject(access, project.id);
      await reload(access);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xóa dự án thất bại');
    } finally {
      setSaving(false);
    }
  }

  function logout() {
    clearSession();
    router.push('/login');
  }

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    setQuery(q.trim());
  }

  return (
    <StaffPageShell
      user={user}
      onLogout={logout}
      loading={!user}
      width="default"
      breadcrumb={[
        { label: 'CRM', href: '/crm' },
        { label: 'Dự án PTT', href: '/crm/b2b-projects' },
        { label: 'Quản lý' },
      ]}
    >
      <HubPageLayout
        title="Quản lý dự án PTT"
        subtitle={`${rows.length.toLocaleString('vi-VN')} dự án · chủ quản PTT`}
        actions={
          canManage ? (
            <button type="button" className="btn btn-primary btn-sm" disabled={saving} onClick={() => setModalMode('create')}>
              + Thêm dự án
            </button>
          ) : null
        }
      >
        <SegmentedControl
          value={statusFilter}
          options={STATUS_FILTERS.map((f) => ({ id: f.id, label: f.label }))}
          onChange={(v) => setStatusFilter(v)}
        />

        <FilterBar onSubmit={onSearch}>
          <FilterBarSearch value={q} onChange={setQ} placeholder="Tìm tên / mã / trạng thái…" />
          <FilterBarActions>
            <button type="submit" className="btn btn-sm btn-secondary">
              Tìm
            </button>
          </FilterBarActions>
        </FilterBar>

        {loading ? <p className="muted">Đang tải…</p> : null}
        {error ? <p className="error">{error}</p> : null}

        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Tên dự án</th>
                <th>Mã webhook</th>
                <th>Trạng thái</th>
                {canManage ? <th style={{ width: 220 }}>Thao tác</th> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link href={`/crm/b2b-projects/${p.id}`} className="nav-link">
                      {p.name}
                    </Link>
                  </td>
                  <td>
                    <code>{p.code}</code>
                  </td>
                  <td>
                    <span className={b2bProjectStatusBadgeClass(p.status)}>{labelB2bProjectStatus(p.status)}</span>
                  </td>
                  {canManage ? (
                    <td>
                      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                        <button type="button" className="btn btn-xs btn-ghost" disabled={saving} onClick={() => void openEdit(p)}>
                          Sửa
                        </button>
                        {p.status === 'active' ? (
                          <button type="button" className="btn btn-xs btn-ghost" disabled={saving} onClick={() => void togglePause(p)}>
                            Dừng
                          </button>
                        ) : p.status === 'paused' || p.status === 'draft' ? (
                          <button type="button" className="btn btn-xs btn-ghost" disabled={saving} onClick={() => void togglePause(p)}>
                            Kích hoạt
                          </button>
                        ) : null}
                        <button type="button" className="btn btn-xs btn-ghost" disabled={saving} onClick={() => void onDelete(p)}>
                          Xóa
                        </button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {rows.length === 0 && !loading ? <p className="muted">Chưa có dự án PTT. Bấm &quot;Thêm dự án&quot; để tạo mới.</p> : null}

        {!canManage ? <p className="muted">Bạn có quyền xem. Cần cap `crm_b2b_projects.manage` để thêm/sửa/dừng.</p> : null}
      </HubPageLayout>

      {modalMode ? (
        <B2bProjectFormModal
          mode={modalMode}
          initial={modalMode === 'edit' ? editProject : null}
          busy={saving}
          error={formError}
          onClose={() => {
            setModalMode(null);
            setEditProject(null);
            setFormError('');
          }}
          onSubmit={onSaveModal}
        />
      ) : null}
    </StaffPageShell>
  );
}
