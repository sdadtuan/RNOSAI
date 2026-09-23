'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchCrmLeadLookups,
  fetchCrmStaffList,
  type CrmLeadLookupOption,
  type CrmStaffRow,
} from '@/lib/api';
import { fetchVnProvinces, fetchVnWards, type VnProvinceOption, type VnWardOption } from '@/lib/vn-geo-api';
import {
  createRawLeadHarvest,
  exportRawLeads,
  fetchMarketEntitiesSummary,
  fetchRawLeadHarvestProviders,
  fetchRawLeadPriorityCounts,
  fetchRawLeadReadinessCounts,
  fetchRawLeadCareCounts,
  assignRawLeadCare,
  revokeRawLeadCare,
  getRawLeadHarvest,
  listRawLeadHarvests,
  listRawLeads,
  patchRawLead,
  pushRawLeadsToCrm,
  reclassifyRawLeadReadiness,
  recomputeRawLeadPriority,
  applyRawLeadLearning,
  mergeRawLeadAccounts,
  enrichRawLeadContacts,
  bulkAcceptRawLeads,
  fetchRawLeadBattlecard,
  type HarvestProviderOption,
  type MarketEntitiesSummary,
  type RawLead,
  type RawLeadBattlecard,
  type RawLeadCareStatus,
  type RawLeadHarvestJob,
  type RawLeadPriorityTier,
  type RawLeadReadinessStatus,
} from '@/lib/market-research-api';
import { hasCap, type StoredStaffUser } from '@/lib/auth';
import { RawLeadAcceptModal } from './RawLeadAcceptModal';
import { RawLeadBattlecardModal } from './RawLeadBattlecardModal';

const FLAG_ON =
  String(process.env.NEXT_PUBLIC_RESEARCH_RAW_LEAD_HARVEST ?? '').trim() === '1';

const READINESS_TABS: Array<{
  key: '' | RawLeadReadinessStatus;
  label: string;
}> = [
  { key: '', label: 'Tất cả' },
  { key: 'READY_TO_PUSH', label: 'Sẵn sàng push' },
  { key: 'NEEDS_REVIEW', label: 'Cần review' },
  { key: 'MISSING_CONTACT', label: 'Thiếu contact' },
  { key: 'DUPLICATE_OR_BLACKLIST', label: 'Trùng / blacklist' },
];

const PRIORITY_TABS: Array<{
  key: '' | RawLeadPriorityTier;
  label: string;
  title?: string;
}> = [
  { key: '', label: 'Ưu tiên: Tất cả' },
  {
    key: 'P1',
    label: 'P1 · Gọi ngay',
    title: 'Ưu tiên cao: READY + score ≥ 50 + có contact',
  },
  {
    key: 'P2',
    label: 'P2 · Theo dõi',
    title: 'Ưu tiên vừa: READY hoặc Cần review đã có SĐT',
  },
  {
    key: 'P3',
    label: 'P3 · Thấp',
    title: 'Ưu tiên thấp: thiếu contact / trùng / score thấp',
  },
];

const CARE_TABS: Array<{
  key: '' | RawLeadCareStatus;
  label: string;
  title?: string;
}> = [
  { key: '', label: 'Chăm sóc: Tất cả' },
  {
    key: 'awaiting_assign',
    label: 'Chờ phân công',
    title: 'Lead thô chưa giao AE',
  },
  {
    key: 'assigned',
    label: 'Đã phân công',
    title: 'Đang giao AE chăm sóc (thu hồi sau 3 ngày nếu chưa cập nhật liên lạc)',
  },
  {
    key: 'revoked',
    label: 'Thu hồi',
    title: 'Đã thu hồi — có thể phân công lại',
  },
];

const FEEDBACK_OPTS = [
  { value: 'bad_phone', label: 'Sai SĐT' },
  { value: 'bad_email', label: 'Sai email' },
  { value: 'fake_company', label: 'Công ty ảo' },
  { value: 'wrong_geo', label: 'Sai địa bàn' },
  { value: 'other', label: 'Khác' },
] as const;

const DIAL_OPTS = [
  { value: 'connected', label: 'Connected' },
  { value: 'wrong_number', label: 'Wrong number' },
  { value: 'no_answer', label: 'No answer' },
  { value: 'gatekeeper', label: 'Gatekeeper' },
  { value: 'email_bounced', label: 'Email bounced' },
  { value: 'out_of_business', label: 'Out of business' },
] as const;

/** Prefer harvest-oriented sources at the front of the chip grid. */
const HARVEST_SOURCE_PRIORITY = [
  'google_maps',
  'company_website',
  'yellow_pages',
  'industry_directory',
  'news',
  'website',
  'landing',
];

/** Recent jobs table — newest first, 3 per page. */
const JOBS_PAGE_SIZE = 3;

type Props = {
  projectId: number;
  token: string;
  user: StoredStaffUser | null;
};

function scoreBadge(score: number): string {
  if (score >= 70) return 'ok';
  if (score >= 50) return 'warn';
  return 'bad';
}

function jobStatusClass(status: string): string {
  if (status === 'succeeded') return 'job-status-done';
  if (status === 'failed') return 'job-status-dead';
  if (status === 'running' || status === 'queued') return 'job-status-pending';
  return 'job-status-running';
}

function leadStatusClass(status: string): string {
  if (status === 'accepted' || status === 'pushed') return 'rlh-status--ok';
  if (status === 'rejected' || status === 'auto_rejected') return 'rlh-status--bad';
  if (status === 'pending') return 'rlh-status--pending';
  return 'rlh-status--muted';
}

function leadStatusLabel(status: string | null | undefined): string {
  switch (String(status ?? '').trim().toLowerCase()) {
    case 'pending':
      return 'Chờ xử lý';
    case 'accepted':
      return 'Đã Accept';
    case 'rejected':
      return 'Đã từ chối';
    case 'auto_rejected':
      return 'Tự từ chối (gate)';
    case 'pushed':
      return 'Đã đẩy CRM';
    default:
      return status?.trim() ? status : '—';
  }
}

function selectPageIdsByReadiness(
  leads: RawLead[],
  readiness: RawLeadReadinessStatus,
): number[] {
  return leads
    .filter(
      (l) =>
        l.status !== 'pushed' &&
        String(l.readiness_status ?? '').toUpperCase() === readiness,
    )
    .map((l) => l.id);
}

function selectPageIdsByCare(
  leads: RawLead[],
  care: RawLeadCareStatus,
): number[] {
  return leads
    .filter(
      (l) =>
        l.status !== 'pushed' &&
        String(l.care_status ?? 'awaiting_assign') === care,
    )
    .map((l) => l.id);
}

function careStatusLabel(code: string | null | undefined): string {
  switch (String(code ?? 'awaiting_assign')) {
    case 'awaiting_assign':
      return 'Chờ phân công';
    case 'assigned':
      return 'Đã phân công';
    case 'revoked':
      return 'Thu hồi';
    default:
      return code?.trim() ? code : '—';
  }
}

function classificationLabel(code: string | null | undefined): string {
  switch (code) {
    case 'pass':
      return 'Pass';
    case 'needs_review':
      return 'Cần review';
    case 'missing_contact':
      return 'Thiếu contact';
    case 'rejected_critic':
      return 'Critic reject';
    case 'rejected_gate':
      return 'Gate reject';
    case 'rejected_blacklist':
      return 'Blacklist';
    case 'rejected_dedupe':
      return 'Trùng';
    default:
      return code?.trim() ? code : '—';
  }
}

function readinessLabel(code: string | null | undefined): string {
  switch (String(code ?? '').toUpperCase()) {
    case 'READY_TO_PUSH':
      return 'Sẵn sàng push';
    case 'NEEDS_REVIEW':
      return 'Cần review';
    case 'MISSING_CONTACT':
      return 'Thiếu contact';
    case 'DUPLICATE_OR_BLACKLIST':
      return 'Trùng / blacklist';
    default:
      return code?.trim() ? code : '—';
  }
}

function priorityBadgeClass(tier: string | null | undefined): string {
  switch (String(tier ?? '').toUpperCase()) {
    case 'P1':
      return 'rlh-priority rlh-priority--p1';
    case 'P2':
      return 'rlh-priority rlh-priority--p2';
    case 'P3':
      return 'rlh-priority rlh-priority--p3';
    default:
      return 'rlh-priority rlh-priority--unset';
  }
}

function priorityLabel(tier: string | null | undefined): string {
  switch (String(tier ?? '').toUpperCase()) {
    case 'P1':
      return 'P1 · Gọi ngay';
    case 'P2':
      return 'P2 · Theo dõi';
    case 'P3':
      return 'P3 · Thấp';
    default:
      return '—';
  }
}

function shortClusterKey(key: string | null | undefined): string {
  const raw = String(key ?? '').trim();
  if (!raw) return '';
  if (raw.length <= 22) return raw;
  return `${raw.slice(0, 10)}…${raw.slice(-8)}`;
}

function formatJobDoneMessage(job: RawLeadHarvestJob): string {
  const stats = job.stats_json ?? {};
  const inserted = Number(stats.inserted ?? job.result_count ?? 0);
  const ready = Number(stats.ready_to_push ?? 0);
  const review = Number(stats.needs_review ?? 0);
  const missing = Number(stats.missing_contact ?? 0);
  const dup = Number(stats.duplicate_or_blacklist ?? 0);
  const skipped = Number(stats.skipped_place_id ?? 0);
  const hasBreakdown = ready + review + missing + dup > 0 || skipped > 0;
  if (!hasBreakdown) {
    return `Job #${job.id} xong — ${job.result_count} lead đã insert`;
  }
  return (
    `Job #${job.id} xong — insert ${inserted}` +
    ` (ready ${ready} · review ${review} · thiếu CT ${missing} · trùng ${dup}` +
    (skipped ? ` · skip place ${skipped}` : '') +
    ')'
  );
}

function externalLink(url: string | null | undefined, label?: string) {
  const href = String(url ?? '').trim();
  if (!href) return <span className="muted">—</span>;
  return (
    <a href={href} target="_blank" rel="noreferrer" className="rlh-link">
      {label ?? href.replace(/^https?:\/\//i, '').slice(0, 36)}
    </a>
  );
}

function phoneLink(phone: string | null | undefined) {
  const p = String(phone ?? '').trim();
  if (!p) return <span className="muted">—</span>;
  return (
    <a href={`tel:${p.replace(/\s+/g, '')}`} className="rlh-link">
      {p}
    </a>
  );
}

function sortLookups(options: CrmLeadLookupOption[], priority: string[]): CrmLeadLookupOption[] {
  const rank = new Map(priority.map((k, i) => [k, i]));
  return [...options].sort((a, b) => {
    const ra = rank.has(a.option_key) ? (rank.get(a.option_key) as number) : 1000;
    const rb = rank.has(b.option_key) ? (rank.get(b.option_key) as number) : 1000;
    if (ra !== rb) return ra - rb;
    return a.label.localeCompare(b.label, 'vi');
  });
}

function ChipMultiSelect({
  options,
  selected,
  onChange,
  emptyHint,
}: {
  options: CrmLeadLookupOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  emptyHint?: string;
}) {
  if (!options.length) {
    return <p className="form-hint">{emptyHint ?? 'Chưa có option Admin.'}</p>;
  }
  return (
    <div className="rlh-chip-grid" role="group">
      {options.map((o) => {
        const on = selected.includes(o.option_key);
        return (
          <button
            key={o.option_key}
            type="button"
            className={`rlh-chip${on ? ' is-selected' : ''}`}
            aria-pressed={on}
            onClick={() =>
              onChange(
                on ? selected.filter((k) => k !== o.option_key) : [...selected, o.option_key],
              )
            }
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function RawLeadHarvestPanel({ projectId, token, user }: Props) {
  const canRun = hasCap(user, 'crm_research', 'run');
  const canExport = hasCap(user, 'crm_research', 'export') || canRun;
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const [industries, setIndustries] = useState<CrmLeadLookupOption[]>([]);
  const [titles, setTitles] = useState<CrmLeadLookupOption[]>([]);
  const [sources, setSources] = useState<CrmLeadLookupOption[]>([]);
  const [channels, setChannels] = useState<CrmLeadLookupOption[]>([]);
  const [provinces, setProvinces] = useState<VnProvinceOption[]>([]);
  const [wards, setWards] = useState<VnWardOption[]>([]);
  const [providers, setProviders] = useState<HarvestProviderOption[]>([]);

  const [industryKey, setIndustryKey] = useState('');
  const [titleKey, setTitleKey] = useState('');
  const [provinceCode, setProvinceCode] = useState('');
  const [wardCode, setWardCode] = useState('');
  const [sourceKeys, setSourceKeys] = useState<string[]>([]);
  const [channelKeys, setChannelKeys] = useState<string[]>([]);
  const [mode, setMode] = useState<
    'quality' | 'volume' | 'marketing' | 'intent' | 'market_graph'
  >('quality');
  const [provider, setProvider] = useState('');
  const [model, setModel] = useState('');
  const [crossCheck, setCrossCheck] = useState(false);
  const [targetCount, setTargetCount] = useState<number | ''>(10);
  const [notes, setNotes] = useState('');
  const [census, setCensus] = useState<MarketEntitiesSummary | null>(null);
  const isPlacesMode = mode === 'intent' || mode === 'market_graph';
  const isMarketGraph = mode === 'market_graph';

  const [jobs, setJobs] = useState<RawLeadHarvestJob[]>([]);
  const [jobsPage, setJobsPage] = useState(1);
  const [leads, setLeads] = useState<RawLead[]>([]);
  const [leadsTotal, setLeadsTotal] = useState(0);
  const [leadsTotalPages, setLeadsTotalPages] = useState(0);
  const [leadsPage, setLeadsPage] = useState(1);
  const [readinessFilter, setReadinessFilter] = useState<'' | RawLeadReadinessStatus>('');
  const [readinessCounts, setReadinessCounts] = useState<Record<string, number>>({
    ALL: 0,
    READY_TO_PUSH: 0,
    NEEDS_REVIEW: 0,
    MISSING_CONTACT: 0,
    DUPLICATE_OR_BLACKLIST: 0,
  });
  const [priorityFilter, setPriorityFilter] = useState<'' | RawLeadPriorityTier>('');
  const [priorityCounts, setPriorityCounts] = useState<Record<string, number>>({
    ALL: 0,
    P1: 0,
    P2: 0,
    P3: 0,
  });
  const [careFilter, setCareFilter] = useState<'' | RawLeadCareStatus>('');
  const [careCounts, setCareCounts] = useState<Record<string, number>>({
    all: 0,
    awaiting_assign: 0,
    assigned: 0,
    revoked: 0,
  });
  const [staffOptions, setStaffOptions] = useState<CrmStaffRow[]>([]);
  const [assignStaffId, setAssignStaffId] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [industryFilter, setIndustryFilter] = useState('');
  const [jobFilter, setJobFilter] = useState<number | ''>('');
  const [qFilter, setQFilter] = useState('');
  const [qDraft, setQDraft] = useState('');
  const [hasPhoneOnly, setHasPhoneOnly] = useState(false);
  const [hasContactOnly, setHasContactOnly] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [activeJobId, setActiveJobId] = useState<number | null>(null);
  const [acceptLead, setAcceptLead] = useState<RawLead | null>(null);
  const [acceptBulkIds, setAcceptBulkIds] = useState<number[] | null>(null);
  const [battlecard, setBattlecard] = useState<RawLeadBattlecard | null>(null);
  const [battlecardOpen, setBattlecardOpen] = useState(false);
  const [battlecardLoading, setBattlecardLoading] = useState(false);
  const [battlecardError, setBattlecardError] = useState('');

  const openBattlecard = useCallback(
    async (leadId: number) => {
      setBattlecardOpen(true);
      setBattlecard(null);
      setBattlecardError('');
      setBattlecardLoading(true);
      try {
        const card = await fetchRawLeadBattlecard(token, projectId, leadId);
        setBattlecard(card);
      } catch (err) {
        setBattlecardError(
          err instanceof Error ? err.message : 'Không tải được battlecard',
        );
      } finally {
        setBattlecardLoading(false);
      }
    },
    [token, projectId],
  );

  const industriesInLeads = useMemo(() => {
    const map = new Map<string, string>();
    for (const j of jobs) {
      if (j.industry_key) map.set(j.industry_key, j.industry_label || j.industry_key);
    }
    return Array.from(map.entries())
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'vi'));
  }, [jobs]);

  const selectedProvider = useMemo(
    () => providers.find((p) => p.code === provider) ?? null,
    [providers, provider],
  );
  const canCrossCheck = providers.filter((p) => p.configured).length >= 2;
  const sortedSources = useMemo(
    () => sortLookups(sources, HARVEST_SOURCE_PRIORITY),
    [sources],
  );

  const pendingCount = useMemo(
    () => leads.filter((l) => l.status === 'pending').length,
    [leads],
  );
  const acceptedCount = useMemo(
    () => leads.filter((l) => l.status === 'accepted' || l.status === 'pushed').length,
    [leads],
  );

  const jobsTotalPages = useMemo(
    () => Math.max(1, Math.ceil(jobs.length / JOBS_PAGE_SIZE)),
    [jobs.length],
  );
  const jobsPageSafe = Math.min(jobsPage, jobsTotalPages);
  const pagedJobs = useMemo(() => {
    const start = (jobsPageSafe - 1) * JOBS_PAGE_SIZE;
    return jobs.slice(start, start + JOBS_PAGE_SIZE);
  }, [jobs, jobsPageSafe]);

  useEffect(() => {
    if (jobsPage > jobsTotalPages) setJobsPage(jobsTotalPages);
  }, [jobsPage, jobsTotalPages]);

  const reloadMeta = useCallback(async () => {
    const [ind, tit, src, ch, prov, harvestProv, staffOut] = await Promise.all([
      fetchCrmLeadLookups(token, { kind: 'industry', active_only: true }),
      fetchCrmLeadLookups(token, { kind: 'job_title', active_only: true }),
      fetchCrmLeadLookups(token, { kind: 'source', active_only: true }),
      fetchCrmLeadLookups(token, { kind: 'channel', active_only: true }),
      fetchVnProvinces(token),
      fetchRawLeadHarvestProviders(token),
      fetchCrmStaffList(token).catch(() => ({ staff: [] as CrmStaffRow[], summary: {} })),
    ]);
    setIndustries(ind.options);
    setTitles(tit.options);
    setSources(src.options);
    setChannels(ch.options);
    setProvinces(prov);
    setProviders(harvestProv.providers.filter((p) => p.configured));
    setStaffOptions(
      (staffOut.staff ?? []).filter((s) => s.active !== 0 && s.can_receive_leads !== false),
    );
  }, [token]);

  const reloadJobsAndLeads = useCallback(async () => {
    const [j, l, countsOut, priorityOut, careOut] = await Promise.all([
      listRawLeadHarvests(token, projectId),
      listRawLeads(token, projectId, {
        page: leadsPage,
        page_size: 50,
        status: statusFilter || undefined,
        readiness_status: readinessFilter || undefined,
        priority_tier: priorityFilter || undefined,
        care_status: careFilter || undefined,
        industry_key: industryFilter || undefined,
        job_id: jobFilter === '' ? undefined : Number(jobFilter),
        q: qFilter || undefined,
        has_phone: hasPhoneOnly || undefined,
        has_contact: hasContactOnly || undefined,
        include_auto_rejected:
          !statusFilter ||
          Boolean(readinessFilter) ||
          Boolean(priorityFilter) ||
          Boolean(careFilter) ||
          Boolean(industryFilter),
      }),
      fetchRawLeadReadinessCounts(token, projectId).catch(() => ({ counts: {} })),
      fetchRawLeadPriorityCounts(token, projectId).catch(() => ({ counts: {} })),
      fetchRawLeadCareCounts(token, projectId).catch(() => ({ counts: {} })),
    ]);
    setJobs(j.jobs);
    setLeads(l.leads);
    setLeadsTotal(l.total);
    setLeadsTotalPages(l.total_pages);
    setReadinessCounts((prev) => ({ ...prev, ...(countsOut.counts ?? {}) }));
    setPriorityCounts((prev) => ({ ...prev, ...(priorityOut.counts ?? {}) }));
    setCareCounts((prev) => ({ ...prev, ...(careOut.counts ?? {}) }));
  }, [
    token,
    projectId,
    leadsPage,
    statusFilter,
    readinessFilter,
    priorityFilter,
    careFilter,
    industryFilter,
    jobFilter,
    qFilter,
    hasPhoneOnly,
    hasContactOnly,
  ]);

  useEffect(() => {
    if (!FLAG_ON) return;
    void (async () => {
      try {
        await reloadMeta();
        await reloadJobsAndLeads();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Không tải được harvest');
      }
    })();
  }, [reloadMeta, reloadJobsAndLeads]);

  useEffect(() => {
    if (!provinceCode) {
      setWards([]);
      setWardCode('');
      return;
    }
    void fetchVnWards(token, provinceCode).then(setWards).catch(() => setWards([]));
  }, [provinceCode, token]);

  useEffect(() => {
    if (!selectedProvider) {
      setModel('');
      return;
    }
    setModel(selectedProvider.default_model ?? selectedProvider.models[0]?.id ?? '');
  }, [selectedProvider]);

  useEffect(() => {
    if (!isMarketGraph || !industryKey || !provinceCode || provinceCode === 'all') {
      setCensus(null);
      return;
    }
    let cancelled = false;
    void fetchMarketEntitiesSummary(token, {
      industry_key: industryKey,
      province_code: provinceCode,
    })
      .then((row) => {
        if (!cancelled) setCensus(row);
      })
      .catch(() => {
        if (!cancelled) setCensus(null);
      });
    return () => {
      cancelled = true;
    };
  }, [isMarketGraph, industryKey, provinceCode, token, jobs]);

  useEffect(() => {
    if (!activeJobId) return;
    const timer = setInterval(() => {
      void (async () => {
        try {
          const job = await getRawLeadHarvest(token, projectId, activeJobId);
          if (job.status === 'succeeded' || job.status === 'failed') {
            setActiveJobId(null);
            setMsg(
              job.status === 'succeeded'
                ? formatJobDoneMessage(job)
                : `Job #${job.id} lỗi: ${job.error_message ?? 'failed'}`,
            );
            await reloadJobsAndLeads();
          }
        } catch {
          /* ignore poll errors */
        }
      })();
    }, 3000);
    return () => clearInterval(timer);
  }, [activeJobId, token, projectId, reloadJobsAndLeads]);

  if (!FLAG_ON) {
    return (
      <p className="muted">
        Raw Lead Harvest đang tắt. Bật <code>NEXT_PUBLIC_RESEARCH_RAW_LEAD_HARVEST=1</code>.
      </p>
    );
  }

  return (
    <div className="rlh-panel">
      <div className="rlh-callout">
        <strong>Lead thô — phân loại readiness RSR</strong>
        <span>
          Job Places insert hết place (trừ trùng place_id). Chỉ push CRM khi tab Sẵn sàng push /
          READY_TO_PUSH.
        </span>
      </div>

      {error ? <p className="error">{error}</p> : null}
      {msg ? <p className="ok">{msg}</p> : null}

      <section className="kpi-card rlh-card">
        <div className="rlh-card__head">
          <div>
            <h3 className="kpi-section-title">Tạo job thu thập</h3>
            <p className="form-hint">ICP → nguồn search → AI provider → chạy async.</p>
          </div>
          {activeJobId ? (
            <span className="job-status-pill job-status-pending">Đang chạy #{activeJobId}</span>
          ) : null}
        </div>

        {!canRun ? (
          <p className="muted">Cần quyền <code>crm_research.run</code></p>
        ) : (
          <form
            className="rlh-form"
            onSubmit={(e) => {
              e.preventDefault();
              void (async () => {
                setBusy(true);
                setError('');
                setMsg('');
                try {
                  const count =
                    typeof targetCount === 'number' && Number.isFinite(targetCount)
                      ? targetCount
                      : NaN;
                  if (!Number.isInteger(count) || count < 1) {
                    setError('Số lượng phải là số nguyên ≥ 1');
                    setBusy(false);
                    return;
                  }
                  if (mode === 'intent' || mode === 'market_graph') {
                    if (!provinceCode || provinceCode === 'all') {
                      setError(
                        mode === 'market_graph'
                          ? 'Mode Market Graph bắt buộc chọn Tỉnh/TP cụ thể (không chọn Tất cả)'
                          : 'Mode Intent bắt buộc chọn Tỉnh/TP cụ thể (không chọn Tất cả)',
                      );
                      setBusy(false);
                      return;
                    }
                  } else if (!provider || !model) {
                    setError('Chọn Provider và Model AI');
                    setBusy(false);
                    return;
                  }
                  let keys = sourceKeys;
                  if (isPlacesMode && keys.length === 0) {
                    const gm = sources.find((s) => s.option_key === 'google_maps');
                    if (gm) keys = ['google_maps'];
                  }
                  if (keys.length === 0) {
                    setError('Chọn ít nhất 1 nguồn');
                    setBusy(false);
                    return;
                  }
                  const out = await createRawLeadHarvest(token, projectId, {
                    industry_key: industryKey,
                    job_title_key: titleKey || null,
                    province_code: provinceCode || null,
                    ward_code: provinceCode && wardCode ? wardCode : null,
                    source_keys: keys,
                    channel_keys: channelKeys,
                    provider: isPlacesMode ? undefined : provider,
                    model: isPlacesMode ? undefined : model,
                    mode,
                    cross_check: !isPlacesMode && canCrossCheck && crossCheck,
                    target_count: count,
                    scan_cap: isPlacesMode ? count : undefined,
                    notes: notes || undefined,
                  });
                  setActiveJobId(out.job_id);
                  setMsg(`Đã xếp hàng job #${out.job_id}`);
                  await reloadJobsAndLeads();
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Tạo job thất bại');
                } finally {
                  setBusy(false);
                }
              })();
            }}
          >
            <div className="rlh-section">
              <h4 className="rlh-section__title">1. ICP & địa bàn</h4>
              <div className="form-grid form-grid--2">
                <label className="form-field">
                  <span className="form-label">
                    Ngành <span className="form-required">*</span>
                  </span>
                  <select
                    value={industryKey}
                    onChange={(e) => setIndustryKey(e.target.value)}
                    required
                  >
                    <option value="">Chọn ngành…</option>
                    {industries.map((o) => (
                      <option key={o.option_key} value={o.option_key}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="form-field">
                  <span className="form-label">Chức danh</span>
                  <select
                    value={titleKey}
                    onChange={(e) => setTitleKey(e.target.value)}
                  >
                    <option value="">Tất cả</option>
                    {titles.map((o) => (
                      <option key={o.option_key} value={o.option_key}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="form-field">
                  <span className="form-label">Tỉnh/TP</span>
                  <select
                    value={provinceCode}
                    onChange={(e) => {
                      setProvinceCode(e.target.value);
                      setWardCode('');
                    }}
                  >
                    <option value="">Tất cả</option>
                    {provinces.map((p) => (
                      <option key={p.code} value={p.code}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="form-field">
                  <span className="form-label">Phường/Xã</span>
                  <select
                    value={wardCode}
                    onChange={(e) => setWardCode(e.target.value)}
                    disabled={!provinceCode}
                  >
                    <option value="">Tất cả</option>
                    {wards.map((w) => (
                      <option key={w.code} value={w.code}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <div className="rlh-section">
              <div className="rlh-section__head">
                <h4 className="rlh-section__title">
                  2. Nguồn search <span className="form-required">*</span>
                </h4>
                <span className="rlh-count">{sourceKeys.length} đã chọn</span>
              </div>
              <p className="form-hint">Ưu tiên Maps / website / directory — chọn ≥1.</p>
              <ChipMultiSelect
                options={sortedSources}
                selected={sourceKeys}
                onChange={setSourceKeys}
              />
            </div>

            <div className="rlh-section">
              <div className="rlh-section__head">
                <h4 className="rlh-section__title">3. Kênh (tuỳ chọn)</h4>
                <span className="rlh-count">{channelKeys.length} đã chọn</span>
              </div>
              <ChipMultiSelect options={channels} selected={channelKeys} onChange={setChannelKeys} />
            </div>

            <div className="rlh-section">
              <h4 className="rlh-section__title">4. AI & chế độ</h4>
              <div className="form-grid form-grid--2">
                <label className="form-field">
                  <span className="form-label">Chế độ</span>
                  <select
                    value={mode}
                    onChange={(e) => {
                      const next = e.target.value as
                        | 'quality'
                        | 'volume'
                        | 'marketing'
                        | 'intent'
                        | 'market_graph';
                      setMode(next);
                      if (
                        (next === 'intent' || next === 'market_graph') &&
                        (!targetCount || targetCount < 50)
                      ) {
                        setTargetCount(100);
                      }
                    }}
                  >
                    <option value="quality">Quality — ít lead, chặt hơn</option>
                    <option value="volume">Volume — nhiều hơn, rủi ro ảo</option>
                    <option value="marketing">
                      Marketing — web/FB lấy SĐT + email (AM gửi MKT, không verify email)
                    </option>
                    <option value="intent">
                      Intent — Places insert-all + readiness RSR
                    </option>
                    <option value="market_graph">
                      All thị trường — census + diff (Places grid)
                    </option>
                  </select>
                </label>
                <label className="form-field">
                  <span className="form-label">
                    {isPlacesMode ? 'Scan cap (max place)' : 'Số lượng'}
                  </span>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    inputMode="numeric"
                    value={targetCount}
                    onChange={(e) => {
                      const raw = e.target.value;
                      // Allow empty while editing — Number('') === 0 would trap the digit 0.
                      if (raw === '') {
                        setTargetCount('');
                        return;
                      }
                      const n = Number(raw);
                      if (Number.isFinite(n)) setTargetCount(n);
                    }}
                    required
                  />
                  {isPlacesMode ? (
                    <span className="form-hint">
                      Giới hạn số place discover — insert hết (trừ trùng place_id), không cắt theo
                      pending.
                    </span>
                  ) : null}
                </label>
                {!isPlacesMode ? (
                  <>
                    <label className="form-field">
                      <span className="form-label">
                        Provider <span className="form-required">*</span>
                      </span>
                      <select
                        value={provider}
                        onChange={(e) => setProvider(e.target.value)}
                        required
                      >
                        <option value="">Chọn provider…</option>
                        {providers.map((p) => (
                          <option key={p.code} value={p.code}>
                            {p.display_name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="form-field">
                      <span className="form-label">
                        Model <span className="form-required">*</span>
                      </span>
                      <select value={model} onChange={(e) => setModel(e.target.value)} required>
                        <option value="">Chọn model…</option>
                        {(selectedProvider?.models ?? []).map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </>
                ) : (
                  <p className="muted form-field form-field--full" style={{ margin: 0 }}>
                    {isMarketGraph ? (
                      <>
                        Market Graph dùng <strong>Google Places</strong> (grid quận HCM) + census
                        diff — không cần Provider/Model AI. Chỉ tạo lead từ DN <em>mới / đổi
                        SĐT·web</em>.
                      </>
                    ) : (
                      <>
                        Intent dùng <strong>Google Places API</strong> — insert tất cả place vào
                        Lead thô, gắn readiness RSR. Bắt buộc chọn Tỉnh/TP cụ thể.
                      </>
                    )}
                  </p>
                )}
                <label className="form-field form-field--full">
                  <span className="form-label">Ghi chú ICP</span>
                  <textarea
                    value={notes}
                    maxLength={500}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    placeholder="VD: spa cao cấp Quận 1–3, chủ hoặc marketing director…"
                  />
                </label>
              </div>

              {mode === 'volume' ? (
                <p className="rlh-inline-warn">
                  Volume tăng nguy cơ lead yếu/ảo — chỉ dùng để thăm dò.
                </p>
              ) : null}
              {mode === 'marketing' ? (
                <p className="rlh-inline-warn">
                  Marketing: scrape SĐT/email từ website + /lien-he; ưu tiên SME địa phương.
                  Thiếu contact vẫn giữ pending để review — AM gửi MKT khi có email/SĐT.
                </p>
              ) : null}
              {mode === 'intent' ? (
                <p className="rlh-inline-warn">
                  Intent: Places Text Search → Place Details → insert Lead thô (skip chỉ trùng
                  place_id) → classify READY / REVIEW / MISSING / DUP. CRM chỉ khi Push từ
                  READY_TO_PUSH. Cần PTT_RESEARCH_HARVEST_INTENT=1 + PTT_GOOGLE_PLACES_API_KEY.
                </p>
              ) : null}
              {mode === 'market_graph' ? (
                <>
                  <p className="rlh-inline-warn">
                    Market Graph: census Places (grid quận) → upsert → chỉ lead từ new/updated +
                    white-space. Flag PTT_RESEARCH_HARVEST_MARKET_GRAPH=1 + Places key.
                  </p>
                  {census ? (
                    <p className="form-hint" style={{ marginTop: '0.35rem' }}>
                      Census: <strong>{census.total}</strong> DN ·{' '}
                      <strong>{census.with_phone}</strong> có SĐT · last_seen{' '}
                      {census.last_seen_at
                        ? new Date(census.last_seen_at).toLocaleString('vi-VN')
                        : '—'}
                    </p>
                  ) : industryKey && provinceCode && provinceCode !== 'all' ? (
                    <p className="form-hint" style={{ marginTop: '0.35rem' }}>
                      Census: chưa có dữ liệu — chạy job lần đầu để dựng.
                    </p>
                  ) : null}
                </>
              ) : null}

              {canCrossCheck && !isPlacesMode ? (
                <label className="form-check rlh-crosscheck">
                  <input
                    type="checkbox"
                    checked={crossCheck}
                    onChange={(e) => setCrossCheck(e.target.checked)}
                  />
                  Cross-check 2 provider (top N — tốn thêm API)
                </label>
              ) : !isPlacesMode ? (
                <p className="form-hint">
                  Cross-check cần ≥2 Research AI provider đã cấu hình token.
                </p>
              ) : null}
            </div>

            <div className="rlh-form__footer">
              <button
                type="submit"
                className="btn"
                disabled={
                  busy ||
                  Boolean(activeJobId) ||
                  (!isPlacesMode && sourceKeys.length < 1)
                }
              >
                {activeJobId ? `Đang chạy job #${activeJobId}…` : 'Chạy thu thập'}
              </button>
              {!isPlacesMode && sourceKeys.length < 1 ? (
                <span className="form-hint">Chọn ít nhất 1 nguồn search.</span>
              ) : null}
            </div>
          </form>
        )}
      </section>

      <section className="kpi-card rlh-card">
        <div className="rlh-card__head">
          <h3 className="kpi-section-title">Jobs gần đây</h3>
          <span className="rlh-count">{jobs.length}</span>
        </div>
        {jobs.length === 0 ? (
          <div className="rlh-empty">Chưa có job — tạo job phía trên để bắt đầu.</div>
        ) : (
          <>
            <div className="data-table-wrap">
              <table className="data-table data-table--dense">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Status</th>
                    <th>Filter</th>
                    <th>Provider / Model</th>
                    <th>Kết quả</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedJobs.map((j) => (
                    <tr key={j.id}>
                      <td>#{j.id}</td>
                      <td>
                        <span className={`job-status-pill ${jobStatusClass(j.status)}`}>
                          {j.status}
                        </span>
                      </td>
                      <td>
                        <div className="rlh-filter-cell">
                          <strong>
                            {j.industry_label} · {j.job_title_label}
                          </strong>
                          <span className="muted">{j.province_name}</span>
                        </div>
                      </td>
                      <td>
                        <code className="rlh-mono">
                          {j.mode === 'intent'
                            ? 'places/intent'
                            : j.mode === 'market_graph'
                              ? 'places/market_graph'
                              : `${j.provider}/${j.model}`}
                        </code>
                        <div className="muted rlh-sub">{j.mode}</div>
                      </td>
                      <td>
                        <strong>{j.result_count}</strong>
                        <span className="muted"> inserted</span>
                        {j.stats_json && typeof j.stats_json.discovered === 'number' ? (
                          <div className="muted rlh-sub">
                            scan {String(j.stats_json.discovered)}
                            {typeof j.stats_json.ready_to_push === 'number'
                              ? ` · ready ${String(j.stats_json.ready_to_push)} · review ${String(j.stats_json.needs_review ?? 0)} · thiếu ${String(j.stats_json.missing_contact ?? 0)}`
                              : ` · pending ${String(j.stats_json.pending ?? '—')}`}
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div
              className="rlh-pager"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                marginTop: '0.75rem',
                flexWrap: 'wrap',
              }}
            >
              <span className="form-hint" style={{ margin: 0 }}>
                Trang {jobsPageSafe}/{jobsTotalPages} · {jobs.length} job · {JOBS_PAGE_SIZE}/trang
              </span>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={jobsPageSafe <= 1}
                onClick={() => setJobsPage((p) => Math.max(1, p - 1))}
              >
                Prev
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={jobsPageSafe >= jobsTotalPages}
                onClick={() => setJobsPage((p) => Math.min(jobsTotalPages, p + 1))}
              >
                Next
              </button>
            </div>
          </>
        )}
      </section>

      <section className="kpi-card rlh-card">
        <div className="rlh-card__head">
          <div>
            <h3 className="kpi-section-title">Lead thô</h3>
            <p className="form-hint">
              {leadsTotal} lead · trang {leadsPage}/{leadsTotalPages || 0} ·{' '}
              {pendingCount} chờ xử lý (trang) · {acceptedCount} đã Accept/đẩy CRM (trang)
              {selectedIds.length ? ` · ${selectedIds.length} đang chọn` : ''}
              {readinessFilter === 'NEEDS_REVIEW'
                ? ' · Accept để chuyển Sẵn sàng push'
                : readinessFilter === 'MISSING_CONTACT'
                  ? ' · Bổ sung contact (Places + scrape) rồi phân loại lại'
                  : ''}
            </p>
          </div>
          <div className="rlh-toolbar">
            {canRun ? (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={busy}
                title={
                  selectedIds.length
                    ? 'Bổ sung SĐT/email cho lead đang chọn (Places + scrape)'
                    : 'Bổ sung contact cho tab Thiếu contact (tối đa 50)'
                }
                onClick={() => {
                  void (async () => {
                    setBusy(true);
                    setError('');
                    try {
                      const out = await enrichRawLeadContacts(token, projectId, {
                        lead_ids: selectedIds.length ? selectedIds : undefined,
                        only_missing_contact:
                          selectedIds.length > 0
                            ? false
                            : readinessFilter === 'MISSING_CONTACT' || !readinessFilter,
                        job_id: jobFilter === '' ? undefined : Number(jobFilter),
                        limit: 50,
                      });
                      setMsg(
                        `Bổ sung contact: ${out.enriched} cập nhật` +
                          `, ${out.unchanged} giữ nguyên` +
                          (out.failed ? `, ${out.failed} lỗi` : '') +
                          ` · ready ${out.counts.READY_TO_PUSH ?? 0}` +
                          ` · review ${out.counts.NEEDS_REVIEW ?? 0}` +
                          ` · thiếu ${out.counts.MISSING_CONTACT ?? 0}`,
                      );
                      if (out.readiness_counts) {
                        setReadinessCounts((prev) => ({ ...prev, ...out.readiness_counts }));
                      }
                      setSelectedIds([]);
                      await reloadJobsAndLeads();
                    } catch (err) {
                      setError(
                        err instanceof Error ? err.message : 'Bổ sung contact thất bại',
                      );
                    } finally {
                      setBusy(false);
                    }
                  })();
                }}
              >
                Bổ sung contact
                {selectedIds.length ? ` (${selectedIds.length})` : ''}
              </button>
            ) : null}
            {canRun ? (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={busy}
                title={
                  selectedIds.length
                    ? 'Phân loại lại các lead đang chọn'
                    : 'Phân loại lại lead chưa có readiness (UNCLASSIFIED)'
                }
                onClick={() => {
                  void (async () => {
                    setBusy(true);
                    setError('');
                    try {
                      const out = await reclassifyRawLeadReadiness(token, projectId, {
                        only_unclassified: selectedIds.length === 0,
                        force: selectedIds.length > 0,
                        lead_ids: selectedIds.length ? selectedIds : undefined,
                        job_id: jobFilter === '' ? undefined : Number(jobFilter),
                      });
                      setMsg(
                        `Phân loại lại: ${out.updated} cập nhật` +
                          (out.skipped ? `, ${out.skipped} bỏ qua` : '') +
                          ` · ready ${out.counts.READY_TO_PUSH ?? 0}` +
                          ` · review ${out.counts.NEEDS_REVIEW ?? 0}` +
                          ` · thiếu ${out.counts.MISSING_CONTACT ?? 0}` +
                          ` · trùng ${out.counts.DUPLICATE_OR_BLACKLIST ?? 0}`,
                      );
                      setSelectedIds([]);
                      await reloadJobsAndLeads();
                    } catch (err) {
                      setError(err instanceof Error ? err.message : 'Phân loại lại thất bại');
                    } finally {
                      setBusy(false);
                    }
                  })();
                }}
              >
                Phân loại lại
                {selectedIds.length ? ` (${selectedIds.length})` : ''}
              </button>
            ) : null}
            {canRun ? (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={busy}
                title={
                  selectedIds.length
                    ? 'Tính cluster + P1/P2/P3 cho lead đang chọn'
                    : 'Tính cluster + ưu tiên P1/P2/P3 cho lead trong project'
                }
                onClick={() => {
                  void (async () => {
                    setBusy(true);
                    setError('');
                    try {
                      const out = await recomputeRawLeadPriority(token, projectId, {
                        lead_ids: selectedIds.length ? selectedIds : undefined,
                        job_id: jobFilter === '' ? undefined : Number(jobFilter),
                      });
                      setMsg(
                        `Tính ưu tiên: ${out.updated} lead` +
                          ` · P1 ${out.counts.P1 ?? 0}` +
                          ` · P2 ${out.counts.P2 ?? 0}` +
                          ` · P3 ${out.counts.P3 ?? 0}`,
                      );
                      if (out.priority_counts) {
                        setPriorityCounts((prev) => ({ ...prev, ...out.priority_counts }));
                      }
                      setSelectedIds([]);
                      await reloadJobsAndLeads();
                    } catch (err) {
                      setError(err instanceof Error ? err.message : 'Tính ưu tiên thất bại');
                    } finally {
                      setBusy(false);
                    }
                  })();
                }}
              >
                Tính ưu tiên
                {selectedIds.length ? ` (${selectedIds.length})` : ''}
              </button>
            ) : null}
            {canRun ? (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={busy}
                title={
                  selectedIds.length
                    ? 'Áp dụng học từ dial/feedback cho lead đang chọn'
                    : 'Áp dụng học từ dial/feedback → chỉnh score + ưu tiên'
                }
                onClick={() => {
                  void (async () => {
                    setBusy(true);
                    setError('');
                    try {
                      const out = await applyRawLeadLearning(token, projectId, {
                        lead_ids: selectedIds.length ? selectedIds : undefined,
                        job_id: jobFilter === '' ? undefined : Number(jobFilter),
                      });
                      setMsg(
                        `Học dial: ${out.updated} cập nhật` +
                          (out.skipped ? `, ${out.skipped} bỏ qua` : '') +
                          ` · ↑${out.counts.boosted ?? 0}` +
                          ` · ↓${out.counts.demoted ?? 0}` +
                          ` · =${out.counts.unchanged ?? 0}`,
                      );
                      if (out.priority_counts) {
                        setPriorityCounts((prev) => ({ ...prev, ...out.priority_counts }));
                      }
                      setSelectedIds([]);
                      await reloadJobsAndLeads();
                    } catch (err) {
                      setError(err instanceof Error ? err.message : 'Áp dụng học dial thất bại');
                    } finally {
                      setBusy(false);
                    }
                  })();
                }}
              >
                Áp dụng học dial
                {selectedIds.length ? ` (${selectedIds.length})` : ''}
              </button>
            ) : null}
            {canRun ? (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={busy}
                title={
                  selectedIds.length
                    ? 'Gộp Account research từ global key cho lead đang chọn'
                    : 'Gộp Account research (place/phone/domain) trong project'
                }
                onClick={() => {
                  void (async () => {
                    setBusy(true);
                    setError('');
                    try {
                      const out = await mergeRawLeadAccounts(token, projectId, {
                        lead_ids: selectedIds.length ? selectedIds : undefined,
                        job_id: jobFilter === '' ? undefined : Number(jobFilter),
                      });
                      setMsg(
                        `Gộp Account: ${out.updated} lead` +
                          ` · ${out.accounts} account` +
                          (out.skipped ? ` · ${out.skipped} bỏ qua` : ''),
                      );
                      setSelectedIds([]);
                      await reloadJobsAndLeads();
                    } catch (err) {
                      setError(err instanceof Error ? err.message : 'Gộp Account thất bại');
                    } finally {
                      setBusy(false);
                    }
                  })();
                }}
              >
                Gộp Account
                {selectedIds.length ? ` (${selectedIds.length})` : ''}
              </button>
            ) : null}
            {canExport ? (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={busy}
                onClick={() => {
                  void (async () => {
                    setBusy(true);
                    setError('');
                    try {
                      const out = await exportRawLeads(
                        token,
                        projectId,
                        selectedIds.length ? { lead_ids: selectedIds } : {},
                      );
                      const blob = new Blob([out.csv], { type: 'text/csv;charset=utf-8' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `raw-leads-${projectId}.csv`;
                      a.click();
                      URL.revokeObjectURL(url);
                      setMsg(`Đã export ${out.count} dòng`);
                    } catch (err) {
                      setError(err instanceof Error ? err.message : 'Export thất bại');
                    } finally {
                      setBusy(false);
                    }
                  })();
                }}
              >
                Export CSV
              </button>
            ) : null}
            {canRun ? (
              <button
                type="button"
                className="btn btn-sm"
                disabled={
                  busy ||
                  selectedIds.length === 0 ||
                  (readinessFilter !== '' && readinessFilter !== 'READY_TO_PUSH')
                }
                title={
                  readinessFilter && readinessFilter !== 'READY_TO_PUSH'
                    ? 'Chỉ push được lead READY_TO_PUSH'
                    : undefined
                }
                onClick={() => {
                  void (async () => {
                    setBusy(true);
                    setError('');
                    try {
                      const pushIds =
                        readinessFilter === 'READY_TO_PUSH'
                          ? selectedIds
                          : selectedIds.filter((id) => {
                              const lead = leads.find((l) => l.id === id);
                              return (
                                !lead?.readiness_status ||
                                lead.readiness_status === 'READY_TO_PUSH' ||
                                (!lead.readiness_status && lead.status === 'accepted')
                              );
                            });
                      if (!pushIds.length) {
                        setError('Không có lead READY_TO_PUSH trong selection');
                        setBusy(false);
                        return;
                      }
                      const out = await pushRawLeadsToCrm(token, projectId, pushIds);
                      setMsg(
                        `Push CRM: ${out.pushed.length} OK` +
                          (out.errors.length ? `, ${out.errors.length} lỗi` : ''),
                      );
                      if (out.errors[0]) {
                        setError(`${out.errors[0].raw_lead_id}: ${out.errors[0].error}`);
                      }
                      setSelectedIds([]);
                      await reloadJobsAndLeads();
                    } catch (err) {
                      setError(err instanceof Error ? err.message : 'Push CRM thất bại');
                    } finally {
                      setBusy(false);
                    }
                  })();
                }}
              >
                Push CRM ({selectedIds.length})
              </button>
            ) : null}
            {canRun ? (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={busy || selectedIds.length === 0}
                title="Accept hàng loạt (NEEDS_REVIEW → READY)"
                onClick={() => setAcceptBulkIds(selectedIds)}
              >
                Accept đã chọn ({selectedIds.length})
              </button>
            ) : null}
            {canRun ? (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={busy || leads.length === 0}
                onClick={() =>
                  setSelectedIds(selectPageIdsByReadiness(leads, 'READY_TO_PUSH'))
                }
              >
                Chọn Ready (trang)
              </button>
            ) : null}
            {canRun ? (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={busy || leads.length === 0}
                onClick={() =>
                  setSelectedIds(selectPageIdsByReadiness(leads, 'NEEDS_REVIEW'))
                }
              >
                Chọn Review (trang)
              </button>
            ) : null}
            {canRun ? (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={busy || leads.length === 0}
                onClick={() =>
                  setSelectedIds(selectPageIdsByCare(leads, 'awaiting_assign'))
                }
              >
                Chọn chờ PC (trang)
              </button>
            ) : null}
            {canRun ? (
              <span className="rlh-assign-row">
                <select
                  aria-label="AE nhận phân công"
                  value={assignStaffId}
                  disabled={busy}
                  onChange={(e) => setAssignStaffId(e.target.value)}
                  style={{ maxWidth: 180 }}
                >
                  <option value="">Chọn AE…</option>
                  {staffOptions.map((s) => (
                    <option key={s.id} value={String(s.id)}>
                      {s.name || s.email || `#${s.id}`}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={busy || !assignStaffId || selectedIds.length === 0}
                  title="Phân công chăm sóc các lead đang chọn"
                  onClick={() => {
                    void (async () => {
                      const toStaff = Number(assignStaffId);
                      if (!(toStaff > 0) || !selectedIds.length) return;
                      setBusy(true);
                      setError('');
                      try {
                        const out = await assignRawLeadCare(token, projectId, {
                          lead_ids: selectedIds,
                          to_staff_id: toStaff,
                        });
                        setMsg(
                          `Phân công: ${out.updated}/${out.requested} lead → AE #${out.to_staff_id}`,
                        );
                        setSelectedIds([]);
                        await reloadJobsAndLeads();
                      } catch (err) {
                        setError(
                          err instanceof Error ? err.message : 'Phân công thất bại',
                        );
                      } finally {
                        setBusy(false);
                      }
                    })();
                  }}
                >
                  Phân công ({selectedIds.length})
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={busy || !assignStaffId}
                  title="Phân công tất cả lead chờ phân công / thu hồi trong project"
                  onClick={() => {
                    void (async () => {
                      const toStaff = Number(assignStaffId);
                      if (!(toStaff > 0)) return;
                      if (
                        !window.confirm(
                          'Phân công TẤT CẢ lead chờ phân công/thu hồi trong project này cho AE đã chọn?',
                        )
                      ) {
                        return;
                      }
                      setBusy(true);
                      setError('');
                      try {
                        const out = await assignRawLeadCare(token, projectId, {
                          to_staff_id: toStaff,
                          all_awaiting: true,
                        });
                        setMsg(
                          `Phân công tất cả: ${out.updated}/${out.requested} lead → AE #${out.to_staff_id}`,
                        );
                        setSelectedIds([]);
                        await reloadJobsAndLeads();
                      } catch (err) {
                        setError(
                          err instanceof Error ? err.message : 'Phân công tất cả thất bại',
                        );
                      } finally {
                        setBusy(false);
                      }
                    })();
                  }}
                >
                  Phân công tất cả chờ PC
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={busy || selectedIds.length === 0}
                  title="Thu hồi phân công các lead đang chọn"
                  onClick={() => {
                    void (async () => {
                      if (!selectedIds.length) return;
                      setBusy(true);
                      setError('');
                      try {
                        const out = await revokeRawLeadCare(token, projectId, {
                          lead_ids: selectedIds,
                        });
                        setMsg(`Thu hồi: ${out.updated} lead`);
                        setSelectedIds([]);
                        await reloadJobsAndLeads();
                      } catch (err) {
                        setError(
                          err instanceof Error ? err.message : 'Thu hồi thất bại',
                        );
                      } finally {
                        setBusy(false);
                      }
                    })();
                  }}
                >
                  Thu hồi ({selectedIds.length})
                </button>
              </span>
            ) : null}
          </div>
        </div>

        <div className="rlh-tabs" role="tablist" aria-label="Readiness">
          {READINESS_TABS.map((tab) => {
            const countKey = tab.key || 'ALL';
            const count = Number(readinessCounts[countKey] ?? 0);
            const active = readinessFilter === tab.key;
            return (
              <button
                key={tab.key || 'ALL'}
                type="button"
                role="tab"
                aria-selected={active}
                className={`rlh-tab${active ? ' is-active' : ''}`}
                onClick={() => {
                  setReadinessFilter(tab.key);
                  setLeadsPage(1);
                  setSelectedIds([]);
                }}
              >
                {tab.label}
                <span className="rlh-tab__count">{count}</span>
              </button>
            );
          })}
        </div>

        <div className="rlh-tabs rlh-tabs--priority" role="tablist" aria-label="Ưu tiên">
          {PRIORITY_TABS.map((tab) => {
            const countKey = tab.key || 'ALL';
            const count = Number(priorityCounts[countKey] ?? 0);
            const active = priorityFilter === tab.key;
            return (
              <button
                key={tab.key || 'ALL'}
                type="button"
                role="tab"
                aria-selected={active}
                className={`rlh-tab${active ? ' is-active' : ''}`}
                title={tab.title}
                onClick={() => {
                  setPriorityFilter(tab.key);
                  setLeadsPage(1);
                  setSelectedIds([]);
                }}
              >
                {tab.label}
                <span className="rlh-tab__count">{count}</span>
              </button>
            );
          })}
        </div>

        <div className="rlh-tabs rlh-tabs--care" role="tablist" aria-label="Chăm sóc AE">
          {CARE_TABS.map((tab) => {
            const countKey = tab.key || 'all';
            const count = Number(careCounts[countKey] ?? 0);
            const active = careFilter === tab.key;
            return (
              <button
                key={tab.key || 'all'}
                type="button"
                role="tab"
                aria-selected={active}
                className={`rlh-tab${active ? ' is-active' : ''}`}
                title={tab.title}
                onClick={() => {
                  setCareFilter(tab.key);
                  setLeadsPage(1);
                  setSelectedIds([]);
                }}
              >
                {tab.label}
                <span className="rlh-tab__count">{count}</span>
              </button>
            );
          })}
        </div>

        <div className="form-grid form-grid--2 rlh-lead-filters" style={{ marginBottom: '0.75rem' }}>
          <label className="form-field">
            <span className="form-label">Trạng thái</span>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setLeadsPage(1);
                setSelectedIds([]);
              }}
            >
              <option value="">Tất cả trạng thái</option>
              <option value="pending">Chờ xử lý</option>
              <option value="accepted">Đã Accept</option>
              <option value="rejected">Đã từ chối</option>
              <option value="auto_rejected">Tự từ chối (gate)</option>
              <option value="pushed">Đã đẩy CRM</option>
            </select>
          </label>
          <label className="form-field">
            <span className="form-label">Ngành nghề</span>
            <select
              value={industryFilter}
              onChange={(e) => {
                setIndustryFilter(e.target.value);
                setLeadsPage(1);
                setSelectedIds([]);
              }}
            >
              <option value="">Tất cả ngành</option>
              {industriesInLeads.map((ind) => (
                <option key={ind.key} value={ind.key}>
                  {ind.label}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span className="form-label">Job</span>
            <select
              value={jobFilter === '' ? '' : String(jobFilter)}
              onChange={(e) => {
                const v = e.target.value;
                setJobFilter(v ? Number(v) : '');
                setLeadsPage(1);
                setSelectedIds([]);
              }}
            >
              <option value="">Tất cả job</option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  #{j.id} · {j.mode} · {j.status}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span className="form-label">Tìm (tên / SĐT / email)</span>
            <input
              value={qDraft}
              onChange={(e) => setQDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  setQFilter(qDraft.trim());
                  setLeadsPage(1);
                  setSelectedIds([]);
                }
              }}
              placeholder="Nhập rồi Enter…"
            />
          </label>
          <div className="form-field" style={{ display: 'flex', gap: '1rem', alignItems: 'end' }}>
            <label className="form-check">
              <input
                type="checkbox"
                checked={hasPhoneOnly}
                onChange={(e) => {
                  setHasPhoneOnly(e.target.checked);
                  setLeadsPage(1);
                  setSelectedIds([]);
                }}
              />
              Có SĐT
            </label>
            <label className="form-check">
              <input
                type="checkbox"
                checked={hasContactOnly}
                onChange={(e) => {
                  setHasContactOnly(e.target.checked);
                  setLeadsPage(1);
                  setSelectedIds([]);
                }}
              />
              Có contact
            </label>
          </div>
        </div>

        {leads.length === 0 ? (
          <div className="rlh-empty">Chưa có lead khớp filter — chạy job hoặc nới bộ lọc.</div>
        ) : (
          <>
          <div className="data-table-wrap rlh-leads-wrap">
            <table className="data-table data-table--dense">
              <thead>
                <tr>
                  <th className="rlh-col-check">
                    <input
                      type="checkbox"
                      aria-label="Chọn tất cả trang"
                      checked={
                        leads.length > 0 && selectedIds.length === leads.length
                      }
                      onChange={(e) =>
                        setSelectedIds(e.target.checked ? leads.map((l) => l.id) : [])
                      }
                    />
                  </th>
                  <th>Score</th>
                  <th>ICP</th>
                  <th>Ưu tiên</th>
                  <th>Ngành</th>
                  <th>Công ty</th>
                  <th>SĐT</th>
                  <th>Email</th>
                  <th>Website</th>
                  <th>Fanpage</th>
                  <th>Zalo</th>
                  <th>Địa chỉ</th>
                  <th>Chăm sóc</th>
                  <th>AE</th>
                  <th>Phân loại</th>
                  <th>Readiness</th>
                  <th>Trạng thái</th>
                  <th>Dial</th>
                  <th>Feedback</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(lead.id)}
                        onChange={(e) =>
                          setSelectedIds((prev) =>
                            e.target.checked
                              ? [...prev, lead.id]
                              : prev.filter((id) => id !== lead.id),
                          )
                        }
                      />
                    </td>
                    <td>
                      <span className={`badge ${scoreBadge(lead.quality_score)}`}>
                        {Math.round(lead.quality_score)}
                      </span>
                      {Number(lead.learning_delta) ? (
                        <div
                          className="muted rlh-sub"
                          title={(lead.learning_reasons ?? []).join(', ')}
                        >
                          {Number(lead.learning_delta) > 0 ? '+' : ''}
                          {Math.round(Number(lead.learning_delta))}
                        </div>
                      ) : null}
                    </td>
                    <td className="muted">{Math.round(lead.icp_fit_score)}</td>
                    <td>
                      <span className={priorityBadgeClass(lead.priority_tier)}>
                        {priorityLabel(lead.priority_tier)}
                      </span>
                      {lead.account_cluster_key ? (
                        <div
                          className="muted rlh-sub"
                          title={lead.account_cluster_key}
                        >
                          {shortClusterKey(lead.account_cluster_key)}
                        </div>
                      ) : null}
                      {lead.global_account_key ? (
                        <div
                          className="muted rlh-sub"
                          title={`global ${lead.global_account_key}`}
                        >
                          g:{shortClusterKey(lead.global_account_key)}
                        </div>
                      ) : null}
                      {lead.research_account_id ? (
                        <div className="muted rlh-sub">A#{lead.research_account_id}</div>
                      ) : null}
                    </td>
                    <td>
                      <span className="rlh-class">
                        {lead.industry_label?.trim() || lead.industry_key || '—'}
                      </span>
                    </td>
                    <td>
                      {(() => {
                        const evidence = String(lead.evidence_url ?? '').trim();
                        const website = String(lead.website ?? '').trim();
                        const webHref = website
                          ? /^https?:\/\//i.test(website)
                            ? website
                            : `https://${website}`
                          : '';
                        const mapsQ = [lead.company_name, lead.address]
                          .map((s) => String(s ?? '').trim())
                          .filter(Boolean)
                          .join(' ');
                        const mapsHref = mapsQ
                          ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQ)}`
                          : '';
                        const primary =
                          (evidence && /^https?:\/\//i.test(evidence) ? evidence : '') ||
                          webHref ||
                          mapsHref;
                        return (
                          <>
                            {primary ? (
                              <a href={primary} target="_blank" rel="noreferrer">
                                {lead.company_name}
                              </a>
                            ) : (
                              <strong>{lead.company_name}</strong>
                            )}
                            <div className="rlh-toolbar" style={{ flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
                              {webHref ? (
                                <a
                                  href={webHref}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="muted rlh-sub"
                                >
                                  Website
                                </a>
                              ) : null}
                              {mapsHref ? (
                                <a
                                  href={mapsHref}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="muted rlh-sub"
                                >
                                  Maps
                                </a>
                              ) : null}
                            </div>
                          </>
                        );
                      })()}
                    </td>
                    <td>{phoneLink(lead.phone)}</td>
                    <td>
                      {lead.email ? (
                        <a href={`mailto:${lead.email}`} className="rlh-link">
                          {lead.email}
                        </a>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td>{externalLink(lead.website)}</td>
                    <td>{externalLink(lead.fanpage_url)}</td>
                    <td>{externalLink(lead.zalo_url)}</td>
                    <td>
                      <span className="muted rlh-sub">{lead.address ?? '—'}</span>
                    </td>
                    <td>
                      <span className="rlh-class">
                        {careStatusLabel(lead.care_status)}
                      </span>
                      {lead.care_contact_status &&
                      lead.care_contact_status !== 'pending' ? (
                        <div className="muted rlh-sub">
                          {lead.care_contact_status === 'contacted'
                            ? 'Đã liên lạc'
                            : 'Không liên lạc được'}
                        </div>
                      ) : null}
                    </td>
                    <td className="muted">
                      {lead.assigned_to_name?.trim()
                        ? lead.assigned_to_name
                        : lead.assigned_to_staff_id
                          ? `#${lead.assigned_to_staff_id}`
                          : '—'}
                    </td>
                    <td>
                      <span className="rlh-class">{classificationLabel(lead.classification)}</span>
                    </td>
                    <td>
                      {canRun ? (
                        <>
                          <select
                            className="rlh-select-sm"
                            value={lead.readiness_status ?? ''}
                            disabled={busy || lead.status === 'pushed'}
                            onChange={(e) => {
                              const v = e.target.value as RawLeadReadinessStatus | '';
                              if (!v) return;
                              void patchRawLead(token, projectId, lead.id, {
                                readiness_status: v,
                              })
                                .then(reloadJobsAndLeads)
                                .catch((err) =>
                                  setError(
                                    err instanceof Error
                                      ? err.message
                                      : 'Đổi readiness thất bại',
                                  ),
                                );
                            }}
                          >
                            <option value="">— chưa phân loại</option>
                            <option value="READY_TO_PUSH">Sẵn sàng push</option>
                            <option value="NEEDS_REVIEW">Cần review</option>
                            <option value="MISSING_CONTACT">Thiếu contact</option>
                            <option value="DUPLICATE_OR_BLACKLIST">Trùng / blacklist</option>
                          </select>
                          {lead.readiness_reason_codes?.length ? (
                            <div className="muted rlh-sub">
                              {lead.readiness_reason_codes.slice(0, 2).join(', ')}
                            </div>
                          ) : null}
                        </>
                      ) : (
                        <>
                          <span className="rlh-class">
                            {readinessLabel(lead.readiness_status)}
                          </span>
                          {lead.readiness_reason_codes?.length ? (
                            <div className="muted rlh-sub">
                              {lead.readiness_reason_codes.slice(0, 2).join(', ')}
                            </div>
                          ) : null}
                        </>
                      )}
                    </td>
                    <td>
                      <span
                        className={`rlh-status ${leadStatusClass(lead.status)}`}
                        title={lead.status}
                      >
                        {leadStatusLabel(lead.status)}
                      </span>
                      {lead.crm_lead_id ? (
                        <div className="muted rlh-sub">CRM #{lead.crm_lead_id}</div>
                      ) : null}
                    </td>
                    <td>
                      {canRun ? (
                        <select
                          className="rlh-select-sm"
                          value={lead.dial_outcome ?? ''}
                          disabled={busy}
                          onChange={(e) => {
                            const v = e.target.value;
                            if (!v) return;
                            void patchRawLead(token, projectId, lead.id, {
                              dial_outcome: v as (typeof DIAL_OPTS)[number]['value'],
                            }).then(reloadJobsAndLeads);
                          }}
                        >
                          <option value="">—</option>
                          {DIAL_OPTS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        lead.dial_outcome ?? '—'
                      )}
                    </td>
                    <td>
                      {canRun ? (
                        <select
                          className="rlh-select-sm"
                          value={lead.feedback_code ?? ''}
                          disabled={busy}
                          onChange={(e) => {
                            const v = e.target.value;
                            if (!v) return;
                            void patchRawLead(token, projectId, lead.id, {
                              feedback_code: v as (typeof FEEDBACK_OPTS)[number]['value'],
                            }).then(reloadJobsAndLeads);
                          }}
                        >
                          <option value="">—</option>
                          {FEEDBACK_OPTS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        lead.feedback_code ?? '—'
                      )}
                    </td>
                    <td>
                      <div className="rlh-row-actions">
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          disabled={busy}
                          onClick={() => void openBattlecard(lead.id)}
                        >
                          Battlecard
                        </button>
                        {canRun && lead.status === 'pending' ? (
                          <>
                            <button
                              type="button"
                              className="btn btn-sm"
                              onClick={() => setAcceptLead(lead)}
                            >
                              Accept
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() =>
                                void patchRawLead(token, projectId, lead.id, {
                                  status: 'rejected',
                                }).then(reloadJobsAndLeads)
                              }
                            >
                              Reject
                            </button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div
            className="rlh-pager"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              marginTop: '0.75rem',
              flexWrap: 'wrap',
            }}
          >
            <span className="form-hint" style={{ margin: 0 }}>
              Trang {leadsPage}/{leadsTotalPages || 0} · {leadsTotal} lead · 50/trang
            </span>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={busy || leadsPage <= 1}
              onClick={() => {
                setLeadsPage((p) => Math.max(1, p - 1));
                setSelectedIds([]);
              }}
            >
              Prev
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={busy || leadsTotalPages === 0 || leadsPage >= leadsTotalPages}
              onClick={() => {
                setLeadsPage((p) => p + 1);
                setSelectedIds([]);
              }}
            >
              Next
            </button>
          </div>
          </>
        )}
      </section>

      <RawLeadBattlecardModal
        open={battlecardOpen}
        card={battlecard}
        loading={battlecardLoading}
        error={battlecardError}
        onClose={() => {
          setBattlecardOpen(false);
          setBattlecard(null);
          setBattlecardError('');
        }}
      />

      <RawLeadAcceptModal
        open={Boolean(acceptLead) || Boolean(acceptBulkIds?.length)}
        companyName={acceptLead?.company_name ?? ''}
        readinessStatus={acceptLead?.readiness_status}
        bulkCount={acceptBulkIds?.length}
        busy={busy}
        onCancel={() => {
          setAcceptLead(null);
          setAcceptBulkIds(null);
        }}
        onConfirm={(checklist) => {
          if (acceptBulkIds?.length) {
            const ids = acceptBulkIds;
            void (async () => {
              setBusy(true);
              try {
                const out = await bulkAcceptRawLeads(token, projectId, {
                  lead_ids: ids,
                  accepted_checklist_json: checklist,
                });
                setAcceptBulkIds(null);
                setSelectedIds([]);
                setMsg(
                  `Accept hàng loạt: ${out.accepted} OK` +
                    (out.promoted_ready ? `, ${out.promoted_ready} → Ready` : '') +
                    (out.skipped ? `, ${out.skipped} bỏ qua` : '') +
                    (out.errors.length ? `, ${out.errors.length} lỗi` : ''),
                );
                if (out.errors[0]) {
                  setError(`${out.errors[0].raw_lead_id}: ${out.errors[0].error}`);
                }
                if (out.readiness_counts) {
                  setReadinessCounts((prev) => ({ ...prev, ...out.readiness_counts }));
                }
                await reloadJobsAndLeads();
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Accept hàng loạt thất bại');
              } finally {
                setBusy(false);
              }
            })();
            return;
          }
          if (!acceptLead) return;
          const beforeReady = acceptLead.readiness_status;
          void (async () => {
            setBusy(true);
            try {
              const updated = await patchRawLead(token, projectId, acceptLead.id, {
                status: 'accepted',
                accepted_checklist_json: checklist,
              });
              setAcceptLead(null);
              const promoted =
                beforeReady === 'NEEDS_REVIEW' ||
                (!beforeReady && updated.readiness_status === 'READY_TO_PUSH');
              setMsg(
                promoted
                  ? `Đã Accept — chuyển Sẵn sàng push (#${updated.id})`
                  : `Đã Accept #${updated.id}`,
              );
              await reloadJobsAndLeads();
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Accept thất bại');
            } finally {
              setBusy(false);
            }
          })();
        }}
      />
    </div>
  );
}
