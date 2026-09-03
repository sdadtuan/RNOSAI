'use client';

import { useState } from 'react';
import { createKpiMetric } from '@/lib/api';

type KpiCreateMetricDrawerProps = {
  open: boolean;
  token: string;
  onClose: () => void;
  onCreated: () => void;
};

export function KpiCreateMetricDrawer({
  open,
  token,
  onClose,
  onCreated,
}: KpiCreateMetricDrawerProps) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [unit, setUnit] = useState('');
  const [higherIsBetter, setHigherIsBetter] = useState(true);
  const [warnRatio, setWarnRatio] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  if (!open) return null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setErr('Thiếu tên chỉ tiêu');
      return;
    }
    setBusy(true);
    setErr('');
    try {
      const wrRaw = warnRatio.trim();
      const wr = wrRaw === '' ? undefined : Number(wrRaw);
      await createKpiMetric(token, {
        name: trimmedName,
        code: code.trim() || undefined,
        unit: unit.trim() || undefined,
        higher_is_better: higherIsBetter,
        warn_ratio: wr == null || Number.isFinite(wr) ? (wr ?? null) : null,
      });
      setName('');
      setCode('');
      setUnit('');
      setHigherIsBetter(true);
      setWarnRatio('');
      onCreated();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Không tạo được chỉ tiêu');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="kpi-cockpit-drawer" role="presentation">
      <aside className="kpi-insight" role="dialog" aria-modal="true" aria-labelledby="kpi-create-metric-title">
        <div className="kpi-cockpit-drawer__head">
          <h2 id="kpi-create-metric-title">Tạo chỉ tiêu KPI</h2>
          <button type="button" className="btn btn-sm btn-secondary" onClick={onClose}>
            Đóng
          </button>
        </div>
        <form className="kpi-cockpit-drawer__form" onSubmit={(e) => void onSubmit(e)}>
          {err ? (
            <p className="kpi-cockpit-drawer__err" role="alert">
              {err}
            </p>
          ) : null}
          <label>
            Tên
            <input
              className="kpi-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={busy}
            />
          </label>
          <label>
            Mã
            <input
              className="kpi-input"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              disabled={busy}
            />
          </label>
          <label>
            Đơn vị
            <input
              className="kpi-input"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              disabled={busy}
            />
          </label>
          <label className="kpi-cockpit-drawer__check">
            <input
              type="checkbox"
              checked={higherIsBetter}
              onChange={(e) => setHigherIsBetter(e.target.checked)}
              disabled={busy}
            />
            Cao hơn càng tốt
          </label>
          <label>
            warn_ratio
            <input
              className="kpi-input"
              type="number"
              step="any"
              value={warnRatio}
              onChange={(e) => setWarnRatio(e.target.value)}
              disabled={busy}
            />
          </label>
          <button type="submit" className="btn btn-sm btn-primary" disabled={busy}>
            {busy ? 'Đang tạo…' : 'Tạo chỉ tiêu'}
          </button>
        </form>
      </aside>
    </div>
  );
}

export default KpiCreateMetricDrawer;
