'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { hasCap } from '@/lib/auth';
import { fetchAmHealthCenter, type AmHealthCenter as AmHealthCenterData } from '@/lib/crm/am-api';
import { bandCopy } from '@/lib/crm/am-format';
import {
  AM_HEALTH_TILES,
  amHealthDelta,
  amHealthEmpty,
  amHealthMoney,
  amHealthRecoveryCopy,
  amHealthSparkHeight,
  amHealthTileValue,
} from '@/lib/crm/am-health-center.util';
import { useAmPage } from './AmShell';

function bandClass(band: string | null | undefined): string {
  if (band === 'healthy') return 'am-pill am-pill--ok';
  if (band === 'watch') return 'am-pill am-pill--watch';
  if (band === 'at_risk') return 'am-pill am-pill--risk';
  if (band === 'critical') return 'am-pill am-pill--crit';
  return 'am-pill';
}

export function AmHealthCenter() {
  const { token, scope, user } = useAmPage();
  const canManage = hasCap(user, 'crm_am', 'manage');
  const [data, setData] = useState<AmHealthCenterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      setData(await fetchAmHealthCenter(token, { scope }));
    } catch {
      setData(null);
      setError('load_failed');
    } finally {
      setLoading(false);
    }
  }, [scope, token]);

  useEffect(() => {
    void load();
  }, [load]);

  const hide = data?.hide_amounts === true;
  const spark = data?.sparkline ?? [];

  return (
    <section className="am-page">
      <header className="am-page__head">
        <div>
          <h1>Health & Risk Center</h1>
          <p className="am-muted">Điểm sức khỏe theo scorecard AM. Churned không tính vào band.</p>
        </div>
        {canManage ? (
          <Link className="am-btn" href="/crm/account-management/settings">
            Cấu hình scorecard
          </Link>
        ) : null}
      </header>

      {error ? (
        <div className="am-widget__error">
          <p>Không tải được Health & Risk.</p>
          <button type="button" className="am-btn" onClick={() => void load()}>
            Retry
          </button>
        </div>
      ) : null}

      <div className="am-tiles">
        {AM_HEALTH_TILES.map((tile) => (
          <article key={tile.key} className="am-tile">
            <span>{tile.label}</span>
            <strong>{loading && !data ? '—' : amHealthTileValue(tile.key, data?.tiles ?? null, hide)}</strong>
          </article>
        ))}
      </div>

      <section className="am-widget">
        <div className="am-widget__head">
          <h2>Biến động điểm sức khỏe</h2>
        </div>
        {spark.length === 0 ? (
          <p className="am-muted">—</p>
        ) : (
          <>
            <div className="am-spark" aria-label="Average score last 6 months">
              {spark.map((point) => (
                <div key={point.as_of} className="am-spark__col">
                  <div
                    className={`am-spark__bar${point.avg == null ? ' am-spark__bar--empty' : ''}`}
                    style={{ height: `${amHealthSparkHeight(point.avg)}%` }}
                    title={point.avg == null ? '—' : String(point.avg)}
                  />
                  <span>{point.as_of.slice(0, 7) || '—'}</span>
                </div>
              ))}
            </div>
            <p className="am-muted">
              {spark
                .map((point) => (point.avg == null ? '—' : String(point.avg)))
                .join(' · ')}
            </p>
          </>
        )}
      </section>

      <section className="am-widget">
        <div className="am-widget__head">
          <h2>Account rủi ro</h2>
        </div>
        {loading && !data ? (
          <p className="am-muted">Đang tải…</p>
        ) : !data?.risky.length ? (
          <p className="am-muted">—</p>
        ) : (
          <div className="am-tbl-wrap">
            <table className="am-table">
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Score</th>
                  <th>Δ 30d</th>
                  <th>Revenue</th>
                  <th>Owner</th>
                  <th>Open risks</th>
                  <th>Recovery</th>
                </tr>
              </thead>
              <tbody>
                {data.risky.map((row) => (
                  <tr key={row.agency_client_id}>
                    <td>
                      <Link
                        className="am-link"
                        href={`/crm/account-management/health/${row.agency_client_id}`}
                      >
                        {amHealthEmpty(row.name)}
                      </Link>
                    </td>
                    <td>
                      <span className={bandClass(row.band)}>
                        {amHealthEmpty(row.score)} · {bandCopy(row.band)}
                      </span>
                    </td>
                    <td>{amHealthDelta(row.delta_30d)}</td>
                    <td>{amHealthMoney(hide, row.mrr_vnd)}</td>
                    <td>{amHealthEmpty(row.owner_label)}</td>
                    <td>{amHealthEmpty(row.open_risks)}</td>
                    <td>{amHealthRecoveryCopy(row.recovery_status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}
