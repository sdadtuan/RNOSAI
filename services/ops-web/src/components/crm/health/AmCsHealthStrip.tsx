'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import '@/app/crm/account-management/am.css';
import { fetchAmHealthCenter, type AmHealthCenter } from '@/lib/crm/am-api';
import { amCsHealthStripAvg } from '@/lib/crm/am-cs-health-strip.util';
import { dash } from '@/lib/crm/am-format';
import { AM_HEALTH_BAND_KEYS, AM_HEALTH_TILES } from '@/lib/crm/am-health-center.util';

function bandClass(band: (typeof AM_HEALTH_BAND_KEYS)[number]): string {
  if (band === 'healthy') return 'am-pill am-pill--ok';
  if (band === 'watch') return 'am-pill am-pill--watch';
  if (band === 'at_risk') return 'am-pill am-pill--risk';
  return 'am-pill am-pill--crit';
}

function bandLabel(band: (typeof AM_HEALTH_BAND_KEYS)[number]): string {
  return AM_HEALTH_TILES.find((tile) => tile.key === band)?.label ?? band;
}

export function AmCsHealthStrip({ token }: { token: string }) {
  const [data, setData] = useState<AmHealthCenter | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(false);
    try {
      setData(await fetchAmHealthCenter(token));
    } catch {
      setData(null);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const showDash = error || (!loading && !data);
  const avg = showDash ? null : amCsHealthStripAvg(data?.sparkline);

  return (
    <section className="am-widget am-cs-health-strip" aria-label="AM Health snapshot">
      <div className="am-widget__head">
        <h2>AM Health</h2>
        <Link className="am-link" href="/crm/account-management/health">
          Xem AM Health
        </Link>
      </div>

      <p className="am-muted">TB {showDash ? '—' : dash(avg)}</p>
      <div className="am-legend">
        {AM_HEALTH_BAND_KEYS.map((band) => (
          <span key={band} className={bandClass(band)}>
            {bandLabel(band)} {showDash ? '—' : dash(data?.tiles?.[band])}
          </span>
        ))}
      </div>

      {error ? (
        <div className="am-widget__error">
          <button type="button" className="am-btn" onClick={() => void load()}>
            Retry
          </button>
        </div>
      ) : null}
    </section>
  );
}
