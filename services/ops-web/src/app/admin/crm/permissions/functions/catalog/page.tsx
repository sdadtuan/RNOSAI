'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AdminPageShell } from '@/components/admin';
import { AdminPermissionsSubNav } from '@/components/rbac/AdminPermissionsSubNav';
import { OrgStructureRowActions } from '@/components/rbac/OrgStructureRowActions';
import {
  OrgStructureDescriptionField,
  orgDescriptionPreview,
} from '@/components/rbac/OrgStructureDescriptionField';
import {
  createStaffJobFunction,
  deleteStaffJobFunction,
  fetchStaffJobFunctions,
  patchStaffJobFunctionMeta,
  staffMe,
  staffRefresh,
  type StaffJobFunctionSummary,
} from '@/lib/api';
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

export default function AdminJobFunctionCatalogPage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [rows, setRows] = useState<StaffJobFunctionSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editCode, setEditCode] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [departmentScope, setDepartmentScope] = useState('All');
  const [sortOrder, setSortOrder] = useState('100');

  const canConfigure = hasCap(user, 'crm_data_config', 'configure');

  const logout = useCallback(() => {
    clearSession();
    router.push('/login');
  }, [router]);

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
      if (!hasCap(me, 'crm_data_config', 'view')) {
        setFormError('Không có quyền xem catalog job function');
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

  const reload = useCallback(async (access: string) => {
    setRows(await fetchStaffJobFunctions(access));
  }, []);

  useEffect(() => {
    void (async () => {
      const access = await ensureAuth();
      if (!access) return;
      try {
        await reload(access);
      } catch (err) {
        setFormError(err instanceof Error ? err.message : 'Tải catalog thất bại');
      }
    })();
  }, [ensureAuth, reload]);

  function openCreate() {
    setEditCode(null);
    setCode('');
    setLabel('');
    setDescription('');
    setDepartmentScope('All');
    setSortOrder('100');
    setFormError('');
    setModalOpen(true);
  }

  function openEdit(row: StaffJobFunctionSummary) {
    setEditCode(row.code);
    setCode(row.code);
    setLabel(row.label);
    setDescription(row.description ?? '');
    setDepartmentScope(row.department_scope || 'All');
    setSortOrder(String(row.sort_order ?? 100));
    setFormError('');
    setModalOpen(true);
  }

  async function save() {
    const access = getAccessToken();
    if (!access || !canConfigure) return;
    setBusy(true);
    setFormError('');
    try {
      const sort = Number(sortOrder);
      if (editCode == null) {
        await createStaffJobFunction(access, {
          code: code.trim(),
          label: label.trim(),
          description,
          department_scope: departmentScope.trim() || 'All',
          sort_order: Number.isFinite(sort) ? sort : 100,
        });
      } else {
        await patchStaffJobFunctionMeta(access, editCode, {
          label: label.trim(),
          description,
          department_scope: departmentScope.trim() || 'All',
          sort_order: Number.isFinite(sort) ? sort : 100,
        });
      }
      await reload(access);
      setModalOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Lưu thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(row: StaffJobFunctionSummary) {
    const access = getAccessToken();
    if (!access || !canConfigure) return;
    setBusy(true);
    setFormError('');
    try {
      await patchStaffJobFunctionMeta(access, row.code, { active: !row.active });
      await reload(access);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Cập nhật thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function remove(row: StaffJobFunctionSummary) {
    const access = getAccessToken();
    if (!access || !canConfigure) return;
    setBusy(true);
    setFormError('');
    try {
      await deleteStaffJobFunction(access, row.code);
      await reload(access);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Xóa thất bại');
    } finally {
      setBusy(false);
    }
  }

  if (!user) {
    return (
      <AdminPageShell user={null} onLogout={logout} section="crm-config" title="Catalog job function" loading>
        <span />
      </AdminPageShell>
    );
  }

  return (
    <AdminPageShell
      user={user}
      onLogout={logout}
      section="crm-config"
      title="Catalog job function"
      subtitle="Quản lý danh mục vai trò chuyên môn — add-on RBAC cộng vào chức vụ"
      actions={
        canConfigure ? (
          <button type="button" className="btn btn-primary" onClick={openCreate} disabled={busy}>
            + Job function
          </button>
        ) : null
      }
    >
      <AdminPermissionsSubNav />
      {formError ? <p className="form-error">{formError}</p> : null}

      <div className="win-info-callout" style={{ marginBottom: '1rem' }}>
        Catalog lưu trong PostgreSQL. Gán cho NV tại{' '}
        <Link href="/admin/crm/org/users">Tổ chức → Nhân viên</Link>. Ma trận quyền add-on tại{' '}
        <Link href="/admin/crm/permissions/functions">Ma trận job function</Link>.
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Mã</th>
              <th>Tên hiển thị</th>
              <th>Mô tả</th>
              <th>Phạm vi phòng</th>
              <th>TT</th>
              <th>Ma trận</th>
              <th>Trạng thái</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.code}>
                <td>
                  <code>{row.code}</code>
                </td>
                <td>{row.label}</td>
                <td className="muted" title={row.description || undefined}>
                  {orgDescriptionPreview(row.description)}
                </td>
                <td className="muted">{row.department_scope || '—'}</td>
                <td>{row.sort_order}</td>
                <td>
                  <Link href={`/admin/crm/permissions/functions?fn=${encodeURIComponent(row.code)}`}>
                    {row.grants_customized ? 'Đã tùy chỉnh' : 'Mặc định'}
                  </Link>
                </td>
                <td>{row.active ? 'Hoạt động' : 'Ngưng'}</td>
                <td>
                  {canConfigure ? (
                    <OrgStructureRowActions
                      active={row.active}
                      busy={busy}
                      entityLabel={`job function ${row.code}`}
                      onEdit={() => openEdit(row)}
                      onToggleActive={() => void toggleActive(row)}
                      onDelete={() => void remove(row)}
                    />
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalOpen ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setModalOpen(false)}>
          <div className="modal-card" role="dialog" onClick={(e) => e.stopPropagation()}>
            <h3>{editCode == null ? 'Thêm job function' : `Sửa ${code}`}</h3>
            {editCode == null ? (
              <label>
                Mã *
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="VD: video-editor"
                />
              </label>
            ) : (
              <p className="muted" style={{ marginTop: 0 }}>
                Mã: <code>{code}</code> (không đổi sau khi tạo)
              </p>
            )}
            <label>
              Tên hiển thị *
              <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="VD: Video Editor" />
            </label>
            <OrgStructureDescriptionField value={description} onChange={setDescription} />
            <label>
              Phạm vi phòng ban
              <input
                value={departmentScope}
                onChange={(e) => setDepartmentScope(e.target.value)}
                placeholder="All hoặc DEPT-SALES, DEPT-AGENCY"
              />
            </label>
            <label>
              Thứ tự sắp xếp
              <input
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                min={0}
              />
            </label>
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setModalOpen(false)}>
                Hủy
              </button>
              <button type="button" className="btn btn-primary" onClick={() => void save()} disabled={busy}>
                Lưu
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </AdminPageShell>
  );
}
