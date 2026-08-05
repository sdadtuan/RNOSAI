'use client';

import { useCallback, useEffect, useState } from 'react';
import { CrmFunnelStepper } from '@/components/crm/funnel-stepper';
import {
  advanceLeadPresales,
  fetchIntakeSessions,
  fetchLeadPresalesConsultGate,
  type LeadFunnelSnapshot,
} from '@/lib/api';
import type {
  ConsultGateState,
  FunnelPrimaryAction,
  IntakeStepSummary,
} from '@/lib/crm/funnel-stepper.types';
import { showPresalesForFlow } from '@/lib/crm/lead-flow-kind';

interface Props {
  token: string;
  leadId: number;
  funnel: LeadFunnelSnapshot | null;
  onFunnelChange?: (funnel: LeadFunnelSnapshot) => void;
  onMessage?: (msg: string) => void;
  onError?: (msg: string) => void;
}

function buildIntakeSummary(sessions: Awaited<ReturnType<typeof fetchIntakeSessions>>): IntakeStepSummary {
  const hasDraft = sessions.some((s) => s.status === 'draft');
  const latestCompleted = [...sessions]
    .filter((s) => s.status === 'completed')
    .sort((a, b) => b.id - a.id)[0];
  return {
    has_draft: hasDraft,
    latest_completed: latestCompleted
      ? {
          id: latestCompleted.id,
          decision: latestCompleted.decision ?? '',
          bant_total: Number(latestCompleted.bant_total ?? 0),
          completed_at: latestCompleted.updated_at ?? '',
        }
      : undefined,
  };
}

function scrollToPresalesPanel() {
  if (typeof window === 'undefined') return;
  const el = document.getElementById('funnel-presales');
  el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function LeadPresalesFunnelStepper({
  token,
  leadId,
  funnel,
  onFunnelChange,
  onMessage,
  onError,
}: Props) {
  const [consultGate, setConsultGate] = useState<ConsultGateState | null>(null);
  const [gateLoading, setGateLoading] = useState(false);
  const [intakeSummary, setIntakeSummary] = useState<IntakeStepSummary | null>(null);
  const [busy, setBusy] = useState(false);

  const refreshGateAndIntake = useCallback(async () => {
    if (leadId <= 0 || !funnel?.presales_on_lead_enabled) {
      setConsultGate(null);
      setIntakeSummary(null);
      return;
    }
    if (!showPresalesForFlow(funnel.lead_flow_kind ?? 'b2b_prospect')) {
      setConsultGate(null);
      setIntakeSummary(null);
      return;
    }

    setGateLoading(true);
    try {
      const [gateOut, sessions] = await Promise.all([
        fetchLeadPresalesConsultGate(token, leadId).catch(() => null),
        fetchIntakeSessions(token, { lead_id: leadId }).catch(() => []),
      ]);
      setConsultGate(gateOut?.gate ?? null);
      setIntakeSummary(buildIntakeSummary(sessions));
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Tải gate Intake thất bại');
      setConsultGate(null);
      setIntakeSummary(null);
    } finally {
      setGateLoading(false);
    }
  }, [token, leadId, funnel?.presales_on_lead_enabled, funnel?.lead_flow_kind, onError]);

  useEffect(() => {
    void refreshGateAndIntake();
  }, [refreshGateAndIntake, funnel]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.location.hash !== '#funnel-presales') return;
    scrollToPresalesPanel();
  }, [funnel?.presales?.presales.stage, funnel?.presales?.presales.id]);

  async function onPrimaryAction(action: FunnelPrimaryAction) {
    if (action.kind === 'ensure_presales') {
      scrollToPresalesPanel();
      onMessage?.('Chọn dịch vụ và bấm Bắt đầu pre-sales bên dưới');
      return;
    }

    if (action.kind === 'anchor') {
      scrollToPresalesPanel();
      return;
    }

    if (action.kind !== 'advance_presales') return;

    setBusy(true);
    try {
      let overrideReason: string | undefined;
      if (action.requiresOverride) {
        const reason = window.prompt('Director override — nhập lý do chuyển giai đoạn:');
        if (!reason?.trim()) {
          onError?.('Cần lý do override');
          return;
        }
        overrideReason = reason.trim();
      }

      const out = await advanceLeadPresales(token, leadId, {
        confirm: true,
        override_reason: overrideReason,
      });
      onFunnelChange?.(out.funnel);
      await refreshGateAndIntake();
      scrollToPresalesPanel();
      onMessage?.('Đã chuyển giai đoạn pre-sales');
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Chuyển giai đoạn thất bại');
    } finally {
      setBusy(false);
    }
  }

  if (!funnel?.presales_on_lead_enabled || !showPresalesForFlow(funnel.lead_flow_kind ?? 'b2b_prospect')) {
    return null;
  }

  return (
    <CrmFunnelStepper
      leadId={leadId}
      funnel={funnel}
      consultGate={consultGate}
      intakeSummary={intakeSummary}
      context="lead_detail"
      gateLoading={gateLoading}
      actionBusy={busy}
      className="crm-funnel-stepper--lead-detail"
      onRefreshGate={() => void refreshGateAndIntake()}
      onPrimaryAction={(action) => void onPrimaryAction(action)}
    />
  );
}
