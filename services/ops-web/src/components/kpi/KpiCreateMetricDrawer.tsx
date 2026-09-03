'use client';

import { useEffect, useState } from 'react';
import { createKpiMetric } from '@/lib/api';
import { fetchKpiGroups, type KpiGroupListItem } from '@/lib/kpi-groups-api';
import { fetchKpiTypes, type KpiTypeListItem } from '@/lib/kpi-types-api';

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
  const [groupId, setGroupId] = useState('');
  const [kpiTypeId, setKpiTypeId] = useState('');
  const [groups, setGroups] = useState<KpiGroupListItem[]>([]);
  const [types, setTypes] = useState<KpiTypeListItem[]>([]);
  const [higherIsBetter, setHigherIsBetter] = useState(true);
  const [warnRatio, setWarnRatio] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!open || !token) return;
    void (async () => {
      try {
        const [res, typeRes] = await Promise.all([
          fetchKpiGroups(token, { status: 'ACTIVE', page_size: 100, sort: 'display_order:asc' }),
          fetchKpiTypes(token, { status: 'ACTIVE', page_size: 100, sort: 'display_order:asc' }).catch(() => ({ data: [] })),
        ]);
        setGroups(res.data);
        setTypes(typeRes.data);
      } catch {
        setGroups([]);
      }
    })();
  }, [open, token]);

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
        ...(groupId ? { group_id: groupId } : {}),
        ...(kpiTypeId ? { kpi_type_id: kpiTypeId } : {}),
      });
      setName('');
      setCode('');
      setUnit('');
      setGroupId('');
      setKpiTypeId('');
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
          {groups.length ? (
            <label>
              Nhóm KPI
              <select
                className="kpi-select"
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
                disabled={busy}
              >
                <option value="">— Không chọn —</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({g.code})
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {types.length ? (
            <label>
              KPI Type
              <select
                className="kpi-select"
                value={kpiTypeId}
                onChange={(e) => {
                  const next = e.target.value;
                  setKpiTypeId(next);
                  const selected = types.find((t) => t.id === next);
                  if (selected?.kpi_group?.id) setGroupId(selected.kpi_group.id);
                  if (selected?.unit?.name) setUnit(selected.unit.name);
                }}
                disabled={busy}
              >
                <option value="">— Không chọn —</option>
                {types.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.code})
                  </option>
                ))}
              </select>
            </label>
          ) : null}
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
