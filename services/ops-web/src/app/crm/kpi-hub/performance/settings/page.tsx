'use client';

import { useEffect, useState } from 'react';
import { PmAmberNotice } from '@/components/kpi-hub/performance/PmMoatNotice';
import { PmPage } from '@/components/kpi-hub/performance/PmPage';
import { PmPageState } from '@/components/kpi-hub/performance/PmPageState';
import { getAccessToken } from '@/lib/auth';
import { fetchPmSettings, patchPmSettings } from '@/lib/performance-api';
import type { PmSettings } from '@/lib/performance-types';

const EMPTY: PmSettings = {
  score_cap: '100',
  weight_must_100: true,
  green_min: 90,
  yellow_min: 70,
  lower_red_rule: 'Overrun > 10% target',
  reminder: 'T-1, due, T+1 overdue',
  escalation: 'Owner → Lead → Head',
  stale_action: 'Pending + block close/report',
  period_close: 'Manager + immutable snapshot',
  default_source: '',
  client_visibility: '',
  effective_at: '01/10/2026',
  impact: { scorecards: 23, assignments: 58, snapshots_untouched: true },
};

export default function PerformanceSettingsPage() {
  const token = getAccessToken() ?? '';
  const [form, setForm] = useState<PmSettings>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    void fetchPmSettings(token)
      .then(setForm)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Không tải policy'))
      .finally(() => setLoading(false));
  }, [token]);

  const save = async () => {
    setError(null);
    try {
      const next = await patchPmSettings(token, form);
      setForm(next);
      setMessage(
        `Policy v3 effective ${form.effective_at} — ${next.impact.scorecards} scorecard, ${next.impact.assignments} assignment, không đụng snapshot 08`,
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Không lưu policy');
    }
  };

  return (
    <PmPage
      title="Performance Policy"
      subtitle="PM-11 · Effective date. Không rewrite snapshot. Impact analysis trước khi save."
      crumb="Performance Policy"
      actions={
        <button type="button" className="kpi-hub-btn kpi-hub-btn--primary" onClick={() => void save()}>
          Lưu + effective date
        </button>
      }
    >
      <PmPageState loading={loading} error={error} />
      {message ? <p className="kpi-hub-notice kpi-hub-notice--success">{message}</p> : null}
      {!loading && !error ? (
        <div className="kpi-hub-pm-layout">
          <div className="kpi-hub-pm-form">
            <article className="kpi-hub-card">
              <header className="kpi-hub-card__head">
                <h2>Scoring</h2>
              </header>
              <div className="kpi-hub-card__body kpi-hub-pm-fields">
                <label className="kpi-hub-field">
                  <span>Score cap</span>
                  <select value={form.score_cap} onChange={(e) => setForm({ ...form, score_cap: e.target.value })}>
                    <option value="100">100%</option>
                    <option value="120">120% stretch</option>
                  </select>
                </label>
                <label className="kpi-hub-field">
                  <span>Weight Active</span>
                  <select defaultValue="100">
                    <option>Bắt buộc = 100%</option>
                  </select>
                </label>
                <label className="kpi-hub-field">
                  <span>Lower-is-better Red</span>
                  <input
                    value={form.lower_red_rule}
                    onChange={(e) => setForm({ ...form, lower_red_rule: e.target.value })}
                  />
                </label>
                <label className="kpi-hub-field">
                  <span>Effective</span>
                  <input
                    value={form.effective_at}
                    onChange={(e) => setForm({ ...form, effective_at: e.target.value })}
                  />
                </label>
              </div>
            </article>
            <article className="kpi-hub-card">
              <header className="kpi-hub-card__head">
                <h2>Ritual &amp; close</h2>
              </header>
              <div className="kpi-hub-card__body kpi-hub-pm-fields">
                <label className="kpi-hub-field">
                  <span>Reminder</span>
                  <input value={form.reminder} onChange={(e) => setForm({ ...form, reminder: e.target.value })} />
                </label>
                <label className="kpi-hub-field">
                  <span>Escalation</span>
                  <input value={form.escalation} onChange={(e) => setForm({ ...form, escalation: e.target.value })} />
                </label>
                <label className="kpi-hub-field">
                  <span>Stale</span>
                  <input value={form.stale_action} onChange={(e) => setForm({ ...form, stale_action: e.target.value })} />
                </label>
                <label className="kpi-hub-field">
                  <span>Close</span>
                  <input value={form.period_close} onChange={(e) => setForm({ ...form, period_close: e.target.value })} />
                </label>
              </div>
            </article>
          </div>
          <aside className="kpi-hub-pm-aside">
            <article className="kpi-hub-card">
              <header className="kpi-hub-card__head">
                <h2>Impact</h2>
              </header>
              <ul className="kpi-hub-pm-list">
                <li>
                  <span>Scorecard Active</span>
                  <b>{form.impact.scorecards}</b>
                </li>
                <li>
                  <span>Assignment</span>
                  <b>{form.impact.assignments}</b>
                </li>
                <li>
                  <span>Snapshot 08</span>
                  <b className="kpi-hub-badge kpi-hub-badge--pass">
                    {form.impact.snapshots_untouched ? 'Không đụng' : 'Cảnh báo'}
                  </b>
                </li>
              </ul>
              <PmAmberNotice>
                Khác admin form Lattice: mọi đổi policy có ngày hiệu lực + audit + không sửa kỳ đã chốt.
              </PmAmberNotice>
            </article>
          </aside>
        </div>
      ) : null}
    </PmPage>
  );
}
