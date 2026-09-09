'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { PmLedgers } from '@/components/kpi-hub/performance/PmLedgers';
import { PmMoatNotice } from '@/components/kpi-hub/performance/PmMoatNotice';
import { PmPage, pmBadge } from '@/components/kpi-hub/performance/PmPage';
import { PmPageState } from '@/components/kpi-hub/performance/PmPageState';
import { PmWeeklyRhythm } from '@/components/kpi-hub/performance/PmWeeklyRhythm';
import { ServiceKpiSummaryTiles } from '@/components/kpi-hub/service-kpi/ServiceKpiSummaryTiles';
import { getAccessToken } from '@/lib/auth';
import { fetchPmDashboard } from '@/lib/performance-api';
import type { PmDashboard } from '@/lib/performance-types';

const EMPTY: PmDashboard = {
  on_track: 0,
  watch: 0,
  off_track: 0,
  total: 0,
  completion_pct: 0,
  checkin_on_time_pct: 0,
  data_blocked: 0,
  ledgers: {
    quoted: { value: null, label: 'Quoted', hint: '' },
    assigned: { value: null, label: 'Assigned', hint: '' },
    verified: { value: null, label: 'Pending', hint: '' },
  },
  rhythm: [],
  dept_scores: [],
  queue: [],
};

function queueHref(item: { title: string; href: string }) {
  if (/check-in quá hạn|overdue check-in/i.test(item.title)) {
    return '/crm/kpi-hub/performance/check-ins?overdue=1';
  }
  return item.href;
}

export default function PerformanceDashboardPage() {
  const token = getAccessToken() ?? '';
  const [data, setData] = useState<PmDashboard>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    void fetchPmDashboard(token)
      .then(setData)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Không tải dashboard'))
      .finally(() => setLoading(false));
  }, [token]);

  const state = (
    <PmPageState
      loading={loading}
      error={error}
      empty={!loading && !error && data.total === 0 && !data.dept_scores.length}
    />
  );

  return (
    <PmPage
      title="Operating Dashboard"
      subtitle="PM-01 · Nhịp tuần agency — không phải dashboard OKR generic. Scope: PTT Growth · Tháng 09/2026"
      crumb="Operating Dashboard"
      actions={
        <>
          <Link href="/crm/kpi-hub/performance/reports" className="kpi-hub-btn kpi-hub-btn--ghost">
            Snapshot Report
          </Link>
          <Link href="/crm/kpi-hub/performance/assignments/new" className="kpi-hub-btn kpi-hub-btn--primary">
            ＋ Assignment
          </Link>
        </>
      }
    >
      {state}
      {!loading && !error ? (
        <>
          <PmMoatNotice>
            <b>Khác Lattice / 15Five:</b> tile thứ 6 “Data blocked” cấm close/report khi actual stale.{' '}
            <b>Khác AgencyAnalytics:</b> 3 sổ Quoted · Assigned · Verified trên cùng definition Dictionary.
          </PmMoatNotice>
          <ServiceKpiSummaryTiles
            tiles={[
              {
                label: 'ĐÚNG TIẾN ĐỘ',
                value: `${data.on_track} / ${data.total}`,
                hint: 'Green + quality ≠ stale',
                tone: 'ok',
              },
              {
                label: 'THEO DÕI',
                value: data.watch,
                hint: 'Yellow hoặc assumption mở',
                tone: data.watch ? 'warn' : 'default',
              },
              {
                label: 'KHÔNG ĐẠT',
                value: data.off_track,
                hint: 'Red / overrun >10% (CPL/SLA)',
                tone: data.off_track ? 'critical' : 'default',
              },
              {
                label: 'COMPLETION',
                value: `${data.completion_pct}%`,
                hint: 'Mean item score — không raw',
              },
              {
                label: 'CHECK-IN ĐÚNG HẠN',
                value: `${data.checkin_on_time_pct}%`,
                hint: `${data.watch ? '6' : '0'} overdue → ritual`,
                tone: 'ok',
              },
              {
                label: 'DATA BLOCKED',
                value: String(data.data_blocked).padStart(2, '0'),
                hint: 'Cấm close / client report',
                tone: 'critical',
              },
            ]}
          />
          <PmLedgers quoted={data.ledgers.quoted} assigned={data.ledgers.assigned} verified={data.ledgers.verified} />
          <div className="kpi-hub-pm-layout">
            <div className="kpi-hub-pm-main">
              <article className="kpi-hub-card">
                <header className="kpi-hub-card__head">
                  <h2>Nhịp tuần — 5 câu bắt buộc</h2>
                  <span className="kpi-hub-badge kpi-hub-badge--purple">War Room twin</span>
                </header>
                <div className="kpi-hub-card__body">
                  <PmWeeklyRhythm items={data.rhythm} />
                </div>
              </article>
              <article className="kpi-hub-card">
                <header className="kpi-hub-card__head">
                  <h2>Điểm theo phòng ban</h2>
                  <span className="kpi-hub-muted">Item score đã quy đổi</span>
                </header>
                <div className="kpi-hub-card__body kpi-hub-pm-chart">
                  {data.dept_scores.map((d) => (
                    <div key={d.department} className="kpi-hub-pm-chart__col">
                      <i
                        className={`kpi-hub-pm-chart__bar is-${d.status}`}
                        style={{ height: `${Math.min(100, d.score)}%` }}
                      />
                      <span>
                        {d.department.slice(0, 4)} {d.score}
                      </span>
                    </div>
                  ))}
                </div>
              </article>
            </div>
            <aside className="kpi-hub-pm-aside">
              <article className="kpi-hub-card">
                <header className="kpi-hub-card__head">
                  <h2>Queue</h2>
                </header>
                <ul className="kpi-hub-pm-list">
                  {data.queue.map((q) => (
                    <li key={q.title}>
                      <Link href={queueHref(q)}>{q.title}</Link>
                      <span className={pmBadge(q.badge)}>{q.badge}</span>
                    </li>
                  ))}
                </ul>
              </article>
              <article className="kpi-hub-card">
                <div className="kpi-hub-card__body kpi-hub-pm-aside__actions">
                  <Link href="/crm/kpi-hub/performance/assignments" className="kpi-hub-btn kpi-hub-btn--primary">
                    Assignment Registry
                  </Link>
                </div>
              </article>
            </aside>
          </div>
        </>
      ) : null}
    </PmPage>
  );
}
