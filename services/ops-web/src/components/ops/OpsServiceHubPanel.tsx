'use client';

import { useEffect, useState } from 'react';
import { OpsEngineGrid } from '@/components/ops/OpsEngineGrid';
import { OpsHubHeader } from '@/components/ops/OpsHubHeader';
import { fetchOpsHub, parseOpsHubError, type OpsHubPayload } from '@/lib/ops-dv-api';

type Props = {
  token: string;
  lifecycleId: number;
};

export function OpsServiceHubPanel({ token, lifecycleId }: Props) {
  const [hub, setHub] = useState<OpsHubPayload | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setError('');
    setHub(null);
    void fetchOpsHub(token, lifecycleId)
      .then((data) => {
        if (!cancelled) setHub(data);
      })
      .catch((err) => {
        if (!cancelled) setError(parseOpsHubError(err));
      });
    return () => {
      cancelled = true;
    };
  }, [token, lifecycleId]);

  if (error) return <p className="error">{error}</p>;
  if (!hub) return <p className="muted">Đang tải Ops Hub…</p>;

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <OpsHubHeader lifecycle={hub.lifecycle} dv={hub.dv} />
      <section>
        <h4 style={{ margin: '0 0 0.5rem' }}>Execution engines</h4>
        <OpsEngineGrid engines={hub.engines} />
      </section>
      {hub.dv.readiness === 'gap' ? (
        <p className="muted">Dịch vụ này chưa có engine tự động — dùng SOP và checklist thủ công.</p>
      ) : null}
      {!hub.flags.pilot_dv ? (
        <p className="muted">DV ngoài pilot P0 — một số link có thể ở trạng thái partial.</p>
      ) : null}
    </div>
  );
}
