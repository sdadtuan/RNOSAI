'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  createServiceKpiChangeOrder,
  previewServiceKpiChangeOrder,
} from '@/lib/service-kpi-api';
import type { ServiceKpiChangeOrderPreview, ServiceKpiChangeOrderResult } from '@/lib/service-kpi-types';

type Props = {
  open: boolean;
  token: string;
  sourceId: string;
  onClose: () => void;
  onCreated?: (result: ServiceKpiChangeOrderResult) => void;
};

export function ServiceKpiChangeOrderDrawer({ open, token, sourceId, onClose, onCreated }: Props) {
  const [preview, setPreview] = useState<ServiceKpiChangeOrderPreview | null>(null);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ServiceKpiChangeOrderResult | null>(null);

  useEffect(() => {
    if (!open || !token || !sourceId.trim()) {
      setPreview(null);
      setResult(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    void previewServiceKpiChangeOrder(token, sourceId.trim())
      .then(setPreview)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Không tải preview'))
      .finally(() => setLoading(false));
  }, [open, token, sourceId]);

  async function handleCreate() {
    if (!token || !sourceId.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const created = await createServiceKpiChangeOrder(token, {
        source_id: sourceId.trim(),
        reason: reason.trim() || undefined,
      });
      setResult(created);
      onCreated?.(created);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Tạo Change Order thất bại');
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  const materialRows = preview?.rows.filter((r) => r.material_variance) ?? [];

  return (
    <div className="kpi-hub-drawer-backdrop" role="presentation" onClick={onClose}>
      <aside
        className="kpi-hub-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Change Order"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="kpi-hub-drawer__head">
          <h2>Change Order · Quote OS</h2>
          <button type="button" className="kpi-hub-drawer__close" onClick={onClose} aria-label="Đóng">
            ×
          </button>
        </header>
        <div className="kpi-hub-drawer__body">
          {loading ? <p className="kpi-hub-muted">Đang phân tích chênh Quoted ↔ Delivered…</p> : null}
          {error ? <p className="kpi-hub-form-error">{error}</p> : null}
          {result ? (
            <div className="kpi-hub-notice kpi-hub-notice--success">
              <p>
                Đã tạo CO <strong>{result.change_order_id.slice(0, 8)}</strong> — Quote revision{' '}
                <strong>v{result.version_n}</strong> ({result.material_count} KPI material).
              </p>
              <p>Tiếp theo: chỉnh commercial trên Quote Builder → Finance + GDKD duyệt.</p>
              <Link href={result.builder_href} className="kpi-hub-btn kpi-hub-btn--primary" style={{ marginTop: 12 }}>
                Mở Quote Builder
              </Link>
            </div>
          ) : preview ? (
            <>
              <p className="kpi-hub-muted">
                Source <strong>{preview.source_id}</strong>
                {preview.quote_context?.quote_code ? ` · ${preview.quote_context.quote_code}` : ''}
                {' — '}
                {preview.material_count} KPI chênh material (≥15% hoặc chặn report).
              </p>
              {!preview.quote_context ? (
                <p className="kpi-hub-form-error">Chưa có Quoted snapshot gắn Quote version — không thể tạo CO.</p>
              ) : null}
              {materialRows.length ? (
                <ul className="kpi-hub-skpi-readiness-list">
                  {materialRows.map((row) => (
                    <li key={row.instance_id} className="is-warn">
                      <strong>{row.dictionary_id}</strong>
                      {row.variance_pct != null ? ` · ${row.variance_pct > 0 ? '+' : ''}${row.variance_pct}%` : ''}
                      {' · '}
                      {row.behavior}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="kpi-hub-muted">Không có chênh material — không cần Change Order.</p>
              )}
              <label className="kpi-hub-field" style={{ marginTop: 12 }}>
                <span>Lý do (optional)</span>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  placeholder="Ví dụ: CPL vượt ngưỡng quoted, cần phương án B hoặc tăng fee"
                />
              </label>
            </>
          ) : null}
        </div>
        <footer className="kpi-hub-drawer__foot">
          <button type="button" className="kpi-hub-btn kpi-hub-btn--ghost" onClick={onClose}>
            {result ? 'Đóng' : 'Hủy'}
          </button>
          {!result ? (
            <button
              type="button"
              className="kpi-hub-btn kpi-hub-btn--primary"
              disabled={
                submitting ||
                loading ||
                !preview?.quote_context ||
                !preview.material_count ||
                !materialRows.length
              }
              onClick={() => void handleCreate()}
            >
              {submitting ? 'Đang tạo…' : 'Tạo Change Order + Quote revision'}
            </button>
          ) : null}
        </footer>
      </aside>
    </div>
  );
}
