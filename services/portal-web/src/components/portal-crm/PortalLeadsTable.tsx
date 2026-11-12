'use client';

import { useEffect, useMemo, useState, type DragEvent } from 'react';
import type { PortalCareCase, PortalDeskPage } from '@/lib/api';
import {
  EMPTY_LEAD_FILTERS,
  filterLeadRows,
  formatLeadPhoneDisplay,
  LEAD_PAGE_SIZE,
  LEAD_STATUS_ORDER,
  leadEmail,
  leadKpis,
  leadInteractedAt,
  leadKanbanDropAction,
  leadPhone,
  leadPhoneHref,
  leadSource,
  leadTagColor,
  paginateRows,
  sortLeadsByRecent,
  uniqueLeadSources,
  uniqueLeadTags,
  type LeadTableFilters,
} from '@/lib/portal/portal-leads-table.util';
import {
  formatSaigonDateTime,
  LEAD_STATUS_LABEL,
  leadStatusChipClass,
  PortalLeadEmptyPanel,
  PortalLeadPanel,
  type LeadLabelCatalog,
} from '@/components/portal-crm/PortalLeadDrawer';
import { PortalDateRange } from '@/components/portal/PortalDateRange';

function EmptyMark() {
  return <span className="portal-leads__na">—</span>;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'L';
  const letters = (parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[parts.length - 1][0]);
  return letters.toUpperCase();
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
  token,
  labels = [],
  messages = [],
  onNotes,
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
  token?: string;
  labels?: LeadLabelCatalog;
  messages?: PortalCareCase[];
  onNotes?: (id: string, notes: string) => void;
}) {
  const [filters, setFilters] = useState<LeadTableFilters>(EMPTY_LEAD_FILTERS);
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const [view, setView] = useState<'list' | 'kanban'>('list');
  const [notice, setNotice] = useState('');
  const [panelClosed, setPanelClosed] = useState(false);
  const [overStatus, setOverStatus] = useState('');
  const pageName = useMemo(
    () => new Map(pages.map((item) => [item.page_id, item.page_name || item.page_id])),
    [pages],
  );
  const kpis = useMemo(() => leadKpis(rows), [rows]);
  const sources = useMemo(() => uniqueLeadSources(rows), [rows]);
  const tags = useMemo(() => uniqueLeadTags(rows), [rows]);
  const assignees = useMemo(() => {
    const byId = new Map(staff.map((item) => [item.id, item] as const));
    for (const row of rows) {
      if (row.assignee_user_id && !byId.has(row.assignee_user_id)) {
        byId.set(row.assignee_user_id, {
          id: row.assignee_user_id,
          email: row.assignee_email || row.assignee_user_id,
        });
      }
    }
    return [...byId.values()];
  }, [staff, rows]);
  const visible = useMemo(() => {
    const filtered = filterLeadRows(rows, filters, pageName);
    return sortLeadsByRecent(filtered);
  }, [rows, filters, pageName]);
  const paged = paginateRows(visible, page, LEAD_PAGE_SIZE);
  const selected = rows.find((row) => row.id === openId) ?? null;

  useEffect(() => {
    if (loading) return;
    if (panelClosed) {
      if (openId && visible.some((row) => row.id === openId)) return;
      return;
    }
    if (openId && visible.some((row) => row.id === openId)) return;
    setOpenId(visible[0]?.id ?? null);
  }, [loading, visible, openId, panelClosed]);

  useEffect(() => {
    if (!openId) return;
    void onOpen(openId).catch(() => {
      /* list row is enough to render the panel */
    });
    // Fetch when the selected lead changes; parent passes a fresh callback each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId]);

  function patch(next: Partial<LeadTableFilters>) {
    setFilters((current) => ({ ...current, ...next }));
    setPage(1);
  }

  function canDrag(row: PortalCareCase): boolean {
    if (row.status === 'purchased') return false;
    return role !== 'staff' || row.assignee_user_id === userId;
  }

  function dropOn(toStatus: string, event: DragEvent) {
    event.preventDefault();
    setOverStatus('');
    const id = event.dataTransfer.getData('text/lead-id') || event.dataTransfer.getData('text/plain');
    const row = rows.find((item) => item.id === id);
    if (!row) return;
    if (!canDrag(row)) {
      setNotice('Chỉ người phụ trách (hoặc quản lý) mới đổi trạng thái lead đã gán.');
      return;
    }
    const result = leadKanbanDropAction(row.status, toStatus);
    if (!result.ok) {
      if (result.reason === 'same') return;
      setNotice(
        result.reason === 'already_purchased'
          ? 'Lead đã mua hàng — không đổi trạng thái.'
          : 'Không thể chuyển trạng thái này. Dùng thao tác Nhận lead / Đang chăm sóc theo quy trình hiện tại.',
      );
      return;
    }
    setNotice('');
    onAct(row.id, result.action);
  }

  return (
    <div className={view === 'kanban' ? 'portal-leads portal-leads--split portal-leads--pk portal-leads--kanban-open' : 'portal-leads portal-leads--split portal-leads--pk'}>
      <div className="portal-leads-pk__main">
        <div className="kpi-tile-grid portal-leads__kpis" aria-label="KPI lead">
          <article className="kpi-tile">
            <p className="kpi-tile__label">Tổng</p>
            <p className="kpi-tile__value">{loading ? '—' : kpis.total}</p>
          </article>
          <article className="kpi-tile">
            <p className="kpi-tile__label">Chờ nhận</p>
            <p className="kpi-tile__value">{loading ? '—' : kpis.waiting}</p>
          </article>
          <article className="kpi-tile">
            <p className="kpi-tile__label">Đã gán</p>
            <p className="kpi-tile__value">{loading ? '—' : kpis.assigned}</p>
          </article>
          <article className="kpi-tile">
            <p className="kpi-tile__label">Đã chuyển khách</p>
            <p className="kpi-tile__value">{loading ? '—' : kpis.converted}</p>
          </article>
          <article className="kpi-tile">
            <p className="kpi-tile__label">Hôm nay</p>
            <p className="kpi-tile__value">{loading ? '—' : kpis.today}</p>
          </article>
        </div>

        <div className="portal-leads-pk__toolbar">
          <div className="portal-leads-pk__views" role="tablist" aria-label="Kiểu xem lead">
            <button type="button" role="tab" aria-selected={view === 'list'} className={view === 'list' ? 'is-active' : undefined} onClick={() => setView('list')}>
              Danh sách
            </button>
            <button type="button" role="tab" aria-selected={view === 'kanban'} className={view === 'kanban' ? 'is-active' : undefined} onClick={() => setView('kanban')}>
              Kanban
            </button>
          </div>
        </div>

        <form
          className="portal-crm__filters portal-leads__filters portal-leads-pk__filters"
          onSubmit={(event) => event.preventDefault()}
          aria-label="Lọc lead"
        >
          <label>
            Tìm
            <input
              type="search"
              value={filters.query}
              onChange={(event) => patch({ query: event.target.value })}
              placeholder="Tên, SĐT, email, Page, phụ trách, thẻ"
            />
          </label>
          <label>
            Page
            <select value={filters.pageId} onChange={(event) => patch({ pageId: event.target.value })}>
              <option value="">Tất cả Page</option>
              {pages.map((item) => (
                <option key={item.page_id} value={item.page_id}>
                  {item.page_name || item.page_id}
                </option>
              ))}
            </select>
          </label>
          <label>
            Nguồn / Biểu mẫu
            <select value={filters.source} onChange={(event) => patch({ source: event.target.value })}>
              <option value="">Tất cả nguồn</option>
              {sources.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label>
            Thẻ
            <select value={filters.tag} onChange={(event) => patch({ tag: event.target.value })}>
              <option value="">Tất cả thẻ</option>
              {tags.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label>
            Trạng thái
            <select value={filters.status} onChange={(event) => patch({ status: event.target.value })}>
              <option value="">Tất cả trạng thái</option>
              {Object.entries(LEAD_STATUS_LABEL).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Nhân viên phụ trách
            <select value={filters.assignee} onChange={(event) => patch({ assignee: event.target.value })}>
              <option value="">Tất cả</option>
              <option value="unassigned">Chưa gán</option>
              {assignees.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.email}
                </option>
              ))}
            </select>
          </label>
          <PortalDateRange
            from={filters.from}
            to={filters.to}
            onChange={(next) => patch({ from: next.from, to: next.to })}
          />
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setFilters(EMPTY_LEAD_FILTERS);
              setPage(1);
            }}
          >
            Xóa lọc
          </button>
        </form>

        {error ? <p className="portal-leads__banner portal-leads__banner--error">{error}</p> : null}
        {notice ? <p className="portal-leads-pk__notice">{notice}</p> : null}

        {view === 'kanban' ? (
          <div className="portal-kanban" aria-label="Kanban theo trạng thái lead">
            {LEAD_STATUS_ORDER.map((status) => {
              const items = visible.filter((row) => row.status === status);
              const droppable = status === 'received' || status === 'caring';
              return (
                <section
                  key={status}
                  className={
                    'portal-kanban__col' +
                    (overStatus === status ? ' is-over' : '') +
                    (droppable ? '' : ' is-locked')
                  }
                >
                  <header className="portal-kanban__head">
                    <span>{LEAD_STATUS_LABEL[status]}</span>
                    <span className="portal-kanban__count">{items.length}</span>
                  </header>
                  <div
                    className="portal-kanban__drop"
                    onDragOver={(event) => {
                      if (!droppable) return;
                      event.preventDefault();
                      event.dataTransfer.dropEffect = 'move';
                      setOverStatus(status);
                    }}
                    onDragLeave={() => {
                      if (overStatus === status) setOverStatus('');
                    }}
                    onDrop={(event) => dropOn(status, event)}
                  >
                    {loading ? <p className="muted">Đang tải…</p> : null}
                    {!loading && items.length === 0 ? <p className="muted">Kéo lead hợp lệ vào đây.</p> : null}
                    {items.map((row) => {
                      const phone = formatLeadPhoneDisplay(leadPhone(row));
                      const pageLabel = pageName.get(row.page_id) || row.page_id;
                      const draggable = canDrag(row);
                      return (
                        <button
                          key={row.id}
                          type="button"
                          className={openId === row.id ? 'portal-kanban__card is-selected' : 'portal-kanban__card'}
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
                          onClick={() => { setPanelClosed(false); setOpenId(row.id); }}
                        >
                          <strong title={row.title || 'Lead'}>{row.title || 'Lead'}</strong>
                          <div className="portal-leads-pk__tags">
                            {(row.labels ?? []).map((name) => (
                              <span key={name} className="portal-leads-pk__tag" style={{ background: leadTagColor(name, labels) }}>
                                {name}
                              </span>
                            ))}
                          </div>
                          <div className="portal-kanban__meta">
                            {phone ? <span>{phone}</span> : null}
                            <span>{pageLabel}</span>
                            <span>{row.assignee_email || 'Chưa gán'}</span>
                            <span>{leadSource(row) || ''}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        ) : (
          <>
            <div className="portal-data-table-wrap portal-leads-pk__table-wrap">
              <table className="portal-data-table portal-leads-pk__table">
                <thead>
                  <tr>
                    <th>Tên</th>
                    <th>Thẻ</th>
                    <th>SĐT</th>
                    <th>Email</th>
                    <th>Nguồn</th>
                    <th>Page</th>
                    <th>Nhân viên phụ trách</th>
                    <th>Trạng thái</th>
                    <th>Thời gian gửi</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={9}>
                        <div className="portal-leads__state" role="status">
                          Đang tải danh sách lead…
                        </div>
                      </td>
                    </tr>
                  ) : error && rows.length === 0 ? (
                    <tr>
                      <td colSpan={9}>
                        <div className="portal-leads__state portal-leads__state--error">
                          Không tải được danh sách lead. Thử tải lại trang.
                        </div>
                      </td>
                    </tr>
                  ) : paged.items.length === 0 ? (
                    <tr>
                      <td colSpan={9}>
                        <div className="portal-leads__state">
                          <strong>Không có lead khớp bộ lọc</strong>
                          <p className="muted">Danh sách chỉ hiện lead trên Page đang gắn. Dữ liệu Page cũ vẫn được giữ.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paged.items.map((row) => {
                      const phone = leadPhone(row);
                      const phoneDisplay = formatLeadPhoneDisplay(phone);
                      const email = leadEmail(row);
                      const form = leadSource(row);
                      const pageLabel = pageName.get(row.page_id) || row.page_id;
                      const assignee = row.assignee_email || (row.assignee_user_id ? row.assignee_user_id : 'Chưa gán');
                      return (
                        <tr
                          key={row.id}
                          className={openId === row.id ? 'is-selected' : undefined}
                          onClick={() => { setPanelClosed(false); setOpenId(row.id); }}
                        >
                          <td>
                            <button type="button" className="portal-leads-pk__name" onClick={() => { setPanelClosed(false); setOpenId(row.id); }}>
                              <span className="portal-leads-pk__avatar" aria-hidden>
                                {initials(row.title || 'Lead')}
                              </span>
                              <strong title={row.title || 'Lead'}>{row.title || 'Lead'}</strong>
                            </button>
                          </td>
                          <td>
                            {(row.labels ?? []).length ? (
                              <div className="portal-leads-pk__tags">
                                {(row.labels ?? []).map((name) => (
                                  <span key={name} className="portal-leads-pk__tag" style={{ background: leadTagColor(name, labels) }}>
                                    {name}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <EmptyMark />
                            )}
                          </td>
                          <td>
                            {phoneDisplay ? (
                              <a
                                className="portal-phone-link"
                                href={leadPhoneHref(phone)}
                                title={phoneDisplay}
                                onClick={(event) => event.stopPropagation()}
                              >
                                {phoneDisplay}
                              </a>
                            ) : (
                              <EmptyMark />
                            )}
                          </td>
                          <td>
                            {email ? (
                              <span className="portal-leads__truncate" title={email}>
                                {email}
                              </span>
                            ) : (
                              <EmptyMark />
                            )}
                          </td>
                          <td>
                            {form ? (
                              <span className="portal-leads__form portal-leads__truncate" title={form}>
                                {form}
                              </span>
                            ) : (
                              <EmptyMark />
                            )}
                          </td>
                          <td>
                            <span className="portal-leads__truncate" title={pageLabel}>
                              {pageLabel}
                            </span>
                          </td>
                          <td>
                            <span className="portal-leads__truncate" title={assignee}>
                              {assignee}
                            </span>
                          </td>
                          <td>
                            <span className={leadStatusChipClass(row.status)}>{LEAD_STATUS_LABEL[row.status] || row.status}</span>
                          </td>
                          <td className="portal-leads__when">{formatSaigonDateTime(leadInteractedAt(row))}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="portal-leads__pager">
              <span className="muted">
                {loading
                  ? 'Đang tải…'
                  : paged.total === 0
                    ? '0 lead'
                    : `${(paged.page - 1) * LEAD_PAGE_SIZE + 1}–${Math.min(paged.page * LEAD_PAGE_SIZE, paged.total)} / ${paged.total} lead`}
              </span>
              <span className="portal-leads__pager-btns">
                <button type="button" className="btn btn-secondary btn-sm" disabled={paged.page <= 1} onClick={() => setPage((n) => n - 1)}>
                  Trước
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={paged.page >= paged.pages || paged.pages === 0}
                  onClick={() => setPage((n) => n + 1)}
                >
                  Sau
                </button>
              </span>
            </div>
          </>
        )}
      </div>

      {selected ? (
        <PortalLeadPanel
          row={selected}
          pages={pages}
          staff={staff}
          role={role}
          userId={userId}
          busy={busy}
          onAct={onAct}
          token={token}
          labels={labels}
          messages={messages}
          onNotes={onNotes}
          overlay={view === 'kanban'}
          onClose={() => { setPanelClosed(true); setOpenId(null); }}
        />
      ) : (
        <PortalLeadEmptyPanel loading={loading} />
      )}
    </div>
  );
}
