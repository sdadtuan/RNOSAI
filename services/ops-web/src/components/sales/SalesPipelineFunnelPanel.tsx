'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { DealScoreMiniBar } from '@/components/ai/DealScoreMiniBar';
import { NbaCard } from '@/components/ai/NbaCard';
import { ScoreCard } from '@/components/ai/ScoreCard';
import {
  fetchAiRecommendations,
  fetchAiScoresBatch,
  patchAiRecommendation,
  postAiNextBestAction,
  postAiScoreDeal,
  type AiScoreRecord,
  type NextBestActionResponse,
} from '@/lib/ai-api';

export interface PipelineCaseRow {
  id: number;
  title: string;
  pipeline_stage: string;
  pipeline_stage_label?: string;
  deal_value_vnd?: number;
  customer_name?: string;
  staff_name?: string;
}

interface Props {
  token: string;
  rows: PipelineCaseRow[];
  stageLabels: Record<string, string>;
  stages: string[];
}

export function SalesPipelineFunnelPanel({ token, rows, stageLabels, stages }: Props) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [scoreMap, setScoreMap] = useState<Record<string, { score_value: number; score_band: string }>>({});
  const [dealScore, setDealScore] = useState<AiScoreRecord | null>(null);
  const [nba, setNba] = useState<NextBestActionResponse['data'] | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const selected = useMemo(() => rows.find((r) => r.id === selectedId) ?? null, [rows, selectedId]);

  const loadScores = useCallback(async () => {
    if (!rows.length) return;
    try {
      const batch = await fetchAiScoresBatch(
        token,
        'deal',
        rows.map((r) => r.id),
      );
      setScoreMap(batch);
    } catch {
      setScoreMap({});
    }
  }, [rows, token]);

  useEffect(() => {
    void loadScores();
  }, [loadScores]);

  const openDeal = useCallback(
    async (dealId: number) => {
      setSelectedId(dealId);
      setMessage('');
      setNba(null);
      setDealScore(null);
      setBusy(true);
      try {
        const scored = await postAiScoreDeal(token, dealId);
        setDealScore({
          id: scored.data.agent_run_id,
          score_value: scored.data.score,
          confidence: scored.data.confidence,
          explainability_json: scored.data.explainability,
          model_name: 'deal-rules-v1',
          calculated_at: new Date().toISOString(),
        } as AiScoreRecord);
        const recs = await fetchAiRecommendations(token, 'deal', dealId, { status: 'pending' });
        const pendingNba = recs.data.recommendations.find((r) => r.recommendation_type === 'nba');
        if (pendingNba) {
          setNba({
            recommendation_id: String(pendingNba.id),
            deal_id: dealId,
            action: String((pendingNba.action_json as Record<string, unknown>)?.action ?? 'call_back'),
            action_label: String((pendingNba.action_json as Record<string, unknown>)?.action_label ?? 'Gọi lại'),
            reason: String((pendingNba.action_json as Record<string, unknown>)?.reason ?? pendingNba.recommendation_text),
            confidence: Number(pendingNba.confidence ?? 0.6),
            status: String(pendingNba.status ?? 'pending'),
            recommendation_text: String(pendingNba.recommendation_text ?? ''),
            agent_run_id: String(pendingNba.agent_run_id ?? ''),
          });
        } else {
          try {
            const nbaOut = await postAiNextBestAction(token, dealId);
            setNba(nbaOut.data);
          } catch {
            /* not stalled — no NBA */
          }
        }
        await loadScores();
      } catch (e) {
        setMessage(e instanceof Error ? e.message : 'Không tải deal AI');
      } finally {
        setBusy(false);
      }
    },
    [loadScores, token],
  );

  const acceptNba = async () => {
    if (!nba) return;
    setBusy(true);
    try {
      await patchAiRecommendation(token, nba.recommendation_id, { status: 'accepted' });
      setMessage('Đã chấp nhận NBA — ghi case event.');
      setNba(null);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Chấp nhận NBA thất bại');
    } finally {
      setBusy(false);
    }
  };

  const dismissNba = async () => {
    if (!nba) return;
    setBusy(true);
    try {
      await patchAiRecommendation(token, nba.recommendation_id, {
        status: 'dismissed',
        dismiss_reason: 'not_relevant',
      });
      setNba(null);
      setMessage('Đã bỏ gợi ý NBA.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Bỏ NBA thất bại');
    } finally {
      setBusy(false);
    }
  };

  const columns = stages.filter((s) => s !== 'chot' && s !== 'mat');

  return (
    <div className="sales-pipeline-panel">
      <p className="muted">UI-R2-02 kanban · RNOS-09 deal score · RNOS-10 NBA</p>
      {message ? <p className="sales-pipeline-panel__message">{message}</p> : null}
      <div className="sales-pipeline-kanban">
        {columns.map((stage) => {
          const cards = rows.filter((r) => r.pipeline_stage === stage);
          return (
            <div key={stage} className="sales-pipeline-column">
              <h4>{stageLabels[stage] ?? stage}</h4>
              <ul className="sales-pipeline-cards">
                {cards.map((row) => (
                  <li key={row.id}>
                    <button
                      type="button"
                      className={`sales-pipeline-card${selectedId === row.id ? ' is-selected' : ''}`}
                      onClick={() => void openDeal(row.id)}
                    >
                      <strong>{row.title}</strong>
                      <span className="muted">{row.customer_name || `#${row.id}`}</span>
                      <DealScoreMiniBar summary={scoreMap[String(row.id)]} />
                      {nba && selectedId === row.id ? <span className="nba-card__badge">NBA</span> : null}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
      {selected ? (
        <div className="sales-pipeline-drawer card">
          <h3>{selected.title}</h3>
          <p className="muted">
            {selected.pipeline_stage_label ?? selected.pipeline_stage} ·{' '}
            {Number(selected.deal_value_vnd ?? 0).toLocaleString('vi-VN')} VND
          </p>
          {busy ? <p className="muted">Đang tải AI…</p> : null}
          <ScoreCard score={dealScore} title="Điểm deal" />
          {nba ? (
            <NbaCard
              actionLabel={nba.action_label}
              reason={nba.reason}
              confidence={nba.confidence}
              loading={busy}
              onAccept={() => void acceptNba()}
              onDismiss={() => void dismissNba()}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
