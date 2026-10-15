'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CrmLeadsImportExport } from '@/components/crm/CrmLeadsImportExport';
import { LeadsPhoneFilterSheet } from './LeadsPhoneFilterSheet';
import { LeadsPhoneMoreMenu } from './LeadsPhoneMoreMenu';
import { LeadsColumnPicker } from '@/components/crm/LeadsColumnPicker';
import { CrmLeadsList } from '@/components/crm/CrmLeadsList';
import { LeadsRevopsInboxFooter } from '@/components/crm/LeadsRevopsInboxFooter';
import { LeadKanbanBoard } from '@/components/crm/LeadKanbanBoard';
import { LeadSignalKpiStrip } from '@/components/crm/LeadSignalKpiStrip';
import { AeAssignedRawLeadsPanel } from '@/components/crm/AeAssignedRawLeadsPanel';
import { PullToRefresh } from '@/components/mobile/PullToRefresh';
import { WinFilterChips } from '@/components/win';
import {
  BulkActionBar,
  FilterBar,
  FilterBarActions,
  FilterBarSearch,
  PageFooter,
  PageToolbar,
  SegmentedControl,
  StaffPageShell,
} from '@/components/layout';
import { PresalesConsultSlaSummaryCard } from '@/components/PresalesConsultSlaSummaryCard';
import { PresalesFunnelMetricsCard } from '@/components/PresalesFunnelMetricsCard';
import {
  fetchLeads,
  bulkAssignLeads,
  fetchCrmStaffList,
  fetchLeadLookupOptions,
  fetchPresalesConsultSlaSummary,
  fetchPresalesFunnelMetrics,
  fetchReviewQueueCount,
  staffMe,
  staffRefresh,
} from '@/lib/api';
import type { CrmLeadLookupOption, CrmStaffRow, LeadRow, PresalesConsultSlaSummary, PresalesFunnelMetricsResponse } from '@/lib/api';
import { aiCopilotEnabled, canUseAiCopilot } from '@/lib/ai-flags';
import { useLeadScoresMap } from '@/hooks/useLeadScoresMap';
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
import { isAccountManager } from '@/lib/crm/lead-ae-visibility';
import { type LeadFlowKind } from '@/lib/crm/lead-flow-kind';
import { leadStatusSearchLabel, leadStatusSearchOptions, leadStatusSearchStatuses } from '@/lib/crm/lead-status';
import { leadSignalKpis } from '@/lib/crm/lead-signal-kpis';
import {
  leadFlowKindQuery,
  leadsListHref,
  leadsListSubtitle,
  leadsListTitle,
  leadsNewHref,
  type CrmLeadsFlowScope,
} from '@/lib/crm/lead-flow-routes';
import {
  buildLeadsFilterChips,
  buildLeadsListSearchParams,
  clearAllLeadsFilters,
  clearLeadsFilterField,
  leadsFiltersAreEmpty,
  ownerParamToListTab,
  parseLeadsListUrl,
  readSavedLeadsFilters,
  writeSavedLeadsFilters,
  type LeadsListUrlState,
} from '@/lib/crm/leads-list-url';
import { readLeadsVisibleColumns, defaultB2bLeadsVisibleColumns, type LeadsColumnId } from '@/lib/crm/leads-columns';
import { B2B_LEAD_ALERTS_CHANGED_EVENT } from '@/lib/b2b-lead-alerts-api';
import { fetchB2bProjects, type B2bProjectListItem } from '@/lib/b2b-projects-api';
import { isB2bLeadP1, kanbanPulse, showKanbanLeaderPulse } from '@/lib/crm/kanban-column.util';
import {
  isLeadP1SavedView,
  leadP1Filters,
  shouldShowFirstResponseSlaColumn,
} from '@/lib/crm/leads-inbox-revops.util';
import {
  RevOpsAssignModal,
  type RevOpsAssignContext,
} from '@/components/crm/revops/modals/RevOpsAssignModal';

const PAGE_SIZE = 50;
const PAGE_SIZE_KANBAN = 300;
const LEADS_VIEW_STORAGE_KEY = 'crm-leads-view-mode';
const B2B_LEADS_VIEW_STORAGE_KEY = 'crm-b2b-leads-view-mode';

type LeadsViewMode = 'list' | 'kanban';
type B2bSurfaceTab = 'pipeline' | 'raw';

function readLeadsViewMode(flowScope: CrmLeadsFlowScope): LeadsViewMode {
  if (typeof window === 'undefined') {
    return flowScope === 'b2b_prospect' ? 'kanban' : 'list';
  }
  if (flowScope === 'b2b_prospect') {
    const stored = window.localStorage.getItem(B2B_LEADS_VIEW_STORAGE_KEY);
    if (stored === 'list') return 'list';
    return 'kanban'; // default Kanban for B2B
  }
  return window.localStorage.getItem(LEADS_VIEW_STORAGE_KEY) === 'kanban' ? 'kanban' : 'list';
}

function writeLeadsViewMode(flowScope: CrmLeadsFlowScope, mode: LeadsViewMode): void {
  if (typeof window === 'undefined') return;
  const key = flowScope === 'b2b_prospect' ? B2B_LEADS_VIEW_STORAGE_KEY : LEADS_VIEW_STORAGE_KEY;
  window.localStorage.setItem(key, mode);
}

type LeadKindFilter = 'pipeline' | 'review' | 'all';

export function CrmLeadsPageContent({ flowScope = 'all' }: { flowScope?: CrmLeadsFlowScope }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const revopsEmbedded = searchParams.get('revops') === '1';
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [token, setToken] = useState('');
  const [rows, setRows] = useState<LeadRow[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [listTab, setListTab] = useState<'all' | 'mine' | 'unassigned'>('all');
  const [leadKind, setLeadKind] = useState<LeadKindFilter>(() =>
    flowScope === 'b2b_prospect' ? 'all' : 'pipeline',
  );
  const [reviewQueueCount, setReviewQueueCount] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [filterChannel, setFilterChannel] = useState('');
  const [filterReceivedFrom, setFilterReceivedFrom] = useState('');
  const [filterReceivedTo, setFilterReceivedTo] = useState('');
  const [filterAssignee, setFilterAssignee] = useState('');
  const [staffOptions, setStaffOptions] = useState<CrmStaffRow[]>([]);
  const [sourceOptions, setSourceOptions] = useState<CrmLeadLookupOption[]>([]);
  const [channelOptions, setChannelOptions] = useState<CrmLeadLookupOption[]>([]);
  const [b2bProjects, setB2bProjects] = useState<B2bProjectListItem[]>([]);
  const [bulkOwnerId, setBulkOwnerId] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set());
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [slaSummary, setSlaSummary] = useState<PresalesConsultSlaSummary | null>(null);
  const [funnelMetrics, setFunnelMetrics] = useState<PresalesFunnelMetricsResponse | null>(null);
  const [visibleColumns, setVisibleColumns] = useState<Set<LeadsColumnId>>(() =>
    flowScope === 'b2b_prospect' ? defaultB2bLeadsVisibleColumns() : readLeadsVisibleColumns(false),
  );
  const [viewMode, setViewMode] = useState<LeadsViewMode>(() =>
    flowScope === 'b2b_prospect' ? 'kanban' : 'list',
  );
  const [b2bSurface, setB2bSurface] = useState<B2bSurfaceTab>('pipeline');
  const [savedView, setSavedView] = useState('');
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignCtx, setAssignCtx] = useState<RevOpsAssignContext | null>(null);
  const urlReadyRef = useRef(false);
  const filtersReadyRef = useRef(false);
  const offsetRef = useRef(0);
  const queryRef = useRef('');
  const viewModeRef = useRef<LeadsViewMode>(viewMode);
  offsetRef.current = offset;
  queryRef.current = query;
  viewModeRef.current = viewMode;

  const listHref = leadsListHref(flowScope);
  const pageTitle = leadsListTitle(flowScope);
  const pageSubtitleHint = leadsListSubtitle(flowScope);
  const flowKindFilter = leadFlowKindQuery(flowScope);
  const statusOptions = useMemo(
    () => leadStatusSearchOptions(flowKindFilter),
    [flowKindFilter],
  );

  const canImport = useMemo(
    () => hasCap(user, 'crm_leads', 'edit') || hasCap(user, 'crm_leads', 'assign'),
    [user],
  );
  const canCreate = useMemo(() => hasCap(user, 'crm_leads', 'edit'), [user]);
  const canReviewQueue = useMemo(() => hasCap(user, 'crm_leads', 'assign'), [user]);
  /** Admin/CEO: see all leads + assign. AE: own leads only. */
  const canViewAllLeads = useMemo(
    () =>
      Boolean(
        user &&
          (String(user.position_code ?? '').toLowerCase() === 'super-admin' ||
            hasCap(user, 'crm_gdkd', 'view_all_leads')),
      ),
    [user],
  );
  const canAssign = useMemo(
    () =>
      canViewAllLeads &&
      (hasCap(user, 'crm_leads', 'assign') || hasCap(user, 'crm_leads', 'edit')),
    [user, canViewAllLeads],
  );
  /** ACM browses the whole B2B book. Assign and GDKD desks stay on canViewAllLeads. */
  const browsesAllB2bLeads = useMemo(
    () => flowScope === 'b2b_prospect' && isAccountManager(user) && !canViewAllLeads,
    [flowScope, user, canViewAllLeads],
  );

  const myCrmStaffId = useMemo(() => {
    const email = (user?.email ?? '').trim().toLowerCase();
    if (!email) return undefined;
    const row = staffOptions.find((s) => s.email.trim().toLowerCase() === email && s.active !== 0);
    return row?.id;
  }, [user?.email, staffOptions]);

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

  const loadLeads = useCallback(
    async (
      accessToken: string,
      nextOffset: number,
      search: string,
      mode: LeadsViewMode = viewMode,
      opts?: { silent?: boolean },
    ) => {
      const silent = Boolean(opts?.silent);
      if (!silent) {
        setLoading(true);
        setError('');
      }
      try {
        const p1 = isLeadP1SavedView(savedView);
        const p1Filters = p1 && flowScope !== 'b2b_prospect' ? leadP1Filters() : null;
        const scopedMine = (!canViewAllLeads && !browsesAllB2bLeads) || listTab === 'mine';
        const assigneeId = Number(filterAssignee);
        const ownerId =
          Number.isFinite(assigneeId) && assigneeId > 0
            ? assigneeId
            : scopedMine && myCrmStaffId != null
              ? myCrmStaffId
              : undefined;
        const kanban = mode === 'kanban';
        const queryParams = {
          q: search || undefined,
          status: p1Filters?.status,
          statuses: p1Filters?.status ? undefined : leadStatusSearchStatuses(filterStatus, flowKindFilter),
          source: filterSource || undefined,
          channel: filterChannel || undefined,
          received_from: kanban ? undefined : filterReceivedFrom || undefined,
          received_to: kanban ? undefined : filterReceivedTo || undefined,
          owner_id: ownerId,
          unassigned_only:
            canViewAllLeads && (p1Filters?.unassigned_only ?? listTab === 'unassigned'),
          review_queue_only: leadKind === 'review' ? true : undefined,
          hide_review_queue:
            flowScope === 'b2b_prospect' || leadKind === 'all' ? false : undefined,
          lead_flow_kind: flowKindFilter,
        };
        if (!kanban) {
          const data = await fetchLeads(accessToken, {
            ...queryParams,
            limit: PAGE_SIZE,
            offset: nextOffset,
          });
          setRows(data.leads);
          setTotal(data.total);
          setOffset(data.offset);
        } else {
          const collected: Awaited<ReturnType<typeof fetchLeads>>['leads'] = [];
          let totalCount = 0;
          let pageOffset = 0;
          do {
            const data = await fetchLeads(accessToken, {
              ...queryParams,
              limit: PAGE_SIZE_KANBAN,
              offset: pageOffset,
            });
            collected.push(...data.leads);
            totalCount = data.total;
            pageOffset += data.leads.length;
            if (data.leads.length === 0) break;
          } while (collected.length < totalCount && collected.length < 5000);
          setRows(collected);
          setTotal(totalCount);
          setOffset(0);
        }
      } catch (err) {
        if (!silent) {
          setError(err instanceof Error ? err.message : 'Tải leads thất bại');
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [browsesAllB2bLeads, canViewAllLeads, filterAssignee, filterChannel, filterReceivedFrom, filterReceivedTo, filterSource, filterStatus, flowKindFilter, flowScope, leadKind, listTab, myCrmStaffId, savedView, viewMode],
  );

  useEffect(() => {
    setViewMode(readLeadsViewMode(flowScope));
  }, [flowScope]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const parsed = parseLeadsListUrl(new URLSearchParams(window.location.search), flowScope);
    setListTab(ownerParamToListTab(parsed.owner));
    setLeadKind(parsed.kind);
    setFilterStatus(parsed.status);
    setFilterSource(parsed.source);
    setFilterChannel(parsed.channel);
    setQ(parsed.q);
    setQuery(parsed.q);
    setSavedView(parsed.savedView);
    setFilterReceivedFrom(parsed.receivedFrom);
    setFilterReceivedTo(parsed.receivedTo);
    setFilterAssignee(parsed.assignee);
    if (isLeadP1SavedView(parsed.savedView) && flowScope !== 'b2b_prospect') {
      setListTab('unassigned');
      setFilterStatus('moi');
    }
    if (flowScope === 'b2b_prospect') {
      const surface = new URLSearchParams(window.location.search).get('tab');
      setB2bSurface(surface === 'raw' ? 'raw' : 'pipeline');
    } else {
      setB2bSurface('pipeline');
    }
    urlReadyRef.current = true;
  }, [flowScope]);

  useEffect(() => {
    if (browsesAllB2bLeads) {
      if (listTab !== 'all') setListTab('all');
      return;
    }
    if (!canViewAllLeads && listTab !== 'mine') {
      setListTab('mine');
    }
  }, [browsesAllB2bLeads, canViewAllLeads, listTab]);

  useEffect(() => {
    if (!urlReadyRef.current) return;
    const params = buildLeadsListSearchParams(
      {
        owner: listTab,
        kind: leadKind,
        status: filterStatus,
        source: filterSource,
        channel: filterChannel,
        q: query,
        savedView,
        receivedFrom: filterReceivedFrom,
        receivedTo: filterReceivedTo,
        assignee: filterAssignee,
      },
      flowScope,
    );
    if (revopsEmbedded) params.set('revops', '1');
    const qs = params.toString();
    router.replace(qs ? `${listHref}?${qs}` : listHref, { scroll: false });
  }, [
    listTab,
    leadKind,
    filterStatus,
    filterSource,
    filterChannel,
    query,
    savedView,
    filterReceivedFrom,
    filterReceivedTo,
    filterAssignee,
    listHref,
    flowScope,
    revopsEmbedded,
    router,
  ]);

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(q.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [q]);

  useEffect(() => {
    if (!urlReadyRef.current || flowScope !== 'b2b_prospect' || !user?.id) return;
    const current: LeadsListUrlState = {
      owner: listTab,
      kind: leadKind,
      status: filterStatus,
      source: filterSource,
      channel: filterChannel,
      q: query,
      savedView,
      receivedFrom: filterReceivedFrom,
      receivedTo: filterReceivedTo,
      assignee: filterAssignee,
    };
    if (!filtersReadyRef.current) {
      filtersReadyRef.current = true;
      const fromUrl = parseLeadsListUrl(new URLSearchParams(window.location.search), flowScope);
      if (leadsFiltersAreEmpty(fromUrl)) {
        const saved = readSavedLeadsFilters(user.id);
        if (saved && !leadsFiltersAreEmpty(saved)) {
          setListTab(saved.owner);
          setLeadKind(saved.kind);
          setFilterStatus(saved.status);
          setFilterSource(saved.source);
          setFilterChannel(saved.channel);
          setFilterReceivedFrom(saved.receivedFrom);
          setFilterReceivedTo(saved.receivedTo);
          setFilterAssignee(saved.assignee);
          setSavedView(saved.savedView);
          setQ(saved.q);
          setQuery(saved.q);
        }
      }
      return;
    }
    writeSavedLeadsFilters(user.id, current);
  }, [
    user?.id,
    flowScope,
    listTab,
    leadKind,
    filterStatus,
    filterSource,
    filterChannel,
    query,
    savedView,
    filterReceivedFrom,
    filterReceivedTo,
    filterAssignee,
  ]);

  useEffect(() => {
    void (async () => {
      const access = await ensureAuth();
      if (!access) return;
      setToken(access);
      const [staffOut, reviewOut, sourceOut, channelOut] = await Promise.all([
        fetchCrmStaffList(access).catch(() => ({ staff: [], summary: {} })),
        canReviewQueue
          ? fetchReviewQueueCount(access).catch(() => ({ count: 0 }))
          : Promise.resolve({ count: 0 }),
        fetchLeadLookupOptions(access, 'source').catch(() => ({ options: [] as CrmLeadLookupOption[] })),
        fetchLeadLookupOptions(access, 'channel').catch(() => ({ options: [] as CrmLeadLookupOption[] })),
      ]);
      setStaffOptions(staffOut.staff ?? []);
      setReviewQueueCount(reviewOut.count ?? 0);
      setSourceOptions(sourceOut.options ?? []);
      setChannelOptions(channelOut.options ?? []);
      if (hasCap(getStoredUser(), 'crm_b2b_projects', 'view')) {
        try {
          setB2bProjects(await fetchB2bProjects(access, 'active'));
        } catch {
          setB2bProjects([]);
        }
      }
    })();
  }, [ensureAuth, canReviewQueue]);

  useEffect(() => {
    if (!token) return;
    void loadLeads(token, 0, query);
  }, [token, query, listTab, leadKind, filterStatus, filterSource, filterChannel, savedView, loadLeads]);

  // Soft-refresh so new / assigned leads appear without a full page reload.
  useEffect(() => {
    if (!token) return;
    const softReload = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      void loadLeads(token, offsetRef.current, queryRef.current, viewModeRef.current, { silent: true });
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') softReload();
    };
    const onAlertsChanged = () => softReload();
    const pollMs = flowScope === 'b2b_prospect' ? 30_000 : 15_000;
    const timer = window.setInterval(softReload, pollMs);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener(B2B_LEAD_ALERTS_CHANGED_EVENT, onAlertsChanged);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener(B2B_LEAD_ALERTS_CHANGED_EVENT, onAlertsChanged);
    };
  }, [token, loadLeads, flowScope]);

  useEffect(() => {
    if (!token || flowScope !== 'b2b_prospect') {
      setSlaSummary(null);
      setFunnelMetrics(null);
      return;
    }
    void (async () => {
      try {
        const amId =
          (!canViewAllLeads || listTab === 'mine') && myCrmStaffId != null
            ? myCrmStaffId
            : undefined;
        const [slaOut, metricsOut] = await Promise.all([
          fetchPresalesConsultSlaSummary(token, amId),
          fetchPresalesFunnelMetrics(token, { amId }),
        ]);
        setSlaSummary(slaOut.summary);
        setFunnelMetrics(metricsOut);
      } catch {
        setSlaSummary(null);
        setFunnelMetrics(null);
      }
    })();
  }, [token, flowScope, listTab, canViewAllLeads, myCrmStaffId]);

  function logout() {
    clearSession();
    router.push('/login');
  }

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    setQuery(q.trim());
    setOffset(0);
    setSelectedIds(new Set());
  }

  async function goPage(nextOffset: number) {
    if (!token || nextOffset < 0 || nextOffset >= total) return;
    await loadLeads(token, nextOffset, query);
  }

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const row of rows) {
        if (checked) next.add(row.id);
        else next.delete(row.id);
      }
      return next;
    });
  }

  async function handleBulkAssign() {
    if (!token || !selectedList.length) return;
    if (revopsEmbedded) {
      setAssignCtx({ leadIds: selectedList, leadLabel: `${selectedList.length} leads đã chọn` });
      setAssignOpen(true);
      return;
    }
    if (!bulkOwnerId) return;
    const staff = staffOptions.find((row) => String(row.id) === bulkOwnerId);
    if (!staff) return;
    setBulkBusy(true);
    setError('');
    try {
      await bulkAssignLeads(token, {
        lead_ids: selectedList,
        owner_id: staff.id,
        reason: `Bulk assign from ${listHref}`,
      });
      setSelectedIds(new Set());
      await loadLeads(token, offset, query);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bulk assign thất bại');
    } finally {
      setBulkBusy(false);
    }
  }

  function openAssignModal(leadId: number) {
    const lead = rows.find((row) => row.id === leadId);
    setAssignCtx({
      leadId,
      leadLabel: lead?.full_name || `Lead #${leadId}`,
    });
    setAssignOpen(true);
  }

  function applyLeadP1View() {
    setSavedView('p1');
    if (flowScope !== 'b2b_prospect') {
      setListTab('unassigned');
      setFilterStatus('moi');
    }
    setOffset(0);
    setSelectedIds(new Set());
  }

  const selectedList = useMemo(() => [...selectedIds], [selectedIds]);
  const b2bP1 = flowScope === 'b2b_prospect' && isLeadP1SavedView(savedView);
  const visibleRows = useMemo(
    () => (b2bP1 ? rows.filter(isB2bLeadP1) : rows),
    [b2bP1, rows],
  );
  const visibleTotal = b2bP1 ? visibleRows.length : total;
  const boardPulse = useMemo(() => kanbanPulse(visibleRows), [visibleRows]);
  const leaderPulse = showKanbanLeaderPulse(user?.job_functions);
  const leadIds = useMemo(() => visibleRows.map((row) => row.id), [visibleRows]);
  const signalKpis = useMemo(() => leadSignalKpis(visibleRows), [visibleRows]);
  const ownerNameById = useMemo(() => {
    const map: Record<number, string> = {};
    for (const staff of staffOptions) {
      map[staff.id] = staff.name;
    }
    return map;
  }, [staffOptions]);
  const projectLabelById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of b2bProjects) {
      map[p.id] = `${p.name} (${p.code})`;
    }
    return map;
  }, [b2bProjects]);
  const showScores = useMemo(
    () => aiCopilotEnabled() && canUseAiCopilot(user?.id, user?.caps),
    [user?.id, user?.caps],
  );
  const { scores: scoreMap, pending: scoresPending } = useLeadScoresMap(token, leadIds, showScores);

  useEffect(() => {
    setVisibleColumns(readLeadsVisibleColumns(showScores));
  }, [showScores]);

  const showFirstResponseSla = useMemo(() => shouldShowFirstResponseSlaColumn(rows), [rows]);

  const filterChips = useMemo(
    () =>
      buildLeadsFilterChips(
        {
          owner: listTab,
          kind: leadKind,
          status: filterStatus,
          source: filterSource,
          channel: filterChannel,
          q: query,
          savedView,
          receivedFrom: filterReceivedFrom,
          receivedTo: filterReceivedTo,
          assignee: filterAssignee,
        },
        flowScope,
        {
          statusLabel: (key) => leadStatusSearchLabel(key, flowKindFilter),
          sourceLabel: (key) => sourceOptions.find((o) => o.option_key === key)?.label ?? key,
          channelLabel: (key) => channelOptions.find((o) => o.option_key === key)?.label ?? key,
          assigneeLabel: (id) => staffOptions.find((staff) => String(staff.id) === id)?.name ?? id,
        },
      ),
    [
      listTab,
      leadKind,
      filterStatus,
      filterSource,
      filterChannel,
      filterReceivedFrom,
      filterReceivedTo,
      filterAssignee,
      staffOptions,
      query,
      savedView,
      flowScope,
      flowKindFilter,
      sourceOptions,
      channelOptions,
    ],
  );

  const showLeadKindTags = flowScope !== 'b2b_prospect';

  const emptyActions = (
    <>
      {canImport ? (
        <label htmlFor="crm-leads-import-file" className="btn btn-sm">
          Import Excel
        </label>
      ) : null}
      {canCreate ? (
        <Link href={leadsNewHref(flowScope)} className="btn btn-sm btn-secondary">
          + Tạo lead
        </Link>
      ) : null}
      <Link href="/crm/leads" className="btn btn-sm btn-ghost">
        Lead Intake
      </Link>
    </>
  );

  const pageMeta = useMemo(() => {
    const parts = [
      `${total.toLocaleString('vi-VN')} leads`,
      `trang ${Math.floor(offset / PAGE_SIZE) + 1} / ${Math.max(1, Math.ceil(total / PAGE_SIZE))}`,
      pageSubtitleHint,
    ];
    if (flowScope !== 'b2b_prospect') {
      if (leadKind === 'pipeline') parts.push('ẩn Phải tra soát');
      else if (leadKind === 'review') parts.push('chỉ Phải tra soát');
    }
    if (selectedList.length) parts.push(`đã chọn ${selectedList.length}`);
    return parts.join(' · ');
  }, [total, offset, leadKind, pageSubtitleHint, selectedList.length, flowScope]);

  if (!user) {
    return (
      <StaffPageShell user={null} onLogout={logout} loading width="wide">
        <span />
      </StaffPageShell>
    );
  }

  return (
    <StaffPageShell
      user={user}
      onLogout={logout}
      width="wide"
      breadcrumb={[
        { label: 'CRM', href: listHref },
        { label: 'Leads', href: listHref },
        { label: pageTitle },
      ]}
    >
      <div className="crm-leads-page">
      <PageToolbar
        title={pageTitle}
        subtitle={pageMeta}
        actions={
          <>
            <div className="crm-leads-desktop-tools">
              <LeadsColumnPicker
                visible={visibleColumns}
                showScores={showScores}
                showLeadKindTags={showLeadKindTags}
                onChange={setVisibleColumns}
              />
              {token ? (
                <CrmLeadsImportExport
                  token={token}
                  query={query}
                  selectedIds={selectedList}
                  canImport={canImport}
                  onImported={() => void loadLeads(token, 0, query)}
                  onError={setError}
                />
              ) : null}
            </div>
            {canCreate ? (
              <Link href={leadsNewHref(flowScope)} className="btn btn-sm crm-leads-create">
                + Tạo lead
              </Link>
            ) : null}
            {canCreate ? (
              <Link
                href={leadsNewHref(flowScope)}
                className="btn btn-sm crm-leads-phone-only"
                aria-label="Tạo lead"
              >
                +
              </Link>
            ) : null}
            <LeadsPhoneFilterSheet
              q={q}
              onQChange={setQ}
              listTab={browsesAllB2bLeads ? 'all' : listTab}
              canViewAllLeads={canViewAllLeads}
              browsesAllB2bLeads={browsesAllB2bLeads}
              onOwnerChange={(id) => {
                if (browsesAllB2bLeads) return;
                if (!canViewAllLeads && id !== 'mine') return;
                setListTab(id);
                setOffset(0);
                setSelectedIds(new Set());
              }}
              showKind={flowScope === 'spa_operational' || flowScope === 'all'}
              leadKind={leadKind}
              reviewBadge={reviewQueueCount && reviewQueueCount > 0 ? reviewQueueCount : undefined}
              onKindChange={(id) => {
                setLeadKind(id);
                setOffset(0);
                setSelectedIds(new Set());
              }}
              filterStatus={filterStatus}
              onStatusChange={setFilterStatus}
              statusOptions={statusOptions}
              filterSource={filterSource}
              onSourceChange={setFilterSource}
              sourceOptions={sourceOptions}
              filterChannel={filterChannel}
              onChannelChange={setFilterChannel}
              channelOptions={channelOptions}
              receivedFrom={filterReceivedFrom}
              receivedTo={filterReceivedTo}
              onReceivedFromChange={setFilterReceivedFrom}
              onReceivedToChange={setFilterReceivedTo}
              assignee={filterAssignee}
              onAssigneeChange={setFilterAssignee}
              canPickOwner={flowScope === 'b2b_prospect' && (user?.job_functions ?? []).includes('leader')}
              staffOptions={staffOptions}
              loading={loading}
              savedView={savedView}
              onLeadP1={() => applyLeadP1View()}
              showInbox={canReviewQueue && flowScope !== 'b2b_prospect'}
              onApply={() => {
                setQuery(q.trim());
                setOffset(0);
                setSelectedIds(new Set());
              }}
            />
            <LeadsPhoneMoreMenu
              token={token}
              query={query}
              selectedIds={selectedList}
              canImport={canImport}
              visibleColumns={visibleColumns}
              showScores={showScores}
              showLeadKindTags={showLeadKindTags}
              onColumnsChange={setVisibleColumns}
              onImported={() => {
                if (token) void loadLeads(token, 0, query);
              }}
              onError={setError}
            />
          </>
        }
      />

      <div className="crm-leads-signal">
        <LeadSignalKpiStrip items={signalKpis} />
      </div>

      <div className="bitrix-view-tabs" role="tablist" aria-label="Chế độ xem lead">
        {flowScope === 'b2b_prospect' ? (
          <>
            <button
              type="button"
              role="tab"
              aria-selected={b2bSurface === 'pipeline' && viewMode === 'kanban'}
              className={`bitrix-view-tab${b2bSurface === 'pipeline' && viewMode === 'kanban' ? ' is-active' : ''}`}
              onClick={() => {
                setB2bSurface('pipeline');
                setViewMode('kanban');
                writeLeadsViewMode(flowScope, 'kanban');
                setOffset(0);
                if (token) void loadLeads(token, 0, query, 'kanban');
              }}
            >
              Kanban
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={b2bSurface === 'pipeline' && viewMode === 'list'}
              className={`bitrix-view-tab${b2bSurface === 'pipeline' && viewMode === 'list' ? ' is-active' : ''}`}
              onClick={() => {
                setB2bSurface('pipeline');
                setViewMode('list');
                writeLeadsViewMode(flowScope, 'list');
                setOffset(0);
                if (token) void loadLeads(token, 0, query, 'list');
              }}
            >
              Danh sách
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={b2bSurface === 'raw'}
              className={`bitrix-view-tab${b2bSurface === 'raw' ? ' is-active' : ''}`}
              onClick={() => setB2bSurface('raw')}
            >
              Lead thô
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'kanban'}
              className={`bitrix-view-tab${viewMode === 'kanban' ? ' is-active' : ''}`}
              onClick={() => {
                setViewMode('kanban');
                writeLeadsViewMode(flowScope, 'kanban');
                setOffset(0);
                if (token) void loadLeads(token, 0, query, 'kanban');
              }}
            >
              Kanban
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'list'}
              className={`bitrix-view-tab${viewMode === 'list' ? ' is-active' : ''}`}
              onClick={() => {
                setViewMode('list');
                writeLeadsViewMode(flowScope, 'list');
                setOffset(0);
                if (token) void loadLeads(token, 0, query, 'list');
              }}
            >
              Danh sách
            </button>
          </>
        )}
      </div>

      {flowScope === 'b2b_prospect' && b2bSurface === 'raw' ? (
        token ? (
          <AeAssignedRawLeadsPanel token={token} />
        ) : (
          <p className="muted">Đang xác thực…</p>
        )
      ) : (
      <div className="page-card page-card--flat-top stack-gap">
        {flowScope === 'b2b_prospect' && slaSummary ? (
          <PresalesConsultSlaSummaryCard summary={slaSummary} />
        ) : null}
        {flowScope === 'b2b_prospect' && funnelMetrics ? (
          <PresalesFunnelMetricsCard data={funnelMetrics} />
        ) : null}

        <div className="crm-leads-inline-filters">
        <SegmentedControl
          options={
            canViewAllLeads
              ? [
                  { id: 'all', label: 'Tất cả' },
                  { id: 'mine', label: 'Của tôi' },
                  { id: 'unassigned', label: 'Chưa phân' },
                ]
              : browsesAllB2bLeads
                ? [{ id: 'all', label: 'Tất cả' }]
                : [{ id: 'mine', label: 'Của tôi' }]
          }
          value={canViewAllLeads ? listTab : browsesAllB2bLeads ? 'all' : 'mine'}
          onChange={(id) => {
            if (browsesAllB2bLeads) return;
            if (!canViewAllLeads && id !== 'mine') return;
            setListTab(id);
            setOffset(0);
            setSelectedIds(new Set());
          }}
        />

        {flowScope === 'spa_operational' || flowScope === 'all' ? (
          <SegmentedControl
            label="Loại lead"
            options={[
              { id: 'pipeline', label: 'Pipeline AM' },
              {
                id: 'review',
                label: 'Phải tra soát',
                badge: reviewQueueCount && reviewQueueCount > 0 ? reviewQueueCount : undefined,
              },
              { id: 'all', label: 'Tất cả (có tag)' },
            ]}
            value={leadKind}
            onChange={(id) => {
              setLeadKind(id);
              setOffset(0);
              setSelectedIds(new Set());
            }}
            className="segmented-control--kind"
          />
        ) : null}
        </div>

        <WinFilterChips
          chips={filterChips}
          onRemove={(chipId) => {
            const next = clearLeadsFilterField(
              {
                owner: listTab,
                kind: leadKind,
                status: filterStatus,
                source: filterSource,
                channel: filterChannel,
                q: query,
                savedView,
                receivedFrom: filterReceivedFrom,
                receivedTo: filterReceivedTo,
                assignee: filterAssignee,
              },
              chipId,
            );
            setListTab(next.owner);
            setLeadKind(next.kind);
            setFilterStatus(next.status);
            setFilterSource(next.source);
            setFilterChannel(next.channel);
            setFilterReceivedFrom(next.receivedFrom);
            setFilterReceivedTo(next.receivedTo);
            setFilterAssignee(next.assignee);
            setSavedView(next.savedView);
            setQ(next.q);
            setQuery(next.q);
            setOffset(0);
            setSelectedIds(new Set());
          }}
          onClearAll={() => {
            const next = clearAllLeadsFilters(
              {
                owner: listTab,
                kind: leadKind,
                status: filterStatus,
                source: filterSource,
                channel: filterChannel,
                q: query,
                savedView,
                receivedFrom: filterReceivedFrom,
                receivedTo: filterReceivedTo,
                assignee: filterAssignee,
              },
              flowScope,
            );
            setListTab(next.owner);
            setLeadKind(next.kind);
            setFilterStatus(next.status);
            setFilterSource(next.source);
            setFilterChannel(next.channel);
            setFilterReceivedFrom(next.receivedFrom);
            setFilterReceivedTo(next.receivedTo);
            setFilterAssignee(next.assignee);
            setSavedView(next.savedView);
            setQ(next.q);
            setQuery(next.q);
            setOffset(0);
            setSelectedIds(new Set());
          }}
        />

        <div className="crm-leads-inline-filters">
        <FilterBar onSubmit={onSearch}>
          <FilterBarSearch value={q} onChange={setQ} placeholder="Tìm tên, SĐT, email…" />
          <select
            className="kpi-select"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            aria-label="Lọc trạng thái"
          >
            <option value="">Trạng thái</option>
            {statusOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
              </option>
            ))}
          </select>
          <select
            className="kpi-select"
            value={filterSource}
            onChange={(e) => setFilterSource(e.target.value)}
            aria-label="Lọc nguồn"
          >
            <option value="">Nguồn</option>
            {sourceOptions.map((opt) => (
              <option key={opt.id} value={opt.option_key}>
                {opt.label}
              </option>
            ))}
          </select>
          <select
            className="kpi-select"
            value={filterChannel}
            onChange={(e) => setFilterChannel(e.target.value)}
            aria-label="Lọc kênh"
          >
            <option value="">Kênh</option>
            {channelOptions.map((opt) => (
              <option key={opt.id} value={opt.option_key}>
                {opt.label}
              </option>
            ))}
            </select>
          <input
            type="date"
            className="kpi-select"
            value={filterReceivedFrom}
            onChange={(event) => setFilterReceivedFrom(event.target.value)}
            aria-label="Từ ngày"
          />
          <input
            type="date"
            className="kpi-select"
            value={filterReceivedTo}
            onChange={(event) => setFilterReceivedTo(event.target.value)}
            aria-label="Đến ngày"
          />
          {flowScope === 'b2b_prospect' && (user?.job_functions ?? []).includes('leader') ? (
            <select
              className="kpi-select"
              value={filterAssignee}
              onChange={(event) => setFilterAssignee(event.target.value)}
              aria-label="Người phụ trách"
            >
              <option value="">Người phụ trách</option>
              {staffOptions
                .filter((staff) => staff.active !== 0)
                .map((staff) => (
                  <option key={staff.id} value={staff.id}>
                    {staff.name}
                  </option>
                ))}
            </select>
          ) : null}
          <FilterBarActions>
            <button
              type="button"
              className={`btn btn-sm btn-ghost${savedView === 'p1' ? ' is-active' : ''}`}
              onClick={() => applyLeadP1View()}
            >
              Lead P1
            </button>
            {canReviewQueue && flowScope !== 'b2b_prospect' ? (
              <Link href="/crm/leads/review-queue" className="btn btn-sm btn-ghost">
                Inbox GDKD →
              </Link>
            ) : null}
            <button className="btn btn-sm btn-secondary" type="submit" disabled={loading}>
              Lọc
            </button>
          </FilterBarActions>
        </FilterBar>
        </div>

        {canAssign ? (
          <BulkActionBar count={selectedList.length}>
            {!revopsEmbedded ? (
              <select
                className="kpi-select"
                value={bulkOwnerId}
                onChange={(e) => setBulkOwnerId(e.target.value)}
                aria-label="Chọn owner bulk assign"
              >
                <option value="">Gán owner…</option>
                {staffOptions
                  .filter((s) => s.active !== 0 && s.can_receive_leads !== false)
                  .map((staff) => (
                  <option key={staff.id} value={staff.id}>
                    {staff.name}
                  </option>
                ))}
              </select>
            ) : null}
            <button
              type="button"
              className="btn btn-sm"
              disabled={bulkBusy || selectedList.length === 0 || (!revopsEmbedded && !bulkOwnerId)}
              onClick={() => void handleBulkAssign()}
            >
              {revopsEmbedded ? 'Phân bổ (modal)' : 'Bulk assign'}
            </button>
          </BulkActionBar>
        ) : null}

        {loading ? <p className="muted">Đang tải…</p> : null}
        {error ? <p className="error">{error}</p> : null}
        {!loading && total === 0 && flowScope === 'b2b_prospect' ? (
          <p className="muted" style={{ marginBottom: '0.75rem' }}>
            Không thấy lead B2B? Kiểm tra{' '}
            <Link href="/crm/leads" className="nav-link">
              Quản lý Lead (tất cả)
            </Link>{' '}
            — lead gắn client agency hoặc trùng SĐT có thể nằm luồng CSKH vận hành / bị ẩn trùng.
          </p>
        ) : null}

        <PullToRefresh
          disabled={loading || !token || viewMode === 'kanban'}
          onRefresh={async () => {
            if (!token) return;
            await loadLeads(token, offset, query);
          }}
        >
          {viewMode === 'kanban' && flowScope === 'b2b_prospect' ? (
            <div style={{ marginBottom: '0.75rem' }}>
              <p className="canopy-next-action" role="status">
                Bước tiếp: SLA trễ {boardPulse.slaLate} · Hẹn hôm nay {boardPulse.callbackToday} · Báo giá cũ{' '}
                {boardPulse.quoteStale}
              </p>
              {leaderPulse ? (
                <p className="muted">
                  Trong SLA {boardPulse.withinSlaPct}% · Đã rời Mới {boardPulse.leftNewPct}% · Đứng yên{' '}
                  {boardPulse.stale}
                </p>
              ) : null}
            </div>
          ) : null}
          {viewMode === 'kanban' ? (
            <LeadKanbanBoard
              rows={visibleRows}
              flowKind={(flowKindFilter ?? 'b2b_prospect') as LeadFlowKind}
              token={token ?? undefined}
              canChangeOwner={hasCap(user, 'crm_leads', 'assign')}
              onLeadUpdated={() => {
                if (token) void loadLeads(token, 0, query, 'kanban');
              }}
            />
          ) : (
            <CrmLeadsList
              rows={visibleRows}
              loading={loading}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelect}
              onToggleAll={toggleAll}
              ownerNameById={ownerNameById}
              projectLabelById={projectLabelById}
              visibleColumns={visibleColumns}
              showScores={showScores}
              scoreMap={scoreMap}
              scoresPending={scoresPending}
              showLeadKindTags={showLeadKindTags}
              showFirstResponseSla={showFirstResponseSla}
              onAssignLead={canAssign ? openAssignModal : undefined}
              emptyActions={emptyActions}
            />
          )}
        </PullToRefresh>

        {revopsEmbedded && viewMode === 'list' ? <LeadsRevopsInboxFooter /> : null}

        {token ? (
          <RevOpsAssignModal
            open={assignOpen}
            token={token}
            context={assignCtx}
            onClose={() => {
              setAssignOpen(false);
              setAssignCtx(null);
            }}
            onAssigned={() => {
              setSelectedIds(new Set());
              void loadLeads(token, offset, query);
            }}
          />
        ) : null}

        {viewMode === 'list' ? (
          <PageFooter meta={`Hiển thị ${visibleRows.length} / ${visibleTotal.toLocaleString('vi-VN')} leads`}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={loading || offset <= 0}
              onClick={() => void goPage(Math.max(0, offset - PAGE_SIZE))}
            >
              ← Trước
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={loading || offset + PAGE_SIZE >= total}
              onClick={() => void goPage(offset + PAGE_SIZE)}
            >
              Sau →
            </button>
          </PageFooter>
        ) : (
          <PageFooter
            meta={`Kanban · ${visibleRows.length} / ${visibleTotal.toLocaleString('vi-VN')} leads`}
          />
        )}
      </div>
      )}
      </div>
    </StaffPageShell>
  );
}
