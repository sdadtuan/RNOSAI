'use client';

import { useEffect, useState } from 'react';
import { getAccessToken } from '@/lib/auth';
import { getProviderHealth } from '@/lib/crm/cp-ai-ops-api';
import {
  COMFY_LOCKED_COPY,
  isComfySubmitEnabled,
  shouldShowComfyLockedCopy,
  type ComfyHealth,
} from '@/lib/crm/cp-ai-ops-panes.util';
import type { CpAiOpsFlags } from '@/lib/crm/cp-api';
import { dash } from '@/lib/crm/cp-format';

export function CpAiOpsComfyPane({
  flags,
}: {
  projectId: string;
  flags: CpAiOpsFlags;
}) {
  const [health, setHealth] = useState<ComfyHealth | null>(null);
  const locked = shouldShowComfyLockedCopy(health);
  const canSubmit = isComfySubmitEnabled(flags, health);
  const vram = health?.ok === true ? health.vram_mb : null;

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;
    let cancelled = false;
    void getProviderHealth(token)
      .then((payload) => {
        if (!cancelled) setHealth(payload.comfy);
      })
      .catch(() => {
        if (!cancelled) setHealth({ ok: false, reason: 'gpu_building' });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="cp-ai-ops-composer" data-testid="cp-comfy-pane">
      <header className="cp-ai-ops-head">
        <h2>Comfy</h2>
        <p className="cp-muted">Job GPU nội bộ — không gọi máy từ trình duyệt.</p>
      </header>
      {locked ? (
        <p className="cp-empty" data-testid="cp-comfy-locked">{COMFY_LOCKED_COPY}</p>
      ) : null}
      <p className="cp-ai-ops-meta">
        VRAM <span data-testid="cp-comfy-vram">{dash(vram)}</span>
      </p>
      <div className="cp-ai-ops-actions">
        <button
          className="cp-btn cp-btn--primary"
          type="button"
          data-testid="cp-comfy-submit"
          disabled={!canSubmit}
        >
          Submit
        </button>
      </div>
    </section>
  );
}
