'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState, type HTMLAttributes, type ReactNode } from 'react';
import type { StoredStaffUser } from '@/lib/auth';
import { fetchIwrInbox, fetchIwrRisks, fetchIwrSearch, type IwrReportRow } from '@/lib/crm/iwr-api';
import { IwrSendDrawer } from './IwrSendDrawer';
import { iwrInitials, iwrRoleLabel } from './iwr-format';

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
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 fill-none stroke-current stroke-[1.7]" aria-hidden>
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
    icon: <Icon d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm8.5 4a7.5 7.5 0 0 0-.2-1.6l2-1.5-2-3.5-2.4 1a7.7 7.7 0 0 0-2.8-1.6L12.5 2h-4l-.6 2.8a7.7 7.7 0 0 0-2.8 1.6l-2.4-1-2 3.5 2 1.5A7.5 7.5 0 0 0 2.5 12c0 .55.07 1.08.2 1.6l-2 1.5 2 3.5 2.4-1a7.7 7.7 0 0 0 2.8 1.6l.6 2.8h4l.6-2.8a7.7 7.7 0 0 0 2.8-1.6l2.4 1 2-3.5-2-1.5c.13-.52.2-1.05.2-1.6z" />,
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
    <div className="flex min-h-screen bg-[#F4F6FB] text-slate-800">
      <aside className="flex w-[232px] shrink-0 flex-col bg-[#0B1F4D] text-white">
        <div className="px-5 pb-2 pt-5">
          <Link href="/crm" className="text-[11px] uppercase tracking-wider text-white/50 hover:text-white/80">
            ← CRM
          </Link>
          <div className="mt-2 text-base font-semibold tracking-tight">BC nội bộ</div>
        </div>
        <nav className="flex-1 space-y-0.5 px-3 py-3">
          {NAV.map((item) => {
            const active = item.match(pathname, kind);
            const badge = item.badgeKey ? badges[item.badgeKey] : 0;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 rounded-full px-3 py-2 text-[13px] ${
                  active ? 'bg-[#0052CC] text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'
                }`}
              >
                <span className="opacity-80">{item.icon}</span>
                <span className="flex-1 truncate">{item.label}</span>
                {badge > 0 && (
                  <span
                    className={`min-w-[18px] rounded-full px-1.5 text-center text-[10px] font-semibold ${
                      item.badgeKey === 'risks' ? 'bg-[#FF5630] text-white' : 'bg-[#2684FF] text-white'
                    }`}
                  >
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-white/10 px-4 py-4 text-[11px] text-white/70">
          <div>Vai trò: {role}</div>
          <div className="mt-0.5">Bộ phận: {user?.tenant === 'ptt' ? 'PTT' : 'Nội bộ'}</div>
          <button type="button" className="mt-2 text-white/50 hover:text-white" onClick={onLogout}>
            Đăng xuất
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-slate-200/80 bg-white px-6 py-3">
          <div className="relative mx-auto w-full max-w-xl">
            <input
              className="w-full rounded-full border border-slate-200 bg-[#F4F6FB] px-4 py-2 pl-9 text-sm outline-none focus:border-[#0052CC]"
              placeholder="Tìm báo cáo, dự án, nhân sự..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <span className="pointer-events-none absolute left-3 top-2 text-slate-400">⌕</span>
            {hits.length > 0 && (
              <ul className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-xl border bg-white py-1 text-sm shadow-lg">
                {hits.map((row) => (
                  <li key={row.id}>
                    <Link
                      href={`/crm/internal-reports/${row.id}`}
                      className="block px-3 py-2 hover:bg-slate-50"
                      onClick={() => setQ('')}
                    >
                      <div className="font-medium">{row.title}</div>
                      <div className="text-xs text-slate-500">{row.author_name ?? row.template_name_vi}</div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Link
            href="/crm/internal-reports/inbox?box=unread"
            className="relative shrink-0 rounded-full p-2 text-slate-500 hover:bg-slate-100"
            aria-label="Thông báo"
          >
            <span className="text-lg">🔔</span>
            {inboxCount > 0 && (
              <span className="absolute right-0 top-0 rounded-full bg-[#FF5630] px-1.5 text-[10px] font-semibold text-white">
                {inboxCount > 99 ? '99+' : inboxCount}
              </span>
            )}
          </Link>
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0B1F4D] text-xs font-semibold text-white"
            title={user?.display_name}
          >
            {initials}
          </div>
        </header>
        <main className="flex-1 px-6 py-5">
          {loading || !user ? <p className="text-sm text-slate-500">Đang tải…</p> : children}
        </main>
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
    <div className={`rounded-2xl border border-slate-100 bg-white p-5 shadow-sm ${className}`} {...rest}>
      {children}
    </div>
  );
}
