'use client';

import Link from 'next/link';

interface Props {
  canCreate: boolean;
  blockReason: string;
  proposalsHref: string;
  canExportPack: boolean;
}

export function DealRoomQuotePanel({ canCreate, blockReason, proposalsHref, canExportPack }: Props) {
  return (
    <section className="deal-room-panel" aria-label="Quote">
      <div className="deal-room-panel__head">
        <h3 className="deal-room-panel__title">Báo giá</h3>
      </div>
      <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
        Gói Basic / Standard / Premium — liên kết catalog DV (F4). Pack PDF merge L1 + quote (F2).
      </p>

      {!canCreate && blockReason ? (
        <ul className="deal-room-checklist deal-room-checklist--block" style={{ marginTop: '0.75rem' }}>
          <li>{blockReason}</li>
        </ul>
      ) : null}

      <div className="deal-room-actions" style={{ marginTop: '1rem' }}>
        <Link
          href={proposalsHref}
          className={`btn btn-sm ${canCreate ? 'btn-primary' : 'btn-secondary'}`}
          aria-disabled={!canCreate}
          style={canCreate ? undefined : { pointerEvents: 'none', opacity: 0.55 }}
        >
          Tạo báo giá →
        </Link>
        <button type="button" className="btn btn-sm btn-secondary" disabled title="Sprint F2 — Plan+Quote Pack PDF">
          Export Pack PDF (F2)
        </button>
        {canExportPack ? (
          <span className="muted" style={{ fontSize: '0.8rem' }}>
            Pack PDF sẵn sàng khi bật F2
          </span>
        ) : null}
      </div>
    </section>
  );
}
