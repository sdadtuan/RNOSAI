'use client';

import Link from 'next/link';
import {
  briefingIntentLabel,
  briefingSourceLabel,
  type CeoBriefingCard,
} from '@/lib/crm/ceo-command-thread.util';

export type CeoBriefingInboxProps = {
  intent?: string;
  summary?: string;
  cards: CeoBriefingCard[];
  turnId?: string | null;
  ratingBusy?: string | null;
  onRate?: (turnId: string, rating: 'up' | 'down') => void;
};

function severityRank(sev: CeoBriefingCard['severity']): number {
  if (sev === 'red') return 0;
  if (sev === 'amber') return 1;
  return 2;
}

function severityClass(sev: CeoBriefingCard['severity']): string {
  if (sev === 'red') return 'ceo-briefing-card ceo-briefing-card--red';
  if (sev === 'amber') return 'ceo-briefing-card ceo-briefing-card--amber';
  return 'ceo-briefing-card ceo-briefing-card--ok';
}

export function CeoBriefingInbox({
  intent,
  summary,
  cards,
  turnId,
  ratingBusy,
  onRate,
}: CeoBriefingInboxProps) {
  const sorted = [...cards].sort(
    (a, b) => severityRank(a.severity) - severityRank(b.severity) || a.title.localeCompare(b.title, 'vi'),
  );
  const redCount = sorted.filter((c) => c.severity === 'red').length;
  const amberCount = sorted.filter((c) => c.severity === 'amber').length;

  return (
    <section className="ceo-briefing-inbox page-card" aria-label="Briefing CEO">
      <header className="ceo-briefing-inbox__head">
        <div>
          <h3 className="ceo-briefing-inbox__title">{briefingIntentLabel(intent)}</h3>
          <p className="ceo-briefing-inbox__subtitle">
            CEO đọc theo mức độ: đỏ → vàng → xanh · bấm thẻ để drill màn chuyên môn
          </p>
        </div>
        <div className="ceo-briefing-inbox__stats">
          <span className="ceo-briefing-stat ceo-briefing-stat--red">{redCount} đỏ</span>
          <span className="ceo-briefing-stat ceo-briefing-stat--amber">{amberCount} vàng</span>
          <span className="ceo-briefing-stat">{sorted.length} thẻ</span>
        </div>
        {turnId && onRate ? (
          <div className="ceo-briefing-inbox__rate">
            <span className="muted text-sm">Hữu ích?</span>
            <button
              type="button"
              className="btn btn-xs btn-ghost"
              disabled={ratingBusy === turnId}
              aria-label="Hữu ích"
              onClick={() => onRate(turnId, 'up')}
            >
              👍
            </button>
            <button
              type="button"
              className="btn btn-xs btn-ghost"
              disabled={ratingBusy === turnId}
              aria-label="Chưa hữu ích"
              onClick={() => onRate(turnId, 'down')}
            >
              👎
            </button>
          </div>
        ) : null}
      </header>

      {summary ? <p className="ceo-briefing-inbox__summary">{summary}</p> : null}

      {sorted.length === 0 ? (
        <p className="ceo-briefing-inbox__empty">Không có thẻ cảnh báo — mọi nguồn ổn định.</p>
      ) : (
        <ul className="ceo-briefing-grid">
          {sorted.map((card) => (
            <li key={`${card.source ?? 'x'}-${card.title}-${card.href}`} className={severityClass(card.severity)}>
              <div className="ceo-briefing-card__head">
                <span className={`ceo-briefing-card__sev ceo-briefing-card__sev--${card.severity}`}>
                  {card.severity === 'red' ? 'Đỏ' : card.severity === 'amber' ? 'Vàng' : 'Ổn'}
                </span>
                <span className="ceo-briefing-card__source">{briefingSourceLabel(card.source)}</span>
              </div>
              <Link href={card.href} className="ceo-briefing-card__title">
                {card.title}
              </Link>
              {card.metric ? <p className="ceo-briefing-card__metric">{card.metric}</p> : null}
              <Link href={card.href} className="ceo-briefing-card__cta">
                Xem chi tiết →
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
