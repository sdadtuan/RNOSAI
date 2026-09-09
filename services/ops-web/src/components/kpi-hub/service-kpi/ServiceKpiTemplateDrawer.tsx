'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createServiceKpiTemplate } from '@/lib/service-kpi-api';
import { fetchKpiHubDictionary } from '@/lib/kpi-hub-api';
import { normalizeDictionaryList } from '@/lib/kpi-hub-normalize';
import type { KpiHubDictionaryRow } from '@/lib/kpi-hub-fixtures';
import type { CreateServiceKpiTemplateBody, SkpiClassification } from '@/lib/service-kpi-types';

const DV_OPTIONS = Array.from({ length: 21 }, (_, i) => {
  const code = `DV${String(i + 1).padStart(2, '0')}`;
  return { code, label: `${code} — Portfolio DV ${i + 1}` };
});

type Props = {
  open: boolean;
  token: string;
  onClose: () => void;
  onCreated: () => void;
};

export function ServiceKpiTemplateDrawer({ open, token, onClose, onCreated }: Props) {
  const panelRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const [dvCode, setDvCode] = useState('DV04');
  const [name, setName] = useState('');
  const [ownerTeam, setOwnerTeam] = useState('Performance MKT');
  const [dictionary, setDictionary] = useState<KpiHubDictionaryRow[]>([]);
  const [selectedKpis, setSelectedKpis] = useState<string[]>([]);
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
    if (!name.trim() || !selectedKpis.length) {
      setError('Nhập tên template và chọn ít nhất 1 KPI Active');
      return;
    }
    setSaving(true);
    setError(null);
    const body: CreateServiceKpiTemplateBody = {
      dv_code: dvCode,
      name: name.trim(),
      owner_team: ownerTeam,
      rules: selectedKpis.map((dictionaryId) => {
        const row = activeKpis.find((k) => k.id === dictionaryId);
        const classification: SkpiClassification =
          row?.group === 'FINANCE' ? 'INTERNAL_OPERATIONAL' : 'OPTIMIZATION_TARGET';
        return {
          dictionary_id: dictionaryId,
          classification,
          client_visible: classification !== 'INTERNAL_OPERATIONAL',
          assumption_template: 'Phụ thuộc thị trường, creative và sales SLA.',
          disclaimer_template: classification !== 'INTERNAL_OPERATIONAL' ? 'Kết quả là mục tiêu tối ưu, không phải cam kết.' : '',
          owner_role: ownerTeam,
        };
      }),
    };
    try {
      await createServiceKpiTemplate(token, body);
      onCreated();
      onClose();
      setName('');
      setSelectedKpis([]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Không tạo được template');
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
        aria-label="Tạo Service KPI Template"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="kpi-hub-drawer__head">
          <h2>Tạo Service KPI Template</h2>
          <button type="button" className="kpi-hub-drawer__close" onClick={onClose} aria-label="Đóng">
            ×
          </button>
        </header>
        <form className="kpi-hub-drawer__body" onSubmit={handleSubmit}>
          <label className="kpi-hub-field">
            <span>Service Catalog (21 DV)</span>
            <select value={dvCode} onChange={(e) => setDvCode(e.target.value)}>
              {DV_OPTIONS.map((dv) => (
                <option key={dv.code} value={dv.code}>
                  {dv.label}
                </option>
              ))}
            </select>
          </label>
          <label className="kpi-hub-field">
            <span>Tên template</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Meta Ads Lead Generation v1" />
          </label>
          <label className="kpi-hub-field">
            <span>Owner team</span>
            <input value={ownerTeam} onChange={(e) => setOwnerTeam(e.target.value)} />
          </label>
          <label className="kpi-hub-field">
            <span>KPI từ Dictionary (Active)</span>
            {activeKpis.length ? (
              <select
                multiple
                size={6}
                value={selectedKpis}
                onChange={(e) =>
                  setSelectedKpis(Array.from(e.target.selectedOptions).map((o) => o.value))
                }
              >
                {activeKpis.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.code} — {k.name}
                  </option>
                ))}
              </select>
            ) : (
              <div className="kpi-hub-empty" style={{ marginTop: 4 }}>
                <p>Chưa có KPI Definition Active trong Dictionary.</p>
                <Link href="/crm/kpi-hub/dictionary/new" className="kpi-hub-btn kpi-hub-btn--primary">
                  + Tạo KPI Definition
                </Link>
              </div>
            )}
          </label>
          {error ? <p className="kpi-hub-form-error">{error}</p> : null}
          <footer className="kpi-hub-drawer__foot">
            <button type="button" className="kpi-hub-btn kpi-hub-btn--ghost" onClick={onClose}>
              Hủy
            </button>
            <button type="submit" className="kpi-hub-btn kpi-hub-btn--primary" disabled={saving}>
              {saving ? 'Đang lưu…' : 'Tạo Template'}
            </button>
          </footer>
        </form>
      </aside>
    </div>
  );
}
