'use client';

import { useBrand } from './BrandProvider';

type BrandLogoProps = {
  className?: string;
  size?: number;
};

export function BrandLogo({ className, size = 32 }: BrandLogoProps) {
  const brand = useBrand();
  if (!brand?.logo_url) {
    return <span className={className} style={{ display: 'inline-block', width: size, height: size }} />;
  }
  return (
    <img
      src={brand.logo_url}
      alt="PTT"
      className={className}
      width={size}
      height={size}
      style={{ width: size, height: 'auto', objectFit: 'contain' }}
    />
  );
}
