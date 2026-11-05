'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { PmAmberNotice } from '@/components/kpi-hub/performance/PmMoatNotice';
import { PM_SUBTITLES } from '@/lib/performance-copy';
import { PmPage } from '@/components/kpi-hub/performance/PmPage';
import { getAccessToken } from '@/lib/auth';
import { ApiError } from '@/lib/api';
import { addPmScorecardItem, fetchPmScorecards } from '@/lib/performance-api';
import type { PmScorecard } from '@/lib/performance-types';

export default function AddScorecardItemPage() {
  const router = useRouter();
  const token = getAccessToken() ?? '';
  const [sc, setSc] = useState<PmScorecard | null>(null);
  const [definitionCode] = useState('MKT_007');
  const [weight, setWeight] = useState('15');
  const [target, setTarget] = useState('1200');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    if (!token) return;
    void fetchPmScorecards(token).then((res) => setSc(res.items[0] ?? null));
  }, [token]);

  const current = sc?.weight_total ?? 100;
  const proposed = current + Number(weight || 0);
  const wouldExceed = proposed > 100;

  const handleAdd = async () => {
    if (!sc) return;
    if (wouldExceed) {
      setBlocked(true);
      setError('weight_exceeds_100');
      return;
    }
    setSaving(true);
    setError(null);
    setBlocked(false);
    try {
      await addPmScorecardItem(token, sc.id, {
        name: 'Marketing Qualified Leads',
        definition_code: definitionCode,
        weight: Number(weight),
        target_label: target,
        unit: 'Leads',
        formula: "COUNT(leads WHERE lifecycle_stage='MQL')",
        owner: sc.owner,
      });
      router.push('/crm/kpi-hub/performance/scorecards');
    } catch (err: unknown) {
      if (err instanceof ApiError && err.message === 'weight_exceeds_100') {
        setBlocked(true);
        setError('weight_exceeds_100');
      } else {
        setError(err instanceof Error ? err.message : 'Không thêm được chỉ tiêu');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <PmPage
      title="Thêm chỉ tiêu vào Scorecard"
      subtitle={PM_SUBTITLES.scorecardItem}
      crumb="Thêm chỉ tiêu"
      actions={
        <>
          <Link href="/crm/kpi-hub/performance/scorecards" className="kpi-hub-btn kpi-hub-btn--ghost">
            Hủy
          </Link>
          <button type="button" className="kpi-hub-btn kpi-hub-btn--primary" disabled={saving} onClick={() => void handleAdd()}>
            Thêm chỉ tiêu
          </button>
        </>
      }
    >
      {error && error !== 'weight_exceeds_100' ? <p className="kpi-hub-form-error">{error}</p> : null}
      <div className="kpi-hub-pm-layout">
        <article className="kpi-hub-card">
          <div className="kpi-hub-card__body kpi-hub-pm-fields">
            <label className="kpi-hub-field">
              <span>Definition *</span>
              <select defaultValue={definitionCode}>
                <option value="MKT_007">MKT_007 — Marketing Qualified Leads</option>
              </select>
            </label>
            <label className="kpi-hub-field">
              <span>Weight % *</span>
              <input type="number" min={1} max={100} value={weight} onChange={(e) => setWeight(e.target.value)} />
            </label>
            <label className="kpi-hub-field">
              <span>Target *</span>
              <input value={target} onChange={(e) => setTarget(e.target.value)} />
            </label>
            <label className="kpi-hub-field">
              <span>Direction</span>
              <input value="Higher is better" disabled />
            </label>
            <label className="kpi-hub-field kpi-hub-field--full">
              <span>Formula snapshot</span>
              <input value="COUNT(leads WHERE lifecycle_stage='MQL')" disabled />
            </label>
          </div>
        </article>
        <aside className="kpi-hub-pm-aside">
          <article className="kpi-hub-card">
            <header className="kpi-hub-card__head">
              <h2>Preview weight</h2>
            </header>
            <div className="kpi-hub-card__body">
              <ul className="kpi-hub-pm-list">
                <li>
                  <span>Hiện tại</span>
                  <b>{current}%</b>
                </li>
                <li>
                  <span>Sau khi add {weight}%</span>
                  <b className={wouldExceed || blocked ? 'kpi-hub-form-error' : ''}>{proposed}%</b>
                </li>
              </ul>
              {wouldExceed || blocked ? (
                <PmAmberNotice>
                  AC-PM-01: Add bị block. Draft vẫn giữ scorecard cũ.
                </PmAmberNotice>
              ) : null}
            </div>
          </article>
        </aside>
      </div>
    </PmPage>
  );
}
