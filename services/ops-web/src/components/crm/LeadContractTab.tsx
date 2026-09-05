'use client';

import type { ReactNode } from 'react';

export function LeadContractTab({ children }: { children: ReactNode }) {
  return (
    <div className="lead-contract-tab" role="tabpanel" id="lead-contract-panel">
      {children}
    </div>
  );
}
