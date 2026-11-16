'use client';

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { SalesDiscoveryBrief } from '@/lib/crm/sales-discovery';

type DiscoveryLiveBriefValue = {
  brief: SalesDiscoveryBrief | null;
  setLiveBrief: (brief: SalesDiscoveryBrief | null) => void;
};

const DiscoveryLiveBriefContext = createContext<DiscoveryLiveBriefValue | null>(null);

export function DiscoveryLiveBriefProvider({ children }: { children: ReactNode }) {
  const [brief, setLiveBrief] = useState<SalesDiscoveryBrief | null>(null);
  const value = useMemo(() => ({ brief, setLiveBrief }), [brief]);
  return <DiscoveryLiveBriefContext.Provider value={value}>{children}</DiscoveryLiveBriefContext.Provider>;
}

export function useDiscoveryLiveBrief() {
  return useContext(DiscoveryLiveBriefContext);
}
