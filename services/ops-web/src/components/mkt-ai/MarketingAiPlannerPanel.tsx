'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AiBrandKbPanel } from '@/components/mkt-ai/AiBrandKbPanel';
import { AiBudgetSimulator } from '@/components/mkt-ai/AiBudgetSimulator';
import { AiApplyStepPanel } from '@/components/mkt-ai/AiApplyStepPanel';
import { AiCampaignBuilder } from '@/components/mkt-ai/AiCampaignBuilder';
import { AiContentCalendar } from '@/components/mkt-ai/AiContentCalendar';
import { AiStrategySections } from '@/components/mkt-ai/AiStrategySections';
import { BriefIntakeForm } from '@/components/mkt-ai/BriefIntakeForm';
import { AiJobProgressPanel } from '@/components/mkt-ai/AiJobProgressPanel';
import { AiTmmtGateBanner } from '@/components/mkt-ai/AiTmmtGateBanner';
import styles from '@/components/mkt-ai/mkt-ai-planner.module.css';
import {
  canApproveMktAiPlanner,
  canExportMktAiPlanner,
  canGenerateMktAiPlanner,
  type StoredStaffUser,
} from '@/lib/auth';
import {
  fetchMktAiPlannerContext,
  postMktAiCampaignsJob,
  postMktAiContentJob,
  postMktAiJobRetry,
  postMktAiStrategyJob,
  type MktAiBrief,
  type MktAiBudgetScenarioRow,
  type MktAiCitation,
  type MktAiDraft,
  type MktAiPlannerContext,
} from '@/lib/mkt-ai-planner-api';
import { ApiError } from '@/lib/api';
import { hasStrategyContent } from '@/lib/mkt-ai-draft-fields';

const STEPS = [
  { id: 'brief', label: 'Brief' },
  { id: 'strategy', label: 'Strategy' },
  { id: 'campaign', label: 'Campaign' },
  { id: 'content', label: 'Content' },
  { id: 'apply', label: 'Apply' },
] as const;

type StepId = (typeof STEPS)[number]['id'];
type BriefSubId = 'brief' | 'kb';
type CampaignSubId = 'campaign' | 'budget';

interface Props {
  token: string;
  user: StoredStaffUser;
  lifecycleId: number;
  stage: string;
  serviceSlug?: string;
  clientId?: string;
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

function parseBriefSub(raw: string | null): BriefSubId {
  return raw === 'kb' ? 'kb' : 'brief';
}

function parseCampaignSub(raw: string | null, step: StepId): CampaignSubId {
  if (step !== 'campaign') return 'campaign';
  return raw === 'budget' ? 'budget' : 'campaign';
}

export function MarketingAiPlannerPanel({
  token,
  user,
  lifecycleId,
  stage,
  serviceSlug,
  clientId,
  onOpenTmmtTab,
  onApplied,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [ctx, setCtx] = useState<MktAiPlannerContext | null>(null);
  const [briefDraft, setBriefDraft] = useState<MktAiBrief>({});
  const [step, setStep] = useState<StepId>(() => parseStep(searchParams.get('step')));
  const [briefSub, setBriefSub] = useState<BriefSubId>(() => parseBriefSub(searchParams.get('sub')));
  const [campaignSub, setCampaignSub] = useState<CampaignSubId>(() =>
    parseCampaignSub(searchParams.get('sub'), parseStep(searchParams.get('step'))),
  );
  const [documents, setDocuments] = useState<MktAiPlannerContext['documents']>([]);
  const [budgetScenarios, setBudgetScenarios] = useState<MktAiBudgetScenarioRow[]>([]);
  const [useRag, setUseRag] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [disabledReason, setDisabledReason] = useState('');
  const [contextVersion, setContextVersion] = useState(0);

  const canGenerate = canGenerateMktAiPlanner(user);
  const canExport = canExportMktAiPlanner(user);
  const canApprove = canApproveMktAiPlanner(user);
  const readOnlyStage = !['onboard', 'deliver'].includes(stage);
  const canEdit = canGenerate && !readOnlyStage;

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchMktAiPlannerContext(token, lifecycleId);
      setCtx(data);
      setBriefDraft(data.brief ?? { service_slug: data.service_slug });
      setDocuments(data.documents ?? []);
      setBudgetScenarios(data.budget_scenarios ?? []);
      setUseRag(data.rag?.use_rag ?? data.brief?.use_rag !== false);
      setContextVersion((v) => v + 1);
      setDisabledReason('');
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setDisabledReason('Module AI Planner chưa bật cho môi trường này.');
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

  const pollContext = useCallback(async () => {
    try {
      const data = await fetchMktAiPlannerContext(token, lifecycleId);
      setCtx(data);
      setBriefDraft(data.brief ?? { service_slug: data.service_slug });
      setDocuments(data.documents ?? []);
      setBudgetScenarios(data.budget_scenarios ?? []);
      setUseRag(data.rag?.use_rag ?? data.brief?.use_rag !== false);
    } catch {
      /* silent poll — avoid VQ-09 flash */
    }
  }, [token, lifecycleId]);

  const hasActiveJobs = useMemo(
    () =>
      (ctx?.jobs ?? []).some((j) => j.status === 'pending' || j.status === 'running'),
    [ctx?.jobs],
  );

  useEffect(() => {
    if (!hasActiveJobs) return;
    const id = window.setInterval(() => {
      void pollContext();
    }, 2000);
    return () => window.clearInterval(id);
  }, [hasActiveJobs, pollContext]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    const nextStep = parseStep(searchParams.get('step'));
    setStep(nextStep);
    setBriefSub(parseBriefSub(searchParams.get('sub')));
    setCampaignSub(parseCampaignSub(searchParams.get('sub'), nextStep));
  }, [searchParams]);

  function goToStep(next: StepId) {
    setStep(next);
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', 'ai-planner');
    params.set('step', next);
    if (next !== 'brief' && next !== 'campaign') params.delete('sub');
    router.replace(`?${params.toString()}`, { scroll: false });
  }

  function goToBriefSub(next: BriefSubId) {
    setBriefSub(next);
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', 'ai-planner');
    params.set('step', 'brief');
    if (next === 'kb') params.set('sub', 'kb');
    else params.delete('sub');
    router.replace(`?${params.toString()}`, { scroll: false });
  }

  function goToCampaignSub(next: CampaignSubId) {
    setCampaignSub(next);
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', 'ai-planner');
    params.set('step', 'campaign');
    if (next === 'budget') params.set('sub', 'budget');
    else params.delete('sub');
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

  const briefValidation = ctx?.brief_validation;
  const quality = ctx?.quality_score;
  const draft = ctx?.draft;
  const hasStrategy = hasStrategyContent(draft?.strategy_framework, draft?.target_market_prof);
  const campaigns = draft?.campaigns_json ?? [];
  const calendar = (draft?.content_json?.calendar as Array<Record<string, string>>) ?? [];
  const ragCitations =
    (draft?.quality_score_json?.rag_citations as Record<string, MktAiCitation[]> | undefined) ??
    {};

  function handleDraftPersisted(persisted: MktAiDraft) {
    setCtx((prev) => (prev ? { ...prev, draft: persisted } : prev));
  }

  if (disabledReason) {
    return (
      <div className="card" style={{ padding: '1rem' }}>
        <p className="muted" style={{ margin: 0 }}>{disabledReason}</p>
      </div>
    );
  }

  return (
    <div className={styles.plannerRoot}>
      <p className={styles.mobileWarn}>
        Vui lòng dùng desktop (≥768px) để sinh và apply kế hoạch AI — mobile chỉ xem/review.
      </p>

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

      {loading && !ctx ? (
        <div className={styles.skeleton} aria-busy="true" aria-label="Đang tải AI Planner">
          <div className={styles.skeletonBar} style={{ width: '72%' }} />
          <div className={styles.skeletonBar} style={{ width: '55%' }} />
          <div className={styles.skeletonBar} style={{ width: '88%' }} />
        </div>
      ) : null}
      {error ? <p className="error">{error}</p> : null}
      {message ? <p style={{ color: 'var(--accent)' }}>{message}</p> : null}

      {!loading || ctx ? (
      <div className={styles.layout}>
        <div className={styles.mainCol}>
          {step === 'brief' ? (
            <>
              <div className={styles.kbSubTabs}>
                <button
                  type="button"
                  className={briefSub === 'brief' ? 'btn btn-sm' : 'btn btn-sm btn-ghost'}
                  onClick={() => goToBriefSub('brief')}
                >
                  Brief
                </button>
                <button
                  type="button"
                  className={briefSub === 'kb' ? 'btn btn-sm' : 'btn btn-sm btn-ghost'}
                  onClick={() => goToBriefSub('kb')}
                >
                  Brand KB
                  {(documents ?? []).some((d) => d.status === 'indexed') ? ' ✓' : ''}
                </button>
              </div>
              {briefSub === 'kb' ? (
                <AiBrandKbPanel
                  token={token}
                  lifecycleId={lifecycleId}
                  canEdit={canEdit}
                  ragEnabled={Boolean(ctx?.flags.rag_enabled)}
                  useRag={useRag}
                  documents={documents ?? []}
                  onDocumentsChange={setDocuments}
                  onUseRagChange={(next) => {
                    setUseRag(next);
                    setBriefDraft((prev) => ({ ...prev, use_rag: next }));
                    setCtx((prev) =>
                      prev
                        ? {
                            ...prev,
                            brief: { ...(prev.brief ?? {}), use_rag: next },
                            rag: { ...(prev.rag ?? { indexed_count: 0 }), use_rag: next },
                          }
                        : prev,
                    );
                  }}
                  onError={setError}
                  onMessage={setMessage}
                />
              ) : (
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
              )}
            </>
          ) : null}

          {step === 'strategy' && draft ? (
            <AiStrategySections
              token={token}
              lifecycleId={lifecycleId}
              strategyFramework={draft.strategy_framework ?? {}}
              targetMarketProf={draft.target_market_prof ?? {}}
              swotJson={draft.swot_json ?? {}}
              ragCitations={ragCitations}
              canEdit={canEdit}
              paused={busy}
              resetAutosaveKey={contextVersion}
              briefReady={Boolean(briefValidation?.ok)}
              qualityScore={quality?.score}
              onGenerate={() =>
                void runJob(
                  () => postMktAiStrategyJob(token, lifecycleId),
                  'Đã sinh chiến lược',
                  'campaign',
                )
              }
              onRetry={() =>
                void runJob(() => postMktAiJobRetry(token, lifecycleId, 'strategy'), 'Đã sinh lại chiến lược')
              }
              onDraftPersisted={handleDraftPersisted}
              onSaveError={(msg) => setError(msg)}
              onContinue={() => goToStep('campaign')}
            />
          ) : null}

          {step === 'campaign' && draft ? (
            <>
              <div className={styles.kbSubTabs}>
                <button
                  type="button"
                  className={campaignSub === 'campaign' ? 'btn btn-sm' : 'btn btn-sm btn-ghost'}
                  onClick={() => goToCampaignSub('campaign')}
                >
                  Campaign
                  {campaigns.length > 0 ? ' ✓' : ''}
                </button>
                <button
                  type="button"
                  className={campaignSub === 'budget' ? 'btn btn-sm' : 'btn btn-sm btn-ghost'}
                  onClick={() => goToCampaignSub('budget')}
                >
                  Budget sim
                  {budgetScenarios.some((s) => s.is_selected) ? ' ✓' : ''}
                </button>
              </div>
              {campaignSub === 'budget' ? (
                <AiBudgetSimulator
                  token={token}
                  lifecycleId={lifecycleId}
                  canEdit={canEdit}
                  paused={busy}
                  budgetMonthlyVnd={briefDraft.budget_monthly_vnd ?? ctx?.brief?.budget_monthly_vnd}
                  objective={briefDraft.objective ?? ctx?.brief?.objective ?? 'lead'}
                  scenarios={budgetScenarios}
                  hasCampaigns={campaigns.length > 0}
                  clientId={clientId}
                  onScenariosChange={setBudgetScenarios}
                  onRefresh={reload}
                  onError={setError}
                  onMessage={setMessage}
                />
              ) : (
                <AiCampaignBuilder
                  token={token}
                  lifecycleId={lifecycleId}
                  campaigns={campaigns}
                  canEdit={canEdit}
                  paused={busy}
                  resetAutosaveKey={contextVersion}
                  hasStrategy={hasStrategy}
                  defaultObjective={briefDraft.objective ?? 'lead'}
                  onGenerate={() =>
                    void runJob(
                      () => postMktAiCampaignsJob(token, lifecycleId),
                      'Đã sinh campaign',
                      'content',
                    )
                  }
                  onDraftPersisted={handleDraftPersisted}
                  onSaveError={(msg) => setError(msg)}
                  onContinue={() => goToStep('content')}
                />
              )}
            </>
          ) : null}

          {step === 'content' && draft ? (
            <AiContentCalendar
              token={token}
              lifecycleId={lifecycleId}
              contentJson={draft.content_json ?? {}}
              canEdit={canEdit}
              paused={busy}
              resetAutosaveKey={contextVersion}
              hasCampaigns={campaigns.length > 0}
              onGenerate={() =>
                void runJob(
                  () => postMktAiContentJob(token, lifecycleId),
                  'Đã sinh content',
                  'apply',
                )
              }
              onDraftPersisted={handleDraftPersisted}
              onSaveError={(msg) => setError(msg)}
              onContinue={() => goToStep('apply')}
            />
          ) : null}

          {step === 'apply' && draft ? (
            <AiApplyStepPanel
              token={token}
              lifecycleId={lifecycleId}
              draft={draft}
              quality={quality}
              canEdit={canEdit}
              canExport={canExport}
              canApprove={canApprove}
              approval={ctx?.approval}
              comments={ctx?.comments}
              approvalRequired={ctx?.flags.approval_required}
              paused={busy}
              onOpenTmmtTab={onOpenTmmtTab}
              onApplied={onApplied}
              onQualityUpdated={reload}
              onMessage={setMessage}
              onError={setError}
            />
          ) : null}
        </div>

        <div className={`${styles.jobCol} ${styles.jobColSticky}`}>
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
      ) : null}
    </div>
  );
}
