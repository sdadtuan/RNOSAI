'use client';

import { BrandLogo } from '@/components/brand/BrandLogo';
import { useBrand } from '@/components/brand/BrandProvider';

export function LoginBrandPanel() {
  const brand = useBrand();
  return (
    <aside
      className="login-brand"
      style={brand?.hero_url ? { backgroundImage: `url(${brand.hero_url})` } : undefined}
    >
      <div className="login-brand__veil" />
      <BrandLogo className="login-brand__logo" size={160} />
    </aside>
  );
}
