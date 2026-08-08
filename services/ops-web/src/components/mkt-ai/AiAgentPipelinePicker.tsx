'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { AiPlaybookSelector } from '@/components/mkt-ai/AiPlaybookSelector';
import {
  postMktAiMultiAgentJob,
  type MktAiBrief,
  type MktAiBriefValidation,
  type MktAiMultiAgentStatusPayload,
  type MktAiPipelineStep,
  type MktAiPlannerContext,
} from '@/lib/mkt-ai-planner-api';

interface Props {
  token: string;
  lifecycleId: number;
  serviceSlug?: string;
  canEdit: boolean;
  paused?: boolean;
  briefReady: boolean;
  playbookContext?: MktAiPlannerContext['playbook'];
  playbooksEnabled?: boolean;
  multiAgent?: MktAiMultiAgentStatusPayload;
  onAppliedPlaybook: (result: {
    brief: MktAiBrief;
    brief_validation: MktAiBriefValidation;
    playbook_slug: string;
    messages: string[];
  }) => void;
  onPipelineFinished: () => void;
  onError?: (message: string) => void;
  onMessage?: (message: string) => void;
}

function stepIcon(state: string): string {
  if (state === 'succeeded') return '✓';
  if (state === 'failed') return '✕';
  if (state === 'running') return '…';
  if (state === 'skipped') return '−';
  return '○';
}

export function AiAgentPipelinePicker({
  token,
  lifecycleId,
  serviceSlug,
  canEdit,
  paused = false,
  briefReady,
  playbookContext,
  playbooksEnabled = false,
  multiAgent,
  onAppliedPlaybook,
  onPipelineFinished,
  onError,
  onMessage,
}: Props) {
  const [busy, setBusy] = useState(false);

  const steps = multiAgent?.steps ?? [];
  const failedStep = multiAgent?.failed_step;
  const firstPendingOrFailed = useMemo(
    () => steps.find((s) => s.state === 'pending' || s.state === 'failed')?.step,
    [steps],
  );

  async function runPipeline(startFrom?: MktAiPipelineStep) {
    if (!canEdit || !briefReady) return;
    setBusy(true);
    onError?.('');
    try {
      const out = await postMktAiMultiAgentJob(token, lifecycleId, {
        start_from_step: startFrom,
      });
      onMessage?.(
        out.status === 'succeeded'
          ? 'Pipeline AI hoàn tất — draft đã cập nhật'
          : out.status === 'partial'
            ? `Pipeline dừng ở bước ${out.output.failed_step ?? 'unknown'} — draft các bước trước được giữ`
            : 'Pipeline AI thất bại',
      );
      onPipelineFinished();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Chạy pipeline AI thất bại');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card" style={{ padding: '1rem', display: 'grid', gap: '0.85rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1rem' }}>Pipeline AI</h3>
          <p className="muted" style={{ margin: '0.35rem 0 0', fontSize: '0.85rem' }}>
            Strategist → Planner → Copywriter → Analyst (tuần tự, audit từng job con)
          </p>
        </div>
        <Link href="/admin/ai/agents?plan=mkt_ai" className="nav-link" style={{ fontSize: '0.85rem' }}>
          Xem trace admin →
        </Link>
      </div>

      {playbooksEnabled ? (
        <AiPlaybookSelector
          token={token}
          lifecycleId={lifecycleId}
          serviceSlug={serviceSlug}
          canEdit={canEdit}
          paused={paused || busy}
          activeSlug={playbookContext?.slug ?? null}
          onApplied={onAppliedPlaybook}
          onError={onError}
        />
      ) : null}

      {!briefReady ? (
        <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
          Hoàn thiện brief hợp lệ trước khi chạy pipeline.
        </p>
      ) : null}

      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          flexWrap: 'wrap',
          alignItems: 'center',
          padding: '0.65rem 0.75rem',
          borderRadius: 8,
          border: '1px solid var(--border)',
          background: 'rgba(57, 139, 67, 0.03)',
        }}
      >
        {steps.length === 0 ? (
          ['Strategist', 'Planner', 'Copywriter', 'Analyst'].map((label, idx, arr) => (
            <span key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span className="muted">○ {label}</span>
              {idx < arr.length - 1 ? <span className="muted">→</span> : null}
            </span>
          ))
        ) : (
          steps.map((step, idx) => (
            <span key={step.step} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span
                style={{
                  color:
                    step.state === 'succeeded'
                      ? 'var(--accent)'
                      : step.state === 'failed'
                        ? 'var(--danger, #dc2626)'
                        : 'inherit',
                }}
              >
                {stepIcon(step.state)} {step.label_vi}
              </span>
              {idx < steps.length - 1 ? <span className="muted">→</span> : null}
            </span>
          ))
        )}
      </div>

      {multiAgent?.rollup_status && multiAgent.rollup_status !== 'idle' ? (
        <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
          Trạng thái pipeline: <strong>{multiAgent.rollup_status}</strong>
          {multiAgent.quality_score != null ? ` · Quality ${multiAgent.quality_score}` : ''}
          {failedStep ? ` · Lỗi tại ${failedStep}` : ''}
        </p>
      ) : null}

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          className="btn btn-sm"
          disabled={!canEdit || !briefReady || paused || busy}
          onClick={() => void runPipeline()}
        >
          Chạy pipeline AI
        </button>
        <button
          type="button"
          className="btn btn-sm btn-secondary"
          disabled={!canEdit || !briefReady || paused || busy || !firstPendingOrFailed}
          onClick={() => void runPipeline(firstPendingOrFailed)}
        >
          Chạy từ bước hiện tại
        </button>
      </div>
    </div>
  );
}
