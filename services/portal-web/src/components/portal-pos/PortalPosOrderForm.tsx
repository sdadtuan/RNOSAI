'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { portalMediaUrl } from '@/lib/api';
import { posGet, posPost, vnd, type PosProduct, type PosOrderItem, type PosRisk, type PosOrder } from '@/lib/portal-pos-api';
import { catalogUnitPrice, inStockVariants, orderBlockReason } from '@/lib/portal-pos-order.util';

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
  const [items, setItems] = useState<Array<PosOrderItem & { available?: number }>>([]);
  const [q, setQ] = useState('');
  const [catalog, setCatalog] = useState<PosProduct[]>([]);
  const [pending, setPending] = useState<PosProduct | null>(null);
  const [pickColor, setPickColor] = useState('');
  const [pickSize, setPickSize] = useState('');
  const [pickQty, setPickQty] = useState(1);
  const [risk, setRisk] = useState<PosRisk | null>(null);
  const [history, setHistory] = useState<Array<{ id: string; code: string; status: string; total_vnd: number; created_at: string }>>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<PosOrder | null>(null);
  const [openPicker, setOpenPicker] = useState(false);
  const [brokenImg, setBrokenImg] = useState<Record<string, boolean>>({});

  useEffect(() => { setPhone(prefill?.phone ?? ''); setName(prefill?.name ?? ''); setAddress(prefill?.address ?? ''); }, [prefill?.phone, prefill?.name, prefill?.address]);

  const totals = useMemo(() => computeLocalTotals(items, discount, shipping, deposit), [items, discount, shipping, deposit]);

  const loadCatalog = useCallback(async () => {
    const res = await posGet<{ products: PosProduct[] }>(token, '/api/portal/pos/products?active=1');
    setCatalog(res.products);
  }, [token]);

  useEffect(() => {
    if (!openPicker) return;
    void loadCatalog().catch(() => setCatalog([]));
  }, [openPicker, loadCatalog]);

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

  const hits = useMemo(() => {
    const term = q.trim().toLowerCase();
    const rows = catalog.filter((product) => product.active !== false);
    if (!term) return rows.slice(0, 30);
    return rows.filter((product) => {
      const hay = [product.name, product.sku, ...product.variants.map((variant) => variant.sku)].join(' ').toLowerCase();
      return hay.includes(term);
    }).slice(0, 30);
  }, [catalog, q]);

  const stocked = pending ? inStockVariants(pending.variants) : [];
  const colors = [...new Set(stocked.map((variant) => variant.color).filter(Boolean))];
  const sizes = [...new Set(stocked.filter((variant) => !pickColor || variant.color === pickColor).map((variant) => variant.size).filter(Boolean))];
  const pickedVariant = stocked.find((variant) => (
    (!colors.length || variant.color === pickColor) && (!sizes.length || variant.size === pickSize)
  )) ?? (stocked.length === 1 ? stocked[0] : undefined);
  const pickedPrice = pending ? catalogUnitPrice(pending.price_vnd, pickedVariant?.price_vnd) : 0;
  const pickedAvailable = pickedVariant ? Number(pickedVariant.available ?? 0) : stocked.length ? 0 : Number(pending?.available ?? 0);

  function chooseProduct(product: PosProduct) {
    const variants = inStockVariants(product.variants);
    const nextColors = [...new Set(variants.map((variant) => variant.color).filter(Boolean))];
    const firstColor = nextColors[0] || '';
    const first = variants.find((variant) => !firstColor || variant.color === firstColor) ?? variants[0];
    setPending(product);
    setPickColor(first?.color || '');
    setPickSize(first?.size || '');
    setPickQty(1);
    setOpenPicker(false);
    setQ('');
  }

  function addPending() {
    if (!pending || !pickedVariant || pickedPrice <= 0 || pickQty < 1 || pickQty > pickedAvailable) return;
    const variant = pickedVariant;
    const qty = pickQty;
    setItems((cur) => {
      const index = cur.findIndex((line) => line.variant_id === variant.id);
      if (index >= 0) {
        return cur.map((line, n) => n === index ? { ...line, qty: line.qty + qty, price_vnd: pickedPrice, available: pickedAvailable } : line);
      }
      return [...cur, {
        product_id: pending.id,
        variant_id: variant.id,
        name: pending.name,
        sku: variant.sku || pending.sku,
        color: variant.color,
        size: variant.size,
        qty,
        price_vnd: pickedPrice,
        cost_vnd: variant.cost_vnd || pending.cost_vnd || 0,
        image_url: variant.image_url || pending.image_url,
        weight_gram: variant.weight_gram || pending.weight_gram || 0,
        available: pickedAvailable,
      }];
    });
    setPending(null);
    setPickQty(1);
  }

  const block = orderBlockReason(items, totals.total_vnd);

  async function submit() {
    if (block) { setError(block); return; }
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
        {openPicker ? (
          <div className="pos-picker pos-picker--drop" role="listbox" aria-label="Danh mục sản phẩm">
            {hits.length ? hits.map((product) => {
              const stockedRows = inStockVariants(product.variants);
              const avail = stockedRows.reduce((sum, variant) => sum + Number(variant.available ?? 0), 0);
              const price = catalogUnitPrice(product.price_vnd, stockedRows.find((variant) => catalogUnitPrice(product.price_vnd, variant.price_vnd) > 0)?.price_vnd);
              const src = product.image_url;
              const broken = !src || brokenImg[product.id];
              const oos = avail <= 0;
              return (
                <button
                  type="button"
                  key={product.id}
                  className={oos ? 'pos-picker__item is-oos' : 'pos-picker__item'}
                  disabled={oos}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => chooseProduct(product)}
                  style={{ width: '100%', background: 'none', border: 0, textAlign: 'left', display: 'flex', gap: 8, alignItems: 'center', padding: '0.45rem 0.55rem' }}
                >
                  {broken ? (
                    <span className="pos-thumb is-placeholder" aria-hidden>
                      <svg viewBox="0 0 24 24" fill="none"><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v9A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-9Z" stroke="currentColor" strokeWidth="1.6"/><path d="m8 14 2.2-2.2a1 1 0 0 1 1.4 0L16 16M9.5 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
                    </span>
                  ) : (
                    <img className="pos-thumb" src={portalMediaUrl(src)} alt="" onError={() => setBrokenImg((cur) => ({ ...cur, [product.id]: true }))} />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{product.name}</strong>
                    <div className="pos-hint">{oos ? 'Hết hàng' : `Còn ${avail}`}</div>
                  </div>
                  {oos ? <span className="pos-stock-badge">Hết hàng</span> : <strong>{vnd(price)}</strong>}
                </button>
              );
            }) : (
              <p className="pos-hint" style={{ margin: 0, padding: '0.6rem 0.75rem' }}>{q.trim() ? 'Không tìm thấy sản phẩm phù hợp.' : 'Chưa có sản phẩm đang bán.'}</p>
            )}
          </div>
        ) : null}
      </div>
      {pending ? (
        <div className="pos-card" style={{ marginTop: 8, padding: 10 }}>
          <strong>{pending.name}</strong>
          <div className="pos-hint">Giá {pickedPrice > 0 ? vnd(pickedPrice) : 'chưa có'} · còn {pickedAvailable}</div>
          {colors.length ? (
            <label className="pos-field">Màu
              <select className="pos-select" value={pickColor} onChange={(e) => {
                const color = e.target.value;
                const next = stocked.find((variant) => variant.color === color);
                setPickColor(color);
                setPickSize(next?.size || '');
              }}>
                {colors.map((color) => <option key={color} value={color}>{color}</option>)}
              </select>
            </label>
          ) : null}
          {sizes.length ? (
            <label className="pos-field">Size
              <select className="pos-select" value={pickSize} onChange={(e) => setPickSize(e.target.value)}>
                {sizes.map((size) => <option key={size} value={size}>{size}</option>)}
              </select>
            </label>
          ) : null}
          <label className="pos-field">Số lượng
            <input className="pos-input" type="number" min={1} max={Math.max(1, pickedAvailable)} value={pickQty} onChange={(e) => setPickQty(Math.max(1, Number(e.target.value) || 1))} />
          </label>
          {pickQty > pickedAvailable ? <p className="pos-warn">Không đủ tồn kho — còn {pickedAvailable}</p> : null}
          <button type="button" className="pos-btn pos-btn--teal pos-btn--sm" disabled={!pickedVariant || pickedPrice <= 0 || pickQty > pickedAvailable} onClick={addPending}>Thêm vào đơn</button>
        </div>
      ) : null}
      {items.map((item, i) => (
        <div key={`${item.variant_id || item.product_id || i}`} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 0' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <strong>{item.name}</strong>
            <div className="pos-hint">{[item.color, item.size].filter(Boolean).join(' / ')}{item.available != null ? ` · còn ${item.available}` : ''}</div>
            {item.available != null && item.qty > item.available ? <div className="pos-warn">Không đủ tồn kho — còn {item.available}</div> : null}
          </div>
          <input
            className="pos-input"
            type="number"
            min={1}
            max={item.available || undefined}
            style={{ width: 64 }}
            aria-label={`Số lượng ${item.name}`}
            value={item.qty}
            onChange={(e) => setItems(items.map((line, n) => n === i ? { ...line, qty: Math.max(1, Number(e.target.value) || 1) } : line))}
          />
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
        {block && items.length ? <p className="pos-warn">{block}</p> : null}
        <button type="button" className="pos-btn pos-btn--teal" style={{ marginTop: 10, width: compact ? '100%' : undefined }} disabled={busy || Boolean(block)} onClick={() => void submit()}>
          {busy ? 'Đang chốt…' : confirmOnCreate ? 'Chốt đơn' : 'Tạo đơn'}
        </button>
      </div>
    </div>
  );
}
