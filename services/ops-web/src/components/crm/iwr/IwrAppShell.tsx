'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState, type HTMLAttributes, type ReactNode } from 'react';
import type { StoredStaffUser } from '@/lib/auth';
import { fetchIwrInbox, fetchIwrRisks, fetchIwrSearch, type IwrReportRow } from '@/lib/crm/iwr-api';
import { IwrSendDrawer } from './IwrSendDrawer';
import { iwrInitials, iwrRoleLabel } from './iwr-format';
import './iwr-app.css';

type IwrAppShellProps = {
  user: StoredStaffUser | null;
  token?: string;
  onLogout: () => void;
  loading?: boolean;
  canWrite?: boolean;
  sendOpen?: boolean;
  onSendOpenChange?: (open: boolean) => void;
  children: ReactNode;
};

type NavItem = {
  href: string;
  label: string;
  icon: ReactNode;
  match: (path: string, kind: string | null) => boolean;
  badgeKey?: 'inbox' | 'risks';
};

function Icon({ d }: { d: string }) {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <path d={d} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const NAV: NavItem[] = [
  {
    href: '/crm/internal-reports',
    label: 'Tổng quan',
    icon: <Icon d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z" />,
    match: (p, k) => p === '/crm/internal-reports' && !k,
  },
  {
    href: '/crm/internal-reports?kind=daily',
    label: 'Báo cáo ngày',
    icon: <Icon d="M7 4h10a2 2 0 0 1 2 2v14l-3-2-3 2-3-2-3 2V6a2 2 0 0 1 2-2zM8 9h8M8 13h6" />,
    match: (p, k) => p === '/crm/internal-reports' && k === 'daily',
  },
  {
    href: '/crm/internal-reports?kind=weekly',
    label: 'Báo cáo tuần',
    icon: <Icon d="M7 4h10a2 2 0 0 1 2 2v14H5V6a2 2 0 0 1 2-2zm-2 6h14M8 3v3m8-3v3" />,
    match: (p, k) => p === '/crm/internal-reports' && k === 'weekly',
  },
  {
    href: '/crm/internal-reports/inbox',
    label: 'Hộp thư báo cáo',
    icon: <Icon d="M4 7h16v12H4zM4 7l8 6 8-6" />,
    match: (p) => p.startsWith('/crm/internal-reports/inbox'),
    badgeKey: 'inbox',
  },
  {
    href: '/crm/internal-reports/team',
    label: 'Dự án',
    icon: <Icon d="M4 20V9l8-5 8 5v11M9 20v-6h6v6" />,
    match: (p) => p.startsWith('/crm/internal-reports/team'),
  },
  {
    href: '/crm/internal-reports/risks',
    label: 'Blocker & Rủi ro',
    icon: <Icon d="M12 4 21 19H3L12 4zm0 6v4m0 3h.01" />,
    match: (p) => p.startsWith('/crm/internal-reports/risks'),
    badgeKey: 'risks',
  },
  {
    href: '/crm/internal-reports/dashboards',
    label: 'Dashboard',
    icon: <Icon d="M4 19V9m6 10V5m6 14v-7m6 7V8" />,
    match: (p) => p.startsWith('/crm/internal-reports/dashboards'),
  },
  {
    href: '/crm/internal-reports/templates',
    label: 'Mẫu báo cáo',
    icon: <Icon d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />,
    match: (p) => p.startsWith('/crm/internal-reports/templates'),
  },
  {
    href: '/crm/internal-reports/schedules',
    label: 'Cài đặt',
    icon: <Icon d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM19.4 15a7.8 7.8 0 0 0 .1-1.5 7.8 7.8 0 0 0-.1-1.5l2-1.6-1.9-3.3-2.4 1a8 8 0 0 0-2.6-1.5L14 3h-4l-.5 2.6a8 8 0 0 0-2.6 1.5l-2.4-1-1.9 3.3 2 1.6A7.8 7.8 0 0 0 4.5 13.5 7.8 7.8 0 0 0 4.6 15l-2 1.6 1.9 3.3 2.4-1a8 8 0 0 0 2.6 1.5L10 21h4l.5-2.6a8 8 0 0 0 2.6-1.5l2.4 1 1.9-3.3-2-1.6z" />,
    match: (p) =>
      p.startsWith('/crm/internal-reports/schedules') ||
      p.startsWith('/crm/internal-reports/lists') ||
      p.startsWith('/crm/internal-reports/builder'),
  },
];

export function IwrAppShell({
  user,
  token,
  onLogout,
  loading,
  canWrite,
  sendOpen,
  onSendOpenChange,
  children,
}: IwrAppShellProps) {
  const pathname = usePathname() ?? '';
  const params = useSearchParams();
  const kind = params.get('kind');
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<IwrReportRow[]>([]);
  const [inboxCount, setInboxCount] = useState(0);
  const [riskCount, setRiskCount] = useState(0);
  const [innerSend, setInnerSend] = useState(false);
  const drawerOpen = sendOpen ?? innerSend;
  const setDrawer = onSendOpenChange ?? setInnerSend;

  useEffect(() => {
    if (!token) return;
    void fetchIwrInbox(token, 'action')
      .then((out) => setInboxCount(out.items?.length ?? 0))
      .catch(() => setInboxCount(0));
    void fetchIwrRisks(token)
      .then((out) => setRiskCount((out.items ?? []).filter((r) => r.status !== 'closed').length))
      .catch(() => setRiskCount(0));
  }, [token]);

  useEffect(() => {
    if (!token || q.trim().length < 2) {
      setHits([]);
      return;
    }
    const t = window.setTimeout(() => {
      void fetchIwrSearch(token, q.trim())
        .then((out) => setHits(out.items ?? []))
        .catch(() => setHits([]));
    }, 250);
    return () => window.clearTimeout(t);
  }, [token, q]);

  const badges = useMemo(() => ({ inbox: inboxCount, risks: riskCount }), [inboxCount, riskCount]);
  const initials = iwrInitials(user?.display_name);
  const role = iwrRoleLabel(user?.position_code, user?.job_functions);

  return (
    <div className="iwr-app">
      <aside className="iwr-aside">
        <div className="iwr-aside__brand">
          <Link href="/crm" className="iwr-aside__back">
            ← CRM
          </Link>
          <div className="iwr-aside__title">BC nội bộ</div>
        </div>
        <nav className="iwr-aside__nav">
          {NAV.map((item) => {
            const active = item.match(pathname, kind);
            const badge = item.badgeKey ? badges[item.badgeKey] : 0;
            return (
              <Link key={item.href} href={item.href} className={`iwr-nav${active ? ' is-active' : ''}`}>
                {item.icon}
                <span className="iwr-nav__label">{item.label}</span>
                {badge > 0 && (
                  <span className={`iwr-badge${item.badgeKey === 'risks' ? ' iwr-badge--danger' : ''}`}>
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="iwr-aside__meta">
          <div>Vai trò: {role}</div>
          <div>Bộ phận: {user?.tenant === 'ptt' ? 'PTT' : 'Nội bộ'}</div>
          <button type="button" className="iwr-aside__logout" onClick={onLogout}>
            Đăng xuất
          </button>
        </div>
      </aside>

      <div className="iwr-main">
        <header className="iwr-top">
          <div className="iwr-search">
            <span className="iwr-search__icon">⌕</span>
            <input
              placeholder="Tìm báo cáo, dự án, khách hàng, nhân sự..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            {hits.length > 0 && (
              <ul className="iwr-search__hits">
                {hits.map((row) => (
                  <li key={row.id}>
                    <Link href={`/crm/internal-reports/${row.id}`} onClick={() => setQ('')}>
                      <strong>{row.title}</strong>
                      <div className="iwr-muted">{row.author_name ?? row.template_name_vi}</div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Link href="/crm/internal-reports/inbox?box=unread" className="iwr-bell" aria-label="Thông báo">
            🔔
            {inboxCount > 0 && <span className="iwr-badge iwr-badge--danger">{inboxCount > 99 ? '99+' : inboxCount}</span>}
          </Link>
          <div className="iwr-avatar" title={user?.display_name}>
            {initials}
          </div>
        </header>
        <main className="iwr-body">{loading || !user ? <p className="iwr-muted">Đang tải…</p> : children}</main>
      </div>

      {token && (
        <IwrSendDrawer open={drawerOpen} token={token} canWrite={!!canWrite} onClose={() => setDrawer(false)} />
      )}
    </div>
  );
}

export function IwrCard({
  children,
  className = '',
  ...rest
}: { children: ReactNode; className?: string } & HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`iwr-card ${className}`.trim()} {...rest}>
      {children}
    </div>
  );
}
