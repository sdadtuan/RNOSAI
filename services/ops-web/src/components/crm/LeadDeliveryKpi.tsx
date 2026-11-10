'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchLeadDeliveryKpi, type LeadDeliveryKpi as DeliveryKpi } from '@/lib/api';

function hoursLabel(value: number): string {
  return `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(value)} giờ`;
}

export function LeadDeliveryKpi({ token, leadId }: { token: string; leadId: number }) {
  const [data, setData] = useState<DeliveryKpi | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setError('');
    void fetchLeadDeliveryKpi(token, leadId)
      .then((next) => {
        if (!cancelled) setData(next);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : '';
        setError(message && message !== 'Failed to fetch' ? message : 'Không tải được KPI triển khai.');
      });
    return () => {
      cancelled = true;
    };
  }, [token, leadId]);

  return (
    <section className="quote-sheet" aria-label="KPI nhân sự triển khai">
      <header className="quote-sheet__head">
        <p className="solution-desk__kicker">KPI nhân sự triển khai</p>
        <p className="muted">
          Giờ việc lấy từ nhân sự đã gán trên bảng báo giá. Đây là KPI mục tiêu
          {data ? ` tháng ${data.month}/${data.year}` : ''}: {data?.metric_name ?? 'Giờ triển khai báo giá'}.
        </p>
      </header>
      {error ? (
        <div className="lead-alert lead-alert--error" role="alert">
          {error}
        </div>
      ) : null}
      {!data && !error ? <p className="muted">Đang ghi KPI…</p> : null}
      {data && data.people.length === 0 ? <p className="muted">Chưa có nhân sự được gán trên báo giá.</p> : null}
      {data?.people.map((person) => (
        <article key={person.staff_id} className="card-inner" style={{ marginTop: '0.75rem' }}>
          <h3 style={{ margin: 0 }}>
            {person.staff_name}
            {person.position_name ? <span className="muted"> · {person.position_name}</span> : null}
          </h3>
          <p style={{ margin: '0.35rem 0' }}>
            <strong>{hoursLabel(person.hours)}</strong>
          </p>
          <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
            {person.tasks.map((task, index) => (
              <li key={`${person.staff_id}-${index}`}>{task}</li>
            ))}
          </ul>
        </article>
      ))}
      {data && data.unassigned_tasks.length > 0 ? (
        <p className="muted" style={{ marginTop: '0.75rem' }}>
          Chưa gán nhân sự: {data.unassigned_tasks.join(', ')}
        </p>
      ) : null}
      <div className="solution-desk__actions">
        <Link href="/crm/kpi" className="btn btn-secondary btn-sm">
          Mở KPI nhân viên
        </Link>
      </div>
    </section>
  );
}
