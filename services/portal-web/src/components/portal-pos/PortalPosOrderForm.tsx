'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { posGet, posPost, vnd, type PosProduct, type PosOrderItem, type PosRisk, type PosOrder, type PosVariant } from '@/lib/portal-pos-api';
import {
  catalogUnitPrice,
  hasVariantChoice,
  inStockVariants,
  orderBlockReason,
  pendingAddReason,
  phoneBlockReason,
  productSellWarnings,
  resolvePosProductImage,
} from '@/lib/portal-pos-order.util';
import { PosLetterThumb } from '@/components/portal-pos/PosLetterThumb';
import { PosVariantPicker } from '@/components/portal-pos/PosVariantPicker';

export type OrderFormPrefill = {
  phone?: string;
  name?: string;
  address?: string;
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

function QtyStepper({
  value,
  max,
  disabled,
  onChange,
  label,
}: {
  value: number;
  max: number;
  disabled?: boolean;
  onChange: (n: number) => void;
  label?: string;
}) {
  const cap = Math.max(1, max);
  return (
    <div className="pos-stepper" role="group" aria-label={label || 'Số lượng'}>
      <button type="button" className="pos-stepper__btn" disabled={disabled || value <= 1} onClick={() => onChange(Math.max(1, value - 1))} aria-label="Giảm">
        −
      </button>
      <span className="pos-stepper__n">{value}</span>
      <button type="button" className="pos-stepper__btn" disabled={disabled || value >= cap} onClick={() => onChange(Math.min(cap, value + 1))} aria-label="Tăng">
        +
      </button>
    </div>
  );
}

export function PortalPosOrderForm({
  token, prefill, onCreated, compact, confirmOnCreate = true, readOnly = false,
}: {
  token: string;
  prefill?: OrderFormPrefill;
  onCreated?: (order: PosOrder) => void;
  compact?: boolean;
  confirmOnCreate?: boolean;
  readOnly?: boolean;
}) {
  const [phone, setPhone] = useState(prefill?.phone ?? '');
  const [name, setName] = useState(prefill?.name ?? '');
  const [address, setAddress] = useState(prefill?.address ?? '');
  const [notes, setNotes] = useState('');
  const [discount, setDiscount] = useState(0);
  const [shipping, setShipping] = useState(0);
  const [deposit, setDeposit] = useState(0);
  const [items, setItems] = useState<Array<PosOrderItem & { available?: number }>>([]);
  const [q, setQ] = useState('');
  const [catalog, setCatalog] = useState<PosProduct[]>([]);
  const [pending, setPending] = useState<PosProduct | null>(null);
  const [pendingHint, setPendingHint] = useState('');
  const [risk, setRisk] = useState<PosRisk | null>(null);
  const [history, setHistory] = useState<Array<{ id: string; code: string; status: string; total_vnd: number; created_at: string }>>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<PosOrder | null>(null);
  const [toast, setToast] = useState('');
  const [openPicker, setOpenPicker] = useState(false);
  const pickerWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPhone(prefill?.phone ?? '');
    setName(prefill?.name ?? '');
    setAddress(prefill?.address ?? '');
  }, [prefill?.phone, prefill?.name, prefill?.address]);

  const loadCatalog = useCallback(async () => {
    const params = new URLSearchParams({ active: '1' });
    if (prefill?.page_id?.trim()) params.set('page_id', prefill.page_id.trim());
    const res = await posGet<{ products: PosProduct[] }>(token, `/api/portal/pos/products?${params}`);
    setCatalog(res.products);
  }, [token, prefill?.page_id]);

  useEffect(() => {
    if (!openPicker && !prefill?.page_id) return;
    void loadCatalog().catch(() => setCatalog([]));
  }, [openPicker, loadCatalog, prefill?.page_id]);

  useEffect(() => {
    if (!openPicker) return;
    const close = (event: MouseEvent) => {
      if (!pickerWrapRef.current?.contains(event.target as Node)) setOpenPicker(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [openPicker]);

  const totals = useMemo(
    () => computeLocalTotals(items, discount, shipping, deposit),
    [items, discount, shipping, deposit],
  );

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

  const returning = useMemo(() => {
    const count = history.length || (risk ? (risk.success ?? 0) + (risk.returned ?? 0) : 0);
    if (count < 1) return null;
    const spend = history.reduce(
      (sum, row) => sum + (['success', 'confirmed', 'shipping', 'packing', 'delivered'].includes(row.status) ? row.total_vnd : 0),
      0,
    );
    return { count, spend, highReturn: (risk?.return_rate ?? 0) > 0.2 };
  }, [history, risk]);

  const hits = useMemo(() => {
    const term = q.trim().toLowerCase();
    const rows = catalog.filter((product) => product.active !== false);
    if (!term) return rows.slice(0, 30);
    return rows.filter((product) => {
      const hay = [product.name, product.sku, ...product.variants.map((variant) => variant.sku)].join(' ').toLowerCase();
      return hay.includes(term);
    }).slice(0, 30);
  }, [catalog, q]);

  function resetForm() {
    setItems([]);
    setPending(null);
    setDiscount(0);
    setShipping(0);
    setDeposit(0);
    setNotes('');
    setQ('');
    setPendingHint('');
    setError('');
    setDone(null);
  }

  function commitVariant(product: PosProduct, variant: PosVariant, qty: number) {
    const price = catalogUnitPrice(product.price_vnd, variant.price_vnd);
    const available = Number(variant.available ?? 0);
    const reason = pendingAddReason(product.name, available > 0 && price > 0, price, qty, available);
    if (reason) {
      setPending(product);
      setPendingHint(reason);
      return;
    }
    setItems((cur) => {
      const index = cur.findIndex((line) => line.variant_id === variant.id);
      if (index >= 0) {
        return cur.map((line, n) => (n === index ? { ...line, qty: line.qty + qty, price_vnd: price, available } : line));
      }
      return [...cur, {
        product_id: product.id,
        variant_id: variant.id,
        name: product.name,
        sku: variant.sku || product.sku,
        color: variant.color,
        size: variant.size,
        qty,
        price_vnd: price,
        cost_vnd: variant.cost_vnd || product.cost_vnd || 0,
        image_url: resolvePosProductImage(product, variant.color),
        weight_gram: variant.weight_gram || product.weight_gram || 0,
        available,
      }];
    });
    setPending(null);
    setPendingHint('');
  }

  function chooseProduct(product: PosProduct) {
    setError('');
    setOpenPicker(false);
    setQ('');
    setPendingHint('');
    if (!hasVariantChoice(product.variants)) {
      const variant = inStockVariants(product.variants)[0];
      if (!variant) {
        setPending(product);
        setPendingHint('Không có phân loại — hết hàng.');
        return;
      }
      commitVariant(product, variant, 1);
      return;
    }
    setPending(product);
  }

  const phoneBlock = phoneBlockReason(phone);
  const block = orderBlockReason(items, totals.total_vnd);
  const submitBlock = phoneBlock || block;

  async function submit() {
    if (readOnly) return;
    if (submitBlock) { setError(submitBlock); return; }
    setBusy(true); setError('');
    try {
      const res = await posPost<{ order: PosOrder }>(token, '/api/portal/pos/orders', {
        phone, customer_name: name, address, province: '', district: '', ward: '', notes,
        discount_vnd: discount, shipping_fee_vnd: shipping, deposit_vnd: deposit,
        page_id: prefill?.page_id, case_id: prefill?.case_id, comment_id: prefill?.comment_id,
        source: prefill?.source || (prefill?.case_id ? 'inbox' : prefill?.comment_id ? 'comment' : 'manual'),
        ad_id: prefill?.ad_id, post_id: prefill?.post_id,
        items: items.map((i) => ({ ...i, qty: i.qty, price_vnd: i.price_vnd })),
        confirm: confirmOnCreate,
      });
      onCreated?.(res.order);
      if (compact) {
        setToast(`Đã tạo đơn ${res.order.code}`);
        resetForm();
        window.setTimeout(() => setToast(''), 6000);
      } else {
        setDone(res.order);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tạo được đơn');
    } finally { setBusy(false); }
  }

  if (done && !compact) {
    return (
      <div className="pos">
        <div className="pos-card">
          <p>Đã tạo đơn <strong>{done.code}</strong></p>
          <p><span className={`pos-badge pos-badge--${done.status}`}>{done.status}</span> · {vnd(done.total_vnd)} · COD {vnd(done.cod_vnd)}</p>
          <Link className="pos-btn pos-btn--teal pos-btn--sm" href={`/crm/orders/${done.id}`}>Mở đơn</Link>
          <button type="button" className="pos-btn pos-btn--ghost pos-btn--sm" style={{ marginLeft: 8 }} onClick={resetForm}>Tạo đơn khác</button>
        </div>
      </div>
    );
  }

  const body = (
    <>
      {toast ? (
        <p className="pos-toast" role="status">
          {toast}{' '}
          <Link href={`/crm/orders`}>Xem đơn</Link>
        </p>
      ) : null}
      {risk && risk.level !== 'ok' ? <div className={`pos-warn ${risk.level === 'block' ? 'is-block' : ''}`}>{risk.message} ({risk.success} thành công / {risk.returned} hoàn)</div> : null}
      {returning ? (
        <p className="pos-customer-chip">
          Khách cũ · {returning.count} đơn · tổng {vnd(returning.spend)}
          {returning.highReturn ? <span className="pos-customer-chip__warn"> · Tỷ lệ hoàn cao</span> : null}
        </p>
      ) : null}
      {error ? <p className="pos-error">{error}</p> : null}

      <section className="pos-order-form__block" aria-label="Khách hàng">
        <p className="pos-order-form__label">Khách hàng</p>
        <div className={compact ? 'pos-order-form__customer' : 'pos-grid pos-grid--form'}>
          <label className="pos-field">Tên khách<input className="pos-input" value={name} disabled={readOnly} onChange={(e) => setName(e.target.value)} /></label>
          <label className="pos-field">Số điện thoại<input className="pos-input" inputMode="numeric" value={phone} disabled={readOnly} onChange={(e) => setPhone(e.target.value)} aria-invalid={Boolean(phoneBlock && phone.trim())} />
            {phoneBlock && phone.trim() ? <span className="pos-field__hint pos-error">{phoneBlock}</span> : null}
          </label>
          <label className={`pos-field${compact ? ' pos-field--wide' : ''}`}>Địa chỉ<textarea className="pos-input" rows={compact ? 2 : 2} value={address} disabled={readOnly} onChange={(e) => setAddress(e.target.value)} placeholder="Số nhà, đường, quận, tỉnh…" /></label>
        </div>
      </section>

      <section className="pos-order-form__block" aria-label="Sản phẩm">
        <p className="pos-order-form__label">Sản phẩm</p>
        <div className="pos-picker-wrap" ref={pickerWrapRef}>
          <label className="pos-field">Tìm sản phẩm
            <input
              className="pos-input"
              placeholder="Tên hoặc SKU"
              value={q}
              disabled={readOnly}
              onChange={(e) => { setQ(e.target.value); setOpenPicker(true); }}
              onFocus={() => setOpenPicker(true)}
              aria-label="Tìm sản phẩm"
              aria-expanded={openPicker}
              aria-controls="pos-product-picker"
              autoComplete="off"
            />
          </label>
          {openPicker ? (
            <div id="pos-product-picker" className="pos-picker pos-picker--drop" role="listbox" aria-label="Danh mục sản phẩm">
              {hits.length ? hits.map((product) => {
                const stockedRows = inStockVariants(product.variants);
                const avail = stockedRows.reduce((sum, variant) => sum + Number(variant.available ?? 0), 0);
                const price = catalogUnitPrice(product.price_vnd, stockedRows.find((variant) => catalogUnitPrice(product.price_vnd, variant.price_vnd) > 0)?.price_vnd);
                const sellIssues = productSellWarnings(product);
                const oos = avail <= 0;
                const blocked = readOnly || product.active === false || !(price > 0);
                return (
                  <button
                    type="button"
                    key={product.id}
                    className={oos || sellIssues.length ? 'pos-picker__item is-oos' : 'pos-picker__item'}
                    disabled={blocked}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => chooseProduct(product)}
                  >
                    <PosLetterThumb name={product.name} src={resolvePosProductImage(product)} size={40} />
                    <div className="pos-picker__meta">
                      <strong>{product.name}</strong>
                      <span className="pos-hint">{price > 0 ? vnd(price) : 'Chưa có giá'}</span>
                    </div>
                    <span className="pos-picker__stock">{oos ? 'Hết hàng' : sellIssues[0] || `Còn ${avail}`}</span>
                  </button>
                );
              }) : (
                <p className="pos-hint" style={{ margin: 0, padding: '0.6rem 0.75rem' }}>{q.trim() ? 'Không tìm thấy sản phẩm.' : 'Chưa có sản phẩm đang bán.'}</p>
              )}
            </div>
          ) : null}
        </div>

        {pending && hasVariantChoice(pending.variants) ? (
          <div className="pos-card pos-order-form__pending">
            <PosVariantPicker
              name={pending.name}
              productPrice={pending.price_vnd}
              productImage={pending.image_url}
              variants={pending.variants}
              specColors={pending.spec?.colors}
              readOnly={readOnly}
              onClose={() => { setPending(null); setPendingHint(''); }}
              onAdd={({ color, size, qty }) => {
                const variant = pending.variants.find(
                  (row) => row.active !== false && String(row.color ?? '').trim() === color && String(row.size ?? '').trim() === size,
                );
                if (!variant) {
                  setPendingHint('Chọn đủ màu và size.');
                  return;
                }
                commitVariant(pending, variant, qty);
              }}
            />
            {pendingHint ? <p className="pos-error">{pendingHint}</p> : null}
          </div>
        ) : null}
        {pending && !hasVariantChoice(pending.variants) ? (
          <div className="pos-card pos-order-form__pending">
            <div className="pos-order-form__pending-head">
              <strong className="pos-order-form__pending-title">{pending.name}</strong>
              <button type="button" className="pos-order-form__icon-remove" aria-label="Bỏ chọn sản phẩm" onClick={() => { setPending(null); setPendingHint(''); }}>×</button>
            </div>
            <p className="pos-hint">Không có phân loại</p>
            {pendingHint ? <p className="pos-error">{pendingHint}</p> : null}
          </div>
        ) : null}

        {items.length > 0 ? (
          <div className="pos-order-form__lines" aria-label="Dòng sản phẩm trong đơn">
            {items.map((item, i) => (
              <div key={`${item.variant_id || item.product_id || i}`} className="pos-order-form__line">
                <PosLetterThumb name={item.name} src={item.image_url} size={32} className="pos-thumb pos-thumb--32" />
                <div className="pos-order-form__line-body">
                  <strong>{item.name}</strong>
                  <div className="pos-hint">{[item.color, item.size].filter(Boolean).join(' / ') || 'Không có phân loại'}</div>
                </div>
                <QtyStepper
                  value={item.qty}
                  max={item.available ?? item.qty}
                  disabled={readOnly}
                  onChange={(qty) => setItems((cur) => cur.map((line, n) => (n === i ? { ...line, qty } : line)))}
                  label={`Số lượng ${item.name}`}
                />
                <span className="pos-order-form__line-sum">{vnd(item.price_vnd * item.qty)}</span>
                <button
                  type="button"
                  className="pos-order-form__icon-remove pos-order-form__line-remove"
                  aria-label={`Xóa ${item.name}`}
                  disabled={readOnly}
                  onClick={() => setItems((cur) => cur.filter((_, n) => n !== i))}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="pos-empty pos-empty--sm">Chưa có sản phẩm</p>
        )}
      </section>

      <section className="pos-order-form__block" aria-label="Thanh toán">
        <p className="pos-order-form__label">Thanh toán</p>
        <div className={compact ? 'pos-order-form__money3' : 'pos-grid pos-grid--form'}>
          <label className="pos-field">Giảm giá<input className="pos-input pos-money-input" value={discount || ''} disabled={readOnly} onChange={(e) => setDiscount(Number(e.target.value.replace(/\D/g, '')) || 0)} /></label>
          <label className="pos-field">Phí VC<input className="pos-input pos-money-input" value={shipping || ''} disabled={readOnly} onChange={(e) => setShipping(Number(e.target.value.replace(/\D/g, '')) || 0)} /></label>
          <label className="pos-field">Đặt cọc<input className="pos-input pos-money-input" value={deposit || ''} disabled={readOnly} onChange={(e) => setDeposit(Number(e.target.value.replace(/\D/g, '')) || 0)} /></label>
        </div>
        <label className="pos-field" style={{ marginTop: 8 }}>Ghi chú<textarea className="pos-input" rows={compact ? 1 : 2} value={notes} disabled={readOnly} onChange={(e) => setNotes(e.target.value)} /></label>
      </section>

    </>
  );

  const footer = (
    <div className={compact ? 'pos-order-form__footer' : undefined}>
      <div className="pos-line"><span>Tạm tính</span><span className="pos-tabular">{vnd(totals.subtotal_vnd)}</span></div>
      {discount > 0 ? <div className="pos-line"><span>Giảm</span><span className="pos-tabular">−{vnd(totals.discount_vnd)}</span></div> : null}
      {shipping > 0 ? <div className="pos-line"><span>VC</span><span className="pos-tabular">{vnd(totals.shipping_fee_vnd)}</span></div> : null}
      {deposit > 0 ? <div className="pos-line"><span>Cọc</span><span className="pos-tabular">{vnd(totals.deposit_vnd)}</span></div> : null}
      <div className="pos-line pos-line--total pos-line--cod"><span>TỔNG COD</span><span className="pos-tabular">{vnd(totals.cod_vnd)}</span></div>
      {submitBlock && (items.length || phone.trim()) ? <p className="pos-field__hint">{submitBlock}</p> : null}
      <button type="button" className="pos-btn pos-btn--teal" style={{ marginTop: 10, width: '100%' }} disabled={busy || readOnly || Boolean(submitBlock)} onClick={() => void submit()}>
        {busy ? 'Đang chốt…' : confirmOnCreate ? 'Chốt đơn' : 'Tạo đơn'}
      </button>
    </div>
  );

  return (
    <div className={compact ? 'pos pos-order-form is-compact' : 'pos pos-order-form'}>
      <div className={compact ? 'pos-order-form__scroll' : undefined}>
        {body}
        {!compact ? footer : null}
      </div>
      {compact ? footer : null}
    </div>
  );
}