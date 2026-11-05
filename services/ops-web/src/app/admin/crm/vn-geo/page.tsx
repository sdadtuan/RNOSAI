'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AdminPageShell } from '@/components/admin';
import { SegmentedControl } from '@/components/layout';
import { Form, FormError, FormField, FormFooter, FormInput, FormSelect } from '@/components/form';
import {
  createVnProvince,
  createVnWard,
  deleteVnProvince,
  deleteVnWard,
  fetchVnAdminProvinces,
  fetchVnAdminWards,
  patchVnProvince,
  patchVnWard,
  syncVnAdminGeo,
  type VnProvinceOption,
  type VnWardOption,
} from '@/lib/vn-geo-api';
import { useAdminCrmAuth } from '@/lib/admin/use-admin-crm-auth';
import { hasCap } from '@/lib/auth';

type Tab = 'provinces' | 'wards';
type ModalMode = 'province-create' | 'province-edit' | 'ward-create' | 'ward-edit' | null;

export default function AdminVnGeoPage() {
  const { user, token, error, loading, logout } = useAdminCrmAuth((u) => hasCap(u, 'crm_data_config', 'view'));
  const [tab, setTab] = useState<Tab>('provinces');
  const [provinces, setProvinces] = useState<VnProvinceOption[]>([]);
  const [wards, setWards] = useState<VnWardOption[]>([]);
  const [filterProvince, setFilterProvince] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [msg, setMsg] = useState('');
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [editProvince, setEditProvince] = useState<VnProvinceOption | null>(null);
  const [editWard, setEditWard] = useState<VnWardOption | null>(null);
  const [pCode, setPCode] = useState('');
  const [pName, setPName] = useState('');
  const [wCode, setWCode] = useState('');
  const [wName, setWName] = useState('');
  const [wProvince, setWProvince] = useState('');

  const canConfigure = Boolean(user && hasCap(user, 'crm_data_config', 'configure'));

  const reload = useCallback(async (access: string) => {
    const [p, w] = await Promise.all([fetchVnAdminProvinces(access), fetchVnAdminWards(access, filterProvince || undefined)]);
    setProvinces(p);
    setWards(w);
  }, [filterProvince]);

  useEffect(() => {
    if (!token) return;
    void reload(token).catch((err) => setFormError(err instanceof Error ? err.message : 'Tải thất bại'));
  }, [token, reload]);

  const filteredWards = useMemo(() => {
    if (!filterProvince) return wards;
    return wards.filter((w) => w.province_code === filterProvince);
  }, [wards, filterProvince]);

  async function handleSync() {
    if (!token || !canConfigure) return;
    setBusy(true);
    setFormError('');
    setMsg('');
    try {
      const out = await syncVnAdminGeo(token);
      setMsg(`Đã đồng bộ ${out.provinces} Tỉnh/TP và ${out.wards} Phường/Xã từ nguồn quốc gia.`);
      await reload(token);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Đồng bộ thất bại');
    } finally {
      setBusy(false);
    }
  }

  function openProvinceCreate() {
    setEditProvince(null);
    setEditWard(null);
    setPCode('');
    setPName('');
    setFormError('');
    setModalMode('province-create');
  }

  function openProvinceEdit(row: VnProvinceOption) {
    setEditProvince(row);
    setEditWard(null);
    setPCode(row.code);
    setPName(row.name);
    setFormError('');
    setModalMode('province-edit');
  }

  function openWardCreate() {
    setEditWard(null);
    setEditProvince(null);
    setWCode('');
    setWName('');
    setWProvince(filterProvince || provinces[0]?.code || '');
    setFormError('');
    setModalMode('ward-create');
  }

  function openWardEdit(row: VnWardOption) {
    setEditWard(row);
    setEditProvince(null);
    setWCode(row.code);
    setWName(row.name);
    setWProvince(row.province_code);
    setFormError('');
    setModalMode('ward-edit');
  }

  async function saveModal() {
    if (!token || !canConfigure || !modalMode) return;
    setBusy(true);
    setFormError('');
    try {
      if (modalMode === 'province-edit' && editProvince) {
        await patchVnProvince(token, editProvince.code, { name: pName });
      } else if (modalMode === 'province-create') {
        await createVnProvince(token, { code: pCode.trim(), name: pName.trim() });
      } else if (modalMode === 'ward-edit' && editWard) {
        await patchVnWard(token, editWard.code, { name: wName, province_code: wProvince });
      } else if (modalMode === 'ward-create') {
        await createVnWard(token, {
          code: wCode.trim(),
          province_code: wProvince,
          name: wName.trim(),
        });
      }
      await reload(token);
      setModalMode(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Lưu thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteProvince(code: string) {
    if (!token || !canConfigure || !window.confirm(`Xóa Tỉnh/TP ${code}?`)) return;
    setBusy(true);
    try {
      await deleteVnProvince(token, code);
      await reload(token);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Xóa thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteWard(code: string) {
    if (!token || !canConfigure || !window.confirm(`Xóa Phường/Xã ${code}?`)) return;
    setBusy(true);
    try {
      await deleteVnWard(token, code);
      await reload(token);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Xóa thất bại');
    } finally {
      setBusy(false);
    }
  }

  const modalIsWard = modalMode === 'ward-create' || modalMode === 'ward-edit';

  return (
    <AdminPageShell
      user={user}
      onLogout={logout}
      section="crm-config"
      title="Địa giới hành chính VN"
      subtitle="Tỉnh/Thành phố và Phường/Xã (2 cấp, NQ 202/2025) — dùng cho hồ sơ nhân viên"
      loading={loading}
    >
      {error ? <FormError>{error}</FormError> : null}
      <div className="stack-gap">
        <div className="toolbar-row">
          <SegmentedControl
            value={tab}
            onChange={(v) => setTab(v as Tab)}
            options={[
              { id: 'provinces', label: `Tỉnh/TP (${provinces.length})` },
              { id: 'wards', label: `Phường/Xã (${wards.length})` },
            ]}
          />
          {canConfigure ? (
            <div className="toolbar-row" style={{ marginLeft: 'auto', gap: '0.5rem' }}>
              <button type="button" className="btn btn-sm btn-ghost" disabled={busy} onClick={() => void handleSync()}>
                Đồng bộ toàn quốc
              </button>
              <button
                type="button"
                className="btn btn-sm btn-primary"
                disabled={busy}
                onClick={() => (tab === 'provinces' ? openProvinceCreate() : openWardCreate())}
              >
                {tab === 'provinces' ? '＋ Tỉnh/TP' : '＋ Phường/Xã'}
              </button>
            </div>
          ) : null}
        </div>

        {msg ? <p className="muted">{msg}</p> : null}
        {formError ? <FormError>{formError}</FormError> : null}

        {tab === 'provinces' ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Mã</th>
                  <th>Tên</th>
                  <th>Số PX</th>
                  <th>Nguồn</th>
                  {canConfigure ? <th /> : null}
                </tr>
              </thead>
              <tbody>
                {provinces.map((row) => (
                  <tr key={row.code}>
                    <td className="mono">{row.code}</td>
                    <td>{row.name}</td>
                    <td>{row.ward_count ?? 0}</td>
                    <td className="muted">{row.source}</td>
                    {canConfigure ? (
                      <td className="table-actions">
                        <button type="button" className="btn btn-xs btn-ghost" onClick={() => openProvinceEdit(row)}>
                          Sửa
                        </button>
                        <button type="button" className="btn btn-xs btn-ghost" onClick={() => void handleDeleteProvince(row.code)}>
                          Xóa
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <>
            <FormField label="Lọc theo Tỉnh/TP">
              <FormSelect
                value={filterProvince}
                onChange={(e) => {
                  setFilterProvince(e.target.value);
                  if (token) void reload(token);
                }}
              >
                <option value="">Tất cả</option>
                {provinces.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.name}
                  </option>
                ))}
              </FormSelect>
            </FormField>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Mã</th>
                    <th>Tên</th>
                    <th>Tỉnh/TP</th>
                    <th>Nguồn</th>
                    {canConfigure ? <th /> : null}
                  </tr>
                </thead>
                <tbody>
                  {filteredWards.slice(0, 500).map((row) => (
                    <tr key={row.code}>
                      <td className="mono">{row.code}</td>
                      <td>{row.name}</td>
                      <td>{row.province_name ?? row.province_code}</td>
                      <td className="muted">{row.source}</td>
                      {canConfigure ? (
                        <td className="table-actions">
                          <button type="button" className="btn btn-xs btn-ghost" onClick={() => openWardEdit(row)}>
                            Sửa
                          </button>
                          <button type="button" className="btn btn-xs btn-ghost" onClick={() => void handleDeleteWard(row.code)}>
                            Xóa
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredWards.length > 500 ? (
                <p className="muted">Hiển thị 500/{filteredWards.length} — chọn Tỉnh/TP để lọc.</p>
              ) : null}
            </div>
          </>
        )}
      </div>

      {modalMode ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setModalMode(null)}>
          <Form
            className="modal-card stack-gap"
            onSubmit={(e) => {
              e.preventDefault();
              void saveModal();
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3>
              {modalMode === 'province-edit'
                ? 'Sửa Tỉnh/TP'
                : modalMode === 'province-create'
                  ? 'Thêm Tỉnh/TP'
                  : modalMode === 'ward-edit'
                    ? 'Sửa Phường/Xã'
                    : 'Thêm Phường/Xã'}
            </h3>
            {modalIsWard ? (
              <>
                <FormField label="Tỉnh/TP">
                  <FormSelect value={wProvince} disabled={Boolean(editWard) || busy} onChange={(e) => setWProvince(e.target.value)}>
                    <option value="">— Chọn —</option>
                    {provinces.map((p) => (
                      <option key={p.code} value={p.code}>
                        {p.name}
                      </option>
                    ))}
                  </FormSelect>
                </FormField>
                <FormField label="Mã Phường/Xã">
                  <FormInput value={wCode} disabled={Boolean(editWard) || busy} onChange={(e) => setWCode(e.target.value)} />
                </FormField>
                <FormField label="Tên Phường/Xã">
                  <FormInput value={wName} disabled={busy} onChange={(e) => setWName(e.target.value)} />
                </FormField>
              </>
            ) : (
              <>
                <FormField label="Mã Tỉnh/TP">
                  <FormInput value={pCode} disabled={Boolean(editProvince) || busy} onChange={(e) => setPCode(e.target.value)} />
                </FormField>
                <FormField label="Tên Tỉnh/TP">
                  <FormInput value={pName} disabled={busy} onChange={(e) => setPName(e.target.value)} />
                </FormField>
              </>
            )}
            {formError ? <FormError>{formError}</FormError> : null}
            <FormFooter>
              <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => setModalMode(null)}>
                Hủy
              </button>
              <button type="submit" className="btn btn-primary" disabled={busy}>
                Lưu
              </button>
            </FormFooter>
          </Form>
        </div>
      ) : null}
    </AdminPageShell>
  );
}
