'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '@/lib/api';
import {
  fetchAmRenewal,
  patchAmRenewal,
  type AmRenewalCase as AmRenewalCaseData,
  type AmRenewalForecast,
} from '@/lib/crm/am-api';
import { bandCopy } from '@/lib/crm/am-format';
import {
  AM_RENEWAL_FORECASTS,
  amRenewalDash,
  amRenewalDaysCopy,
  amRenewalLostError,
  amRenewalMoneyDisplay,
  amRenewalPatchErrorCopy,
  amRenewalStatusCopy,
} from '@/lib/crm/am-renewal.util';
import { useAmPage } from './AmShell';

export function AmRenewalCase({ caseId }: { caseId: string }) {
  const { token, canEdit } = useAmPage();
  const [data, setData] = useState<AmRenewalCaseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState('');
  const [forecast, setForecast] = useState<AmRenewalForecast | ''>('');
  const [forecastPct, setForecastPct] = useState('');
  const [nextAction, setNextAction] = useState('');
  const [lostOpen, setLostOpen] = useState(false);
  const [lostResult, setLostResult] = useState<'lost' | 'paused'>('lost');
  const [lostReason, setLostReason] = useState('');
  const [lostOn, setLostOn] = useState('');
  const [lessons, setLessons] = useState('');
  const [recoverable, setRecoverable] = useState(false);
  const [lostError, setLostError] = useState('');

  const load = useCallback(async () => {
    if (!token || !caseId) return;
    setLoading(true);
    setError('');
    try {
      const next = await fetchAmRenewal(token, caseId);
      setData(next);
      setForecast(next.forecast ?? '');
      setForecastPct(next.forecast_pct == null ? '' : String(next.forecast_pct));
      setNextAction(next.next_action ?? '');
    } catch (err) {
      setData(null);
      setError(err instanceof ApiError && err.status === 404 ? 'not_found' : 'load_failed');
    } finally {
      setLoading(false);
    }
  }, [caseId, token]);

  useEffect(() => {
    void load();
  }, [load]);

  const closed = data?.status === 'renewed' || data?.status === 'lost';
  const hide = data?.hide_amounts === true;

  async function save() {
    if (!token || !data || !canEdit || closed || busy) return;
    setBusy(true);
    setBanner('');
    try {
      const pct = forecastPct.trim() === '' ? null : Number(forecastPct);
      const next = await patchAmRenewal(token, data.id, {
        forecast: forecast || null,
        forecast_pct: Number.isInteger(pct) ? pct : null,
        next_action: nextAction.trim() || null,
      });
      setData(next);
    } catch (err) {
      const code = err instanceof ApiError ? err.message : 'patch_failed';
      setBanner(amRenewalPatchErrorCopy(code));
    } finally {
      setBusy(false);
    }
  }

  async function markRenewed() {
    if (!token || !data || !canEdit || closed || busy) return;
    const raw = window.prompt('new_contract_id');
    if (raw == null) return;
    const newContractId = Number(String(raw).trim());
    if (!Number.isInteger(newContractId) || newContractId <= 0) {
      setBanner(amRenewalPatchErrorCopy('new_contract_required'));
      return;
    }
    setBusy(true);
    setBanner('');
    try {
      const next = await patchAmRenewal(token, data.id, {
        status: 'renewed',
        new_contract_id: newContractId,
        forecast: (forecast || data.forecast) ?? undefined,
        next_action: nextAction.trim() || data.next_action,
      });
      setData(next);
    } catch (err) {
      const code = err instanceof ApiError ? err.message : 'patch_failed';
      setBanner(amRenewalPatchErrorCopy(code));
    } finally {
      setBusy(false);
    }
  }

  async function confirmLost() {
    if (!token || !data || !canEdit || closed || busy) return;
    if (lostResult === 'lost') {
      const code = amRenewalLostError({ lost_reason: lostReason, lost_on: lostOn, lessons });
      if (code) {
        setLostError(amRenewalPatchErrorCopy(code));
        return;
      }
    }
    setBusy(true);
    setLostError('');
    try {
      const next = await patchAmRenewal(token, data.id, {
        status: lostResult,
        forecast: (forecast || data.forecast) ?? undefined,
        next_action: nextAction.trim() || data.next_action,
        lost_reason: lostReason.trim() || undefined,
        lost_on: lostOn.trim() || undefined,
        lessons: lessons.trim() || undefined,
        recoverable: lostResult === 'lost' ? recoverable : undefined,
      });
      setData(next);
      setLostOpen(false);
    } catch (err) {
      const code = err instanceof ApiError ? err.message : 'patch_failed';
      setLostError(amRenewalPatchErrorCopy(code));
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <section className="am-page">
        <p className="am-muted">Đang tải renewal case…</p>
      </section>
    );
  }

  if (error || !data) {
    return (
      <section className="am-page">
        <p className="am-crumb">
          <Link href="/crm/account-management/renewals">Gia hạn</Link>
        </p>
        <div className="am-widget__error">
          <p>
            {error === 'not_found'
              ? 'Không tìm thấy renewal case trong phạm vi của bạn.'
              : 'Không tải được renewal case. Thử lại.'}
          </p>
          <button type="button" className="am-btn" onClick={() => void load()}>
            Retry
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="am-page">
      <p className="am-crumb">
        <Link href="/crm/account-management/renewals">Gia hạn</Link>
        {' / '}
        {data.name || '—'}
      </p>
      <header className="am-360__head">
        <div>
          <h1>{data.name || '—'}</h1>
          <p className="am-muted">
            {amRenewalStatusCopy(data.status)} · {bandCopy(data.band)} · {amRenewalDash(data.contract_ref)} ·
            Hết hạn {amRenewalDash(data.ends_on)} ({amRenewalDaysCopy(data.days_remaining)}) · Owner{' '}
            {amRenewalDash(data.owner_label)}
          </p>
        </div>
      </header>

      {banner ? <p className="am-banner">{banner}</p> : null}

      <section className="am-widget">
        <h2>Forecast</h2>
        <label className="am-field">
          <span>Forecast</span>
          <select
            value={forecast}
            disabled={!canEdit || closed}
            onChange={(ev) => setForecast(ev.target.value as AmRenewalForecast | '')}
          >
            <option value="">—</option>
            {AM_RENEWAL_FORECASTS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="am-field">
          <span>Probability %</span>
          <input
            type="number"
            min={0}
            max={100}
            value={forecastPct}
            disabled={!canEdit || closed}
            onChange={(ev) => setForecastPct(ev.target.value)}
          />
        </label>
        <label className="am-field">
          <span>Next action</span>
          <textarea
            rows={3}
            value={nextAction}
            disabled={!canEdit || closed}
            onChange={(ev) => setNextAction(ev.target.value)}
          />
        </label>
        {canEdit && !closed ? (
          <div className="am-form__actions">
            <button type="button" className="am-btn am-btn--primary" disabled={busy} onClick={() => void save()}>
              Lưu
            </button>
            <button type="button" className="am-btn" disabled={busy} onClick={() => void markRenewed()}>
              Đánh dấu Renewed
            </button>
            <button type="button" className="am-btn am-btn--danger" disabled={busy} onClick={() => setLostOpen(true)}>
              Đánh dấu Lost/Churned
            </button>
          </div>
        ) : null}
      </section>

      {lostOpen ? (
        <div className="am-drawer-bg" role="presentation" onClick={() => setLostOpen(false)}>
          <div
            className="am-onboard__modal"
            role="dialog"
            aria-labelledby="am-lost-title"
            onClick={(ev) => ev.stopPropagation()}
          >
            <div className="am-widget__head">
              <h2 id="am-lost-title">Kết thúc Renewal Case</h2>
              <button type="button" className="am-btn" onClick={() => setLostOpen(false)}>
                ×
              </button>
            </div>
            <fieldset className="am-field">
              <legend>Kết quả *</legend>
              <label className="am-field--check">
                <span>
                  <input
                    type="radio"
                    name="lost-result"
                    checked={lostResult === 'lost'}
                    onChange={() => setLostResult('lost')}
                  />
                  Lost
                </span>
              </label>
              <label className="am-field--check">
                <span>
                  <input
                    type="radio"
                    name="lost-result"
                    checked={lostResult === 'paused'}
                    onChange={() => setLostResult('paused')}
                  />
                  Paused
                </span>
              </label>
            </fieldset>
            <label className="am-field">
              <span>Lý do chính *</span>
              <input value={lostReason} onChange={(ev) => setLostReason(ev.target.value)} />
            </label>
            <label className="am-field">
              <span>Ngày hiệu lực *</span>
              <input type="date" value={lostOn} onChange={(ev) => setLostOn(ev.target.value)} />
            </label>
            <p className="am-muted">
              Doanh thu mất dự kiến {amRenewalMoneyDisplay(hide, data.mrr_vnd)} / tháng
            </p>
            <label className="am-field am-field--check">
              <span>
                <input
                  type="checkbox"
                  checked={recoverable}
                  onChange={(ev) => setRecoverable(ev.target.checked)}
                />
                Có thể phục hồi?
              </span>
            </label>
            <label className="am-field">
              <span>Ghi chú / lessons learned *</span>
              <textarea rows={3} value={lessons} onChange={(ev) => setLessons(ev.target.value)} />
            </label>
            {lostError ? <p className="am-banner">{lostError}</p> : null}
            <div className="am-form__actions">
              <button type="button" className="am-btn" onClick={() => setLostOpen(false)}>
                Hủy
              </button>
              <button
                type="button"
                className="am-btn am-btn--danger"
                disabled={busy}
                onClick={() => void confirmLost()}
              >
                Xác nhận kết quả
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
