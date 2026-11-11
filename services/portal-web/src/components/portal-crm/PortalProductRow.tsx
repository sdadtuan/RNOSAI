'use client';

import { type ReactNode } from 'react';
import { portalMediaUrl, type PortalProductRecord } from '@/lib/api';

export function portalProductFromList(
  products: PortalProductRecord[],
  productId: string,
): PortalProductRecord | undefined {
  return products.find((item) => item.id === productId);
}

export function resolvePortalProductImage(item: PortalProductRecord | undefined, color?: string): string {
  if (!item) return '';
  if (color?.trim()) {
    const match = item.spec?.colors?.find((entry) => entry.name === color);
    if (match?.image) return match.image;
  }
  return item.image_url || '';
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
  if (src) {
    return <img src={portalMediaUrl(src)} alt={alt} className="portal-product-row__img" />;
  }
  return (
    <div className="portal-product-row__placeholder" aria-hidden>
      <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" stroke="none" />
        <path d="M21 15l-5-5L5 21" />
      </svg>
    </div>
  );
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
