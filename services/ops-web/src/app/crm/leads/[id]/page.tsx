'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { StaffPageShell } from '@/components/layout';
import { LeadFunnelPanel } from '@/components/LeadFunnelPanel';
import { LeadConsultWorkspace } from '@/components/LeadConsultWorkspace';
import { type LeadContractFlowSummary } from '@/lib/crm/lead-contract-flow';
import { LeadAttributionChips } from '@/components/crm/LeadAttributionChips';
import { LeadAuditPanel } from '@/components/crm/LeadAuditPanel';
import { LeadContactActions } from '@/components/crm/LeadContactActions';
import { LeadJourneyStepper } from '@/components/crm/LeadJourneyStepper';
import { LeadNextActionCard } from '@/components/crm/LeadNextActionCard';
import { SalesCockpitDrawer } from '@/components/crm/SalesCockpitDrawer';
import { LeadMobileCallBar } from '@/components/crm/LeadMobileCallBar';
import { LeadContractPanel } from '@/components/LeadContractPanel';
import { LeadDetailHero } from '@/components/crm/LeadDetailHero';
import { LeadPropertyRail } from '@/components/crm/LeadPropertyRail';
import { LeadSlaCarePanel } from '@/components/crm/LeadSlaCarePanel';
import { ClosedLoopPanel } from '@/components/crm/ClosedLoopPanel';
import { LeadCopilotPanel } from '@/components/ai/LeadCopilotPanel';
import { LeadEntityTimelinePanel } from '@/components/crm/LeadEntityTimelinePanel';
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
import { MentionComposer } from '@/components/staff/MentionComposer';
import {
  assignLead,
  createLeadActivity,
  fetchCatalogBundle,
  fetchLead,
  fetchLeadContractReadiness,
  fetchLeadFunnel,
  fetchLeadActivities,
  fetchLeadAttribution,
  fetchLeadAudit,
  fetchLeadCopilotContext,
  fetchLeadStatusOptions,
  handoffLeadToSolution,
  advanceLeadPresales,
  patchLeadLegacy,
  staffMe,
  staffRefresh,
  type CatalogStaffOption,
  type CatalogServiceRow,
  type LeadActivityRow,
  type LeadAttributionData,
  type LeadAuditBundle,
  type LeadCopilotContext,
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

const ACTIVITY_TYPES = [
  { value: 'note', label: 'Ghi chú' },
  { value: 'call', label: 'Gọi điện' },
  { value: 'email', label: 'Email' },
  { value: 'message', label: 'Tin nhắn' },
  { value: 'meeting', label: 'Họp' },
  { value: 'proposal', label: 'Báo giá' },
  { value: 'task', label: 'Công việc' },
  { value: 'reminder', label: 'Nhắc việc' },
];

type LeadDetailTab = 'detail' | 'activity' | 'ai';
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
  const [staffOptions, setStaffOptions] = useState<CatalogStaffOption[]>([]);
  const [catalogServices, setCatalogServices] = useState<CatalogServiceRow[]>([]);
  const [activities, setActivities] = useState<LeadActivityRow[]>([]);
  const [audit, setAudit] = useState<LeadAuditBundle | null>(null);
  const [status, setStatus] = useState('');
  const [auditNote, setAuditNote] = useState('');
  const [assignToId, setAssignToId] = useState('');
  const [assignReason, setAssignReason] = useState('');
  const [activityType, setActivityType] = useState('note');
  const [activityContent, setActivityContent] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [addingActivity, setAddingActivity] = useState(false);
  const [selectedActivityId, setSelectedActivityId] = useState<number | null>(null);
  const [copilotDrawerOpen, setCopilotDrawerOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<LeadDetailTab>('detail');
  const [b2bPane, setB2bPane] = useState<B2bOverviewTab>('overview');
  const [copilotMessage, setCopilotMessage] = useState('');
  const [funnelSnap, setFunnelSnap] = useState<LeadFunnelSnapshot | null>(null);
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
  const [nbaBusy, setNbaBusy] = useState(false);
  const [b2CallJustPlaced, setB2CallJustPlaced] = useState(false);
  const [cockpitOpen, setCockpitOpen] = useState(false);
  const prepPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const layout = useLeadDetailLayout();
  const online = useNetworkOnline();
  const copilotOn = aiCopilotEnabled();

  const leadFlowKind = useMemo(
    () =>
      statusOptionsApi?.lead_flow_kind ??
      (lead ? resolveLeadFlowKindFromLead(lead, funnelSnap) : 'b2b_prospect'),
    [lead, funnelSnap, statusOptionsApi?.lead_flow_kind],
  );
  const statusDropdownOptions = statusOptionsApi?.allowed_next ?? [];
  const statusHints = statusOptionsApi?.hints ?? [];
  const showB2bFlow = showB2bSalesFlowBar(leadFlowKind);
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
  }, [leadId, showB2bFlow]);

  const openConsultTab = useCallback(() => {
    setB2bPane('consult');
    setMobileTab('detail');
    if (typeof window !== 'undefined') {
      const base = window.location.pathname + window.location.search;
      window.history.replaceState(null, '', `${base}${LEAD_CONSULT_TAB_HASH}`);
      requestAnimationFrame(() => {
        document.getElementById('funnel-presales')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
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
    setB2bPane('overview');
    setMobileTab('detail');
  }, []);

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
        setMobileTab('activity');
        requestAnimationFrame(() => {
          document.getElementById('lead-activity-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
    try {
      const me = await staffMe(access);
      setUser(me);
      updateStoredUser(me);
      if (!hasCap(me, 'crm_leads', 'view')) {
        setError('Không có quyền xem CRM leads');
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
      if (!access) return;
      setLoading(true);
      setError('');
      try {
        const [row, catalog, attr] = await Promise.all([
          fetchLead(access, leadId),
          fetchCatalogBundle(access).catch(() => null),
          fetchLeadAttribution(access, leadId).catch(() => null),
        ]);
        setLead(row);
        setAttribution(attr);
        setStatus(row.status || 'moi');
        if (catalog?.staff?.length) {
          setStaffOptions(catalog.staff);
        }
        if (catalog?.services?.length) {
          setCatalogServices(catalog.services.filter((service) => service.active));
        }
        await reloadTimeline(access);
        await reloadStatusOptions(access);
        await reloadCopilotContext(access);
        if (showB2bSalesFlowBar(resolveLeadFlowKindFromLead(row, null))) {
          await reloadFunnel(access);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải lead thất bại');
      } finally {
        setLoading(false);
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
      const updated = await patchLeadLegacy(access, leadId, {
        status: status.trim(),
        audit_note: auditNote.trim(),
      });
      setLead(updated);
      setStatus(updated.status || status);
      setAuditNote('');
      setMessage('Đã lưu trạng thái + audit SQLite');
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
      setMessage('Đã phân lead');
      await reloadTimeline(access);
      await reloadCopilotContext(access);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Phân lead thất bại');
    } finally {
      setAssigning(false);
    }
  }

  async function onAddActivity(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!hasCap(user, 'crm_leads', 'edit')) {
      setError('Không có quyền thêm hoạt động');
      return;
    }
    const content = activityContent.trim();
    if (!content) {
      setError('Nội dung hoạt động không được trống');
      return;
    }
    const access = getAccessToken();
    if (!access) {
      router.replace('/login');
      return;
    }

    setAddingActivity(true);
    setError('');
    setMessage('');
    try {
      const activity = await createLeadActivity(access, leadId, {
        activity_type: activityType,
        content,
      });
      setActivityContent('');
      setMessage('Đã thêm hoạt động');
      await reloadTimeline(access);
      await reloadCopilotContext(access);
      if (['call', 'email', 'message', 'meeting'].includes(activityType)) {
        await reloadStatusOptions(access);
      }
      if (
        activityType === 'call' &&
        leadMeetingPrepEnabled() &&
        canViewLmp(user)
      ) {
        const leadStatus = String(lead?.status ?? status).trim().toLowerCase();
        if (leadStatus === 'chot' || leadStatus === 'lost') {
          setTerminalDebriefOpen(true);
        } else {
          setCallDebriefActivityId(activity.id);
          setCallDebriefOpen(true);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Thêm hoạt động thất bại');
    } finally {
      setAddingActivity(false);
    }
  }

  function logout() {
    clearSession();
    router.push('/login');
  }

  const ownerLabel = useMemo(() => {
    if (!lead?.owner_id) return null;
    const staff = staffOptions.find((s) => s.id === lead.owner_id);
    return staff ? staff.name : `#${lead.owner_id}`;
  }, [lead?.owner_id, staffOptions]);

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
  const showCopilotInline =
    copilotOn && !!lead && !loading && !!accessToken && !!user && layout.desktop;
  const showCopilotSheet =
    copilotOn && !!lead && !loading && !!accessToken && !!user && layout.mobile && mobileTab === 'ai';
  const showCopilotDrawer =
    copilotOn && !!lead && !loading && !!accessToken && !!user && layout.tablet && copilotDrawerOpen;
  const hideTimelinePane = useMobileTabs && mobileTab !== 'activity';
  const hidePropertyRail = useMobileTabs && mobileTab !== 'detail';
  const hideOverviewContent = showConsultTab && b2bPane === 'consult';
  const showWorkPane = !useMobileTabs || mobileTab === 'detail';
  const showOverviewMain = showWorkPane && !hideOverviewContent;
  const showConsultMain = showConsultTab && showWorkPane && b2bPane === 'consult';
  const hideMainPane = useMobileTabs && mobileTab !== 'detail';

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

  const onSoftphonePlaced = useCallback(() => {
    if (funnelB2Complete(funnelSnap)) return;
    setB2CallJustPlaced(true);
    document.getElementById('funnel-b2')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [funnelSnap]);

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
            aria-selected={mobileTab === 'activity'}
            className={mobileTab === 'activity' ? 'is-active' : ''}
            onClick={() => setMobileTab('activity')}
          >
            Nhật ký
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

      {lead && !loading ? (
        <div className="lead-detail-layout">
          <LeadDetailHero
            lead={lead}
            ownerLabel={ownerLabel}
            flowKind={leadFlowKind}
            flowLabel={leadFlowKindLabel(leadFlowKind)}
            nbaTitle={showB2bFlow ? nba?.title_vi ?? null : null}
            showCockpit={showLmpTab}
            onOpenCockpit={openMeetingPrepTab}
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

          {stageVis.showNbaB2b && stageVis.showJourney && nba ? (
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

          {showSlaSciUnifiedPanel ? (
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
            className={`lead-detail-grid lead-detail-grid--record${showCopilotInline ? ' lead-detail-grid--with-copilot' : ''}`}
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

            {accessToken && stageVis.showDealRoomBanner ? (
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

            {b2bPane === 'consult' && showWorkPane ? (
              <div className="lead-workspace-bar">
                <button type="button" className="btn btn-ghost btn-sm" onClick={openOverviewTab}>
                  ← Việc
                </button>
                <span className="muted">Tư vấn</span>
              </div>
            ) : null}

            {showOverviewMain ? (
              <>

            {accessToken ? (
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

            {accessToken && stageVis.showContractPanel ? (
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
            ) : null}
              </>
            ) : null}

            {showConsultMain && accessToken && funnelSnap ? (
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

          </div>

          <aside
            className={`lead-detail-sidebar ${hideTimelinePane ? 'lead-detail-pane--hidden' : ''}`}
          >
              <div className="lead-panel lead-panel--action">
                <div className="lead-panel__head">
                  <h3 className="lead-panel__title">Thêm hoạt động</h3>
                </div>
                <form className="lead-form" id="lead-activity-form" onSubmit={(e) => void onAddActivity(e)}>
                  <label className="lead-field">
                    <span className="lead-field__label">Loại</span>
                    <select
                      className="lead-select"
                      value={activityType}
                      onChange={(e) => setActivityType(e.target.value)}
                      disabled={!hasCap(user, 'crm_leads', 'edit') || addingActivity}
                    >
                      {ACTIVITY_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="lead-field">
                    <span className="lead-field__label">Nội dung</span>
                    <MentionComposer
                      token={getAccessToken()}
                      value={activityContent}
                      onChange={setActivityContent}
                      disabled={!hasCap(user, 'crm_leads', 'edit') || addingActivity}
                      rows={3}
                    />
                  </label>
                  <button
                    type="submit"
                    className="btn btn-sm lead-form__submit"
                    disabled={addingActivity || !hasCap(user, 'crm_leads', 'edit')}
                  >
                    {addingActivity ? 'Đang thêm…' : 'Thêm hoạt động'}
                  </button>
                </form>
              </div>
            <div className="lead-panel lead-panel--activity">
              <div className="lead-panel__head">
                <h3 className="lead-panel__title">Timeline hoạt động</h3>
                <p className="lead-panel__subtitle">Chọn activity để tóm tắt trong AI Copilot</p>
              </div>
              {activities.length === 0 ? (
                <p className="lead-empty-state">Chưa có hoạt động.</p>
              ) : (
                <ul className="lead-activity-list">
                  {activities.map((a) => (
                    <li
                      key={a.id}
                      className={`lead-activity-item ${selectedActivityId === a.id ? 'is-selected' : ''}`}
                      onClick={() => setSelectedActivityId(a.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedActivityId(a.id);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      aria-pressed={selectedActivityId === a.id}
                    >
                      <div className="lead-activity-item__meta">
                        <time>{a.created_at?.slice(0, 16)}</time>
                        <span className="lead-activity-item__type">
                          {a.activity_type_label || a.activity_type}
                        </span>
                        {a.user_name ? <span>{a.user_name}</span> : null}
                      </div>
                      <div className="lead-activity-item__content">{a.content || '—'}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {accessToken ? <LeadEntityTimelinePanel token={accessToken} leadId={leadId} /> : null}
          </aside>
          </div>

          <div className={hidePropertyRail ? 'lead-detail-pane--hidden' : ''}>
            <LeadPropertyRail
              lead={lead}
              ownerLabel={ownerLabel}
              contact={undefined}
              statusForm={
                <div className="lead-panel lead-panel--action">
                  <div className="lead-panel__head">
                    <h3 className="lead-panel__title">Trạng thái</h3>
                  </div>
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
                      {statusOptionsLoading ? (
                        <span className="muted" style={{ fontSize: '0.82rem' }}>
                          Đang tải trạng thái được phép…
                        </span>
                      ) : null}
                      {statusHints.length > 0 ? (
                        <ul
                          className="muted"
                          style={{ margin: '0.35rem 0 0', paddingLeft: '1.1rem', fontSize: '0.82rem' }}
                        >
                          {statusHints.map((hint) => (
                            <li key={hint}>{hint}</li>
                          ))}
                        </ul>
                      ) : null}
                    </label>
                    <label className="lead-field">
                      <span className="lead-field__label">
                        Ghi chú audit
                        {['chot', 'won', 'post_sale', 'lost'].includes(status)
                          ? ' (bắt buộc ≥3 ký tự)'
                          : ' (tùy chọn)'}
                      </span>
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
                </div>
              }
              assignForm={
                <div className="lead-panel lead-panel--action">
                  <div className="lead-panel__head">
                    <h3 className="lead-panel__title">Phân lead</h3>
                  </div>
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
                            {s.name} (#{s.id})
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
                      />
                    </label>
                    <button
                      type="submit"
                      className="btn btn-sm lead-form__submit"
                      disabled={assigning || !hasCap(user, 'crm_leads', 'assign')}
                    >
                      {assigning ? 'Đang phân…' : 'Phân lead'}
                    </button>
                  </form>
                </div>
              }
              extra={<LeadAuditPanel audit={audit} />}
            />
          </div>

          {showCopilotInline ? renderCopilotPanel('column') : null}
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

      {layout.tablet && copilotOn && lead && !loading && !copilotDrawerOpen ? (
        <button
          type="button"
          className="lead-copilot-fab"
          onClick={() => setCopilotDrawerOpen(true)}
          aria-label="Mở AI Copilot"
        >
          AI Copilot
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
