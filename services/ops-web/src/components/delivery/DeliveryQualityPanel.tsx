'use client';

import Link from 'next/link';
import type { DeliveryQualitySnapshotRow } from '@/lib/delivery-projects-api';

type DeliveryQualityPanelProps = {
  items: DeliveryQualitySnapshotRow[];
  loading?: boolean;
};

export function DeliveryQualityPanel({ items, loading }: DeliveryQualityPanelProps) {
  if (loading) return <p className="muted">Đang tải quality…</p>;
  if (items.length === 0) {
    return (
      <div className="delivery-empty-panel">
        <h4>Delivery Quality</h4>
        <p>Chưa có điểm chất lượng — chạy compute hoặc chờ milestone.</p>
      </div>
    );
  }

  return (
    <div className="delivery-table-wrap" data-testid="delivery-quality-panel">
      <table className="delivery-table">
        <thead>
          <tr>
            <th>Dự án</th>
            <th>Kỳ</th>
            <th>Đúng hạn</th>
            <th>Rework</th>
            <th>Score</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {items.map((row) => (
            <tr key={row.id}>
              <td>
                <Link href={`/crm/delivery-projects/${row.project_id}`} className="delivery-link">
                  {row.project_code ?? row.project_name}
                </Link>
              </td>
              <td>{row.period}</td>
              <td>{row.ontime_milestone_pct != null ? `${row.ontime_milestone_pct}%` : '—'}</td>
              <td>{row.rework_pct != null ? `${row.rework_pct}%` : '—'}</td>
              <td>{row.score ?? '—'}</td>
              <td>
                <Link
                  href={`/crm/kpi-hub/audit?entity=delivery&id=${encodeURIComponent(row.project_id)}`}
                  className="delivery-link"
                >
                  Audit
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
