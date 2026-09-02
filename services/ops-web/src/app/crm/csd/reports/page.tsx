'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageToolbar, StaffPageShell } from '@/components/layout';
import { useCsdPageAuth } from '@/components/crm/csd/useCsdPageAuth';
import {
  CSD_REPORT_STATUS_LABELS,
  CSD_REPORT_TEMPLATES,
  createCsdReport,
  fetchCsdReports,
  formatCsdWhen,
  type CsdReportListFilter,
  type CsdReportRow,
} from '@/lib/crm/csd-api';

const FILTERS: { id: CsdReportListFilter; label: string }[] = [
  { id: 'all', label: 'Tất cả' },
  { id: 'due', label: 'Đến hạn' },
  { id: 'in_review', label: 'Chờ duyệt' },
  { id: 'sent', label: 'Đã gửi' },
];

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function defaultPeriod(): { period_start: string; period_end: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 6);
  return { period_start: isoDate(start), period_end: isoDate(end) };
}

export default function CsdReportsPage() {
  const router = useRouter();
  const { user, token, error, setError, logout, canWrite, canManage } = useCsdPageAuth('view');
  const [items, setItems] = useState<CsdReportRow[]>([]);
  const [filter, setFilter] = useState<CsdReportListFilter>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    template_code: 'weekly_ops',
    client_account_id: '',
    title: '',
    ...defaultPeriod(),
  });

  const reload = useCallback(async () => {
    if (!token) return;
    try {
      const query = filter === 'all' ? {} : { status: filter };
      const out = await fetchCsdReports(token, query);
      setItems(out.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tải báo cáo thất bại');
    }
  }, [token, filter, setError]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !canWrite) return;
    setBusy(true);
    setError('');
    try {
      const created = await createCsdReport(token, {
        template_code: form.template_code,
        period_start: form.period_start,
        period_end: form.period_end,
        title: form.title.trim() || undefined,
        client_account_id: form.client_account_id.trim() || undefined,
      });
      router.push(`/crm/csd/reports/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tạo báo cáo thất bại');
    } finally {
      setBusy(false);
    }
  }

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
      <PageToolbar
        title="Báo cáo khách hàng"
        subtitle="Tạo từ mẫu · lọc trạng thái · duyệt · gửi PDF"
        actions={
          <>
            {canManage ? (
              <Link href="/crm/csd/reports/templates" className="btn btn-sm btn-secondary">
                Mẫu báo cáo
              </Link>
            ) : null}
            <button
              type="button"
              className="btn btn-sm"
              data-testid="csd-report-new"
              disabled={!canWrite}
              onClick={() => canWrite && setFormOpen((open) => !open)}
            >
              Tạo báo cáo
            </button>
          </>
        }
      />
      <div className="page-card stack-gap" data-testid="csd-reports-list">
        {error ? <p className="error">{error}</p> : null}

        <div className="csd-report-filters" role="tablist" aria-label="Lọc báo cáo">
          {FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={filter === item.id}
              className={filter === item.id ? 'is-active' : undefined}
              data-testid={`csd-report-filter-${item.id}`}
              onClick={() => setFilter(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        {canWrite && formOpen ? (
          <form onSubmit={(e) => void handleCreate(e)} className="admin-crm-form" data-testid="csd-report-create-form">
            <h3 className="kpi-section-title">Tạo báo cáo mới</h3>
            <div className="admin-crm-form__grid">
              <select
                className="kpi-select"
                value={form.template_code}
                onChange={(e) => setForm({ ...form, template_code: e.target.value })}
                data-testid="csd-report-template"
                required
              >
                {CSD_REPORT_TEMPLATES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              <input
                className="kpi-input"
                placeholder="Khách (client_account_id)"
                value={form.client_account_id}
                onChange={(e) => setForm({ ...form, client_account_id: e.target.value })}
                data-testid="csd-report-client"
              />
              <input
                className="kpi-input"
                type="date"
                required
                value={form.period_start}
                onChange={(e) => setForm({ ...form, period_start: e.target.value })}
                data-testid="csd-report-period-start"
              />
              <input
                className="kpi-input"
                type="date"
                required
                value={form.period_end}
                onChange={(e) => setForm({ ...form, period_end: e.target.value })}
                data-testid="csd-report-period-end"
              />
              <input
                className="kpi-input"
                placeholder="Tiêu đề (tuỳ chọn)"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                data-testid="csd-report-title"
              />
            </div>
            <button type="submit" className="btn btn-sm" disabled={busy} data-testid="csd-report-create">
              {busy ? 'Đang tạo…' : 'Tạo báo cáo'}
            </button>
          </form>
        ) : null}

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
                      <Link href={`/crm/csd/reports/${row.id}`}>
                        {row.title ?? row.template_name_vi ?? row.template_code}
                      </Link>
                    </td>
                    <td>{row.client_account_name ?? row.client_account_id ?? '—'}</td>
                    <td className="muted">
                      {row.period_start} → {row.period_end}
                    </td>
                    <td>{CSD_REPORT_STATUS_LABELS[row.status] ?? row.status}</td>
                    <td>{row.current_version ?? row.version ?? '—'}</td>
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
