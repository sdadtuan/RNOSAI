'use client';

import { useEffect, useState } from 'react';
import { canGenerateContentOs, getAccessToken, getStoredUser } from '@/lib/auth';
import {
  aiTracePanelEmptyCopy,
  loadAiTracePanel,
  mapAiTraceDisplay,
  resetAiTracePanelView,
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
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    const cleared = resetAiTracePanelView();
    setTraces(cleared.items);
    setForbidden(cleared.forbidden);
    setLoadError(cleared.error === true);
    if (!shouldFetchAiTraces(canGenerate)) return;
    const token = getAccessToken();
    if (!token || !(itemId > 0)) return;
    let cancelled = false;
    void loadAiTracePanel(token, itemId, lifecycleHint).then((out) => {
      if (cancelled) return;
      setTraces(out.items);
      setForbidden(out.forbidden);
      setLoadError(out.error === true);
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
        <p className="cmkte-empty">{aiTracePanelEmptyCopy(loadError)}</p>
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
