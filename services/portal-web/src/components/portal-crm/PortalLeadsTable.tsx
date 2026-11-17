'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from 'react';
import type { PortalCareCase, PortalDeskPage, PortalLeadFunnel } from '@/lib/api';
import { fetchPortalLeadsFunnel, fetchPortalStaff } from '@/lib/api';
import './portal-leads-pancake.css';
import './portal-leads-pro.css';
import {
  EMPTY_LEAD_FILTERS,
  filterLeadRows,
  formatLeadFunnelRatio,
  formatLeadPhoneDisplay,
  groupLeadFunnel,
  LEAD_STATUS_ORDER,
  leadFormLabel,
  leadKpis,
  leadInteractedAt,
  leadKanbanDropAction,
  leadOccurredAt,
  leadPhone,
  leadPhoneHref,
  leadSource,
  leadTagColor,
  paginateRows,
  saigonDateKey,
  STANDARD_LEAD_TAGS,
  uniqueLeadChannels,
  uniqueLeadForms,
  uniqueLeadSources,
  uniqueLeadTagsForFilter,
  type LeadFunnelGroupRow,
  type LeadTableFilters,
} from '@/lib/portal/portal-leads-table.util';
import {
  leadAgeLabel,
  leadSla,
  leadsToCsv,
  pagerWindow,
  sortLeadRows,
  staffLabel,
  toneFor,
  type LeadSortKey,
} from '@/lib/portal/portal-leads-pro.util';
import { formatSaigonDateTime, PortalLeadPanel, type LeadLabelCatalog } from '@/components/portal-crm/PortalLeadDrawer';
import { LEAD_STATUS_LABEL, PlAvatar, PlIcon, PlStatus } from '@/components/portal-crm/PortalLeadBits';
import { PortalDateRange } from '@/components/portal/PortalDateRange';
import { canActOnCase, canManagePortal, isPortalReadOnly } from '@/lib/portal-role';

type Quick = '' | 'mine' | 'unassigned' | 'overdue' | 'today';
type Toast = { id: number; tone: 'ok' | 'err'; text: string };

const PAGE_SIZES = [20, 50, 100];
const SKELETON_ROWS = 8;

function PageBadge({ id, label }: { id: string; label: string }) {
  return (
    <span className="pl-page" title={label}>
      <i style={{ background: toneFor(id) }} />
      <span>{label}</span>
    </span>
  );
}

/** Tags that never half-cut: shows as many whole tags as fit, then "+n". */
function Tags({ names, labels, max = 3 }: { names: string[]; labels: LeadLabelCatalog; max?: number }) {
  const boxRef = useRef<HTMLSpanElement | null>(null);
  const measureRef = useRef<HTMLSpanElement | null>(null);
  const capped = names.slice(0, max);
  const [fit, setFit] = useState(capped.length);
  const key = names.join('|');
  useLayoutEffect(() => {
    const box = boxRef.current;
    const measure = measureRef.current;
    if (!box || !measure) return;
    const compute = () => {
      const avail = box.clientWidth;
      const widths = [...measure.children].map((el) => (el as HTMLElement).offsetWidth);
      const more = 30;
      const gap = 4;
      let used = 0;
      let count = 0;
      for (let i = 0; i < Math.min(widths.length, max); i += 1) {
        const restAfter = names.length - (i + 1);
        const need = used + (i ? gap : 0) + widths[i] + (restAfter > 0 ? gap + more : 0);
        if (need > avail) break;
        used += (i ? gap : 0) + widths[i];
        count += 1;
      }
      setFit(count);
    };
    compute();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(compute) : null;
    ro?.observe(box);
    return () => ro?.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, max]);
  if (!names.length) return <span className="pl-na">—</span>;
  const shown = names.slice(0, fit);
  const rest = names.length - shown.length;
  return (
    <span className="pl-tags" ref={boxRef} title={names.join(', ')}>
      {shown.map((name) => (
        <span key={name} className="pl-tag" style={{ ['--tag' as string]: leadTagColor(name, labels) }}>
          {name}
        </span>
      ))}
      {rest > 0 ? <span className="pl-tag pl-tag--more">{shown.length ? `+${rest}` : `${rest} thẻ`}</span> : null}
      <span className="pl-tags__measure" ref={measureRef} aria-hidden="true">
        {capped.map((name) => (
          <span key={name} className="pl-tag">
            {name}
          </span>
        ))}
      </span>
    </span>
  );
}

export function PortalLeadsTable({
  rows,
  pages,
  staff,
  role,
  userId,
  busy,
  loading = false,
  error = '',
  onOpen,
  onAct,
  onBulk,
  token,
  labels = [],
  messages = [],
  onNotes,
  refreshedLabel = '',
  alerts = [],
}: {
  rows: PortalCareCase[];
  pages: PortalDeskPage[];
  staff: Array<{ id: string; email: string }>;
  role: string;
  userId: string;
  busy: boolean;
  loading?: boolean;
  error?: string;
  onOpen: (id: string) => Promise<void>;
  onAct: (id: string, action: string, body?: Record<string, string>) => void;
  /** Sequential multi-lead action; resolves true when every call succeeded. */
  onBulk?: (ids: string[], action: string, body?: Record<string, string>) => Promise<boolean>;
  token?: string;
  labels?: LeadLabelCatalog;
  messages?: PortalCareCase[];
  onNotes?: (id: string, notes: string) => void;
  refreshedLabel?: string;
  alerts?: string[];
}) {
  const [filters, setFilters] = useState<LeadTableFilters>(EMPTY_LEAD_FILTERS);
  const [quick, setQuick] = useState<Quick>('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0]);
  const [sort, setSort] = useState<{ key: LeadSortKey; dir: 'asc' | 'desc' }>({ key: 'recent', dir: 'desc' });
  const [openId, setOpenId] = useState<string | null>(null);
  const [view, setView] = useState<'list' | 'kanban' | 'compare'>('list');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [funnel, setFunnel] = useState<PortalLeadFunnel | null>(null);
  const [funnelLoading, setFunnelLoading] = useState(false);
  const [staffNames, setStaffNames] = useState<Record<string, string>>({});
  const [overStatus, setOverStatus] = useState('');
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  const [moreOpen, setMoreOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [hiddenError, setHiddenError] = useState('');
  const moreRef = useRef<HTMLDivElement | null>(null);
  const toastSeq = useRef(0);

  const readOnly = isPortalReadOnly(role);
  const canManage = canManagePortal(role);
  const pageName = useMemo(() => new Map(pages.map((item) => [item.page_id, item.page_name || item.page_id])), [pages]);
  const sources = useMemo(() => uniqueLeadSources(rows), [rows]);
  const channels = useMemo(() => uniqueLeadChannels(rows), [rows]);
  const forms = useMemo(() => uniqueLeadForms(rows), [rows]);
  const tags = useMemo(() => uniqueLeadTagsForFilter(rows), [rows]);
  const kpiRows = useMemo(() => filterLeadRows(rows, { ...filters, status: '' }, pageName, { ignoreStatus: true }), [rows, filters, pageName]);
  const localKpis = useMemo(() => leadKpis(kpiRows), [kpiRows]);
  const kpis = funnel?.kpis ?? localKpis;
  const kpiBusy = loading || funnelLoading;
  const groups = useMemo(() => {
    if (funnel) return { by_page: funnel.by_page, by_channel: funnel.by_channel, by_form: funnel.by_form, by_staff: funnel.by_staff };
    return groupLeadFunnel(kpiRows, pageName);
  }, [funnel, kpiRows, pageName]);
  const assignees = useMemo(() => {
    const byId = new Map(staff.map((item) => [item.id, item] as const));
    for (const row of rows) {
      if (row.assignee_user_id && !byId.has(row.assignee_user_id)) {
        byId.set(row.assignee_user_id, { id: row.assignee_user_id, email: row.assignee_email || row.assignee_user_id });
      }
    }
    return [...byId.values()];
  }, [staff, rows]);

  const ownerOf = (row: PortalCareCase) => staffLabel(row.assignee_user_id, row.assignee_email, staffNames);
  const todayKey = saigonDateKey(new Date(now).toISOString());

  function matchQuick(row: PortalCareCase, q: Quick): boolean {
    if (q === 'mine') return Boolean(userId) && row.assignee_user_id === userId;
    if (q === 'unassigned') return !row.assignee_user_id;
    if (q === 'overdue') return leadSla(row, now).tone === 'over';
    if (q === 'today') return saigonDateKey(leadOccurredAt(row)) === todayKey;
    return true;
  }

  const visible = useMemo(() => {
    const filtered = filterLeadRows(rows, filters, pageName).filter((row) => matchQuick(row, quick));
    return sortLeadRows(filtered, sort.key, sort.dir);
    // matchQuick depends on now/userId/todayKey only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, filters, pageName, quick, sort, now, userId]);
  const paged = paginateRows(visible, page, pageSize);
  const selected = rows.find((row) => row.id === openId) ?? null;

  const quickCounts = useMemo(() => {
    const count = (q: Quick) => kpiRows.filter((row) => matchQuick(row, q)).length;
    return { mine: count('mine'), unassigned: count('unassigned'), overdue: count('overdue'), today: count('today') };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kpiRows, now, userId]);
  const tagCounts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const row of kpiRows) for (const name of row.labels ?? []) out[name] = (out[name] ?? 0) + 1;
    return out;
  }, [kpiRows]);
  const statusCounts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const row of kpiRows) out[row.status] = (out[row.status] ?? 0) + 1;
    return out;
  }, [kpiRows]);

  const moreCount = [filters.channel, filters.source, filters.status].filter(Boolean).length;
  const anyFilter =
    quick !== '' ||
    Object.entries(filters).some(([key, value]) => key !== 'from' && key !== 'to' && Boolean(value));

  /* ---------- effects ---------- */
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!openId) return;
    void onOpen(openId).catch(() => {
      /* list row is enough to render the drawer */
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId]);

  useEffect(() => {
    if (!openId) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openId]);

  useEffect(() => {
    if (!moreOpen) return;
    const onDown = (event: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(event.target as Node)) setMoreOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMoreOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [moreOpen]);

  useEffect(() => {
    if (!token) {
      setFunnel(null);
      return;
    }
    let cancelled = false;
    setFunnelLoading(true);
    void fetchPortalLeadsFunnel(token, {
      from: filters.from || undefined,
      to: filters.to || undefined,
      page_id: filters.pageId || undefined,
      channel: filters.channel || undefined,
      form_id: filters.formId || undefined,
      assignee: filters.assignee || undefined,
      tag: filters.tag || undefined,
    })
      .then((data) => {
        if (!cancelled) setFunnel(data);
      })
      .catch(() => {
        if (!cancelled) setFunnel(null);
      })
      .finally(() => {
        if (!cancelled) setFunnelLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, filters.from, filters.to, filters.pageId, filters.channel, filters.formId, filters.assignee, filters.tag]);

  useEffect(() => {
    // Staff directory (display names) is an owner-only endpoint; others keep email labels.
    if (!token || !canManage) return;
    let cancelled = false;
    void fetchPortalStaff(token)
      .then((data) => {
        if (cancelled) return;
        const next: Record<string, string> = {};
        for (const item of data.staff ?? []) {
          const name = String(item.display_name || '').trim();
          if (item.id && name) next[item.id] = name;
        }
        setStaffNames(next);
      })
      .catch(() => {
        /* email labels remain */
      });
    return () => {
      cancelled = true;
    };
  }, [token, canManage]);

  useEffect(() => {
    setPicked((current) => {
      if (!current.size) return current;
      const ids = new Set(visible.map((row) => row.id));
      const next = new Set([...current].filter((id) => ids.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [visible]);

  /* ---------- helpers ---------- */
  function toast(text: string, tone: Toast['tone'] = 'err') {
    toastSeq.current += 1;
    const id = toastSeq.current;
    setToasts((current) => [...current.slice(-2), { id, tone, text }]);
    window.setTimeout(() => setToasts((current) => current.filter((item) => item.id !== id)), 2000);
  }

  function patch(next: Partial<LeadTableFilters>) {
    setFilters((current) => ({ ...current, ...next }));
    setPage(1);
  }

  function pickQuick(next: Quick) {
    setQuick((current) => (current === next ? '' : next));
    setPage(1);
  }

  function resetFilters() {
    setFilters((current) => ({ ...EMPTY_LEAD_FILTERS, from: current.from, to: current.to }));
    setQuick('');
    setPage(1);
  }

  function toggleSort(key: LeadSortKey) {
    setSort((current) =>
      current.key === key ? { key, dir: current.dir === 'desc' ? 'asc' : 'desc' } : { key, dir: key === 'name' ? 'asc' : 'desc' },
    );
  }

  function canAct(row: PortalCareCase): boolean {
    return canActOnCase(role, row.assignee_user_id, userId);
  }

  function canDrag(row: PortalCareCase): boolean {
    if (row.status === 'purchased') return false;
    return canAct(row);
  }

  function dropOn(toStatus: string, event: DragEvent) {
    event.preventDefault();
    setOverStatus('');
    const id = event.dataTransfer.getData('text/lead-id') || event.dataTransfer.getData('text/plain');
    const row = rows.find((item) => item.id === id);
    if (!row) return;
    if (!canDrag(row)) {
      toast(readOnly ? 'Tài khoản Chỉ xem không đổi được trạng thái.' : 'Chỉ người phụ trách (hoặc quản lý) mới đổi trạng thái lead đã gán.');
      return;
    }
    const result = leadKanbanDropAction(row.status, toStatus);
    if (!result.ok) {
      if (result.reason === 'same') return;
      toast(
        result.reason === 'already_purchased'
          ? 'Lead đã mua hàng — không đổi trạng thái.'
          : 'Không chuyển được trạng thái này. Dùng Nhận lead / Đang chăm sóc theo quy trình.',
      );
      return;
    }
    if (result.action === 'purchase' && !window.confirm('Chuyển lead này sang Mua hàng?')) return;
    onAct(row.id, result.action);
  }

  function exportCsv() {
    const csv = leadsToCsv(visible, pageName, LEAD_STATUS_LABEL, ownerOf);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `lead-${saigonDateKey(new Date().toISOString())}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast(`Đã xuất ${visible.length} lead`, 'ok');
  }

  async function bulk(action: string, ids: string[], body?: Record<string, string>, done = '') {
    if (!onBulk || !ids.length) return;
    const ok = await onBulk(ids, action, body);
    if (ok) {
      toast(done || `Đã cập nhật ${ids.length} lead`, 'ok');
      setPicked(new Set());
    }
  }

  const pickable = readOnly ? [] : paged.items.filter((row) => canAct(row));
  const allPicked = pickable.length > 0 && pickable.every((row) => picked.has(row.id));
  const pickedRows = rows.filter((row) => picked.has(row.id));
  const showCheck = !readOnly;
  const colCount = showCheck ? 10 : 9;

  /* ---------- render ---------- */
  const kpiCards: Array<{ key: string; label: string; value: number; hint: string; icon: string; status?: string; quick?: Quick }> = [
    { key: 'total', label: 'Tổng', value: kpis.total, hint: 'trong khoảng ngày', icon: 'users' },
    { key: 'waiting', label: 'Chờ nhận', value: kpis.waiting, hint: `${formatLeadFunnelRatio(kpis.waiting, kpis.total)} tổng`, icon: 'clock', status: 'waiting_receive' },
    { key: 'assigned', label: 'Đã gán', value: kpis.assigned, hint: `${formatLeadFunnelRatio(kpis.assigned, kpis.total)} tổng`, icon: 'user' },
    { key: 'converted', label: 'Đã chuyển khách', value: kpis.converted, hint: `${formatLeadFunnelRatio(kpis.converted, kpis.total)} tổng`, icon: 'check' },
    { key: 'today', label: 'Hôm nay', value: kpis.today, hint: 'lead mới hôm nay', icon: 'spark', quick: 'today' },
  ];
  const ratioPct = kpis.total ? Math.min(100, (kpis.converted / kpis.total) * 100) : 0;

  return (
    <div className={`pl pl--${view}`}>
      <header className="pl-head">
        <div className="pl-head__title">
          <h1>Lead</h1>
          <p>
            {loading ? 'Đang tải lead…' : `${rows.length} lead · ${pages.length} Page`}
            {refreshedLabel ? <span> · Cập nhật lúc {refreshedLabel}</span> : null}
            {readOnly ? (
              <span className="pl-ro">
                <PlIcon name="eye" size={13} /> Chỉ xem
              </span>
            ) : null}
          </p>
        </div>
        <div className="pl-head__actions">
          <PortalDateRange from={filters.from} to={filters.to} onChange={(next) => patch({ from: next.from, to: next.to })} />
          {canManage ? (
            <button type="button" className="pl-btn" onClick={exportCsv} disabled={loading || visible.length === 0} title="Xuất danh sách đang lọc ra CSV">
              <PlIcon name="download" /> Xuất CSV
            </button>
          ) : null}
        </div>
      </header>

      {alerts.length ? (
        <div className="pl-alert" role="note" title={alerts.join('\n')}>
          <strong>Lưu ý kết nối:</strong> <span>{alerts[0]}</span>
          {alerts.length > 1 ? <em>+{alerts.length - 1}</em> : null}
        </div>
      ) : null}

      <section className={'pl-kpis' + (kpiBusy ? ' is-loading' : '')} aria-label="Phễu lead" data-qa="kpis">
        {kpiCards.map((card) => {
          const active = (card.status && filters.status === card.status) || (card.quick && quick === card.quick);
          const clickable = Boolean(card.status || card.quick);
          const inner = (
            <>
              <span className="pl-kpi__top">
                <span className="pl-kpi__label">{card.label}</span>
                <span className="pl-kpi__icon">
                  <PlIcon name={card.icon} size={15} />
                </span>
              </span>
              <span className="pl-kpi__value" data-qa="kpi-value">
                {kpiBusy ? <span className="pl-skel pl-skel--num" /> : card.value.toLocaleString('vi-VN')}
              </span>
              <span className="pl-kpi__hint">{kpiBusy ? '\u00a0' : card.hint}</span>
            </>
          );
          return clickable ? (
            <button
              key={card.key}
              type="button"
              data-qa="kpi"
              className={'pl-kpi is-click' + (active ? ' is-on' : '')}
              aria-pressed={Boolean(active)}
              onClick={() => (card.status ? patch({ status: filters.status === card.status ? '' : card.status }) : pickQuick(card.quick as Quick))}
            >
              {inner}
            </button>
          ) : (
            <div key={card.key} className="pl-kpi" data-qa="kpi">
              {inner}
            </div>
          );
        })}
        <div className="pl-kpi pl-kpi--ratio" data-qa="kpi">
          <span className="pl-kpi__top">
            <span className="pl-kpi__label">Tỷ lệ chuyển đổi</span>
            <span className="pl-kpi__icon">
              <PlIcon name="trend" size={15} />
            </span>
          </span>
          <span className="pl-kpi__value" data-qa="kpi-value">
            {kpiBusy ? <span className="pl-skel pl-skel--num" /> : formatLeadFunnelRatio(kpis.converted, kpis.total)}
          </span>
          <span className="pl-kpi__bar" aria-hidden="true">
            <span style={{ width: `${kpiBusy ? 0 : ratioPct}%` }} />
          </span>
          <span className="pl-kpi__hint">{kpiBusy ? '\u00a0' : `${kpis.converted} đã chuyển khách / ${kpis.total} lead`}</span>
        </div>
      </section>

      <section className="pl-toolbar" aria-label="Lọc lead" data-qa="toolbar">
        <div className="pl-toolbar__row">
          <label className="pl-search">
            <PlIcon name="search" />
            <span className="sr-only">Tìm lead</span>
            <input
              type="search"
              value={filters.query}
              onChange={(event) => patch({ query: event.target.value })}
              placeholder="Tìm tên, SĐT, email, Page, thẻ…"
            />
          </label>
          <label className="pl-select">
            <span>Page</span>
            <select value={filters.pageId} onChange={(event) => patch({ pageId: event.target.value })}>
              <option value="">Tất cả Page</option>
              {pages.map((item) => (
                <option key={item.page_id} value={item.page_id}>
                  {item.page_name || item.page_id}
                </option>
              ))}
            </select>
          </label>
          <label className="pl-select">
            <span>Nguồn / Biểu mẫu</span>
            <select value={filters.formId} onChange={(event) => patch({ formId: event.target.value })}>
              <option value="">Tất cả biểu mẫu</option>
              {forms.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="pl-select">
            <span>Nhân viên</span>
            <select value={filters.assignee} onChange={(event) => patch({ assignee: event.target.value })}>
              <option value="">Tất cả nhân viên</option>
              <option value="unassigned">Chưa gán</option>
              {assignees.map((item) => (
                <option key={item.id} value={item.id}>
                  {staffNames[item.id] || item.email}
                </option>
              ))}
            </select>
          </label>
          <div className="pl-more" ref={moreRef}>
            <button type="button" className={'pl-btn' + (moreCount ? ' is-on' : '')} aria-expanded={moreOpen} onClick={() => setMoreOpen((open) => !open)}>
              <PlIcon name="filter" /> Bộ lọc{moreCount ? ` (${moreCount})` : ''}
            </button>
            {moreOpen ? (
              <div className="pl-more__pop" role="dialog" aria-label="Bộ lọc khác">
                <label className="pl-select">
                  <span>Trạng thái</span>
                  <select value={filters.status} onChange={(event) => patch({ status: event.target.value })}>
                    <option value="">Tất cả trạng thái</option>
                    {Object.entries(LEAD_STATUS_LABEL).map(([id, label]) => (
                      <option key={id} value={id}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="pl-select">
                  <span>Kênh</span>
                  <select value={filters.channel} onChange={(event) => patch({ channel: event.target.value })}>
                    <option value="">Tất cả kênh</option>
                    {channels.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="pl-select">
                  <span>Chiến dịch</span>
                  <select value={filters.source} onChange={(event) => patch({ source: event.target.value })}>
                    <option value="">Tất cả chiến dịch</option>
                    {sources.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="pl-select">
                  <span>Thẻ</span>
                  <select value={filters.tag} onChange={(event) => patch({ tag: event.target.value })}>
                    <option value="">Tất cả thẻ</option>
                    {tags.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="pl-more__foot">
                  <button type="button" className="pl-link" onClick={resetFilters}>
                    Xóa tất cả lọc
                  </button>
                  <button type="button" className="pl-btn pl-btn--primary" onClick={() => setMoreOpen(false)}>
                    Xong
                  </button>
                </div>
              </div>
            ) : null}
          </div>
          {anyFilter ? (
            <button type="button" className="pl-link pl-reset" onClick={resetFilters}>
              <PlIcon name="x" size={14} /> Xóa lọc
            </button>
          ) : (
            <span className="pl-reset pl-reset--ghost" aria-hidden="true" />
          )}
          <div className="pl-views" role="tablist" aria-label="Kiểu xem lead">
            <button type="button" role="tab" aria-selected={view === 'list'} className={view === 'list' ? 'is-on' : undefined} onClick={() => setView('list')}>
              <PlIcon name="list" size={15} /> Danh sách
            </button>
            <button type="button" role="tab" aria-selected={view === 'kanban'} className={view === 'kanban' ? 'is-on' : undefined} onClick={() => setView('kanban')}>
              <PlIcon name="board" size={15} /> Kanban
            </button>
            <button type="button" role="tab" aria-selected={view === 'compare'} className={view === 'compare' ? 'is-on' : undefined} onClick={() => { setView('compare'); setOpenId(null); }}>
              <PlIcon name="chart" size={15} /> So sánh
            </button>
          </div>
        </div>

        <div className="pl-toolbar__row pl-toolbar__row--chips">
          <div className="pl-chips" role="group" aria-label="Lọc nhanh">
            <Chip on={!quick && !filters.status && !filters.tag} onClick={() => { setQuick(''); patch({ status: '', tag: '' }); }} count={kpiRows.length}>
              Tất cả
            </Chip>
            <Chip on={filters.status === 'waiting_receive'} qa="chip-waiting" count={statusCounts.waiting_receive ?? 0} tone="amber" onClick={() => patch({ status: filters.status === 'waiting_receive' ? '' : 'waiting_receive' })}>
              Chờ nhận
            </Chip>
            {!readOnly ? (
              <Chip on={quick === 'mine'} count={quickCounts.mine} onClick={() => pickQuick('mine')}>
                Của tôi
              </Chip>
            ) : null}
            <Chip on={quick === 'unassigned'} count={quickCounts.unassigned} onClick={() => pickQuick('unassigned')}>
              Chưa gán
            </Chip>
            <Chip on={quick === 'overdue'} count={quickCounts.overdue} tone="red" onClick={() => pickQuick('overdue')}>
              Quá hạn
            </Chip>
            <span className="pl-chips__sep" aria-hidden="true" />
            {STANDARD_LEAD_TAGS.map((name) => (
              <Chip
                key={name}
                on={filters.tag === name}
                count={tagCounts[name] ?? 0}
                dot={leadTagColor(name, labels)}
                onClick={() => patch({ tag: filters.tag === name ? '' : name })}
              >
                {name}
              </Chip>
            ))}
          </div>
          {picked.size > 0 ? (
            <div className="pl-bulk" role="toolbar" aria-label="Thao tác hàng loạt">
              <strong>Đã chọn {picked.size}</strong>
              {canManage && staff.length > 0 ? (
                <select
                  className="pl-bulk__select"
                  value=""
                  disabled={busy}
                  aria-label="Gán cho nhân viên"
                  onChange={(event) => {
                    const user_id = event.target.value;
                    if (!user_id) return;
                    const who = staffNames[user_id] || staff.find((item) => item.id === user_id)?.email || '';
                    void bulk('assign', [...picked], { user_id }, `Đã gán ${picked.size} lead cho ${who}`);
                  }}
                >
                  <option value="">Gán cho…</option>
                  {staff.map((item) => (
                    <option key={item.id} value={item.id}>
                      {staffNames[item.id] || item.email}
                    </option>
                  ))}
                </select>
              ) : null}
              {(() => {
                const ids = pickedRows.filter((row) => row.status === 'waiting_receive').map((row) => row.id);
                return ids.length ? (
                  <button type="button" className="pl-btn" disabled={busy} onClick={() => void bulk('receive', ids, undefined, `Đã nhận ${ids.length} lead`)}>
                    <PlIcon name="check" /> Nhận lead ({ids.length})
                  </button>
                ) : null;
              })()}
              <select
                className="pl-bulk__select"
                value=""
                disabled={busy}
                aria-label="Gắn thẻ"
                onChange={(event) => {
                  const name = event.target.value;
                  if (!name) return;
                  const ids = pickedRows.filter((row) => !(row.labels ?? []).includes(name)).map((row) => row.id);
                  if (!ids.length) {
                    toast('Các lead đã chọn đều có thẻ này.', 'ok');
                    return;
                  }
                  void bulk('label', ids, { name, color: leadTagColor(name, labels) }, `Đã gắn thẻ "${name}" cho ${ids.length} lead`);
                }}
              >
                <option value="">Gắn thẻ…</option>
                {tags.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
              <button type="button" className="pl-link" onClick={() => setPicked(new Set())}>
                Bỏ chọn
              </button>
            </div>
          ) : null}
        </div>
      </section>

      <section className="pl-body" data-qa="body">
        {view === 'compare' ? (
          <LeadComparePanels groups={groups} loading={kpiBusy} staffNames={staffNames} />
        ) : view === 'kanban' ? (
          <div className="pl-board" aria-label="Kanban theo trạng thái lead">
            {LEAD_STATUS_ORDER.map((status) => {
              const items = visible.filter((row) => row.status === status);
              const droppable = !readOnly && (status === 'received' || status === 'caring' || status === 'purchased');
              const value = items.reduce((sum, row) => sum + (Number(row.order?.price_vnd) || 0), 0);
              return (
                <section
                  key={status}
                  className={`pl-col pl-col--${status}` + (overStatus === status ? ' is-over' : '')}
                  onDragOver={(event) => {
                    if (!droppable) return;
                    event.preventDefault();
                    event.dataTransfer.dropEffect = 'move';
                    if (overStatus !== status) setOverStatus(status);
                  }}
                  onDragLeave={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget as Node | null) && overStatus === status) setOverStatus('');
                  }}
                  onDrop={(event) => dropOn(status, event)}
                >
                  <header className="pl-col__head" data-qa="kanban-col-head">
                    <span className="pl-col__name">
                      <i />
                      {LEAD_STATUS_LABEL[status]}
                    </span>
                    <span className="pl-col__count">{loading ? '…' : items.length}</span>
                    <span className="pl-col__sub">{value > 0 ? `${value.toLocaleString('vi-VN')} ₫` : '\u00a0'}</span>
                  </header>
                  <div className="pl-col__body">
                    {loading
                      ? Array.from({ length: 3 }, (_, i) => <div key={i} className="pl-card pl-card--skel"><span className="pl-skel" /><span className="pl-skel pl-skel--short" /></div>)
                      : null}
                    {!loading && items.length === 0 ? (
                      <p className="pl-col__empty">{droppable ? 'Kéo lead vào đây' : 'Không có lead'}</p>
                    ) : null}
                    {items.map((row) => (
                      <KanbanCard
                        key={row.id}
                        row={row}
                        now={now}
                        selected={openId === row.id}
                        draggable={canDrag(row)}
                        pageLabel={pageName.get(row.page_id) || row.page_id}
                        owner={ownerOf(row)}
                        labels={labels}
                        onOpen={() => setOpenId(row.id)}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        ) : (
          <div className="pl-tablecard">
            <div className="pl-tablewrap" data-qa="table-wrap">
              <table className="pl-table">
                <colgroup>
                  {showCheck ? <col className="c-check" /> : null}
                  <col className="c-name" />
                  <col className="c-phone" />
                  <col className="c-page" />
                  <col className="c-source" />
                  <col className="c-status" />
                  <col className="c-tags" />
                  <col className="c-owner" />
                  <col className="c-time" />
                  <col className="c-act" />
                </colgroup>
                <thead>
                  <tr>
                    {showCheck ? (
                      <th className="c-check">
                        <input
                          type="checkbox"
                          aria-label="Chọn tất cả lead trên trang"
                          checked={allPicked}
                          disabled={pickable.length === 0}
                          onChange={() =>
                            setPicked((current) => {
                              const next = new Set(current);
                              if (allPicked) pickable.forEach((row) => next.delete(row.id));
                              else pickable.forEach((row) => next.add(row.id));
                              return next;
                            })
                          }
                        />
                      </th>
                    ) : null}
                    <SortTh label="Khách hàng" k="name" sort={sort} onSort={toggleSort} />
                    <th>SĐT</th>
                    <th>Page</th>
                    <th>Nguồn</th>
                    <SortTh label="Trạng thái" k="status" sort={sort} onSort={toggleSort} />
                    <th>Thẻ</th>
                    <th>Phụ trách</th>
                    <SortTh label="Thời gian" k="recent" sort={sort} onSort={toggleSort} />
                    <th className="c-act">
                      <span className="sr-only">Thao tác</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: SKELETON_ROWS }, (_, i) => (
                      <tr key={`s${i}`} className="is-skel" aria-hidden="true">
                        {showCheck ? <td /> : null}
                        <td>
                          <span className="pl-cell-name">
                            <span className="pl-avatar pl-avatar--md pl-skel-bg" />
                            <span className="pl-skel" />
                          </span>
                        </td>
                        {Array.from({ length: 7 }, (_, j) => (
                          <td key={j}>
                            <span className="pl-skel pl-skel--short" />
                          </td>
                        ))}
                        <td />
                      </tr>
                    ))
                  ) : error && rows.length === 0 ? (
                    <tr>
                      <td colSpan={colCount}>
                        <EmptyState icon="inbox" title="Không tải được danh sách lead" body="Kiểm tra kết nối rồi tải lại trang." />
                      </td>
                    </tr>
                  ) : paged.items.length === 0 ? (
                    <tr>
                      <td colSpan={colCount}>
                        {rows.length === 0 ? (
                          <EmptyState icon="inbox" title="Chưa có lead" body="Khi Page đang gắn có lead mới từ biểu mẫu, tin nhắn hoặc bình luận, lead sẽ hiện ở đây." />
                        ) : (
                          <EmptyState
                            icon="search"
                            title="Không có lead khớp bộ lọc"
                            body="Thử bỏ bớt điều kiện lọc hoặc mở rộng khoảng ngày."
                            action={
                              <button type="button" className="pl-btn" onClick={resetFilters}>
                                Xóa lọc
                              </button>
                            }
                          />
                        )}
                      </td>
                    </tr>
                  ) : (
                    paged.items.map((row) => {
                      const phone = leadPhone(row);
                      const phoneDisplay = formatLeadPhoneDisplay(phone);
                      const form = leadFormLabel(row);
                      const campaign = leadSource(row);
                      const pageLabel = pageName.get(row.page_id) || row.page_id;
                      const owner = ownerOf(row);
                      const sla = leadSla(row, now);
                      const actable = canAct(row);
                      const when = leadInteractedAt(row);
                      return (
                        <tr
                          key={row.id}
                          data-qa="row"
                          className={(openId === row.id ? 'is-open' : '') + (picked.has(row.id) ? ' is-picked' : '')}
                          onClick={() => setOpenId(row.id)}
                        >
                          {showCheck ? (
                            <td className="c-check" onClick={(event) => event.stopPropagation()}>
                              <input
                                type="checkbox"
                                aria-label={`Chọn ${row.title || 'lead'}`}
                                checked={picked.has(row.id)}
                                disabled={!actable}
                                title={actable ? undefined : 'Chỉ người phụ trách mới thao tác lead này'}
                                onChange={() =>
                                  setPicked((current) => {
                                    const next = new Set(current);
                                    if (next.has(row.id)) next.delete(row.id);
                                    else next.add(row.id);
                                    return next;
                                  })
                                }
                              />
                            </td>
                          ) : null}
                          <td>
                            <span className="pl-cell-name">
                              <PlAvatar name={row.title || 'Lead'} seed={row.id} />
                              <span className="pl-cell-name__text">
                                <strong title={row.title || 'Lead'}>{row.title || 'Lead'}</strong>
                                <small title={row.snippet || ''}>{row.customer_id ? 'Đã là khách hàng' : row.snippet || '\u00a0'}</small>
                              </span>
                            </span>
                          </td>
                          <td className="c-phone-cell">
                            {phoneDisplay ? (
                              <a className="pl-phone" href={leadPhoneHref(phone)} onClick={(event) => event.stopPropagation()} title={`Gọi ${phoneDisplay}`}>
                                {phoneDisplay}
                              </a>
                            ) : (
                              <span className="pl-na">—</span>
                            )}
                          </td>
                          <td>
                            <PageBadge id={row.page_id} label={pageLabel} />
                          </td>
                          <td>
                            <span className="pl-two">
                              <span title={form}>{form || '—'}</span>
                              <small title={campaign}>{campaign || '\u00a0'}</small>
                            </span>
                          </td>
                          <td className="c-status-cell">
                            <PlStatus status={row.status} />
                          </td>
                          <td>
                            <Tags names={row.labels ?? []} labels={labels} />
                          </td>
                          <td>
                            {owner ? (
                              <span className="pl-owner" title={row.assignee_email || owner}>
                                <PlAvatar name={owner} seed={row.assignee_user_id || owner} size="sm" />
                                <span>{owner}</span>
                              </span>
                            ) : (
                              <span className="pl-owner pl-owner--none">Chưa gán</span>
                            )}
                          </td>
                          <td>
                            <span className="pl-two" title={formatSaigonDateTime(when)}>
                              <span>{leadAgeLabel(when, now) || '—'}</span>
                              {sla.tone ? (
                                <small className={`pl-sla pl-sla--${sla.tone}`} title={sla.title}>
                                  {sla.label}
                                </small>
                              ) : (
                                <small>{formatSaigonDateTime(when).split(' ')[0] || '\u00a0'}</small>
                              )}
                            </span>
                          </td>
                          <td className="c-act" onClick={(event) => event.stopPropagation()}>
                            <span className="pl-rowact">
                              {!readOnly && actable && row.status === 'waiting_receive' ? (
                                <button type="button" className="pl-iconbtn pl-iconbtn--accent" title="Nhận lead" aria-label="Nhận lead" disabled={busy} onClick={() => onAct(row.id, 'receive')}>
                                  <PlIcon name="check" />
                                </button>
                              ) : null}
                              {!readOnly && phoneDisplay ? (
                                <a className="pl-iconbtn" href={leadPhoneHref(phone)} title="Gọi" aria-label={`Gọi ${phoneDisplay}`}>
                                  <PlIcon name="phone" />
                                </a>
                              ) : null}
                              <button type="button" className="pl-iconbtn" title="Xem chi tiết" aria-label="Xem chi tiết" onClick={() => setOpenId(row.id)}>
                                <PlIcon name="chevron" />
                              </button>
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <footer className="pl-pager">
              <span className="pl-pager__info">
                {loading
                  ? 'Đang tải…'
                  : paged.total === 0
                    ? '0 lead'
                    : `${(paged.page - 1) * pageSize + 1}–${Math.min(paged.page * pageSize, paged.total)} / ${paged.total} lead`}
              </span>
              <span className="pl-pager__nav">
                <label className="pl-pager__size">
                  Hiển thị
                  <select
                    value={pageSize}
                    onChange={(event) => {
                      setPageSize(Number(event.target.value) || PAGE_SIZES[0]);
                      setPage(1);
                    }}
                  >
                    {PAGE_SIZES.map((size) => (
                      <option key={size} value={size}>
                        {size}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="button" className="pl-iconbtn" aria-label="Trang trước" disabled={paged.page <= 1} onClick={() => setPage(paged.page - 1)}>
                  <PlIcon name="left" />
                </button>
                {pagerWindow(paged.page, paged.pages).map((item, index) =>
                  item === '…' ? (
                    <span key={`e${index}`} className="pl-pager__gap">
                      …
                    </span>
                  ) : (
                    <button key={item} type="button" className={'pl-pager__num' + (item === paged.page ? ' is-on' : '')} aria-current={item === paged.page ? 'page' : undefined} onClick={() => setPage(item)}>
                      {item}
                    </button>
                  ),
                )}
                <button type="button" className="pl-iconbtn" aria-label="Trang sau" disabled={paged.page >= paged.pages} onClick={() => setPage(paged.page + 1)}>
                  <PlIcon name="chevron" />
                </button>
              </span>
            </footer>
          </div>
        )}
      </section>

      {view !== 'compare' && selected ? (
        <PortalLeadPanel
          row={selected}
          pages={pages}
          staff={staff}
          staffNames={staffNames}
          role={role}
          userId={userId}
          busy={busy}
          onAct={onAct}
          token={token}
          labels={labels}
          messages={messages}
          onNotes={onNotes}
          onClose={() => setOpenId(null)}
        />
      ) : null}

      <div className="pl-toasts" aria-live="polite">
        {toasts.map((item) => (
          <div key={item.id} className={`pl-toast pl-toast--${item.tone}`} role={item.tone === 'err' ? 'alert' : 'status'}>
            {item.text}
          </div>
        ))}
        {error && error !== hiddenError ? (
          <div className="pl-toast pl-toast--err pl-toast--sticky" role="alert">
            {error}
            <button type="button" className="pl-toast__x" aria-label="Đóng thông báo lỗi" onClick={() => setHiddenError(error)}>
              ×
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Chip({
  on,
  count,
  tone,
  dot,
  qa,
  onClick,
  children,
}: {
  on: boolean;
  count?: number;
  tone?: 'amber' | 'red';
  dot?: string;
  qa?: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button type="button" data-qa={qa} className={'pl-chip' + (on ? ' is-on' : '') + (tone ? ` pl-chip--${tone}` : '')} aria-pressed={on} onClick={onClick}>
      {dot ? <i style={{ background: dot }} /> : null}
      {children}
      {typeof count === 'number' ? <b>{count}</b> : null}
    </button>
  );
}

function SortTh({
  label,
  k,
  sort,
  onSort,
}: {
  label: string;
  k: LeadSortKey;
  sort: { key: LeadSortKey; dir: 'asc' | 'desc' };
  onSort: (key: LeadSortKey) => void;
}) {
  const active = sort.key === k;
  return (
    <th aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className={'pl-sort' + (active ? ' is-on' : '')} onClick={() => onSort(k)}>
        {label}
        <span aria-hidden="true">{active ? (sort.dir === 'asc' ? '▲' : '▼') : '↕'}</span>
      </button>
    </th>
  );
}

function EmptyState({ icon, title, body, action }: { icon: string; title: string; body: string; action?: ReactNode }) {
  return (
    <div className="pl-empty">
      <span className="pl-empty__icon">
        <PlIcon name={icon} size={22} />
      </span>
      <strong>{title}</strong>
      <p>{body}</p>
      {action}
    </div>
  );
}

function KanbanCard({
  row,
  now,
  selected,
  draggable,
  pageLabel,
  owner,
  labels,
  onOpen,
}: {
  row: PortalCareCase;
  now: number;
  selected: boolean;
  draggable: boolean;
  pageLabel: string;
  owner: string;
  labels: LeadLabelCatalog;
  onOpen: () => void;
}) {
  const phone = formatLeadPhoneDisplay(leadPhone(row));
  const sla = leadSla(row, now);
  const value = Number(row.order?.price_vnd) || 0;
  const when = leadInteractedAt(row);
  return (
    <button
      type="button"
      className={'pl-card' + (selected ? ' is-open' : '') + (draggable ? ' is-drag' : '')}
      draggable={draggable}
      onDragStart={(event) => {
        if (!draggable) {
          event.preventDefault();
          return;
        }
        event.dataTransfer.setData('text/lead-id', row.id);
        event.dataTransfer.setData('text/plain', row.id);
        event.dataTransfer.effectAllowed = 'move';
      }}
      onClick={onOpen}
    >
      <span className="pl-card__top">
        <PlAvatar name={row.title || 'Lead'} seed={row.id} size="sm" />
        <strong title={row.title || 'Lead'}>{row.title || 'Lead'}</strong>
        <time title={formatSaigonDateTime(when)}>{leadAgeLabel(when, now).replace(' trước', '')}</time>
      </span>
      <span className="pl-card__line">
        {phone ? <span className="pl-card__phone">{phone}</span> : <span className="pl-na">Chưa có SĐT</span>}
        {value > 0 ? <span className="pl-card__value">{value.toLocaleString('vi-VN')} ₫</span> : null}
      </span>
      <span className="pl-card__line">
        <PageBadge id={row.page_id} label={pageLabel} />
      </span>
      {(row.labels ?? []).length ? (
        <span className="pl-card__line">
          <Tags names={row.labels ?? []} labels={labels} max={3} />
        </span>
      ) : null}
      <span className="pl-card__foot">
        {owner ? (
          <span className="pl-owner">
            <PlAvatar name={owner} seed={row.assignee_user_id || owner} size="sm" />
            <span>{owner}</span>
          </span>
        ) : (
          <span className="pl-owner pl-owner--none">Chưa gán</span>
        )}
        {sla.tone ? (
          <span className={`pl-sla pl-sla--${sla.tone}`} title={sla.title}>
            {sla.label}
          </span>
        ) : null}
      </span>
    </button>
  );
}

function relabelStaffRows(rows: LeadFunnelGroupRow[], staffNames: Record<string, string>): LeadFunnelGroupRow[] {
  return rows.map((row) => {
    const name = staffNames[row.id];
    return name ? { ...row, label: name } : row;
  });
}

function sortCompareRows(rows: LeadFunnelGroupRow[], key: 'total' | 'ratio', dir: 'asc' | 'desc'): LeadFunnelGroupRow[] {
  const copy = rows.slice();
  copy.sort((a, b) => {
    const av = key === 'ratio' ? a.ratio : a.total;
    const bv = key === 'ratio' ? b.ratio : b.total;
    if (av === bv) return (a.label || '').localeCompare(b.label || '', 'vi');
    return dir === 'desc' ? bv - av : av - bv;
  });
  return copy;
}

function LeadComparePanels({
  groups,
  loading,
  staffNames = {},
}: {
  groups: { by_page: LeadFunnelGroupRow[]; by_channel: LeadFunnelGroupRow[]; by_form: LeadFunnelGroupRow[]; by_staff: LeadFunnelGroupRow[] };
  loading: boolean;
  staffNames?: Record<string, string>;
}) {
  const [sortKey, setSortKey] = useState<'total' | 'ratio'>('total');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  function toggleSort(key: 'total' | 'ratio') {
    if (sortKey === key) setSortDir((current) => (current === 'desc' ? 'asc' : 'desc'));
    else {
      setSortKey(key);
      setSortDir('desc');
    }
  }
  const sections: Array<{ title: string; rows: LeadFunnelGroupRow[] }> = [
    { title: 'Theo Page', rows: groups.by_page },
    { title: 'Theo Kênh', rows: groups.by_channel },
    { title: 'Theo Biểu mẫu', rows: groups.by_form },
    { title: 'Theo Nhân viên', rows: relabelStaffRows(groups.by_staff, staffNames) },
  ];
  return (
    <div className="portal-leads-compare-grid pl-compare" aria-label="So sánh phễu lead">
      {sections.map((section) => (
        <section key={section.title} className="portal-leads-compare">
          <h3>{section.title}</h3>
          {loading ? (
            <p className="portal-leads-compare__empty">Đang tải số liệu…</p>
          ) : section.rows.length === 0 ? (
            <p className="portal-leads-compare__empty">Không có lead trong khoảng lọc.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Nhóm</th>
                  <th className="num">
                    <button type="button" className="portal-leads-compare__sort" aria-sort={sortKey === 'total' ? (sortDir === 'desc' ? 'descending' : 'ascending') : 'none'} onClick={() => toggleSort('total')}>
                      Tổng
                    </button>
                  </th>
                  <th className="num">Đã nhận</th>
                  <th className="num">Đã chuyển khách</th>
                  <th className="num">Mua hàng</th>
                  <th className="num">
                    <button type="button" className="portal-leads-compare__sort" aria-sort={sortKey === 'ratio' ? (sortDir === 'desc' ? 'descending' : 'ascending') : 'none'} onClick={() => toggleSort('ratio')}>
                      Tỷ lệ
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortCompareRows(section.rows, sortKey, sortDir).map((row) => (
                  <tr key={section.title + row.id}>
                    <td>{row.label || '—'}</td>
                    <td className="num">{row.total}</td>
                    <td className="num">{row.received}</td>
                    <td className="num">{row.converted}</td>
                    <td className="num">{row.purchased}</td>
                    <td className="num portal-leads-compare__ratio">
                      <span className="portal-leads-compare__ratio-val">{formatLeadFunnelRatio(row.converted, row.total)}</span>
                      <span className="portal-leads-compare__bar" aria-hidden="true">
                        <span style={{ width: `${Math.max(0, Math.min(100, (row.ratio || 0) * 100))}%` }} />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      ))}
    </div>
  );
}
