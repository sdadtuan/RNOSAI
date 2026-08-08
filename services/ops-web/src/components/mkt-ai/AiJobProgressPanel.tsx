'use client';

import { useState } from 'react';
import type { MktAiJobRow } from '@/lib/mkt-ai-planner-api';
import styles from '@/components/mkt-ai/mkt-ai-planner.module.css';

const JOB_LABELS: Record<string, string> = {
  strategy_generate: 'Chiến lược',
  campaign_generate: 'Campaign',
  content_generate: 'Content',
  quality_score: 'Quality score',
  apply_to_tmmt: 'Apply TMMT',
  multi_agent: 'Pipeline AI',
};

interface Props {
  jobs: MktAiJobRow[];
  stubMode?: boolean;
  onRetry?: (type: 'strategy' | 'campaigns' | 'content' | 'quality') => void;
  retrying?: boolean;
}

function statusMeta(status: string): { icon: string; color: string; label: string } {
  if (status === 'succeeded') {
    return { icon: '●', color: 'var(--accent, #16a34a)', label: 'Thành công' };
  }
  if (status === 'failed') {
    return { icon: '✕', color: 'var(--danger, #dc2626)', label: 'Thất bại' };
  }
  if (status === 'running') {
    return { icon: '◐', color: '#2563eb', label: 'Đang chạy' };
  }
  if (status === 'pending') {
    return { icon: '○', color: 'var(--muted, #6b7280)', label: 'Chờ' };
  }
  return { icon: '○', color: 'var(--muted, #6b7280)', label: status };
}

export function AiJobProgressPanel({ jobs, stubMode, onRetry, retrying }: Props) {
  const [open, setOpen] = useState(true);
  const recent = [...jobs].slice(-8).reverse();
  const lastModel = recent.find((j) => j.model_name)?.model_name;
  const activeCount = recent.filter((j) => j.status === 'pending' || j.status === 'running').length;

  return (
    <aside className={`card ${styles.jobPanelAside}`}>
      <button
        type="button"
        className={`btn btn-sm btn-ghost ${styles.jobToggle}`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span>Jobs AI{activeCount ? ` (${activeCount} đang chạy)` : ''}</span>
        <span>{open ? '▲' : '▼'}</span>
      </button>

      <div className={open ? undefined : styles.jobBodyCollapsed}>
        <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.9rem' }}>
          Jobs AI
          {activeCount ? (
            <span className="muted" style={{ fontWeight: 400, fontSize: '0.8rem' }}>
              {' '}
              · {activeCount} đang chạy
            </span>
          ) : null}
        </h3>
        {recent.length === 0 ? (
          <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
            Chưa có job — sinh chiến lược để bắt đầu.
          </p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {recent.map((job) => {
              const meta = statusMeta(job.status);
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
                    display: 'grid',
                    gap: '0.25rem',
                    fontSize: '0.8rem',
                    padding: '0.45rem 0',
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ width: 18, textAlign: 'center', color: meta.color }}>{meta.icon}</span>
                    <span style={{ flex: 1 }}>
                      {JOB_LABELS[job.job_type] ?? job.job_type}
                      {job.job_type === 'multi_agent' ? (
                        <span className="muted" style={{ fontSize: '0.72rem' }}>
                          {' '}
                          · parent
                        </span>
                      ) : null}
                    </span>
                    <span style={{ color: meta.color, fontSize: '0.75rem' }}>{meta.label}</span>
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
                  </div>
                  {failed && job.error_message ? (
                    <p className="error" style={{ margin: 0, fontSize: '0.75rem', paddingLeft: '1.6rem' }}>
                      {job.error_message.slice(0, 120)}
                    </p>
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
      </div>
    </aside>
  );
}
