'use client';

import { useEffect, useRef, useState } from 'react';
import { importServiceKpiActuals } from '@/lib/service-kpi-api';
import { parseActualImportCsv } from '@/lib/service-kpi-csv';
import type { ImportActualResult } from '@/lib/service-kpi-types';

type Props = {
  open: boolean;
  token: string;
  onClose: () => void;
  onImported: () => void;
};

export function ServiceKpiActualImportDrawer({ open, token, onClose, onImported }: Props) {
  const panelRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const [previewCount, setPreviewCount] = useState(0);
  const [csvText, setCsvText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportActualResult | null>(null);

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
    if (!open) {
      setCsvText('');
      setPreviewCount(0);
      setResult(null);
      setError(null);
    }
  }, [open]);

  if (!open) return null;

  function handleFile(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? '');
      setCsvText(text);
      setPreviewCount(parseActualImportCsv(text).length);
      setResult(null);
      setError(null);
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    if (!token || !csvText.trim()) {
      setError('Chọn file CSV hợp lệ');
      return;
    }
    const rows = parseActualImportCsv(csvText);
    if (!rows.length) {
      setError('Không parse được dòng nào — kiểm tra header CSV');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await importServiceKpiActuals(token, rows);
      setResult(res);
      if (res.imported > 0) onImported();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Import thất bại');
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
        aria-label="Import Actual CSV"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="kpi-hub-drawer__head">
          <h2>Import Actual CSV/XLSX</h2>
          <button type="button" className="kpi-hub-drawer__close" onClick={onClose} aria-label="Đóng">
            ×
          </button>
        </header>
        <div className="kpi-hub-drawer__body">
          <p className="kpi-hub-notice">
            Schema: <code>instance_id</code> hoặc <code>dictionary_id,source_id</code>, plus{' '}
            <code>period_start,period_end,value,quality_status,source_ref</code>.
          </p>
          <label className="kpi-hub-field">
            <span>Chọn file CSV</span>
            <input type="file" accept=".csv,text/csv" onChange={(e) => handleFile(e.target.files?.[0] ?? null)} />
          </label>
          {previewCount ? <p className="kpi-hub-muted">{previewCount} dòng sẽ import</p> : null}
          {error ? <p className="kpi-hub-form-error">{error}</p> : null}
          {result ? (
            <p className="kpi-hub-notice kpi-hub-notice--success">
              Đã import {result.imported}/{result.total}
              {result.skipped ? ` · bỏ qua ${result.skipped} trùng` : ''}
              {result.errors.length ? ` · ${result.errors.length} lỗi` : ''}
            </p>
          ) : null}
          {result?.errors.length ? (
            <ul className="kpi-hub-skpi-readiness-list">
              {result.errors.slice(0, 5).map((e) => (
                <li key={e.row} className="is-warn">
                  Dòng {e.row}: {e.error}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <footer className="kpi-hub-drawer__foot">
          <button type="button" className="kpi-hub-btn kpi-hub-btn--ghost" onClick={onClose}>
            Đóng
          </button>
          <button type="button" className="kpi-hub-btn kpi-hub-btn--primary" disabled={saving || !previewCount} onClick={() => void handleImport()}>
            {saving ? 'Đang import…' : 'Import'}
          </button>
        </footer>
      </aside>
    </div>
  );
}
