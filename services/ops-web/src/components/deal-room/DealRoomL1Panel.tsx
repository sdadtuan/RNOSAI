'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { PresalesClientBriefCard } from '@/components/PresalesClientBriefCard';
import { PresalesConsultPlanScreen } from '@/components/PresalesConsultPlanScreen';
import { PresalesR5PlanForm } from '@/components/PresalesR5PlanForm';
import { PresalesR5PreviewPanel } from '@/components/PresalesR5PreviewPanel';
import {
  fetchLeadPresalesMarketingPlan,
  patchLeadPresalesMarketingPlan,
  postLeadPresalesMarketingPlanAiDraft,
  type DealRoomSnapshot,
  type LeadFunnelSnapshot,
} from '@/lib/api';
import { canGenerateMktAiPlanner, hasCap, type StoredStaffUser } from '@/lib/auth';
import { hydratePresalesR5Form } from '@/lib/crm/presales-r5-plan.util';
import { resolvePresalesSolutionCaps } from '@/lib/crm/presales-solution-caps';

interface Props {
  token: string;
  leadId: number;
  user: StoredStaffUser;
  snapshot: DealRoomSnapshot;
  onUpdated: (snapshot: DealRoomSnapshot) => void;
  onMessage?: (msg: string) => void;
  onError?: (msg: string) => void;
}

export function DealRoomL1Panel({
  token,
  leadId,
  user,
  snapshot,
  onUpdated,
  onMessage,
  onError,
}: Props) {
  const [editMode, setEditMode] = useState(false);
  const [planName, setPlanName] = useState(snapshot.marketing_plan.name);
  const [planNorthStar, setPlanNorthStar] = useState(snapshot.marketing_plan.north_star);
  const [planObjectives, setPlanObjectives] = useState(snapshot.marketing_plan.objectives);
  const [planStrategy, setPlanStrategy] = useState(snapshot.marketing_plan.strategy_framework);
  const [planValidation, setPlanValidation] = useState(snapshot.marketing_plan.validation_messages);
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [showAiDraftBadge, setShowAiDraftBadge] = useState(false);
  const [aiModel, setAiModel] = useState<string | null>(null);
  const flushBriefRef = useRef<(() => Promise<void>) | null>(null);
  const bindBriefFlush = useCallback((flush: (() => Promise<void>) | null) => {
    flushBriefRef.current = flush;
  }, []);

  useEffect(() => {
    setPlanName(snapshot.marketing_plan.name);
    setPlanNorthStar(snapshot.marketing_plan.north_star);
    setPlanObjectives(snapshot.marketing_plan.objectives);
    setPlanStrategy(snapshot.marketing_plan.strategy_framework);
    setPlanValidation(snapshot.marketing_plan.validation_messages);
  }, [snapshot]);

  useEffect(() => {
    let cancelled = false;
    void fetchLeadPresalesMarketingPlan(token, leadId)
      .then((mp) => {
        if (cancelled) return;
        setShowAiDraftBadge(Boolean(mp.ai_draft?.is_ai_draft));
        setAiModel(mp.ai_draft?.model_name ?? null);
      })
      .catch(() => {
        if (!cancelled) {
          setShowAiDraftBadge(false);
          setAiModel(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [leadId, snapshot, token]);

  const solutionCaps = resolvePresalesSolutionCaps(user);
  const stage = snapshot.presales.presales.stage === 'proposal' ? 'proposal' : 'consult';
  const canEdit = Boolean(
    user &&
      hasCap(user, 'crm_leads', 'edit') &&
      solutionCaps.canEditConsult &&
      snapshot.presales.presales.stage !== 'lead',
  );
  const canAiDraft = Boolean(user && canGenerateMktAiPlanner(user));

  const reloadSnapshot = useCallback(async () => {
    const { fetchLeadDealRoom } = await import('@/lib/api');
    const next = await fetchLeadDealRoom(token, leadId);
    onUpdated(next);
  }, [leadId, onUpdated, token]);

  async function onAiDraft() {
    if (!canEdit || !canAiDraft) return;
    setAiBusy(true);
    onError?.('');
    try {
      const out = await postLeadPresalesMarketingPlanAiDraft(token, leadId);
      const hydrated = hydratePresalesR5Form(out.plan);
      setPlanName(hydrated.planName);
      setPlanNorthStar(hydrated.planNorthStar);
      setPlanObjectives(hydrated.planObjectives);
      setPlanStrategy(hydrated.planStrategy);
      setPlanValidation(out.validation?.messages ?? []);
      setShowAiDraftBadge(Boolean(out.ai_draft?.is_ai_draft ?? out.requires_sp_review));
      setAiModel(out.ai?.model ?? out.ai_draft?.model_name ?? null);
      onMessage?.(out.validation.ok ? 'Đã tạo AI draft KH MKT sơ bộ' : 'AI draft — cần bổ sung thêm trường');
      await reloadSnapshot();
    } finally {
      setAiBusy(false);
    }
  }

  async function onSavePlan() {
    if (!canEdit) return;
    setBusy(true);
    onError?.('');
    try {
      await flushBriefRef.current?.();
      const out = await patchLeadPresalesMarketingPlan(token, leadId, {
        name: planName,
        north_star: planNorthStar,
        objectives: planObjectives,
        strategy_framework: planStrategy,
      });
      setPlanValidation(out.validation?.messages ?? []);
      onMessage?.('Đã lưu KH MKT sơ bộ (R5)');
      setEditMode(false);
      await reloadSnapshot();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Lưu R5 thất bại');
    } finally {
      setBusy(false);
    }
  }

  if (snapshot.presales.presales.stage === 'consult') {
    return (
      <section className="deal-room-panel deal-room-panel--l1" aria-label="L1 marketing plan">
        <div className="deal-room-panel__head">
          <h3 className="deal-room-panel__title">KH Marketing sơ bộ (L1 / R5)</h3>
        </div>
        <PresalesConsultPlanScreen
          token={token}
          leadId={leadId}
          funnel={{ presales: snapshot.presales } as LeadFunnelSnapshot}
          canEdit={canEdit}
          canAiDraft={canAiDraft}
          onMessage={onMessage}
          onError={onError}
          onFunnelChange={() => {
            void reloadSnapshot();
          }}
        />
      </section>
    );
  }

  return (
    <section className="deal-room-panel deal-room-panel--l1" aria-label="L1 marketing plan">
      <div className="deal-room-panel__head">
        <h3 className="deal-room-panel__title">KH Marketing sơ bộ (L1 / R5)</h3>
        {canEdit && !editMode ? (
          <button type="button" className="btn btn-sm btn-secondary" onClick={() => setEditMode(true)}>
            Chỉnh sửa R5
          </button>
        ) : null}
        {editMode ? (
          <button type="button" className="btn btn-sm btn-link" onClick={() => setEditMode(false)}>
            Xem preview
          </button>
        ) : null}
      </div>

      {snapshot.presales.presales.stage === 'consult' ||
      snapshot.presales.presales.stage === 'proposal' ? (
        <PresalesClientBriefCard
          token={token}
          leadId={leadId}
          disabled={busy || aiBusy}
          canEdit={canEdit}
          canAiDraft={canAiDraft}
          aiBusy={aiBusy}
          onFlushReady={bindBriefFlush}
          onError={(msg) => onError?.(msg)}
          onAiDraft={onAiDraft}
        />
      ) : null}

      {editMode && canEdit ? (
        <PresalesR5PlanForm
          planName={planName}
          planNorthStar={planNorthStar}
          planObjectives={planObjectives}
          planStrategy={planStrategy}
          planValidation={planValidation}
          disabled={busy || aiBusy}
          canEdit={canEdit}
          showAiDraftBadge={showAiDraftBadge}
          aiModel={aiModel}
          onPlanNameChange={setPlanName}
          onNorthStarChange={setPlanNorthStar}
          onObjectivesChange={setPlanObjectives}
          onStrategyChange={(key, value) => setPlanStrategy((prev) => ({ ...prev, [key]: value }))}
          onSave={() => void onSavePlan()}
          aiBusy={aiBusy}
        />
      ) : (
        <PresalesR5PreviewPanel
          planName={planName}
          planNorthStar={planNorthStar}
          planObjectives={planObjectives}
          planStrategy={planStrategy}
          planValidation={planValidation}
          stage={stage === 'proposal' ? 'proposal' : 'consult'}
          onEditR5={canEdit ? () => setEditMode(true) : undefined}
          token={token}
          leadId={leadId}
          onNotice={(msg) => {
            if (msg.includes('LibreOffice')) onMessage?.(msg);
            else onError?.(msg);
          }}
        />
      )}
    </section>
  );
}
