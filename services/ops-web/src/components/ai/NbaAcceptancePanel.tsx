'use client';

import { useEffect, useState } from 'react';
import { formatPct } from '@/lib/kpi/format';
import { fetchAiAcceptanceMetrics } from '@/lib/ai-api';

const NBA_ACCEPTANCE_TARGET_PCT = 35;

export function NbaAcceptancePanel({ token, days = 7 }: { token: string; days?: number }) {
  const [acceptancePct, setAcceptancePct] = useState<number | null>(null);
  const [accepted, setAccepted] = useState(0);
  const [resolved, setResolved] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setError('');
    void fetchAiAcceptanceMetrics(token, { days, recommendation_type: 'nba' })
      .then((out) => {
        setAcceptancePct(out.data.acceptance_rate_pct);
        setAccepted(out.data.accepted);
        setResolved(out.data.total_resolved);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Tải NBA acceptance thất bại');
        setAcceptancePct(null);
      })
      .finally(() => setLoading(false));
  }, [token, days]);

  if (loading) return <p className="muted">Đang tải NBA acceptance…</p>;
  if (error) return <p className="error">{error}</p>;

  const gatePass = acceptancePct != null && acceptancePct >= NBA_ACCEPTANCE_TARGET_PCT;

  return (
    <section className="nba-acceptance-panel" data-testid="nba-acceptance-panel">
      <h3 className="kpi-section-title">AI NBA acceptance</h3>
      <div className="nba-acceptance-panel__metric">
        <span className="muted">Chấp nhận NBA (recommendation_type=nba)</span>
        <strong data-testid="nba-acceptance-rate">
          {acceptancePct != null ? formatPct(acceptancePct) : '—'}
          {resolved > 0 ? ` · ${accepted}/${resolved} quyết định` : ''}
        </strong>
        <span className={gatePass ? 'success' : 'warning'}>
          Target ≥{formatPct(NBA_ACCEPTANCE_TARGET_PCT)} · {gatePass ? 'Đạt' : 'Chưa đạt'}
        </span>
      </div>
    </section>
  );
}
