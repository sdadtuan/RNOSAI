'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { portalMediaUrl } from '@/lib/api';
import { posGet, posPost, vnd, type PosProduct, type PosOrderItem, type PosRisk, type PosOrder } from '@/lib/portal-pos-api';

export type OrderFormPrefill = {
  phone?: string;
  name?: string;
  address?: string;
  province?: string;
  district?: string;
  ward?: string;
  page_id?: string;
  case_id?: string;
  comment_id?: string;
  source?: string;
  ad_id?: string;
  post_id?: string;
};

export function computeLocalTotals(items: PosOrderItem[], discount: number, shipping: number, deposit: number) {
  const subtotal = items.reduce((s, i) => s + i.qty * i.price_vnd, 0);
  const d = Math.min(Math.max(0, discount), subtotal);
  const total = Math.max(0, subtotal - d + Math.max(0, shipping));
  const dep = Math.min(Math.max(0, deposit), total);
  return { subtotal_vnd: subtotal, discount_vnd: d, shipping_fee_vnd: Math.max(0, shipping), deposit_vnd: dep, total_vnd: total, cod_vnd: Math.max(0, total - dep) };
}

export function PortalPosOrderForm({
  token, prefill, onCreated, compact, confirmOnCreate = true,
}: {
  token: string;
  prefill?: OrderFormPrefill;
  onCreated?: (order: PosOrder) => void;
  compact?: boolean;
  confirmOnCreate?: boolean;
}) {
  const [phone, setPhone] = useState(prefill?.phone ?? '');
  const [name, setName] = useState(prefill?.name ?? '');
  const [address, setAddress] = useState(prefill?.address ?? '');
  const [province, setProvince] = useState(prefill?.province ?? '');
  const [district, setDistrict] = useState(prefill?.district ?? '');
  const [ward, setWard] = useState(prefill?.ward ?? '');
  const [notes, setNotes] = useState('');
  const [discount, setDiscount] = useState(0);
  const [shipping, setShipping] = useState(0);
  const [deposit, setDeposit] = useState(0);
  const [items, setItems] = useState<PosOrderItem[]>([]);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<PosProduct[]>([]);
  const [risk, setRisk] = useState<PosRisk | null>(null);
  const [history, setHistory] = useState<Array<{ id: string; code: string; status: string; total_vnd: number; created_at: string }>>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<PosOrder | null>(null);
  const [openPicker, setOpenPicker] = useState(false);
  const [brokenImg, setBrokenImg] = useState<Record<string, boolean>>({});

  useEffect(() => { setPhone(prefill?.phone ?? ''); setName(prefill?.name ?? ''); setAddress(prefill?.address ?? ''); }, [prefill?.phone, prefill?.name, prefill?.address]);

  const totals = useMemo(() => computeLocalTotals(items, discount, shipping, deposit), [items, discount, shipping, deposit]);

  const search = useCallback(async (term: string) => {
    const res = await posGet<{ products: PosProduct[] }>(token, `/api/portal/pos/products?q=${encodeURIComponent(term)}&active=1`);
    setHits(res.products.slice(0, 12));
  }, [token]);

  useEffect(() => {
    if (!openPicker || !q.trim()) { setHits([]); return; }
    const timer = setTimeout(() => { void search(q.trim()).catch(() => setHits([])); }, 200);
    return () => clearTimeout(timer);
  }, [q, search, openPicker]);

  useEffect(() => {
    const p = phone.trim();
    if (p.length < 9) { setRisk(null); setHistory([]); return; }
    const t = setTimeout(() => {
      void posGet<{ risk: PosRisk; orders?: typeof history; success?: number; returned?: number }>(
        token, `/api/portal/pos/customers/by-phone?phone=${encodeURIComponent(p)}`,
      ).then((res) => {
        setRisk(res.risk);
        setHistory(res.orders ?? []);
      }).catch(() => undefined);
    }, 400);
    return () => clearTimeout(t);
  }, [phone, token]);

  function stockOf(p: PosProduct, v?: PosProduct['variants'][number] | null) {
    if (v) return Number(v.available ?? 0);
    return Number(p.available ?? 0);
  }

  function addVariant(p: PosProduct, v = p.variants.find((x) => x.active) ?? p.variants[0]) {
    if (stockOf(p, v) <= 0) return;
    if (!v) {
      setItems((cur) => [...cur, { name: p.name, sku: p.sku, color: '', size: '', qty: 1, price_vnd: p.price_vnd || 0, image_url: p.image_url, product_id: p.id, variant_id: undefined, cost_vnd: p.cost_vnd || 0, weight_gram: p.weight_gram || 0 }]);
      return;
    }
    setItems((cur) => {
      const i = cur.findIndex((x) => x.variant_id === v.id);
      if (i >= 0) return cur.map((x, n) => n === i ? { ...x, qty: x.qty + 1 } : x);
      return [...cur, {
        product_id: p.id, variant_id: v.id, name: p.name, sku: v.sku || p.sku,
        color: v.color, size: v.size, qty: 1, price_vnd: v.price_vnd || p.price_vnd || 0,
        cost_vnd: v.cost_vnd || 0, image_url: v.image_url || p.image_url, weight_gram: v.weight_gram || p.weight_gram || 0,
      }];
    });
    setQ(''); setHits([]);
  }

  async function submit() {
    if (!items.length) { setError('Chọn ít nhất một sản phẩm.'); return; }
    if (!phone.trim()) { setError('Nhập số điện thoại.'); return; }
    setBusy(true); setError('');
    try {
      const res = await posPost<{ order: PosOrder }>(token, '/api/portal/pos/orders', {
        phone, customer_name: name, address, province, district, ward, notes,
        discount_vnd: discount, shipping_fee_vnd: shipping, deposit_vnd: deposit,
        page_id: prefill?.page_id, case_id: prefill?.case_id, comment_id: prefill?.comment_id,
        source: prefill?.source || (prefill?.case_id ? 'inbox' : prefill?.comment_id ? 'comment' : 'manual'),
        ad_id: prefill?.ad_id, post_id: prefill?.post_id,
        items: items.map((i) => ({ ...i, qty: i.qty, price_vnd: i.price_vnd })),
        confirm: confirmOnCreate,
      });
      setDone(res.order);
      onCreated?.(res.order);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tạo được đơn');
    } finally { setBusy(false); }
  }

  if (done) {
    return (
      <div className="pos">
        <div className="pos-card">
          <p>Đã tạo đơn <strong>{done.code}</strong></p>
          <p><span className={`pos-badge pos-badge--${done.status}`}>{done.status}</span> · {vnd(done.total_vnd)} · COD {vnd(done.cod_vnd)}</p>
          <a className="pos-btn pos-btn--teal pos-btn--sm" href={`/client/crm/orders/${done.id}`}>Mở đơn</a>
        </div>
      </div>
    );
  }

  return (
    <div className={compact ? 'pos pos-order-form is-compact' : 'pos'}>
      {risk && risk.level !== 'ok' ? <div className={`pos-warn ${risk.level === 'block' ? 'is-block' : ''}`}>{risk.message} ({risk.success} thành công / {risk.returned} hoàn)</div> : null}
      {history.length ? (
        <p className="pos-hint">Lịch sử: {history.filter((o) => o.status === 'success').length} thành công, {history.filter((o) => o.status === 'returned').length} hoàn · {history.slice(0, 3).map((o) => o.code).join(', ')}</p>
      ) : null}
      {error ? <p className="pos-error">{error}</p> : null}
      <div className={compact ? '' : 'pos-grid pos-grid--form'}>
        <label className="pos-field">Tên khách<input className="pos-input" value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label className="pos-field">Số điện thoại<input className="pos-input" value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
        <label className="pos-field">Địa chỉ<textarea className="pos-input" rows={compact ? 1 : 2} value={address} onChange={(e) => setAddress(e.target.value)} /></label>
        {!compact ? (
          <>
            <label className="pos-field">Tỉnh/TP<input className="pos-input" value={province} onChange={(e) => setProvince(e.target.value)} /></label>
            <label className="pos-field">Quận/Huyện<input className="pos-input" value={district} onChange={(e) => setDistrict(e.target.value)} /></label>
            <label className="pos-field">Phường/Xã<input className="pos-input" value={ward} onChange={(e) => setWard(e.target.value)} /></label>
          </>
        ) : null}
      </div>
      <div className="pos-picker-wrap" style={{ marginTop: 10 }}>
        <label className="pos-field">Thêm sản phẩm
          <input
            className="pos-input"
            placeholder="Tìm tên hoặc SKU"
            value={q}
            onChange={(e) => { setQ(e.target.value); setOpenPicker(true); }}
            onFocus={() => setOpenPicker(true)}
            onBlur={() => { window.setTimeout(() => setOpenPicker(false), 180); }}
            aria-label="Tìm sản phẩm"
            autoComplete="off"
          />
        </label>
        {openPicker && hits.length ? (
          <div className="pos-picker pos-picker--drop" role="listbox" aria-label="Sản phẩm gợi ý">
            {hits.map((p) => (
              <div key={p.id}>
                {(p.variants.length ? p.variants.filter((v) => v.active) : [null]).map((v, i) => {
                  const avail = stockOf(p, v);
                  const oos = avail <= 0;
                  const src = v?.image_url || p.image_url;
                  const imgKey = `${p.id}:${v?.id || 'base'}`;
                  const broken = !src || brokenImg[imgKey];
                  return (
                    <button
                      type="button"
                      className={oos ? 'pos-picker__item is-oos' : 'pos-picker__item'}
                      key={v?.id || i}
                      disabled={oos}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => { if (!oos) { addVariant(p, v ?? undefined); setOpenPicker(false); } }}
                      style={{ width: '100%', background: 'none', border: 0, textAlign: 'left', display: 'flex', gap: 8, alignItems: 'center', padding: '0.45rem 0.55rem' }}
                    >
                      {broken ? (
                        <span className="pos-thumb is-placeholder" aria-hidden>
                          <svg viewBox="0 0 24 24" fill="none"><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v9A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-9Z" stroke="currentColor" strokeWidth="1.6"/><path d="m8 14 2.2-2.2a1 1 0 0 1 1.4 0L16 16M9.5 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
                        </span>
                      ) : (
                        <img
                          className="pos-thumb"
                          src={portalMediaUrl(src)}
                          alt=""
                          onError={() => setBrokenImg((cur) => ({ ...cur, [imgKey]: true }))}
                        />
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</strong>
                        <div className="pos-hint">{[v?.sku || p.sku, v?.color, v?.size].filter(Boolean).join(' · ')}{oos ? '' : ` · còn ${avail}`}</div>
                      </div>
                      {oos ? <span className="pos-stock-badge">Hết hàng</span> : <strong>{vnd(v?.price_vnd || p.price_vnd || 0)}</strong>}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        ) : openPicker ? (
          <div className="pos-picker pos-picker--drop"><p className="pos-hint" style={{ margin: 0, padding: '0.6rem 0.75rem' }}>{q.trim() ? 'Không tìm thấy sản phẩm phù hợp.' : 'Gõ tên hoặc SKU để tìm sản phẩm.'}</p></div>
        ) : null}
      </div>
      {items.map((item, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 0' }}>
          <div style={{ flex: 1 }}>
            <strong>{item.name}</strong>
            <div className="pos-hint">{[item.color, item.size].filter(Boolean).join(' / ')}</div>
          </div>
          <input className="pos-input" style={{ width: 56 }} value={item.qty} onChange={(e) => setItems(items.map((x, n) => n === i ? { ...x, qty: Math.max(1, Number(e.target.value) || 1) } : x))} />
          <span>{vnd(item.price_vnd * item.qty)}</span>
          <button type="button" className="pos-btn pos-btn--sm pos-btn--danger" onClick={() => setItems(items.filter((_, n) => n !== i))}>Xóa</button>
        </div>
      ))}
      <div className={compact ? 'pos-order-form__money3' : 'pos-grid pos-grid--form'} style={compact ? undefined : { marginTop: 8 }}>
        <label className="pos-field">Giảm giá<input className="pos-input" value={discount || ''} onChange={(e) => setDiscount(Number(e.target.value.replace(/\D/g, '')) || 0)} /></label>
        <label className="pos-field">Phí vận chuyển<input className="pos-input" value={shipping || ''} onChange={(e) => setShipping(Number(e.target.value.replace(/\D/g, '')) || 0)} /></label>
        <label className="pos-field">Đã cọc<input className="pos-input" value={deposit || ''} onChange={(e) => setDeposit(Number(e.target.value.replace(/\D/g, '')) || 0)} /></label>
      </div>
      <label className="pos-field" style={{ marginTop: 8 }}>Ghi chú<textarea className="pos-input" rows={compact ? 1 : 2} value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
      <div className={compact ? 'pos-order-form__footer' : undefined}>
        <div className="pos-line"><span>Tạm tính</span><span>{vnd(totals.subtotal_vnd)}</span></div>
        <div className="pos-line pos-line--total"><span>Tổng / COD</span><span>{vnd(totals.total_vnd)} / {vnd(totals.cod_vnd)}</span></div>
        <button type="button" className="pos-btn pos-btn--teal" style={{ marginTop: 10, width: compact ? '100%' : undefined }} disabled={busy} onClick={() => void submit()}>
          {busy ? 'Đang chốt…' : confirmOnCreate ? 'Chốt đơn' : 'Tạo đơn'}
        </button>
      </div>
    </div>
  );
}
