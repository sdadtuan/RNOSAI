'use client';

interface Props {
  actionLabel: string;
  reason: string;
  confidence?: number;
  loading?: boolean;
  onAccept?: () => void;
  onDismiss?: () => void;
}

export function NbaCard({ actionLabel, reason, confidence, loading, onAccept, onDismiss }: Props) {
  return (
    <section className="nba-card" aria-label="Next best action">
      <div className="nba-card__header">
        <span className="nba-card__badge">NBA</span>
        <h4 className="nba-card__title">{actionLabel}</h4>
      </div>
      <p className="nba-card__reason">{reason}</p>
      {confidence != null ? (
        <p className="muted nba-card__confidence">Độ tin cậy: {Math.round(confidence * 100)}%</p>
      ) : null}
      <div className="nba-card__actions">
        <button type="button" className="btn btn-primary btn-sm" disabled={loading} onClick={onAccept}>
          Chấp nhận
        </button>
        <button type="button" className="btn btn-secondary btn-sm" disabled={loading} onClick={onDismiss}>
          Bỏ
        </button>
      </div>
    </section>
  );
}
