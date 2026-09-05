'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '@/lib/api';
import { fetchAmContract, type AmContractDetail as AmContractDetailData } from '@/lib/crm/am-api';
import {
  AM_CONTRACT_TABS,
  amContractAmountDisplay,
  amContractDash,
  amContractDaysCopy,
  amContractLoadErrorCopy,
  amContractLoadErrorKind,
  formatAmContractDate,
  parseAmContractTab,
  type AmContractLoadError,
  type AmContractTabId,
} from '@/lib/crm/am-contract.util';
import { AmDocumentsPanel } from './AmDocumentsPanel';
import { AmPlaceholder } from './AmPlaceholder';
import { useAmPage } from './AmShell';

function statusClass(status: string): string {
  if (/active|renewing/i.test(status)) return 'am-pill am-pill--ok';
  if (/paused|draft/i.test(status)) return 'am-pill am-pill--watch';
  if (/cancel|lost|churn/i.test(status)) return 'am-pill am-pill--crit';
  return 'am-pill';
}

export function AmContractDetail({ contractId }: { contractId: string }) {
  const { token, canEdit } = useAmPage();
  const router = useRouter();
  const pathname = usePathname() ?? `/crm/account-management/contracts/${contractId}`;
  const searchParams = useSearchParams();
  const tab = parseAmContractTab(searchParams.get('tab'));

  const [data, setData] = useState<AmContractDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<AmContractLoadError | ''>('');

  const load = useCallback(async () => {
    if (!token || !contractId) return;
    setLoading(true);
    setError('');
    try {
      setData(await fetchAmContract(token, contractId));
    } catch (err) {
      setData(null);
      setError(amContractLoadErrorKind(err instanceof ApiError ? err.status : undefined));
    } finally {
      setLoading(false);
    }
  }, [contractId, token]);

  useEffect(() => {
    void load();
  }, [load]);

  function setTab(next: AmContractTabId) {
    const qs = new URLSearchParams(searchParams.toString());
    if (next === 'overview') qs.delete('tab');
    else qs.set('tab', next);
    const suffix = qs.toString();
    router.replace(suffix ? `${pathname}?${suffix}` : pathname);
  }

  if (loading) {
    return (
      <section className="am-page">
        <p className="am-muted">Đang tải hợp đồng…</p>
      </section>
    );
  }

  if (error || !data) {
    const kind: AmContractLoadError = error === 'not_found' ? 'not_found' : 'load_failed';
    return (
      <section className="am-page">
        <p className="am-crumb">
          <Link href="/crm/account-management/clients">Khách hàng</Link>
        </p>
        <div className="am-widget__error">
          <p>{amContractLoadErrorCopy(kind)}</p>
          <button type="button" className="am-btn" onClick={() => void load()}>
            Retry
          </button>
        </div>
      </section>
    );
  }

  const heading = data.reference_code || data.title || '—';
  const range = `${formatAmContractDate(data.starts_on)}–${formatAmContractDate(data.ends_on)}`;
  const amount = amContractAmountDisplay(data.hide_amounts, data.amount_vnd);
  const mrr = amContractAmountDisplay(data.hide_amounts, data.mrr_vnd);

  return (
    <section className="am-page am-360">
      <p className="am-crumb">
        {data.agency_client_id ? (
          <Link href={`/crm/account-management/clients/${data.agency_client_id}`}>
            {data.client_name || data.client_code || 'Khách hàng'}
          </Link>
        ) : (
          <Link href="/crm/account-management/clients">Khách hàng</Link>
        )}
        {' / '}
        {heading}
      </p>

      <header className="am-360__head">
        <div>
          <h1>{heading}</h1>
          <p className="am-muted">
            {amContractDash(data.client_name)} · {range} · {amContractDaysCopy(data.days_remaining)}
          </p>
        </div>
        <span className={statusClass(data.status)}>{data.status || '—'}</span>
      </header>

      <nav className="am-360__tabs" aria-label="Hợp đồng">
        {AM_CONTRACT_TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={item.id === tab ? 'is-active' : ''}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {tab === 'overview' ? (
        <section className="am-widget">
          <h2>Tổng quan</h2>
          <p>
            Giá trị HĐ <b>{amount}</b>
            <br />
            MRR <b>{mrr}</b>
            <br />
            Billing {amContractDash(data.billing_type)} · Ký {formatAmContractDate(data.signed_on)} ·
            Hiệu lực {range}
          </p>
          <p>{data.notes.trim() ? data.notes : '—'}</p>
        </section>
      ) : null}

      {tab === 'services' ? (
        <section className="am-widget">
          <h2>Dịch vụ &amp; giá</h2>
          <div className="am-tbl-wrap">
            <table className="am-table">
              <thead>
                <tr>
                  <th>Dịch vụ</th>
                  <th>Đơn giá/tháng</th>
                  <th>Start</th>
                  <th>End</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.line_items.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="am-muted">
                      —
                    </td>
                  </tr>
                ) : (
                  data.line_items.map((row, idx) => (
                    <tr key={`${row.service_slug}-${idx}`}>
                      <td>{row.title || row.service_slug || '—'}</td>
                      <td>{amContractAmountDisplay(data.hide_amounts, row.amount_vnd)}</td>
                      <td>{formatAmContractDate(row.starts_on)}</td>
                      <td>{formatAmContractDate(row.ends_on)}</td>
                      <td>{row.status || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {tab === 'payments' ? <AmPlaceholder title="Lịch thanh toán" wave={4} /> : null}

      {tab === 'renewal' ? (
        <section className="am-widget">
          <h2>Gia hạn</h2>
          <p>
            Hết hạn {formatAmContractDate(data.renewal.ends_on)} · {amContractDaysCopy(data.renewal.days_remaining)} ·
            Nhắc trước {amContractDash(data.renewal_reminder_days)} ngày
          </p>
          {data.renewal.open_case_id ? (
            <p>
              <Link className="am-link" href={`/crm/account-management/renewals/${data.renewal.open_case_id}`}>
                Mở renewal case
              </Link>
            </p>
          ) : (
            <p className="am-muted">—</p>
          )}
        </section>
      ) : null}

      {tab === 'amendments' ? (
        <section className="am-widget">
          <h2>Phụ lục</h2>
          <p className="am-muted">—</p>
        </section>
      ) : null}

      {tab === 'documents' ? (
        <section className="am-widget">
          <AmDocumentsPanel
            agencyClientId={data.agency_client_id}
            contractId={data.id}
            canEdit={Boolean(canEdit)}
          />
        </section>
      ) : null}

      {tab === 'audit' ? (
        <section className="am-widget">
          <h2>Audit</h2>
          {data.audit.length === 0 ? (
            <p className="am-muted">—</p>
          ) : (
            <div className="am-tbl-wrap">
              <table className="am-table">
                <thead>
                  <tr>
                    <th>Thời gian</th>
                    <th>Sự kiện</th>
                    <th>Actor</th>
                  </tr>
                </thead>
                <tbody>
                  {data.audit.map((row, idx) => (
                    <tr key={`${row.created_at}-${idx}`}>
                      <td>{row.created_at ? row.created_at.slice(0, 19).replace('T', ' ') : '—'}</td>
                      <td>{row.event_type || '—'}</td>
                      <td>{row.actor || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}
    </section>
  );
}
