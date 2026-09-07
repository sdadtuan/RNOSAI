'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { getAccessToken } from '@/lib/auth';
import {
  CP_RENDER_POLL_MS,
  formatCpApiError,
  getOverviewHealth,
  type CpOverviewHealth,
  type CpScope,
} from '@/lib/crm/cp-api';
import { dash, formatOpsP95, formatOpsSlots } from '@/lib/crm/cp-format';
import { CpRenderOps } from './CpRenderOps';

export function CpOpsMonitor({
  scope,
  title = 'Render Operations',
}: {
  scope?: string;
  title?: string;
}) {
  const currentScope: CpScope = scope === 'team' || scope === 'all' ? scope : 'me';
  const [health, setHealth] = useState<CpOverviewHealth | null>(null);
  const [error, setError] = useState('');

  const loadHealth = useCallback(async (quiet = false) => {
    const token = getAccessToken();
    if (!token) return;
    try {
      setHealth(await getOverviewHealth(token, { scope: currentScope }));
      setError('');
    } catch (caught) {
      if (!quiet) {
        setHealth(null);
        setError(formatCpApiError(caught, 'Không tải được sức khỏe sản xuất'));
      }
    }
  }, [currentScope]);

  useEffect(() => {
    void loadHealth();
    const pollTimer = window.setInterval(() => void loadHealth(true), CP_RENDER_POLL_MS);
    return () => window.clearInterval(pollTimer);
  }, [loadHealth]);

  const provider = health?.providers[0] ?? null;

  return (
    <div className="cp-overview">
      <header className="cp-overview__head">
        <div>
          <p className="cp-crumb">Vận hành / Sản xuất sáng tạo / Ops</p>
          <h1>{title}</h1>
          <p className="cp-muted">Theo dõi queue và thao tác render jobs.</p>
        </div>
        <Link className="cp-btn" href={`/crm/creative-os/video?scope=${currentScope}`}>Video drafts</Link>
      </header>
      {error ? (
        <section className="cp-card cp-card--error">
          <p>{error}</p>
          <button className="cp-btn" type="button" onClick={() => void loadHealth()}>Thử lại</button>
        </section>
      ) : null}
      <section className="cp-card">
        <header className="cp-card__head">
          <h2>Sức khỏe 60 phút</h2>
        </header>
        <dl className="cp-health">
          <div>
            <dt>Hàng đợi</dt>
            <dd>{dash(health?.queue_depth)}</dd>
          </div>
          <div>
            <dt>Slot</dt>
            <dd>{formatOpsSlots(health?.slots.used ?? null, health?.slots.max ?? null)}</dd>
          </div>
          <div>
            <dt>Provider p95</dt>
            <dd>{formatOpsP95(provider?.p95_sec ?? null)}</dd>
          </div>
        </dl>
      </section>
      <CpRenderOps scope={currentScope} />
    </div>
  );
}
