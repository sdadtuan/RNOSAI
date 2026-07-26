'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { OpsNav } from '@/components/OpsNav';
import {
  createCrmCustomField,
  deleteCrmCustomField,
  fetchCrmCustomFields,
  staffMe,
  staffRefresh,
  updateCrmCustomField,
  type CrmCustomFieldDef,
  type CrmCustomFieldEntityType,
  type CrmCustomFieldType,
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

const ENTITY_TYPES: CrmCustomFieldEntityType[] = ['lead', 'customer', 'case'];
const FIELD_TYPES: CrmCustomFieldType[] = ['text', 'number', 'select', 'date', 'boolean'];

export default function AdminCrmCustomFieldsPage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [entityFilter, setEntityFilter] = useState<CrmCustomFieldEntityType | 'all'>('all');
  const [rows, setRows] = useState<CrmCustomFieldDef[]>([]);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    entity_type: 'lead' as CrmCustomFieldEntityType,
    field_key: '',
    label: '',
    field_type: 'text' as CrmCustomFieldType,
    options: '',
    required: false,
  });

  const canConfigure = hasCap(user, 'crm_data_config', 'configure');

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
        setError('Không có quyền CRM data config');
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
      const data = await fetchCrmCustomFields(
        access,
        entityFilter === 'all' ? undefined : { entity_type: entityFilter },
      );
      setRows(data.fields);
    },
    [entityFilter],
  );

  useEffect(() => {
    void (async () => {
      const access = await ensureAuth();
      if (!access) return;
      try {
        await reload(access);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải custom fields thất bại');
      }
    })();
  }, [ensureAuth, reload]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const access = getAccessToken();
    if (!access || !canConfigure) return;
    setBusy(true);
    setError('');
    setMsg('');
    try {
      await createCrmCustomField(access, {
        ...form,
        options: form.options
          .split(',')
          .map((v) => v.trim())
          .filter(Boolean),
      });
      setForm({ entity_type: 'lead', field_key: '', label: '', field_type: 'text', options: '', required: false });
      await reload(access);
      setMsg('Đã tạo custom field');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tạo custom field thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(row: CrmCustomFieldDef) {
    const access = getAccessToken();
    if (!access || !canConfigure) return;
    setBusy(true);
    setError('');
    try {
      await updateCrmCustomField(access, row.id, { active: !row.active });
      await reload(access);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cập nhật thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: number) {
    const access = getAccessToken();
    if (!access || !canConfigure) return;
    if (!window.confirm('Xóa custom field này?')) return;
    setBusy(true);
    setError('');
    try {
      await deleteCrmCustomField(access, id);
      await reload(access);
      setMsg('Đã xóa custom field');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xóa thất bại');
    } finally {
      setBusy(false);
    }
  }

  if (!user) {
    return (
      <main style={{ padding: '2rem' }}>
        <p className="muted">Đang tải…</p>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 1100, margin: '0 auto', padding: '1.5rem' }}>
      <OpsNav user={user} onLogout={() => { clearSession(); router.push('/login'); }} />
      <div className="card">
        <h2 style={{ margin: '0 0 0.35rem', fontSize: '1.15rem' }}>Custom fields</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Định nghĩa trường mở rộng cho lead / customer / case (RNOS-35)
        </p>
        {error ? <p className="error">{error}</p> : null}
        {msg ? <p className="muted">{msg}</p> : null}

        <div className="kpi-page__filters" style={{ marginBottom: '1rem' }}>
          <label className="muted">
            Entity
            <select
              className="kpi-select"
              value={entityFilter}
              onChange={(e) => setEntityFilter(e.target.value as CrmCustomFieldEntityType | 'all')}
            >
              <option value="all">Tất cả</option>
              {ENTITY_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
        </div>

        {canConfigure ? (
          <form onSubmit={(e) => void handleCreate(e)} className="admin-crm-form">
            <h3 className="kpi-section-title">Thêm field</h3>
            <div className="admin-crm-form__grid">
              <select
                className="kpi-select"
                value={form.entity_type}
                onChange={(e) => setForm({ ...form, entity_type: e.target.value as CrmCustomFieldEntityType })}
              >
                {ENTITY_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              <input
                className="kpi-input"
                placeholder="field_key"
                value={form.field_key}
                onChange={(e) => setForm({ ...form, field_key: e.target.value })}
                required
              />
              <input
                className="kpi-input"
                placeholder="Nhãn hiển thị"
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                required
              />
              <select
                className="kpi-select"
                value={form.field_type}
                onChange={(e) => setForm({ ...form, field_type: e.target.value as CrmCustomFieldType })}
              >
                {FIELD_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              <input
                className="kpi-input"
                placeholder="Options (select, cách nhau bởi dấu phẩy)"
                value={form.options}
                onChange={(e) => setForm({ ...form, options: e.target.value })}
              />
              <label className="admin-crm-checkbox">
                <input
                  type="checkbox"
                  checked={form.required}
                  onChange={(e) => setForm({ ...form, required: e.target.checked })}
                />
                Bắt buộc
              </label>
            </div>
            <button type="submit" className="btn btn-sm" disabled={busy}>
              {busy ? 'Đang lưu…' : 'Thêm field'}
            </button>
          </form>
        ) : (
          <p className="muted">Chế độ chỉ xem — cần quyền configure để sửa.</p>
        )}

        <div className="crm-leads-table-wrap" style={{ marginTop: '1.25rem' }}>
          <table className="perf-table">
            <thead>
              <tr>
                <th>Entity</th>
                <th>Key</th>
                <th>Nhãn</th>
                <th>Loại</th>
                <th>Active</th>
                {canConfigure ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={canConfigure ? 6 : 5} className="muted">
                    Chưa có custom field
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.entity_type}</td>
                    <td>{row.field_key}</td>
                    <td>{row.label}</td>
                    <td>{row.field_type}</td>
                    <td>{row.active ? 'Có' : 'Ẩn'}</td>
                    {canConfigure ? (
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button type="button" className="btn btn-sm btn-secondary" onClick={() => void toggleActive(row)}>
                          {row.active ? 'Ẩn' : 'Bật'}
                        </button>{' '}
                        <button type="button" className="btn btn-sm btn-secondary" onClick={() => void handleDelete(row.id)}>
                          Xóa
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
