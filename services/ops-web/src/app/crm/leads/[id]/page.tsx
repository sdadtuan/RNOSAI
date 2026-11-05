'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { StaffPageShell } from '@/components/layout';
import { LeadFunnelPanel } from '@/components/LeadFunnelPanel';
import { LeadSalesPipelineTab } from '@/components/crm/LeadSalesPipelineTab';
import { LeadContractTab } from '@/components/crm/LeadContractTab';
import { isLeadPipelineTabEnabled } from '@/lib/crm/lead-pipeline-flags';
import {
  defaultLeadWorkspaceTab,
  mapLegacyHashToPipeline,
  shouldShowPipelineTab,
  type LeadWorkspaceDesktopTab,
} from '@/lib/crm/lead-pipeline-tab.util';
import type {
  ConsultGateState,
  FunnelPrimaryAction,
  IntakeStepSummary,
  PresalesFunnelStepKey,
} from '@/lib/crm/funnel-stepper.types';
import { summarizeLeadIntake } from '@/lib/crm/funnel-stepper.util';
import { LeadConsultWorkspace } from '@/components/LeadConsultWorkspace';
import { SolutionCaseDesk } from '@/components/crm/SolutionCaseDesk';
import { QuoteCasePanel } from '@/components/crm/QuoteCasePanel';
import { isBaoGiaKanbanColumn, normalizeLeadStatus } from '@/lib/crm/lead-status';
import { type LeadContractFlowSummary } from '@/lib/crm/lead-contract-flow';
import { LeadAttributionChips } from '@/components/crm/LeadAttributionChips';
import { isAccountExecutive, isMarketingLeader } from '@/lib/crm/lead-ae-visibility';
import { LeadContactActions } from '@/components/crm/LeadContactActions';
import { LeadJourneyStepper } from '@/components/crm/LeadJourneyStepper';
import { LeadNextActionCard } from '@/components/crm/LeadNextActionCard';
import { SalesCockpitDrawer } from '@/components/crm/SalesCockpitDrawer';
import { LeadMobileCallBar } from '@/components/crm/LeadMobileCallBar';
import { LeadContractPanel } from '@/components/LeadContractPanel';
import { LeadDetailHero } from '@/components/crm/LeadDetailHero';
import { PresalesSolutionHandoffBanner } from '@/components/PresalesSolutionHandoffBanner';
import { LeadPartyCard, emptyLeadParty, type LeadPartyFormValue } from '@/components/crm/LeadPartyCard';
import { LeadStageRecords } from '@/components/crm/LeadStageRecords';
import { LeadPropertyRail } from '@/components/crm/LeadPropertyRail';
import { getQtQuotes } from '@/lib/crm/qt-api';
import { LeadSlaCarePanel } from '@/components/crm/LeadSlaCarePanel';
import { LeadFrSlaPanel } from '@/components/crm/LeadFrSlaPanel';
import { ClosedLoopPanel } from '@/components/crm/ClosedLoopPanel';
import { LeadCopilotPanel } from '@/components/ai/LeadCopilotPanel';
import { LeadHistoryTab } from '@/components/crm/LeadHistoryTab';
import { mergeLeadCareHistory } from '@/lib/crm/lead-history';
import {
  leadFlowKindLabel,
  resolveLeadFlowKindFromLead,
  showB2bSalesFlowBar,
} from '@/lib/crm/lead-flow-kind';
import {
  deriveS0IntakeGo,
  resolveLeadStageVisibility,
} from '@/lib/crm/lead-stage-visibility';
import {
  canViewCrmLeadDetail,
  resolvePresalesSolutionCaps,
} from '@/lib/crm/presales-solution-caps';
import {
  LEAD_CONSULT_TAB_HASH,
  showLeadConsultTab,
} from '@/lib/crm/lead-consult-tab.util';
import { aiCopilotEnabled } from '@/lib/ai-flags';
import { dealRoomEnabled } from '@/lib/crm/deal-room-flags';
import { resolveLeadNextAction, type NextActionKind } from '@/lib/crm/lead-next-action';
import { contractCreateReady, contractSubmitReady } from '@/lib/crm/lead-contract-ready';
import {
  funnelB2Complete,
  funnelPresalesStage,
  normalizeAgencyClientId,
} from '@/lib/crm/funnel-snapshot.util';
import { leadMeetingPrepEnabled } from '@/lib/crm/lmp-flags';
import {
  applyLeadMeetingPrepOfferLadder,
  fetchLeadMeetingPrep,
  runLeadMeetingPrep,
  selectLeadMeetingPrepEntity,
} from '@/lib/lead-meeting-prep-api';
import { buildM1Script } from '@/app/crm/leads/meeting-prep/m1-script.util';
import { buildM2HandoffBrief } from '@/app/crm/leads/meeting-prep/m2-handoff.util';
import type { LeadMeetingPrepResponse } from '@/app/crm/leads/meeting-prep/lead-meeting-prep.types';
import { LeadMeetingPrepPanel } from '@/app/crm/leads/meeting-prep/LeadMeetingPrepPanel';
import { PostCallDebriefModal } from '@/app/crm/leads/meeting-prep/PostCallDebriefModal';
import { ShortCallDebriefModal } from '@/app/crm/leads/meeting-prep/ShortCallDebriefModal';
import {
  assignLead,
  fetchCatalogBundle,
  fetchCrmStaffList,
  fetchLead,
  fetchLeadContractReadiness,
  fetchIntakeSessions,
  fetchLeadFunnel,
  fetchLeadPresalesConsultGate,
  fetchLeadActivities,
  fetchLeadAttribution,
  fetchLeadAudit,
  fetchLeadCopilotContext,
  fetchLeadStatusOptions,
  handoffLeadToSolution,
  advanceLeadPresales,
  claimLeadSolution,
  ensureLeadPresales,
  releaseLeadToSales,
  patchLead,
  staffMe,
  staffRefresh,
  type CatalogServiceRow,
  type CrmStaffRow,
  type LeadActivityRow,
  type LeadAttributionData,
  type LeadAuditBundle,
  type LeadCopilotContext,
  type IntakeSessionRow,
  type LeadFunnelSnapshot,
  type LeadRow,
  type LeadStatusOptionsResponse,
} from '@/lib/api';
import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  getStoredUser,
  hasCap,
  canViewLmp,
  updateAccessToken,
  updateStoredUser,
  type StoredStaffUser,
} from '@/lib/auth';

type LeadDetailTab = 'detail' | 'history' | 'ai';
type B2bOverviewTab = 'overview' | 'consult';

async function copyLeadContact(value: string, label: string, onDone: (msg: string) => void) {
  const trimmed = value.trim();
  if (!trimmed) return;
  try {
    await navigator.clipboard.writeText(trimmed);
    onDone(`Đã copy ${label} vào clipboard.`);
  } catch {
    onDone(`Không copy được ${label}.`);
  }
}

function useLeadDetailLayout() {
  const [layout, setLayout] = useState({ desktop: false, tablet: false, mobile: true });

  useEffect(() => {
    const mqDesktop = window.matchMedia('(min-width: 1280px)');
    const mqTablet = window.matchMedia('(min-width: 1024px)');

    const sync = () => {
      const w = window.innerWidth;
      setLayout({
        desktop: w >= 1280,
        tablet: w >= 1024 && w < 1280,
        mobile: w < 1024,
      });
    };

    sync();
    mqDesktop.addEventListener('change', sync);
    mqTablet.addEventListener('change', sync);
    window.addEventListener('resize', sync);
    return () => {
      mqDesktop.removeEventListener('change', sync);
      mqTablet.removeEventListener('change', sync);
      window.removeEventListener('resize', sync);
    };
  }, []);

  return layout;
}

function useNetworkOnline() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const sync = () => setOnline(typeof navigator !== 'undefined' ? navigator.onLine : true);
    sync();
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
    };
  }, []);

  return online;
}

export default function CrmLeadDetailPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const leadId = Number(params.id);
  const presetServiceSlug = searchParams.get('service_slug')?.trim() || undefined;

  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [lead, setLead] = useState<LeadRow | null>(null);
  const [attribution, setAttribution] = useState<LeadAttributionData | null>(null);
  const [staffOptions, setStaffOptions] = useState<CrmStaffRow[]>([]);
  const [catalogServices, setCatalogServices] = useState<CatalogServiceRow[]>([]);
  const [activities, setActivities] = useState<LeadActivityRow[]>([]);
  const [audit, setAudit] = useState<LeadAuditBundle | null>(null);
  const [status, setStatus] = useState('');
  const [auditNote, setAuditNote] = useState('');
  const [assignToId, setAssignToId] = useState('');
  const [assignReason, setAssignReason] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [selectedActivityId, setSelectedActivityId] = useState<number | null>(null);
  const [copilotDrawerOpen, setCopilotDrawerOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<LeadDetailTab>('detail');
  const [b2bPane, setB2bPane] = useState<B2bOverviewTab>('overview');
  const [desktopTab, setDesktopTab] = useState<LeadWorkspaceDesktopTab>('pipeline');
  const userPickedWorkspaceTab = useRef(false);
  const workspaceTabLeadId = useRef<number | null>(null);
  const [pipelineStep, setPipelineStep] = useState<PresalesFunnelStepKey>('b2');
  const [copilotMessage, setCopilotMessage] = useState('');
  const [funnelSnap, setFunnelSnap] = useState<LeadFunnelSnapshot | null>(null);
  const [intakeSummary, setIntakeSummary] = useState<IntakeStepSummary | null>(null);
  const [consultGate, setConsultGate] = useState<ConsultGateState | null>(null);
  const [contractSummary, setContractSummary] = useState<LeadContractFlowSummary | null>(null);
  const [contractChecks, setContractChecks] = useState<Array<{ key: string; ok: boolean }>>([]);
  const [contractRefresh, setContractRefresh] = useState(0);
  const [statusOptionsApi, setStatusOptionsApi] = useState<LeadStatusOptionsResponse | null>(null);
  const [statusOptionsLoading, setStatusOptionsLoading] = useState(false);
  const [copilotContext, setCopilotContext] = useState<LeadCopilotContext | null>(null);
  const [copilotContextLoading, setCopilotContextLoading] = useState(false);
  const [callDebriefOpen, setCallDebriefOpen] = useState(false);
  const [callDebriefActivityId, setCallDebriefActivityId] = useState<number | null>(null);
  const [terminalDebriefOpen, setTerminalDebriefOpen] = useState(false);
  const [prep, setPrep] = useState<LeadMeetingPrepResponse | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [party, setParty] = useState<LeadPartyFormValue>(emptyLeadParty());
  const [partySaving, setPartySaving] = useState(false);
  const [quoteHref, setQuoteHref] = useState<string | null>(null);
  const [nbaBusy, setNbaBusy] = useState(false);
  const [b2CallJustPlaced, setB2CallJustPlaced] = useState(false);
  const [cockpitOpen, setCockpitOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const prepPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const layout = useLeadDetailLayout();
  const online = useNetworkOnline();
  const copilotOn = aiCopilotEnabled();
  const solutionCaps = useMemo(() => resolvePresalesSolutionCaps(user), [user]);

  const leadFlowKind = useMemo(
    () =>
      statusOptionsApi?.lead_flow_kind ??
      (lead ? resolveLeadFlowKindFromLead(lead, funnelSnap) : 'b2b_prospect'),
    [lead, funnelSnap, statusOptionsApi?.lead_flow_kind],
  );
  const statusDropdownOptions = statusOptionsApi?.allowed_next ?? [];
  const statusHints = statusOptionsApi?.hints ?? [];
  const showB2bFlow = showB2bSalesFlowBar(leadFlowKind);
  const quoteStage = normalizeLeadStatus(lead?.status);
  // Báo giá column includes Đàm phán / proposal, not only status bao_gia.
  const inBaoGiaColumn = isBaoGiaKanbanColumn(lead?.status);
  const quoteWithSale = funnelSnap?.presales?.quote_case?.phase === 'sale_review';
  const hourQuoteEdit = inBaoGiaColumn && !quoteWithSale;
  const hourQuoteView =
    quoteWithSale ||
    (!inBaoGiaColumn && ['won', 'chot', 'post_sale', 'trien_khai'].includes(quoteStage));
  const showDealQuoteEntry = hourQuoteEdit || hourQuoteView;
  const presalesStage = funnelPresalesStage(funnelSnap);
  const b2Complete = funnelB2Complete(funnelSnap);
  const intakeGo = deriveS0IntakeGo(presalesStage);
  const stageVis = useMemo(
    () =>
      resolveLeadStageVisibility({
        flowKind: leadFlowKind,
        b2Complete,
        presalesStage,
        intakeGo,
        hasContract: Boolean(contractSummary?.hasContract),
        contractStatus: contractSummary?.contractStatus ?? null,
        dealRoomEnabled: dealRoomEnabled(),
      }),
    [leadFlowKind, b2Complete, intakeGo, presalesStage, contractSummary],
  );
  const showConsultTab = showB2bFlow && showLeadConsultTab(funnelSnap);
  const showLmpTab = leadMeetingPrepEnabled() && showB2bFlow;
  const pipelineTabOn = isLeadPipelineTabEnabled();
  const marketingLeader = isMarketingLeader(user);
  const showPipelineTab =
    pipelineTabOn && shouldShowPipelineTab(leadFlowKind) && canViewCrmLeadDetail(user);
  const prepDeepLink = searchParams.get('prep') === '1';

  const nba = useMemo(() => {
    if (!lead) return null;
    return resolveLeadNextAction({
      lmpEnabled: showLmpTab,
      dealRoomEnabled: dealRoomEnabled(),
      phone: lead.phone ?? '',
      email: lead.email ?? '',
      leadStatus: lead.status ?? '',
      b2Complete,
      presalesStage,
      prepStatus: prep?.status ?? null,
      prepStage: prep?.prep_stage ?? null,
      debriefPending: Boolean(prep?.debrief_pending),
      handoffStatus: funnelSnap?.presales?.handoff?.status ?? null,
      hasContract: Boolean(contractSummary?.hasContract),
      contractStatus: contractSummary?.contractStatus ?? null,
      pendingApproval: Boolean(contractSummary?.pendingApproval),
      submitReady: contractSubmitReady(contractChecks),
      createReady: contractCreateReady(contractChecks),
    });
  }, [lead, showLmpTab, b2Complete, presalesStage, prep, contractSummary, contractChecks]);

  const loadPrep = useCallback(async () => {
    const token = getAccessToken();
    if (!showLmpTab || !token) return;
    try {
      const row = await fetchLeadMeetingPrep(token, leadId);
      setPrep(row);
    } catch {
      /* prep is optional on overview */
    }
  }, [showLmpTab, leadId]);

  useEffect(() => {
    if (!showLmpTab || !getAccessToken()) return;
    void loadPrep();
  }, [showLmpTab, loadPrep]);

  useEffect(() => {
    if (prepPollRef.current) {
      clearInterval(prepPollRef.current);
      prepPollRef.current = null;
    }
    const status = prep?.status;
    if (showLmpTab && (status === 'running' || status === 'pending')) {
      prepPollRef.current = setInterval(() => {
        void loadPrep();
      }, 5000);
    }
    return () => {
      if (prepPollRef.current) clearInterval(prepPollRef.current);
    };
  }, [prep?.status, showLmpTab, loadPrep]);

  const reloadFunnel = useCallback(async (access: string) => {
    if (!showB2bFlow) return;
    try {
      const snap = await fetchLeadFunnel(access, leadId);
      setFunnelSnap(snap);
    } catch {
      /* funnel optional until B2 complete */
    }
    try {
      const [sessions, gateOut] = await Promise.all([
        fetchIntakeSessions(access, { lead_id: leadId }).catch(() => [] as IntakeSessionRow[]),
        fetchLeadPresalesConsultGate(access, leadId).catch(() => null),
      ]);
      setIntakeSummary(summarizeLeadIntake(sessions));
      setConsultGate(
        gateOut?.gate ?? {
          ok: false,
          level: 'block',
          messages: ['Chưa đọc được điều kiện giao Solution. Tải lại trang.'],
          requires_confirm: false,
          requires_override: false,
        },
      );
    } catch {
      setIntakeSummary(null);
      setConsultGate(null);
    }
  }, [leadId, showB2bFlow]);

  const selectWorkspaceTab = useCallback((tab: LeadWorkspaceDesktopTab) => {
    userPickedWorkspaceTab.current = true;
    const y = typeof window !== 'undefined' ? window.scrollY : 0;
    setDesktopTab(tab);
    if (typeof window === 'undefined') return;
    const hold = () => window.scrollTo(0, y);
    requestAnimationFrame(hold);
    window.setTimeout(hold, 0);
  }, []);

  const openConsultTab = useCallback(() => {
    userPickedWorkspaceTab.current = true;
    setB2bPane('consult');
    setDesktopTab('consult');
    setMobileTab('detail');
    if (typeof window !== 'undefined') {
      const base = window.location.pathname + window.location.search;
      window.history.replaceState(null, '', `${base}${LEAD_CONSULT_TAB_HASH}`);
      if (!isLeadPipelineTabEnabled()) {
        requestAnimationFrame(() => {
          document.getElementById('funnel-presales')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      }
    }
  }, []);

  const openMeetingPrepTab = useCallback(() => {
    setCockpitOpen(true);
    setMobileTab('detail');
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (url.searchParams.get('prep') !== '1') {
      url.searchParams.set('prep', '1');
      window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
    }
  }, []);

  const closeCockpit = useCallback(() => {
    setCockpitOpen(false);
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (url.searchParams.get('prep') === '1') {
      url.searchParams.delete('prep');
      window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
    }
  }, []);

  const openOverviewTab = useCallback(() => {
    userPickedWorkspaceTab.current = true;
    setB2bPane('overview');
    setDesktopTab(marketingLeader ? 'history' : 'pipeline');
    setMobileTab('detail');
  }, [marketingLeader]);

  const openR5EditOnOverview = useCallback(() => {
    openOverviewTab();
    requestAnimationFrame(() => {
      document.getElementById('funnel-presales-r5')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [openOverviewTab]);

  const onNbaSelectEntity = useCallback(async (entityId: string) => {
    const token = getAccessToken();
    if (!token) return;
    setNbaBusy(true);
    setError('');
    try {
      const out = await selectLeadMeetingPrepEntity(token, leadId, entityId);
      setPrep(out.prep);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chọn pháp nhân thất bại');
    } finally {
      setNbaBusy(false);
    }
  }, [leadId]);

  const onNbaAction = useCallback(async (kind: NextActionKind) => {
    const token = getAccessToken();
    switch (kind) {
      case 'edit_contact': {
        const el =
          document.getElementById('lead-contact-actions') ??
          document.querySelector('.lead-detail-hero');
        el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        break;
      }
      case 'save_company_run_prep': {
        if (!token) return;
        setNbaBusy(true);
        setError('');
        try {
          const out = await runLeadMeetingPrep(token, leadId, {
            company_name: companyName.trim(),
            website_url: websiteUrl.trim() || undefined,
          });
          setPrep(out.prep);
          await loadPrep();
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Chạy prep thất bại');
        } finally {
          setNbaBusy(false);
        }
        break;
      }
      case 'select_entity':
      case 'wait_prep':
        break;
      case 'open_cockpit':
        openMeetingPrepTab();
        break;
      case 'copy_script': {
        if (prep?.status === 'ready') {
          const script = buildM1Script(prep);
          const text = script.fullTalkTrack || script.opening;
          if (!text.trim()) {
            setError('SCI chưa sẵn sàng');
            break;
          }
          try {
            await navigator.clipboard.writeText(text);
            setMessage('Đã copy script vào clipboard.');
          } catch {
            setError('Không copy được script.');
          }
        } else {
          setError('SCI chưa sẵn sàng');
        }
        break;
      }
      case 'complete_b2':
        document.getElementById('funnel-b2')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        break;
      case 'open_intake':
        router.push(`/crm/intake?lead_id=${leadId}`);
        break;
      case 'copy_m2_brief': {
        if (prep) {
          const brief = buildM2HandoffBrief(prep);
          const text = brief.fullTalkTrack || brief.opening;
          if (text.trim()) {
            try {
              await navigator.clipboard.writeText(text);
              setMessage('Đã copy brief M2 vào clipboard.');
            } catch {
              openConsultTab();
            }
            break;
          }
        }
        openConsultTab();
        break;
      }
      case 'open_consult':
        openConsultTab();
        break;
      case 'wait_handoff':
        break;
      case 'handoff_solution': {
        if (!token) return;
        if (typeof window !== 'undefined' && !window.confirm('Xác nhận giao Solution/MKT?')) return;
        setNbaBusy(true);
        setError('');
        try {
          const first = await handoffLeadToSolution(token, leadId, { confirm: true });
          setFunnelSnap(first.funnel);
          setMessage('Đã giao Solution/MKT');
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Giao Solution thất bại';
          if (/override/i.test(msg) && typeof window !== 'undefined') {
            const reason = window.prompt('Director override — nhập lý do:');
            if (!reason?.trim()) {
              setError('Cần lý do override');
              break;
            }
            try {
              const retry = await handoffLeadToSolution(token, leadId, {
                confirm: true,
                override_reason: reason.trim(),
              });
              setFunnelSnap(retry.funnel);
              setMessage('Đã giao Solution/MKT (override)');
            } catch (retryErr) {
              setError(retryErr instanceof Error ? retryErr.message : 'Giao Solution thất bại');
            }
          } else {
            setError(msg);
          }
        } finally {
          setNbaBusy(false);
        }
        break;
      }
      case 'advance_presales': {
        if (!token) return;
        if (typeof window !== 'undefined' && !window.confirm('Xác nhận chuyển → Báo giá?')) return;
        setNbaBusy(true);
        setError('');
        try {
          const out = await advanceLeadPresales(token, leadId, { confirm: true });
          setFunnelSnap(out.funnel);
          setMessage('Đã chuyển giai đoạn pre-sales');
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Chuyển giai đoạn thất bại';
          if (/override/i.test(msg) && typeof window !== 'undefined') {
            const reason = window.prompt('Director override — nhập lý do:');
            if (!reason?.trim()) {
              setError('Cần lý do override');
              break;
            }
            try {
              const retry = await advanceLeadPresales(token, leadId, {
                confirm: true,
                override_reason: reason.trim(),
              });
              setFunnelSnap(retry.funnel);
              setMessage('Đã chuyển giai đoạn pre-sales (override)');
            } catch (retryErr) {
              setError(retryErr instanceof Error ? retryErr.message : 'Chuyển giai đoạn thất bại');
            }
          } else {
            setError(msg);
          }
        } finally {
          setNbaBusy(false);
        }
        break;
      }
      case 'open_deal_room':
        router.push(`/crm/leads/${leadId}/deal-room`);
        break;
      case 'apply_offer_ladder': {
        if (!token) return;
        setNbaBusy(true);
        setError('');
        try {
          const out = await applyLeadMeetingPrepOfferLadder(token, leadId);
          setMessage(`Proposal #${out.proposal_id} — mở editor để chỉnh`);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Tạo báo giá thất bại');
        } finally {
          setNbaBusy(false);
        }
        break;
      }
      case 'submit_debrief':
        setTerminalDebriefOpen(true);
        break;
      case 'add_activity':
        userPickedWorkspaceTab.current = true;
        setMobileTab('detail');
        setDesktopTab('history');
        requestAnimationFrame(() => {
          document.getElementById('lead-activity-history')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
        break;
      case 'create_contract': {
        document.getElementById('lead-contract')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        document.getElementById('lead-contract-amount')?.focus();
        break;
      }
      case 'submit_contract': {
        document.getElementById('lead-contract')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        document.getElementById('lead-contract-submit')?.focus();
        break;
      }
      case 'wait_contract_approval':
        break;
      case 'open_contract_hub':
        router.push('/crm/hub');
        break;
      default:
        break;
    }
  }, [
    companyName,
    websiteUrl,
    leadId,
    loadPrep,
    openMeetingPrepTab,
    openConsultTab,
    prep,
    router,
  ]);

  const onPipelineFunnelPrimaryAction = useCallback(
    async (action: FunnelPrimaryAction) => {
      const token = getAccessToken();
      if (!token) return;

      if (action.kind === 'ensure_presales') {
        setNbaBusy(true);
        setError('');
        try {
          const slug =
            presetServiceSlug?.trim() ||
            catalogServices[0]?.slug ||
            'dich-vu-seo-tong-the';
          const out = await ensureLeadPresales(token, leadId, slug);
          setFunnelSnap(out.funnel);
          setMessage('Đã bắt đầu pre-sales');
          setPipelineStep('intake_bant');
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Bắt đầu pre-sales thất bại');
        } finally {
          setNbaBusy(false);
        }
        return;
      }

      if (action.kind === 'handoff_solution') {
        await onNbaAction('handoff_solution');
        return;
      }

      if (action.kind === 'advance_presales') {
        await onNbaAction('advance_presales');
        return;
      }

      if (action.kind === 'claim_solution') {
        setNbaBusy(true);
        setError('');
        try {
          const out = await claimLeadSolution(token, leadId);
          setFunnelSnap(out.funnel);
          setMessage('Đã claim Solution');
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Claim Solution thất bại');
        } finally {
          setNbaBusy(false);
        }
        return;
      }

      if (action.kind === 'release_to_sales') {
        setNbaBusy(true);
        setError('');
        try {
          const out = await releaseLeadToSales(token, leadId);
          setFunnelSnap(out.funnel);
          setMessage('Đã trả Sales');
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Trả Sales thất bại');
        } finally {
          setNbaBusy(false);
        }
      }
    },
    [catalogServices, leadId, onNbaAction, presetServiceSlug],
  );

  const reloadStatusOptions = useCallback(async (access: string) => {
    setStatusOptionsLoading(true);
    try {
      const opts = await fetchLeadStatusOptions(access, leadId);
      setStatusOptionsApi(opts);
      setStatus((prev) => {
        const allowedIds = new Set(opts.allowed_next.map((row) => row.id));
        if (allowedIds.has(prev)) return prev;
        return opts.current_status;
      });
    } catch {
      setStatusOptionsApi(null);
    } finally {
      setStatusOptionsLoading(false);
    }
  }, [leadId]);

  const ensureAuth = useCallback(async (): Promise<string | null> => {
    let access = getAccessToken();
    if (!access) {
      router.replace('/login');
      return null;
    }
    const cached = getStoredUser();
    if (cached) setUser(cached);
    if (cached && canViewCrmLeadDetail(cached)) return access;
    try {
      const me = await staffMe(access);
      setUser(me);
      updateStoredUser(me);
      if (!canViewCrmLeadDetail(me)) {
        setError('Cần quyền xem lead (crm_leads.view hoặc crm_presales_solution.view)');
        return null;
      }
      return access;
    } catch {
      const refresh = getRefreshToken();
      if (!refresh) {
        clearSession();
        router.replace('/login');
        return null;
      }
      const out = await staffRefresh(refresh);
      updateAccessToken(out.access_token);
      access = out.access_token;
      const me = await staffMe(access);
      setUser(me);
      updateStoredUser(me);
      if (!canViewCrmLeadDetail(me)) {
        setError('Cần quyền xem lead (crm_leads.view hoặc crm_presales_solution.view)');
        return null;
      }
      return access;
    }
  }, [router]);

  const reloadTimeline = useCallback(async (access: string) => {
    const [acts, aud] = await Promise.all([
      fetchLeadActivities(access, leadId),
      fetchLeadAudit(access, leadId),
    ]);
    setActivities(acts);
    setAudit(aud);
  }, [leadId]);

  const reloadCopilotContext = useCallback(async (access: string) => {
    setCopilotContextLoading(true);
    try {
      const ctx = await fetchLeadCopilotContext(access, leadId);
      setCopilotContext(ctx);
      if (ctx.catalog?.services?.length) {
        setCatalogServices(
          ctx.catalog.services.map((svc, index) => ({
            id: index + 1,
            slug: svc.slug,
            name: svc.name,
            description: svc.description,
            sort_order: index,
            active: true,
          })),
        );
      }
    } catch {
      setCopilotContext(null);
    } finally {
      setCopilotContextLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    if (!Number.isFinite(leadId) || leadId <= 0) {
      setError('Lead ID không hợp lệ');
      setLoading(false);
      return;
    }
    void (async () => {
      const access = await ensureAuth();
      if (!access) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError('');
      let row: Awaited<ReturnType<typeof fetchLead>>;
      try {
        row = await fetchLead(access, leadId);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải lead thất bại');
        setLoading(false);
        return;
      }
      setLead(row);
      setParty({
        company_name: row.company_name ?? '',
        company_address: row.company_address ?? '',
        phone: row.phone ?? '',
        email: row.email ?? '',
        logo_asset_id: row.logo_asset_id ?? '',
        full_name: row.full_name ?? '',
      });
      setStatus(row.status || 'moi');
      setLoading(false);
      void getQtQuotes(access, { q: `LD-${leadId}`, page_size: 1 })
        .then((list) => {
          const existing = list.items.find((item) => item.lead_code === `LD-${leadId}` || item.id);
          setQuoteHref(existing ? `/crm/proposals/${existing.id}` : `/crm/proposals/new?lead_id=${leadId}`);
        })
        .catch(() => setQuoteHref(`/crm/proposals/new?lead_id=${leadId}`));
      try {
        const [catalog, attr, staffOut] = await Promise.all([
          fetchCatalogBundle(access).catch(() => null),
          fetchLeadAttribution(access, leadId).catch(() => null),
          fetchCrmStaffList(access).catch(() => ({ staff: [] as CrmStaffRow[], summary: {} })),
        ]);
        setAttribution(attr);
        const assignable = (staffOut.staff ?? []).filter(
          (s) => s.active !== 0 && s.can_receive_leads !== false,
        );
        if (assignable.length) {
          setStaffOptions(assignable);
        } else if (catalog?.staff?.length) {
          setStaffOptions(
            catalog.staff.map((s) => ({
              id: s.id,
              name: s.name,
              internal_code: s.internal_code,
              phone: '',
              email: '',
              job_title: '',
              department: '',
              active: 1,
              can_receive_leads: true,
            })),
          );
        }
        if (catalog?.services?.length) {
          setCatalogServices(catalog.services.filter((service) => service.active));
        }
        await Promise.all([
          reloadTimeline(access),
          reloadStatusOptions(access),
          reloadCopilotContext(access),
          showB2bSalesFlowBar(resolveLeadFlowKindFromLead(row, null))
            ? reloadFunnel(access)
            : Promise.resolve(),
        ]);
      } catch {
        /* Hồ sơ đã hiện. Phần phụ không chặn trang. */
      }
    })();
  }, [ensureAuth, leadId, reloadCopilotContext, reloadFunnel, reloadTimeline, reloadStatusOptions]);

  const accessToken = getAccessToken();

  useEffect(() => {
    setContractSummary(null);
    setContractChecks([]);
    setB2CallJustPlaced(false);
  }, [leadId]);

  useEffect(() => {
    if (!accessToken || !showB2bFlow) return;
    let cancelled = false;
    void fetchLeadContractReadiness(accessToken, leadId)
      .then((data) => {
        if (cancelled) return;
        setContractSummary({
          hasContract: Boolean(data.contract),
          contractStatus: data.contract?.status ?? null,
          pendingApproval: data.approval?.status === 'pending',
          lifecycleId:
            data.lifecycle_id != null && data.lifecycle_id > 0 ? data.lifecycle_id : null,
          lifecycleStage: data.lifecycle_stage ?? null,
          agencyClientId: normalizeAgencyClientId(data.contract?.agency_client_id),
        });
        setContractChecks(data.checks ?? []);
      })
      .catch(() => {
        if (cancelled) return;
        setContractSummary({
          hasContract: false,
          contractStatus: null,
          pendingApproval: false,
          lifecycleId: null,
        });
        setContractChecks([]);
      });
    return () => {
      cancelled = true;
    };
  }, [leadId, showB2bFlow, contractRefresh, accessToken]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!window.location.hash.startsWith('#lead-contract')) return;
    if (desktopTab !== 'contract') return;
    const targetId = window.location.hash.slice(1);
    const timer = window.setTimeout(() => {
      document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [desktopTab, contractSummary]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const syncHash = () => {
      if (window.location.hash === LEAD_CONSULT_TAB_HASH && showLeadConsultTab(funnelSnap)) {
        openConsultTab();
      }
    };
    syncHash();
    window.addEventListener('hashchange', syncHash);
    return () => window.removeEventListener('hashchange', syncHash);
  }, [funnelSnap, openConsultTab]);

  useEffect(() => {
    if (!showPipelineTab) return;
    if (marketingLeader) {
      setDesktopTab((current) => (current === 'pipeline' ? 'history' : current));
      return;
    }
    if (workspaceTabLeadId.current !== leadId) {
      userPickedWorkspaceTab.current = false;
      workspaceTabLeadId.current = leadId;
    }
    if (userPickedWorkspaceTab.current) return;
    const hash = typeof window !== 'undefined' ? window.location.hash : '';
    const mapped = mapLegacyHashToPipeline(hash, funnelPresalesStage(funnelSnap));
    const tab = defaultLeadWorkspaceTab({
      flowKind: leadFlowKind,
      status,
      contractActive: Boolean(
        contractSummary?.hasContract && contractSummary.contractStatus === 'active',
      ),
      hash,
      searchTab: searchParams.get('tab'),
      showConsult: showConsultTab,
      showLmp: showLmpTab,
    });
    setDesktopTab(tab);
    const stepFromQuery = searchParams.get('step') as PresalesFunnelStepKey | null;
    if (mapped) setPipelineStep(mapped.step);
    else if (stepFromQuery) setPipelineStep(stepFromQuery);
  }, [
    showPipelineTab,
    leadId,
    funnelSnap,
    status,
    contractSummary,
    searchParams,
    showConsultTab,
    showLmpTab,
    leadFlowKind,
    marketingLeader,
  ]);

  useEffect(() => {
    if (prepDeepLink && showLmpTab) {
      openMeetingPrepTab();
    }
  }, [prepDeepLink, showLmpTab, openMeetingPrepTab]);

  useEffect(() => {
    if (!showConsultTab && b2bPane === 'consult') {
      setB2bPane('overview');
    }
    if (!showLmpTab) {
      setCockpitOpen(false);
    }
  }, [showConsultTab, showLmpTab, b2bPane]);

  useEffect(() => {
    const access = getAccessToken();
    if (!access || !lead) return;
    void reloadStatusOptions(access);
  }, [lead?.status, lead?.id, b2Complete, reloadStatusOptions]);

  async function onSaveParty() {
    if (!user || !lead) return;
    if (!hasCap(user, 'crm_leads', 'edit')) {
      setError('Không có quyền sửa thông tin khách');
      return;
    }
    const access = getAccessToken();
    if (!access) {
      router.replace('/login');
      return;
    }
    setPartySaving(true);
    setError('');
    try {
      const updated = await patchLead(access, lead.id, {
        company_name: party.company_name,
        company_address: party.company_address,
        phone: party.phone,
        email: party.email,
      });
      setLead(updated);
      setParty({
        company_name: updated.company_name ?? party.company_name,
        company_address: updated.company_address ?? party.company_address,
        phone: updated.phone ?? party.phone,
        email: updated.email ?? party.email,
        logo_asset_id: updated.logo_asset_id ?? party.logo_asset_id,
        full_name: updated.full_name ?? party.full_name,
      });
      setMessage('Đã lưu thông tin khách trên Lead.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không lưu được thông tin khách');
    } finally {
      setPartySaving(false);
    }
  }

  async function onSaveStatus(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !lead) return;
    if (!hasCap(user, 'crm_leads', 'edit')) {
      setError('Không có quyền sửa trạng thái');
      return;
    }
    const access = getAccessToken();
    if (!access) {
      router.replace('/login');
      return;
    }
    if (status.trim() === lead.status) {
      setMessage('Trạng thái không đổi');
      return;
    }
    const terminalStatuses = ['chot', 'won', 'post_sale', 'lost'];
    if (terminalStatuses.includes(status.trim()) && auditNote.trim().length < 3) {
      setError('Cần ghi chú audit ≥ 3 ký tự khi chốt / won / lost.');
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');
    try {
      const updated = await patchLead(access, leadId, {
        status: status.trim(),
        audit_note: auditNote.trim(),
      });
      setLead(updated);
      setStatus(updated.status || status);
      setAuditNote('');
      setMessage('Đã lưu trạng thái + audit');
      await reloadTimeline(access);
      await reloadStatusOptions(access);
      await reloadCopilotContext(access);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lưu thất bại');
    } finally {
      setSaving(false);
    }
  }

  async function onAssign(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !lead) return;
    if (!hasCap(user, 'crm_leads', 'assign')) {
      setError('Không có quyền phân lead');
      return;
    }
    const toId = Number(assignToId);
    const reason = assignReason.trim();
    if (!Number.isFinite(toId) || toId <= 0) {
      setError('Chọn nhân viên nhận lead');
      return;
    }
    if (reason.length < 3) {
      setError('Cần ghi lý do phân lại (≥ 3 ký tự)');
      return;
    }
    const access = getAccessToken();
    if (!access) {
      router.replace('/login');
      return;
    }

    setAssigning(true);
    setError('');
    setMessage('');
    try {
      const updated = await assignLead(access, leadId, { to_user_id: toId, reason });
      setLead(updated);
      setAssignToId('');
      setAssignReason('');
      setAssignOpen(false);
      setMessage('Đã phân lead');
      await reloadTimeline(access);
      await reloadCopilotContext(access);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Phân lead thất bại');
    } finally {
      setAssigning(false);
    }
  }

  function logout() {
    clearSession();
    router.push('/login');
  }

  const ownerLabel = useMemo(() => {
    if (!lead?.owner_id) return null;
    const fromApi = lead.owner_name?.trim();
    if (fromApi) return fromApi;
    const staff = staffOptions.find((s) => s.id === lead.owner_id);
    return staff ? staff.name : `#${lead.owner_id}`;
  }, [lead?.owner_id, lead?.owner_name, staffOptions]);

  const aeViewer = isAccountExecutive(user);
  const careHistory = useMemo(
    () => mergeLeadCareHistory(activities, audit?.status_logs ?? []),
    [activities, audit],
  );

  const onSoftphonePlaced = useCallback(() => {
    if (funnelB2Complete(funnelSnap)) return;
    setB2CallJustPlaced(true);
    document.getElementById('funnel-b2')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [funnelSnap]);

  if (!user) {
    return (
      <main style={{ padding: '2rem' }}>
        <p className="muted">Đang tải…</p>
      </main>
    );
  }

  const showSlaSciUnifiedPanel =
    Boolean(accessToken) && leadFlowKind === 'spa_operational';
  const useMobileTabs = layout.mobile;
  const showCopilotSheet =
    copilotOn && !!lead && !loading && !!accessToken && !!user && layout.mobile && mobileTab === 'ai';
  const showCopilotDrawer =
    copilotOn && !!lead && !loading && !!accessToken && !!user && !useMobileTabs && copilotDrawerOpen;
  const hideOverviewContent =
    (showConsultTab && b2bPane === 'consult') || (showPipelineTab && desktopTab === 'consult');
  const showWorkPane =
    !useMobileTabs ||
    mobileTab === 'detail' ||
    (mobileTab === 'history' && showPipelineTab);
  const showHistoryPane =
    Boolean(accessToken) &&
    ((showPipelineTab && desktopTab === 'history') ||
      (!showPipelineTab && (!useMobileTabs || mobileTab === 'history')));
  const showOverviewMain = showWorkPane && !hideOverviewContent;
  const showConsultMain =
    showConsultTab &&
    showWorkPane &&
    (b2bPane === 'consult' || (showPipelineTab && desktopTab === 'consult'));
  const handoffStatus = funnelSnap?.presales?.handoff?.status ?? '';
  const solutionDesk =
    showB2bFlow &&
    (handoffStatus === 'pending' || handoffStatus === 'with_solution') &&
    !solutionCaps.isAeTrackOnly &&
    (solutionCaps.canClaim || solutionCaps.canEditConsult);
  const pipelineReadOnly =
    status === 'won' || Boolean(contractSummary?.hasContract);
  const hideMainPane = useMobileTabs && mobileTab === 'ai';

  function renderCopilotPanel(variant: 'column' | 'drawer' | 'sheet', onCloseDrawer?: () => void) {
    if (!online) {
      return (
        <div
          className="lead-copilot-offline-banner"
          role="alert"
          data-testid="copilot-offline-banner"
        >
          Copilot cần kết nối mạng
        </div>
      );
    }
    if (!lead || !user || !accessToken) return null;
    return (
      <LeadCopilotPanel
        token={accessToken}
        leadId={leadId}
        lead={lead}
        user={user}
        activities={activities}
        selectedActivityId={selectedActivityId}
        onSelectActivity={setSelectedActivityId}
        onCopilotError={setCopilotMessage}
        onActivityCreated={() => {
          const access = getAccessToken();
          if (access) {
            void reloadTimeline(access);
            void reloadCopilotContext(access);
          }
        }}
        variant={variant}
        onCloseDrawer={onCloseDrawer}
        copilotContext={copilotContext}
        copilotContextLoading={copilotContextLoading}
      />
    );
  }

  function onCopyContact(value: string, label: string) {
    void copyLeadContact(value, label, setMessage);
  }


  return (
    <StaffPageShell
      user={user}
      onLogout={logout}
      width="full"
      breadcrumb={[
        { label: 'CRM', href: '/crm/leads' },
        { label: 'Leads', href: '/crm/leads' },
        { label: lead?.full_name || `#${leadId}` },
      ]}
    >
      <div className={`lead-detail-page${showCopilotSheet ? ' lead-detail-page--copilot-sheet' : ''}`}>

      {useMobileTabs ? (
        <div className="lead-detail-tabs" role="tablist" aria-label="Lead detail sections">
          <button
            type="button"
            role="tab"
            aria-selected={mobileTab === 'detail'}
            className={mobileTab === 'detail' ? 'is-active' : ''}
            onClick={() => {
              setMobileTab('detail');
            }}
          >
            Việc
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mobileTab === 'history'}
            className={mobileTab === 'history' ? 'is-active' : ''}
            onClick={() => {
              setMobileTab('history');
              if (showPipelineTab) selectWorkspaceTab('history');
            }}
          >
            Lịch sử
          </button>
          {copilotOn ? (
            <button
              type="button"
              role="tab"
              aria-selected={mobileTab === 'ai'}
              className={mobileTab === 'ai' ? 'is-active' : ''}
              onClick={() => setMobileTab('ai')}
            >
              AI
            </button>
          ) : null}
        </div>
      ) : null}

      {loading ? <p className="lead-empty-state lead-empty-state--page">Đang tải lead #{leadId}…</p> : null}
      {error ? (
        <div className="lead-alert lead-alert--error" role="alert">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="lead-alert lead-alert--success" role="status">
          {message}
        </div>
      ) : null}
      {copilotMessage ? <p className="lead-copilot-hint">{copilotMessage}</p> : null}

      {lead && !loading && solutionCaps.canView && !solutionDesk ? (
        <PresalesSolutionHandoffBanner funnel={funnelSnap} user={user} />
      ) : null}

      {lead && !loading ? (
        <div className="lead-detail-layout">
          <div className="lead-detail-top">
            <div className="lead-detail-identity">
            <LeadDetailHero
              hideMeta
              lead={lead}
              ownerLabel={ownerLabel}
              flowKind={leadFlowKind}
              flowLabel={leadFlowKindLabel(leadFlowKind)}
              nbaTitle={showB2bFlow && !solutionDesk ? nba?.title_vi ?? null : null}
              showCockpit={showLmpTab}
              onOpenCockpit={openMeetingPrepTab}
              showAssign={!aeViewer}
              onOpenAssign={() => setAssignOpen(true)}
              contactActions={
                lead.phone ? (
                  <LeadContactActions
                    phone={lead.phone}
                    leadId={lead.id}
                    accessToken={accessToken}
                    onCopy={onCopyContact}
                    onCallPlaced={onSoftphonePlaced}
                  />
                ) : null
              }
            />
            <LeadPropertyRail
              variant="identity"
              lead={lead}
              ownerLabel={ownerLabel}
              includeContactFields={false}
              omitKeys={['source', 'channel']}
              contact={undefined}
              assignForm={null}
              extra={null}
              statusForm={
                <form className="lead-form" id="lead-status-form" onSubmit={(e) => void onSaveStatus(e)}>
                  <label className="lead-field">
                    <span className="lead-field__label">Trạng thái</span>
                    <select
                      className="lead-select"
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      disabled={
                        !hasCap(user, 'crm_leads', 'edit') ||
                        saving ||
                        statusOptionsLoading ||
                        statusDropdownOptions.length <= 1
                      }
                    >
                      {statusDropdownOptions.map((row) => (
                        <option key={row.id} value={row.id}>
                          {row.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="lead-field">
                    <span className="lead-field__label">Ghi chú</span>
                    <input
                      className="lead-input"
                      value={auditNote}
                      onChange={(e) => setAuditNote(e.target.value)}
                      placeholder="Lý do đổi trạng thái"
                      disabled={!hasCap(user, 'crm_leads', 'edit') || saving}
                    />
                  </label>
                  <button
                    type="submit"
                    className="btn btn-sm lead-form__submit"
                    disabled={saving || !hasCap(user, 'crm_leads', 'edit')}
                  >
                    {saving ? 'Đang lưu…' : 'Lưu trạng thái'}
                  </button>
                </form>
              }
            />
            </div>
            <LeadPartyCard
              layout="inline"
              leadId={lead.id}
              value={party}
              onChange={setParty}
              disabled={!hasCap(user, 'crm_leads', 'edit') || partySaving}
              onSave={() => void onSaveParty()}
              saving={partySaving}
              quoteHref={quoteHref}
            />
          </div>
          {accessToken && lead && !marketingLeader ? (
            <LeadStageRecords
              leadId={leadId}
              status={lead.status || status}
              activities={activities}
              intakeSummary={intakeSummary}
              serviceSlug={presetServiceSlug}
            />
          ) : null}


          {stageVis.showNbaB2b && stageVis.showJourney && nba && !showPipelineTab && !marketingLeader ? (
            <div className="lead-workspace-stage">
              <LeadNextActionCard
                action={nba}
                prep={prep}
                busy={nbaBusy}
                companyName={companyName}
                websiteUrl={websiteUrl}
                onCompanyName={setCompanyName}
                onWebsiteUrl={setWebsiteUrl}
                onPickEntity={(id) => void onNbaSelectEntity(id)}
                onAction={onNbaAction}
              />
              <LeadJourneyStepper
                leadId={leadId}
                funnel={funnelSnap}
                contract={contractSummary}
                onOpenConsult={showConsultTab ? openConsultTab : undefined}
              />
            </div>
          ) : null}

          {accessToken && !showPipelineTab ? (
            <LeadFrSlaPanel
              token={accessToken}
              leadId={leadId}
              canWrite={hasCap(user, 'crm_leads', 'edit') || hasCap(user, 'crm_leads', 'create')}
            />
          ) : null}

          {showSlaSciUnifiedPanel && !showPipelineTab ? (
            <LeadSlaCarePanel
              token={accessToken!}
              leadId={leadId}
              status={status}
              onAuditNoteSuggest={(text) => setAuditNote(text)}
              onReload={() => {
                const access = getAccessToken();
                if (access) {
                  void reloadTimeline(access);
                  void reloadCopilotContext(access);
                }
              }}
              copilotContext={copilotContext}
              copilotLoading={copilotContextLoading}
              onOpenMeetingPrep={showLmpTab ? openMeetingPrepTab : undefined}
            />
          ) : null}

          {accessToken && leadFlowKind === 'spa_operational' ? (
            <ClosedLoopPanel
              token={accessToken}
              leadId={leadId}
              status={status}
              closedLoop={copilotContext?.closed_loop ?? null}
              copilotLoading={copilotContextLoading}
            />
          ) : null}

          <div
            className="lead-detail-grid lead-detail-grid--record"
          >
          <div className="lead-detail-main">
          <div className={hideMainPane ? 'lead-detail-pane--hidden' : ''}>
            <LeadAttributionChips attribution={attribution} />

            {showB2bFlow ? null : (
              <div className="banner banner-info lead-spa-flow-banner" style={{ marginTop: '0.75rem' }}>
                <strong>Luồng CSKH vận hành 24h</strong>
                <p style={{ margin: '0.35rem 0 0', fontSize: '0.9rem' }}>
                  Liên hệ trong SLA → hẹn gặp nếu cần → chốt dịch vụ client. Không dùng Pre-sales / HĐ agency.
                </p>
              </div>
            )}

            {accessToken && stageVis.showDealRoomBanner && showDealQuoteEntry ? (
              <div className="deal-room-entry-banner">
                <div>
                  <strong>Deal Room</strong>
                  <p className="muted" style={{ margin: '0.25rem 0 0', fontSize: '0.85rem' }}>
                    1 màn: Consult + L1 R5 + báo giá + gates — chuẩn bị buổi chốt.
                  </p>
                </div>
                <Link href={`/crm/leads/${leadId}/deal-room`} className="btn btn-sm btn-primary">
                  Mở Deal Room →
                </Link>
              </div>
            ) : null}

            {handoffStatus === 'released' && accessToken && lead ? (
              <SolutionCaseDesk
                filesOnly
                token={accessToken}
                lead={lead}
                party={party}
                funnel={funnelSnap}
                onFunnelChange={setFunnelSnap}
              />
            ) : null}

            {accessToken && lead && funnelSnap?.presales?.quote_case ? (
              <QuoteCasePanel
                token={accessToken}
                leadId={leadId}
                funnel={funnelSnap}
                onFunnelChange={setFunnelSnap}
                onLeadReload={async () => {
                  const row = await fetchLead(accessToken, leadId);
                  setLead(row);
                  setStatus(row.status || 'moi');
                }}
                onMessage={setMessage}
                onError={setError}
              />
            ) : null}

            {solutionDesk && accessToken && lead ? (
              <SolutionCaseDesk
                token={accessToken}
                lead={lead}
                party={party}
                funnel={funnelSnap}
                onFunnelChange={setFunnelSnap}
                onMessage={setMessage}
                onError={setError}
              />
            ) : null}

            {!solutionDesk && b2bPane === 'consult' && showWorkPane ? (
              <div className="lead-workspace-bar">
                <button type="button" className="btn btn-ghost btn-sm" onClick={openOverviewTab}>
                  Về khu vực Pipeline
                </button>
                <span className="muted">Đang ở màn tư vấn</span>
              </div>
            ) : null}

            {!solutionDesk && showOverviewMain ? (
              <>
            {showPipelineTab ? (
              <div className="lead-zone">
                <span className="lead-zone__kicker">Khu vực</span>
                <div className="lead-pipeline-tabs" role="tablist" aria-label="Khu vực lead">
                  {marketingLeader ? null : (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={desktopTab === 'pipeline'}
                    onClick={() => selectWorkspaceTab('pipeline')}
                  >
                    Pipeline bán hàng
                  </button>
                  )}
                  <button
                    type="button"
                    role="tab"
                    aria-selected={desktopTab === 'history'}
                    onClick={() => selectWorkspaceTab('history')}
                  >
                    Lịch sử
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={desktopTab === 'contract'}
                    disabled={!stageVis.showContractPanel}
                    title={
                      stageVis.showContractPanel
                        ? undefined
                        : 'Mở khi lead sang Báo giá hoặc đã có hợp đồng'
                    }
                    onClick={() => {
                      if (!stageVis.showContractPanel) return;
                      selectWorkspaceTab('contract');
                    }}
                  >
                    Hợp đồng và Chốt
                  </button>
                  {showConsultTab && !marketingLeader ? (
                    <button
                      type="button"
                      role="tab"
                      aria-selected={desktopTab === 'consult'}
                      onClick={openConsultTab}
                    >
                      Màn tư vấn
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}

            {accessToken && showPipelineTab ? (
              <div hidden={desktopTab !== 'history'}>
              <LeadHistoryTab
                token={accessToken}
                leadId={leadId}
                exchangeLines={careHistory}
                selectedActivityId={selectedActivityId}
                onSelectActivity={setSelectedActivityId}
              />
              </div>
            ) : null}

            {accessToken && showPipelineTab && !marketingLeader ? (
              <div hidden={desktopTab !== 'pipeline'}>
              <LeadSalesPipelineTab
                token={accessToken}
                leadId={leadId}
                user={user}
                stepperInput={{
                  leadId,
                  funnel: funnelSnap,
                  consultGate,
                  intakeSummary,
                  contract: contractSummary,
                  context: 'lead_detail',
                  scope: 'full_b2b',
                }}
                activeStepKey={pipelineStep}
                onStepChange={setPipelineStep}
                onFunnelPrimaryAction={(action) => void onPipelineFunnelPrimaryAction(action)}
                actionBusy={nbaBusy}
                serviceSlug={presetServiceSlug}
                syncFunnel={funnelSnap}
                fetchOnMount={funnelSnap == null}
                serviceOptions={catalogServices.map((service) => ({
                  slug: service.slug,
                  name: service.name,
                }))}
                onOpenConsultTab={showConsultTab ? openConsultTab : undefined}
                onOpenMeetingPrepTab={showLmpTab ? openMeetingPrepTab : undefined}
                onMessage={setMessage}
                onFunnelChange={setFunnelSnap}
                onFunnelUpdated={() => {
                  setContractRefresh((n) => n + 1);
                  const access = getAccessToken();
                  if (access) void reloadTimeline(access);
                }}
                onIntakeSaved={() => {
                  const access = getAccessToken();
                  if (access) void reloadFunnel(access);
                }}
                hideM1Card
                showPresalesBlock={stageVis.showPresalesBlock}
                highlightAfterCall={b2CallJustPlaced}
                readOnly={pipelineReadOnly}
                slaLabel={copilotContext?.sla.banner.title || copilotContext?.sla.worst_sla_tier || 'SLA'}
                slaCountdown={null}
                slaState={
                  copilotContext?.sla.worst_sla_state === 'breach' ||
                  copilotContext?.sla.worst_sla_state === 'warning'
                    ? copilotContext.sla.worst_sla_state
                    : 'ok'
                }
                slaDetail={copilotContext?.sla.banner.message ?? null}
              />
              </div>
            ) : null}

            {accessToken && !showPipelineTab ? (
              <LeadFunnelPanel
                token={accessToken}
                leadId={leadId}
                user={user}
                serviceSlug={presetServiceSlug}
                syncFunnel={funnelSnap}
                fetchOnMount={funnelSnap == null}
                serviceOptions={catalogServices.map((service) => ({
                  slug: service.slug,
                  name: service.name,
                }))}
                onOpenConsultTab={showConsultTab ? openConsultTab : undefined}
                onOpenMeetingPrepTab={showLmpTab ? openMeetingPrepTab : undefined}
                onMessage={setMessage}
                onFunnelChange={setFunnelSnap}
                onFunnelUpdated={() => {
                  setContractRefresh((n) => n + 1);
                  const access = getAccessToken();
                  if (access) void reloadTimeline(access);
                }}
                hideM1Card={showLmpTab}
                showPresalesBlock={stageVis.showPresalesBlock}
                highlightAfterCall={b2CallJustPlaced}
              />
            ) : null}

            {accessToken &&
            (showPipelineTab ? desktopTab === 'contract' : stageVis.showContractPanel) ? (
              <LeadContractTab>
                {stageVis.showContractPanel ? (
                  <>
                    {stageVis.showDealRoomBanner && showDealQuoteEntry && showPipelineTab && desktopTab === 'contract' ? (
                      <div className="deal-room-entry-banner">
                        <div>
                          <strong>Deal Room</strong>
                          <p className="muted" style={{ margin: '0.25rem 0 0', fontSize: '0.85rem' }}>
                            1 màn: Consult + L1 R5 + báo giá + gates — chuẩn bị buổi chốt.
                          </p>
                        </div>
                        <Link href={`/crm/leads/${leadId}/deal-room`} className="btn btn-sm btn-primary">
                          Mở Deal Room →
                        </Link>
                      </div>
                    ) : null}
                    <LeadContractPanel
                      token={accessToken}
                      leadId={leadId}
                      user={user}
                      refreshToken={contractRefresh}
                      onMessage={setMessage}
                      onLoaded={(summary, checks) => {
                        setContractSummary(summary);
                        setContractChecks(checks.map((c) => ({ key: c.key, ok: c.ok })));
                      }}
                    />
                  </>
                ) : (
                  <div className="lead-panel">
                    <h3 className="lead-panel__title">Hợp đồng và Chốt</h3>
                    <p className="muted" style={{ margin: '0.45rem 0 0' }}>
                      Chỗ lập hợp đồng, gửi duyệt và chốt giá trị. Mở khi lead đã sang Báo giá,
                      hoặc khi đã có hợp đồng. Lead này chưa tới bước đó.
                    </p>
                  </div>
                )}
              </LeadContractTab>
            ) : null}
              </>
            ) : null}

            {(solutionDesk || showConsultMain) && accessToken && funnelSnap ? (
              <LeadConsultWorkspace
                token={accessToken}
                leadId={leadId}
                user={user}
                funnelSnap={funnelSnap}
                expectedValue={lead?.expected_value}
                marginPct={lead?.margin_pct}
                onFunnelChange={setFunnelSnap}
                onMessage={setMessage}
                onError={setError}
                onEditR5={openR5EditOnOverview}
              />
            ) : null}

            {showHistoryPane && !showPipelineTab ? (
              <LeadHistoryTab
                token={accessToken!}
                leadId={leadId}
                exchangeLines={careHistory}
                selectedActivityId={selectedActivityId}
                onSelectActivity={setSelectedActivityId}
              />
            ) : null}

          </div>
          </div>

          </div>

        </div>
      ) : null}

      {layout.mobile && mobileTab === 'detail' && lead?.phone ? (
        <LeadMobileCallBar
          phone={lead.phone}
          leadId={lead.id}
          accessToken={accessToken}
          onCopy={onCopyContact}
          onCallPlaced={onSoftphonePlaced}
        />
      ) : null}

      {showCopilotSheet ? (
        <>
          <div
            className="lead-copilot-backdrop lead-copilot-backdrop--sheet"
            role="presentation"
            onClick={() => setMobileTab('detail')}
          />
          {renderCopilotPanel('sheet', () => setMobileTab('detail'))}
        </>
      ) : null}

      {assignOpen && !aeViewer ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => setAssignOpen(false)}
        >
          <div
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="lead-assign-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="lead-assign-title">Phân công hồ sơ</h3>
            <form className="lead-form" onSubmit={(e) => void onAssign(e)}>
              <label className="lead-field">
                <span className="lead-field__label">Nhân viên</span>
                <select
                  className="lead-select"
                  value={assignToId}
                  onChange={(e) => setAssignToId(e.target.value)}
                  disabled={!hasCap(user, 'crm_leads', 'assign') || assigning}
                >
                  <option value="">— Chọn —</option>
                  {staffOptions.map((s) => (
                    <option key={s.id} value={String(s.id)}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="lead-field">
                <span className="lead-field__label">Lý do</span>
                <input
                  className="lead-input"
                  value={assignReason}
                  onChange={(e) => setAssignReason(e.target.value)}
                  placeholder="Bắt buộc (≥ 3 ký tự)"
                  disabled={!hasCap(user, 'crm_leads', 'assign') || assigning}
                  required
                  minLength={3}
                />
              </label>
              <div className="modal-actions">
                <button type="button" className="btn btn-sm" onClick={() => setAssignOpen(false)}>
                  Đóng
                </button>
                <button
                  type="submit"
                  className="btn btn-sm btn-primary"
                  disabled={
                    assigning ||
                    !hasCap(user, 'crm_leads', 'assign') ||
                    assignReason.trim().length < 3 ||
                    !assignToId
                  }
                >
                  {assigning ? 'Đang phân…' : 'Phân công hồ sơ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {showLmpTab && cockpitOpen && accessToken ? (
        <SalesCockpitDrawer open onClose={closeCockpit}>
          <LeadMeetingPrepPanel
            token={accessToken}
            leadId={leadId}
            user={user}
            leadStatus={lead?.status}
            autoFocus={prepDeepLink}
            onMessage={setMessage}
            onError={setError}
            onStatusChange={() => {
              void loadPrep();
            }}
          />
        </SalesCockpitDrawer>
      ) : null}

      {showCopilotDrawer ? (
        <>
          <div
            className="lead-copilot-backdrop"
            role="presentation"
            onClick={() => setCopilotDrawerOpen(false)}
          />
          {renderCopilotPanel('drawer', () => setCopilotDrawerOpen(false))}
        </>
      ) : null}

      {!useMobileTabs && copilotOn && lead && !loading && !copilotDrawerOpen ? (
        <button
          type="button"
          className="lead-copilot-fab"
          onClick={() => setCopilotDrawerOpen(true)}
          aria-label="Mở AI Copilot"
        >
          Mở AI Copilot
        </button>
      ) : null}
      {accessToken && leadMeetingPrepEnabled() && canViewLmp(user) ? (
        <>
          <ShortCallDebriefModal
            token={accessToken}
            leadId={leadId}
            activityId={callDebriefActivityId}
            open={callDebriefOpen}
            onClose={() => {
              setCallDebriefOpen(false);
              setCallDebriefActivityId(null);
            }}
            onSubmitted={() => setMessage('Đã gửi debrief nhanh — cảm ơn AM')}
            onError={(msg) => setError(msg)}
          />
          <PostCallDebriefModal
            token={accessToken}
            leadId={leadId}
            leadStatus={lead?.status ?? status}
            open={terminalDebriefOpen}
            onClose={() => setTerminalDebriefOpen(false)}
            onSubmitted={() => setMessage('Đã gửi debrief — cảm ơn AM')}
            onError={(msg) => setError(msg)}
          />
        </>
      ) : null}
      </div>
    </StaffPageShell>
  );
}
