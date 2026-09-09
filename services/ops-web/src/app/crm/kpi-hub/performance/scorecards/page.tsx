'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { PmMoatNotice } from '@/components/kpi-hub/performance/PmMoatNotice';
import { PmPage } from '@/components/kpi-hub/performance/PmPage';
import { PmPageState } from '@/components/kpi-hub/performance/PmPageState';
import { getAccessToken } from '@/lib/auth';
import { fetchPmScorecards } from '@/lib/performance-api';
import type { PmScorecard } from '@/lib/performance-types';

function dirArrow(targetLabel: string) {
  if (targetLabel.includes('≤')) return '↓';
  if (targetLabel.includes('≥')) return '↑';
  return '—';
}

const ALLOCATION = [
  { label: 'Outcome', pct: '50%' },
  { label: 'Efficiency', pct: '20%' },
  { label: 'Funnel quality', pct: '20%' },
  { label: 'Delivery', pct: '10%' },
];

export default function PerformanceScorecardsPage() {
  const token = getAccessToken() ?? '';
  const [items, setItems] = useState<PmScorecard[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    void fetchPmScorecards(token)
      .then((res) => setItems(res.items))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Không tải scorecard'))
      .finally(() => setLoading(false));
  }, [token]);

  const sc = items[0];

  return (
    <PmPage
      title={sc ? `Scorecard Builder — ${sc.title}` : 'Scorecard Builder'}
      subtitle="PM-04 · Inherit Service Template DV04 + Quote snapshot. Weight = 100% mới Active."
      crumb="Scorecard Builder"
      actions={
        <>
          <button type="button" className="kpi-hub-btn kpi-hub-btn--ghost">
            Lưu nháp
          </button>
          <button type="button" className="kpi-hub-btn kpi-hub-btn--primary">
            Gửi phê duyệt
          </button>
        </>
      }
    >
      <PmMoatNotice>
        Item sinh Assignment khi Active. Mỗi dòng giữ <b>definition_version + formula_snapshot</b>. Close kỳ sau
        không bị formula mới làm sai lịch sử.
      </PmMoatNotice>
      <PmPageState loading={loading} error={error} empty={!loading && !error && !sc} />
      {sc ? (
        <div className="kpi-hub-pm-layout">
          <article className="kpi-hub-card">
            <div className="kpi-hub-card__body">
              <div className="kpi-hub-pm-fields" style={{ marginBottom: 14 }}>
                <label className="kpi-hub-field">
                  <span>Loại</span>
                  <select defaultValue="role">
                    <option>Role — Marketing Leader</option>
                  </select>
                </label>
                <label className="kpi-hub-field">
                  <span>Kỳ</span>
                  <input defaultValue={sc.period.replace('–', ' — ')} />
                </label>
                <label className="kpi-hub-field">
                  <span>Inherit từ</span>
                  <select defaultValue="dv04">
                    <option>Service Template DV04 Meta + QT-0089</option>
                  </select>
                </label>
                <label className="kpi-hub-field">
                  <span>Approver</span>
                  <select defaultValue={sc.approver}>
                    <option>{sc.approver}</option>
                  </select>
                </label>
              </div>
              <table className="kpi-hub-table">
                <thead>
                  <tr>
                    <th>KPI</th>
                    <th>Weight</th>
                    <th>Target</th>
                    <th>Dir</th>
                    <th>Source</th>
                  </tr>
                </thead>
                <tbody>
                  {sc.items.map((it) => (
                    <tr key={it.id}>
                      <td>{it.name}</td>
                      <td>{it.weight}%</td>
                      <td>{it.target_label}</td>
                      <td>{dirArrow(it.target_label)}</td>
                      <td>{it.formula.includes('CRM') ? 'CRM' : it.formula.includes('Ads') ? 'Ads+CRM' : it.formula.split(' ')[0]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {sc.weight_valid ? (
                <p className="kpi-hub-notice kpi-hub-notice--success" style={{ marginTop: 12 }}>
                  Tổng trọng số 100% — hợp lệ. CPL 85K vs template floor 85–100K: trong band.
                </p>
              ) : (
                <p className="kpi-hub-form-error" style={{ marginTop: 12 }}>
                  Tổng trọng số: {sc.weight_total}% — chưa hợp lệ
                </p>
              )}
            </div>
          </article>
          <aside className="kpi-hub-pm-aside">
            <article className="kpi-hub-card">
              <header className="kpi-hub-card__head">
                <h2>Phân bổ</h2>
              </header>
              <ul className="kpi-hub-pm-list">
                {ALLOCATION.map((a) => (
                  <li key={a.label}>
                    <span>{a.label}</span>
                    <b>{a.pct}</b>
                  </li>
                ))}
              </ul>
            </article>
            <article className="kpi-hub-card">
              <div className="kpi-hub-card__body">
                <Link href="/crm/kpi-hub/performance/scorecards/items" className="kpi-hub-btn kpi-hub-btn--ghost" style={{ width: '100%' }}>
                  ＋ Thêm chỉ tiêu
                </Link>
              </div>
            </article>
          </aside>
        </div>
      ) : null}
    </PmPage>
  );
}
