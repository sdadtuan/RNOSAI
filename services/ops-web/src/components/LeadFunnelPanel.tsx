'use client';

import { PresalesTaskFormCard } from '@/components/PresalesTaskFormCard';
import { PresalesR5PlanForm } from '@/components/PresalesR5PlanForm';
import { PresalesSolutionHandoffBanner } from '@/components/PresalesSolutionHandoffBanner';
import { PresalesPolicyBanner } from '@/components/presales/PresalesPolicyBanner';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  completeLeadCareStage,
  ensureLeadPresales,
  fetchLeadFunnel,
  fetchLeadPresalesMarketingPlan,
  patchLeadPresalesMarketingPlan,
  patchLeadPresalesTask,
  postLeadPresalesMarketingPlanAiDraft,
  postLeadPresalesTaskAiAssist,
  releaseLeadReviewQueue,
  submitLeadCareReport,
  type LeadFunnelSnapshot,
} from '@/lib/api';
import { LeadB2OutcomeCard } from '@/components/crm/LeadB2OutcomeCard';
import { showPresalesForFlow } from '@/lib/crm/lead-flow-kind';
import type { B2OutcomePlan } from '@/lib/crm/lead-b2-outcome';
import { hasCap, canGenerateMktAiPlanner, canViewLmp, type StoredStaffUser } from '@/lib/auth';
import { leadMeetingPrepEnabled } from '@/lib/crm/lmp-flags';
import { fetchLeadMeetingPrep, prepStatusChipLabel } from '@/lib/lead-meeting-prep-api';
import { M1FirstCallCard } from '@/app/crm/leads/meeting-prep/M1FirstCallCard';
import { M2QualifyHandoffCard } from '@/app/crm/leads/meeting-prep/M2QualifyHandoffCard';
import type { LeadMeetingPrepStatus } from '@/app/crm/leads/meeting-prep/lead-meeting-prep.types';

interface Props {
  token: string;
  leadId: number;
  user: StoredStaffUser | null;
  serviceSlug?: string;
  serviceOptions?: Array<{ slug: string; name: string }>;
  syncFunnel?: LeadFunnelSnapshot | null;
  fetchOnMount?: boolean;
  onOpenConsultTab?: () => void;
  onOpenMeetingPrepTab?: () => void;
  onMessage?: (msg: string) => void;
  onError?: (msg: string) => void;
  onFunnelChange?: (funnel: LeadFunnelSnapshot) => void;
  onFunnelUpdated?: () => void;
  /** Hero SLA+SCI panel đã gộp — ẩn thẻ M1 trùng trong funnel */
  hideM1Card?: boolean;
}

const DEFAULT_PRESALES_SERVICES: Array<{ slug: string; name: string }> = [
  { slug: 'dich-vu-seo-tong-the', name: 'SEO tổng thể' },
  { slug: 'dich-vu-seo-local', name: 'SEO Local' },
  { slug: 'dich-vu-seo-audit', name: 'SEO Audit' },
  { slug: 'dich-vu-aeo', name: 'AEO' },
];

export function mergePresalesServiceOptions(
  catalog?: Array<{ slug: string; name: string }>,
): Array<{ slug: string; name: string }> {
  const bySlug = new Map<string, { slug: string; name: string }>();
  for (const item of DEFAULT_PRESALES_SERVICES) {
    bySlug.set(item.slug, item);
  }
  for (const item of catalog ?? []) {
    const slug = String(item.slug ?? '').trim();
    if (!slug) continue;
    bySlug.set(slug, { slug, name: String(item.name ?? slug).trim() || slug });
  }
  return [...bySlug.values()].sort((a, b) => a.name.localeCompare(b.name, 'vi'));
}

const DEFAULT_PRESALES_SLUG = 'dich-vu-seo-tong-the';

export function LeadFunnelPanel({
  token,
  leadId,
  user,
  serviceSlug,
  serviceOptions,
  syncFunnel,
  fetchOnMount = true,
  onOpenConsultTab,
  onOpenMeetingPrepTab,
  onMessage,
  onError,
  onFunnelChange,
  onFunnelUpdated,
  hideM1Card = false,
}: Props) {
  const [funnel, setFunnel] = useState<LeadFunnelSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [panelError, setPanelError] = useState('');
  const [panelMessage, setPanelMessage] = useState('');
  const [planName, setPlanName] = useState('');
  const [planNorthStar, setPlanNorthStar] = useState('');
  const [planObjectives, setPlanObjectives] = useState('');
  const [planStrategy, setPlanStrategy] = useState<Record<string, string>>({});
  const [planValidation, setPlanValidation] = useState<string[]>([]);
  const [taskDrafts, setTaskDrafts] = useState<Record<number, Record<string, string>>>({});
  const [aiBusyTaskId, setAiBusyTaskId] = useState<number | null>(null);
  const [aiPlanDraftBusy, setAiPlanDraftBusy] = useState(false);
  const [showAiDraftBadge, setShowAiDraftBadge] = useState(false);
  const [prepStatus, setPrepStatus] = useState<LeadMeetingPrepStatus | null>(null);
  const presalesServiceOptions = useMemo(
    () => mergePresalesServiceOptions(serviceOptions),
    [serviceOptions],
  );
  const [selectedServiceSlug, setSelectedServiceSlug] = useState(
    () => serviceSlug?.trim() || DEFAULT_PRESALES_SLUG,
  );

  useEffect(() => {
    if (serviceSlug?.trim()) {
      setSelectedServiceSlug(serviceSlug.trim());
    }
  }, [serviceSlug]);

  useEffect(() => {
    if (serviceSlug?.trim()) return;
    if (presalesServiceOptions.some((item) => item.slug === selectedServiceSlug)) return;
    setSelectedServiceSlug(presalesServiceOptions[0]?.slug ?? DEFAULT_PRESALES_SLUG);
  }, [presalesServiceOptions, selectedServiceSlug, serviceSlug]);

  const reload = useCallback(async () => {
    setLoading(true);
    setPanelError('');
    try {
      const snap = await fetchLeadFunnel(token, leadId);
      setFunnel(snap);
      onFunnelChange?.(snap);
      if (snap.presales) {
        if (
          snap.presales.presales.stage === 'consult' ||
          snap.presales.presales.stage === 'proposal'
        ) {
          try {
            const mp = await fetchLeadPresalesMarketingPlan(token, leadId);
            setPlanName(String(mp.plan.name ?? ''));
            setPlanNorthStar(String(mp.plan.north_star ?? ''));
            setPlanObjectives(String(mp.plan.objectives ?? ''));
            let sf: Record<string, string> = {};
            try {
              sf = JSON.parse(String(mp.plan.strategy_framework_json ?? '{}')) as Record<string, string>;
            } catch {
              sf = {};
            }
            setPlanStrategy(sf);
            setPlanValidation(mp.validation.messages ?? []);
            setShowAiDraftBadge(Boolean((mp as { ai_draft?: { is_ai_draft?: boolean } }).ai_draft?.is_ai_draft));
          } catch {
            setPlanValidation([]);
            setShowAiDraftBadge(false);
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Tải funnel thất bại';
      setPanelError(msg);
    } finally {
      setLoading(false);
    }
  }, [token, leadId, onError, onFunnelChange]);

  useEffect(() => {
    if (!fetchOnMount && syncFunnel) {
      setFunnel(syncFunnel);
      setLoading(false);
      return;
    }
    void reload();
  }, [fetchOnMount, reload, syncFunnel]);

  useEffect(() => {
    if (syncFunnel) {
      setFunnel(syncFunnel);
    }
  }, [syncFunnel]);

  useEffect(() => {
    if (!leadMeetingPrepEnabled() || !canViewLmp(user)) return;
    void fetchLeadMeetingPrep(token, leadId)
      .then((row) => setPrepStatus(row.status))
      .catch(() => setPrepStatus(null));
  }, [token, leadId, user]);

  const canEdit = Boolean(user && hasCap(user, 'crm_leads', 'edit'));
  const canAssign = Boolean(user && hasCap(user, 'crm_leads', 'assign'));
  const canAiDraft = Boolean(user && canGenerateMktAiPlanner(user));
  const prepChip = prepStatus ? prepStatusChipLabel(prepStatus) : null;

  async function run(action: () => Promise<void>, refreshContract = false) {
    setBusy(true);
    setPanelError('');
    try {
      await action();
      if (refreshContract) onFunnelUpdated?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Thao tác thất bại';
      setPanelError(msg);
    } finally {
      setBusy(false);
    }
  }

  async function submitB2Outcome(plan: B2OutcomePlan) {
    await run(async () => {
      if (plan.kind === 'complete_b2') {
        await submitLeadCareReport(token, leadId, plan.report);
        const out = await completeLeadCareStage(token, leadId, plan.completeNote);
        setFunnel(out.funnel);
        onFunnelChange?.(out.funnel);
        const spaDone = out.funnel.lead_flow_kind === 'spa_operational';
        setPanelMessage(spaDone ? 'Đã xong B2' : 'Đã xong B2 — pre-sales đã mở.');
        onMessage?.('Đã xong B2');
        await reload();
        return;
      }
      const out = await submitLeadCareReport(token, leadId, plan.report);
      setFunnel(out.funnel);
      onFunnelChange?.(out.funnel);
      const msg =
        plan.kind === 'wrong_number'
          ? 'Đã ghi số sai — chưa mở Pre-sales'
          : 'Đã ghi nhận không nghe — gọi lại';
      setPanelMessage(msg);
      onMessage?.(msg);
      await reload();
    }, plan.kind === 'complete_b2');
  }

  const intakeHref = `/crm/intake?lead_id=${leadId}${
    funnel?.presales?.presales.service_slug
      ? `&service_slug=${encodeURIComponent(funnel.presales.presales.service_slug)}`
      : selectedServiceSlug
        ? `&service_slug=${encodeURIComponent(selectedServiceSlug)}`
        : ''
  }`;

  const presalesStage = funnel?.presales?.presales.stage;
  const useConsultWorkspaceTab =
    presalesStage === 'consult' || presalesStage === 'proposal';

  async function applyMarketingPlanResponse(plan: Record<string, unknown>, validationMessages: string[]) {
    setPlanName(String(plan.name ?? ''));
    setPlanNorthStar(String(plan.north_star ?? ''));
    setPlanObjectives(String(plan.objectives ?? ''));
    let sf: Record<string, string> = {};
    try {
      sf = JSON.parse(String(plan.strategy_framework_json ?? '{}')) as Record<string, string>;
    } catch {
      sf = {};
    }
    setPlanStrategy(sf);
    setPlanValidation(validationMessages);
  }

  async function saveMarketingPlan() {
    const out = await patchLeadPresalesMarketingPlan(token, leadId, {
      name: planName,
      north_star: planNorthStar,
      objectives: planObjectives,
      strategy_framework: planStrategy,
    });
    setFunnel(out.funnel);
    onFunnelChange?.(out.funnel);
    setPlanValidation(out.validation.messages ?? []);
    setShowAiDraftBadge(false);
    onMessage?.('Đã lưu KH MKT sơ bộ');
  }

  async function runMarketingPlanAiDraft() {
    setAiPlanDraftBusy(true);
    try {
      const out = await postLeadPresalesMarketingPlanAiDraft(token, leadId);
      setFunnel(out.funnel);
      onFunnelChange?.(out.funnel);
      await applyMarketingPlanResponse(out.plan, out.validation.messages ?? []);
      setShowAiDraftBadge(Boolean(out.ai_draft?.is_ai_draft ?? out.requires_sp_review));
      onMessage?.(out.validation.ok ? 'Đã tạo AI draft KH MKT sơ bộ' : 'AI draft — cần bổ sung thêm trường');
    } finally {
      setAiPlanDraftBusy(false);
    }
  }

  function renderPresalesTasks() {
    if (!funnel?.presales) return null;
    return (funnel.presales?.tasks[funnel.presales.presales.stage] ?? []).map((task) => (
      <PresalesTaskFormCard
        key={task.id}
        stage={funnel.presales!.presales.stage}
        task={task}
        draft={taskDrafts[task.id] ?? {}}
        disabled={busy || !canEdit}
        showAiAssist={
          funnel.presales!.presales.stage === 'consult' && task.ai_prompt_key === 'consult_analysis'
        }
        aiBusy={aiBusyTaskId === task.id}
        onAiAssist={(taskId, formData) =>
          void run(async () => {
            setAiBusyTaskId(taskId);
            try {
              const out = await postLeadPresalesTaskAiAssist(token, leadId, taskId, {
                form_context: formData,
              });
              setFunnel(out.funnel);
              onFunnelChange?.(out.funnel);
              onMessage?.('AI phân tích xong');
            } finally {
              setAiBusyTaskId(null);
            }
          })
        }
        onDraftChange={(taskId, key, value) =>
          setTaskDrafts((prev) => ({
            ...prev,
            [taskId]: { ...(prev[taskId] ?? {}), [key]: value },
          }))
        }
        onValidationError={(msg) => setPanelError(msg)}
        onSaveForm={(taskId, formData) =>
          void run(async () => {
            const out = await patchLeadPresalesTask(token, leadId, taskId, { form_data: formData });
            setFunnel(out.funnel);
            onFunnelChange?.(out.funnel);
          })
        }
        onToggleDone={(taskId, nextDone, formData) =>
          void run(async () => {
            const out = await patchLeadPresalesTask(token, leadId, taskId, {
              is_done: nextDone,
              form_data: formData,
            });
            setFunnel(out.funnel);
            onFunnelChange?.(out.funnel);
            setTaskDrafts((prev) => {
              const next = { ...prev };
              delete next[taskId];
              return next;
            });
            onMessage?.(nextDone ? 'Đã hoàn thành task pre-sales' : 'Đã bỏ hoàn thành task');
          })
        }
      />
    ));
  }

  const r5Form = (
    <PresalesR5PlanForm
      planName={planName}
      planNorthStar={planNorthStar}
      planObjectives={planObjectives}
      planStrategy={planStrategy}
      planValidation={planValidation}
      disabled={busy || aiPlanDraftBusy}
      canEdit={canEdit}
      showAiDraftBadge={showAiDraftBadge}
      canAiDraft={canAiDraft}
      onPlanNameChange={setPlanName}
      onNorthStarChange={setPlanNorthStar}
      onObjectivesChange={setPlanObjectives}
      onStrategyChange={(key, value) => setPlanStrategy((prev) => ({ ...prev, [key]: value }))}
      onSave={() => void run(() => saveMarketingPlan(), true)}
      onAiDraft={() => void run(() => runMarketingPlanAiDraft(), true)}
      aiBusy={aiPlanDraftBusy}
    />
  );

  if (loading && !funnel) {
    return <p className="muted">Đang tải funnel B2 / pre-sales…</p>;
  }
  if (!funnel) return null;

  const flowKind = funnel.lead_flow_kind ?? 'b2b_prospect';
  const isOperationalFlow = flowKind === 'spa_operational';
  const showPresales = showPresalesForFlow(flowKind);
  const panelTitle = isOperationalFlow
    ? 'Funnel CSKH vận hành — B2 Liên hệ'
    : 'Funnel B2 → Pre-sales';

  const b2Stage = funnel.care_pipeline.stages[0];
  const b2Done = Boolean(b2Stage?.done);
  const showM1Card =
    showPresales && !b2Done && leadMeetingPrepEnabled() && canViewLmp(user);
  const showM2Card =
    showPresales &&
    b2Done &&
    Boolean(funnel.presales) &&
    (presalesStage === 'lead' || presalesStage === 'consult') &&
    leadMeetingPrepEnabled() &&
    canViewLmp(user);
  const inReview = funnel.review_queue.active;
  const negativeReportCount = funnel.care_pipeline.b2_negative_report_count ?? 0;

  return (
    <section className="card stack-gap lead-funnel-panel" id="lead-funnel-panel" style={{ marginTop: '1rem' }}>
      <div className="lead-funnel-panel__head">
        <h2 style={{ margin: 0, fontSize: '1.1rem' }}>{panelTitle}</h2>
        {prepChip && onOpenMeetingPrepTab ? (
          <button type="button" className="lmp-funnel-chip" onClick={() => onOpenMeetingPrepTab()}>
            {prepChip}
          </button>
        ) : null}
      </div>

      {panelError ? (
        <div className="lead-alert lead-alert--error" role="alert">
          {panelError}
        </div>
      ) : null}
      {panelMessage ? (
        <div className="lead-alert lead-alert--success" role="status">
          {panelMessage}
        </div>
      ) : null}

      {showM1Card && !hideM1Card ? (
        <M1FirstCallCard
          token={token}
          leadId={leadId}
          user={user}
          show={showM1Card}
          onOpenTalkTrack={onOpenMeetingPrepTab}
          onMessage={onMessage}
          onError={onError}
        />
      ) : null}

      {showM2Card ? (
        <M2QualifyHandoffCard
          token={token}
          leadId={leadId}
          user={user}
          show={showM2Card}
          intakeHref={intakeHref}
          onOpenMeetingPrep={onOpenMeetingPrepTab}
          onOpenConsultTab={onOpenConsultTab}
          onMessage={onMessage}
          onError={onError}
        />
      ) : null}

      {inReview && (
        <div className="banner banner-warn">
          <strong>Phải tra soát (GDKD)</strong>
          <p style={{ margin: '0.35rem 0 0' }}>
            {funnel.review_queue.message}
            {funnel.review_queue.hours_waiting != null
              ? ` · đã chờ ${funnel.review_queue.hours_waiting}h`
              : ''}
          </p>
          {canAssign ? (
            <p style={{ margin: '0.35rem 0 0', fontSize: '0.9rem' }}>
              <Link href="/crm/leads/review-queue" className="nav-link">
                Mở inbox Phải tra soát →
              </Link>
            </p>
          ) : null}
          {canAssign && (
            <button
              type="button"
              className="btn btn-sm"
              disabled={busy}
              style={{ marginTop: '0.5rem' }}
              onClick={() =>
                void run(async () => {
                  await releaseLeadReviewQueue(token, leadId, { mode: 'auto', note: 'Release từ ops-web' });
                  onMessage?.('Đã release lead khỏi review queue');
                  await reload();
                })
              }
            >
              Release (auto gán lại AM)
            </button>
          )}
        </div>
      )}

      <PresalesSolutionHandoffBanner funnel={funnel} user={user} />
      <PresalesPolicyBanner funnel={funnel} user={user} token={token} action="release" />
      <PresalesPolicyBanner funnel={funnel} user={user} token={token} action="claim" />

      <div className="card-inner" id="funnel-b2">
        <h3 style={{ marginTop: 0 }}>B2 — {b2Stage?.label ?? 'Liên hệ lần đầu'}</h3>
        {!funnel.care_pipeline.all_complete && canEdit && !inReview ? (
          <LeadB2OutcomeCard
            busy={busy}
            retryCount={negativeReportCount}
            lastNegativeLabel={funnel.care_pipeline.last_b2_care_status_label}
            onSubmit={(plan) => submitB2Outcome(plan)}
            onError={setPanelError}
          />
        ) : null}
        {funnel.care_pipeline.all_complete ? (
          <p className="lead-b2-outcome__done">B2 đã xong</p>
        ) : null}
      </div>

      {showPresales && funnel.presales_on_lead_enabled && funnel.presales_care_gate.complete && !inReview && (
        <div className="card-inner" id="funnel-presales">
          <h3 style={{ marginTop: 0 }}>Pre-sales</h3>
          {!funnel.presales && canEdit && (
            <div className="stack-gap" style={{ marginTop: '0.5rem' }}>
              <label style={{ display: 'grid', gap: '0.35rem' }}>
                <span className="muted">Dịch vụ marketing (HĐ)</span>
                <select
                  value={selectedServiceSlug}
                  disabled={busy}
                  onChange={(e) => setSelectedServiceSlug(e.target.value)}
                  style={{ width: '100%', maxWidth: '28rem' }}
                >
                  {presalesServiceOptions.map((item) => (
                    <option key={item.slug} value={item.slug}>
                      {item.name} ({item.slug})
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={busy || !selectedServiceSlug}
                onClick={() =>
                  void run(async () => {
                    const slug = selectedServiceSlug.trim() || DEFAULT_PRESALES_SLUG;
                    const out = await ensureLeadPresales(token, leadId, slug);
                    setFunnel(out.funnel);
                    onFunnelChange?.(out.funnel);
                    onMessage?.('Đã bắt đầu pre-sales');
                  }, true)
                }
              >
                Bắt đầu pre-sales
              </button>
            </div>
          )}
          {funnel.presales && (
            <>
              <p>
                Giai đoạn: <strong>{funnel.presales.presales.stage}</strong> · Dịch vụ:{' '}
                {funnel.presales.presales.service_slug || '—'}
              </p>
              {useConsultWorkspaceTab ? (
                <div className="banner banner-info stack-gap" style={{ marginTop: '0.5rem' }}>
                  <p style={{ margin: 0 }}>
                    Workspace <strong>Tư vấn / Báo giá</strong> nằm trên tab{' '}
                    <strong>Tư vấn</strong>. Chỉnh sửa R5 (gate G4) tại form bên dưới.
                  </p>
                  {onOpenConsultTab ? (
                    <button type="button" className="btn btn-sm btn-primary" onClick={onOpenConsultTab}>
                      Mở tab Tư vấn →
                    </button>
                  ) : null}
                  {(presalesStage === 'consult' || presalesStage === 'proposal') && r5Form}
                </div>
              ) : (
                <>
                  {renderPresalesTasks()}
                  {funnel.presales.presales.stage === 'lead' && (
                    <p style={{ margin: '0.5rem 0' }}>
                      <Link href={intakeHref} className="nav-link">
                        Mở Lead Intake (BANT) →
                      </Link>
                    </p>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
