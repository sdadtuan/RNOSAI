'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { fetchServiceKpiContractScoreLive } from '@/lib/service-kpi-api';
import type { ServiceKpiContractScoreLive } from '@/lib/service-kpi-types';

type Props = {
  token: string;
  versionId: string | null;
  gmBps: number | null;
  proposalId: number;
  quoteCode?: string | null;
};

export function QtContractScorePanel({ token, versionId, gmBps, proposalId, quoteCode }: Props) {
  const [score, setScore] = useState<ServiceKpiContractScoreLive | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !versionId) {
      setScore(null);
      return;
    }
    setLoading(true);
    setError(null);
    void fetchServiceKpiContractScoreLive(token, versionId, gmBps)
      .then(setScore)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Không tải Contract Score'))
      .finally(() => setLoading(false));
  }, [token, versionId, gmBps]);

  if (!versionId) {
    return (
      <section className="qt-card">
        <header className="qt-card__head">
          <b>KPI Contract Score</b>
        </header>
        <p className="qt-muted">Chưa có version — lưu quote để tính score.</p>
      </section>
    );
  }

  return (
    <section className="qt-card">
      <header className="qt-card__head">
        <b>KPI Contract Score</b>
        <Link className="qt-link" href={`/crm/kpi-hub/kpi-contracts?version=${encodeURIComponent(versionId)}&proposal=${proposalId}`}>
          Chi tiết Hub
        </Link>
      </header>
      {loading ? <p className="qt-muted">Đang tính score…</p> : null}
      {error ? <p className="qt-form-error">{error}</p> : null}
      {score ? (
        <div className="qt-contract-score">
          <div className={`qt-contract-score__value${score.blockSubmit ? ' is-blocked' : ''}`}>{score.score}</div>
          <div className="qt-contract-score__meta">
            <span>{quoteCode ?? `Proposal #${proposalId}`}</span>
            {gmBps != null ? <span>GM {(gmBps / 100).toFixed(1)}%</span> : null}
            {score.blockSubmit ? <span className="qt-pill qt-pill--warn">Block submit</span> : null}
          </div>
          {score.requiredReviewers.length ? (
            <p className="qt-muted">Reviewer: {score.requiredReviewers.join(' · ')}</p>
          ) : null}
          <p className="qt-muted qt-contract-score__formula">
            Internal only — score = 25% class + 25% aggr + 20% assume + 15% data + 15% margin
          </p>
        </div>
      ) : null}
    </section>
  );
}
