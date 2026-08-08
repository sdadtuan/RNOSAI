'use client';

import type { MktAiJobRow } from '@/lib/mkt-ai-planner-api';

const JOB_LABELS: Record<string, string> = {
  strategy_generate: 'Chiến lược',
  campaign_generate: 'Campaign',
  content_generate: 'Content',
  quality_score: 'Quality score',
  apply_to_tmmt: 'Apply TMMT',
};

interface Props {
  jobs: MktAiJobRow[];
  stubMode?: boolean;
  onRetry?: (type: 'strategy' | 'campaigns' | 'content' | 'quality') => void;
  retrying?: boolean;
}

function statusIcon(status: string): string {
  if (status === 'succeeded') return '●';
  if (status === 'failed') return '✕';
  if (status === 'running' || status === 'pending') return '◐';
  return '○';
}

export function AiJobProgressPanel({ jobs, stubMode, onRetry, retrying }: Props) {
  const recent = [...jobs].slice(-6).reverse();
  const lastModel = recent.find((j) => j.model_name)?.model_name;

  return (
    <aside
      className="card"
      style={{
        padding: '0.85rem',
        width: '100%',
        maxWidth: 280,
        alignSelf: 'flex-start',
        position: 'sticky',
        top: '1rem',
      }}
    >
      <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.9rem' }}>Jobs AI</h3>
      {recent.length === 0 ? (
        <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
          Chưa có job — sinh chiến lược để bắt đầu.
        </p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {recent.map((job) => {
            const failed = job.status === 'failed';
            const retryType =
              job.job_type === 'strategy_generate'
                ? 'strategy'
                : job.job_type === 'campaign_generate'
                  ? 'campaigns'
                  : job.job_type === 'content_generate'
                    ? 'content'
                    : job.job_type === 'quality_score'
                      ? 'quality'
                      : null;
            return (
              <li
                key={job.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.8rem',
                  padding: '0.35rem 0',
                  borderBottom: '1px solid var(--border)',
                  color: failed ? 'var(--danger, #dc2626)' : undefined,
                }}
              >
                <span style={{ width: 18, textAlign: 'center' }}>{statusIcon(job.status)}</span>
                <span style={{ flex: 1 }}>{JOB_LABELS[job.job_type] ?? job.job_type}</span>
                <span className="muted" style={{ fontSize: '0.75rem' }}>
                  {job.status}
                </span>
                {failed && retryType && onRetry ? (
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost"
                    disabled={retrying}
                    onClick={() => onRetry(retryType)}
                  >
                    Thử lại
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      {lastModel ? (
        <p className="muted" style={{ margin: '0.75rem 0 0', fontSize: '0.75rem' }}>
          Model: {lastModel}
          {stubMode ? ' (stub)' : ''}
        </p>
      ) : null}
    </aside>
  );
}
