'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type ReactNode, useMemo, useState } from 'react';
import { KPI_HUB_NAV, activeKpiHubHref } from '@/lib/kpi-hub-nav';
import { KpiHubFreshnessFooter } from './KpiHubFreshnessFooter';

export type KpiHubBreadcrumb = { label: string; href?: string };

type KpiHubShellProps = {
  title: string;
  subtitle?: string;
  breadcrumb?: KpiHubBreadcrumb[];
  actions?: ReactNode;
  showFreshness?: boolean;
  children: ReactNode;
};

function NavIcon({ icon }: { icon: string }) {
  const common = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 };
  switch (icon) {
    case 'dashboard':
      return (
        <svg {...common}>
          <rect x="3" y="3" width="7" height="9" rx="1" />
          <rect x="14" y="3" width="7" height="5" rx="1" />
          <rect x="14" y="12" width="7" height="9" rx="1" />
          <rect x="3" y="16" width="7" height="5" rx="1" />
        </svg>
      );
    case 'book':
      return (
        <svg {...common}>
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </svg>
      );
    case 'target':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="12" r="6" />
          <circle cx="12" cy="12" r="2" />
        </svg>
      );
    case 'database':
      return (
        <svg {...common}>
          <ellipse cx="12" cy="5" rx="9" ry="3" />
          <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
          <path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3" />
        </svg>
      );
    case 'shield':
      return (
        <svg {...common}>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      );
    case 'chart':
      return (
        <svg {...common}>
          <path d="M3 3v18h18" />
          <path d="M18 17V9" />
          <path d="M13 17V5" />
          <path d="M8 17v-3" />
        </svg>
      );
    case 'gear':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
        </svg>
      );
    default:
      return null;
  }
}

export function KpiHubShell({
  title,
  subtitle,
  breadcrumb = [],
  actions,
  showFreshness = false,
  children,
}: KpiHubShellProps) {
  const pathname = usePathname() ?? '';
  const activeHref = useMemo(() => activeKpiHubHref(pathname), [pathname]);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className={`kpi-hub-shell${collapsed ? ' kpi-hub-shell--collapsed' : ''}`}>
      <aside className="kpi-hub-sidebar">
        <div className="kpi-hub-sidebar__brand">
          <span className="kpi-hub-sidebar__logo" aria-hidden>
            <NavIcon icon="chart" />
          </span>
          {!collapsed ? <strong>KPI Hub</strong> : null}
        </div>
        <nav className="kpi-hub-sidebar__nav" aria-label="KPI Hub">
          {KPI_HUB_NAV.map((item) => {
            const active = activeHref === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`kpi-hub-sidebar__link${active ? ' is-active' : ''}`}
              >
                <span className="kpi-hub-sidebar__icon" aria-hidden>
                  <NavIcon icon={item.icon} />
                </span>
                {!collapsed ? <span>{item.label}</span> : null}
              </Link>
            );
          })}
        </nav>
        <button
          type="button"
          className="kpi-hub-sidebar__collapse"
          onClick={() => setCollapsed((v) => !v)}
        >
          {collapsed ? '»' : 'Thu gọn'}
        </button>
      </aside>

      <div className="kpi-hub-main">
        <header className="kpi-hub-header">
          <div className="kpi-hub-header__left">
            {breadcrumb.length ? (
              <nav className="kpi-hub-breadcrumb" aria-label="Breadcrumb">
                {breadcrumb.map((crumb, i) => (
                  <span key={`${crumb.label}-${i}`} className="kpi-hub-breadcrumb__item">
                    {i > 0 ? <span className="kpi-hub-breadcrumb__sep">/</span> : null}
                    {crumb.href ? (
                      <Link href={crumb.href}>{crumb.label}</Link>
                    ) : (
                      <span>{crumb.label}</span>
                    )}
                  </span>
                ))}
              </nav>
            ) : null}
            <div className="kpi-hub-page-head">
              <div>
                <h1 className="kpi-hub-page-head__title">{title}</h1>
                {subtitle ? <p className="kpi-hub-page-head__subtitle">{subtitle}</p> : null}
              </div>
              {actions ? <div className="kpi-hub-page-head__actions">{actions}</div> : null}
            </div>
          </div>
          <div className="kpi-hub-header__right">
            <span className="kpi-hub-header__tenant">PTT</span>
          </div>
        </header>

        <main className="kpi-hub-content">{children}</main>
        {showFreshness ? <KpiHubFreshnessFooter /> : null}
      </div>
    </div>
  );
}
