import React from 'react';

export function PmMoatNotice({ children }: { children: React.ReactNode }) {
  return <p className="kpi-hub-pm-moat">{children}</p>;
}

export function PmAmberNotice({ children }: { children: React.ReactNode }) {
  return <p className="kpi-hub-pm-notice">{children}</p>;
}
