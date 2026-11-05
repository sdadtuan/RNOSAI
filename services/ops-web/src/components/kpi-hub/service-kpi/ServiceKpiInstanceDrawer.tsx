'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createServiceKpiInstance } from '@/lib/service-kpi-api';
import { fetchKpiHubDictionary } from '@/lib/kpi-hub-api';
import { normalizeDictionaryList } from '@/lib/kpi-hub-normalize';
import type { KpiHubDictionaryRow } from '@/lib/kpi-hub-fixtures';
import type { CreateServiceKpiInstanceBody, SkpiClassification } from '@/lib/service-kpi-types';

const SOURCE_TYPES = [
  { value: 'quote_line_item', label: 'Quote Line Item' },
  { value: 'project', label: 'Project / Work Order' },
  { value: 'campaign', label: 'Campaign' },
] as const;

const SCENARIOS = ['base', 'conservative', 'growth'] as const;

type Props = {
  open: boolean;
  token: string;
  onClose: () => void;
  onCreated: () => void;
};

export function ServiceKpiInstanceDrawer({ open, token, onClose, onCreated }: Props) {
  const panelRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const [sourceType, setSourceType] = useState<string>('quote_line_item');
  const [sourceId, setSourceId] = useState('');
  const [dvCode, setDvCode] = useState('DV04');
  const [dictionaryId, setDictionaryId] = useState('');
  const [scenario, setScenario] = useState<string>('base');
  const [targetMin, setTargetMin] = useState('');
  const [targetMax, setTargetMax] = useState('');
  const [assumptionText, setAssumptionText] = useState(
    'Phụ thuộc thị trường, creative, offer và sales SLA.',
  );
  const [disclaimerText, setDisclaimerText] = useState(
    'Kết quả là mục tiêu tối ưu, không phải cam kết.',
  );
  const [ownerName, setOwnerName] = useState('Performance MKT');
  const [dictionary, setDictionary] = useState<KpiHubDictionaryRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !token) return;
    void fetchKpiHubDictionary(token, { status: 'ACTIVE', page_size: '100' })
      .then((raw) => setDictionary(normalizeDictionaryList(raw as Record<string, unknown>).data))
      .catch(() => setDictionary([]));
  }, [open, token]);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCloseRef.current();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const activeKpis = useMemo(
    () => dictionary.filter((d) => d.status === 'ACTIVE'),
    [dictionary],
  );

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!sourceId.trim() || !dictionaryId) {
      setError('Nhập Source ID và chọn KPI Definition Active');
      return;
    }
    const kpiRow = activeKpis.find((k) => k.id === dictionaryId);
    const classification: SkpiClassification =
      kpiRow?.group === 'FINANCE' ? 'INTERNAL_OPERATIONAL' : 'OPTIMIZATION_TARGET';

    setSaving(true);
    setError(null);
    const body: CreateServiceKpiInstanceBody = {
      source_type: sourceType,
      source_id: sourceId.trim(),
      dv_code: dvCode,
      dictionary_id: dictionaryId,
      classification,
      scenario,
      target_min: targetMin ? Number(targetMin) : undefined,
      target_max: targetMax ? Number(targetMax) : undefined,
      assumption_text: assumptionText,
      disclaimer_text: classification !== 'INTERNAL_OPERATIONAL' ? disclaimerText : '',
      owner_name: ownerName,
      client_visible: classification !== 'INTERNAL_OPERATIONAL',
    };
    try {
      await createServiceKpiInstance(token, body);
      onCreated();
      onClose();
      setSourceId('');
      setDictionaryId('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Không tạo được KPI Instance');
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
        aria-label="Tạo KPI Instance"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="kpi-hub-drawer__head">
          <h2>Tạo KPI Instance</h2>
          <button type="button" className="kpi-hub-drawer__close" onClick={onClose} aria-label="Đóng">
            ×
          </button>
        </header>
        <form className="kpi-hub-drawer__body" onSubmit={handleSubmit}>
          <label className="kpi-hub-field">
            <span>Source Type</span>
            <select value={sourceType} onChange={(e) => setSourceType(e.target.value)}>
              {SOURCE_TYPES.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label className="kpi-hub-field">
            <span>Source ID *</span>
            <input
              value={sourceId}
              onChange={(e) => setSourceId(e.target.value)}
              placeholder="QT-2026-0089 hoặc line-id"
            />
          </label>
          <label className="kpi-hub-field">
            <span>DV Code</span>
            <input value={dvCode} onChange={(e) => setDvCode(e.target.value.toUpperCase())} placeholder="DV04" />
          </label>
          <label className="kpi-hub-field">
            <span>KPI Definition (Active) *</span>
            {activeKpis.length ? (
              <select value={dictionaryId} onChange={(e) => setDictionaryId(e.target.value)}>
                <option value="">— Chọn KPI —</option>
                {activeKpis.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.code} — {k.name}
                  </option>
                ))}
              </select>
            ) : (
              <div className="kpi-hub-empty" style={{ marginTop: 4 }}>
                <p>Chưa có KPI Definition Active.</p>
                <Link href="/crm/kpi-hub/dictionary/new" className="kpi-hub-btn kpi-hub-btn--primary">
                  + Tạo KPI Definition
                </Link>
              </div>
            )}
          </label>
          <label className="kpi-hub-field">
            <span>Scenario</span>
            <select value={scenario} onChange={(e) => setScenario(e.target.value)}>
              {SCENARIOS.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
          </label>
          <div className="kpi-hub-field" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <label>
              <span>Target min</span>
              <input value={targetMin} onChange={(e) => setTargetMin(e.target.value)} placeholder="85000" />
            </label>
            <label>
              <span>Target max</span>
              <input value={targetMax} onChange={(e) => setTargetMax(e.target.value)} placeholder="100000" />
            </label>
          </div>
          <label className="kpi-hub-field">
            <span>Owner</span>
            <input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
          </label>
          <label className="kpi-hub-field">
            <span>Assumption</span>
            <textarea value={assumptionText} onChange={(e) => setAssumptionText(e.target.value)} rows={2} />
          </label>
          <label className="kpi-hub-field">
            <span>Disclaimer</span>
            <textarea value={disclaimerText} onChange={(e) => setDisclaimerText(e.target.value)} rows={2} />
          </label>
          {error ? <p className="kpi-hub-form-error">{error}</p> : null}
          <footer className="kpi-hub-drawer__foot">
            <button type="button" className="kpi-hub-btn kpi-hub-btn--ghost" onClick={onClose}>
              Hủy
            </button>
            <button type="submit" className="kpi-hub-btn kpi-hub-btn--primary" disabled={saving || !activeKpis.length}>
              {saving ? 'Đang lưu…' : 'Tạo KPI Instance'}
            </button>
          </footer>
        </form>
      </aside>
    </div>
  );
}
