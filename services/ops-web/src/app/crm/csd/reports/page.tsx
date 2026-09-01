'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { PageToolbar, StaffPageShell } from '@/components/layout';
import { useCsdPageAuth } from '@/components/crm/csd/useCsdPageAuth';
import { fetchCsdReports, formatCsdWhen, type CsdReportRow } from '@/lib/crm/csd-api';

const STATUS_LABELS: Record<string, string> = {
  draft: 'Nháp',
  in_review: 'Chờ duyệt',
  approved: 'Đã duyệt',
  sent: 'Đã gửi',
  archived: 'Lưu trữ',
};

export default function CsdReportsPage() {
  const { user, token, error, setError, logout } = useCsdPageAuth('view');
  const [items, setItems] = useState<CsdReportRow[]>([]);

  const reload = useCallback(async () => {
    if (!token) return;
    try {
      const out = await fetchCsdReports(token);
      setItems(out.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tải báo cáo thất bại');
    }
  }, [token, setError]);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (!user) {
    return (
      <StaffPageShell user={null} onLogout={logout} loading>
        <span />
      </StaffPageShell>
    );
  }

  return (
    <StaffPageShell
      user={user}
      onLogout={logout}
      breadcrumb={[
        { label: 'CRM', href: '/crm/leads' },
        { label: 'Service Desk', href: '/crm/csd' },
        { label: 'Báo cáo' },
      ]}
    >
      <PageToolbar title="Báo cáo khách hàng" subtitle="Phiên bản · duyệt · gửi PDF" />
      <div className="page-card stack-gap" data-testid="csd-reports-list">
        {error ? <p className="error">{error}</p> : null}
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Mẫu</th>
                <th>Khách</th>
                <th>Kỳ</th>
                <th>Trạng thái</th>
                <th>Phiên bản</th>
                <th>Cập nhật</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="muted">
                    Chưa có báo cáo
                  </td>
                </tr>
              ) : (
                items.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <Link href={`/crm/csd/reports/${row.id}`}>{row.template_name_vi ?? row.template_code}</Link>
                    </td>
                    <td>{row.client_account_name ?? row.client_account_id}</td>
                    <td className="muted">
                      {row.period_start} → {row.period_end}
                    </td>
                    <td>{STATUS_LABELS[row.status] ?? row.status}</td>
                    <td>{row.version}</td>
                    <td className="muted">{formatCsdWhen(row.updated_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </StaffPageShell>
  );
}
