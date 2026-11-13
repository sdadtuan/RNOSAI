'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchPortalDesk, type PortalDesk } from '@/lib/api';
import {
  POS_STATUSES, POS_STATUS_LABEL, POS_SOURCE_LABEL, POS_CARRIER_LABEL,
  posGet, vnd, type PosOrder,
} from '@/lib/portal-pos-api';
import { PortalDateRange } from '@/components/portal/PortalDateRange';
import Link from 'next/link';

export function PortalPosOrders({ token }: { token: string }) {
  const router = useRouter();
  const [status, setStatus] = useState('all');
  const [q, setQ] = useState('');
  const [pageId, setPageId] = useState('');
  const [source, setSource] = useState('');
  const [carrier, setCarrier] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [staff, setStaff] = useState('');
  const [data, setData] = useState<{ total: number; counts: Record<string, number>; orders: PosOrder[] } | null>(null);
  const [desk, setDesk] = useState<PortalDesk | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (status !== 'all') params.set('status', status);
    if (q.trim()) params.set('q', q.trim());
    if (pageId) params.set('page_id', pageId);
    if (source) params.set('source', source);
    if (carrier) params.set('carrier', carrier);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (staff) params.set('staff', staff);
    const [orders, d] = await Promise.all([
      posGet<{ total: number; counts: Record<string, number>; orders: PosOrder[] }>(token, `/api/portal/pos/orders?${params}`),
      fetchPortalDesk(token, {}).catch(() => null),
    ]);
    setData(orders);
    if (d) setDesk(d);
  }, [token, status, q, pageId, source, carrier, from, to, staff]);

  useEffect(() => {
    void load().catch((err: unknown) => setError(err instanceof Error ? err.message : 'Không tải được đơn'));
  }, [load]);

  const counts = data?.counts ?? {};
  const allCount = Object.values(counts).reduce((s, n) => s + n, 0);
  const pages = (desk?.pages ?? []).filter((p) => p.channel !== 'ad_account');

  return (
    <div className="pos">
      <header className="pos__head">
        <div>
          <h1>Đơn hàng</h1>
          <p>Theo dõi từ lúc chốt đến lúc giao, hoàn hoặc hủy. Tồn được giữ khi xác nhận, trừ khi gửi hàng.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link href="/crm/shipping" className="pos-btn pos-btn--sm">Cài đặt vận chuyển</Link>
          <button type="button" className="pos-btn pos-btn--teal" onClick={() => router.push('/crm/orders/new')}>Tạo đơn</button>
        </div>
      </header>
      {error ? <p className="pos-error">{error}</p> : null}
      <div className="pos-tabs" role="tablist">
        {POS_STATUSES.map((tab) => (
          <button key={tab.id} type="button" role="tab" className={status === tab.id ? 'pos-tab is-on' : 'pos-tab'} onClick={() => setStatus(tab.id)}>
            {tab.label}
            <span className="pos-tab__n">{tab.id === 'all' ? allCount : (counts[tab.id] ?? 0)}</span>
          </button>
        ))}
      </div>
      <div className="pos-filters">
        <input className="pos-input" placeholder="Mã đơn, SĐT, tên" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="pos-select" value={pageId} onChange={(e) => setPageId(e.target.value)}>
          <option value="">Tất cả Page</option>
          {pages.map((p) => <option key={p.page_id} value={p.page_id}>{p.page_name || p.page_id}</option>)}
        </select>
        <select className="pos-select" value={staff} onChange={(e) => setStaff(e.target.value)}>
          <option value="">Tất cả nhân viên</option>
          {(desk?.staff ?? []).map((s) => <option key={s.id} value={s.id}>{s.email}</option>)}
        </select>
        <select className="pos-select" value={source} onChange={(e) => setSource(e.target.value)}>
          <option value="">Mọi nguồn</option>
          {Object.entries(POS_SOURCE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className="pos-select" value={carrier} onChange={(e) => setCarrier(e.target.value)}>
          <option value="">Mọi hãng vận chuyển</option>
          {Object.entries(POS_CARRIER_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <PortalDateRange from={from} to={to} onChange={(next) => { setFrom(next.from); setTo(next.to); }} />
      </div>
      {!data?.orders.length ? (
        <div className="pos-empty pos-card">Chưa có đơn trong bộ lọc này.</div>
      ) : (
        <table className="pos-table">
          <thead>
            <tr>
              <th className="pos-col-code">Mã</th>
              <th>Khách</th>
              <th>Sản phẩm</th>
              <th>Tổng / COD</th>
              <th>Nguồn</th>
              <th>Trạng thái</th>
              <th>Vận chuyển</th>
              <th>Ngày</th>
            </tr>
          </thead>
          <tbody>
            {data.orders.map((o) => (
              <tr key={o.id} onClick={() => router.push(`/crm/orders/${o.id}`)}>
                <td className="pos-col-code"><strong>{o.code}</strong></td>
                <td>
                  <strong>{o.customer_name || 'Khách'}</strong>
                  <div className="pos-hint">{o.phone}</div>
                </td>
                <td>{o.items.map((i) => `${i.qty}× ${i.name}${i.color || i.size ? ` (${[i.color, i.size].filter(Boolean).join('/')})` : ''}`).join(', ')}</td>
                <td>{vnd(o.total_vnd)}<div className="pos-hint">COD {vnd(o.cod_vnd)}</div></td>
                <td>{POS_SOURCE_LABEL[o.source] || o.source}<div className="pos-hint">{o.assignee_email}</div></td>
                <td><span className={`pos-badge pos-badge--${o.status}`}>{POS_STATUS_LABEL[o.status] || o.status}</span></td>
                <td>{o.shipments.filter((s) => !s.cancelled_at)[0]?.tracking_code || '—'}</td>
                <td className="pos-hint">{o.created_at ? new Date(o.created_at).toLocaleString('vi-VN', { timeZone: 'Asia/Saigon' }) : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
