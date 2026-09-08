import React from 'react';
import { dash } from '@/lib/crm/qt-format';

export type QtStickyMoney = {
  fee_vnd: number | null;
  media_vnd: number | null;
  discount_vnd: number | null;
  tax_vnd: number | null;
  payable_vnd: number | null;
  nsr_vnd?: number | null;
  gm_bps?: number | null;
};

export type QtStickyPayment = {
  pct_bps: number;
  amount_vnd: number | null;
  milestone?: string;
};

export function formatQtVnd(value: number | null | undefined): string {
  if (value == null) return dash(null);
  return `${value.toLocaleString('vi-VN')} ₫`;
}

export function formatQtPctBps(bps: number | null | undefined): string {
  if (bps == null) return dash(null);
  return `${(bps / 100).toLocaleString('vi-VN')}%`;
}

export function formatQtGm(bps: number | null | undefined): string {
  if (bps == null) return dash(null);
  return `${(bps / 100).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%`;
}

export function QtStickyCommercial({
  money,
  payments,
  hasFinance,
  onEditPayments,
}: {
  money: QtStickyMoney;
  payments: QtStickyPayment[];
  hasFinance: boolean;
  onEditPayments?: () => void;
}) {
  return (
    <aside className="qt-sticky" aria-label="Tóm tắt thương mại">
      <section className="qt-card">
        <header className="qt-card__head">
          <b>Tóm tắt đầu tư</b>
          <span className="qt-muted">client-facing</span>
        </header>
        <div className="qt-side-row">
          <span>Phí dịch vụ</span>
          <b>{formatQtVnd(money.fee_vnd)}</b>
        </div>
        <div className="qt-side-row">
          <span>Media (pass-through)</span>
          <b>{formatQtVnd(money.media_vnd)}</b>
        </div>
        <div className="qt-side-row">
          <span>Chiết khấu package</span>
          <b>{formatQtVnd(money.discount_vnd)}</b>
        </div>
        <div className="qt-side-row">
          <span>VAT (snapshot)</span>
          <b>{formatQtVnd(money.tax_vnd)}</b>
        </div>
        <div className="qt-side-row qt-side-row--total">
          <span>Tổng phải thu</span>
          <b>{formatQtVnd(money.payable_vnd)}</b>
        </div>
      </section>

      {hasFinance ? (
        <section className="qt-card" data-section="finance">
          <header className="qt-card__head">
            <b>Sức khỏe nội bộ</b>
            <span className="qt-muted">finance</span>
          </header>
          <div className="qt-side-row">
            <span>NSR (fee only)</span>
            <b>{formatQtVnd(money.nsr_vnd ?? null)}</b>
          </div>
          <div className="qt-side-row">
            <span>Gross margin</span>
            <b>{formatQtGm(money.gm_bps ?? null)}</b>
          </div>
          <p className="qt-muted">Media không vào NSR.</p>
        </section>
      ) : null}

      <section className="qt-card">
        <header className="qt-card__head">
          <b>Thanh toán</b>
          {onEditPayments ? (
            <button type="button" className="qt-link" onClick={onEditPayments}>
              Sửa
            </button>
          ) : null}
        </header>
        {payments.length ? (
          payments.map((row, index) => (
            <div className="qt-flow" key={`${row.pct_bps}-${index}`}>
              <span className="qt-flow__num">{index + 1}</span>
              <div>
                <b>
                  {formatQtPctBps(row.pct_bps)} · {formatQtVnd(row.amount_vnd)}
                </b>
                <span className="qt-muted">{row.milestone || dash(null)}</span>
              </div>
            </div>
          ))
        ) : (
          <p className="qt-empty">{dash(null)}</p>
        )}
      </section>
    </aside>
  );
}
