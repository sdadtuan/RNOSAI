'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  fetchPerformance,
  fetchPortalNotificationSummary,
  portalSeoStatus,
  type PortalNotificationSummaryResponse,
  type PerformanceListResponse,
} from '@/lib/api';
import { fmtNumber, fmtVnd } from '@/lib/format';
import { usePortalEmailNav } from '@/hooks/usePortalEmailNav';
import { usePortalSeoNav } from '@/hooks/usePortalSeoNav';
import {
  fmtDateDmy,
  type DashboardRange,
  LEAD_MAPPED_LABEL,
  LEAD_MAPPED_TIP,
} from '@/lib/portal/dashboard-range';

type DashboardKpiStripProps = {
  token: string;
  range: DashboardRange;
};

type KpiState = {
  performance: PerformanceListResponse | null;
  summary: PortalNotificationSummaryResponse | null;
  seoPending: number;
  emailPending: number;
  loading: boolean;
};

export function DashboardKpiStrip({ token, range }: DashboardKpiStripProps) {
  const seoEnabled = usePortalSeoNav(token);
  const { emailEnabled, pendingEmail } = usePortalEmailNav(token);
  const [state, setState] = useState<KpiState>({
    performance: null,
    summary: null,
    seoPending: 0,
    emailPending: 0,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setState((prev) => ({ ...prev, loading: true }));
      try {
        const [performance, summary] = await Promise.all([
          fetchPerformance(token, { from: range.from, to: range.to, group_by: 'day' }),
          fetchPortalNotificationSummary(token),
        ]);
        let seoPending = 0;
        if (seoEnabled) {
          try {
            const status = await portalSeoStatus(token);
            seoPending = Number(status.pending_client_review ?? 0);
          } catch {
            seoPending = 0;
          }
        }
        if (!cancelled) {
          setState({
            performance,
            summary,
            seoPending,
            emailPending: emailEnabled ? pendingEmail : 0,
            loading: false,
          });
        }
      } catch {
        if (!cancelled) {
          setState((prev) => ({ ...prev, loading: false }));
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [token, seoEnabled, emailEnabled, pendingEmail, range.from, range.to]);

  if (state.loading) {
    return (
      <div className="kpi-tile-grid" aria-busy="true" data-testid="dashboard-kpi-strip">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="kpi-tile kpi-tile--skeleton">
            <p className="kpi-tile__label">…</p>
            <p className="kpi-tile__value">—</p>
          </div>
        ))}
      </div>
    );
  }

  const summary = state.performance?.summary;
  const creativePending = state.summary?.pending_creatives ?? 0;
  const unread = state.summary?.unread ?? 0;
  const workflowPending = creativePending + state.emailPending + state.seoPending;
  const overTarget = summary?.over_target_rows ?? 0;
  const freshness = state.performance?.data_freshness?.through_date;

  return (
    <div className="dashboard-kpi-block" data-testid="dashboard-kpi-strip">
      <div className="kpi-tile-grid">
        <div className="kpi-tile" data-testid="kpi-spend">
          <p className="kpi-tile__label">Tổng chi tiêu</p>
          <p className="kpi-tile__value">{summary ? fmtVnd(summary.total_spend) : '—'}</p>
          <p className="kpi-tile__hint muted">{range.label}</p>
          {freshness ? <p className="kpi-tile__hint muted">Cập nhật {fmtDateDmy(freshness)}</p> : null}
        </div>
        <div className="kpi-tile" data-testid="kpi-leads-mapped">
          <p className="kpi-tile__label" title={LEAD_MAPPED_TIP}>
            {LEAD_MAPPED_LABEL}
          </p>
          <p className="kpi-tile__value">{summary ? fmtNumber(summary.total_leads_crm) : '—'}</p>
          <p className="kpi-tile__hint muted">{range.label}</p>
        </div>
        <div className="kpi-tile">
          <p className="kpi-tile__label" title="Chi phí trên mỗi lead gắn được chiến dịch">
            CPL trung bình
          </p>
          <p className="kpi-tile__value">{summary?.avg_cpl != null ? fmtVnd(summary.avg_cpl) : '—'}</p>
          <p className="kpi-tile__hint muted">{range.label}</p>
        </div>
        <Link
          href="/creatives"
          className={`kpi-tile-link${creativePending > 0 ? ' kpi-tile-link--alert' : ''}`}
        >
          <div className={`kpi-tile${creativePending > 0 ? ' kpi-tile--warning' : ''}`}>
            <p className="kpi-tile__label">Sáng tạo chờ duyệt</p>
            <p className="kpi-tile__value">{fmtNumber(creativePending)}</p>
            <p className="kpi-tile__hint muted">Xem sáng tạo →</p>
          </div>
        </Link>
        <Link
          href="/notifications"
          className={`kpi-tile-link${unread > 0 ? ' kpi-tile-link--alert' : ''}`}
        >
          <div className={`kpi-tile${unread > 0 ? ' kpi-tile--warning' : ''}`}>
            <p className="kpi-tile__label">Thông báo chưa đọc</p>
            <p className="kpi-tile__value">{fmtNumber(unread)}</p>
            <p className="kpi-tile__hint muted">Trung tâm thông báo →</p>
          </div>
        </Link>
        <div className={`kpi-tile${overTarget > 0 ? ' kpi-tile--critical' : ''}`}>
          <p className="kpi-tile__label">Vượt CPL mục tiêu</p>
          <p className="kpi-tile__value">{fmtNumber(overTarget)}</p>
          <p className="kpi-tile__hint muted">{range.label}</p>
        </div>
      </div>
      {workflowPending > 0 ? (
        <p className="dashboard-kpi-block__note muted">
          {workflowPending} mục cần xử lý (sáng tạo / email / SEO)
        </p>
      ) : null}
    </div>
  );
}
