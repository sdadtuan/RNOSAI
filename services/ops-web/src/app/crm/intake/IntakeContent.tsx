'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState, type FocusEvent } from 'react';
import { useRouter } from 'next/navigation';
import { IntakeFormActions } from '@/components/crm/intake/IntakeFormActions';
import { IntakeCompleteConfirmModal } from '@/components/crm/intake/IntakeCompleteConfirmModal';
import { IntakeDiscoverySection } from '@/components/crm/intake/IntakeDiscoverySection';
import { CrmFunnelStepper } from '@/components/crm/funnel-stepper';
import { IntakeDealBar } from '@/components/crm/intake/IntakeDealBar';
import { IntakeHandoffTab } from '@/components/crm/intake/IntakeHandoffTab';
import { IntakeQualifyTab } from '@/components/crm/intake/IntakeQualifyTab';
import { IntakeSalesKitLibrarySheet } from '@/components/crm/intake/IntakeSalesKitLibrarySheet';
import { IntakeSalesKitPanel } from '@/components/crm/intake/IntakeSalesKitPanel';
import { IntakeSessionSidebar } from '@/components/crm/intake/IntakeSessionSidebar';
import { SalesCockpitDrawer } from '@/components/crm/SalesCockpitDrawer';
import { IntakeWinIntelSection } from '@/components/crm/intake/IntakeWinIntelSection';
import { IntakeWorkspaceTabs } from '@/components/crm/intake/IntakeWorkspaceTabs';
import { PageToolbar, StaffPageShell } from '@/components/layout';
import {
  advanceLeadPresales,
  completeIntakeSession,
  createIntakeSession,
  deleteIntakeSession,
  fetchIntakeContext,
  fetchIntakeDefinitionBySlug,
  fetchIntakeDefinitions,
  fetchIntakeSessions,
  fetchIntakeStats,
  fetchLead,
  fetchLeadFunnel,
  fetchLeadPresalesConsultGate,
  generateIntakeAiSummary,
  patchIntakeSession,
  reopenIntakeSession,
  staffMe,
  staffRefresh,
  type IntakeLeadContext,
  type IntakeSalesKitOutput,
  type IntakeSessionRow,
  type LeadFunnelSnapshot,
  type LeadRow,
} from '@/lib/api';
import type { ConsultGateState, FunnelPrimaryAction, IntakeStepSummary } from '@/lib/crm/funnel-stepper.types';
import { funnelPresalesStage, funnelServiceSlug } from '@/lib/crm/funnel-snapshot.util';
import {
  gapToGo,
  intakeServiceLabel,
  resolveIntakeServiceSlug,
  shouldSyncDraftServiceSlug,
} from '@/lib/crm/intake-service-resolve';
import {
  pickDefaultIntakeTab,
  type IntakeWorkspaceTab,
} from '@/lib/crm/intake-workspace-tab';
import {
  intakeModeLabel,
  intakeStatusLabel,
} from '@/lib/crm/intake-labels';
import {
  buildCreateIntakeSessionBody,
  findDraftSession,
  intakeFormFromSession,
  pickInitialSessionId,
} from '@/lib/crm/intake-session-form';
import {
  bantRowsFromDefinition,
  computeBantTotal,
  type BantKey,
  type BantRowUi,
} from '@/lib/crm/intake-bant';
import { buildIntakeAnswersPatch } from '@/lib/crm/intake-answers';
import {
  applySalesKitToForm,
  type SalesKitApplySelected,
} from '@/lib/crm/intake-sales-kit-apply';
import { intakeSalesKitEnabled } from '@/lib/crm/intake-sales-kit-flags';
import {
  emptyWinIntel,
  type WinIntelKey,
  type WinIntelState,
} from '@/lib/crm/intake-win-intel';
import {
  commitmentsToPatch,
  defaultCommitments,
  type IntakeCommitmentRow,
} from '@/lib/crm/intake-commitments';
import {
  emptyDiscoveryForMode,
  normalizeIntakeMode,
  questionItemsForMode,
  toggleDiscoveryQuestion,
  updateDiscoveryResponse,
  type DiscoveryChecklistState,
  type IntakeDefinitionUi,
  type IntakeSessionMode,
} from '@/lib/crm/intake-discovery';
import {
  emptyRedFlags,
  redFlagItemsFromDefinition,
  toggleRedFlag,
  type IntakeRedFlagsState,
} from '@/lib/crm/intake-red-flags';
import {
  defaultStakeholders,
  stakeholdersToPatch,
  type IntakeStakeholderRow,
} from '@/lib/crm/intake-stakeholders';
import {
  intakeValidationErrors,
  intakeValidationWarnings,
  validateIntakeComplete,
  type IntakeValidationIssue,
} from '@/lib/crm/intake-validation';
import { useIntakeAutosave } from '@/lib/crm/use-intake-autosave';
import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  getStoredUser,
  hasCap,
  updateAccessToken,
  updateStoredUser,
  type StoredStaffUser,
} from '@/lib/auth';

export function IntakeContent({
  initialLeadId = 0,
  initialLifecycleId = 0,
}: {
  initialLeadId?: number;
  initialLifecycleId?: number;
}) {
  const router = useRouter();
  const [leadId, setLeadId] = useState(initialLeadId);
  const [lifecycleId, setLifecycleId] = useState(initialLifecycleId);

  const [user, setUser] = useState<StoredStaffUser | null>(() => getStoredUser());
  const [authReady, setAuthReady] = useState(false);
  const [sessions, setSessions] = useState<IntakeSessionRow[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [bant, setBant] = useState<Record<string, number>>({});
  const [decision, setDecision] = useState('');
  const [decisionReason, setDecisionReason] = useState('');
  const [contactName, setContactName] = useState('');
  const [need, setNeed] = useState('');
  const [discovery, setDiscovery] = useState<DiscoveryChecklistState>(emptyDiscoveryForMode('phone'));
  const [stakeholders, setStakeholders] = useState<IntakeStakeholderRow[]>(defaultStakeholders());
  const [commitments, setCommitments] = useState<IntakeCommitmentRow[]>(defaultCommitments());
  const [redFlags, setRedFlags] = useState<IntakeRedFlagsState>(emptyRedFlags());
  const [winIntel, setWinIntel] = useState<WinIntelState>(emptyWinIntel);
  const [qualifyChecked, setQualifyChecked] = useState<Record<string, boolean>>({});
  const [intakeDefinition, setIntakeDefinition] = useState<IntakeDefinitionUi | null>(null);
  const [bantRows, setBantRows] = useState<BantRowUi[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [kitOpen, setKitOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [lead, setLead] = useState<LeadRow | null>(null);
  const [funnelSnap, setFunnelSnap] = useState<LeadFunnelSnapshot | null>(null);
  const [consultGate, setConsultGate] = useState<ConsultGateState | null>(null);
  const [gateLoading, setGateLoading] = useState(false);
  const [stepperBusy, setStepperBusy] = useState(false);
  const [aiSummaryBusy, setAiSummaryBusy] = useState(false);
  const [completeModalOpen, setCompleteModalOpen] = useState(false);
  const [completeWarnings, setCompleteWarnings] = useState<IntakeValidationIssue[]>([]);
  const [validationErrors, setValidationErrors] = useState<IntakeValidationIssue[]>([]);
  const [urlServiceSlug, setUrlServiceSlug] = useState<string | null>(null);
  const [intakeContext, setIntakeContext] = useState<IntakeLeadContext | null>(null);
  const [activeTab, setActiveTab] = useState<IntakeWorkspaceTab>('qualify');
  const [funnelCollapsed, setFunnelCollapsed] = useState(true);
  const [helpOpen, setHelpOpen] = useState(false);
  const [serviceOverride, setServiceOverride] = useState<string | null>(null);
  const saveInFlightRef = useRef(false);
  const intakeDefinitionRef = useRef<IntakeDefinitionUi | null>(null);
  intakeDefinitionRef.current = intakeDefinition;

  useEffect(() => {
    setLeadId(initialLeadId);
    setLifecycleId(initialLifecycleId);
  }, [initialLeadId, initialLifecycleId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setUrlServiceSlug(new URLSearchParams(window.location.search).get('service_slug'));
  }, []);

  useEffect(() => {
    if (leadId > 0 || lifecycleId > 0) return;
    if (typeof window === 'undefined') return;
    const sp = new URLSearchParams(window.location.search);
    const lid = Number(sp.get('lead_id') || 0);
    const lcid = Number(sp.get('lifecycle_id') || 0);
    if (lid > 0) setLeadId(lid);
    if (lcid > 0) setLifecycleId(lcid);
  }, [leadId, lifecycleId]);

  const contextOk = useMemo(
    () => (Number.isFinite(leadId) && leadId > 0) || (Number.isFinite(lifecycleId) && lifecycleId > 0),
    [leadId, lifecycleId],
  );

  const active = useMemo(
    () => sessions.find((s) => s.id === activeId) ?? null,
    [sessions, activeId],
  );

  const canCreate = useMemo(() => hasCap(user, 'crm_leads', 'edit'), [user]);
  const canBrowseOrg = useMemo(
    () => hasCap(user, 'playbooks', 'configure') || hasCap(user, 'crm_leads', 'configure'),
    [user],
  );
  const formDisabled = active?.status === 'completed' || saving;
  const sessionMode = normalizeIntakeMode(active?.mode);
  const discoveryQuestionItems = useMemo(
    () => questionItemsForMode(intakeDefinition, sessionMode),
    [intakeDefinition, sessionMode],
  );
  const redFlagItems = useMemo(
    () =>
      redFlagItemsFromDefinition(intakeDefinition?.red_flags, intakeDefinition?.red_flag_items),
    [intakeDefinition],
  );
  const formSnapshot = useMemo(
    () =>
      JSON.stringify({
        sessionId: activeId,
        bant,
        decision,
        decisionReason,
        contactName,
        need,
        discovery,
        stakeholders,
        commitments,
        redFlags,
        winIntel,
        qualifyChecked,
      }),
    [
      activeId,
      bant,
      decision,
      decisionReason,
      contactName,
      need,
      discovery,
      stakeholders,
      commitments,
      redFlags,
      winIntel,
      qualifyChecked,
    ],
  );
  const liveBantTotal = useMemo(() => computeBantTotal(bant), [bant]);
  const kitEnabled = intakeSalesKitEnabled();
  const resolvedSlug = useMemo(
    () =>
      resolveIntakeServiceSlug({
        urlSlug: serviceOverride ?? urlServiceSlug,
        sessionSlug: active?.service_slug,
        funnelSlug: funnelServiceSlug(funnelSnap),
      }),
    [active?.service_slug, funnelSnap, serviceOverride, urlServiceSlug],
  );

  const slugMismatch = useMemo(() => {
    const sessionSlug = String(active?.service_slug ?? '').trim();
    const funnelSlug = String(funnelServiceSlug(funnelSnap) ?? '').trim();
    return Boolean(sessionSlug && funnelSlug && sessionSlug !== funnelSlug);
  }, [active?.service_slug, funnelSnap]);

  const dealLeadName =
    intakeContext?.full_name?.trim() ||
    lead?.full_name?.trim() ||
    contactName.trim() ||
    '—';
  const dealCompany =
    intakeContext?.company_name?.trim() ||
    (active?.company_name?.trim() ? active.company_name.trim() : null) ||
    null;
  const dealIndustry = intakeContext?.industry?.trim() || null;
  const dealStage =
    intakeContext?.presales_stage?.trim() || funnelPresalesStage(funnelSnap) || null;
  const sciExcerpt = intakeContext?.prep?.pain_excerpt?.trim() || null;
  const leadHref = leadId > 0 ? `/crm/leads/${leadId}` : '/crm/leads';
  const cockpitHref = leadId > 0 ? `/crm/leads/${leadId}` : '/crm/leads';

  const intakeSummary = useMemo((): IntakeStepSummary => {
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
  }, [sessions]);

  const applySession = useCallback(
    (session: IntakeSessionRow | null) => {
      if (!session) {
        setActiveId(null);
        setBant({});
        setDecision('');
        setDecisionReason('');
        setContactName('');
        setNeed('');
        setDiscovery(emptyDiscoveryForMode('phone'));
        setStakeholders(defaultStakeholders());
        setCommitments(defaultCommitments());
        setRedFlags(emptyRedFlags());
        setWinIntel(emptyWinIntel());
        setQualifyChecked({});
        return;
      }
      setActiveId(session.id);
      const form = intakeFormFromSession(session, intakeDefinition);
      setBant(form.bant);
      setDecision(form.decision);
      setDecisionReason(form.decisionReason);
      setContactName(form.contactName);
      setNeed(form.need);
      setDiscovery(form.discovery);
      setStakeholders(form.stakeholders);
      setCommitments(form.commitments);
      setRedFlags(form.redFlags);
      setWinIntel(form.winIntel);
      setQualifyChecked(form.qualifyChecked);
    },
    [intakeDefinition],
  );

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
        setError('Không có quyền xem trang khảo sát BANT');
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

  const loadConsultGate = useCallback(async (access: string) => {
    if (leadId <= 0) {
      setConsultGate(null);
      return;
    }
    setGateLoading(true);
    try {
      const out = await fetchLeadPresalesConsultGate(access, leadId);
      setConsultGate(out.gate);
    } catch {
      setConsultGate(null);
    } finally {
      setGateLoading(false);
    }
  }, [leadId]);

  const loadFunnel = useCallback(async (access: string) => {
    if (leadId <= 0) {
      setFunnelSnap(null);
      return;
    }
    try {
      const snap = await fetchLeadFunnel(access, leadId);
      setFunnelSnap(snap);
    } catch {
      setFunnelSnap(null);
    }
  }, [leadId]);

  const refreshStepperData = useCallback(
    async (access: string) => {
      await Promise.all([loadFunnel(access), loadConsultGate(access)]);
    },
    [loadConsultGate, loadFunnel],
  );

  const loadLeadContext = useCallback(async (access: string) => {
    if (leadId <= 0) {
      setLead(null);
      return;
    }
    try {
      const row = await fetchLead(access, leadId);
      setLead(row);
    } catch {
      setLead(null);
    }
  }, [leadId]);

  const loadIntakeDealContext = useCallback(async (access: string) => {
    if (leadId <= 0) {
      setIntakeContext(null);
      return;
    }
    try {
      const ctx = await fetchIntakeContext(access, leadId);
      setIntakeContext(ctx);
    } catch {
      setIntakeContext(null);
    }
  }, [leadId]);

  const loadSessions = useCallback(
    async (access: string, preferredId?: number | null) => {
      const rows = await fetchIntakeSessions(access, {
        lead_id: leadId > 0 ? leadId : undefined,
        lifecycle_id: lifecycleId > 0 ? lifecycleId : undefined,
      });
      setSessions(rows);
      const nextId = pickInitialSessionId(rows, preferredId ?? activeId);
      const next = rows.find((s) => s.id === nextId) ?? null;
      applySession(next);
    },
    [leadId, lifecycleId, activeId, applySession],
  );

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError('');
      const access = await ensureAuth();
      setAuthReady(true);
      if (!access) {
        setLoading(false);
        return;
      }
      if (!contextOk) {
        setError('Chọn lead từ danh sách hoặc mở từ trang chi tiết lead (cần ?lead_id= trong URL).');
        setLoading(false);
        return;
      }
      try {
        await fetchIntakeDefinitions(access);
        const statsOut = await fetchIntakeStats(access);
        setStats(statsOut);
        await Promise.all([
          loadLeadContext(access),
          loadIntakeDealContext(access),
          refreshStepperData(access),
          loadSessions(access, null),
        ]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải trang khảo sát thất bại');
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial load only
  }, [contextOk, ensureAuth, leadId, lifecycleId]);

  useEffect(() => {
    if (!authReady || !contextOk) return;
    const access = getAccessToken();
    if (!access) return;
    let cancelled = false;
    void (async () => {
      try {
        const definition = await fetchIntakeDefinitionBySlug(access, resolvedSlug);
        if (cancelled) return;
        const raw = definition as IntakeDefinitionUi;
        setIntakeDefinition({
          slug: raw.slug,
          title: raw.title,
          phone_questions: raw.phone_questions ?? [],
          inperson_questions: raw.inperson_questions ?? [],
          phone_question_items: raw.phone_question_items,
          inperson_question_items: raw.inperson_question_items,
          red_flags: raw.red_flags,
          red_flag_items: raw.red_flag_items,
          schema_version: raw.schema_version,
          qualify_items: raw.qualify_items,
          win_intel_prompts: raw.win_intel_prompts,
          l2_preview_keys: raw.l2_preview_keys,
          is_pilot_form: raw.is_pilot_form,
        });
        setBantRows(bantRowsFromDefinition(definition.bant_rows));
        setError('');
      } catch (err) {
        if (cancelled) return;
        if (!intakeDefinitionRef.current) {
          setError(err instanceof Error ? err.message : 'Tải form khảo sát thất bại');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authReady, contextOk, resolvedSlug]);

  useEffect(() => {
    setServiceOverride(null);
    setActiveTab(
      pickDefaultIntakeTab({
        sessionStatus: active?.status,
        bantTotal: Number(active?.bant_total ?? liveBantTotal),
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed tab when session identity changes
  }, [activeId, active?.status]);

  function onSelectSession(session: IntakeSessionRow) {
    applySession(session);
    setSidebarOpen(false);
    setMessage('');
  }

  async function onDeleteSession(session: IntakeSessionRow) {
    if (session.status !== 'draft') return;
    if (!window.confirm(`Xóa phiên nháp #${session.id}? Hành động không thể hoàn tác.`)) return;

    const access = getAccessToken();
    if (!access || !canCreate) return;

    setSaving(true);
    setError('');
    setMessage('');
    try {
      await deleteIntakeSession(access, session.id);
      const rows = await fetchIntakeSessions(access, {
        lead_id: leadId > 0 ? leadId : undefined,
        lifecycle_id: lifecycleId > 0 ? lifecycleId : undefined,
      });
      setSessions(rows);
      const fallbackId = rows.find((s) => s.status === 'completed')?.id ?? rows[0]?.id ?? null;
      const nextId = session.id === activeId ? fallbackId : pickInitialSessionId(rows, activeId);
      applySession(rows.find((s) => s.id === nextId) ?? null);
      await refreshStepperData(access);
      setMessage(`Đã xóa phiên nháp #${session.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xóa phiên thất bại');
    } finally {
      setSaving(false);
    }
  }

  function confirmCreateIfDraftExists(): boolean {
    const draft = findDraftSession(sessions);
    if (!draft) return true;
    return window.confirm(
      `Đang có phiên nháp #${draft.id} (${intakeModeLabel(draft.mode)}). Tạo phiên mới? Phiên nháp cũ vẫn được giữ.`,
    );
  }

  async function onCreate(mode: 'phone' | 'in_person') {
    const access = getAccessToken();
    if (!access || !user) return;
    if (!canCreate) {
      setError('Không có quyền tạo phiên khảo sát');
      return;
    }
    if (!confirmCreateIfDraftExists()) return;

    setSaving(true);
    setError('');
    try {
      const created = await createIntakeSession(
        access,
        buildCreateIntakeSessionBody({
          leadId,
          lifecycleId,
          mode,
          lead,
          serviceSlug: resolvedSlug,
        }),
      );
      await loadSessions(access, created.id);
      await refreshStepperData(access);
      setSidebarOpen(false);
      setMessage(`Đã tạo phiên #${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tạo phiên thất bại');
    } finally {
      setSaving(false);
    }
  }

  const onServiceChange = useCallback(
    async (slug: string) => {
      if (active?.status === 'completed') {
        setMessage('Reopen hoặc tạo phiên mới để đổi dịch vụ.');
        return;
      }
      const previousOverride = serviceOverride;
      setServiceOverride(slug);
      if (active?.status !== 'draft' || !canCreate) return;
      const access = getAccessToken();
      if (!access) return;
      try {
        await patchIntakeSession(access, active.id, { service_slug: slug });
        setSessions((rows) =>
          rows.map((row) => (row.id === active.id ? { ...row, service_slug: slug } : row)),
        );
      } catch (err) {
        setServiceOverride(previousOverride);
        setError(err instanceof Error ? err.message : 'Đổi dịch vụ thất bại');
      }
    },
    [active, canCreate, serviceOverride],
  );

  const performSave = useCallback(
    async (options?: {
      silent?: boolean;
      overrides?: {
        bant?: Record<string, number>;
        discovery?: DiscoveryChecklistState;
        winIntel?: WinIntelState;
      };
    }) => {
      if (!active || !user || saveInFlightRef.current) return false;
      const access = getAccessToken();
      if (!access) return false;

      const nextBant = options?.overrides?.bant ?? bant;
      const nextDiscovery = options?.overrides?.discovery ?? discovery;
      const nextWinIntel = options?.overrides?.winIntel ?? winIntel;

      saveInFlightRef.current = true;
      if (!options?.silent) {
        setSaving(true);
        setError('');
        setMessage('');
      }

      try {
        await patchIntakeSession(access, active.id, {
          bant_json: nextBant,
          decision,
          decision_reason: decisionReason,
          contact_name: contactName,
          answers_json: buildIntakeAnswersPatch({
            existing: active.answers_json,
            need,
            discovery: { ...nextDiscovery, mode: sessionMode },
            redFlags,
            winIntel: nextWinIntel,
            qualifyChecked,
          }),
          stakeholders_json: stakeholdersToPatch(stakeholders),
          commitments_json: commitmentsToPatch(commitments),
        });
        await loadSessions(access, active.id);
        if (leadId > 0) await refreshStepperData(access);
        if (!options?.silent) setMessage('Đã lưu phiên nháp');
        return true;
      } catch (err) {
        if (!options?.silent) {
          setError(err instanceof Error ? err.message : 'Lưu thất bại');
        }
        throw err;
      } finally {
        saveInFlightRef.current = false;
        if (!options?.silent) setSaving(false);
      }
    },
    [
      active,
      bant,
      contactName,
      decision,
      decisionReason,
      discovery,
      leadId,
      loadSessions,
      need,
      redFlags,
      refreshStepperData,
      sessionMode,
      stakeholders,
      commitments,
      winIntel,
      qualifyChecked,
      user,
    ],
  );

  const autosaveEnabled =
    Boolean(active?.status === 'draft' && canCreate && !loading && !saving);

  const autosave = useIntakeAutosave({
    enabled: autosaveEnabled,
    paused: completeModalOpen || saving,
    snapshot: formSnapshot,
    onSave: async () => {
      await performSave({ silent: true });
    },
  });

  useEffect(() => {
    if (!active || !intakeDefinition) return;
    const form = intakeFormFromSession(active, intakeDefinition);
    setDiscovery(form.discovery);
    setStakeholders(form.stakeholders);
    setCommitments(form.commitments);
    setRedFlags(form.redFlags);
    setWinIntel(form.winIntel);
    setQualifyChecked(form.qualifyChecked);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rehydrate structured answers when definition loads
  }, [intakeDefinition?.schema_version, intakeDefinition?.slug, active?.id]);

  useEffect(() => {
    autosave.syncSnapshot(formSnapshot);
    setValidationErrors([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset autosave baseline when switching session
  }, [activeId]);

  useEffect(() => {
    if (validationErrors.length === 0) return;
    setValidationErrors([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- clear blocking errors after edits
  }, [formSnapshot]);

  const slugSyncKeyRef = useRef('');
  useEffect(() => {
    if (!authReady || !canCreate || !active) return;
    if (
      !shouldSyncDraftServiceSlug({
        status: active.status,
        sessionSlug: active.service_slug,
        resolvedSlug,
      })
    ) {
      return;
    }
    const key = `${active.id}:${resolvedSlug}`;
    if (slugSyncKeyRef.current === key) return;
    slugSyncKeyRef.current = key;
    void onServiceChange(resolvedSlug);
  }, [active, authReady, canCreate, onServiceChange, resolvedSlug]);

  function buildValidationInput() {
    return {
      contactName,
      need,
      bant,
      decision,
      decisionReason,
      sessionMode,
      discoveryChecked: discovery.checked,
      discoveryResponses: discovery.responses,
      discoveryTotal: discoveryQuestionItems.length,
      questionItems: discoveryQuestionItems,
      redFlagsChecked: redFlags.checked,
      stakeholders,
    };
  }

  async function onSave() {
    try {
      const ok = await performSave();
      if (ok) autosave.markSavedNow(formSnapshot);
    } catch {
      // performSave sets error message
    }
  }

  function onCompleteClick() {
    if (!active) return;
    const issues = validateIntakeComplete(buildValidationInput());
    const errors = intakeValidationErrors(issues);
    const warnings = intakeValidationWarnings(issues);
    setValidationErrors(errors);
    if (errors.length > 0) return;
    setCompleteWarnings(warnings);
    setCompleteModalOpen(true);
  }

  async function onConfirmComplete() {
    if (!active || !user) return;
    const access = getAccessToken();
    if (!access) return;

    setCompleteModalOpen(false);
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await performSave({ silent: true });
      autosave.markSavedNow(formSnapshot);
      const updated = await completeIntakeSession(access, active.id);
      await loadSessions(access, updated.id);
      await refreshStepperData(access);
      setMessage('Đã hoàn thành phiên khảo sát — xem stepper phía trên để chuyển Tư vấn nếu gate OK');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hoàn thành thất bại');
    } finally {
      setSaving(false);
    }
  }

  async function onStepperPrimaryAction(action: FunnelPrimaryAction) {
    if (leadId <= 0) return;
    const access = getAccessToken();
    if (!access) return;

    if (action.kind === 'create_intake_session') {
      setSidebarOpen(true);
      setMessage('Chọn + Gọi điện hoặc + Gặp trực tiếp ở cột trái để tạo phiên Intake');
      return;
    }

    if (action.kind === 'focus_intake_form') {
      document.querySelector('.intake-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    if (action.kind !== 'advance_presales') return;

    setStepperBusy(true);
    setError('');
    setMessage('');
    try {
      let overrideReason: string | undefined;
      if (action.requiresOverride) {
        const reason = window.prompt('Director override — nhập lý do chuyển Consult:');
        if (!reason?.trim()) {
          setError('Cần lý do override để chuyển Tư vấn');
          return;
        }
        overrideReason = reason.trim();
      }

      await advanceLeadPresales(access, leadId, {
        confirm: true,
        override_reason: overrideReason,
      });
      await refreshStepperData(access);
      router.push(`/crm/leads/${leadId}#funnel-presales`);
      setMessage(`Đã chuyển giai đoạn Tư vấn — cuộn tới task Consult trên Lead #${leadId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chuyển Tư vấn thất bại');
    } finally {
      setStepperBusy(false);
    }
  }

  function onBantDecisionBlur(event: FocusEvent<HTMLDivElement>) {
    const next = event.relatedTarget as Node | null;
    if (next && event.currentTarget.contains(next)) return;
    autosave.saveOnBlur();
  }

  async function onReopen() {
    if (!active || !user) return;
    const access = getAccessToken();
    if (!access) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const updated = await reopenIntakeSession(access, active.id);
      await loadSessions(access, updated.id);
      setMessage('Đã mở lại phiên nháp');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Mở lại thất bại');
    } finally {
      setSaving(false);
    }
  }

  async function onChangeSessionMode(nextMode: IntakeSessionMode) {
    if (!active || nextMode === sessionMode) return;
    if (
      !window.confirm(
        'Đổi loại phiên sẽ reset checklist câu hỏi cho bộ câu mới. Tiếp tục?',
      )
    ) {
      return;
    }
    const access = getAccessToken();
    if (!access) return;
    setSaving(true);
    setError('');
    try {
      const nextDiscovery = emptyDiscoveryForMode(nextMode);
      setDiscovery(nextDiscovery);
      await patchIntakeSession(access, active.id, {
        mode: nextMode,
        answers_json: buildIntakeAnswersPatch({
          existing: active.answers_json,
          need,
          discovery: nextDiscovery,
          redFlags,
          winIntel,
          qualifyChecked,
        }),
      });
      await loadSessions(access, active.id);
      setMessage(`Đã chuyển sang ${intakeModeLabel(nextMode)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đổi loại phiên thất bại');
    } finally {
      setSaving(false);
    }
  }

  function onToggleDiscoveryQuestion(questionKey: string, next: boolean) {
    setDiscovery((prev) => toggleDiscoveryQuestion(prev, questionKey, next, sessionMode));
  }

  function onDiscoveryResponseChange(
    questionKey: string,
    patch: Parameters<typeof updateDiscoveryResponse>[2],
  ) {
    setDiscovery((prev) => updateDiscoveryResponse(prev, questionKey, patch, sessionMode));
  }

  function onToggleRedFlag(key: string, next: boolean) {
    setRedFlags((prev) => toggleRedFlag(prev, key, next));
  }

  function onToggleQualify(key: string, next: boolean) {
    setQualifyChecked((prev) => {
      const checked = { ...prev };
      if (next) checked[key] = true;
      else delete checked[key];
      return checked;
    });
  }

  function onWinIntelChange(key: WinIntelKey, patch: { answer?: string; confidence?: string }) {
    setWinIntel((prev) => ({
      ...prev,
      [key]: { ...prev[key], ...patch },
    }));
  }

  async function onAiSummary() {
    if (!active || !user) return;
    const access = getAccessToken();
    if (!access) return;
    setAiSummaryBusy(true);
    setError('');
    setMessage('');
    try {
      await generateIntakeAiSummary(access, active.id);
      await loadSessions(access, active.id);
      setMessage('Đã tạo tóm tắt AI');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tóm tắt AI thất bại');
    } finally {
      setAiSummaryBusy(false);
    }
  }

  async function onApplySalesKit(
    apply: IntakeSalesKitOutput['apply'],
    selected: SalesKitApplySelected & { summary: boolean },
  ) {
    if (!active || !canCreate || active.status === 'completed') return;
    const next = applySalesKitToForm({ discovery, winIntel, bant }, apply, selected);
    setDiscovery(next.discovery);
    setWinIntel(next.winIntel);
    setBant(next.bant);
    try {
      await performSave({ silent: true, overrides: next });
      if (selected.summary && apply.ai_summary?.trim()) {
        await onAiSummary();
      } else {
        setMessage('Đã áp dụng Sales Kit vào form');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Áp dụng Sales Kit thất bại');
      throw err;
    }
  }

  function logout() {
    clearSession();
    router.push('/login');
  }

  const systemSessionCount =
    stats && typeof stats.total_sessions === 'number' ? stats.total_sessions : null;

  if (!authReady) {
    return (
      <StaffPageShell user={user} onLogout={logout} loading>
        <span />
      </StaffPageShell>
    );
  }

  return (
    <StaffPageShell
      user={user}
      onLogout={logout}
      breadcrumb={[
        { label: 'CRM', href: '/crm/leads' },
        { label: 'Khảo sát BANT "BANT Intake"' },
      ]}
    >
      <PageToolbar
        title='Khảo sát BANT "BANT Intake"'
        subtitle="Phiên qualify theo dịch vụ"
        actions={
          <button
            type="button"
            className="btn btn-secondary btn-sm intake-help-toggle"
            aria-expanded={helpOpen}
            aria-controls="intake-help-drawer"
            onClick={() => setHelpOpen((open) => !open)}
          >
            ?
          </button>
        }
      />

      <div className="page-card intake-page">
        {leadId > 0 ? (
          <p className="intake-page__context">
            <Link href={`/crm/leads/${leadId}`} className="nav-link">
              ← Lead #{leadId}
            </Link>
          </p>
        ) : (
          <p className="muted intake-page__context">Vòng đời dịch vụ #{lifecycleId}</p>
        )}

        {loading ? <p className="muted">Đang tải…</p> : null}
        {error ? <p className="error">{error}</p> : null}
        {message ? <p className="intake-page__message">{message}</p> : null}

        {!loading && !contextOk ? (
          <p className="muted">
            <Link href="/crm/leads" className="nav-link">
              ← Mở danh sách leads
            </Link>
            {' '}để chọn lead và bắt đầu khảo sát BANT.
          </p>
        ) : null}

        {!loading && contextOk ? (
          <div
            className={`intake-layout${sidebarOpen ? ' intake-layout--sidebar-open' : ''}`}
          >
            <button
              type="button"
              className="btn btn-secondary btn-sm intake-layout__sidebar-toggle"
              onClick={() => setSidebarOpen(true)}
              aria-expanded={sidebarOpen}
            >
              Phiên {active ? `#${active.id}` : '—'} · Chọn phiên
            </button>

            {sidebarOpen ? (
              <button
                type="button"
                className="intake-layout__backdrop"
                aria-label="Đóng danh sách phiên"
                onClick={() => setSidebarOpen(false)}
              />
            ) : null}

            <aside
              className={`intake-layout__sidebar${sidebarOpen ? ' intake-layout__sidebar--open' : ''}`}
            >
              <IntakeSessionSidebar
                sessions={sessions}
                activeId={activeId}
                saving={saving}
                canCreate={canCreate}
                systemSessionCount={systemSessionCount}
                onSelect={onSelectSession}
                onDelete={(session) => void onDeleteSession(session)}
                onCreatePhone={() => void onCreate('phone')}
                onCreateInPerson={() => void onCreate('in_person')}
              />
            </aside>

            <div
              className={`intake-layout__main stack-gap${leadId > 0 ? ' intake-layout__main--stepper' : ''}`}
            >
              <IntakeDealBar
                leadName={dealLeadName}
                companyName={dealCompany}
                industry={dealIndustry}
                serviceSlug={resolvedSlug}
                serviceLabel={intakeServiceLabel(resolvedSlug)}
                bantTotal={liveBantTotal}
                gap={gapToGo(liveBantTotal)}
                stage={dealStage}
                sciExcerpt={sciExcerpt}
                leadHref={leadHref}
                cockpitHref={cockpitHref}
                canEdit={canCreate && active?.status !== 'completed'}
                slugMismatch={slugMismatch}
                funnelCollapsed={funnelCollapsed}
                onToggleFunnel={() => setFunnelCollapsed((collapsed) => !collapsed)}
                onServiceChange={(slug) => void onServiceChange(slug)}
                showSalesKit={kitEnabled}
                salesKitOpen={kitOpen}
                onOpenSalesKit={() => setKitOpen(true)}
                onOpenKho={() => setLibraryOpen(true)}
              />

              {helpOpen ? (
                <div id="intake-help-drawer" className="intake-help intake-help--drawer">
                  <ol>
                    <li>
                      Chọn phiên ở cột trái, hoặc tạo <strong>+ Gọi điện</strong> /{' '}
                      <strong>+ Gặp trực tiếp</strong>.
                    </li>
                    <li>
                      Tab Discovery: hỏi critical. Tab Qualify: chấm BANT 1–5 và quyết định.
                    </li>
                    <li>
                      Chọn <strong>Quyết định</strong> + <strong>Lý do</strong>, rồi{' '}
                      <strong>Hoàn thành phiên</strong>.
                    </li>
                    <li>
                      Mở Funnel trên Deal Bar; khi gate OK bấm <strong>Chuyển → Tư vấn</strong>.
                    </li>
                  </ol>
                </div>
              ) : null}

              {leadId > 0 && !funnelCollapsed ? (
                <CrmFunnelStepper
                  leadId={leadId}
                  funnel={funnelSnap}
                  consultGate={consultGate}
                  intakeSummary={intakeSummary}
                  context="intake"
                  gateLoading={gateLoading}
                  actionBusy={stepperBusy || saving}
                  onRefreshGate={() => {
                    const access = getAccessToken();
                    if (access) void refreshStepperData(access);
                  }}
                  onPrimaryAction={(action) => void onStepperPrimaryAction(action)}
                />
              ) : null}

              {active ? (
                <div className="intake-form stack-gap">
                  <header className="intake-form__head">
                    <h2 className="intake-form__title">
                      Phiên #{active.id} · {intakeModeLabel(active.mode)} ·{' '}
                      {intakeStatusLabel(active.status)}
                    </h2>
                    <p className="muted intake-form__subtitle">
                      BANT {liveBantTotal}/30
                      {active.decision ? ` · ${active.decision}` : ''}
                    </p>
                  </header>

                  <IntakeWorkspaceTabs
                    activeTab={activeTab}
                    onChange={setActiveTab}
                    qualify={
                      <IntakeQualifyTab
                        bant={bant}
                        bantRows={bantRows}
                        decision={decision}
                        decisionReason={decisionReason}
                        disabled={formDisabled}
                        validationErrors={validationErrors}
                        redFlagItems={redFlagItems}
                        redFlags={redFlags}
                        qualifyItems={intakeDefinition?.qualify_items ?? []}
                        qualifyChecked={qualifyChecked}
                        onBantChange={(key: BantKey, value: number) =>
                          setBant((prev) => ({ ...prev, [key]: value }))
                        }
                        onDecisionChange={setDecision}
                        onDecisionReasonChange={setDecisionReason}
                        onBantDecisionBlur={onBantDecisionBlur}
                        onToggleRedFlag={onToggleRedFlag}
                        onRedFlagNotesChange={(value) =>
                          setRedFlags((prev) => ({ ...prev, notes: value }))
                        }
                        onToggleQualify={onToggleQualify}
                      />
                    }
                    discovery={
                      <IntakeDiscoverySection
                        mode={sessionMode}
                        questionItems={discoveryQuestionItems}
                        checked={discovery.checked}
                        responses={discovery.responses}
                        notes={discovery.notes}
                        contactName={contactName}
                        need={need}
                        disabled={formDisabled}
                        canChangeMode={active.status === 'draft' && canCreate}
                        onModeChange={(mode) => void onChangeSessionMode(mode)}
                        onContactNameChange={setContactName}
                        onNeedChange={setNeed}
                        onToggleQuestion={onToggleDiscoveryQuestion}
                        onResponseChange={onDiscoveryResponseChange}
                        onNotesChange={(value) =>
                          setDiscovery((prev) => ({ ...prev, mode: sessionMode, notes: value }))
                        }
                      />
                    }
                    winIntel={
                      <IntakeWinIntelSection
                        state={winIntel}
                        prompts={intakeDefinition?.win_intel_prompts}
                        disabled={formDisabled}
                        onChange={onWinIntelChange}
                      />
                    }
                    handoff={
                      <IntakeHandoffTab
                        stakeholders={stakeholders}
                        commitments={commitments}
                        liveBantTotal={liveBantTotal}
                        disabled={formDisabled}
                        aiSummary={active.ai_summary ?? ''}
                        aiBusy={aiSummaryBusy}
                        canGenerateAi={active.status === 'draft' && canCreate}
                        l2Docs={intakeContext?.l2_docs}
                        leadId={leadId}
                        funnelCollapsed={funnelCollapsed}
                        funnel={funnelSnap}
                        consultGate={consultGate}
                        intakeSummary={intakeSummary}
                        gateLoading={gateLoading}
                        actionBusy={stepperBusy || saving}
                        onStakeholderChange={(index, patch) =>
                          setStakeholders((prev) =>
                            prev.map((row, i) => (i === index ? { ...row, ...patch } : row)),
                          )
                        }
                        onCommitmentChange={(index, patch) =>
                          setCommitments((prev) =>
                            prev.map((row, i) => (i === index ? { ...row, ...patch } : row)),
                          )
                        }
                        onAiGenerate={() => void onAiSummary()}
                        onRefreshGate={() => {
                          const access = getAccessToken();
                          if (access) void refreshStepperData(access);
                        }}
                        onPrimaryAction={(action) => void onStepperPrimaryAction(action)}
                      />
                    }
                  />

                  <IntakeFormActions
                    isCompleted={active.status === 'completed'}
                    saving={saving}
                    autosaveStatus={autosave.status}
                    autosaveSavedAt={autosave.savedAt}
                    autosaveDirty={autosave.dirty}
                    onSave={() => void onSave()}
                    onComplete={onCompleteClick}
                    onReopen={() => void onReopen()}
                  />
                </div>
              ) : (
                <p className="muted">Chưa có phiên — tạo phiên mới ở cột trái.</p>
              )}
            </div>
          </div>
        ) : null}
      </div>

      {kitEnabled ? (
        <SalesCockpitDrawer
          open={kitOpen}
          onClose={() => setKitOpen(false)}
          kicker="INT-SK"
          title="Sales Kit"
          testId="intake-sales-kit-drawer"
        >
          <div id="intake-sales-kit">
            <IntakeSalesKitPanel
              embedded
              sessionId={active?.id ?? null}
              serviceSlug={resolvedSlug}
              canEdit={canCreate && active?.status !== 'completed'}
              sciExcerpt={sciExcerpt}
              onApply={(apply, selected) => void onApplySalesKit(apply, selected)}
              onFocusTab={setActiveTab}
            />
          </div>
        </SalesCockpitDrawer>
      ) : null}

      <IntakeSalesKitLibrarySheet
        open={kitEnabled && libraryOpen}
        sessionId={active?.id ?? null}
        leadId={leadId}
        serviceSlug={resolvedSlug}
        canEdit={canCreate && active?.status !== 'completed'}
        canBrowseOrg={canBrowseOrg}
        onClose={() => setLibraryOpen(false)}
      />

      <IntakeCompleteConfirmModal
        open={completeModalOpen}
        busy={saving}
        sessionLabel={active ? `phiên #${active.id}` : 'phiên'}
        bantTotal={liveBantTotal}
        decision={decision}
        discoveryChecked={discovery.checked}
        discoveryTotal={discoveryQuestionItems.length}
        warnings={completeWarnings}
        onCancel={() => setCompleteModalOpen(false)}
        onConfirm={() => void onConfirmComplete()}
      />
    </StaffPageShell>
  );
}
