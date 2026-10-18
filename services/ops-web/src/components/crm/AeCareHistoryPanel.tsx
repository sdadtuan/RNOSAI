'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ApiError } from '@/lib/api';
import { fetchAeCareHistory, type AeCareHistory } from '@/lib/crm/ae-team-api';
import { leadStatusLabel } from '@/lib/crm/lead-status';
import '@/app/crm/b2b/team/ae-team.css';

function whenLabel(raw: string): string {
  const value = raw.trim();
  if (!value) return '—';
  const date = new Date(value.includes('T') ? value : value.replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return value.slice(0, 16);
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function AeCareHistoryPanel({ token }: { token: string }) {
  const [data, setData] = useState<AeCareHistory | null>(null);
  const [staffId, setStaffId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetchAeCareHistory(token)
      .then((board) => {
        if (!cancelled) {
          setData(board);
          setError('');
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : 'Không tải được lịch sử chăm sóc');
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const people = useMemo(() => {
    const map = new Map<number, string>();
    for (const row of data?.rows ?? []) {
      if (!map.has(row.staff_id)) {
        map.set(row.staff_id, row.staff_code ? `${row.staff_name} (${row.staff_code})` : row.staff_name);
      }
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1], 'vi'));
  }, [data]);

  const rows = (data?.rows ?? []).filter((row) => !staffId || String(row.staff_id) === staffId);

  return (
    <section className="ae-team ae-perf-embed" aria-label="History">
      <div className="ae-team-bar">
        <strong>History</strong>
        {people.length > 1 ? (
          <label>
            AE{' '}
            <select value={staffId} onChange={(event) => setStaffId(event.target.value)}>
              <option value="">Mọi AE</option>
              {people.map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
          </label>
        ) : null}
        {data?.note ? <span className="ae-perf-note">{data.note}</span> : null}
      </div>
      {error ? <p className="ae-team-error">{error}</p> : null}
      {data && rows.length === 0 ? <p className="ae-perf-note">Chưa có lead nào trong lịch sử chăm sóc.</p> : null}
      {rows.length ? (
        <div className="ae-team-panel">
          <div className="ae-perf-scroll">
            <table className="ae-perf-table ae-perf-table--history">
              <thead>
                <tr>
                  <th>AE</th>
                  <th>Lead</th>
                  <th>Việc</th>
                  <th>Lý do</th>
                  <th>Trạng thái</th>
                  <th>Thời điểm</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <span className="ae-perf-owner">{row.staff_name}</span>
                      {row.staff_code ? <span className="ae-perf-code"> ({row.staff_code})</span> : null}
                    </td>
                    <td>
                      <Link href={`/crm/leads/${row.lead_id}`}>{row.lead_name}</Link>
                      <span className="ae-perf-code"> #{row.lead_id}</span>
                    </td>
                    <td className={row.event === 'recalled' ? 'ae-perf-sla' : undefined}>{row.event_label}</td>
                    <td>{row.reason || '—'}</td>
                    <td>{leadStatusLabel(row.status)}</td>
                    <td>{whenLabel(row.at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
}
