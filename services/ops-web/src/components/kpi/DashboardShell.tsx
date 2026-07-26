'use client';

import type { ReactNode } from 'react';
import { OpsNav } from '@/components/OpsNav';
import type { StoredStaffUser } from '@/lib/auth';

interface DashboardShellProps {
  user: StoredStaffUser;
  onLogout: () => void;
  title: string;
  periodHint?: string;
  filters?: ReactNode;
  loading?: boolean;
  error?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function DashboardShell({
  user,
  onLogout,
  title,
  periodHint,
  filters,
  loading,
  error,
  children,
  footer,
}: DashboardShellProps) {
  return (
    <main className="kpi-page dashboard-shell" style={{ maxWidth: 1080, margin: '0 auto', padding: '1.5rem' }}>
      <OpsNav user={user} onLogout={onLogout} />
      <div className="card dashboard-shell__card">
        <div className="kpi-page__head dashboard-shell__head">
          <h2 style={{ margin: 0, fontSize: '1.15rem' }}>{title}</h2>
          {filters ? <div className="kpi-page__filters">{filters}</div> : null}
        </div>
        {periodHint ? <p className="muted dashboard-shell__period">{periodHint}</p> : null}
        {loading ? <p className="muted">Đang tải…</p> : null}
        {error ? <p className="error">{error}</p> : null}
        {children}
        {footer ? <footer className="dashboard-shell__footer muted">{footer}</footer> : null}
      </div>
    </main>
  );
}
