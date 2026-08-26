'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AdminPageShell } from '@/components/admin';
import { AdminOrgSubNav } from '@/components/rbac/AdminOrgSubNav';
import { OrgStructureRowActions } from '@/components/rbac/OrgStructureRowActions';
import {
  OrgStructureDescriptionField,
  orgDescriptionPreview,
} from '@/components/rbac/OrgStructureDescriptionField';
import {
  createStaffOrgTeam,
  deleteStaffOrgTeam,
  fetchStaffOrgDepartments,
  fetchStaffOrgTeams,
  patchStaffOrgTeam,
  type StaffDepartmentRow,
  type StaffTeamRow,
} from '@/lib/api';
import { Form, FormError, FormField, FormFooter, FormInput, FormSelect } from '@/components/form';
import {
  canConfigureOrgStructure,
  canViewOrgAdmin,
  useAdminCrmAuth,
} from '@/lib/admin/use-admin-crm-auth';

export default function AdminOrgTeamsPage() {
  const { user, token, error, loading, logout } = useAdminCrmAuth(canViewOrgAdmin);
  const [departments, setDepartments] = useState<StaffDepartmentRow[]>([]);
  const [deptFilter, setDeptFilter] = useState<number | ''>('');
  const [rows, setRows] = useState<StaffTeamRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [departmentId, setDepartmentId] = useState<number | ''>('');

  const canConfigure = canConfigureOrgStructure(user);

  const reload = useCallback(
    async (access: string) => {
      const deptId = deptFilter === '' ? undefined : Number(deptFilter);
      setRows(await fetchStaffOrgTeams(access, deptId));
    },
    [deptFilter],
  );

  useEffect(() => {
    if (!token) return;
    void fetchStaffOrgDepartments(token)
      .then(setDepartments)
      .catch(() => setDepartments([]));
  }, [token]);

  useEffect(() => {
    if (!token) return;
    void reload(token).catch((err) => setFormError(err instanceof Error ? err.message : 'Tải thất bại'));
  }, [token, reload]);

  const deptLabel = useMemo(
    () => Object.fromEntries(departments.map((d) => [d.id, `${d.code} — ${d.name}`])),
    [departments],
  );

  function openCreate() {
    setEditId(null);
    setCode('');
    setName('');
    setDescription('');
    setDepartmentId(deptFilter === '' ? '' : deptFilter);
    setFormError('');
    setModalOpen(true);
  }

  function openEdit(row: StaffTeamRow) {
    setEditId(row.id);
    setCode(row.code);
    setName(row.name);
    setDescription(row.description ?? '');
    setDepartmentId(row.department_id ?? '');
    setFormError('');
    setModalOpen(true);
  }

  async function save() {
    if (!token || !canConfigure) return;
    setBusy(true);
    setFormError('');
    try {
      const payload = {
        code,
        name,
        description,
        department_id: departmentId === '' ? null : Number(departmentId),
      };
      if (editId == null) {
        await createStaffOrgTeam(token, payload);
      } else {
        await patchStaffOrgTeam(token, editId, payload);
      }
      await reload(token);
      setModalOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Lưu thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(row: StaffTeamRow) {
    if (!token || !canConfigure) return;
    setBusy(true);
    setFormError('');
    try {
      await patchStaffOrgTeam(token, row.id, { active: !row.active });
      await reload(token);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Cập nhật thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function remove(row: StaffTeamRow) {
    if (!token || !canConfigure) return;
    setBusy(true);
    setFormError('');
    try {
      await deleteStaffOrgTeam(token, row.id);
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
      title="Team"
      subtitle="Nhóm trong phòng ban"
      breadcrumb={[
        { label: 'Cấu hình CRM', href: '/admin/crm/custom-fields' },
        { label: 'Tổ chức', href: '/admin/crm/org/teams' },
        { label: 'Team' },
      ]}
      loading={loading}
      actions={
        canConfigure ? (
          <button type="button" className="btn btn-primary" onClick={openCreate} disabled={busy}>
            + Team
          </button>
        ) : null
      }
    >
      <AdminOrgSubNav />
      <FormError>{error}</FormError>
      <FormError>{formError}</FormError>

      <div className="win-filter-chips" style={{ marginBottom: '0.75rem' }}>
        <button
          type="button"
          className={`chip${deptFilter === '' ? ' is-active' : ''}`}
          onClick={() => setDeptFilter('')}
        >
          Tất cả phòng
        </button>
        {departments.map((d) => (
          <button
            key={d.id}
            type="button"
            className={`chip${deptFilter === d.id ? ' is-active' : ''}`}
            onClick={() => setDeptFilter(d.id)}
          >
            {d.code}
          </button>
        ))}
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Mã</th>
              <th>Tên</th>
              <th>Mô tả</th>
              <th>Phòng</th>
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
                <td>{row.department_code ?? deptLabel[row.department_id ?? -1] ?? '—'}</td>
                <td>{row.active ? 'Hoạt động' : 'Ngưng'}</td>
                <td>
                  {canConfigure ? (
                    <OrgStructureRowActions
                      active={row.active}
                      busy={busy}
                      entityLabel={`team ${row.code}`}
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
            <h3>{editId == null ? 'Thêm team' : 'Sửa team'}</h3>
            <Form asDiv>
              <FormField label="Mã" htmlFor="team-code">
                <FormInput id="team-code" value={code} onChange={(e) => setCode(e.target.value)} />
              </FormField>
              <FormField label="Tên" htmlFor="team-name">
                <FormInput id="team-name" value={name} onChange={(e) => setName(e.target.value)} />
              </FormField>
              <OrgStructureDescriptionField value={description} onChange={setDescription} />
              <FormField label="Phòng ban" htmlFor="team-dept">
                <FormSelect
                  id="team-dept"
                  value={departmentId === '' ? '' : String(departmentId)}
                  onChange={(e) => setDepartmentId(e.target.value ? Number(e.target.value) : '')}
                >
                  <option value="">—</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.code} — {d.name}
                    </option>
                  ))}
                </FormSelect>
              </FormField>
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
    </AdminPageShell>
  );
}
