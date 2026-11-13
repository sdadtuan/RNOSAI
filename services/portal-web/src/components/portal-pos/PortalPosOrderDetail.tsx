'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { setPortalTitleOverride } from '@/lib/portal/nav';
import { portalMediaUrl } from '@/lib/api';
import {
  POS_STATUS_LABEL, POS_SOURCE_LABEL, POS_CARRIER_LABEL, POS_STATUSES,
  posGet, posPost, vnd, type PosOrder, type PosRisk,
} from '@/lib/portal-pos-api';

const NEXT: Record<string, string[]> = {
  new: ['confirmed', 'cancelled'],
  confirmed: ['packing', 'cancelled'],
  packing: ['awaiting_pickup', 'cancelled'],
  awaiting_pickup: ['shipping', 'cancelled', 'returned'],
  shipping: ['success', 'returned'],
  success: ['returned'],
};

const SHIP_STATUS_VI: Record<string, string> = {
  created: 'Đã tạo',
  pending: 'Chờ xử lý',
  picking: 'Đang lấy hàng',
  transporting: 'Đang vận chuyển',
  delivered: 'Đã giao',
  cancelled: 'Đã hủy',
  returned: 'Hoàn hàng',
  failed: 'Thất bại',
};

export function PortalPosOrderDetail({ token, id, canManage }: { token: string; id: string; canManage: boolean }) {
  const router = useRouter();
  const [order, setOrder] = useState<PosOrder | null>(null);

  useEffect(() => {
    const label = order?.code ? `Đơn ${order.code} · Portal` : 'Chi tiết đơn hàng · Portal';
    setPortalTitleOverride(label);
    return () => setPortalTitleOverride(null);
  }, [order?.code]);
  const [customer, setCustomer] = useState<{ risk?: PosRisk } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [quotes, setQuotes] = useState<Array<{ service_code: string; service_name: string; fee_vnd: number; eta?: string }>>([]);
  const [carrier, setCarrier] = useState('ghn');
  const [accounts, setAccounts] = useState<Array<{ id: string; carrier: string; label: string; test_mode: boolean; has_token: boolean }>>([]);
  const [accountId, setAccountId] = useState('');
  const [service, setService] = useState('');
  const [shipOpen, setShipOpen] = useState(false);

  const load = useCallback(async () => {
    const data = await posGet<{ order: PosOrder; customer: { risk?: PosRisk } | null }>(token, `/api/portal/pos/orders/${id}`);
    setOrder(data.order);
    setCustomer(data.customer);
    const cars = await posGet<{ accounts: typeof accounts }>(token, '/api/portal/pos/carriers').catch(() => ({ accounts: [] }));
    setAccounts(cars.accounts);
  }, [token, id]);

  useEffect(() => {
    void load().catch((err: unknown) => setError(err instanceof Error ? err.message : 'Không tải được đơn'));
  }, [load]);

  async function go(status: string) {
    if (!order) return;
    setBusy(true); setError('');
    try {
      const res = await posPost<{ order: PosOrder }>(token, `/api/portal/pos/orders/${order.id}/status`, { status });
      setOrder(res.order);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không đổi được trạng thái');
    } finally { setBusy(false); }
  }

  async function loadQuotes() {
    if (!order) return;
    setBusy(true); setError('');
    try {
      const res = await posPost<{ quotes: typeof quotes }>(token, `/api/portal/pos/orders/${order.id}/quote`, { carrier, account_id: accountId || undefined });
      setQuotes(res.quotes);
      if (res.quotes[0]) setService(res.quotes[0].service_code);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không lấy được phí');
    } finally { setBusy(false); }
  }

  async function sendShip() {
    if (!order) return;
    setBusy(true); setError('');
    try {
      const res = await posPost<{ order: PosOrder; simulated?: boolean }>(token, `/api/portal/pos/orders/${order.id}/ship`, {
        carrier, account_id: accountId || undefined, service_code: service,
        service_name: quotes.find((q) => q.service_code === service)?.service_name,
      });
      setOrder(res.order);
      setShipOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tạo được vận đơn');
    } finally { setBusy(false); }
  }

  if (!order) return <div className="pos"><p className="pos-hint">{error || 'Đang tải…'}</p></div>;
  const ship = order.shipments.find((s) => !s.cancelled_at);
  const risk = customer?.risk;

  return (
    <div className="pos">
      <header className="pos__head">
        <div>
          <button type="button" className="pos-btn pos-btn--ghost pos-btn--sm" onClick={() => router.push('/crm/orders')}>← Đơn hàng</button>
          <h1>{order.code} <span className={`pos-badge pos-badge--${order.status}`}>{POS_STATUS_LABEL[order.status] || order.status}</span></h1>
          <p>{POS_SOURCE_LABEL[order.source] || order.source} · {order.assignee_email || 'Chưa gán'} · {order.created_at ? new Date(order.created_at).toLocaleString('vi-VN', { timeZone: 'Asia/Saigon' }) : ''}</p>
        </div>
        <div className="pos__actions">
          <a className="pos-btn" href={`/client/crm/orders/${order.id}/print?size=a5`} target="_blank" rel="noreferrer">In A5</a>
          <a className="pos-btn" href={`/client/crm/orders/${order.id}/print?size=80`} target="_blank" rel="noreferrer">In 80mm</a>
          {!['cancelled', 'returned', 'success'].includes(order.status) ? (
            <button type="button" className="pos-btn pos-btn--teal" onClick={() => { setShipOpen(true); void loadQuotes(); }}>Gửi vận chuyển</button>
          ) : null}
        </div>
      </header>
      {error ? <p className="pos-error">{error}</p> : null}
      {risk && risk.level !== 'ok' ? (
        <div className={`pos-warn ${risk.level === 'block' ? 'is-block' : ''}`}>{risk.message}</div>
      ) : null}

      <div className="pos-grid pos-grid--2">
        <div>
          <div className="pos-card" style={{ marginBottom: 12 }}>
            <h2>Sản phẩm</h2>
            {order.items.map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, padding: '0.55rem 0', borderBottom: '1px solid #e2e8f0' }}>
                {item.image_url ? <img className="pos-thumb" src={portalMediaUrl(item.image_url)} alt="" /> : <div className="pos-thumb" />}
                <div style={{ flex: 1 }}>
                  <strong>{item.name}</strong>
                  <div className="pos-hint">{[item.sku, item.color, item.size].filter(Boolean).join(' · ')}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div>×{item.qty}</div>
                  <strong>{vnd(item.price_vnd * item.qty)}</strong>
                </div>
              </div>
            ))}
            <div className="pos-line"><span>Tạm tính</span><span>{vnd(order.subtotal_vnd)}</span></div>
            <div className="pos-line"><span>Giảm giá</span><span>− {vnd(order.discount_vnd)}</span></div>
            <div className="pos-line"><span>Phí vận chuyển</span><span>{vnd(order.shipping_fee_vnd)}</span></div>
            <div className="pos-line"><span>Đã cọc</span><span>− {vnd(order.deposit_vnd)}</span></div>
            <div className="pos-line pos-line--total"><span>Tổng / COD</span><span>{vnd(order.total_vnd)} / {vnd(order.cod_vnd)}</span></div>
          </div>
          <div className="pos-card">
            <h2>Lịch sử trạng thái</h2>
            {order.events.length ? (
              <ul style={{ listStyle: 'none', padding: 0, margin: '0.6rem 0 0' }}>
                {order.events.map((e) => (
                  <li key={e.id} style={{ padding: '0.35rem 0', borderBottom: '1px solid #f1f5f9', fontSize: 14 }}>
                    <strong>{POS_STATUS_LABEL[e.to_status] || e.to_status}</strong>
                    {e.from_status ? <span className="pos-hint"> ← {POS_STATUS_LABEL[e.from_status] || e.from_status}</span> : null}
                    <div className="pos-hint">{e.note} {e.actor_email} · {e.created_at ? new Date(e.created_at).toLocaleString('vi-VN', { timeZone: 'Asia/Saigon' }) : ''}</div>
                  </li>
                ))}
              </ul>
            ) : <p className="pos-hint">Chưa có sự kiện.</p>}
            <div className="pos__actions" style={{ marginTop: 12 }}>
              {(NEXT[order.status] ?? []).map((s) => (
                <button key={s} type="button" disabled={busy} className={`pos-btn ${s === 'cancelled' || s === 'returned' ? 'pos-btn--danger' : 'pos-btn--teal'} pos-btn--sm`} onClick={() => void go(s)}>
                  {POS_STATUS_LABEL[s] || s}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div>
          <div className="pos-card" style={{ marginBottom: 12 }}>
            <h2>Khách hàng</h2>
            <p><strong>{order.customer_name || 'Khách'}</strong></p>
            <p>{order.phone}</p>
            {order.email ? <p>{order.email}</p> : null}
            <p>{[order.address, order.ward, order.district, order.province].filter(Boolean).join(', ')}</p>
            {order.notes ? <p className="pos-hint">Nội bộ: {order.notes}</p> : null}
            {order.customer_notes ? <p className="pos-hint">Khách ghi: {order.customer_notes}</p> : null}
            {order.page_id ? <p className="pos-hint">Page {order.page_id}</p> : null}
            {order.ad_id ? <p className="pos-hint">Ad {order.ad_id}</p> : null}
            {order.post_id ? <p className="pos-hint">Post {order.post_id}</p> : null}
            {order.phone ? <p><a href={`/client/crm/customers?pos=${encodeURIComponent(order.phone)}`}>Hồ sơ khách</a></p> : null}
          </div>
          <div className="pos-card">
            <h2>Vận chuyển</h2>
            {ship ? (
              <>
                <p><strong>{POS_CARRIER_LABEL[ship.carrier] || ship.carrier}</strong> · {ship.service_name}</p>
                <p>Mã vận đơn: <strong>{ship.tracking_code}</strong> {ship.test_mode ? <span className="pos-badge pos-badge--low">TEST</span> : null}</p>
                <p>Phí: {vnd(ship.fee_vnd)} · {SHIP_STATUS_VI[ship.status] || ship.status}</p>
                {ship.label_url ? <p><a href={ship.label_url} target="_blank" rel="noreferrer">In vận đơn</a></p> : null}
                <button type="button" className="pos-btn pos-btn--sm pos-btn--danger" disabled={busy} onClick={() => void posPost(token, `/api/portal/pos/orders/${order.id}/cancel-shipment`, { shipment_id: ship.id }).then(() => load())}>Hủy vận đơn</button>
              </>
            ) : <p className="pos-hint">Chưa gửi vận chuyển.</p>}
          </div>
        </div>
      </div>

      {shipOpen ? (
        <div className="pos-drawer" onClick={() => setShipOpen(false)}>
          <div className="pos-drawer__panel" style={{ width: 460 }} onClick={(e) => e.stopPropagation()}>
            <h2>Gửi vận chuyển</h2>
            <p className="pos-hint">Chế độ TEST mặc định — tạo vận đơn giả lập, không gọi API thật. Cần token GHN / GHTK / Viettel Post (sandbox hoặc live) từ bạn khi muốn kết nối thật.</p>
            <label className="pos-field">Hãng
              <select className="pos-select" value={carrier} onChange={(e) => { setCarrier(e.target.value); setQuotes([]); }}>
                {Object.entries(POS_CARRIER_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            {accounts.length ? (
              <label className="pos-field" style={{ marginTop: 8 }}>Tài khoản
                <select className="pos-select" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                  <option value="">Giả lập (TEST, không cần token)</option>
                  {accounts.filter((a) => a.carrier === carrier).map((a) => (
                    <option key={a.id} value={a.id}>{a.label || a.carrier} {a.test_mode ? '(TEST)' : '(LIVE)'} {a.has_token ? '' : '— chưa có token'}</option>
                  ))}
                </select>
              </label>
            ) : null}
            <button type="button" className="pos-btn" style={{ marginTop: 10 }} disabled={busy} onClick={() => void loadQuotes()}>Lấy bảng giá</button>
            {quotes.length ? (
              <div style={{ marginTop: 12 }}>
                {quotes.map((q) => (
                  <label key={q.service_code} className="pos-picker__item">
                    <input type="radio" name="svc" checked={service === q.service_code} onChange={() => setService(q.service_code)} />
                    <div style={{ flex: 1 }}>
                      <strong>{q.service_name}</strong>
                      <div className="pos-hint">{q.eta}</div>
                    </div>
                    <strong>{vnd(q.fee_vnd)}</strong>
                  </label>
                ))}
                <button type="button" className="pos-btn pos-btn--teal" style={{ marginTop: 12 }} disabled={busy || !service} onClick={() => void sendShip()}>
                  {busy ? 'Đang tạo…' : 'Tạo vận đơn'}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function PortalPosInvoice({ order, size, shop }: { order: PosOrder; size: 'a5' | '80'; shop?: string }) {
  return (
    <div className={size === '80' ? 'pos-invoice pos-invoice--80' : 'pos-invoice'}>
      <h2 style={{ textAlign: 'center', margin: '0 0 8px' }}>{shop || 'Hóa đơn bán hàng'}</h2>
      <p style={{ textAlign: 'center', margin: 0 }}>{order.code}</p>
      <p>{order.created_at ? new Date(order.created_at).toLocaleString('vi-VN', { timeZone: 'Asia/Saigon' }) : ''}</p>
      <p><strong>{order.customer_name}</strong><br />{order.phone}<br />{[order.address, order.ward, order.district, order.province].filter(Boolean).join(', ')}</p>
      <table>
        <thead><tr><th align="left">SP</th><th>SL</th><th align="right">Tiền</th></tr></thead>
        <tbody>
          {order.items.map((i, n) => (
            <tr key={n}>
              <td>{i.name}{[i.color, i.size].filter(Boolean).length ? ` (${[i.color, i.size].filter(Boolean).join('/')})` : ''}</td>
              <td align="center">{i.qty}</td>
              <td align="right">{vnd(i.price_vnd * i.qty)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>Tạm tính: {vnd(order.subtotal_vnd)}<br />Giảm: {vnd(order.discount_vnd)}<br />Phí VC: {vnd(order.shipping_fee_vnd)}<br />Cọc: {vnd(order.deposit_vnd)}</p>
      <p><strong>Tổng: {vnd(order.total_vnd)}</strong><br /><strong>COD: {vnd(order.cod_vnd)}</strong></p>
      {order.shipments[0]?.tracking_code ? <p>Vận đơn: {order.shipments[0].tracking_code}</p> : null}
      <p style={{ textAlign: 'center', marginTop: 16 }}>Cảm ơn quý khách!</p>
      <p className="pos-no-print" style={{ textAlign: 'center' }}>
        <button type="button" onClick={() => window.print()}>In</button>
      </p>
    </div>
  );
}
