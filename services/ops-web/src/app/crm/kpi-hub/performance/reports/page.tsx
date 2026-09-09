'use client';

import { useEffect, useState } from 'react';
import { PmPage } from '@/components/kpi-hub/performance/PmPage';
import { PmPageState } from '@/components/kpi-hub/performance/PmPageState';
import { ServiceKpiSummaryTiles } from '@/components/kpi-hub/service-kpi/ServiceKpiSummaryTiles';
import { getAccessToken } from '@/lib/auth';
import { exportPmReport, fetchPmReports } from '@/lib/performance-api';
import type { PmReports } from '@/lib/performance-types';

const EMPTY: PmReports = {
  completion_pct: 0,
  compliance_pct: 0,
  at_risk_pct: 0,
  overdue_checkins: 0,
  snapshots: 0,
  scorecards_active: 0,
  period_state: 'open',
  by_scope: [],
};

function ScopeBar({ scope }: { scope: PmReports['by_scope'][number] }) {
  const green = scope.green ?? scope.healthy_pct;
  const yellow = scope.yellow ?? 0;
  const red = scope.red ?? Math.max(0, 100 - green - yellow);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '86px 1fr 40px', gap: 9, alignItems: 'center', margin: '10px 0' }}>
      <label style={{ fontSize: '0.75rem', color: '#64748b' }}>{scope.scope}</label>
      <div style={{ display: 'flex', overflow: 'hidden', height: 18, borderRadius: 4, background: '#e9eef5' }}>
        {green > 0 ? <i style={{ display: 'block', height: '100%', width: `${green}%`, background: '#10a36f' }} /> : null}
        {yellow > 0 ? <i style={{ display: 'block', height: '100%', width: `${yellow}%`, background: '#f5b31a' }} /> : null}
        {red > 0 ? <i style={{ display: 'block', height: '100%', width: `${red}%`, background: '#e54444' }} /> : null}
      </div>
      <b style={{ fontSize: '0.8rem' }}>{scope.healthy_pct}%</b>
    </div>
  );
}

export default function PerformanceReportsPage() {
  const token = getAccessToken() ?? '';
  const [data, setData] = useState<PmReports>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    void fetchPmReports(token)
      .then(setData)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Không tải báo cáo'))
      .finally(() => setLoading(false));
  }, [token]);

  const handleExport = async () => {
    try {
      await exportPmReport(token, { actor: 'staff', role: 'lead' });
      setToast('Export XLSX đã ghi audit');
      setTimeout(() => setToast(null), 2800);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Export thất bại');
    }
  };

  return (
    <PmPage
      title="Snapshot Report"
      subtitle="PM-10 · Kỳ đóng đọc snapshot bất biến. Export = field-level + audit. Không mix 2 formula version."
      crumb="Snapshot Report"
      actions={
        <>
          <button type="button" className="kpi-hub-btn kpi-hub-btn--ghost">
            Kỳ 09/2026 ▾
          </button>
          <button type="button" className="kpi-hub-btn kpi-hub-btn--primary" onClick={() => void handleExport()}>
            Export XLSX
          </button>
        </>
      }
    >
      {toast ? <p className="kpi-hub-notice kpi-hub-notice--success">{toast}</p> : null}
      <PmPageState loading={loading} error={error} />
      {!loading && !error ? (
        <>
          <ServiceKpiSummaryTiles
            tiles={[
              { label: 'COMPLETION', value: `${data.completion_pct}%`, hint: 'Item score' },
              { label: 'COMPLIANCE', value: `${data.compliance_pct}%`, hint: 'Check-in on time', tone: 'ok' },
              { label: 'AT RISK', value: `${data.at_risk_pct}%`, hint: '11 watch', tone: 'warn' },
              { label: 'OVERDUE', value: String(data.overdue_checkins).padStart(2, '0'), hint: 'Escalation', tone: 'critical' },
              { label: 'SNAPSHOTS', value: data.snapshots, hint: 'Closed + hash' },
            ]}
          />
          <div className="kpi-hub-pm-layout" style={{ marginTop: 16 }}>
            <article className="kpi-hub-card">
              <header className="kpi-hub-card__head">
                <h2>Health by scope</h2>
              </header>
              <div className="kpi-hub-card__body">
                {data.by_scope.map((s) => (
                  <ScopeBar key={s.scope} scope={s} />
                ))}
              </div>
            </article>
            <aside className="kpi-hub-pm-aside">
              <article className="kpi-hub-card">
                <header className="kpi-hub-card__head">
                  <h2>Close policy</h2>
                </header>
                <div className="kpi-hub-card__body">
                  <p className="kpi-hub-muted">
                    {data.period_state === 'closed'
                      ? 'Tháng 08 đã close — report này đọc snapshot. Sửa CPL 09 sau close → Adjustment + lý do + audit. AC-PM-06.'
                      : 'Kỳ đang mở — close sẽ freeze snapshot bất biến. Sửa sau close cần reopen + audit.'}
                  </p>
                </div>
              </article>
            </aside>
          </div>
        </>
      ) : null}
    </PmPage>
  );
}
