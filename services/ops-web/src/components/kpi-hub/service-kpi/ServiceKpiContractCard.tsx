'use client';

import Link from 'next/link';
import { ServiceKpiSummaryTiles } from '@/components/kpi-hub/service-kpi/ServiceKpiSummaryTiles';
import type {
  ServiceKpiContractRiskItem,
  ServiceKpiContractScoreLive,
  ServiceKpiQuoteContractScore,
} from '@/lib/service-kpi-types';

type Props = {
  quotes: ServiceKpiQuoteContractScore[];
  selectedVersionId: string;
  onSelectVersion: (versionId: string) => void;
  liveScore: ServiceKpiContractScoreLive | null;
  riskItems: ServiceKpiContractRiskItem[];
  loading?: boolean;
  scoreLoading?: boolean;
  error?: string | null;
};

export function ServiceKpiContractCard({
  quotes,
  selectedVersionId,
  onSelectVersion,
  liveScore,
  riskItems,
  loading,
  scoreLoading,
  error,
}: Props) {
  if (loading) return <p className="kpi-hub-muted">Đang tải contract risk…</p>;
  if (error) return <p className="kpi-hub-form-error">{error}</p>;

  const selected = quotes.find((q) => q.version_id === selectedVersionId) ?? quotes[0] ?? null;
  const parts = liveScore?.parts;

  if (!quotes.length && !riskItems.length) {
    return (
      <div className="kpi-hub-empty">
        <p>Chưa có quote score ≥70 hoặc instance at-risk — Contract Score hiển thị khi có dữ liệu Quote OS.</p>
        <Link href="/crm/kpi-hub/instances" className="kpi-hub-btn kpi-hub-btn--ghost">
          KPI Instances
        </Link>
      </div>
    );
  }

  return (
    <div className="kpi-hub-skpi-contract">
      {quotes.length ? (
        <label className="kpi-hub-field" style={{ maxWidth: 520, marginBottom: 12 }}>
          <span>Quote</span>
          <select
            value={selected?.version_id ?? ''}
            onChange={(e) => onSelectVersion(e.target.value)}
          >
            {quotes.map((q) => (
              <option key={q.version_id} value={q.version_id}>
                {q.quote_code ?? `Proposal #${q.proposal_id}`}
                {q.client_name ? ` · ${q.client_name}` : ''} — Score {q.score}
                {q.blocked ? ' · Blocked' : ''}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {selected && liveScore ? (
        <>
          <ServiceKpiSummaryTiles
            tiles={[
              {
                label: `${selected.quote_code ?? 'Quote'} score`,
                value: liveScore.score,
                hint: liveScore.blockSubmit ? 'Block submit' : 'Internal only',
                tone: liveScore.blockSubmit ? 'critical' : liveScore.score >= 70 ? 'warn' : 'default',
              },
              {
                label: 'Classification risk',
                value: Math.round((parts?.classification ?? 0) / 0.25),
                hint: 'Client-facing KPI',
              },
              {
                label: 'Target aggressiveness',
                value: Math.round((parts?.aggressiveness ?? 0) / 0.25),
                hint: 'Vs benchmark floor',
                tone: (parts?.aggressiveness ?? 0) >= 7 ? 'warn' : 'default',
              },
              {
                label: 'Margin pressure',
                value: Math.round((parts?.margin ?? 0) / 0.15),
                hint:
                  selected.gm_bps != null
                    ? `GM ${(selected.gm_bps / 100).toFixed(1)}%`
                    : 'Chưa có GM',
                tone: liveScore.blockSubmit ? 'critical' : 'default',
              },
            ]}
          />

          <div className="kpi-hub-card" style={{ marginTop: 16 }}>
            <header className="kpi-hub-card__head">
              <h2>{selected.quote_code ?? `Proposal #${selected.proposal_id}`}</h2>
              <span className={`kpi-hub-badge kpi-hub-badge--${liveScore.blockSubmit ? 'red' : 'amber'}`}>
                Score {liveScore.score}
              </span>
            </header>
            <div className="kpi-hub-card__body">
              <div className="kpi-hub-skpi-score">
                <div className="kpi-hub-skpi-score__value">{liveScore.score}</div>
                <div className="kpi-hub-skpi-score__label">Contract Score (live · Quote Builder)</div>
              </div>
              <dl className="kpi-hub-dl">
                <div>
                  <dt>Client</dt>
                  <dd>{selected.client_name ?? '—'}</dd>
                </div>
                <div>
                  <dt>GM</dt>
                  <dd>{selected.gm_bps != null ? `${(selected.gm_bps / 100).toFixed(1)}%` : '—'}</dd>
                </div>
                {liveScore.requiredReviewers.length ? (
                  <div>
                    <dt>Reviewer bắt buộc</dt>
                    <dd>{liveScore.requiredReviewers.join(' · ')}</dd>
                  </div>
                ) : null}
                <div>
                  <dt>Công thức</dt>
                  <dd>
                    score = round(25% classification + 25% aggressiveness + 20% assumption + 15% data + 15%
                    margin). Block khi GM &lt; floor và (score ≥ 70 hoặc aggressiveness ≥ 25%).
                  </dd>
                </div>
              </dl>
              <div className="kpi-hub-skpi-contract__actions">
                <Link
                  href={`/crm/proposals/${selected.proposal_id}?tab=kpi`}
                  className="kpi-hub-btn kpi-hub-btn--primary"
                >
                  Mở Quote Builder
                </Link>
              </div>
              <p className="kpi-hub-notice">
                Internal only — không hiển thị trên public proposal. Score tính từ KPI instances gắn version +
                GM từ Quote OS.
              </p>
            </div>
          </div>
        </>
      ) : scoreLoading ? (
        <p className="kpi-hub-muted">Đang tính score…</p>
      ) : null}

      {riskItems.length ? (
        <div className="kpi-hub-table-wrap" style={{ marginTop: 16 }}>
          <h2 className="kpi-hub-section-title">Instance at-risk</h2>
          <table className="kpi-hub-table">
            <thead>
              <tr>
                <th>Source</th>
                <th>Score</th>
                <th>Status</th>
                <th>Assumption</th>
              </tr>
            </thead>
            <tbody>
              {riskItems.slice(0, 8).map((row) => (
                <tr key={row.instance_id}>
                  <td>
                    {row.dv_code ?? '—'} · {row.source_id}
                  </td>
                  <td>{row.score}</td>
                  <td>{row.status}</td>
                  <td>{row.assumption_state}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
