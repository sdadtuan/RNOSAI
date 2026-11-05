'use client';

import { useEffect, useRef, useState } from 'react';
import { fetchServiceKpiActuals, ingestServiceKpiActual } from '@/lib/service-kpi-api';
import type { ServiceKpiActualRecord, ServiceKpiInstanceItem } from '@/lib/service-kpi-types';

type Props = {
  open: boolean;
  token: string;
  instances: ServiceKpiInstanceItem[];
  dictionaryLabels?: Record<string, string>;
  onClose: () => void;
  onSaved: () => void;
};

export function ServiceKpiActualDrawer({
  open,
  token,
  instances,
  dictionaryLabels = {},
  onClose,
  onSaved,
}: Props) {
  const panelRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const [instanceId, setInstanceId] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [value, setValue] = useState('');
  const [qualityStatus, setQualityStatus] = useState('pending_validation');
  const [sourceRef, setSourceRef] = useState('manual');
  const [records, setRecords] = useState<ServiceKpiActualRecord[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    if (!open || !token || !instanceId) {
      setRecords([]);
      return;
    }
    void fetchServiceKpiActuals(token, instanceId)
      .then(setRecords)
      .catch(() => setRecords([]));
  }, [open, token, instanceId]);

  useEffect(() => {
    if (open && instances.length && !instanceId) setInstanceId(instances[0]!.id);
  }, [open, instances, instanceId]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !instanceId || !periodStart || !periodEnd) {
      setError('Chọn instance và kỳ đo');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await ingestServiceKpiActual(token, instanceId, {
        period_start: periodStart,
        period_end: periodEnd,
        value: value ? Number(value) : null,
        quality_status: qualityStatus,
        source_ref: sourceRef,
        collection_method: 'manual',
      });
      onSaved();
      const next = await fetchServiceKpiActuals(token, instanceId);
      setRecords(next);
      setValue('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Không ghi actual');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="kpi-hub-drawer-backdrop" role="presentation" onClick={onClose}>
      <aside
        ref={panelRef}
        className="kpi-hub-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Nhập Actual KPI"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="kpi-hub-drawer__head">
          <h2>Nhập Actual KPI</h2>
          <button type="button" className="kpi-hub-drawer__close" onClick={onClose} aria-label="Đóng">
            ×
          </button>
        </header>
        <form className="kpi-hub-drawer__body" onSubmit={(e) => void handleSubmit(e)}>
          <label className="kpi-hub-field">
            <span>KPI Instance</span>
            <select value={instanceId} onChange={(e) => setInstanceId(e.target.value)}>
              {instances.map((inst) => (
                <option key={inst.id} value={inst.id}>
                  {dictionaryLabels[inst.dictionary_id] ?? inst.dictionary_id} · {inst.source_id}
                </option>
              ))}
            </select>
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <label className="kpi-hub-field">
              <span>Period start</span>
              <input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
            </label>
            <label className="kpi-hub-field">
              <span>Period end</span>
              <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
            </label>
          </div>
          <label className="kpi-hub-field">
            <span>Actual value</span>
            <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="128000" />
          </label>
          <label className="kpi-hub-field">
            <span>Quality status</span>
            <select value={qualityStatus} onChange={(e) => setQualityStatus(e.target.value)}>
              <option value="pending_validation">Pending</option>
              <option value="valid">Verified</option>
              <option value="invalid">Invalid</option>
            </select>
          </label>
          <label className="kpi-hub-field">
            <span>Source ref</span>
            <input value={sourceRef} onChange={(e) => setSourceRef(e.target.value)} />
          </label>
          {error ? <p className="kpi-hub-form-error">{error}</p> : null}
          {records.length ? (
            <div className="kpi-hub-skpi-actual-records">
              <h3 className="kpi-hub-section-title">Actual records</h3>
              <ul>
                {records.slice(0, 8).map((r) => (
                  <li key={r.id}>
                    {r.period_start} → {r.period_end}: <strong>{r.value ?? 'N/A'}</strong>{' '}
                    <span className={`kpi-hub-badge kpi-hub-badge--${r.quality_status === 'valid' ? 'green' : 'amber'}`}>
                      {r.quality_status}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <footer className="kpi-hub-drawer__foot">
            <button type="button" className="kpi-hub-btn kpi-hub-btn--ghost" onClick={onClose}>
              Hủy
            </button>
            <button type="submit" className="kpi-hub-btn kpi-hub-btn--primary" disabled={saving}>
              {saving ? 'Đang lưu…' : 'Xác nhận Actual'}
            </button>
          </footer>
        </form>
      </aside>
    </div>
  );
}
