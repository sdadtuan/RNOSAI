'use client';

import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { PmAmberNotice } from '@/components/kpi-hub/performance/PmMoatNotice';
import { PmPage, pmBadge } from '@/components/kpi-hub/performance/PmPage';
import { PmPageState } from '@/components/kpi-hub/performance/PmPageState';
import { PmQualityChip } from '@/components/kpi-hub/performance/PmQualityChip';
import { getAccessToken } from '@/lib/auth';
import { ApiError } from '@/lib/api';
import { createPmAction, createPmCheckIn, fetchPmCheckIns } from '@/lib/performance-api';
import type { PmCheckInBundle } from '@/lib/performance-types';

const EMPTY: PmCheckInBundle = { assignment: null, items: [], actions: [] };

function overrunLabel(asg: NonNullable<PmCheckInBundle['assignment']>) {
  if (asg.direction === 'lower' && asg.actual != null && asg.target > 0) {
    const pct = Math.round(((asg.actual - asg.target) / asg.target) * 100);
    if (pct > 0) return `+${pct}% → Red`;
  }
  return asg.progress != null ? `${asg.progress}%` : '—';
}

function PerformanceCheckInInner() {
  const token = getAccessToken() ?? '';
  const params = useSearchParams();
  const assignmentId = params.get('assignment') ?? params.get('id') ?? 'asg-p1';
  const overdueMode = params.get('overdue') === '1';
  const [data, setData] = useState<PmCheckInBundle>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [checkinOpen, setCheckinOpen] = useState(false);
  const [actionOpen, setActionOpen] = useState(false);
  const [forecast, setForecast] = useState('4,8 giờ');
  const [blocker, setBlocker] = useState('03 ticket P1 chờ Platform');
  const [evidence, setEvidence] = useState('Incident #4412');
  const [actionTitle, setActionTitle] = useState('Xử lý 03 blocker P1');
  const [actionDue, setActionDue] = useState('10/09/2026 17:00');
  const [actionImpact, setActionImpact] = useState('P1 ≤ 4h trước period close');

  const reload = () => {
    if (!token) return;
    void fetchPmCheckIns(token, assignmentId)
      .then(setData)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Không tải check-in'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, assignmentId]);

  const asg = data.assignment;

  const submitCheckIn = async () => {
    if (!asg) return;
    setError(null);
    if (asg.status === 'red' && !blocker.trim()) {
      setError('blocker_required_when_red');
      return;
    }
    try {
      await createPmCheckIn(token, {
        assignment_id: asg.id,
        note: blocker,
        blocker,
        forecast,
        evidence,
      });
      setCheckinOpen(false);
      setMessage('Check-in gửi Lead · actual không bị ghi đè');
      reload();
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Không gửi check-in');
    }
  };

  const submitAction = async () => {
    if (!asg) return;
    await createPmAction(token, {
      assignment_id: asg.id,
      title: actionTitle,
      owner: asg.owner,
      due: actionDue,
      impact: actionImpact,
    });
    setActionOpen(false);
    setMessage('Action đã tạo · gắn check-in Critical');
    reload();
  };

  return (
    <PmPage
      title={asg ? `Check-in Ritual — ${asg.name}` : 'Check-in Ritual'}
      subtitle="PM-06 · TEC_008 · Lower-is-better · Auto actual locked · Red bắt buộc blocker."
      crumb="Check-in Ritual"
      actions={
        <>
          <Link href="/crm/kpi-hub/performance/assignments" className="kpi-hub-btn kpi-hub-btn--ghost">
            Registry
          </Link>
          <button type="button" className="kpi-hub-btn kpi-hub-btn--primary" onClick={() => setCheckinOpen(true)}>
            ＋ Check-in
          </button>
        </>
      }
    >
      <PmAmberNotice>
        <b>Khác 15Five:</b> đây không phải weekly journal. Actual 5,2h đến từ Incident Dashboard (Verified). Owner
        không ghi đè — chỉ confirm, forecast, blocker, evidence.
      </PmAmberNotice>
      {overdueMode ? (
        <p className="kpi-hub-notice kpi-hub-notice--warn">06 check-in quá hạn — ưu tiên ritual tuần này.</p>
      ) : null}
      <PmPageState loading={loading} error={error === 'blocker_required_when_red' ? null : error} empty={!loading && !asg} />
      {error === 'blocker_required_when_red' ? (
        <p className="kpi-hub-form-error">blocker_required_when_red</p>
      ) : null}
      {message ? <p className="kpi-hub-notice kpi-hub-notice--success">{message}</p> : null}
      {asg ? (
        <div className="kpi-hub-pm-layout">
          <div className="kpi-hub-pm-main">
            <article className="kpi-hub-card">
              <div className="kpi-hub-card__body kpi-hub-pm-metricgrid">
                <div className="kpi-hub-pm-metric">
                  <span>TARGET</span>
                  <b>{asg.target_label}</b>
                </div>
                <div className="kpi-hub-pm-metric">
                  <span>ACTUAL · Verified</span>
                  <b className={asg.status === 'red' ? 'kpi-hub-form-error' : ''}>{asg.actual ?? '—'}</b>
                </div>
                <div className="kpi-hub-pm-metric">
                  <span>OVERRUN</span>
                  <b className={asg.status === 'red' ? 'kpi-hub-form-error' : ''}>{overrunLabel(asg)}</b>
                </div>
              </div>
            </article>
            <article className="kpi-hub-card">
              <header className="kpi-hub-card__head">
                <h2>Timeline</h2>
              </header>
              <div className="kpi-hub-card__body">
                <ul className="kpi-hub-pm-timeline">
                  {data.items.map((ck) => (
                    <li key={ck.id} className={overdueMode && ck.status === 'red' ? 'is-overdue' : ''}>
                      <b>
                        {ck.date} · {ck.author}
                        {ck.status === 'red' ? ' · Critical' : ''}
                      </b>
                      <span className={pmBadge(ck.status === 'approved' ? 'approved' : ck.status)}>
                        {ck.status === 'approved' ? 'Approved' : ck.status}
                      </span>
                      <p>{ck.note}</p>
                      {ck.forecast ? <p className="kpi-hub-muted">Forecast: {ck.forecast}</p> : null}
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          </div>
          <aside className="kpi-hub-pm-aside">
            <article className="kpi-hub-card">
              <header className="kpi-hub-card__head">
                <h2>Quality stamp</h2>
              </header>
              <ul className="kpi-hub-pm-list">
                <li>
                  <span>Source</span>
                  <b>{asg.source || 'Incident API'}</b>
                </li>
                <li>
                  <span>Last sync</span>
                  <b>12 phút</b>
                </li>
                <li>
                  <span>Quality</span>
                  <PmQualityChip quality={asg.quality} />
                </li>
              </ul>
            </article>
            <article className="kpi-hub-card">
              <div className="kpi-hub-card__body">
                <button
                  type="button"
                  className="kpi-hub-btn kpi-hub-btn--primary"
                  style={{ width: '100%' }}
                  onClick={() => setActionOpen(true)}
                >
                  ＋ Corrective Action
                </button>
              </div>
            </article>
          </aside>
        </div>
      ) : null}

      {checkinOpen ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => setCheckinOpen(false)}
          onKeyDown={() => undefined}
        >
          <div className="kpi-hub-card" role="dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520, margin: '10vh auto', padding: 0 }}>
            <header className="kpi-hub-card__head">
              <h2>Check-in Ritual</h2>
            </header>
            <div className="kpi-hub-card__body kpi-hub-pm-fields">
              <label className="kpi-hub-field">
                <span>Actual (locked · Verified)</span>
                <input value={asg?.actual != null ? `${asg.actual}` : ''} disabled={asg?.actual_locked ?? true} />
              </label>
              <label className="kpi-hub-field">
                <span>Forecast cuối kỳ</span>
                <input value={forecast} onChange={(e) => setForecast(e.target.value)} />
              </label>
              <label className="kpi-hub-field">
                <span>Blocker * (bắt buộc vì Red)</span>
                <textarea value={blocker} onChange={(e) => setBlocker(e.target.value)} rows={3} required={asg?.status === 'red'} />
              </label>
              <label className="kpi-hub-field">
                <span>Evidence</span>
                <input value={evidence} onChange={(e) => setEvidence(e.target.value)} />
              </label>
            </div>
            <div className="kpi-hub-card__body" style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className="kpi-hub-btn kpi-hub-btn--ghost" onClick={() => setCheckinOpen(false)}>
                Hủy
              </button>
              <button type="button" className="kpi-hub-btn kpi-hub-btn--primary" onClick={() => void submitCheckIn()}>
                Gửi ritual
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {actionOpen ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => setActionOpen(false)}
          onKeyDown={() => undefined}
        >
          <div className="kpi-hub-card" role="dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520, margin: '10vh auto', padding: 0 }}>
            <header className="kpi-hub-card__head">
              <h2>Corrective Action</h2>
            </header>
            <div className="kpi-hub-card__body kpi-hub-pm-fields">
              <label className="kpi-hub-field">
                <span>Tiêu đề *</span>
                <input value={actionTitle} onChange={(e) => setActionTitle(e.target.value)} />
              </label>
              <label className="kpi-hub-field">
                <span>Owner</span>
                <input value={asg?.owner ?? ''} disabled />
              </label>
              <label className="kpi-hub-field">
                <span>Due</span>
                <input value={actionDue} onChange={(e) => setActionDue(e.target.value)} />
              </label>
              <label className="kpi-hub-field">
                <span>Expected impact</span>
                <textarea value={actionImpact} onChange={(e) => setActionImpact(e.target.value)} rows={3} />
              </label>
            </div>
            <div className="kpi-hub-card__body" style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className="kpi-hub-btn kpi-hub-btn--ghost" onClick={() => setActionOpen(false)}>
                Hủy
              </button>
              <button type="button" className="kpi-hub-btn kpi-hub-btn--primary" onClick={() => void submitAction()}>
                Tạo Action
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </PmPage>
  );
}

export default function PerformanceCheckInPage() {
  return (
    <Suspense fallback={<p className="kpi-hub-muted">Đang tải check-in…</p>}>
      <PerformanceCheckInInner />
    </Suspense>
  );
}
