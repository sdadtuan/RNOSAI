'use client';

import { useEffect, useRef, useState } from 'react';
import {
  fetchResearchJob,
  TRANSITION_REASON_VI,
  type ResearchAiRun,
} from '@/lib/market-research-api';

const TERMINAL = new Set(['succeeded', 'failed']);

type ResearchJobChipProps = {
  token: string | null;
  projectId: number;
  runId: number | null;
  onSettled: (run: ResearchAiRun) => void;
};

export function ResearchJobChip({ token, projectId, runId, onSettled }: ResearchJobChipProps) {
  const [run, setRun] = useState<ResearchAiRun | null>(null);
  const settledRef = useRef<(run: ResearchAiRun) => void>(onSettled);
  settledRef.current = onSettled;

  useEffect(() => {
    if (!token || !runId) {
      setRun(null);
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let delay = 2000;

    const tick = async () => {
      try {
        const next = await fetchResearchJob(token, projectId, runId);
        if (cancelled) return;
        setRun(next);
        if (TERMINAL.has(next.status)) {
          settledRef.current(next);
          return;
        }
      } catch {
        if (cancelled) return;
      }
      delay = 5000;
      timer = setTimeout(() => void tick(), delay);
    };

    timer = setTimeout(() => void tick(), delay);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [token, projectId, runId]);

  if (!runId) return null;
  const status = run?.status ?? 'pending';
  const busy = status === 'pending' || status === 'running';
  const label =
    status === 'running'
      ? 'Đang lấy nguồn…'
      : status === 'pending'
        ? 'Desk đang chờ'
        : status === 'succeeded'
          ? 'Desk xong'
          : TRANSITION_REASON_VI[run?.error_message ?? ''] ?? run?.error_message ?? 'Desk thất bại';

  return (
    <span
      aria-busy={busy}
      title={run?.error_message ?? status}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '0.15rem 0.55rem',
        borderRadius: 999,
        background: 'color-mix(in srgb, var(--primary) 12%, white)',
        fontSize: '0.8rem',
      }}
    >
      {busy ? '● ' : ''}
      {label}
    </span>
  );
}
