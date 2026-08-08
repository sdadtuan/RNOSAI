'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { BriefIntakeForm } from '@/components/mkt-ai/BriefIntakeForm';
import { AiJobProgressPanel } from '@/components/mkt-ai/AiJobProgressPanel';
import { AiTmmtGateBanner } from '@/components/mkt-ai/AiTmmtGateBanner';
import {
  canExportMktAiPlanner,
  canGenerateMktAiPlanner,
  type StoredStaffUser,
} from '@/lib/auth';
import {
  fetchMktAiPlannerContext,
  postMktAiApply,
  postMktAiCampaignsJob,
  postMktAiContentJob,
  postMktAiExport,
  postMktAiJobRetry,
  postMktAiQualityJob,
  postMktAiStrategyJob,
  type MktAiBrief,
  type MktAiPlannerContext,
} from '@/lib/mkt-ai-planner-api';
import { ApiError } from '@/lib/api';
import { STRATEGY_LABELS, TMMT_PROF_LABELS } from '@/lib/tmmt-labels';

const STEPS = [
  { id: 'brief', label: 'Brief' },
  { id: 'strategy', label: 'Strategy' },
  { id: 'campaign', label: 'Campaign' },
  { id: 'content', label: 'Content' },
  { id: 'apply', label: 'Apply' },
] as const;

type StepId = (typeof STEPS)[number]['id'];

interface Props {
  token: string;
  user: StoredStaffUser;
  lifecycleId: number;
  stage: string;
  serviceSlug?: string;
  onOpenTmmtTab?: () => void;
  onApplied?: () => void;
}

function parseStep(raw: string | null): StepId {
  if (raw === 'brief' || raw === 'strategy' || raw === 'campaign' || raw === 'content' || raw === 'apply') {
    return raw;
  }
  const n = Number(raw);
  if (n >= 1 && n <= 5) return STEPS[n - 1].id;
  return 'brief';
}

export function MarketingAiPlannerPanel({
  token,
  user,
  lifecycleId,
  stage,
  serviceSlug,
  onOpenTmmtTab,
  onApplied,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [ctx, setCtx] = useState<MktAiPlannerContext | null>(null);
  const [briefDraft, setBriefDraft] = useState<MktAiBrief>({});
  const [step, setStep] = useState<StepId>(() => parseStep(searchParams.get('step')));
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [disabledReason, setDisabledReason] = useState('');
  const [contextVersion, setContextVersion] = useState(0);

  const canGenerate = canGenerateMktAiPlanner(user);
  const canExport = canExportMktAiPlanner(user);
  const readOnlyStage = !['onboard', 'deliver'].includes(stage);
  const canEdit = canGenerate && !readOnlyStage;

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchMktAiPlannerContext(token, lifecycleId);
      setCtx(data);
      setBriefDraft(data.brief ?? { service_slug: data.service_slug });
      setContextVersion((v) => v + 1);
      setDisabledReason('');
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setDisabledReason('AI Marketing Planner chưa bật trên môi trường này.');
        setCtx(null);
      } else if (err instanceof ApiError && err.status === 403) {
        setDisabledReason('Dịch vụ này chưa nằm trong pilot AI Planner.');
        setCtx(null);
      } else {
        setError(err instanceof Error ? err.message : 'Tải AI Planner thất bại');
      }
    } finally {
      setLoading(false);
    }
  }, [token, lifecycleId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    setStep(parseStep(searchParams.get('step')));
  }, [searchParams]);

  function goToStep(next: StepId) {
    setStep(next);
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', 'ai-planner');
    params.set('step', next);
    router.replace(`?${params.toString()}`, { scroll: false });
  }

  async function runJob(
    runner: () => Promise<unknown>,
    successMsg: string,
    nextStep?: StepId,
  ) {
    if (!canEdit) return;
    setBusy(true);
    setMessage('');
    setError('');
    try {
      await runner();
      await reload();
      setMessage(successMsg);
      if (nextStep) goToStep(nextStep);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Job AI thất bại');
      await reload();
    } finally {
      setBusy(false);
    }
  }

  async function onApply() {
    if (!canEdit || !ctx) return;
    if (!window.confirm('Ghi đè TMMT chính thức bằng bản draft AI?')) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const out = await postMktAiApply(token, lifecycleId, {
        confirm_overwrite: true,
        strategy_framework: ctx.draft.strategy_framework,
        target_market_prof: ctx.draft.target_market_prof,
      });
      await reload();
      setMessage(out.tmmt_validation.ok ? 'Đã apply vào TMMT chính thức' : 'Đã apply — gate TMMT chưa pass');
      onApplied?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Apply TMMT thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function onExport(format: 'pdf' | 'docx' | 'xlsx') {
    if (!canExport) return;
    setBusy(true);
    setError('');
    try {
      const out = await postMktAiExport(token, lifecycleId, format);
      const blob = new Blob([out.content], { type: out.mime_type || 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = out.filename;
      a.click();
      URL.revokeObjectURL(url);
      setMessage(`Đã tải ${out.filename}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export thất bại');
    } finally {
      setBusy(false);
    }
  }

  const briefValidation = ctx?.brief_validation;
  const quality = ctx?.quality_score;
  const hasStrategy =
    Object.values(ctx?.draft.strategy_framework ?? {}).some((v) => String(v).trim()) ||
    Object.values(ctx?.draft.target_market_prof ?? {}).some((v) => String(v).trim());
  const campaigns = ctx?.draft.campaigns_json ?? [];
  const calendar = (ctx?.draft.content_json?.calendar as Array<Record<string, string>>) ?? [];

  if (disabledReason) {
    return (
      <div className="card" style={{ padding: '1rem' }}>
        <p className="muted" style={{ margin: 0 }}>{disabledReason}</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {readOnlyStage ? (
        <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
          {['lead', 'consult', 'proposal'].includes(stage)
            ? 'Chưa onboard — chỉ xem. Wizard chỉnh sửa khi stage onboard hoặc deliver.'
            : `Stage ${stage} — chỉ xem. Chỉnh sửa khi onboard hoặc deliver.`}
        </p>
      ) : null}

      {ctx?.flags.stub_mode ? (
        <p
          className="muted"
          style={{
            margin: 0,
            fontSize: '0.85rem',
            padding: '0.5rem 0.75rem',
            borderRadius: 8,
            border: '1px solid var(--border)',
            background: 'rgba(255, 200, 0, 0.06)',
          }}
        >
          Chế độ stub — chưa cấu hình LLM API key. Output rule-based; kiểm tra lại trước khi apply TMMT.
        </p>
      ) : null}

      <AiTmmtGateBanner
        ok={Boolean(ctx?.tmmt_validation.ok)}
        filledCount={ctx?.tmmt_validation.filled_count}
        messages={ctx?.tmmt_validation.messages ?? []}
        onOpenTmmt={onOpenTmmtTab}
      />

      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
        {STEPS.map((s, idx) => {
          const active = step === s.id;
          const done =
            (s.id === 'brief' && briefValidation?.ok) ||
            (s.id === 'strategy' && hasStrategy) ||
            (s.id === 'campaign' && campaigns.length > 0) ||
            (s.id === 'content' && calendar.length > 0) ||
            (s.id === 'apply' && Boolean(ctx?.tmmt_validation.ok));
          return (
            <button
              key={s.id}
              type="button"
              className={active ? 'btn btn-sm' : 'btn btn-sm btn-ghost'}
              onClick={() => goToStep(s.id)}
            >
              {idx + 1}. {s.label}
              {done ? ' ✓' : ''}
            </button>
          );
        })}
      </div>

      {loading ? <p className="muted">Đang tải AI Planner…</p> : null}
      {error ? <p className="error">{error}</p> : null}
      {message ? <p style={{ color: 'var(--accent)' }}>{message}</p> : null}

      <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 480px', minWidth: 0 }}>
          {step === 'brief' ? (
            <BriefIntakeForm
              token={token}
              lifecycleId={lifecycleId}
              brief={briefDraft}
              onBriefChange={setBriefDraft}
              briefValidation={briefValidation}
              prefillSources={ctx?.prefill_sources}
              serviceSlug={serviceSlug ?? ctx?.service_slug}
              canEdit={canEdit}
              paused={busy}
              resetAutosaveKey={contextVersion}
              onPersisted={(out) => {
                setBriefDraft(out.brief);
                setCtx((prev) =>
                  prev
                    ? { ...prev, brief: out.brief, brief_validation: out.brief_validation }
                    : prev,
                );
                setMessage(
                  out.brief_validation.ok
                    ? 'Brief hợp lệ — có thể sinh chiến lược'
                    : 'Đã lưu brief',
                );
              }}
              onSaveError={(msg) => setError(msg)}
              onContinue={() => goToStep('strategy')}
            />
          ) : null}

          {step === 'strategy' ? (
            <div className="card" style={{ padding: '1rem', display: 'grid', gap: '0.75rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                {canEdit ? (
                  <>
                    <button
                      type="button"
                      className="btn btn-sm"
                      disabled={busy || !briefValidation?.ok}
                      onClick={() =>
                        void runJob(
                          () => postMktAiStrategyJob(token, lifecycleId),
                          'Đã sinh chiến lược',
                          'campaign',
                        )
                      }
                    >
                      Sinh chiến lược AI
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      disabled={busy}
                      onClick={() =>
                        void runJob(() => postMktAiJobRetry(token, lifecycleId, 'strategy'), 'Đã sinh lại chiến lược')
                      }
                    >
                      Sinh lại ↻
                    </button>
                  </>
                ) : null}
                {quality ? (
                  <span className="muted">
                    Chất lượng: <strong>{quality.score}/100</strong>
                  </span>
                ) : null}
              </div>
              {!hasStrategy ? (
                <p className="muted" style={{ margin: 0 }}>
                  Hoàn thiện Brief rồi bấm Sinh chiến lược AI
                </p>
              ) : (
                <>
                  <section>
                    <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.95rem' }}>Khung chiến lược</h4>
                    <div style={{ display: 'grid', gap: '0.5rem' }}>
                      {Object.entries(STRATEGY_LABELS).map(([key, label]) => {
                        const val = ctx?.draft.strategy_framework?.[key] ?? '';
                        if (!String(val).trim() && key !== 'target_market' && key !== 'market_message') return null;
                        return (
                          <div key={key} className="card" style={{ padding: '0.65rem 0.75rem' }}>
                            <div className="muted" style={{ fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                              {label}
                            </div>
                            <div style={{ fontSize: '0.85rem', whiteSpace: 'pre-wrap' }}>{val || '—'}</div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                  <section>
                    <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.95rem' }}>TMMT chi tiết (draft)</h4>
                    <div style={{ display: 'grid', gap: '0.5rem' }}>
                      {Object.entries(TMMT_PROF_LABELS).map(([key, label]) => {
                        const val = ctx?.draft.target_market_prof?.[key] ?? '';
                        if (!String(val).trim()) return null;
                        return (
                          <div key={key} className="card" style={{ padding: '0.65rem 0.75rem' }}>
                            <div className="muted" style={{ fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                              {label}
                            </div>
                            <div style={{ fontSize: '0.85rem', whiteSpace: 'pre-wrap' }}>{val}</div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                </>
              )}
              <button type="button" className="btn btn-sm btn-secondary" onClick={() => goToStep('campaign')}>
                Tiếp → Campaign
              </button>
            </div>
          ) : null}

          {step === 'campaign' ? (
            <div className="card" style={{ padding: '1rem', display: 'grid', gap: '0.75rem' }}>
              {canEdit ? (
                <button
                  type="button"
                  className="btn btn-sm"
                  disabled={busy || !hasStrategy}
                  onClick={() =>
                    void runJob(
                      () => postMktAiCampaignsJob(token, lifecycleId),
                      'Đã sinh campaign',
                      'content',
                    )
                  }
                >
                  Sinh campaign AI
                </button>
              ) : null}
              {campaigns.length === 0 ? (
                <p className="muted" style={{ margin: 0 }}>Chưa có campaign — sinh từ bước Strategy trước.</p>
              ) : (
                campaigns.map((c) => (
                  <div key={c.name} className="card" style={{ padding: '0.85rem', border: '1px solid var(--border)' }}>
                    <h4 style={{ margin: '0 0 0.35rem', fontSize: '0.95rem' }}>{c.name}</h4>
                    <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
                      {c.objective} · {c.budget_pct}% · {c.timeline_weeks ?? '—'}
                    </p>
                    <p style={{ margin: '0.35rem 0 0', fontSize: '0.85rem' }}>
                      Kênh: {(c.channel_mix ?? []).join(', ')}
                    </p>
                    {(c.kpis?.length ?? 0) > 0 ? (
                      <p style={{ margin: '0.35rem 0 0', fontSize: '0.85rem' }}>
                        KPI: {c.kpis!.join(' · ')}
                      </p>
                    ) : null}
                  </div>
                ))
              )}
              <button type="button" className="btn btn-sm btn-secondary" onClick={() => goToStep('content')}>
                Tiếp → Content
              </button>
            </div>
          ) : null}

          {step === 'content' ? (
            <div className="card" style={{ padding: '1rem', display: 'grid', gap: '0.75rem' }}>
              {canEdit ? (
                <button
                  type="button"
                  className="btn btn-sm"
                  disabled={busy || campaigns.length === 0}
                  onClick={() =>
                    void runJob(
                      () => postMktAiContentJob(token, lifecycleId),
                      'Đã sinh content',
                      'apply',
                    )
                  }
                >
                  Sinh content AI
                </button>
              ) : null}
              {calendar.length === 0 ? (
                <p className="muted" style={{ margin: 0 }}>Chưa có lịch content.</p>
              ) : (
                <div style={{ display: 'grid', gap: '0.5rem' }}>
                  {calendar.slice(0, 14).map((row) => (
                    <div
                      key={`${row.date}-${row.channel}`}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '100px 80px 1fr',
                        gap: '0.5rem',
                        fontSize: '0.85rem',
                        padding: '0.45rem 0',
                        borderBottom: '1px solid var(--border)',
                      }}
                    >
                      <span>{row.date}</span>
                      <span className="muted">{row.channel}</span>
                      <span>{row.copy}</span>
                    </div>
                  ))}
                </div>
              )}
              <button type="button" className="btn btn-sm btn-secondary" onClick={() => goToStep('apply')}>
                Tiếp → Apply
              </button>
            </div>
          ) : null}

          {step === 'apply' ? (
            <div className="card" style={{ padding: '1rem', display: 'grid', gap: '0.75rem' }}>
              {canEdit ? (
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  disabled={busy}
                  onClick={() => void runJob(() => postMktAiQualityJob(token, lifecycleId), 'Đã tính quality score')}
                >
                  Tính quality score
                </button>
              ) : null}
              {quality ? (
                <div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem' }}>
                    <span style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent)' }}>
                      {quality.score}
                    </span>
                    <span className="muted">/100</span>
                  </div>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                      gap: '0.35rem',
                      marginTop: '0.5rem',
                      fontSize: '0.85rem',
                    }}
                  >
                    {Object.entries(quality.criteria).map(([key, ok]) => (
                      <span key={key}>
                        {ok ? '✓' : '○'} {key.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {canEdit ? (
                  <button
                    type="button"
                    className="btn btn-sm"
                    disabled={busy || !quality?.can_apply}
                    onClick={() => void onApply()}
                  >
                    Apply vào TMMT chính thức
                  </button>
                ) : null}
                {canExport ? (
                  <>
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      disabled={busy || (quality?.score ?? 0) < 60}
                      onClick={() => void onExport('pdf')}
                    >
                      Export PDF
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      disabled={busy || (quality?.score ?? 0) < 60}
                      onClick={() => void onExport('docx')}
                    >
                      Export DOCX
                    </button>
                  </>
                ) : null}
              </div>
              {!quality?.can_apply && quality ? (
                <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
                  Cần quality ≥60 và đủ tiêu chí TMMT core trước khi apply.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        <AiJobProgressPanel
          jobs={ctx?.jobs ?? []}
          stubMode={ctx?.flags.stub_mode}
          retrying={busy}
          onRetry={
            canEdit
              ? (type) => void runJob(() => postMktAiJobRetry(token, lifecycleId, type), 'Đã thử lại job')
              : undefined
          }
        />
      </div>
    </div>
  );
}
