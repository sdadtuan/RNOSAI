'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchSpcComponents,
  fetchSpcOfferBundle,
  formatPricingModel,
  putSpcOfferBundle,
  type SpcComponentRow,
  type SpcOfferRow,
} from '@/lib/spc-api';

export function AdminSpcBundleTab({
  dvCode,
  offers,
  token,
  canEdit,
}: {
  dvCode: string;
  offers: SpcOfferRow[];
  token: string;
  canEdit: boolean;
}) {
  const [components, setComponents] = useState<SpcComponentRow[]>([]);
  const [selectedSku, setSelectedSku] = useState('');
  const [included, setIncluded] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [loadError, setLoadError] = useState('');

  const skus = useMemo(() => offers.map((o) => o.sku_code), [offers]);

  useEffect(() => {
    if (skus.length && !selectedSku) setSelectedSku(skus[0]);
  }, [skus, selectedSku]);

  const reloadComponents = useCallback(async () => {
    try {
      const res = await fetchSpcComponents(token, dvCode);
      setComponents(res.items.filter((c) => c.active));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Tải components thất bại');
    }
  }, [token, dvCode]);

  const reloadBundle = useCallback(async () => {
    if (!selectedSku) return;
    try {
      const bundle = await fetchSpcOfferBundle(token, selectedSku);
      const map: Record<string, boolean> = {};
      for (const c of components) map[c.component_code] = false;
      for (const item of bundle.items) {
        if (item.included) map[item.component_code] = true;
      }
      setIncluded(map);
    } catch {
      const map: Record<string, boolean> = {};
      for (const c of components) map[c.component_code] = false;
      setIncluded(map);
    }
  }, [token, selectedSku, components]);

  useEffect(() => {
    void reloadComponents();
  }, [reloadComponents]);

  useEffect(() => {
    if (components.length && selectedSku) void reloadBundle();
  }, [components, selectedSku, reloadBundle]);

  async function saveBundle() {
    if (!selectedSku) return;
    setBusy(true);
    setMsg('');
    try {
      const items = components.map((c, i) => ({
        component_code: c.component_code,
        included: Boolean(included[c.component_code]),
        qty: 1,
        sort_order: i + 1,
      }));
      await putSpcOfferBundle(token, selectedSku, items);
      setMsg(`Đã lưu bundle ${selectedSku}`);
      await reloadBundle();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Lưu bundle thất bại');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack-gap" style={{ gap: '1rem' }}>
      {loadError ? <p className="error">{loadError}</p> : null}
      {msg ? <p>{msg}</p> : null}

      <div className="page-card">
        <label>
          Gói SKU{' '}
          <select
            value={selectedSku}
            onChange={(e) => setSelectedSku(e.target.value)}
            style={{ marginLeft: '0.5rem' }}
          >
            {skus.map((sku) => (
              <option key={sku} value={sku}>
                {sku}
              </option>
            ))}
          </select>
        </label>
        <p className="muted" style={{ margin: '0.5rem 0 0', fontSize: '0.88rem' }}>
          Tick dịch vụ con gồm trong gói {selectedSku || '—'}.
        </p>
      </div>

      {components.map((c) => (
        <label
          key={c.component_code}
          className="page-card"
          style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', cursor: canEdit ? 'pointer' : 'default' }}
        >
          <input
            type="checkbox"
            checked={Boolean(included[c.component_code])}
            disabled={!canEdit || busy}
            onChange={(e) => setIncluded((prev) => ({ ...prev, [c.component_code]: e.target.checked }))}
            style={{ marginTop: '0.25rem' }}
          />
          <div>
            <strong>{c.component_code}</strong> · {c.name_vi}
            <div className="muted" style={{ fontSize: '0.85rem' }}>{formatPricingModel(c.pricing_model)}</div>
          </div>
        </label>
      ))}

      {components.length === 0 ? (
        <p className="muted">Thêm dịch vụ con ở tab Components trước khi lắp bundle.</p>
      ) : null}

      {canEdit && components.length > 0 ? (
        <button type="button" className="btn btn-primary btn-sm" disabled={busy || !selectedSku} onClick={() => void saveBundle()}>
          Lưu bundle {selectedSku}
        </button>
      ) : null}
    </div>
  );
}
