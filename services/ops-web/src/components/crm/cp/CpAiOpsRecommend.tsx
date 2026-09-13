'use client';

import Link from 'next/link';
import { useState } from 'react';
import { getAccessToken } from '@/lib/auth';
import { recommendAiOpsProvider } from '@/lib/crm/cp-ai-ops-api';
import { aiOpsHref } from '@/lib/crm/cp-ai-ops-panes.util';
import {
  CP_RECOMMEND_HUMAN_COPY,
  formatRecommendReasons,
  recommendPaneOf,
} from '@/lib/crm/cp-ai-ops-recommend.util';
import { formatCpApiError } from '@/lib/crm/cp-api';

export function CpAiOpsRecommend({ projectId }: { projectId: string }) {
  const [humanCanvas, setHumanCanvas] = useState(false);
  const [restricted, setRestricted] = useState(false);
  const [privateLora, setPrivateLora] = useState(false);
  const [urgentPremium, setUrgentPremium] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{
    provider: string;
    reason_codes: string[];
  } | null>(null);

  async function onRecommend() {
    const token = getAccessToken();
    if (!token) return;
    setBusy(true);
    setError('');
    try {
      const out = await recommendAiOpsProvider(token, {
        human_canvas: humanCanvas,
        restricted,
        needs_private_lora: privateLora,
        urgent_premium: urgentPremium,
      });
      setResult({ provider: out.provider, reason_codes: out.reason_codes });
    } catch (err) {
      setResult(null);
      setError(formatCpApiError(err, 'Không đề xuất được'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="cp-card cp-ai-ops-recommend" data-testid="cp-ai-ops-recommend">
      <header className="cp-card__head">
        <h3 className="cp-ai-ops-recommend-title">Đề xuất provider</h3>
      </header>
      <p className="cp-muted" data-testid="cp-ai-ops-recommend-copy">{CP_RECOMMEND_HUMAN_COPY}</p>
      <div className="cp-ai-ops-recommend-signals">
        <label className="cp-check">
          <input
            type="checkbox"
            checked={humanCanvas}
            onChange={(event) => setHumanCanvas(event.target.checked)}
            data-testid="cp-recommend-human-canvas"
          />
          Canvas người
        </label>
        <label className="cp-check">
          <input
            type="checkbox"
            checked={restricted}
            onChange={(event) => setRestricted(event.target.checked)}
            data-testid="cp-recommend-restricted"
          />
          Asset hạn chế
        </label>
        <label className="cp-check">
          <input
            type="checkbox"
            checked={privateLora}
            onChange={(event) => setPrivateLora(event.target.checked)}
            data-testid="cp-recommend-lora"
          />
          LoRA riêng
        </label>
        <label className="cp-check">
          <input
            type="checkbox"
            checked={urgentPremium}
            onChange={(event) => setUrgentPremium(event.target.checked)}
            data-testid="cp-recommend-urgent"
          />
          Gấp premium
        </label>
      </div>
      <button
        className="cp-btn cp-btn--primary"
        type="button"
        disabled={busy}
        onClick={() => void onRecommend()}
        data-testid="cp-recommend-submit"
      >
        Xem đề xuất
      </button>
      {error ? <p className="cp-card--error" data-testid="cp-recommend-error">{error}</p> : null}
      {result ? (
        <p className="cp-ai-ops-meta" data-testid="cp-recommend-result">
          <span className="cp-ai-ops-chip" data-testid="cp-recommend-provider">{result.provider}</span>
          {' '}
          <span data-testid="cp-recommend-reasons">{formatRecommendReasons(result.reason_codes)}</span>
          {' · '}
          <Link
            href={aiOpsHref(projectId, recommendPaneOf(result.provider))}
            data-testid="cp-recommend-open"
          >
            Mở pane
          </Link>
        </p>
      ) : null}
    </section>
  );
}
