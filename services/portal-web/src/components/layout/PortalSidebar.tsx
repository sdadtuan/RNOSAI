'use client';

import { useEffect, useMemo, useState } from 'react';
import type { PortalSettingsResponse } from '@/lib/api';
import {
  buildPortalNavSections,
  portalNavIsActive,
  portalSectionHasActive,
} from '@/lib/portal/nav';
import { useNavTransition } from '@/lib/portal/nav-transition';
import type { StoredUser } from '@/lib/auth';
import { PortalNavIcon, portalSectionIcon } from './portal-nav-icons';

const SIDEBAR_STORAGE_KEY = 'portal-sidebar-expanded';

function readSidebarExpanded(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === '1';
}

function applyShellClasses(expanded: boolean) {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('portal-shell-expanded', expanded);
  document.documentElement.classList.toggle('portal-shell-collapsed', !expanded);
}

export type PortalSidebarProps = {
  user: StoredUser | null;
  pendingCount?: number;
  notificationUnread?: number;
  emailPending?: number;
  seoPending?: number;
  branding?: PortalSettingsResponse | null;
  seoEnabled?: boolean;
  emailEnabled?: boolean;
  adsChannelIds?: string[];
  openLeads?: number;
  openMessages?: number;
  onToggleSidebar?: () => void;
  sidebarExpanded?: boolean;
};

export function PortalSidebar({
  user,
  pendingCount = 0,
  notificationUnread = 0,
  emailPending = 0,
  seoPending = 0,
  branding,
  seoEnabled = false,
  emailEnabled = false,
  adsChannelIds = [],
  openLeads = 0,
  openMessages = 0,
  onToggleSidebar,
  sidebarExpanded: controlledExpanded,
}: PortalSidebarProps) {
  const { startNavigation, prefetchAll, displayPath } = useNavTransition();
  const [internalExpanded, setInternalExpanded] = useState(false);
  const [isMobileNav, setIsMobileNav] = useState(false);

  const sidebarExpanded = controlledExpanded ?? internalExpanded;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 768px)');
    const apply = () => setIsMobileNav(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    if (controlledExpanded !== undefined) return;
    const expanded = readSidebarExpanded();
    setInternalExpanded(expanded);
    applyShellClasses(expanded);
  }, [controlledExpanded]);

  const sections = buildPortalNavSections({
    user,
    pendingCount,
    notificationUnread,
    emailPending,
    seoPending,
    seoEnabled,
    emailEnabled,
    adsChannelIds,
    openLeads,
    openMessages,
  });

  const menuHrefKey = sections.map((section) => section.links.map((link) => link.href).join(',')).join('|');
  const menuHrefs = useMemo(
    () => menuHrefKey.split('|').flatMap((group) => (group ? group.split(',') : [])).filter(Boolean),
    [menuHrefKey],
  );

  useEffect(() => {
    const id = window.setTimeout(() => prefetchAll(menuHrefs), 350);
    return () => window.clearTimeout(id);
  }, [prefetchAll, menuHrefs]);

  const showExpandedNav = sidebarExpanded || isMobileNav;
  const displayName = branding?.display_name ?? branding?.client_name ?? 'Cổng khách hàng';

  function toggleSidebar() {
    if (onToggleSidebar) {
      onToggleSidebar();
      return;
    }
    setInternalExpanded((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? '1' : '0');
      }
      applyShellClasses(next);
      return next;
    });
  }

  function sectionHomeHref(section: { links: Array<{ href: string }> }): string | null {
    return section.links[0]?.href ?? null;
  }

  function navigateTo(href: string) {
    if (isMobileNav && sidebarExpanded) {
      if (onToggleSidebar) {
        onToggleSidebar();
      } else {
        setInternalExpanded(false);
        applyShellClasses(false);
      }
    }
    if (!portalNavIsActive(displayPath, href)) {
      startNavigation(href);
    }
  }

  return (
    <>
      {isMobileNav && sidebarExpanded ? (
        <button
          type="button"
          className="portal-nav-drawer-backdrop"
          aria-label="Đóng menu"
          onClick={toggleSidebar}
        />
      ) : null}
      <aside
        className={`portal-sidebar${showExpandedNav ? ' portal-sidebar--expanded' : ' portal-sidebar--rail'}`}
        aria-label="Điều hướng chính"
      >
        <div className="portal-sidebar-brand">
          {branding?.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={branding.logo_url} alt="" className="portal-sidebar-brand-logo" />
          ) : (
            <span className="portal-sidebar-brand-mark">PTT</span>
          )}
          <div className="portal-sidebar-brand-text">
            <strong>{displayName}</strong>
            <span>Cổng khách hàng</span>
          </div>
        </div>

        <nav className={`portal-sidebar-nav${showExpandedNav ? ' is-expanded' : ' is-collapsed-rail'}`}>
          {showExpandedNav ? (
            sections.map((section) => {
              const only = section.links.length === 1 ? section.links[0] : null;
              if (only) {
                return (
                  <div key={section.id} className={`portal-nav-group is-open${portalNavIsActive(displayPath, only.href) ? ' has-active' : ''}`}>
                    <button
                      type="button"
                      className={`portal-nav-link portal-nav-link--button portal-nav-group-header${portalNavIsActive(displayPath, only.href) ? ' is-active' : ''}`}
                      onClick={() => navigateTo(only.href)}
                    >
                      <span className="portal-nav-group-icon">
                        <PortalNavIcon name={portalSectionIcon(section)} />
                      </span>
                      <span className="portal-nav-group-label">{section.shortLabel}</span>
                      {only.badge && only.badge > 0 ? (
                        <span className="portal-nav-alert">{only.badge > 99 ? '99+' : only.badge}</span>
                      ) : null}
                    </button>
                  </div>
                );
              }
              return (
              <div
                key={section.id}
                className={`portal-nav-group is-open${portalSectionHasActive(displayPath, section) ? ' has-active' : ''}`}
              >
                <div className="portal-nav-group-header portal-nav-group-header--static">
                  <span className="portal-nav-group-icon">
                    <PortalNavIcon name={portalSectionIcon(section)} />
                  </span>
                  <span className="portal-nav-group-label">{section.shortLabel}</span>
                </div>
                <div className="portal-nav-group-links">
                  {section.links.map((link) => (
                    <button
                      key={link.href}
                      type="button"
                      className={`portal-nav-link portal-nav-link--button${portalNavIsActive(displayPath, link.href) ? ' is-active' : ''}`}
                      onClick={() => navigateTo(link.href)}
                    >
                      {link.label}
                      {link.badge && link.badge > 0 ? (
                        <span className="portal-nav-alert">{link.badge > 99 ? '99+' : link.badge}</span>
                      ) : null}
                    </button>
                  ))}
                </div>
              </div>
              );
            })
          ) : (
            <div className="portal-nav-rail">
              {sections.map((section) => {
                const active = portalSectionHasActive(displayPath, section);
                const href = sectionHomeHref(section);
                return (
                  <div
                    key={section.id}
                    className={`portal-nav-rail-item${active ? ' is-active' : ''}`}
                  >
                    <button
                      type="button"
                      className="portal-nav-rail-btn"
                      aria-label={section.label}
                      onClick={() => { if (href) navigateTo(href); }}
                    >
                      <PortalNavIcon name={portalSectionIcon(section)} />
                    </button>
                    <span className="portal-nav-rail-tip" aria-hidden="true">{section.shortLabel}</span>
                  </div>
                );
              })}
            </div>
          )}
        </nav>

        <div className="portal-sidebar-footer">
          <button
            type="button"
            className="portal-sidebar-toggle"
            onClick={toggleSidebar}
            aria-label={sidebarExpanded ? 'Thu gọn menu' : 'Mở rộng menu'}
            title={sidebarExpanded ? 'Thu gọn menu' : 'Mở rộng menu'}
          >
            {sidebarExpanded ? '«' : '»'}
          </button>
        </div>
      </aside>

    </>
  );
}

export { readSidebarExpanded, applyShellClasses, SIDEBAR_STORAGE_KEY };
