'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { vnd, type PosVariant } from '@/lib/portal-pos-api';
import {
  catalogUnitPrice,
  colorAvailable,
  colorSwatch,
  namedColors,
  pendingAddReason,
  resolvePosProductImage,
  sizesForColor,
  variantAvailableFor,
} from '@/lib/portal-pos-order.util';
import { PosLetterThumb } from '@/components/portal-pos/PosLetterThumb';

type PickerVariant = Pick<PosVariant, 'color' | 'size' | 'available' | 'price_vnd' | 'image_url' | 'active'>;

export function PosVariantPicker({
  name,
  productPrice,
  productImage,
  variants,
  specColors,
  readOnly,
  busy,
  addLabel = 'Thêm vào đơn',
  onClose,
  onAdd,
  footer,
}: {
  name: string;
  productPrice: number | null;
  productImage: string;
  variants: PickerVariant[];
  specColors?: Array<{ name: string; image?: string }>;
  readOnly?: boolean;
  busy?: boolean;
  addLabel?: string;
  onClose?: () => void;
  onAdd: (choice: { color: string; size: string; qty: number }) => void;
  footer?: ReactNode;
}) {
  const colors = useMemo(() => namedColors(variants), [variants]);
  const [color, setColor] = useState(() => colors.find((entry) => colorAvailable(variants, entry) > 0) ?? colors[0] ?? '');
  const sizes = useMemo(() => sizesForColor(variants, color), [variants, color]);
  const [size, setSize] = useState('');
  const [qty, setQty] = useState(1);

  useEffect(() => {
    const next = sizes.find((entry) => variantAvailableFor(variants, color, entry) > 0) ?? '';
    setSize(next);
    setQty(1);
  }, [color, sizes, variants]);

  const matched = variants.find(
    (row) => row.active !== false && String(row.color ?? '').trim() === color && String(row.size ?? '').trim() === size,
  );
  const price = catalogUnitPrice(productPrice, matched?.price_vnd);
  const available = matched ? Math.max(0, Number(matched.available ?? 0)) : 0;
  const needSize = sizes.length > 0;
  const ready = (!colors.length || Boolean(color)) && (!needSize || Boolean(size)) && available > 0 && price > 0;
  const reason = pendingAddReason(name, ready, price, qty, available);
  const image = resolvePosProductImage(
    { image_url: productImage, variants, spec: specColors ? { colors: specColors.map((entry) => ({ name: entry.name, image: entry.image || '' })) } : undefined },
    color,
  );

  return (
    <div className="pos-variant-pick" role="group" aria-label={`Chọn phân loại ${name}`}>
      <PosLetterThumb name={name} src={image} size={96} className="pos-thumb pos-thumb--lg" />
      <div className="pos-variant-pick__body">
        <div className="pos-order-form__pending-head">
          <strong className="pos-order-form__pending-title">{name}</strong>
          {onClose ? (
            <button type="button" className="pos-order-form__icon-remove" aria-label="Bỏ chọn sản phẩm" onClick={onClose}>
              ×
            </button>
          ) : null}
        </div>
        {colors.length ? (
          <div className="pos-chip-row">
            <span className="pos-chip-row__title">Màu</span>
            {colors.map((entry) => {
              const stock = colorAvailable(variants, entry);
              const oos = stock < 1;
              return (
                <button
                  key={entry}
                  type="button"
                  className={`pos-chip${color === entry ? ' is-on' : ''}${oos ? ' is-oos' : ''}`}
                  disabled={Boolean(readOnly) || oos}
                  onClick={() => setColor(entry)}
                >
                  <span className="pos-swatch" style={{ background: colorSwatch(entry) }} aria-hidden />
                  {entry}
                </button>
              );
            })}
          </div>
        ) : null}
        {sizes.length ? (
          <div className="pos-chip-row">
            <span className="pos-chip-row__title">Size</span>
            {sizes.map((entry) => {
              const stock = variantAvailableFor(variants, color, entry);
              const oos = stock < 1;
              return (
                <button
                  key={entry}
                  type="button"
                  className={size === entry ? 'pos-chip is-on' : oos ? 'pos-chip is-oos' : 'pos-chip'}
                  disabled={Boolean(readOnly) || oos}
                  onClick={() => { setSize(entry); setQty(1); }}
                >
                  {entry}
                </button>
              );
            })}
          </div>
        ) : null}
        <p className="pos-hint" style={{ margin: '0.2rem 0' }}>
          Giá {price > 0 ? vnd(price) : 'chưa có'} · {available > 0 ? `Còn ${available}` : 'Hết hàng'}
        </p>
        <div className="pos-order-form__pending-row">
          <div className="pos-stepper" role="group" aria-label="Số lượng">
            <button type="button" className="pos-stepper__btn" disabled={readOnly || qty <= 1 || available < 1} onClick={() => setQty((n) => Math.max(1, n - 1))} aria-label="Giảm">−</button>
            <span className="pos-stepper__n">{qty}</span>
            <button type="button" className="pos-stepper__btn" disabled={readOnly || available < 1 || qty >= Math.max(1, available)} onClick={() => setQty((n) => Math.min(available, n + 1))} aria-label="Tăng">+</button>
          </div>
          <span className="pos-order-form__line-sum">Thành tiền {vnd(price * qty)}</span>
        </div>
        {reason && !ready ? <p className="pos-field__hint">{reason}</p> : null}
        <button
          type="button"
          className="pos-btn pos-btn--teal"
          style={{ width: '100%', marginTop: 6 }}
          disabled={Boolean(readOnly) || Boolean(busy) || !ready}
          onClick={() => onAdd({ color, size, qty })}
        >
          {addLabel}
        </button>
        {footer}
      </div>
    </div>
  );
}
