'use client';

import { useEffect, useState } from 'react';
import { canGenerateContentOs, getAccessToken, getStoredUser } from '@/lib/auth';
import {
  AI_TRACE_EMPTY,
  fetchPortfolioAiTraces,
  mapAiTraceDisplay,
  shouldFetchAiTraces,
  shouldShowAiTracePanel,
  type PortfolioAiTrace,
} from '@/lib/crm/cmkte-ai-traces';

export function CmktEAiTracePanel({
  itemId,
  lifecycleHint,
}: {
  itemId: number;
  lifecycleHint?: number;
}) {
  const user = getStoredUser();
  const canGenerate = user ? canGenerateContentOs(user) : null;
  const [traces, setTraces] = useState<PortfolioAiTrace[]>([]);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    if (!shouldFetchAiTraces(canGenerate)) return;
    const token = getAccessToken();
    if (!token || !(itemId > 0)) return;
    let cancelled = false;
    void fetchPortfolioAiTraces(token, itemId, lifecycleHint).then((out) => {
      if (cancelled) return;
      setTraces(out.items);
      setForbidden(out.forbidden);
    });
    return () => {
      cancelled = true;
    };
  }, [itemId, lifecycleHint, canGenerate]);

  if (!shouldShowAiTracePanel({ canGenerate, forbidden })) return null;

  return (
    <div className="cmkte-ai-trace">
      <h3 className="cmkte-section-title">AI Trace</h3>
      {traces.length === 0 ? (
        <p className="cmkte-empty">{AI_TRACE_EMPTY}</p>
      ) : (
        <ul className="cmkte-list">
          {traces.map((row) => {
            const view = mapAiTraceDisplay(row);
            return (
              <li key={row.job_id}>
                {view.time} · {view.intent} · {view.sources}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
