'use client';

import { Children, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  claimLeadSolution,
  fetchCrmStaffList,
  fetchDiscoveryOptions,
  fetchIntakeSessions,
  fetchLeadPresalesClientBrief,
  fetchLeadPresalesConsultBrief,
  fetchLeadPresalesMarketingPlan,
  returnLeadToSales,
  type IntakeSessionRow,
  type LeadFunnelSnapshot,
  type LeadRow,
} from '@/lib/api';
import { intakeServiceLabel } from '@/lib/crm/intake-service-resolve';
import {
  authorityLabel,
  budgetLabel,
  channelLabels,
  discoveryIndustryLabel,
  discoveryServiceLabel,
  readDiscoveryBriefFromAnswers,
  temperatureLabel,
  timelineLabel,
  type DiscoveryOption,
  type SalesDiscoveryBrief,
} from '@/lib/crm/sales-discovery';
import {
  amDeskChecklist,
  dash,
  formatHandoffStamp,
  HANDOFF_FLOW_COPY,
  linesFromText,
  resolveHandoffFlow,
} from '@/lib/crm/handoff-flow.util';
import { HandoffFlowStepper } from '@/components/crm/am/HandoffFlowStepper';
import {
  buildAmDeskBrief,
  checklistSourceFromMerged,
  hrefForUrl,
  humanizeSource,
  isFilled,
  type AmDeskClientBriefLike,
  type AmDeskConsultLike,
} from '@/lib/crm/am-desk-data';
import { pushToast } from '@/lib/toast';
import './am-handoff-desk.css';

type TabKey = 'brief' | 'history' | 'files' | 'notes';

type Attachment = { id: string; name: string; mime?: string; data_url?: string };

type StaffOption = { id: number; name: string; title?: string };

type ExchangeLine = { id?: string | number; at?: string; author?: string; text: string };

function Icon({ d, size = 14 }: { d: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

const I = {
  back: 'M15 19l-7-7 7-7',
  source: 'M4 7h16M4 12h10M4 17h16',
  created: 'M8 7V3m8 4V3M5 11h14M6 5h12a1 1 0 011 1v13a1 1 0 01-1 1H6a1 1 0 01-1-1V6a1 1 0 011-1z',
  person: 'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z',
  sent: 'M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z',
  return: 'M9 14l-4-4 4-4M5 10h11a4 4 0 010 8h-1',
  chat: 'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  star: 'M12 3l2.2 6.6H21l-5.5 4 2.1 6.4L12 16.8 6.4 20l2.1-6.4L3 9.6h6.8z',
  brief: 'M4 19V5a1 1 0 011-1h9l6 6v9a1 1 0 01-1 1H5a1 1 0 01-1-1z',
  industry: 'M3 21h18M5 21V8l6-3 6 3v13M9 21v-6h6v6',
  pin: 'M12 21s7-5.3 7-11a7 7 0 10-14 0c0 5.7 7 11 7 11zM12 11a1.5 1.5 0 110-3 1.5 1.5 0 010 3z',
  link: 'M10 13a5 5 0 007.07 0l1.41-1.41a5 5 0 00-7.07-7.07L10 5.93M14 11a5 5 0 00-7.07 0L5.52 12.4a5 5 0 007.07 7.07L14 18.07',
  scale: 'M3 20h18M6 16V8m6 8V4m6 12v-6',
  model: 'M12 2l9 5v10l-9 5-9-5V7l9-5z',
  phone: 'M6.5 3h3l1.5 4-2 1.5a12 12 0 006 6L17 13l4 1.5v3A16 16 0 016.5 3z',
  mail: 'M4 6h16v12H4V6zm0 0l8 7 8-7',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z',
  check: 'M5 12l5 5L20 7',
  bolt: 'M13 2L4 14h7l-1 8 10-13h-7l0-7z',
  goal: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 8v4l3 2',
  box: 'M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8',
  warn: 'M12 9v4m0 4h.01M10.3 4.6l-7 12A2 2 0 005 19.5h14a2 2 0 001.7-2.9l-7-12a2 2 0 00-3.4 0z',
  status: 'M4 19V5h10l6 6v8H4z',
  users: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75',
  money: 'M12 1v22M17 5H9.5a3.5 3.5 0 000 7H14a3.5 3.5 0 010 7H6',
  note: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM14 2v6h6',
  list: 'M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01',
  clip: 'M21.4 11.4l-8.8 8.8a6 6 0 01-8.5-8.5l8.8-8.8a4 4 0 015.7 5.7L9.7 19.5a2 2 0 01-2.8-2.8l8-8',
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function Field({ icon, label, value, href }: { icon: string; label: string; value: string; href?: string }) {
  const empty = !isFilled(value) || value === '—';
  if (empty) return null;
  const link = href || hrefForUrl(value);
  return (
    <div>
      <Icon d={icon} />
      <dd>
        <span className="ahd-k">{label}: </span>
        {link ? (
          <a className="ahd-link" href={link} target="_blank" rel="noreferrer">
            {value}
          </a>
        ) : (
          <span>{value}</span>
        )}
      </dd>
    </div>
  );
}

function EmptyState({ text = 'Chưa có dữ liệu.' }: { text?: string }) {
  return <p className="ahd-empty-state">{text}</p>;
}

function FieldList({ children }: { children: ReactNode }) {
  const items = Children.toArray(children).filter(Boolean);
  if (!items.length) return <EmptyState />;
  return <dl className="ahd-dl">{items}</dl>;
}

function BriefCard({
  title,
  icon,
  wide,
  testId,
  children,
}: {
  title: string;
  icon: string;
  wide?: boolean;
  testId?: string;
  children?: ReactNode;
}) {
  return (
    <section className={`ahd-card${wide ? ' ahd-card--wide' : ''}`} data-testid={testId}>
      <h3 className="ahd-card__title">
        <Icon d={icon} />
        {title}
      </h3>
      {children ?? <EmptyState />}
    </section>
  );
}

function Bullets({ text }: { text: string }) {
  const lines = linesFromText(text);
  if (!lines.length) return <EmptyState />;
  if (lines.length === 1) return <p className="ahd-prose">{lines[0]}</p>;
  return (
    <ul className="ahd-bullets">
      {lines.map((line) => (
        <li key={line}>{line}</li>
      ))}
    </ul>
  );
}

function defaultDeadline(): string {
  const d = new Date();
  d.setDate(d.getDate() + 3);
  const tz = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Saigon',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
  return tz;
}

/** ISO yyyy-MM-dd → vi-VN dd/MM/yyyy */
export function isoToViDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || '').trim());
  if (!m) return '';
  return `${m[3]}/${m[2]}/${m[1]}`;
}

/** vi-VN dd/MM/yyyy → ISO yyyy-MM-dd, or null if incomplete/invalid. */
export function viDateToIso(vi: string): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(vi || '').trim());
  if (!m) return null;
  const dd = m[1].padStart(2, '0');
  const mm = m[2].padStart(2, '0');
  const yyyy = m[3];
  const dt = new Date(`${yyyy}-${mm}-${dd}T12:00:00+07:00`);
  if (Number.isNaN(dt.getTime())) return null;
  if (dt.getUTCDate() !== Number(dd) && dt.getDate() !== Number(dd)) {
    /* still accept calendar-valid ISO strings */
  }
  return `${yyyy}-${mm}-${dd}`;
}

function readFiles(plan: Record<string, unknown> | null): Attachment[] {
  const raw = plan?.strategy_framework_json ?? plan?.strategy_framework;
  let framework: Record<string, unknown> = {};
  if (typeof raw === 'string') {
    try {
      framework = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      framework = {};
    }
  } else if (raw && typeof raw === 'object') {
    framework = raw as Record<string, unknown>;
  }
  const packed = framework.mkt_files;
  if (Array.isArray(packed)) {
    return packed
      .map((row, i) => {
        const r = row as Record<string, unknown>;
        return {
          id: String(r.id ?? i),
          name: String(r.name ?? 'tệp'),
          mime: String(r.mime ?? ''),
          data_url: String(r.data_url ?? r.url ?? ''),
        };
      })
      .filter((f) => f.name);
  }
  return [];
}

export function AmHandoffDesk({
  token,
  lead,
  party,
  funnel,
  userName,
  userId,
  onFunnelChange,
  onBack,
  onMessage,
  onError,
  exchangeLines = [],
  marketingLeaders = [],
}: {
  token: string;
  lead: LeadRow;
  party?: {
    company_name?: string;
    contact_name?: string;
    phone?: string;
    email?: string;
    job_title?: string;
    industry?: string;
    address?: string;
    logo_url?: string;
  } | null;
  funnel: LeadFunnelSnapshot | null;
  userName?: string;
  userId?: number;
  onFunnelChange: (funnel: LeadFunnelSnapshot) => void;
  onBack?: () => void;
  onMessage?: (message: string) => void;
  onError?: (message: string) => void;
  exchangeLines?: ExchangeLine[];
  marketingLeaders?: StaffOption[];
}) {
  const [session, setSession] = useState<IntakeSessionRow | null>(null);
  const [files, setFiles] = useState<Attachment[]>([]);
  const [consultPrefill, setConsultPrefill] = useState('');
  const [leaders, setLeaders] = useState<StaffOption[]>(marketingLeaders);
  const [tab, setTab] = useState<TabKey>('brief');
  const [leaderId, setLeaderId] = useState<string>(marketingLeaders[0] ? String(marketingLeaders[0].id) : '');
  const [deadline, setDeadline] = useState(defaultDeadline);
  const [deadlineText, setDeadlineText] = useState(() => isoToViDate(defaultDeadline()));
  const [assignNote, setAssignNote] = useState('');
  const [internalNote, setInternalNote] = useState('');
  const [internalLog, setInternalLog] = useState<ExchangeLine[]>([]);
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnReason, setReturnReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [industryOptions, setIndustryOptions] = useState<DiscoveryOption[]>([]);
  const [serviceOptions, setServiceOptions] = useState<Array<{ slug?: string; value?: string; name?: string; label?: string }>>([]);
  const [consultPack, setConsultPack] = useState<AmDeskConsultLike | null>(null);
  const [clientPack, setClientPack] = useState<AmDeskClientBriefLike | null>(null);

  const brief: SalesDiscoveryBrief | null = useMemo(
    () => readDiscoveryBriefFromAnswers(session?.answers_json) ?? null,
    [session],
  );

  const view = useMemo(
    () =>
      buildAmDeskBrief({
        discovery: brief,
        lead,
        party,
        session,
        consult: consultPack,
        clientBrief: clientPack,
        presalesNotes: (funnel?.presales as { notes?: string } | null | undefined)?.notes,
        serviceSlug: (funnel?.presales as { service_slug?: string } | null | undefined)?.service_slug,
      }),
    [brief, lead, party, session, consultPack, clientPack, funnel],
  );

  const load = useCallback(async () => {
    const [sessions, plan, consult, clientBrief] = await Promise.all([
      fetchIntakeSessions(token, { lead_id: lead.id }).catch(() => [] as IntakeSessionRow[]),
      fetchLeadPresalesMarketingPlan(token, lead.id).catch(() => null),
      fetchLeadPresalesConsultBrief(token, lead.id).catch(() => null),
      fetchLeadPresalesClientBrief(token, lead.id).catch(() => null),
    ]);
    const completed = [...sessions].filter((s) => s.status === 'completed').sort((a, b) => b.id - a.id);
    const draft = [...sessions].filter((s) => s.status === 'draft').sort((a, b) => b.id - a.id);
    setSession(completed[0] ?? draft[0] ?? sessions[0] ?? null);
    const planRec = (plan && typeof plan === 'object' ? (plan as { plan?: Record<string, unknown> }).plan ?? plan : null) as Record<string, unknown> | null;
    setFiles(readFiles(planRec));
    const briefRec = consult && typeof consult === 'object' ? (consult as { brief?: Record<string, unknown> }).brief : null;
    const prefillParts = [
      briefRec && typeof briefRec.goal === 'string' ? String(briefRec.goal) : '',
      briefRec && typeof briefRec.notes === 'string' ? String(briefRec.notes) : '',
      briefRec && typeof briefRec.need === 'string' ? String(briefRec.need) : '',
    ].filter((s) => s.trim());
    setConsultPrefill(prefillParts.join('\n'));
    setConsultPack(consult && typeof consult === 'object' ? (consult as AmDeskConsultLike) : null);
    setClientPack(clientBrief && typeof clientBrief === 'object' ? (clientBrief as AmDeskClientBriefLike) : null);
  }, [token, lead.id]);

  useEffect(() => {
    void load().catch((err) => setError(err instanceof Error ? err.message : 'Không tải được hồ sơ Sales.'));
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    void fetchDiscoveryOptions(token)
      .then((opts) => {
        if (cancelled || !opts) return;
        const industries = (opts.industries ?? []) as DiscoveryOption[];
        if (industries.length) setIndustryOptions(industries);
        const groups = (opts.service_groups ?? []) as Array<{
          services?: Array<{ slug?: string; name?: string; label?: string }>;
          slug?: string;
          name?: string;
          label?: string;
        }>;
        const flat: Array<{ slug?: string; value?: string; name?: string; label?: string }> = [];
        for (const g of groups) {
          if (Array.isArray(g.services)) flat.push(...g.services);
          else if (g.slug || g.name) flat.push(g);
        }
        if (flat.length) setServiceOptions(flat);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (marketingLeaders.length) setLeaders(marketingLeaders);
  }, [marketingLeaders]);

  useEffect(() => {
    if (marketingLeaders.length) return;
    let cancelled = false;
    void fetchCrmStaffList(token)
      .then((out) => {
        if (cancelled) return;
        const rows = (out.staff ?? []).filter((row) => {
          const code = String(row.position_catalog_code ?? '').toLowerCase();
          const title = String(row.position_catalog_name || row.job_title || '').toLowerCase();
          return (
            Boolean(row.active) &&
            (row.can_receive_solution ||
              code === 'mkl' ||
              code === 'mkt-01' ||
              code === 'mkt01' ||
              title.includes('marketing leader') ||
              title.includes('marketing'))
          );
        });
        const mapped = rows.map((row) => ({
          id: row.id,
          name: row.name,
          title: row.position_catalog_name || row.job_title || 'Marketing Leader',
        }));
        if (mapped.length) setLeaders(mapped);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [token, marketingLeaders.length]);

  useEffect(() => {
    if (!assignNote && (view.call_notes || consultPrefill)) {
      const seed = consultPrefill || view.call_notes || '';
      if (seed) setAssignNote(seed);
    }
    // only seed once when data arrives
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consultPrefill, view.call_notes]);

  const fanpage = view.fanpage;
  const tiktok = view.tiktok;
  const site = view.website;

  const company = view.company_name || party?.company_name || lead.company_name || lead.full_name || '';
  const leadCode = lead.project_code || `LD-${lead.id}`;
  const contactName = view.contact_name;
  const handoff = funnel?.presales?.handoff;
  const flow = resolveHandoffFlow({
    leadStatus: lead.status,
    leadCreatedAt: lead.created_at,
    leadReceivedAt: lead.received_at,
    handoffStatus: handoff?.status,
    handedOffAt: handoff?.handed_off_at,
    solutionClaimedAt: (funnel?.presales?.solution_case as { claimed_at?: string } | null | undefined)?.claimed_at,
    solutionReleasedAt: undefined,
    quotePhase: funnel?.presales?.quote_case?.phase,
    hasContract: Boolean(lead.has_contract),
    discoverySubmitted:
      Boolean(brief) ||
      session?.status === 'completed' ||
      Boolean(handoff?.handed_off_at),
    discoverySubmittedAt: session?.updated_at ?? handoff?.handed_off_at,
    returnedToSales: handoff?.status === 'returned',
  });
  const checklist = amDeskChecklist(checklistSourceFromMerged(view), {
    legacyReady:
      view.isLegacy &&
      (handoff?.status === 'pending' ||
        session?.status === 'completed' ||
        Boolean(handoff?.handed_off_at)),
  });
  const salesName = dash((lead as { owner_name?: string }).owner_name);
  const amName = dash(userName);
  const temp = view.temperature;
  const tempLabel = temperatureLabel(temp) || temp;
  const source = humanizeSource(view.source) || dash(lead.source || lead.channel);
  const created = formatHandoffStamp(lead.created_at || lead.received_at);
  const sentAm = formatHandoffStamp(handoff?.handed_off_at);

  const canAssign = flow.currentKey === 'await_solutions';

  async function run(task: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await task();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Thao tác thất bại';
      setError(msg);
      onError?.(msg);
    } finally {
      setBusy(false);
    }
  }

  function assignDisabledReason(): string {
    if (!canAssign) return 'Lead không còn ở bước Chờ Solutions.';
    if (!leaderId) return 'Chọn Marketing Leader.';
    if (!deadline) return 'Chọn Deadline Solutions.';
    if (!checklist.allOk && !checklist.legacyAssignable) return 'Hoàn thiện checklist AM trước khi giao.';
    return '';
  }

  async function assignToMarketing() {
    const reason = assignDisabledReason();
    if (reason) {
      setError(reason);
      return;
    }
    await run(async () => {
      const out = await claimLeadSolution(token, lead.id, {
        assignee_staff_id: Number(leaderId),
        deadline,
        note: assignNote.trim(),
      });
      onFunnelChange(out.funnel);
      const msg = HANDOFF_FLOW_COPY.assignedToMarketing;
      setNotice(msg);
      onMessage?.(msg);
      pushToast(msg, 'success');
    });
  }

  async function confirmReturn() {
    const reason = returnReason.trim();
    if (reason.length < 5) {
      setError('Nhập lý do trả về Sales, ít nhất 5 ký tự.');
      return;
    }
    await run(async () => {
      const out = await returnLeadToSales(token, lead.id, reason);
      onFunnelChange(out.funnel);
      const msg = HANDOFF_FLOW_COPY.returnedToSales;
      setNotice(msg);
      setReturnOpen(false);
      onMessage?.(msg);
      pushToast(msg, 'success');
    });
  }

  function addInternalNote() {
    const text = internalNote.trim();
    if (!text) return;
    setInternalLog((prev) => [
      { at: new Date().toISOString(), author: userName || 'Bạn', text },
      ...prev,
    ]);
    setInternalNote('');
    // No dedicated internal-thread API on this desk — keep the note visible locally
    // and report it as a local log. Trao đổi nội bộ still opens this tab.
    onMessage?.('Đã ghi chú nội bộ trên màn hình (chưa đồng bộ máy chủ).');
  }

  const serviceChips = (view.services ?? []).map((slug) => discoveryServiceLabel(slug, serviceOptions) || intakeServiceLabel(slug) || slug);
  const currentRows = [
    view.channels.length
      ? `Kênh đang sử dụng: ${channelLabels(view.channels)}`
      : view.channels_text
        ? `Kênh đang sử dụng: ${view.channels_text}`
        : '',
    view.current_budget ? `Ngân sách hiện tại: ${view.current_budget}` : '',
    view.current_results ? `Kết quả: ${view.current_results}` : '',
    view.difficulties ? `Khó khăn: ${view.difficulties}` : '',
  ].filter(Boolean);
  const budgetRows = [
    view.budget_band ? `Ngân sách Marketing dự kiến: ${budgetLabel(view.budget_band)}` : '',
    view.timeline_band ? `Thời điểm: ${timelineLabel(view.timeline_band)}` : '',
    view.flagship_product ? `Sản phẩm chủ lực: ${view.flagship_product}` : '',
  ].filter(Boolean);
  const fileCount = files.length;

  return (
    <div className="ahd" data-testid="am-handoff-desk">
      <nav className="ahd-crumb" aria-label="breadcrumb">
        <Link href="/crm/leads">Lead &amp; Deal</Link>
        <span className="ahd-crumb__sep">›</span>
        <Link href="/crm/solution/queue">Chờ Solutions</Link>
        <span className="ahd-crumb__sep">›</span>
        <span className="ahd-crumb__now">{leadCode}</span>
      </nav>

      <header className="ahd-head">
        <div className="ahd-head__left">
          <button
            type="button"
            className="ahd-back"
            aria-label="Quay lại"
            data-testid="ahd-back"
            onClick={() => (onBack ? onBack() : window.history.back())}
          >
            <Icon d={I.back} size={18} />
          </button>
          <div>
            <div className="ahd-title-row">
              <h1 className="ahd-title">
                {leadCode} – {company}
              </h1>
              <span className="ahd-badge" data-testid="ahd-status">
                <Icon d={I.star} size={12} />
                {flow.currentLabel}
              </span>
            </div>
            <ul className="ahd-meta">
              <li>
                <Icon d={I.source} size={13} />
                Nguồn: <strong>{source}</strong>
              </li>
              <li>
                <Icon d={I.created} size={13} />
                Tạo: <strong>{created || '—'}</strong>
              </li>
              <li>
                <Icon d={I.person} size={13} />
                Phụ trách Sales: <strong>{salesName}</strong>
              </li>
              <li>
                <Icon d={I.sent} size={13} />
                Đã gửi AM: <strong>{sentAm || '—'}</strong>
              </li>
            </ul>
          </div>
        </div>
        <div className="ahd-head__actions">
          <button
            type="button"
            className="ahd-btn ahd-btn--ghost"
            data-testid="ahd-return"
            disabled={busy || (flow.currentKey !== 'await_solutions' && flow.currentKey !== 'doing_solutions')}
            onClick={() => setReturnOpen(true)}
          >
            <Icon d={I.return} size={14} />
            Trả về Sales
          </button>
          <button
            type="button"
            className="ahd-btn ahd-btn--ghost"
            data-testid="ahd-internal"
            onClick={() => setTab('notes')}
          >
            <Icon d={I.chat} size={14} />
            Trao đổi nội bộ
          </button>
          <button
            type="button"
            className="ahd-btn ahd-btn--primary"
            data-testid="ahd-assign-top"
            disabled={busy || Boolean(assignDisabledReason())}
            onClick={() => void assignToMarketing()}
          >
            <Icon d={I.arrow} size={14} />
            Giao cho Marketing
          </button>
        </div>
      </header>

      <HandoffFlowStepper view={flow} />

      {error ? <p className="ahd-error" role="alert">{error}</p> : null}
      {notice ? <p className="ahd-ok">{notice}</p> : null}

      <div className="ahd-body">
        <div className="ahd-col">
          <section className="ahd-card" data-testid="ahd-quick">
            <h3 className="ahd-card__title">
              <Icon d={I.brief} />
              Thông tin nhanh Lead
            </h3>
            <div className="ahd-brand">
              <div className="ahd-avatar">
                {(party?.logo_url || (lead as { logo_url?: string }).logo_url || (party as { logo?: string } | null | undefined)?.logo) ? (
                  <img
                    src={party?.logo_url || (lead as { logo_url?: string }).logo_url || (party as { logo?: string }).logo}
                    alt={String(company || lead.full_name || '')}
                  />
                ) : (
                  initials(String(company || lead.full_name || ''))
                )}
              </div>
              <p className="ahd-brand__name">{company}</p>
            </div>
            <FieldList>
              <Field icon={I.industry} label="Ngành nghề" value={discoveryIndustryLabel(view.industry, industryOptions) || view.industry} />
              <Field icon={I.pin} label="Địa bàn" value={view.region} />
              <Field icon={I.link} label="Website" value={site} href={hrefForUrl(site)} />
              <Field icon={I.link} label="Fanpage" value={fanpage} href={hrefForUrl(fanpage)} />
              <Field icon={I.link} label="TikTok" value={tiktok} href={hrefForUrl(tiktok)} />
              <Field icon={I.scale} label="Quy mô" value={view.scale} />
              <Field icon={I.model} label="Mô hình" value={view.model} />
            </FieldList>
          </section>

          <section className="ahd-card" data-testid="ahd-contact">
            <h3 className="ahd-card__title">
              <Icon d={I.person} />
              Người liên hệ
            </h3>
            <FieldList>
              <Field icon={I.person} label="Họ tên" value={contactName} />
              <Field icon={I.brief} label="Chức vụ" value={view.job_title} />
              <Field icon={I.phone} label="Điện thoại" value={view.phone} />
              <Field icon={I.mail} label="Email" value={view.email} />
              <Field icon={I.shield} label="Quyền quyết định" value={view.budget_authority ? authorityLabel(view.budget_authority) : ''} />
              <Field icon={I.person} label="Người duyệt ngân sách" value={view.budget_approver} />
            </FieldList>
          </section>

          <section className="ahd-card" data-testid="ahd-mgmt">
            <h3 className="ahd-card__title">
              <Icon d={I.users} />
              Thông tin quản lý
            </h3>
            <div className="ahd-people">
              <div className="ahd-person">
                <span className="ahd-person__av">{initials(salesName === '—' ? 'S' : salesName)}</span>
                <span>
                  Sales phụ trách: <strong>{salesName}</strong>
                </span>
              </div>
              <div className="ahd-person">
                <span className="ahd-person__av">{initials(amName === '—' ? 'A' : amName)}</span>
                <span>
                  AM phụ trách: <strong>{amName === '—' ? '—' : amName}</strong>
                  {amName !== '—' ? <span className="ahd-you"> (Bạn)</span> : null}
                </span>
              </div>
              {temp ? (
                <div className="ahd-person ahd-person--temp">
                  <span className="ahd-temp-row">
                    <span className="ahd-k">Mức độ</span>
                    <span className={`ahd-temp ahd-temp--${temp}`} data-testid="ahd-temp" title={String(tempLabel || '')}>
                      {temp === 'hot' ? '🔥 ' : ''}
                      {tempLabel}
                    </span>
                  </span>
                </div>
              ) : null}
            </div>
          </section>
        </div>

        <div className="ahd-col">
          <div className="ahd-tabs" role="tablist" aria-label="Hồ sơ Sales">
            {(
              [
                ['brief', 'Sales Brief (Tóm tắt nhu cầu)', I.brief],
                ['history', 'Lịch sử trao đổi', I.chat],
                ['files', `Tệp đính kèm (${fileCount})`, I.clip],
                ['notes', 'Ghi chú nội bộ', I.note],
              ] as const
            ).map(([key, label, icon]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                className={`ahd-tab${tab === key ? ' is-active' : ''}`}
                data-testid={`ahd-tab-${key}`}
                onClick={() => setTab(key)}
              >
                <Icon d={icon} size={13} />
                {label}
              </button>
            ))}
          </div>

          {tab === 'brief' ? (
            <div className="ahd-brief-grid" data-testid="ahd-brief">
              <BriefCard title="Mục tiêu Marketing" icon={I.goal} testId="ahd-goal">
                <Bullets text={view.marketing_goal} />
              </BriefCard>
              <BriefCard title="Dịch vụ quan tâm" icon={I.box} testId="ahd-services">
                {serviceChips.length ? (
                  <div className="ahd-chips">
                    {serviceChips.map((name) => (
                      <span className="ahd-chip" key={name}>
                        {name}
                      </span>
                    ))}
                  </div>
                ) : null}
              </BriefCard>
              <BriefCard title="Vấn đề khách hàng đang gặp" icon={I.warn} testId="ahd-problem">
                <Bullets text={view.biggest_problem} />
              </BriefCard>
              <BriefCard title="Hiện trạng Marketing" icon={I.status} testId="ahd-current">
                {currentRows.length ? (
                  <ul className="ahd-bullets">
                    {currentRows.map((row) => (
                      <li key={row}>{row}</li>
                    ))}
                  </ul>
                ) : null}
              </BriefCard>
              <BriefCard title="Khách hàng mục tiêu" icon={I.users} testId="ahd-audience">
                <Bullets text={view.target_customers} />
              </BriefCard>
              <BriefCard title="Ngân sách &amp; Thời gian" icon={I.money} testId="ahd-budget">
                {budgetRows.length ? (
                  <ul className="ahd-bullets">
                    {budgetRows.map((row) => (
                      <li key={row}>{row}</li>
                    ))}
                  </ul>
                ) : null}
              </BriefCard>
              <BriefCard title="Ghi chú cuộc gọi (Sales)" icon={I.note} wide testId="ahd-call-notes">
                <Bullets text={view.call_notes} />
              </BriefCard>
            </div>
          ) : null}

          {tab === 'history' ? (
            <section className="ahd-card" data-testid="ahd-history">
              <h3 className="ahd-card__title">
                <Icon d={I.chat} />
                Lịch sử trao đổi
              </h3>
              {exchangeLines.length === 0 ? (
                <p className="ahd-empty">Chưa có lịch sử trao đổi.</p>
              ) : (
                <div className="ahd-history">
                  {exchangeLines.map((line, i) => (
                    <div className="ahd-history__item" key={String(line.id ?? i)}>
                      {line.at ? <time>{formatHandoffStamp(line.at)}</time> : null}
                      <p className="ahd-prose">
                        {line.author ? <strong>{line.author}: </strong> : null}
                        {line.text}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          ) : null}

          {tab === 'files' ? (
            <section className="ahd-card" data-testid="ahd-files">
              <h3 className="ahd-card__title">
                <Icon d={I.clip} />
                Tệp đính kèm ({fileCount})
              </h3>
              {fileCount === 0 ? (
                <p className="ahd-empty">Chưa có tệp đính kèm.</p>
              ) : (
                <ul className="ahd-files">
                  {files.map((file) => (
                    <li key={file.id}>
                      {file.data_url ? (
                        <a href={file.data_url} download={file.name}>
                          {file.name}
                        </a>
                      ) : (
                        file.name
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : null}

          {tab === 'notes' ? (
            <section className="ahd-card" data-testid="ahd-notes">
              <h3 className="ahd-card__title">
                <Icon d={I.note} />
                Ghi chú nội bộ
              </h3>
              <div className="ahd-note-form">
                <textarea
                  value={internalNote}
                  onChange={(e) => setInternalNote(e.target.value)}
                  placeholder="Ghi chú nội bộ cho team…"
                  rows={4}
                  data-testid="ahd-internal-input"
                />
                <button type="button" className="ahd-btn ahd-btn--primary" onClick={addInternalNote} disabled={!internalNote.trim()}>
                  Lưu ghi chú
                </button>
              </div>
              {internalLog.length ? (
                <div className="ahd-history" style={{ marginTop: 12 }}>
                  {internalLog.map((line, i) => (
                    <div className="ahd-history__item" key={i}>
                      {line.at ? <time>{formatHandoffStamp(line.at)}</time> : null}
                      <p className="ahd-prose">
                        <strong>{line.author}: </strong>
                        {line.text}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="ahd-empty" style={{ marginTop: 10 }}>
                  Chưa có ghi chú nội bộ. Ghi chú trên tab này mới lưu trên màn hình hiện tại.
                </p>
              )}
            </section>
          ) : null}
        </div>

        <div className="ahd-col ahd-col--side">
          <section className="ahd-card" data-testid="ahd-checklist">
            <h3 className="ahd-card__title">
              <Icon d={I.list} />
              Checklist AM trước khi giao Solutions
            </h3>
            <ul className="ahd-check">
              {checklist.items.map((item) => (
                <li key={item.key} className={item.ok ? 'is-ok' : undefined}>
                  <span className="ahd-check__mark">
                    {item.ok ? (
                      <svg viewBox="0 0 16 16" width="10" height="10">
                        <path d="M3 8.5l3.2 3.2L13 4.8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    ) : null}
                  </span>
                  {item.label}
                </li>
              ))}
            </ul>
            {checklist.allOk ? (
              <div className="ahd-pass-wrap">
                <span className="ahd-pass" data-testid="ahd-pass">
                  <Icon d={I.check} size={13} />
                  Đạt yêu cầu
                </span>
              </div>
            ) : null}
            {!checklist.allOk && (handoff?.status === 'pending' || Boolean(handoff?.handed_off_at)) ? (
              <p className="ahd-handoff-note" data-testid="ahd-handoff-note">
                Lead đã gửi AM (hồ sơ cũ). Checklist chưa đủ
                {(!view.marketing_goal || !view.target_customers) ? ' — thiếu mục tiêu' : ''}
                {(!view.budget_band || !view.timeline_band) ? ' / ngân sách' : ''}.
                Trạng thái bàn giao: {flow.currentLabel}.
              </p>
            ) : null}
          </section>

          <section className="ahd-card" data-testid="ahd-next">
            <h3 className="ahd-card__title">
              <Icon d={I.bolt} />
              Hành động tiếp theo
            </h3>
            <label className="ahd-field">
              <span>
                Giao cho Marketing Leader <span className="ahd-req">*</span>
              </span>
              <select
                value={leaderId}
                onChange={(e) => setLeaderId(e.target.value)}
                disabled={busy || !canAssign}
                data-testid="ahd-leader"
              >
                <option value="">— Chọn Marketing Leader —</option>
                {leaders.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                    {row.title ? ` — ${row.title}` : ' — Marketing Leader'}
                  </option>
                ))}
              </select>
            </label>
            <label className="ahd-field">
              <span>
                Deadline Solutions <span className="ahd-req">*</span>
              </span>
              <input
                type="text"
                inputMode="numeric"
                lang="vi-VN"
                placeholder="dd/MM/yyyy"
                autoComplete="off"
                value={deadlineText}
                onChange={(e) => {
                  const v = e.target.value;
                  setDeadlineText(v);
                  const iso = viDateToIso(v);
                  if (iso) setDeadline(iso);
                }}
                onBlur={() => {
                  const iso = viDateToIso(deadlineText) || deadline;
                  if (iso) {
                    setDeadline(iso);
                    setDeadlineText(isoToViDate(iso));
                  }
                }}
                disabled={busy || !canAssign}
                data-testid="ahd-deadline"
                aria-label="Deadline Solutions (dd/MM/yyyy)"
              />
            </label>
            <label className="ahd-field">
              <span>Yêu cầu / Ghi chú cho Marketing</span>
              <textarea
                value={assignNote}
                onChange={(e) => setAssignNote(e.target.value)}
                disabled={busy || !canAssign}
                data-testid="ahd-assign-note"
                rows={5}
              />
            </label>
            <button
              type="button"
              className="ahd-btn ahd-btn--primary ahd-btn--block"
              data-testid="ahd-assign"
              disabled={busy || Boolean(assignDisabledReason())}
              onClick={() => void assignToMarketing()}
            >
              <Icon d={I.arrow} size={15} />
              Giao cho Marketing
            </button>
          </section>
        </div>
      </div>

      {returnOpen ? (
        <div className="ahd-modal-back" role="dialog" aria-labelledby="ahd-return-title">
          <div className="ahd-modal">
            <h3 id="ahd-return-title">Trả về Sales</h3>
            <p>{HANDOFF_FLOW_COPY.confirmReturn}</p>
            <label className="ahd-field">
              <span>
                Lý do <span className="ahd-req">*</span>
              </span>
              <textarea
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                rows={4}
                data-testid="ahd-return-reason"
                placeholder="Thông tin còn thiếu…"
              />
            </label>
            <div className="ahd-modal__actions">
              <button type="button" className="ahd-btn ahd-btn--ghost" onClick={() => setReturnOpen(false)} disabled={busy}>
                Hủy
              </button>
              <button type="button" className="ahd-btn ahd-btn--primary" data-testid="ahd-return-confirm" onClick={() => void confirmReturn()} disabled={busy}>
                Trả về Sales
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
