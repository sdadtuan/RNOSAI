'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchRevopsPipeline,
  type RevopsPipelineDto,
  type RevopsPipelineStage,
} from '@/lib/crm/revops-api';
import { formatRevopsVndCompact } from '@/lib/crm/revops-format';
import { RevOpsQuickCreateButton, useRevopsModals } from './RevOpsModalsProvider';
import { useRevopsPage } from './RevOpsShell';

type PipelineTab = 'kanban' | 'list' | 'forecast' | 'winloss';

const STAGE_LABEL: Record<RevopsPipelineStage, string> = {
  discovery: 'Discovery',
  qualified: 'Qualified',
  proposal: 'Proposal',
  negotiation: 'Negotiation',
  contract_review: 'Contract Review',
};

function riskTagClass(risk: string | null): string {
  if (!risk) return 'revops-tag revops-tag--gray';
  if (risk.includes('Quá hạn') || risk.includes('Không activity')) {
    return 'revops-tag revops-tag--red';
  }
  if (risk.includes('aging') || risk.includes('Thiếu')) {
    return 'revops-tag revops-tag--orange';
  }
  return 'revops-tag revops-tag--gray';
}

export function RevOpsPipelinePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { token } = useRevopsPage();
  const { openDeal, openQuote } = useRevopsModals();

  const tab = (searchParams.get('tab') ?? 'kanban') as PipelineTab;
  const scope = searchParams.get('scope') ?? undefined;
  const apiView = tab === 'list' ? 'list' : 'kanban';

  const [data, setData] = useState<RevopsPipelineDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!token || tab === 'forecast' || tab === 'winloss') {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const out = await fetchRevopsPipeline(token, { view: apiView, scope });
      setData(out);
    } catch (err) {
      setData(null);
      setError(err instanceof Error ? err.message : 'Không tải được pipeline');
    } finally {
      setLoading(false);
    }
  }, [apiView, scope, tab, token]);

  useEffect(() => {
    void load();
  }, [load]);

  function setTab(next: PipelineTab) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', next);
    router.replace(`/crm/revenue-ops/pipeline?${params.toString()}`);
  }

  const allCards = useMemo(
    () => (data?.columns ?? []).flatMap((col) => col.cards.map((card) => ({ ...card, stage: col.stage }))),
    [data?.columns],
  );

  return (
    <>
      <header className="revops-page-head">
        <div>
          <h1>Pipeline & Deal Management</h1>
          <p>Kanban pipeline theo giai đoạn presales — click deal để mở Deal Room.</p>
        </div>
        <div className="revops-page-actions">
          <button type="button" className="revops-btn" onClick={() => openQuote()}>
            Tạo báo giá
          </button>
          <button type="button" className="revops-btn revops-btn--primary" onClick={() => openDeal()}>
            ＋ Tạo deal
          </button>
          <RevOpsQuickCreateButton />
        </div>
      </header>

      <div className="revops-tabs revops-section">
        <button
          type="button"
          className={`revops-tab${tab === 'kanban' ? ' is-active' : ''}`}
          onClick={() => setTab('kanban')}
        >
          Kanban
        </button>
        <button
          type="button"
          className={`revops-tab${tab === 'list' ? ' is-active' : ''}`}
          onClick={() => setTab('list')}
        >
          List
        </button>
        <button
          type="button"
          className={`revops-tab${tab === 'forecast' ? ' is-active' : ''}`}
          onClick={() => setTab('forecast')}
        >
          Forecast
        </button>
        <button
          type="button"
          className={`revops-tab${tab === 'winloss' ? ' is-active' : ''}`}
          onClick={() => setTab('winloss')}
        >
          Win/Loss
        </button>
      </div>

      {tab === 'forecast' ? (
        <section className="revops-card revops-section">
          <h2>Forecast</h2>
          <p className="revops-muted">Wave 3 — commit forecast và coverage theo kỳ.</p>
        </section>
      ) : null}

      {tab === 'winloss' ? (
        <section className="revops-card revops-section">
          <h2>Win/Loss Analysis</h2>
          <p className="revops-muted">Wave 4 — phân tích win rate và lost reasons.</p>
        </section>
      ) : null}

      {tab !== 'forecast' && tab !== 'winloss' ? (
        <>
          {loading && !data ? <p className="revops-muted">Đang tải pipeline…</p> : null}
          {error ? (
            <div className="revops-widget revops-widget--error">
              <p>{error}</p>
              <button type="button" className="revops-btn" onClick={() => void load()}>
                Thử lại
              </button>
            </div>
          ) : null}

          {data ? (
            <>
              <div className="revops-kpi-grid revops-section">
                <article className="revops-metric-card">
                  <p className="revops-metric-label">Total pipeline</p>
                  <p className="revops-metric-value">{formatRevopsVndCompact(data.kpis.totalVnd)}</p>
                </article>
                <article className="revops-metric-card">
                  <p className="revops-metric-label">Weighted pipeline</p>
                  <p className="revops-metric-value">{formatRevopsVndCompact(data.kpis.weightedVnd)}</p>
                </article>
                <article className="revops-metric-card">
                  <p className="revops-metric-label">Commit (neg + contract)</p>
                  <p className="revops-metric-value">{formatRevopsVndCompact(data.kpis.commitVnd)}</p>
                </article>
                <article className="revops-metric-card">
                  <p className="revops-metric-label">Stale deals</p>
                  <p className="revops-metric-value">{data.kpis.staleCount}</p>
                  <small className="revops-metric-hint">Close date đã qua, chưa won</small>
                </article>
              </div>

              {tab === 'kanban' ? (
                <div className="revops-kanban revops-section" data-testid="revops-pipeline-kanban">
                  {data.columns.map((col) => (
                    <section key={col.stage} className="revops-kanban-col" data-stage={col.stage}>
                      <header className="revops-kanban-col__head">
                        <h3>{STAGE_LABEL[col.stage]}</h3>
                        <span className="revops-tag revops-tag--blue">
                          {col.count} · {formatRevopsVndCompact(col.valueVnd)}
                        </span>
                      </header>
                      <div className="revops-kanban-col__body">
                        {col.cards.length === 0 ? (
                          <p className="revops-muted revops-kanban-empty">—</p>
                        ) : (
                          col.cards.map((card) => (
                            <Link
                              key={card.id}
                              href={card.href}
                              className="revops-kanban-card"
                              data-testid={`pipeline-card-${card.leadId}`}
                            >
                              <div className="revops-kanban-card__top">
                                <strong>{card.name}</strong>
                                {card.risk ? (
                                  <span className={riskTagClass(card.risk)}>{card.risk}</span>
                                ) : null}
                              </div>
                              <p className="revops-sub">{card.product}</p>
                              <div className="revops-kanban-card__meta">
                                <span>{formatRevopsVndCompact(card.amountVnd)}</span>
                                {card.closeDate ? (
                                  <span>Close {card.closeDate.slice(0, 10)}</span>
                                ) : null}
                              </div>
                              <p className="revops-sub">{card.owner}</p>
                            </Link>
                          ))
                        )}
                      </div>
                    </section>
                  ))}
                </div>
              ) : (
                <section className="revops-card revops-section">
                  <div className="revops-table-wrap">
                    <table className="revops-table">
                      <thead>
                        <tr>
                          <th>Deal</th>
                          <th>Stage</th>
                          <th>Product</th>
                          <th>Amount</th>
                          <th>Close</th>
                          <th>Owner</th>
                          <th>Risk</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {allCards.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="revops-muted">
                              —
                            </td>
                          </tr>
                        ) : (
                          allCards.map((card) => (
                            <tr key={card.id}>
                              <td>{card.name}</td>
                              <td>{STAGE_LABEL[card.stage]}</td>
                              <td>{card.product}</td>
                              <td>{formatRevopsVndCompact(card.amountVnd)}</td>
                              <td>{card.closeDate?.slice(0, 10) ?? '—'}</td>
                              <td>{card.owner}</td>
                              <td>
                                {card.risk ? (
                                  <span className={riskTagClass(card.risk)}>{card.risk}</span>
                                ) : (
                                  '—'
                                )}
                              </td>
                              <td>
                                <Link className="revops-btn revops-btn--sm" href={card.href}>
                                  Deal Room
                                </Link>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              <p className="revops-muted revops-freshness">
                Dữ liệu lúc {new Date(data.fetchedAt).toLocaleString('vi-VN')}
              </p>
            </>
          ) : null}
        </>
      ) : null}
    </>
  );
}
