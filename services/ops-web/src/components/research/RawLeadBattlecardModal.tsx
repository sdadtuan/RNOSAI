'use client';

import type { RawLeadBattlecard } from '@/lib/market-research-api';

type Props = {
  open: boolean;
  card: RawLeadBattlecard | null;
  loading?: boolean;
  error?: string;
  onClose: () => void;
};

function Bullets({ items }: { items: string[] }) {
  if (!items.length) return <p className="muted">—</p>;
  return (
    <ul className="rlh-bc-list">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export function RawLeadBattlecardModal({
  open,
  card,
  loading,
  error,
  onClose,
}: Props) {
  if (!open) return null;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Battlecard">
      <div className="modal-card rlh-bc-modal">
        <div className="rlh-bc-head">
          <h3 style={{ margin: 0 }}>{card?.headline ?? 'Battlecard'}</h3>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
            Đóng
          </button>
        </div>

        {loading ? <p className="muted">Đang tải battlecard…</p> : null}
        {error ? <p className="rlh-inline-warn">{error}</p> : null}

        {card && !loading ? (
          <div className="rlh-bc-body">
            <div className="rlh-bc-meta">
              <span>Ưu tiên: {card.priority_tier ?? '—'}</span>
              <span>Readiness: {card.readiness_status ?? '—'}</span>
              <span>
                Score {Math.round(card.scores.quality)} · ICP {Math.round(card.scores.icp)}
                {card.scores.intent != null
                  ? ` · Intent ${Number(card.scores.intent).toFixed(2)}`
                  : ''}
              </span>
            </div>

            <section>
              <h4>Vì sao gọi ngay</h4>
              <Bullets items={card.why_call_now} />
            </section>

            <section>
              <h4>Contact</h4>
              <div className="rlh-bc-contact">
                <div>
                  SĐT:{' '}
                  {card.contact.phone ? (
                    <a href={`tel:${card.contact.phone}`}>{card.contact.phone}</a>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </div>
                <div>
                  Email:{' '}
                  {card.contact.email ? (
                    <a href={`mailto:${card.contact.email}`}>{card.contact.email}</a>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </div>
                <div>
                  Web:{' '}
                  {card.contact.website ? (
                    <a href={card.contact.website} target="_blank" rel="noreferrer">
                      {card.contact.website.replace(/^https?:\/\//i, '').slice(0, 40)}
                    </a>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </div>
                <div>Địa chỉ: {card.contact.address ?? '—'}</div>
                <div>Chức danh: {card.contact.contact_title ?? '—'}</div>
              </div>
            </section>

            <section>
              <h4>Talking points</h4>
              <Bullets items={card.talking_points} />
            </section>

            <section>
              <h4>Rủi ro</h4>
              {card.risks.length ? (
                <Bullets items={card.risks} />
              ) : (
                <p className="muted">Không có cảnh báo nổi bật.</p>
              )}
            </section>

            <section>
              <h4>Bước tiếp theo</h4>
              <ol className="rlh-bc-list rlh-bc-list--ordered">
                {card.next_actions.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
            </section>

            {card.evidence.url || card.evidence.snippet ? (
              <section>
                <h4>Evidence</h4>
                {card.evidence.url ? (
                  <p>
                    <a href={card.evidence.url} target="_blank" rel="noreferrer">
                      Mở evidence
                    </a>
                  </p>
                ) : null}
                {card.evidence.snippet ? (
                  <p className="muted rlh-bc-snippet">{card.evidence.snippet}</p>
                ) : null}
              </section>
            ) : null}

            {card.cluster.mates.length ? (
              <section>
                <h4>Cùng cluster ({card.cluster.mates.length})</h4>
                <ul className="rlh-bc-list">
                  {card.cluster.mates.map((m) => (
                    <li key={m.id}>
                      #{m.id} {m.company_name}
                      {m.priority_tier ? ` · ${m.priority_tier}` : ''}
                      {m.phone ? ` · ${m.phone}` : ''}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
