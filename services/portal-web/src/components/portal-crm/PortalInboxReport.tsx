'use client';

import { useEffect, useState } from 'react';
import { fetchPortalInboxReport, type PortalInboxReport, type PortalInboxReportRow } from '@/lib/api';
import { displayPageName } from '@/components/portal-crm/portal-inbox.util';

const STORAGE_KEY = 'ptt_portal_inbox_report_open';

function fmtSec(value: number | null): string {
  if (value == null || Number.isNaN(value)) return '—';
  const sec = Math.round(value);
  if (sec < 60) return `${sec} giây`;
  const min = Math.round(sec / 60);
  if (min < 120) return `${min} phút`;
  return `${(sec / 3600).toFixed(1)} giờ`;
}

function Rows({ title, rows, kind }: { title: string; rows: PortalInboxReportRow[]; kind: 'page' | 'staff' }) {
  return (
    <div className="tram-inbox__report-block">
      <p className="tram-inbox__kicker">{title}</p>
      {rows.length === 0 ? (
        <p className="tram-inbox__hint" style={{ margin: 0 }}>
          Chưa có số liệu trong khoảng này.
        </p>
      ) : (
        <table className="tram-inbox__report-table">
          <thead>
            <tr>
              <th>{kind === 'page' ? 'Page' : 'Nhân viên'}</th>
              <th>Mới</th>
              <th>Chưa TL</th>
              <th>TL trung bình</th>
              <th>SĐT</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.page_id || row.user_id || String(index)}>
                <td>
                  {kind === 'page'
                    ? displayPageName(row.page_id || '', row.page_name)
                    : row.email || row.user_id || 'Chưa gán'}
                </td>
                <td>{row.new_conversations}</td>
                <td>{row.unreplied}</td>
                <td>{fmtSec(row.avg_first_response_sec)}</td>
                <td>{row.phones_collected}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function ChartIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="2" y="8" width="3" height="6" rx="0.8" fill="currentColor" />
      <rect x="6.5" y="4" width="3" height="10" rx="0.8" fill="currentColor" />
      <rect x="11" y="6" width="3" height="8" rx="0.8" fill="currentColor" />
    </svg>
  );
}

export function PortalInboxReportStrip({ token }: { token: string }) {
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState<'today' | '7d'>('today');
  const [data, setData] = useState<PortalInboxReport | null>(null);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      setOpen(localStorage.getItem(STORAGE_KEY) === '1');
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    setError('');
    void fetchPortalInboxReport(token, range)
      .then((next) => {
        if (!cancelled) setData(next);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Không tải được báo cáo');
      });
    return () => {
      cancelled = true;
    };
  }, [token, range, ready]);

  function toggle() {
    setOpen((current) => {
      const next = !current;
      try {
        localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  function close() {
    setOpen(false);
    try {
      localStorage.setItem(STORAGE_KEY, '0');
    } catch {
      /* ignore */
    }
  }

  return (
    <>
      <button
        type="button"
        className={open ? 'tram-inbox__icon-btn is-on' : 'tram-inbox__icon-btn'}
        aria-label="Báo cáo"
        title="Báo cáo hộp thư"
        aria-expanded={open}
        onClick={toggle}
      >
        <ChartIcon />
        <span className="tram-inbox__icon-label">Báo cáo</span>
      </button>
      {open ? (
        <div
          className="tram-inbox__modal-back"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) close();
          }}
        >
          <div className="tram-inbox__modal" role="dialog" aria-labelledby="inbox-report-title">
            <header>
              <h2 id="inbox-report-title">Báo cáo hộp thư</h2>
              <button type="button" className="tram-inbox__clear" onClick={close}>
                Đóng
              </button>
            </header>
            <div className="tram-inbox__pills" role="group" aria-label="Khoảng báo cáo">
              <button type="button" className={range === 'today' ? 'tram-inbox__pill is-on' : 'tram-inbox__pill'} onClick={() => setRange('today')}>
                Hôm nay
              </button>
              <button type="button" className={range === '7d' ? 'tram-inbox__pill is-on' : 'tram-inbox__pill'} onClick={() => setRange('7d')}>
                7 ngày
              </button>
            </div>
            {error ? <p className="tram-inbox__error">{error}</p> : null}
            <p className="tram-inbox__hint" style={{ margin: 0 }}>
              Hội thoại mới, tin chưa trả lời, thời gian trả lời lần đầu và số điện thoại đã thu — theo Page và nhân viên, trong khoảng đã chọn.
            </p>
            <Rows title="Theo Page" rows={data?.by_page ?? []} kind="page" />
            <Rows title="Theo nhân viên" rows={data?.by_staff ?? []} kind="staff" />
          </div>
        </div>
      ) : null}
    </>
  );
}
