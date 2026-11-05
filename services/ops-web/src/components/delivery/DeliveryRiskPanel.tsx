'use client';

import Link from 'next/link';
import type { DeliveryRiskRow } from '@/lib/delivery-projects-api';

type DeliveryRiskPanelProps = {
  items: DeliveryRiskRow[];
  loading?: boolean;
  compact?: boolean;
  showProject?: boolean;
};

const SEVERITY_LABEL: Record<string, string> = {
  low: 'Thấp',
  medium: 'Trung bình',
  high: 'Cao',
  critical: 'Critical',
};

export function DeliveryRiskPanel({ items, loading, compact, showProject = true }: DeliveryRiskPanelProps) {
  if (loading) {
    return (
      <div data-testid="delivery-risk-register">
        <p className="muted">Đang tải rủi ro…</p>
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <div className="delivery-empty-panel" data-testid="delivery-risk-register">
        <h4>Risk Register</h4>
        <p>Chưa có rủi ro được ghi nhận.</p>
      </div>
    );
  }

  return (
    <div className="delivery-table-wrap" data-testid="delivery-risk-register">
      <table className="delivery-table">
        <thead>
          <tr>
            {showProject ? <th>Dự án</th> : null}
            <th>Rủi ro</th>
            <th>Mức</th>
            <th>Trạng thái</th>
            <th>SLA</th>
          </tr>
        </thead>
        <tbody>
          {items.slice(0, compact ? 5 : 100).map((row) => (
            <tr key={row.id}>
              {showProject ? (
                <td>
                  <Link href={`/crm/delivery-projects/${row.project_id}`} className="delivery-link">
                    {row.project_code ?? row.project_name}
                  </Link>
                </td>
              ) : null}
              <td>{row.title}</td>
              <td>{SEVERITY_LABEL[row.severity] ?? row.severity}</td>
              <td>{row.status}</td>
              <td>{row.sla_due ? row.sla_due.slice(0, 10) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
