'use client';

import { createContext, useContext, type ReactNode } from 'react';

const PortalAdsChannelContext = createContext<string[] | null>(null);

export function PortalAdsChannelProvider({ ids, children }: { ids: string[] | null; children: ReactNode }) {
  return <PortalAdsChannelContext.Provider value={ids}>{children}</PortalAdsChannelContext.Provider>;
}

export function usePortalAdsChannelIds(): string[] | null {
  return useContext(PortalAdsChannelContext);
}
