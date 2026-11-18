'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchPortalDesk, type PortalDesk } from '@/lib/api';
import { posGet, vnd, type PosRisk } from '@/lib/portal-pos-api';
import { avatarTone, displayVnPhone, initials } from '@/components/portal-crm/portal-inbox.util';

type SourceKey = 'lead' | 'message' | 'order';
type Segment = 'customer' | 'prospect';

type Row = {
  id: string;
  phone: string;
  name: string;
  sources: SourceKey[];
  order_count: number;
  confirmed_order_count?: number;
  success_count: number;
  returned_count: number;
  revenue_vnd: number;
  total_vnd: number;
  last_purchase_at: string;
  assignee_user_id: string;
  assignee_email: string;
  blacklist: boolean;
  risk: PosRisk;
};

const SOURCE_LABEL: Record<SourceKey, string> = {
  lead: 'Lead',
  message: 'Tin nhắn',
  order: 'Đơn',
};

function formatSources(sources: SourceKey[]): string {
  if (!sources.length) return '—';
  return sources.map((s) => SOURCE_LABEL[s] ?? s).join(' · ');
}

function staffLabel(email: string): string {
  const local = email.split('@')[0]?.trim();
  return local || '—';
}

function when(value: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
}

function daysAgo(value: string): string {
  if (!value) return '';
  const t = new Date(value).getTime();
  if (Number.isNaN(t)) return '';
  const days = Math.floor((Date.now() - t) / 86_400_000);
  if (days <= 0) return 'Hôm nay';
  return `${days} ngày trước`;
}

export function PortalPosCustomers({
  token,
  initialPhone,
  userId,
}: {
  token: string;
  canManage: boolean;
  initialPhone?: string;
  userId?: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [source, setSource] = useState<'' | SourceKey>('');
  const [assignee, setAssignee] = useState('');
  const [segment, setSegment] = useState<Segment>('customer');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [data, setData] = useState<{ total: number; customers: Row[] } | null>(null);
  const [desk, setDesk] = useState<PortalDesk | null>(null);
  const [altTotal, setAltTotal] = useState<number | null>(null);
  const [error, setError] = useState('');
  const localCache = useRef<{ key: string; rows: Row[]; total: number } | null>(null);

  const staff = useMemo(() => desk?.staff ?? [], [desk]);

  useEffect(() => {
    if (!initialPhone?.trim()) return;
    router.replace(`/crm/customers/${encodeURIComponent(initialPhone.trim())}`);
  }, [initialPhone, router]);

  useEffect(() => {
    setPage(0);
    localCache.current = null;
  }, [q, source, assignee, segment, pageSize]);

  useEffect(() => {
    const filterKey = `${q}|${source}|${assignee}|${segment}`;
    const cached = localCache.current;
    if (cached && cached.key === filterKey && cached.rows.length > pageSize) {
      const start = page * pageSize;
      setData({ total: cached.total, customers: cached.rows.slice(start, start + pageSize) });
      return;
    }
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    if (source) params.set('source', source);
    if (assignee) params.set('assignee', assignee);
    params.set('segment', segment);
    params.set('limit', String(pageSize));
    params.set('offset', String(page * pageSize));
    let cancel = false;
    void posGet<{ total: number; customers: Row[] }>(token, `/api/portal/pos/customers?${params.toString()}`)
      .then((res) => {
        if (cancel) return;
        if (page === 0 && res.customers.length > pageSize) {
          localCache.current = { key: filterKey, rows: res.customers, total: res.total };
          setData({ total: res.total, customers: res.customers.slice(0, pageSize) });
          return;
        }
        localCache.current = null;
        setData(res);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Không tải được khách hàng'));
    return () => {
      cancel = true;
    };
  }, [token, q, source, assignee, segment, page, pageSize]);

  useEffect(() => {
    const alt: Segment = segment === 'customer' ? 'prospect' : 'customer';
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    if (source) params.set('source', source);
    if (assignee) params.set('assignee', assignee);
    params.set('segment', alt);
    params.set('limit', '1');
    void posGet<{ total: number }>(token, `/api/portal/pos/customers?${params.toString()}`)
      .then((res) => setAltTotal(res.total))
      .catch(() => setAltTotal(null));
  }, [token, q, source, assignee, segment]);

  useEffect(() => {
    void fetchPortalDesk(token, {}).then(setDesk).catch(() => setDesk(null));
  }, [token]);

  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : page * pageSize + 1;
  const to = Math.min(total, page * pageSize + (data?.customers.length ?? 0));

  return (
    <div className="pos">
      <header className="pos__head">
        <div>
          <h1>Khách hàng</h1>
          <p>Khách đã mua và tiềm năng chưa chốt đơn, gom theo số điện thoại.</p>
        </div>
        <div className="pos__actions">
          <Link className="pos-btn pos-btn--teal" href="/crm/orders/new">+ Tạo đơn</Link>
        </div>
      </header>
      {error ? <p className="pos-error">{error}</p> : null}
      <div className="pos-segment-tabs" role="tablist" aria-label="Phân loại">
        <button
          type="button"
          role="tab"
          aria-selected={segment === 'customer'}
          className={segment === 'customer' ? 'pos-segment-tabs__btn is-on' : 'pos-segment-tabs__btn'}
          onClick={() => setSegment('customer')}
        >
          Khách hàng (có đơn)
          <span className="pos-tab__n">{segment === 'customer' ? data?.total ?? '…' : altTotal ?? '…'}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={segment === 'prospect'}
          className={segment === 'prospect' ? 'pos-segment-tabs__btn is-on' : 'pos-segment-tabs__btn'}
          onClick={() => setSegment('prospect')}
        >
          Tiềm năng (chưa đơn)
          <span className="pos-tab__n">{segment === 'prospect' ? data?.total ?? '…' : altTotal ?? '…'}</span>
        </button>
      </div>
      <div className="pos-filters">
        <input
          className="pos-input"
          placeholder="Tìm tên hoặc số điện thoại"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Tìm khách"
        />
        <select className="pos-input" value={source} onChange={(e) => setSource(e.target.value as '' | SourceKey)} aria-label="Lọc nguồn">
          <option value="">Tất cả nguồn</option>
          <option value="order">Đơn POS</option>
          <option value="lead">Lead</option>
          <option value="message">Tin nhắn</option>
        </select>
        <select className="pos-input" value={assignee} onChange={(e) => setAssignee(e.target.value)} aria-label="Lọc nhân viên">
          <option value="">Mọi nhân viên</option>
          {staff.map((item) => (
            <option key={item.id} value={item.id}>{staffLabel(item.email)}</option>
          ))}
          {userId && !staff.some((s) => s.id === userId) ? <option value={userId}>Tôi</option> : null}
        </select>
      </div>
      <div className="pos-card pos-customers-table-wrap">
        <table className="pos-table pos-table--customers">
          <thead>
            <tr>
              <th>Khách</th>
              <th>Nguồn</th>
              <th className="pos-col-num">Số đơn</th>
              <th className="pos-col-num">Tổng chi tiêu</th>
              <th className="pos-col-num">Giá trị TB</th>
              <th>Lần mua gần nhất</th>
              <th>Nhân viên</th>
              {segment === 'prospect' ? <th></th> : null}
            </tr>
          </thead>
          <tbody>
            {(data?.customers ?? []).map((c) => {
              const label = c.name || 'Khách';
              const avg = c.order_count > 0 ? Math.round((c.total_vnd ?? c.revenue_vnd) / c.order_count) : 0;
              const ago = daysAgo(c.last_purchase_at);
              return (
                <tr key={c.phone} onClick={() => router.push(`/crm/customers/${encodeURIComponent(c.phone)}`)}>
                  <td>
                    <span className="pos-customer-cell">
                      <span className="pos-customer-avatar" style={{ background: avatarTone(label) }} aria-hidden>{initials(label)}</span>
                      <span>
                        <strong>{label}</strong>
                        <span className="pos-hint pos-customer-phone">{displayVnPhone(c.phone) || c.phone}</span>
                        {c.risk?.level && c.risk.level !== 'ok' ? (
                          <span className={`pos-badge pos-badge--${c.risk.level === 'block' ? 'returned' : 'warn'}`}>{c.blacklist ? 'Hạn chế' : 'Cảnh báo'}</span>
                        ) : null}
                      </span>
                    </span>
                  </td>
                  <td><span className="pos-badge pos-badge--off">{formatSources(c.sources)}</span></td>
                  <td className="pos-col-num pos-tabular">{c.order_count}</td>
                  <td className="pos-col-num pos-tabular">{vnd(c.total_vnd ?? c.revenue_vnd)}</td>
                  <td className="pos-col-num pos-tabular">{avg > 0 ? vnd(avg) : '—'}</td>
                  <td>
                    <span className="pos-customer-when">{when(c.last_purchase_at)}</span>
                    {ago ? <span className="pos-hint pos-customer-when">{ago}</span> : null}
                  </td>
                  <td>
                    <span className="pos-customer-cell">
                      <span className="pos-customer-avatar pos-customer-avatar--sm" style={{ background: avatarTone(staffLabel(c.assignee_email)) }} aria-hidden>
                        {c.assignee_email ? initials(staffLabel(c.assignee_email)) : '—'}
                      </span>
                      <span>{staffLabel(c.assignee_email)}</span>
                    </span>
                  </td>
                  {segment === 'prospect' ? (
                    <td>
                      <Link
                        className="pos-btn pos-btn--sm pos-btn--teal"
                        href={`/crm/orders/new?phone=${encodeURIComponent(c.phone)}&name=${encodeURIComponent(c.name || '')}`}
                        onClick={(event) => event.stopPropagation()}
                      >
                        Chốt đơn
                      </Link>
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
        {!data?.customers?.length ? (
          <p className="pos-empty pos-empty--sm">
            {segment === 'prospect' ? 'Chưa có tiềm năng phù hợp bộ lọc.' : 'Chưa có khách có đơn xác nhận.'}
          </p>
        ) : null}
      </div>
      <div className="pos-pager">
        <span className="pos-hint">{total ? `${from}–${to} của ${total}` : '0 khách'}</span>
        <label className="pos-pager__size">
          Mỗi trang
          <select
            className="pos-input"
            value={pageSize}
            aria-label="Số dòng mỗi trang"
            onChange={(e) => setPageSize(Number(e.target.value))}
          >
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </label>
        <button type="button" className="pos-btn pos-btn--sm" disabled={page <= 0} onClick={() => setPage((n) => Math.max(0, n - 1))}>Trước</button>
        <span className="pos-hint">{page + 1}/{pageCount}</span>
        <button type="button" className="pos-btn pos-btn--sm" disabled={page + 1 >= pageCount} onClick={() => setPage((n) => n + 1)}>Sau</button>
      </div>
    </div>
  );
}
