'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AdminPageShell } from '@/components/admin';
import { AdminOrgSubNav } from '@/components/rbac/AdminOrgSubNav';
import { OrgStructureRowActions } from '@/components/rbac/OrgStructureRowActions';
import {
  OrgStructureDescriptionField,
  orgDescriptionPreview,
} from '@/components/rbac/OrgStructureDescriptionField';
import {
  createStaffOrgDepartment,
  deleteStaffOrgDepartment,
  fetchStaffOrgDepartments,
  patchStaffOrgDepartment,
  type StaffDepartmentRow,
} from '@/lib/api';
import { Form, FormError, FormField, FormFooter, FormInput } from '@/components/form';
import {
  canConfigureOrgStructure,
  canViewOrgAdmin,
  useAdminCrmAuth,
} from '@/lib/admin/use-admin-crm-auth';

export default function AdminOrgDepartmentsPage() {
  const { user, token, error, loading, logout } = useAdminCrmAuth(canViewOrgAdmin);
  const [rows, setRows] = useState<StaffDepartmentRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const canConfigure = canConfigureOrgStructure(user);

  const reload = useCallback(async (access: string) => {
    setRows(await fetchStaffOrgDepartments(access));
  }, []);

  useEffect(() => {
    if (!token) return;
    void reload(token).catch((err) => setFormError(err instanceof Error ? err.message : 'Tải thất bại'));
  }, [token, reload]);

  function openCreate() {
    setEditId(null);
    setCode('');
    setName('');
    setDescription('');
    setFormError('');
    setModalOpen(true);
  }

  function openEdit(row: StaffDepartmentRow) {
    setEditId(row.id);
    setCode(row.code);
    setName(row.name);
    setDescription(row.description ?? '');
    setFormError('');
    setModalOpen(true);
  }

  async function save() {
    if (!token || !canConfigure) return;
    setBusy(true);
    setFormError('');
    try {
      if (editId == null) {
        await createStaffOrgDepartment(token, { code, name, description });
      } else {
        await patchStaffOrgDepartment(token, editId, { code, name, description });
      }
      await reload(token);
      setModalOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Lưu thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(row: StaffDepartmentRow) {
    if (!token || !canConfigure) return;
    setBusy(true);
    setFormError('');
    try {
      await patchStaffOrgDepartment(token, row.id, { active: !row.active });
      await reload(token);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Cập nhật thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function remove(row: StaffDepartmentRow) {
    if (!token || !canConfigure) return;
    setBusy(true);
    setFormError('');
    try {
      await deleteStaffOrgDepartment(token, row.id);
      await reload(token);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Xóa thất bại');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminPageShell
      user={user}
      onLogout={logout}
      section="crm-config"
      title="Phòng ban"
      subtitle="Cấu trúc tổ chức — WIN-2 Org"
      breadcrumb={[
        { label: 'Cấu hình CRM', href: '/admin/crm/custom-fields' },
        { label: 'Tổ chức', href: '/admin/crm/org/departments' },
        { label: 'Phòng ban' },
      ]}
      loading={loading}
      actions={
        canConfigure ? (
          <button type="button" className="btn btn-primary" onClick={openCreate} disabled={busy}>
            + Phòng ban
          </button>
        ) : null
      }
    >
      <AdminOrgSubNav />
      <FormError>{error}</FormError>
      <FormError>{formError}</FormError>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Mã</th>
              <th>Tên</th>
              <th>Mô tả</th>
              <th>Trạng thái</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.code}</td>
                <td>{row.name}</td>
                <td className="muted" title={row.description || undefined}>
                  {orgDescriptionPreview(row.description)}
                </td>
                <td>{row.active ? 'Hoạt động' : 'Ngưng'}</td>
                <td>
                  {canConfigure ? (
                    <OrgStructureRowActions
                      active={row.active}
                      busy={busy}
                      entityLabel={`phòng ban ${row.code}`}
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
          <div
            className="modal-card"
            role="dialog"
            aria-labelledby="dept-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="dept-modal-title">{editId == null ? 'Thêm phòng ban' : 'Sửa phòng ban'}</h3>
            <Form asDiv>
              <FormField label="Mã" htmlFor="dept-code">
                <FormInput id="dept-code" value={code} onChange={(e) => setCode(e.target.value)} />
              </FormField>
              <FormField label="Tên" htmlFor="dept-name">
                <FormInput id="dept-name" value={name} onChange={(e) => setName(e.target.value)} />
              </FormField>
              <OrgStructureDescriptionField value={description} onChange={setDescription} />
            </Form>
            <FormFooter className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setModalOpen(false)}>
                Hủy
              </button>
              <button type="button" className="btn btn-primary" onClick={save} disabled={busy}>
                Lưu
              </button>
            </FormFooter>
          </div>
        </div>
      ) : null}

      <p className="muted" style={{ marginTop: '1rem' }}>
        Gán quyền chi tiết:{' '}
        <Link href="/admin/crm/permissions/users">Phân quyền → Gán user</Link>
      </p>
    </AdminPageShell>
  );
}
