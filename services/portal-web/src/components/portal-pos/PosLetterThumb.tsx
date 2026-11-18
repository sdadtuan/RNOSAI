'use client';

import { useState } from 'react';
import { portalMediaUrl } from '@/lib/api';
import { isPlaceholderImage } from '@/lib/portal-pos-order.util';
import { avatarTone, initials } from '@/components/portal-crm/portal-inbox.util';

export function PosLetterThumb({
  name,
  src,
  size = 40,
  className,
}: {
  name: string;
  src?: string | null;
  size?: number;
  className?: string;
}) {
  const [broken, setBroken] = useState(false);
  const url = src && !isPlaceholderImage(src) ? portalMediaUrl(src) : '';
  const label = name.trim() || 'Sản phẩm';
  if (!url || broken) {
    return (
      <span
        className={className ? `pos-letter ${className}` : 'pos-letter'}
        style={{ width: size, height: size, background: avatarTone(label), fontSize: Math.max(11, Math.round(size * 0.34)) }}
        aria-hidden
      >
        {initials(label)}
      </span>
    );
  }
  return (
    <img
      className={className || 'pos-thumb'}
      src={url}
      alt=""
      width={size}
      height={size}
      onError={() => setBroken(true)}
    />
  );
}
