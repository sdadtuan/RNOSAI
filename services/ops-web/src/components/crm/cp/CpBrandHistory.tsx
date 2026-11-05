'use client';

import { useCallback, useEffect, useState } from 'react';
import { getAccessToken } from '@/lib/auth';
import {
  formatCpApiError,
  listVersions,
  restoreBrandVersion,
  type CpBrandVersion,
  type CpScope,
} from '@/lib/crm/cp-api';
import { dash } from '@/lib/crm/cp-format';

function summarizePayload(payload: Record<string, unknown> | undefined): string {
  if (!payload) return dash(null);
  const palette = Array.isArray(payload.palette) ? payload.palette.join(', ') : '';
  const cta = payload.cta && typeof payload.cta === 'object'
    ? String((payload.cta as { label?: unknown }).label ?? '')
    : '';
  const disclaimer = payload.disclaimer && typeof payload.disclaimer === 'object'
    ? String((payload.disclaimer as { text?: unknown }).text ?? '')
    : '';
  const bits = [palette && `Palette ${palette}`, cta && `CTA ${cta}`, disclaimer && 'Disclaimer']
    .filter(Boolean);
  return bits.length ? bits.join(' · ') : dash(null);
}

export function CpBrandHistory({
  kitId,
  scope,
  onRestored,
}: {
  kitId: string;
  scope: CpScope;
  onRestored?: () => void;
}) {
  const [items, setItems] = useState<CpBrandVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await listVersions(token, kitId, scope);
      setItems(result.items);
    } catch (caught) {
      setItems([]);
      setError(formatCpApiError(caught, 'Không tải được lịch sử'));
    } finally {
      setLoading(false);
    }
  }, [kitId, scope]);

  useEffect(() => {
    void load();
  }, [load]);

  async function restore(n: number) {
    const token = getAccessToken();
    if (!token) {
      setError('Phiên đăng nhập không hợp lệ');
      return;
    }
    setRestoring(n);
    setError('');
    setNotice('');
    try {
      const created = await restoreBrandVersion(token, kitId, n, scope);
      setNotice(`Đã restore v${n} → v${created.n}`);
      await load();
      onRestored?.();
    } catch (caught) {
      setError(formatCpApiError(caught, 'Không restore được phiên bản'));
    } finally {
      setRestoring(null);
    }
  }

  return (
    <div className="cp-overview">
      <section className="cp-card" aria-busy={loading}>
        <div className="cp-card__head">
          <div>
            <h2>Version & Change History</h2>
            <p className="cp-muted">Restore vN tạo vN+1, không sửa bản cũ.</p>
          </div>
        </div>
        {error ? <p className="cp-card--error">{error}</p> : null}
        {notice ? <p className="cp-alert">{notice}</p> : null}
        <div className="cp-table-wrap">
          <table className="cp-table">
            <thead>
              <tr>
                <th>Ver</th>
                <th>Ngày</th>
                <th>Actor</th>
                <th>Diff</th>
                <th>Impact</th>
              </tr>
            </thead>
            <tbody>
              {items.length ? items.map((version) => (
                <tr key={`${version.kit_id}-${version.n}`}>
                  <td>v{version.n}</td>
                  <td>{dash(version.approved_at)}</td>
                  <td>{dash(version.approved_by)}</td>
                  <td>{summarizePayload(version.payload_json)}</td>
                  <td>
                    <button
                      className="cp-btn"
                      type="button"
                      disabled={restoring != null}
                      onClick={() => void restore(version.n)}
                    >
                      {restoring === version.n ? 'Đang restore…' : `Restore v${version.n}`}
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td className="cp-empty" colSpan={5}>{loading ? 'Đang tải…' : dash(null)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
