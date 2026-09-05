'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '@/lib/api';
import { fetchAmFinance, type AmFinanceSnapshot } from '@/lib/crm/am-api';
import {
  amFinanceAging,
  amFinanceAmountDisplay,
  amFinanceDash,
  amFinanceSyncCopy,
} from '@/lib/crm/am-finance.util';
import { useAmPage } from './AmShell';

const EMPTY_KPIS: AmFinanceSnapshot['kpis'] = {
  mrr_vnd: null,
  active_total_vnd: null,
  outstanding_vnd: null,
  overdue_vnd: null,
  next_invoice_on: null,
  next_invoice_vnd: null,
};

export function AmFinance({ agencyClientId }: { agencyClientId: string }) {
  const { token } = useAmPage();
  const [data, setData] = useState<AmFinanceSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!token || !agencyClientId) return;
    setLoading(true);
    setError('');
    try {
      setData(await fetchAmFinance(token, agencyClientId));
    } catch (err) {
      setData(null);
      setError(err instanceof ApiError && err.status === 404 ? 'not_found' : 'load_failed');
    } finally {
      setLoading(false);
    }
  }, [agencyClientId, token]);

  useEffect(() => {
    void load();
  }, [load]);

  const hidden = data?.hidden === true;
  const kpis = data?.kpis ?? EMPTY_KPIS;
  const invoices = data?.invoices ?? [];

  return (
    <section className="am-widget">
      <div className="am-widget__head">
        <div>
          <h2>Tài chính</h2>
          <p className="am-muted">
            {loading && !data ? '—' : amFinanceSyncCopy(data?.source, data?.last_sync)}
          </p>
        </div>
        <Link className="am-link" href={data?.erp_href ?? '/crm/invoices'}>
          Mở hóa đơn ERP →
        </Link>
      </div>

      {data?.stale ? <p className="am-banner">Dữ liệu đang cũ — kiểm tra đồng bộ.</p> : null}

      {error ? (
        <div className="am-widget__error">
          <p>
            {error === 'not_found'
              ? 'Không tìm thấy khách trong phạm vi của bạn.'
              : 'Không tải được snapshot tài chính.'}
          </p>
          <button type="button" className="am-btn" onClick={() => void load()}>
            Retry
          </button>
        </div>
      ) : null}

      <div className="am-tiles">
        <article className="am-tile">
          <span>MRR</span>
          <strong>{amFinanceAmountDisplay(hidden, kpis.mrr_vnd)}</strong>
        </article>
        <article className="am-tile">
          <span>Tổng active</span>
          <strong>{amFinanceAmountDisplay(hidden, kpis.active_total_vnd)}</strong>
        </article>
        <article className="am-tile">
          <span>Công nợ</span>
          <strong>{amFinanceAmountDisplay(hidden, kpis.outstanding_vnd)}</strong>
        </article>
        <article className="am-tile">
          <span>Quá hạn</span>
          <strong>{amFinanceAmountDisplay(hidden, kpis.overdue_vnd)}</strong>
        </article>
        <article className="am-tile">
          <span>Invoice sắp hạn</span>
          <strong>
            {hidden
              ? '—'
              : kpis.next_invoice_vnd == null && !kpis.next_invoice_on
                ? '—'
                : `${amFinanceDash(kpis.next_invoice_on)} · ${amFinanceAmountDisplay(false, kpis.next_invoice_vnd)}`}
          </strong>
        </article>
      </div>

      <div className="am-tbl-wrap">
        <table className="am-table">
          <thead>
            <tr>
              <th>Số HĐ</th>
              <th>Trạng thái</th>
              <th>Phát hành</th>
              <th>Hạn</th>
              <th>Số tiền</th>
              <th>Đã thu</th>
              <th>Aging</th>
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 ? (
              <tr>
                <td colSpan={7} className="am-muted">
                  {loading && !data ? '—' : 'Chưa có hóa đơn.'}
                </td>
              </tr>
            ) : (
              invoices.map((row) => (
                <tr key={row.id}>
                  <td>{amFinanceDash(row.number)}</td>
                  <td>{amFinanceDash(row.status)}</td>
                  <td>{amFinanceDash(row.issued_on)}</td>
                  <td>{amFinanceDash(row.due_on)}</td>
                  <td>{amFinanceAmountDisplay(hidden, row.amount_vnd)}</td>
                  <td>{amFinanceAmountDisplay(hidden, row.paid_vnd)}</td>
                  <td>{amFinanceAging(row.aging_days)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
