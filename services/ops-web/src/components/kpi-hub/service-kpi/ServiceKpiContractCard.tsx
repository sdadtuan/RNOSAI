'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { MOAT_CONTRACT } from '@/lib/service-kpi-copy';
import { ServiceKpiSummaryTiles } from '@/components/kpi-hub/service-kpi/ServiceKpiSummaryTiles';
import { SkpiTwoColumnLayout } from './SkpiTwoColumnLayout';
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

function formatVnd(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${Math.round(value).toLocaleString('vi-VN')} ₫`;
}

function gateToneClass(tone: string): string {
  if (tone === 'critical') return ' is-critical';
  if (tone === 'warn') return ' is-warn';
  if (tone === 'ok') return ' is-ok';
  return '';
}

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
  const selected = quotes.find((q) => q.version_id === selectedVersionId) ?? quotes[0] ?? null;

  const topAggressive = useMemo(() => {
    const kpis = liveScore?.kpis ?? [];
    return [...kpis].sort((a, b) => (b.aggressiveness_pct ?? 0) - (a.aggressiveness_pct ?? 0))[0] ?? null;
  }, [liveScore?.kpis]);

  if (loading) return <p className="kpi-hub-muted">Đang tải contract risk…</p>;
  if (error) return <p className="kpi-hub-form-error">{error}</p>;

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

  const gmPct = selected?.gm_bps != null ? selected.gm_bps / 100 : liveScore?.gm_bps != null ? liveScore.gm_bps / 100 : null;
  const gmFloorPct =
    liveScore?.gm_floor_bps != null ? liveScore.gm_floor_bps / 100 : 25;
  const scoreHint =
    liveScore?.blockSubmit && gmPct != null
      ? `Block submit · GM ${gmPct.toFixed(1)}%${topAggressive ? ` + ${topAggressive.dictionary_id}` : ''}`
      : liveScore?.score != null && liveScore.score >= 70
        ? 'Score ≥ 70 — theo dõi duyệt'
        : 'Internal only';

  return (
    <div className="kpi-hub-skpi-contract">
      {quotes.length ? (
        <label className="kpi-hub-field kpi-hub-skpi-contract__picker">
          <span>Quote</span>
          <select value={selected?.version_id ?? ''} onChange={(e) => onSelectVersion(e.target.value)}>
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

      {scoreLoading ? <p className="kpi-hub-muted">Đang tính Contract Score…</p> : null}

      {selected && liveScore ? (
        <>
          <ServiceKpiSummaryTiles
            tiles={[
              {
                label: `${selected.quote_code ?? 'QT'} SCORE`,
                value: liveScore.score,
                hint: scoreHint,
                tone: liveScore.blockSubmit ? 'critical' : liveScore.score >= 70 ? 'warn' : 'default',
              },
              {
                label: 'CLASSIFICATION RISK',
                value: liveScore.classification_risk ?? Math.round((liveScore.parts.classification ?? 0) / 0.25),
                hint: liveScore.classification_hint ?? 'Forecast client-facing',
                tone: (liveScore.classification_risk ?? 0) >= 40 ? 'warn' : 'default',
              },
              {
                label: 'TARGET AGGRESSIVENESS',
                value: liveScore.target_aggressiveness ?? Math.round((liveScore.parts.aggressiveness ?? 0) / 0.25),
                hint: topAggressive
                  ? `${topAggressive.dictionary_id} ${formatVnd(topAggressive.target_min ?? topAggressive.target_max)}${
                      topAggressive.aggressiveness_pct != null
                        ? ` (−${topAggressive.aggressiveness_pct}%)`
                        : ''
                    }`
                  : 'Vs benchmark floor',
                tone: (liveScore.target_aggressiveness ?? 0) >= 25 ? 'critical' : 'warn',
              },
              {
                label: 'MARGIN PRESSURE',
                value: liveScore.margin_pressure ?? Math.round((liveScore.parts.margin ?? 0) / 0.15),
                hint:
                  gmPct != null
                    ? `GM ${gmPct.toFixed(1)}% ${gmPct < gmFloorPct ? `< floor ${gmFloorPct}%` : ''}`
                    : 'Chưa có GM',
                tone: liveScore.blockSubmit ? 'critical' : 'default',
              },
            ]}
          />

          <SkpiTwoColumnLayout
            className="kpi-hub-skpi-contract-layout"
            main={
              <div className="kpi-hub-skpi-contract__main">
              <section className="kpi-hub-card">
                <header className="kpi-hub-card__head">
                  <h2>Cổng duyệt — cùng lúc GM + Score</h2>
                  <span className={`kpi-hub-badge kpi-hub-badge--${liveScore.blockSubmit ? 'red' : 'green'}`}>
                    {liveScore.blockSubmit ? 'Blocked' : 'Clear'}
                  </span>
                </header>
                <div className="kpi-hub-card__body">
                  <p className="kpi-hub-notice">
                    <strong>Trigger:</strong> {liveScore.trigger_summary ?? '—'}{' '}
                    {liveScore.trigger_policy ? `Policy: ${liveScore.trigger_policy}` : null}
                  </p>
                  <ul className="kpi-hub-skpi-gate-list">
                    {(liveScore.gate_rows ?? []).map((row) => (
                      <li key={row.label} className={`kpi-hub-skpi-gate-row${gateToneClass(row.tone)}`}>
                        <span>{row.label}</span>
                        <b>{row.value}</b>
                      </li>
                    ))}
                  </ul>
                  {liveScore.requiredReviewers.length ? (
                    <p className="kpi-hub-muted" style={{ marginTop: 10 }}>
                      Reviewer: {liveScore.requiredReviewers.join(' · ')}
                    </p>
                  ) : null}
                  <div className="kpi-hub-skpi-contract__actions">
                    <Link
                      href={`/crm/proposals/${selected.proposal_id}?tab=options`}
                      className="kpi-hub-btn kpi-hub-btn--primary"
                    >
                      Bắt buộc phương án B
                    </Link>
                    <Link href="/crm/proposals/approvals" className="kpi-hub-btn kpi-hub-btn--ghost">
                      Xin waiver
                    </Link>
                    <Link
                      href={`/crm/proposals/${selected.proposal_id}?tab=kpi`}
                      className="kpi-hub-btn kpi-hub-btn--ghost"
                    >
                      Mở Quote Builder
                    </Link>
                  </div>
                </div>
              </section>

              <section className="kpi-hub-card">
                <header className="kpi-hub-card__head">
                  <h2>Vì sao đối thủ không làm được</h2>
                </header>
                <div className="kpi-hub-card__body">
                  <p className="kpi-hub-muted kpi-hub-skpi-contract__moat">{MOAT_CONTRACT}</p>
                </div>
              </section>

              {liveScore.kpis?.length ? (
                <section className="kpi-hub-card">
                  <header className="kpi-hub-card__head">
                    <h2>KPI instances · version</h2>
                  </header>
                  <div className="kpi-hub-table-wrap">
                    <table className="kpi-hub-table">
                      <thead>
                        <tr>
                          <th>KPI</th>
                          <th>Classification</th>
                          <th>Target</th>
                          <th>Assumption</th>
                          <th>Aggressiveness</th>
                        </tr>
                      </thead>
                      <tbody>
                        {liveScore.kpis.map((row) => (
                          <tr key={row.dictionary_id}>
                            <td>{row.dictionary_id}</td>
                            <td>{row.classification.replace(/_/g, ' ')}</td>
                            <td>
                              {formatVnd(row.target_min)} – {formatVnd(row.target_max)}
                            </td>
                            <td>{row.assumption_state}</td>
                            <td>{row.aggressiveness_pct != null ? `${row.aggressiveness_pct}%` : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ) : null}
              </div>
            }
            aside={
              <article className="kpi-hub-card kpi-hub-skpi-contract__aside">
                <header className="kpi-hub-card__head">
                  <h2>Công thức (internal)</h2>
                </header>
                <div className="kpi-hub-card__body">
                  <div className="kpi-hub-skpi-formula">
                    <code>Risk = 0.25 Class + 0.25 Aggr + 0.20 Assume + 0.15 Data + 0.15 Margin</code>
                  </div>
                  <ul className="kpi-hub-skpi-gate-list" style={{ marginTop: 12 }}>
                    <li className="kpi-hub-skpi-gate-row is-ok">
                      <span>Public API</span>
                      <b>Không trả score</b>
                    </li>
                    <li className="kpi-hub-skpi-gate-row">
                      <span>Assumption mở</span>
                      <b>{liveScore.assumption_open ?? 0}%</b>
                    </li>
                    <li className="kpi-hub-skpi-gate-row">
                      <span>Data readiness gap</span>
                      <b>{liveScore.data_readiness_gap ?? 0}%</b>
                    </li>
                  </ul>
                </div>
              </article>
            }
          />
        </>
      ) : null}

      {!liveScore && !scoreLoading && riskItems.length ? (
        <div className="kpi-hub-table-wrap" style={{ marginTop: 16 }}>
          <h2 className="kpi-hub-section-title">Instance at-risk (chưa có quote version)</h2>
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
