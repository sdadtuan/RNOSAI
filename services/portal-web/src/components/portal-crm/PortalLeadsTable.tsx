'use client';

import { useEffect, useMemo, useState } from 'react';
import type { PortalCareCase, PortalDeskPage } from '@/lib/api';
import {
  EMPTY_LEAD_FILTERS,
  filterLeadRows,
  formatLeadPhoneDisplay,
  LEAD_PAGE_SIZE,
  leadEmail,
  leadInteractedAt,
  leadKpis,
  leadPhone,
  leadPhoneHref,
  leadSource,
  paginateRows,
  sortLeadsByRecent,
  uniqueLeadSources,
  type LeadTableFilters,
} from '@/lib/portal/portal-leads-table.util';
import {
  formatSaigonDateTime,
  LEAD_STATUS_LABEL,
  leadStatusChipClass,
  PortalLeadEmptyPanel,
  PortalLeadPanel,
} from '@/components/portal-crm/PortalLeadDrawer';

function EmptyMark() {
  return <span className="portal-leads__na">—</span>;
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
}) {
  const [filters, setFilters] = useState<LeadTableFilters>(EMPTY_LEAD_FILTERS);
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const pageName = useMemo(
    () => new Map(pages.map((item) => [item.page_id, item.page_name || item.page_id])),
    [pages],
  );
  const kpis = useMemo(() => leadKpis(rows), [rows]);
  const sources = useMemo(() => uniqueLeadSources(rows), [rows]);
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
    if (openId && visible.some((row) => row.id === openId)) return;
    setOpenId(visible[0]?.id ?? null);
  }, [loading, visible, openId]);

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

  return (
    <div className="portal-leads portal-leads--split">
      <div className="portal-leads__main">
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

        <form
          className="portal-crm__filters portal-leads__filters"
          onSubmit={(event) => event.preventDefault()}
          aria-label="Lọc lead"
        >
          <label>
            Tìm
            <input
              value={filters.query}
              onChange={(event) => patch({ query: event.target.value })}
              placeholder="Tên, SĐT, email, Page, phụ trách"
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
            Form
            <select value={filters.source} onChange={(event) => patch({ source: event.target.value })}>
              <option value="">Tất cả form</option>
              {sources.map((item) => (
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
          <label>
            Từ ngày
            <input type="date" value={filters.from} onChange={(event) => patch({ from: event.target.value })} />
          </label>
          <label>
            Đến ngày
            <input type="date" value={filters.to} onChange={(event) => patch({ to: event.target.value })} />
          </label>
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

        <div className="portal-data-table-wrap">
          <table className="portal-data-table">
            <thead>
              <tr>
                <th>Tên</th>
                <th>SĐT</th>
                <th>Email</th>
                <th>Form</th>
                <th>Page</th>
                <th>Nhân viên phụ trách</th>
                <th>Trạng thái</th>
                <th>Thời gian gửi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8}>
                    <div className="portal-leads__state" role="status">
                      Đang tải danh sách lead…
                    </div>
                  </td>
                </tr>
              ) : error && rows.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <div className="portal-leads__state portal-leads__state--error">
                      Không tải được danh sách lead. Thử tải lại trang.
                    </div>
                  </td>
                </tr>
              ) : paged.items.length === 0 ? (
                <tr>
                  <td colSpan={8}>
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
                      onClick={() => setOpenId(row.id)}
                    >
                      <td>
                        <button type="button" className="portal-leads__name" onClick={() => setOpenId(row.id)}>
                          <strong title={row.title || 'Lead'}>{row.title || 'Lead'}</strong>
                        </button>
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
        />
      ) : (
        <PortalLeadEmptyPanel loading={loading} />
      )}
    </div>
  );
}