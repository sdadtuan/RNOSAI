'use client';

import type { AiExplainability, AiScoreRecord } from '@/lib/ai-api';

const BAND_LABELS: Record<string, string> = {
  hot: 'NÓNG',
  warm: 'ẤM',
  cold: 'LẠNH',
};

interface Props {
  score: AiScoreRecord | null;
  pending?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  refreshing?: boolean;
  title?: string;
}

export function ScoreCard({ score, pending, error, onRefresh, refreshing, title = 'Điểm lead' }: Props) {
  if (pending) {
    return (
      <section className="ai-score-card" aria-busy="true" aria-label="Điểm lead đang cập nhật">
        <div className="ai-score-card__header">
          <h4 className="ai-score-card__title">{title}</h4>
        </div>
        <div className="ai-skeleton ai-skeleton--score" />
        <p className="muted ai-score-card__pending">Score đang cập nhật…</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="ai-score-card" aria-label="Điểm lead">
        <div className="ai-score-card__header">
          <h4 className="ai-score-card__title">{title}</h4>
          {onRefresh ? (
            <button type="button" className="btn btn-sm btn-secondary" onClick={onRefresh} disabled={refreshing}>
              {refreshing ? '…' : '↻'}
            </button>
          ) : null}
        </div>
        <p className="error">{error}</p>
      </section>
    );
  }

  if (!score) {
    return (
      <section className="ai-score-card" aria-label="Điểm lead">
        <div className="ai-score-card__header">
          <h4 className="ai-score-card__title">{title}</h4>
          {onRefresh ? (
            <button type="button" className="btn btn-sm btn-secondary" onClick={onRefresh} disabled={refreshing}>
              {refreshing ? '…' : '↻'}
            </button>
          ) : null}
        </div>
        <p className="muted">Chưa có điểm — tạo lead mới sẽ được chấm trong ~30 giây.</p>
      </section>
    );
  }

  const explain: AiExplainability = score.explainability_json ?? {
    factors: [],
    flags: [],
    score_band: 'warm',
  };
  const band = explain.score_band ?? 'warm';
  const confidence = score.confidence ?? 0;

  return (
    <section className="ai-score-card" aria-label="Điểm lead">
      <div className="ai-score-card__header">
        <h4 className="ai-score-card__title">{title}</h4>
        {onRefresh ? (
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={onRefresh}
            disabled={refreshing}
            aria-label="Làm mới điểm"
          >
            {refreshing ? '…' : '↻'}
          </button>
        ) : null}
      </div>
      <div className="ai-score-gauge">
        <span className="ai-score-gauge__value">{Math.round(score.score_value)}</span>
        <span className={`ai-score-gauge__band ai-score-gauge__band--${band}`}>
          {BAND_LABELS[band] ?? band.toUpperCase()}
        </span>
      </div>
      <p className="muted ai-score-card__confidence">
        Độ tin cậy: {Math.round(confidence * 100)}%
      </p>
      <ExplainabilityChips explain={explain} />
    </section>
  );
}

function ExplainabilityChips({ explain }: { explain: AiExplainability }) {
  const factors = explain.factors ?? [];
  if (!factors.length && !(explain.flags?.length)) {
    return <p className="muted">Chưa có yếu tố giải thích.</p>;
  }
  return (
    <ul className="ai-explain-chips" aria-label="Yếu tố giải thích">
      {factors.map((f) => (
        <li
          key={f.key}
          className={`ai-explain-chip ai-explain-chip--${f.sign === '+' ? 'pos' : 'neg'}`}
        >
          <span className="ai-explain-chip__sign">{f.sign}</span>
          {f.label}
        </li>
      ))}
      {(explain.flags ?? []).map((flag) => (
        <li key={flag} className="ai-explain-chip ai-explain-chip--flag">
          {flag}
        </li>
      ))}
    </ul>
  );
}
