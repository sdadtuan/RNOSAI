'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AdminPageShell } from '@/components/admin';
import { AdminOrgSubNav } from '@/components/rbac/AdminOrgSubNav';
import { OrgStructureRowActions } from '@/components/rbac/OrgStructureRowActions';
import {
  OrgStructureDescriptionField,
  orgDescriptionPreview,
} from '@/components/rbac/OrgStructureDescriptionField';
import {
  createStaffOrgPosition,
  deleteStaffOrgPosition,
  fetchStaffOrgPositions,
  fetchStaffOrgTeams,
  patchStaffOrgPosition,
  type StaffOrgPositionRow,
  type StaffTeamRow,
} from '@/lib/api';
import {
  canConfigureData,
  canConfigureOrgStructure,
  canViewOrgAdmin,
  useAdminCrmAuth,
} from '@/lib/admin/use-admin-crm-auth';

export default function AdminOrgPositionsPage() {
  const { user, token, error, loading, logout } = useAdminCrmAuth(canViewOrgAdmin);
  const [teams, setTeams] = useState<StaffTeamRow[]>([]);
  const [rows, setRows] = useState<StaffOrgPositionRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [teamId, setTeamId] = useState<number | ''>('');

  const canConfigure = canConfigureOrgStructure(user) || canConfigureData(user);

  const reload = useCallback(async (access: string) => {
    setRows(await fetchStaffOrgPositions(access));
  }, []);

  useEffect(() => {
    if (!token) return;
    void Promise.all([fetchStaffOrgPositions(token), fetchStaffOrgTeams(token)])
      .then(([positions, teamRows]) => {
        setRows(positions);
        setTeams(teamRows);
      })
      .catch((err) => setFormError(err instanceof Error ? err.message : 'Tải thất bại'));
  }, [token]);

  const teamLabel = useMemo(
    () => Object.fromEntries(teams.map((t) => [t.id, `${t.code} — ${t.name}`])),
    [teams],
  );

  function openCreate() {
    setEditId(null);
    setCode('');
    setName('');
    setDescription('');
    setTeamId('');
    setFormError('');
    setModalOpen(true);
  }

  function openEdit(row: StaffOrgPositionRow) {
    setEditId(row.id);
    setCode(row.code);
    setName(row.name);
    setDescription(row.description ?? '');
    setTeamId(row.team_id ?? '');
    setFormError('');
    setModalOpen(true);
  }

  async function save() {
    if (!token || !canConfigure) return;
    setBusy(true);
    setFormError('');
    try {
      const team = teamId === '' ? null : Number(teamId);
      if (editId == null) {
        await createStaffOrgPosition(token, {
          code: code.trim(),
          name: name.trim(),
          description,
          team_id: team,
        });
      } else {
        await patchStaffOrgPosition(token, editId, {
          name: name.trim(),
          description,
          team_id: team,
        });
      }
      await reload(token);
      setModalOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Lưu thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(row: StaffOrgPositionRow) {
    if (!token || !canConfigure) return;
    setBusy(true);
    setFormError('');
    try {
      await patchStaffOrgPosition(token, row.id, { active: !row.active });
      await reload(token);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Cập nhật thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function remove(row: StaffOrgPositionRow) {
    if (!token || !canConfigure) return;
    setBusy(true);
    setFormError('');
    try {
      await deleteStaffOrgPosition(token, row.id);
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
      title="Chức vụ"
      subtitle="Metadata chức vụ — gắn với Team; ma trận quyền tại Phân quyền → Chức vụ"
      breadcrumb={[
        { label: 'Cấu hình CRM', href: '/admin/crm/custom-fields' },
        { label: 'Tổ chức', href: '/admin/crm/org/positions' },
        { label: 'Chức vụ' },
      ]}
      loading={loading}
      actions={
        canConfigure ? (
          <button type="button" className="btn btn-primary" onClick={openCreate} disabled={busy}>
            + Chức vụ
          </button>
        ) : null
      }
    >
      <AdminOrgSubNav />
      {error ? <p className="form-error">{error}</p> : null}
      {formError ? <p className="form-error">{formError}</p> : null}

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Mã</th>
              <th>Tên</th>
              <th>Mô tả</th>
              <th>Team</th>
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
                <td>{row.team_code ?? teamLabel[row.team_id ?? -1] ?? '—'}</td>
                <td>{row.active ? 'Hoạt động' : 'Ngưng'}</td>
                <td>
                  {canConfigure ? (
                    <OrgStructureRowActions
                      active={row.active}
                      busy={busy}
                      entityLabel={`chức vụ ${row.code}`}
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
            <h3>{editId == null ? 'Thêm chức vụ' : `Sửa chức vụ ${code}`}</h3>
            {editId == null ? (
              <label>
                Mã *
                <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="VD: KD-01" />
              </label>
            ) : (
              <p className="muted" style={{ marginTop: 0 }}>
                Mã: <code>{code}</code> (không đổi sau khi tạo)
              </p>
            )}
            <label>
              Tên *
              <input value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <OrgStructureDescriptionField value={description} onChange={setDescription} />
            <label>
              Team
              <select
                value={teamId === '' ? '' : String(teamId)}
                onChange={(e) => setTeamId(e.target.value ? Number(e.target.value) : '')}
              >
                <option value="">—</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.code} — {t.name}
                    {t.department_code ? ` (${t.department_code})` : ''}
                  </option>
                ))}
              </select>
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

      <p className="muted" style={{ marginTop: '1rem' }}>
        Ma trận quyền theo chức vụ:{' '}
        <Link href="/admin/crm/permissions">Phân quyền → Chức vụ</Link>
      </p>
    </AdminPageShell>
  );
}
