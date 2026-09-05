'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '@/lib/api';
import { hasCap } from '@/lib/auth';
import {
  fetchAmHealthDetail,
  overrideAmHealth,
  recomputeAmHealth,
  type AmHealthDetail as AmHealthDetailData,
} from '@/lib/crm/am-api';
import { bandCopy, type AmHealthBand } from '@/lib/crm/am-format';
import {
  AM_HEALTH_COMPONENT_LABELS,
  amHealthEmpty,
} from '@/lib/crm/am-health-center.util';
import { amRecoveryRequiredCopy } from '@/lib/crm/am-risk.util';
import { AmRiskForm } from './AmRiskForm';
import { useAmPage } from './AmShell';

function bandClass(band: string | null | undefined): string {
  if (band === 'healthy') return 'am-pill am-pill--ok';
  if (band === 'watch') return 'am-pill am-pill--watch';
  if (band === 'at_risk') return 'am-pill am-pill--risk';
  if (band === 'critical') return 'am-pill am-pill--crit';
  return 'am-pill';
}

export function AmHealthDetail({ agencyClientId }: { agencyClientId: string }) {
  const { token, user, canEdit } = useAmPage();
  const canManage = hasCap(user, 'crm_am', 'manage');
  const [showRecovery, setShowRecovery] = useState(false);
  const [data, setData] = useState<AmHealthDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState('');
  const [overrideBand, setOverrideBand] = useState<AmHealthBand>('watch');
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideUntil, setOverrideUntil] = useState('');
  const [overrideError, setOverrideError] = useState('');

  const load = useCallback(async () => {
    if (!token || !agencyClientId) return;
    setLoading(true);
    setError('');
    try {
      const next = await fetchAmHealthDetail(token, agencyClientId);
      setData(next);
      if (next.band) setOverrideBand(next.band);
    } catch (err) {
      setData(null);
      setError(err instanceof ApiError && err.status === 404 ? 'not_found' : 'load_failed');
    } finally {
      setLoading(false);
    }
  }, [agencyClientId, token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onRecompute() {
    if (!canManage || busy) return;
    setBusy(true);
    setBanner('');
    try {
      await recomputeAmHealth(token);
      setBanner('Đã tính lại scorecard.');
      await load();
    } catch (err) {
      setBanner(err instanceof ApiError ? err.message : 'Không tính lại được.');
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return (
      <section className="am-page">
        <p className="am-crumb">
          <Link href="/crm/account-management/health">Health & Risk</Link>
        </p>
        <div className="am-widget__error">
          <p>{error === 'not_found' ? 'Không tìm thấy khách trong phạm vi của bạn.' : 'Không tải được health detail.'}</p>
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
        <Link href="/crm/account-management/health">Health & Risk</Link>
        {' / '}
        {amHealthEmpty(data?.name)}
      </p>

      <header className="am-page__head">
        <div>
          <h1>Health Score — {amHealthEmpty(data?.name)}</h1>
          <div className="am-360__meta">
            <span className={bandClass(data?.band)}>
              {amHealthEmpty(data?.score)} / 100 · {bandCopy(data?.band ?? null)}
            </span>
            <span>Cập nhật: {amHealthEmpty(data?.as_of)}</span>
            <span>Scorecard v{amHealthEmpty(data?.scorecard_version)}</span>
          </div>
        </div>
        {canManage ? (
          <button type="button" className="am-btn" disabled={busy} onClick={() => void onRecompute()}>
            Tính lại
          </button>
        ) : null}
      </header>

      {data?.override ? (
        <p className="am-banner">
          Health override: {data.override.band} đến {data.override.until}. {data.override.reason}
        </p>
      ) : null}
      {data?.recovery_required ? (
        <p className="am-banner" role="alert">
          {amRecoveryRequiredCopy()}{' '}
          {canEdit ? (
            <button type="button" className="am-link" onClick={() => setShowRecovery(true)}>
              Tạo recovery
            </button>
          ) : (
            <Link className="am-link" href={`/crm/account-management/clients/${agencyClientId}`}>
              Mở 360
            </Link>
          )}
        </p>
      ) : null}
      {banner ? <p className="am-banner">{banner}</p> : null}
      {showRecovery ? (
        <AmRiskForm
          agencyClientId={agencyClientId}
          canEdit={canEdit}
          mode="recovery"
          onClose={() => setShowRecovery(false)}
          onSaved={() => {
            setShowRecovery(false);
            void load();
          }}
        />
      ) : null}

      {canManage ? (
        <form
          className="am-scorecard__override"
          onSubmit={(ev) => {
            ev.preventDefault();
            void (async () => {
              if (busy) return;
              const reason = overrideReason.trim();
              if (!reason) {
                setOverrideError('reason_required');
                return;
              }
              if (!overrideUntil || !overrideBand) {
                setOverrideError('override_until_invalid');
                return;
              }
              setBusy(true);
              setOverrideError('');
              try {
                await overrideAmHealth(token, agencyClientId, {
                  band: overrideBand,
                  reason,
                  until: overrideUntil,
                });
                setBanner('Đã ghi health override');
                await load();
              } catch (err) {
                setOverrideError(err instanceof ApiError ? err.message : 'Không ghi được override.');
              } finally {
                setBusy(false);
              }
            })();
          }}
        >
          <span className="am-muted">Override health</span>
          <select
            value={overrideBand}
            onChange={(ev) => setOverrideBand(ev.target.value as AmHealthBand)}
          >
            <option value="healthy">healthy</option>
            <option value="watch">watch</option>
            <option value="at_risk">at_risk</option>
            <option value="critical">critical</option>
          </select>
          <input
            placeholder="Lý do"
            value={overrideReason}
            onChange={(ev) => setOverrideReason(ev.target.value)}
          />
          <input
            type="date"
            value={overrideUntil}
            onChange={(ev) => setOverrideUntil(ev.target.value)}
          />
          <button type="submit" className="am-btn" disabled={busy}>
            Ghi
          </button>
          {overrideError ? <span className="am-banner">{overrideError}</span> : null}
        </form>
      ) : null}

      <section className="am-widget">
        <div className="am-widget__head">
          <h2>Trend</h2>
        </div>
        {loading && !data ? (
          <p className="am-muted">Đang tải…</p>
        ) : (
          <p>{(data?.trend ?? []).map((point) => amHealthEmpty(point.score)).join(' ─ ') || '—'}</p>
        )}
      </section>

      <section className="am-widget">
        <div className="am-widget__head">
          <h2>Thành phần</h2>
        </div>
        {!data?.contribution.length ? (
          <p className="am-muted">—</p>
        ) : (
          <div className="am-tbl-wrap">
            <table className="am-table">
              <thead>
                <tr>
                  <th>Thành phần</th>
                  <th>Điểm</th>
                  <th>Trọng số</th>
                  <th>Đóng góp</th>
                </tr>
              </thead>
              <tbody>
                {data.contribution.map((row) => (
                  <tr key={row.key}>
                    <td>{AM_HEALTH_COMPONENT_LABELS[row.key] ?? row.key}</td>
                    <td>{amHealthEmpty(row.score)}</td>
                    <td>{amHealthEmpty(row.weight)}%</td>
                    <td>{amHealthEmpty(row.points)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="am-widget">
        <div className="am-widget__head">
          <h2>Tín hiệu</h2>
        </div>
        {!data?.signals.length ? (
          <p className="am-muted">—</p>
        ) : (
          <ul className="am-work">
            {data.signals.map((signal) => (
              <li key={signal}>{signal}</li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
