'use client';

import { useEffect, useState } from 'react';
import { getAccessToken } from '@/lib/auth';
import { upsertKpiHubTarget } from '@/lib/kpi-hub-api';
import type { KpiHubTargetRow, KpiHubTargetScopeLevel } from '@/lib/kpi-hub-types';

const SCOPE_OPTIONS: Array<{ value: KpiHubTargetScopeLevel; label: string }> = [
  { value: 'WORKSPACE', label: 'Workspace' },
  { value: 'DEPARTMENT', label: 'Department' },
  { value: 'TEAM', label: 'Team' },
  { value: 'CAMPAIGN', label: 'Campaign' },
];

type Props = {
  row: KpiHubTargetRow | null;
  onClose: () => void;
  onSaved?: (row: KpiHubTargetRow) => void;
};

export function KpiHubTargetDrawer({ row, onClose, onSaved }: Props) {
  const [scopeLevel, setScopeLevel] = useState<KpiHubTargetScopeLevel>('WORKSPACE');
  const [scopeLabel, setScopeLabel] = useState('Toàn workspace');
  const [targetValue, setTargetValue] = useState('');
  const [warningValue, setWarningValue] = useState('');
  const [criticalValue, setCriticalValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!row) return;
    setScopeLevel(row.scopeLevel ?? 'WORKSPACE');
    setScopeLabel(row.scopeLabel ?? 'Toàn workspace');
    setTargetValue(String(row.target));
    setWarningValue(row.warning != null ? String(row.warning) : '');
    setCriticalValue(row.critical != null ? String(row.critical) : '');
    setSaveError(null);
  }, [row]);

  if (!row) return null;

  const gaugePct = row.code === 'MKT_006' ? 95 : 68;

  async function handleSave() {
    const token = getAccessToken();
    if (!token || !row) return;

    setSaving(true);
    setSaveError(null);
    try {
      await upsertKpiHubTarget(token, {
        id: row.id,
        code: row.code,
        scopeLevel,
        scopeLabel,
        target: Number(targetValue),
        warning: warningValue ? Number(warningValue) : null,
        critical: criticalValue ? Number(criticalValue) : null,
      });
      onSaved?.({
        ...row,
        scopeLevel,
        scopeLabel,
        target: Number(targetValue),
        targetFmt: row.targetFmt,
        warning: warningValue ? Number(warningValue) : null,
        critical: criticalValue ? Number(criticalValue) : null,
      });
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Lưu target thất bại');
    } finally {
      setSaving(false);
    }
  }

  return (
    <aside className="kpi-hub-drawer" aria-label="Chi tiết Target">
      <header className="kpi-hub-drawer__head">
        <div>
          <h2>{row.name}</h2>
          <span className="kpi-hub-table__mono">{row.code}</span>
        </div>
        <button type="button" className="kpi-hub-drawer__close" onClick={onClose}>
          ×
        </button>
      </header>
      <div className="kpi-hub-drawer__body">
        <div className="kpi-hub-target-scope">
          <label>
            Phạm vi target
            <select
              className="kpi-hub-select"
              value={scopeLevel}
              onChange={(e) => {
                const next = e.target.value as KpiHubTargetScopeLevel;
                setScopeLevel(next);
                setScopeLabel(SCOPE_OPTIONS.find((o) => o.value === next)?.label ?? next);
              }}
            >
              {SCOPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <span className="kpi-hub-hierarchy-badge">{scopeLabel}</span>
        </div>
        <p className="muted">Lower is better · Kỳ 09/2026</p>
        <div className="kpi-hub-gauge">
          <svg viewBox="0 0 120 70" aria-label={`${gaugePct}%`}>
            <path d="M10,60 A50,50 0 0,1 110,60" fill="none" stroke="#E5E7EB" strokeWidth="10" />
            <path
              d="M10,60 A50,50 0 0,1 110,60"
              fill="none"
              stroke="#10B981"
              strokeWidth="10"
              strokeDasharray={`${(gaugePct / 100) * 157} 157`}
            />
            <text x="60" y="55" textAnchor="middle" className="kpi-hub-gauge__value">
              {row.actualFmt}
            </text>
          </svg>
          <p>
            Target: <strong>{row.targetFmt}</strong>
          </p>
        </div>
        <section className="kpi-hub-drawer__section">
          <h3>Ngưỡng</h3>
          <div className="kpi-hub-form-grid">
            <label>
              Target
              <input
                className="kpi-hub-input"
                type="number"
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
              />
            </label>
            <label>
              Warning
              <input
                className="kpi-hub-input"
                type="number"
                value={warningValue}
                onChange={(e) => setWarningValue(e.target.value)}
              />
            </label>
            <label>
              Critical
              <input
                className="kpi-hub-input"
                type="number"
                value={criticalValue}
                onChange={(e) => setCriticalValue(e.target.value)}
              />
            </label>
          </div>
        </section>
        <section className="kpi-hub-drawer__section">
          <h3>Cảnh báo</h3>
          <p>Gửi lại sau 4 giờ nếu chưa xử lý</p>
          <div className="kpi-hub-chip-row">
            <span className="kpi-hub-chip">Email</span>
            <span className="kpi-hub-chip">Teams</span>
          </div>
        </section>
        {saveError ? <p className="error">{saveError}</p> : null}
      </div>
      <footer className="kpi-hub-drawer__foot">
        <button type="button" className="kpi-hub-btn kpi-hub-btn--primary" disabled={saving} onClick={handleSave}>
          {saving ? 'Đang lưu…' : 'Lưu target'}
        </button>
      </footer>
    </aside>
  );
}
