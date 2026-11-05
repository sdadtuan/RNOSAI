'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { patchServiceKpiInstance, validateServiceKpiInstanceReadiness } from '@/lib/service-kpi-api';
import type { ServiceKpiInstanceItem } from '@/lib/service-kpi-types';

type Props = {
  open: boolean;
  token: string;
  instance: ServiceKpiInstanceItem | null;
  dictionaryLabel?: string;
  onClose: () => void;
  onUpdated: () => void;
};

export function ServiceKpiInstanceDetailDrawer({
  open,
  token,
  instance,
  dictionaryLabel,
  onClose,
  onUpdated,
}: Props) {
  const panelRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const [assumptionState, setAssumptionState] = useState('pending');
  const [evidence, setEvidence] = useState('');
  const [saving, setSaving] = useState(false);
  const [readiness, setReadiness] = useState<{ level: string; errors: Array<{ field: string; message: string }> } | null>(
    null,
  );
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
    if (instance) {
      setAssumptionState(instance.assumption_state ?? 'pending');
      setEvidence('');
      setReadiness(null);
      setError(null);
    }
  }, [instance?.id, instance?.assumption_state]);

  if (!open || !instance) return null;

  async function handleAssumptionSave() {
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      await patchServiceKpiInstance(
        token,
        instance!.id,
        { assumption_state: assumptionState as 'pending' | 'confirmed' | 'not_met', evidence: evidence.trim() || undefined },
        instance!.row_version,
      );
      onUpdated();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Lưu assumption thất bại');
    } finally {
      setSaving(false);
    }
  }

  async function handleValidateReadiness() {
    if (!token) return;
    setError(null);
    try {
      const res = await validateServiceKpiInstanceReadiness(token, instance!.id);
      setReadiness(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Validate readiness thất bại');
    }
  }

  return (
    <div className="kpi-hub-drawer-backdrop" role="presentation" onClick={onClose}>
      <aside
        ref={panelRef}
        className="kpi-hub-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Chi tiết KPI Instance"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="kpi-hub-drawer__head">
          <h2>{dictionaryLabel ?? instance.dictionary_id}</h2>
          <button type="button" className="kpi-hub-drawer__close" onClick={onClose} aria-label="Đóng">
            ×
          </button>
        </header>
        <div className="kpi-hub-drawer__body">
          <dl className="kpi-hub-drawer__dl">
            <div>
              <dt>Source</dt>
              <dd>
                {instance.source_type} · {instance.source_id}
              </dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{instance.status}</dd>
            </div>
            <div>
              <dt>Target</dt>
              <dd>
                {instance.target_min ?? '—'} – {instance.target_max ?? '—'} ({instance.scenario})
              </dd>
            </div>
            <div>
              <dt>Actual / Variance</dt>
              <dd>
                {instance.latest_actual ?? '—'}
                {instance.variance_pct != null ? ` · ${instance.variance_pct}%` : ''}
              </dd>
            </div>
          </dl>

          <label className="kpi-hub-field">
            <span>Assumption state</span>
            <select value={assumptionState} onChange={(e) => setAssumptionState(e.target.value)}>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="not_met">Not met</option>
            </select>
          </label>
          <label className="kpi-hub-field">
            <span>Evidence / ghi chú</span>
            <textarea value={evidence} onChange={(e) => setEvidence(e.target.value)} rows={3} placeholder="Sales SLA &lt; 15 phút đã confirm với khách…" />
          </label>

          {readiness ? (
            <p className={`kpi-hub-notice${readiness.level === 'pass' ? ' kpi-hub-notice--success' : ''}`}>
              Readiness: {readiness.level}
              {readiness.errors.length ? ` — ${readiness.errors.map((e) => e.message).join('; ')}` : ''}
            </p>
          ) : null}
          {error ? <p className="kpi-hub-form-error">{error}</p> : null}

          <div className="kpi-hub-skpi-builder__actions">
            <button type="button" className="kpi-hub-btn kpi-hub-btn--ghost" onClick={() => void handleValidateReadiness()}>
              Validate readiness
            </button>
            <Link href={`/crm/kpi-hub/measurement?instance=${encodeURIComponent(instance.id)}`} className="kpi-hub-btn kpi-hub-btn--ghost">
              Measurement Plan
            </Link>
          </div>
        </div>
        <footer className="kpi-hub-drawer__foot">
          <button type="button" className="kpi-hub-btn kpi-hub-btn--ghost" onClick={onClose}>
            Đóng
          </button>
          <button type="button" className="kpi-hub-btn kpi-hub-btn--primary" disabled={saving} onClick={() => void handleAssumptionSave()}>
            {saving ? 'Đang lưu…' : 'Lưu assumption'}
          </button>
        </footer>
      </aside>
    </div>
  );
}
