'use client';

import { useState, type ReactNode } from 'react';
import { portalMediaUrl, type PortalProductRecord } from '@/lib/api';
import { isPlaceholderImage } from '@/lib/portal-pos-order.util';
import { avatarTone, initials } from '@/components/portal-crm/portal-inbox.util';

export function portalProductFromList(
  products: PortalProductRecord[],
  productId: string,
): PortalProductRecord | undefined {
  return products.find((item) => item.id === productId);
}

export function resolvePortalProductImage(item: PortalProductRecord | undefined, color?: string): string {
  if (!item) return '';
  const candidates: string[] = [];
  if (color?.trim()) {
    const match = item.spec?.colors?.find((entry) => entry.name === color);
    if (match?.image) candidates.push(match.image);
  }
  if (item.image_url) candidates.push(item.image_url);
  for (const entry of item.spec?.colors ?? []) {
    if (entry.image) candidates.push(entry.image);
  }
  return candidates.map((entry) => entry.trim()).find((entry) => entry && !isPlaceholderImage(entry)) ?? '';
}

type PortalProductRowProps = {
  name: string;
  imageUrl?: string;
  priceVnd?: number | null;
  variantLine?: string;
  confirmedHighlight?: boolean;
  footer?: ReactNode;
};

function ProductThumb({ src, alt }: { src: string; alt: string }) {
  const [broken, setBroken] = useState(false);
  const url = src && !isPlaceholderImage(src) ? portalMediaUrl(src) : '';
  if (!url || broken) {
    return (
      <span className="pos-letter portal-product-row__img" style={{ background: avatarTone(alt || 'Sản phẩm') }} aria-hidden>
        {initials(alt || 'Sản phẩm')}
      </span>
    );
  }
  return <img src={url} alt={alt} className="portal-product-row__img" onError={() => setBroken(true)} />;
}

export function PortalProductRow({
  name,
  imageUrl,
  priceVnd,
  variantLine,
  confirmedHighlight,
  footer,
}: PortalProductRowProps) {
  const price =
    priceVnd != null && priceVnd > 0 ? `${new Intl.NumberFormat('vi-VN').format(priceVnd)} đ` : null;

  return (
    <div className={confirmedHighlight ? 'portal-product-row is-confirmed' : 'portal-product-row'}>
      <div className="portal-product-row__thumb">
        <ProductThumb src={imageUrl || ''} alt={name} />
      </div>
      <div className="portal-product-row__body">
        <p className="portal-product-row__name">{name}</p>
        {variantLine ? <p className="portal-product-row__variant">{variantLine}</p> : null}
        {price ? <p className="portal-product-row__price">{price}</p> : null}
        {footer ? <div className="portal-product-row__footer">{footer}</div> : null}
      </div>
    </div>
  );
}
