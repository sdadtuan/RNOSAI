'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  applyPricingField,
  archiveSpcComponent,
  createSpcComponent,
  fetchSpcComponents,
  formatPricingModel,
  patchSpcComponent,
  pricingModelFields,
  type SpcComponentRow,
  type SpcPricingModel,
} from '@/lib/spc-api';

export function AdminSpcComponentsTab({
  dvCode,
  token,
  canEdit,
  onChanged,
}: {
  dvCode: string;
  token: string;
  canEdit: boolean;
  onChanged: () => void;
}) {
  const [items, setItems] = useState<SpcComponentRow[]>([]);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [newName, setNewName] = useState('');
  const [editCode, setEditCode] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    name_vi: string;
    description_vi: string;
    deliverable_vi: string;
    pricing: SpcPricingModel;
  } | null>(null);

  const reload = useCallback(async () => {
    setLoadError('');
    try {
      const res = await fetchSpcComponents(token, dvCode);
      setItems(res.items.filter((c) => c.active));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Tải components thất bại');
    }
  }, [token, dvCode]);

  useEffect(() => {
    void reload();
  }, [reload]);

  function startEdit(row: SpcComponentRow) {
    setEditCode(row.component_code);
    setEditForm({
      name_vi: row.name_vi,
      description_vi: row.description_vi,
      deliverable_vi: row.deliverable_vi,
      pricing: row.pricing_model ?? { type: 'one_time', min_vnd: 0, max_vnd: 0 },
    });
  }

  async function saveEdit() {
    if (!editCode || !editForm) return;
    setBusy(true);
    setMsg('');
    try {
      await patchSpcComponent(token, editCode, {
        name_vi: editForm.name_vi,
        description_vi: editForm.description_vi,
        deliverable_vi: editForm.deliverable_vi,
        pricing_model: editForm.pricing,
      });
      setMsg(`Đã cập nhật ${editCode}`);
      setEditCode(null);
      setEditForm(null);
      await reload();
      onChanged();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Lưu thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function addComponent() {
    if (!newName.trim()) return;
    setBusy(true);
    setMsg('');
    try {
      await createSpcComponent(token, {
        dv_code: dvCode,
        name_vi: newName.trim(),
        pricing_model: { type: 'one_time', min_vnd: 0, max_vnd: 0 },
      });
      setNewName('');
      setMsg('Đã thêm dịch vụ con');
      await reload();
      onChanged();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Thêm thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function removeComponent(code: string) {
    if (!confirm(`Ẩn (archive) ${code}?`)) return;
    setBusy(true);
    try {
      await archiveSpcComponent(token, code);
      await reload();
      onChanged();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Archive thất bại');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack-gap" style={{ gap: '1rem' }}>
      {loadError ? <p className="error">{loadError}</p> : null}
      {msg ? <p>{msg}</p> : null}

      {canEdit ? (
        <div className="page-card" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Tên dịch vụ con mới (VD: Thiết kế Logo)"
            style={{ flex: 1, minWidth: 220 }}
            disabled={busy}
          />
          <button type="button" className="btn btn-primary btn-sm" disabled={busy || !newName.trim()} onClick={() => void addComponent()}>
            + Thêm component
          </button>
        </div>
      ) : null}

      {items.map((row) => (
        <div key={row.component_code} className="page-card">
          {editCode === row.component_code && editForm ? (
            <>
              <h4 style={{ margin: '0 0 0.5rem' }}>{row.component_code}</h4>
              <input
                value={editForm.name_vi}
                onChange={(e) => setEditForm({ ...editForm, name_vi: e.target.value })}
                style={{ width: '100%', marginBottom: '0.5rem' }}
                disabled={busy}
              />
              <textarea
                value={editForm.description_vi}
                onChange={(e) => setEditForm({ ...editForm, description_vi: e.target.value })}
                rows={2}
                placeholder="Mô tả"
                style={{ width: '100%', marginBottom: '0.5rem' }}
                disabled={busy}
              />
              <input
                value={editForm.deliverable_vi}
                onChange={(e) => setEditForm({ ...editForm, deliverable_vi: e.target.value })}
                placeholder="Deliverable"
                style={{ width: '100%', marginBottom: '0.5rem' }}
                disabled={busy}
              />
              <div style={{ display: 'grid', gap: '0.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
                {pricingModelFields(editForm.pricing).map((f) => (
                  <label key={f.key}>
                    <span className="muted">{f.label}</span>
                    <input
                      type="number"
                      value={f.value}
                      disabled={busy}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          pricing: applyPricingField(editForm.pricing, f.key, Number(e.target.value)),
                        })
                      }
                      style={{ width: '100%' }}
                    />
                  </label>
                ))}
              </div>
              <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
                <button type="button" className="btn btn-sm" disabled={busy} onClick={() => void saveEdit()}>
                  Lưu
                </button>
                <button type="button" className="btn btn-sm btn-secondary" onClick={() => { setEditCode(null); setEditForm(null); }}>
                  Hủy
                </button>
              </div>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                <div>
                  <strong>{row.component_code}</strong> · {row.name_vi}
                  <p className="muted" style={{ margin: '0.35rem 0 0', fontSize: '0.88rem' }}>
                    {row.description_vi || '—'}
                  </p>
                  {row.deliverable_vi ? (
                    <p className="muted" style={{ margin: '0.25rem 0 0', fontSize: '0.85rem' }}>
                      Deliverable: {row.deliverable_vi}
                    </p>
                  ) : null}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="muted">Khung giá</div>
                  <div>{formatPricingModel(row.pricing_model)}</div>
                </div>
              </div>
              {canEdit ? (
                <div style={{ marginTop: '0.65rem', display: 'flex', gap: '0.5rem' }}>
                  <button type="button" className="btn btn-sm btn-secondary" onClick={() => startEdit(row)}>
                    Sửa
                  </button>
                  <button type="button" className="btn btn-sm btn-secondary" disabled={busy} onClick={() => void removeComponent(row.component_code)}>
                    Ẩn
                  </button>
                </div>
              ) : null}
            </>
          )}
        </div>
      ))}
      {items.length === 0 ? <p className="muted">Chưa có dịch vụ con — thêm component để lắp gói CB/TC/CS.</p> : null}
    </div>
  );
}
