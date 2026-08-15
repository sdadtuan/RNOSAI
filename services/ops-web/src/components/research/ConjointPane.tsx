'use client';

import { useCallback, useEffect, useState } from 'react';
import { getAccessToken } from '@/lib/auth';
import {
  createResearchConjoint,
  fetchResearchConjoint,
  ResearchApiError,
  TRANSITION_REASON_VI,
  type ResearchCjSummaryRow,
} from '@/lib/market-research-api';
import { CJ_TAB_BANNER, formatSharePct } from '@/components/research/conjoint-pane.util';

export function ConjointPane({
  projectId,
  canEdit,
}: {
  projectId: number;
  canEdit: boolean;
}) {
  const [summary, setSummary] = useState<ResearchCjSummaryRow | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    const out = await fetchResearchConjoint(token, projectId);
    setSummary(out.summary);
  }, [projectId]);

  useEffect(() => {
    void load().catch((err) => {
      setError(err instanceof Error ? err.message : 'Tải conjoint thất bại');
    });
  }, [load]);

  async function onCompute() {
    const token = getAccessToken();
    if (!token) return;
    setSaving(true);
    setError('');
    try {
      await createResearchConjoint(token, projectId, {});
      await load();
    } catch (err) {
      const api = err instanceof ResearchApiError ? err : null;
      if (api?.code && TRANSITION_REASON_VI[api.code]) {
        setError(TRANSITION_REASON_VI[api.code]);
      } else {
        setError(err instanceof Error ? err.message : 'Tính conjoint lite thất bại');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card stack-gap" style={{ padding: '0.9rem' }}>
      <h2 style={{ margin: 0, fontSize: '1rem' }}>Conjoint lite</h2>
      <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
        {CJ_TAB_BANNER}
      </p>
      {error ? <p className="error" style={{ margin: 0 }}>{error}</p> : null}
      {canEdit ? (
        <button type="button" className="btn btn-sm" disabled={saving} onClick={() => void onCompute()}>
          Tính conjoint lite
        </button>
      ) : null}
      {!summary ? (
        <p className="muted">Chưa có bảng conjoint.</p>
      ) : (
        <>
          <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
            n={summary.n} · {summary.n_choices} lựa chọn
          </p>
          {summary.attributes.map((attr) => (
            <div key={attr.name} style={{ overflowX: 'auto' }}>
              <h3 style={{ margin: '0.5rem 0 0.25rem', fontSize: '0.9rem' }}>{attr.name}</h3>
              <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '0.4rem' }}>Mức</th>
                    <th style={{ textAlign: 'left', padding: '0.4rem' }}>Count</th>
                    <th style={{ textAlign: 'left', padding: '0.4rem' }}>Share %</th>
                  </tr>
                </thead>
                <tbody>
                  {attr.levels.map((level) => (
                    <tr key={level.label}>
                      <td style={{ padding: '0.4rem' }}>{level.label}</td>
                      <td style={{ padding: '0.4rem' }}>{level.count}</td>
                      <td style={{ padding: '0.4rem' }}>{formatSharePct(level.share_pct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
          {summary.recommendation.levels.length ? (
            <div>
              <h3 style={{ margin: '0.5rem 0 0.25rem', fontSize: '0.9rem' }}>Gợi ý gói</h3>
              <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>
                {summary.recommendation.levels.map((row) => (
                  <li key={row.attribute}>
                    {row.attribute}: {row.level} ({formatSharePct(row.share_pct)}%)
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {summary.limitation_note ? (
            <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
              {summary.limitation_note}
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
