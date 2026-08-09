'use client';

import { useState } from 'react';
import { postContentOsDraftJob, postContentOsVariantsJob, type ContentOsJob } from '@/lib/content-os-api';

interface Props {
  token: string;
  lifecycleId: number;
  itemId: number;
  aiEnabled: boolean;
  canGenerate: boolean;
  onJobDone: () => Promise<void> | void;
  onError: (msg: string) => void;
  onMessage: (msg: string) => void;
}

export function ContentOsGeneratePanel({
  token,
  lifecycleId,
  itemId,
  aiEnabled,
  canGenerate,
  onJobDone,
  onError,
  onMessage,
}: Props) {
  const [tone, setTone] = useState('professional_friendly');
  const [length, setLength] = useState('medium');
  const [goal, setGoal] = useState('engagement');
  const [variantCount, setVariantCount] = useState(3);
  const [busy, setBusy] = useState(false);
  const [lastJob, setLastJob] = useState<ContentOsJob | null>(null);

  async function runJob(kind: 'draft' | 'variants') {
    if (!canGenerate || !aiEnabled) return;
    setBusy(true);
    onError('');
    try {
      const job =
        kind === 'draft'
          ? await postContentOsDraftJob(token, lifecycleId, itemId, {
              tone,
              length,
              goal,
              variant_count: variantCount,
            })
          : await postContentOsVariantsJob(token, lifecycleId, itemId, {
              tone,
              goal,
              variant_count: variantCount,
            });
      setLastJob(job);
      if (job.status === 'failed') {
        onError(job.error_text ?? 'AI job failed');
      } else {
        onMessage(
          kind === 'draft'
            ? `Draft OK — v${String(job.output_json?.version_no ?? '?')}`
            : `Variants OK — ${String(job.output_json?.variant_count ?? variantCount)} hooks`,
        );
        await onJobDone();
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Generate thất bại');
    } finally {
      setBusy(false);
    }
  }

  if (!aiEnabled) {
    return <p className="muted" style={{ fontSize: '0.85rem' }}>AI tắt — bật PTT_CONTENT_MARKETING_AI_ENABLED.</p>;
  }

  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '0.65rem',
        display: 'grid',
        gap: '0.5rem',
      }}
    >
      <strong style={{ fontSize: '0.9rem' }}>AI Generate</strong>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
        <label style={{ display: 'grid', gap: '0.2rem', fontSize: '0.82rem' }}>
          <span className="muted">Tone</span>
          <select
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            disabled={!canGenerate || busy}
            style={selectStyle}
          >
            <option value="professional_friendly">Professional friendly</option>
            <option value="bold">Bold</option>
            <option value="casual">Casual</option>
            <option value="formal">Formal</option>
          </select>
        </label>
        <label style={{ display: 'grid', gap: '0.2rem', fontSize: '0.82rem' }}>
          <span className="muted">Length</span>
          <select
            value={length}
            onChange={(e) => setLength(e.target.value)}
            disabled={!canGenerate || busy}
            style={selectStyle}
          >
            <option value="short">Short</option>
            <option value="medium">Medium</option>
            <option value="long">Long</option>
          </select>
        </label>
        <label style={{ display: 'grid', gap: '0.2rem', fontSize: '0.82rem' }}>
          <span className="muted">Goal</span>
          <select
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            disabled={!canGenerate || busy}
            style={selectStyle}
          >
            <option value="engagement">Engagement</option>
            <option value="lead">Lead</option>
            <option value="awareness">Awareness</option>
          </select>
        </label>
        <label style={{ display: 'grid', gap: '0.2rem', fontSize: '0.82rem' }}>
          <span className="muted">Variants</span>
          <select
            value={variantCount}
            onChange={(e) => setVariantCount(Number(e.target.value))}
            disabled={!canGenerate || busy}
            style={selectStyle}
          >
            <option value={3}>3</option>
            <option value={4}>4</option>
            <option value={5}>5</option>
          </select>
        </label>
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          className="btn btn-sm"
          disabled={!canGenerate || busy}
          onClick={() => void runJob('draft')}
        >
          {busy ? 'Đang generate…' : 'Generate draft'}
        </button>
        <button
          type="button"
          className="btn btn-sm btn-secondary"
          disabled={!canGenerate || busy}
          onClick={() => void runJob('variants')}
        >
          Generate variants
        </button>
      </div>
      {!canGenerate ? (
        <p className="muted" style={{ fontSize: '0.82rem' }}>Cần quyền crm_content.generate</p>
      ) : null}
      {lastJob ? (
        <p className="muted" style={{ fontSize: '0.82rem' }}>
          Job #{lastJob.id} · {lastJob.job_type} · {lastJob.status}
          {lastJob.status === 'failed' && lastJob.error_text ? ` — ${lastJob.error_text}` : ''}
        </p>
      ) : null}
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '0.35rem',
  color: 'var(--text)',
};
