'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import React, { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { getAccessToken } from '@/lib/auth';
import {
  getQtQuotes,
  type QtListItem,
  type QtListQuery,
} from '@/lib/crm/qt-api';
import { dash } from '@/lib/crm/qt-format';

export type { QtListItem };

export const QT_LIST_CHIPS = [
  { id: 'all', label: 'Tất cả' },
  { id: 'mine', label: 'Của tôi' },
  { id: 'pending', label: 'Chờ tôi phê duyệt' },
  { id: 'expiring', label: 'Sắp hết hạn' },
  { id: 'sent', label: 'Đã gửi chưa phản hồi' },
] as const;

export const QT_OPEN_LIST_STATUSES = [
  'draft',
  'in_review',
  'pending_approval',
  'returned',
  'approved',
  'sent',
  'viewed',
  'negotiation',
] as const;

export const QT_SENT_NO_REPLY_STATUS = 'sent,viewed';

export type QtListChipId = (typeof QT_LIST_CHIPS)[number]['id'];

const STATUS_LABEL: Record<string, string> = {
  draft: 'Nháp',
  in_review: 'Đang xem',
  pending_approval: 'Chờ phê duyệt',
  returned: 'Trả về',
  approved: 'Đã duyệt',
  sent: 'Đã gửi',
  viewed: 'Đã xem',
  negotiation: 'Thương lượng',
  accepted: 'Đã xác nhận',
  rejected: 'Từ chối',
  expired: 'Hết hạn',
  cancelled: 'Đã hủy',
  superseded: 'Thay thế',
  archived: 'Lưu trữ',
};

function asScope(value: string | null): 'me' | 'team' | 'all' {
  if (value === 'team' || value === 'all') return value;
  return 'me';
}

export function activeListChip(search: URLSearchParams): QtListChipId {
  const chip = search.get('chip');
  if (chip === 'pending' || search.get('pending_my_approval') === '1') return 'pending';
  if (chip === 'expiring' || search.get('expiring') === '1') return 'expiring';
  if (chip === 'sent' || search.get('status') === 'sent' || search.get('status') === QT_SENT_NO_REPLY_STATUS) {
    return 'sent';
  }
  if (chip === 'mine') return 'mine';
  if (chip === 'all') return 'all';
  if (search.get('open') === '1') {
    const scope = search.get('scope');
    return scope === 'all' || scope === 'team' ? 'all' : 'mine';
  }
  return 'all';
}

export function listQueryFromSearch(search: URLSearchParams): QtListQuery {
  const chip = activeListChip(search);
  const scope = chip === 'mine' ? 'me' : asScope(search.get('scope'));
  const query: QtListQuery = { scope };
  const q = search.get('q')?.trim();
  if (q) query.q = q;
  const page = search.get('page');
  if (page) query.page = page;
  const pageSize = search.get('page_size');
  if (pageSize) query.page_size = pageSize;
  if (search.get('open') === '1' && chip !== 'pending' && chip !== 'expiring' && chip !== 'sent') {
    query.open = true;
    query.status = QT_OPEN_LIST_STATUSES.join(',');
  }
  if (chip === 'pending') query.pending_my_approval = true;
  if (chip === 'expiring') query.expiring = true;
  if (chip === 'sent') query.status = QT_SENT_NO_REPLY_STATUS;
  return query;
}

function formatMoney(value: number | null): string {
  if (value == null) return dash(null);
  return `${value.toLocaleString('vi-VN')} ₫`;
}

function formatGm(value: number | null): string {
  if (value == null) return dash(null);
  return `${(value / 100).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%`;
}

function formatWhen(value: string | null): string {
  if (!value) return dash(null);
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
    : value;
}

export function QtListChips({
  active,
  onChange,
}: {
  active: QtListChipId;
  onChange: (chip: QtListChipId) => void;
}) {
  return (
    <div className="qt-filters">
      {QT_LIST_CHIPS.map((chip) => (
        <button
          key={chip.id}
          type="button"
          className={`qt-chip${active === chip.id ? ' qt-chip--on' : ''}`}
          onClick={() => onChange(chip.id)}
        >
          {chip.label}
        </button>
      ))}
    </div>
  );
}

export function QtQuoteTable({ items }: { items: QtListItem[] }) {
  return (
    <div className="qt-table-wrap">
      <table className="qt-table">
        <thead>
          <tr>
            <th>Mã</th>
            <th>Ver</th>
            <th>Khách</th>
            <th>Lead</th>
            <th>Phương án</th>
            <th>Tổng</th>
            <th>Phí</th>
            <th>GM</th>
            <th>Status</th>
            <th>Hiệu lực</th>
            <th>Owner</th>
          </tr>
        </thead>
        <tbody>
          {items.length ? (
            items.map((row) => (
              <tr key={row.id}>
                <td>
                  <Link className="qt-link" href={`/crm/proposals/${row.id}`}>
                    {dash(row.quote_code)}
                  </Link>
                </td>
                <td>{row.version_n == null ? dash(null) : `v${row.version_n}`}</td>
                <td>{dash(row.client_name)}</td>
                <td>{dash(row.lead_code)}</td>
                <td>{dash(row.option)}</td>
                <td>{formatMoney(row.payable_vnd)}</td>
                <td>{formatMoney(row.fee_vnd)}</td>
                <td>{formatGm(row.gm_bps)}</td>
                <td>
                  <span className="qt-pill">{STATUS_LABEL[row.status] ?? row.status}</span>
                </td>
                <td>{formatWhen(row.valid_until)}</td>
                <td>{dash(row.owner?.name)}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td className="qt-empty" colSpan={11}>
                {dash(null)}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function QtListPager({
  page,
  pageSize,
  total,
  onPrev,
  onNext,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  const lastPage = Math.max(1, Math.ceil((total || 0) / (pageSize || 25)));
  return (
    <nav className="qt-pager" aria-label="Phân trang">
      <button type="button" className="qt-btn" disabled={page <= 1} onClick={onPrev}>
        Trước
      </button>
      <span className="qt-muted">
        {total} báo giá · trang {page}/{lastPage}
      </span>
      <button type="button" className="qt-btn" disabled={page >= lastPage} onClick={onNext}>
        Sau
      </button>
    </nav>
  );
}

export function QtQuoteList() {
  const router = useRouter();
  const pathname = usePathname() ?? '/crm/proposals/list';
  const searchParams = useSearchParams();
  const searchKey = searchParams.toString();
  const current = useMemo(() => new URLSearchParams(searchKey), [searchKey]);
  const query = useMemo(() => listQueryFromSearch(current), [current]);
  const chip = activeListChip(current);
  const [items, setItems] = useState<QtListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [draftQ, setDraftQ] = useState(current.get('q') ?? '');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const listed = await getQtQuotes(token, query);
      setItems(listed.items ?? []);
      setTotal(listed.total ?? 0);
      setPage(listed.page ?? 1);
      setPageSize(listed.page_size ?? 25);
    } catch (caught) {
      setItems([]);
      setTotal(0);
      setError(caught instanceof Error ? caught.message : 'Không tải được danh sách báo giá');
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    setDraftQ(current.get('q') ?? '');
  }, [current]);

  useEffect(() => {
    void load();
  }, [load]);

  function replaceParams(mutate: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(current);
    mutate(params);
    const next = params.toString();
    router.replace(next ? `${pathname}?${next}` : pathname);
  }

  function changeChip(next: QtListChipId) {
    replaceParams((params) => {
      params.delete('pending_my_approval');
      params.delete('expiring');
      params.delete('status');
      params.delete('open');
      params.delete('page');
      if (next === 'all') {
        params.delete('chip');
      } else {
        params.set('chip', next);
      }
      if (next === 'mine') params.set('scope', 'me');
    });
  }

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    replaceParams((params) => {
      const value = draftQ.trim();
      if (value) params.set('q', value);
      else params.delete('q');
      params.delete('page');
    });
  }

  function changePageSize(next: string) {
    replaceParams((params) => {
      if (next && next !== '25') params.set('page_size', next);
      else params.delete('page_size');
      params.delete('page');
    });
  }

  function changePage(next: number) {
    replaceParams((params) => {
      if (next > 1) params.set('page', String(next));
      else params.delete('page');
    });
  }

  return (
    <div className="qt-list">
      <header className="qt-head">
        <div>
          <p className="qt-crumb">Kinh doanh / Báo giá / Danh sách</p>
          <h1>Danh sách báo giá</h1>
          <p className="qt-muted">LST-01 · mã QT-PTT · GM ẩn nếu thiếu finance</p>
        </div>
        <div className="qt-head__actions">
          <Link className="qt-btn qt-btn--primary" href="/crm/proposals/new">
            Tạo báo giá
          </Link>
        </div>
      </header>

      {error ? (
        <section className="qt-card qt-card--error">
          <p>{error}</p>
          <button type="button" className="qt-btn" onClick={() => void load()}>
            Thử lại
          </button>
        </section>
      ) : null}

      <div className="qt-filters">
        <QtListChips active={chip} onChange={changeChip} />
        <form onSubmit={submitSearch}>
          <input
            className="qt-inp"
            value={draftQ}
            onChange={(event) => setDraftQ(event.target.value)}
            placeholder="Mã / khách / lead / title"
            aria-label="Tìm báo giá"
          />
        </form>
        <label className="qt-scope">
          <span>Trang</span>
          <select
            aria-label="Kích thước trang"
            value={String(query.page_size ?? pageSize)}
            onChange={(event) => changePageSize(event.target.value)}
          >
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </select>
        </label>
      </div>

      <div aria-busy={loading}>
        <QtQuoteTable items={items} />
      </div>
      <QtListPager
        page={page}
        pageSize={pageSize}
        total={total}
        onPrev={() => changePage(page - 1)}
        onNext={() => changePage(page + 1)}
      />
    </div>
  );
}
