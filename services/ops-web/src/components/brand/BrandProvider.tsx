'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { fetchPublicBrand, type PublicBrand } from '@/lib/brand';

const BrandContext = createContext<PublicBrand | null>(null);

function setFavicon(href: string) {
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.href = href;
  const apple = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');
  if (apple) apple.href = href;
}

export function BrandProvider({ children }: { children: React.ReactNode }) {
  const [brand, setBrand] = useState<PublicBrand | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchPublicBrand()
      .then((dto) => {
        if (!cancelled) setBrand(dto);
      })
      .catch(() => {
        /* leave brand null — no text fallback */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (brand?.logo_url) {
      setFavicon(brand.logo_url);
    }
  }, [brand?.logo_url]);

  const value = useMemo(() => brand, [brand]);
  return <BrandContext.Provider value={value}>{children}</BrandContext.Provider>;
}

export function useBrand(): PublicBrand | null {
  return useContext(BrandContext);
}
