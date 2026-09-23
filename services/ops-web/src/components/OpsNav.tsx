'use client';

import { canViewAdminSection } from '@/lib/admin/admin-nav';
import { GlobalSearchBar } from '@/components/search/GlobalSearchBar';
import { WinRbacBadge } from '@/components/win';
import { iconForHref, NavIcon, sectionIcon, sectionShortLabel } from '@/components/layout/nav-icons';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { StoredStaffUser } from '@/lib/auth';
import {
  getAccessToken,
  hasCap,
  canViewImageSop,
  updateStoredUser,
} from '@/lib/auth';
import { staffMe } from '@/lib/api';
import { fetchReviewQueueCount } from '@/lib/api';
import { StaffNotificationBell } from '@/components/staff/StaffNotificationBell';
import { StaffAvatarMenu } from '@/components/account/StaffAvatarMenu';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { canSeeCsdNav } from '@/lib/crm/csd-nav.util';
import { fetchCsdChatUnreadCount } from '@/lib/crm/csd-api';
import { getCpImageFlags } from '@/lib/crm/cp-image-sop-api';
import { nextActionFor } from '@/lib/crm/canopy-next-action';
import { winLeaveLiteEnabled, winPayslipPortalEnabled } from '@/lib/win/flags';
import {
  ensureActiveParentOpen,
  isActiveHref,
  itemContainsPath,
  nextOpenIdsAfterToggle,
  readOpenIds,
  writeOpenIds,
} from '@/components/ops-nav-accordion';
import { buildNavTree } from '@/components/ops-nav-tree';
import type { NavItem } from '@/components/ops-nav-tree.types';

interface OpsNavProps {
  user: StoredStaffUser | null;
  onLogout: () => void;
  emailPendingApprovals?: number;
  agencyUnread?: number;
}

const SIDEBAR_STORAGE_KEY = 'ops-sidebar-expanded';

function readSidebarExpanded(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === '1';
}

function applyShellClasses(expanded: boolean) {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('ops-shell-expanded', expanded);
  document.documentElement.classList.toggle('ops-shell-collapsed', !expanded);
}

const PAGE_TITLES: Record<string, string> = {
  '/': 'Bảng điều khiển',
  '/crm': 'Bảng CSKH',
  '/crm/cskh-board': 'Bảng CSKH SLA',
  '/crm/tickets': 'Ticket CS',
  '/crm/csd': 'Service Desk',
  '/crm/csd/tickets': 'Ticket SD',
  '/crm/csd/chat': 'Chat SD',
  '/crm/csd/email': 'Email SD',
  '/crm/csd/reports': 'Báo cáo SD',
  '/crm/csd/reports/templates': 'Mẫu báo cáo',
  '/crm/account-management': 'Account Management',
  '/crm/revenue-ops': 'Revenue Operations',
  '/crm/internal-reports': 'BC công việc',
  '/crm/internal-reports/inbox': 'Hộp thư BC',
  '/crm/internal-reports/dashboards': 'Dashboard BC',
  '/crm/internal-reports/schedules': 'Lịch BC',
  '/crm/internal-reports/lists': 'DS phân phối BC',
  '/crm/internal-reports/team': 'Cây kỳ',
  '/crm/internal-reports/templates': 'Mẫu BC nội bộ',
  '/crm/internal-reports/builder': 'Report builder BC',
  '/crm/leads': 'Quản lý Lead',
  '/crm/operational/leads': 'Lead CSKH vận hành',
  '/crm/b2b/leads': 'Lead B2B Sales',
  '/crm/leads/new': 'Tạo lead thủ công',
  '/crm/operational/leads/new': 'Tạo lead CSKH vận hành',
  '/crm/b2b/leads/new': 'Tạo lead B2B',
  '/crm/gdkd-enterprise': 'KPI GDKD Enterprise',
  '/crm/catalog': 'CRM Catalog',
  '/crm/customers': 'Khách hàng',
  '/crm/intake': 'Lead Intake',
  '/crm/research': 'Nghiên cứu thị trường',
  '/crm/research/new': 'Tạo dự án nghiên cứu',
  '/crm/research/analytics': 'Phân tích nghiên cứu',
  '/crm/research/taxonomy': 'Taxonomy',
  '/crm/gtm/demos': 'Demo PTTCRM',
  '/crm/gtm/cms': 'CMS marketing',
  '/crm/marketing-plan': 'Kế hoạch marketing',
  '/crm/service-delivery': 'Triển khai dịch vụ',
  '/crm/sop': 'Quy trình SOP',
  '/crm/launch-qa': 'Launch QA',
  '/crm/creatives': 'Creative Hub',
  '/crm/creative-os': 'Sản xuất sáng tạo',
  '/crm/creative-os/image': 'Image SOP',
  '/crm/content-os': 'Content Marketing OS',
  '/crm/media-os': 'Media OS',
  '/crm/campaign-writes': 'Campaign Write',
  '/crm/sales': 'Kinh doanh',
  '/crm/kpi': 'KPI',
  '/crm/kpi/groups': 'Nhóm KPI',
  '/crm/kpi/groups/new': 'Thêm Nhóm KPI',
  '/crm/kpi/types': 'KPI Type',
  '/crm/kpi/types/new': 'Thêm KPI Type',
  '/crm/kpi-hub': 'KPI Hub',
  '/crm/kpi-hub/dictionary': 'KPI Dictionary',
  '/crm/kpi-hub/targets': 'Target & Cảnh báo',
  '/crm/kpi-hub/sources': 'Nguồn dữ liệu',
  '/crm/kpi-hub/quality': 'Data Quality',
  '/crm/kpi-hub/reports': 'Báo cáo KPI Hub',
  '/crm/kpi-hub/settings': 'Cài đặt KPI Hub',
  '/crm/kpi-hub/service-kpi': 'Service KPI War Room',
  '/crm/kpi-hub/service-templates': 'Service KPI Template',
  '/crm/kpi-hub/instances': 'KPI Instances',
  '/crm/kpi-hub/measurement': 'Measurement Plan',
  '/crm/kpi-hub/tracking': 'Actual Tracking',
  '/crm/kpi-hub/kpi-contracts': 'KPI Contract & Risk',
  '/crm/kpi-hub/reconcile': 'Quoted vs Actual',
  '/crm/kpi-hub/policy-packs': 'Policy Pack',
  '/crm/kpi-hub/performance': 'Operating Dashboard',
  '/crm/kpi-hub/performance/assignments': 'Assignment Registry',
  '/crm/kpi-hub/performance/scorecards': 'Scorecard Builder',
  '/crm/kpi-hub/performance/check-ins': 'Check-in Ritual',
  '/crm/kpi-hub/performance/campaigns': 'Campaign Control',
  '/crm/kpi-hub/performance/crm-source': 'CRM Source Map',
  '/crm/ai/insights': 'AI Insights',
  '/crm/ai/coach': 'Manager Coach',
  '/crm/ai/query': 'NL Analytics',
  '/crm/automation': 'Workflow automation',
  '/crm/playbooks': 'Playbook library',
  '/crm/admin/mkt-ai/playbooks': 'Playbook DV',
  '/crm/admin/lead-sla-settings': 'Lead SLA',
  '/crm/gdkd/lead-ops': 'Lead Ops GĐKD',
  '/crm/sales/lead-sla': 'Lead Ops GĐKD',
  '/crm/hr': 'HR Hub',
  '/crm/staff-kpi': 'KPI AM/SP',
  '/crm/staff': 'Nhân viên',
  '/crm/proposals': 'Báo giá',
  '/crm/orders': 'Đơn hàng',
  '/crm/invoices': 'Hóa đơn',
  '/crm/re-projects': 'Dự án BĐS',
  '/crm/delivery-projects': 'Dự án PTT',
  '/crm/b2b-inbox': 'Inbox B2B',
  '/crm/payroll': 'Chấm công & lương',
  '/crm/payroll/me': 'Phiếu lương của tôi',
  '/crm/hr/leave': 'Nghỉ phép lite',
  '/crm/business-dashboard': 'Dashboard kinh doanh',
  '/crm/forecast': 'Forecast doanh thu',
  '/crm/health': 'CS Health score',
  '/crm/owner-weekly': 'Báo cáo tuần chủ DN',
  '/crm/financials': 'Tài chính',
  '/admin': 'Quản trị hệ thống',
  '/admin/crm/custom-fields': 'Custom fields',
  '/admin/crm/pipeline': 'Pipeline sales',
  '/admin/crm/lead-lookups': 'Nguồn & Kênh',
  '/admin/crm/csd/chat-accounts': 'Tài khoản Chat',
  '/admin/crm/permissions': 'Ma trận chức vụ',
  '/admin/crm/permissions/functions': 'Job function',
  '/admin/crm/permissions/functions/catalog': 'Catalog job function',
  '/admin/crm/permissions/users': 'Gán user',
  '/admin/crm/permissions/simulator': 'Simulator',
  '/admin/crm/permissions/fields': 'Field ABAC',
  '/admin/crm/permission-sets': 'Permission Sets',
  '/admin/crm/sso/groups': 'SSO groups',
  '/admin/crm/org/users': 'Người dùng',
  '/admin/crm/org/users/new': 'Onboard NV',
  '/admin/crm/org/departments': 'Phòng ban',
  '/admin/crm/org/teams': 'Team',
  '/admin/crm/org/positions': 'Chức vụ',
  '/admin/crm/org/chart': 'Sơ đồ tổ chức',
  '/admin/ai/agents': 'AI Agents',
  '/admin/ai/runs': 'AI agent runs',
  '/admin/ai/tools': 'AI Tools',
  '/agency': 'Agency',
  '/agency/ingest': 'Pipeline ingest',
  '/agency/jobs': 'Pipeline ingest',
  '/agency/notifications': 'Thông báo Agency',
  '/agency/kpi-definitions': 'Định nghĩa KPI',
  '/meta/facebook-ads': 'Meta Ads',
  '/meta/ads-ops': 'Meta Ads Ops',
  '/meta/tracking': 'Meta Tracking',
  '/meta/intelligence': 'Meta Intelligence',
  '/google/google-ads': 'Google Ads',
  '/zalo/zalo-ads': 'Zalo Ads',
  '/zalo/leads': 'Zalo Leads',
  '/meta/ads-combined': 'Ads CPL',
  '/meta/migration': 'Meta Migration',
  '/crm/hub': 'Hub · Hợp đồng',
  '/seo/hub': 'SEO/AEO Hub',
  '/seo/clients': 'SEO Clients',
  '/seo/research': 'SEO Research',
  '/seo/content': 'SEO Content Pipeline',
  '/seo/technical': 'SEO Technical',
  '/seo/reports': 'SEO Reports',
  '/seo/governance': 'SEO Governance',
  '/seo/strategy': 'SEO Strategy',
  '/seo/aeo': 'AEO Console',
  '/seo/authority': 'Authority Console',
  '/seo/ranks': 'Rank Tracker',
  '/seo/automations': 'SEO Automations',
  '/seo/freshness': 'Freshness Queue',
  '/seo/experiments': 'SEO Experiments',
  '/seo/bi': 'SEO BI & Grafana',
  '/seo/cms': 'CMS Publish Pilot',
  '/seo/gate-a': 'SEO Gate A Go-live',
  '/email/hub': 'Email Hub',
  '/email/clients': 'Email Clients',
  '/email/contacts': 'Contacts',
  '/email/consent': 'Consent',
  '/email/suppression': 'Suppression',
  '/email/governance': 'Governance',
  '/email/segments': 'Segments',
  '/email/templates': 'Templates',
  '/email/campaigns': 'Campaigns',
  '/email/journeys': 'Journeys',
  '/email/deliverability': 'Deliverability',
  '/email/reports': 'Reports',
  '/email/gate-a': 'Email Gate A',
  '/account': 'Tài khoản',
};

function pageTitleFor(pathname: string): string {
  if (pathname === '/crm/leads/new') return PAGE_TITLES['/crm/leads/new'];
  if (pathname === '/crm/operational/leads/new') return PAGE_TITLES['/crm/operational/leads/new'];
  if (pathname === '/crm/b2b/leads/new') return PAGE_TITLES['/crm/b2b/leads/new'];
  if (pathname.startsWith('/crm/operational/leads')) return PAGE_TITLES['/crm/operational/leads'];
  if (pathname.startsWith('/crm/b2b/leads')) return PAGE_TITLES['/crm/b2b/leads'];
  if (pathname.startsWith('/crm/leads/') && pathname !== '/crm/leads') return 'Chi tiết lead';
  if (pathname.startsWith('/crm/customers/') && pathname !== '/crm/customers') return 'Chi tiết khách hàng';
  if (
    pathname.startsWith('/crm/research/') &&
    pathname !== '/crm/research' &&
    pathname !== '/crm/research/new' &&
    pathname !== '/crm/research/analytics' &&
    pathname !== '/crm/research/taxonomy'
  ) {
    return 'Workspace nghiên cứu';
  }
  if (pathname.startsWith('/crm/marketing-plan/') && pathname !== '/crm/marketing-plan') {
    return 'Chi tiết kế hoạch';
  }
  if (pathname.startsWith('/crm/service-delivery/') && pathname !== '/crm/service-delivery') {
    return 'Service lifecycle';
  }
  if (pathname.startsWith('/crm/creative-os/image')) return PAGE_TITLES['/crm/creative-os/image'];
  if (pathname.startsWith('/crm/account-management')) return PAGE_TITLES['/crm/account-management'];
  if (pathname.startsWith('/crm/revenue-ops')) return PAGE_TITLES['/crm/revenue-ops'];
  if (pathname.startsWith('/crm/staff/') && pathname !== '/crm/staff') return 'Workspace nhân viên';
  if (pathname.startsWith('/crm/re-projects/') && pathname !== '/crm/re-projects') return 'Chi tiết dự án BĐS';
  if (pathname.startsWith('/crm/b2b-projects/') && pathname !== '/crm/b2b-projects') return 'Chi tiết dự án PTT';
  if (pathname.startsWith('/agency/clients/')) return 'Chi tiết client';
  if (pathname.startsWith('/email/templates/') && pathname !== '/email/templates') return 'Template editor';
  if (pathname.startsWith('/email/campaigns/') && pathname.endsWith('/review')) return 'Campaign review';
  if (pathname.startsWith('/email/campaigns/') && pathname !== '/email/campaigns') return 'Campaign detail';
  if (pathname.startsWith('/email/journeys/') && pathname !== '/email/journeys') return 'Journey canvas';
  if (pathname.startsWith('/email/clients/') && pathname !== '/email/clients') return 'Client workspace';
  if (pathname.startsWith('/seo/content/') && pathname !== '/seo/content') return 'Content detail';
  return PAGE_TITLES[pathname] ?? 'PTT CRM';
}

function userInitials(user: StoredStaffUser | null): string {
  const name = user?.display_name?.trim() || user?.email?.trim() || '?';
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function OpsNav({ user, onLogout, emailPendingApprovals, agencyUnread }: OpsNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [navUser, setNavUser] = useState<StoredStaffUser | null>(user);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [reviewQueueCount, setReviewQueueCount] = useState<number | undefined>();
  const [csdChatUnread, setCsdChatUnread] = useState<number | undefined>();
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [flyoutId, setFlyoutId] = useState<string | null>(null);
  const [isMobileNav, setIsMobileNav] = useState(false);
  const [openIds, setOpenIds] = useState<string[]>([]);
  const [navReady, setNavReady] = useState(false);
  const [imageSopEnabled, setImageSopEnabled] = useState(false);
  const chromeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setNavUser(user);
  }, [user]);

  // Re-fetch caps whenever the logged-in staff id changes (CEO → AE switch).
  useEffect(() => {
    const token = getAccessToken();
    const expectedId = user?.id;
    if (!token || !expectedId) return;
    let cancelled = false;
    void staffMe(token)
      .then((me) => {
        if (cancelled) return;
        // Drop stale responses from a previous account.
        if (me.id !== expectedId) return;
        setNavUser(me);
        updateStoredUser(me);
      })
      .catch(() => {
        /* keep prop user — never keep another account's navUser */
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // Browser back/forward cache can restore a CEO React tree after AE login.
  useEffect(() => {
    function onPageShow(ev: PageTransitionEvent) {
      if (!ev.persisted) return;
      const token = getAccessToken();
      if (!token) return;
      void staffMe(token)
        .then((me) => {
          setNavUser(me);
          updateStoredUser(me);
        })
        .catch(() => {
          /* ignore */
        });
    }
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, []);

  useEffect(() => {
    setAccessToken(getAccessToken());
  }, [user, pathname, navUser]);

  // Prefer parent user when navUser is still from a previous staff id.
  const sidebarUser =
    user?.id && navUser?.id && user.id !== navUser.id ? user : navUser ?? user;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 960px)');
    const apply = () => setIsMobileNav(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    const expanded = readSidebarExpanded();
    setSidebarExpanded(expanded);
    applyShellClasses(expanded);
  }, []);

  useEffect(() => {
    setFlyoutId(null);
  }, [pathname]);

  useEffect(() => {
    if (!user || !hasCap(user, 'crm_leads', 'assign')) return;
    const token = getAccessToken();
    if (!token) return;
    void fetchReviewQueueCount(token)
      .then((out) => setReviewQueueCount(out.count))
      .catch(() => setReviewQueueCount(undefined));
  }, [user, pathname]);

  useEffect(() => {
    if (!sidebarUser || !canSeeCsdNav(sidebarUser)) return;
    const token = getAccessToken();
    if (!token) return;
    void fetchCsdChatUnreadCount(token)
      .then((out) => setCsdChatUnread(out.count))
      .catch(() => setCsdChatUnread(undefined));
  }, [sidebarUser, pathname]);

  useEffect(() => {
    if (!sidebarUser || !canViewImageSop(sidebarUser)) {
      setImageSopEnabled(false);
      return;
    }
    const token = getAccessToken();
    if (!token) return;
    void getCpImageFlags(token)
      .then((flags) => setImageSopEnabled(flags.enabled))
      .catch(() => setImageSopEnabled(false));
  }, [sidebarUser]);

  const items = useMemo(
    () =>
      buildNavTree(sidebarUser, {
        emailPendingApprovals,
        agencyUnread,
        reviewQueueCount,
        csdChatUnread,
        imageSopEnabled,
      }),
    [sidebarUser, emailPendingApprovals, agencyUnread, reviewQueueCount, csdChatUnread, imageSopEnabled],
  );
  const nextAction = nextActionFor(pathname);

  useEffect(() => {
    if (navReady) return;
    const stored = readOpenIds();
    const base = stored ?? [];
    setOpenIds(ensureActiveParentOpen(base, items, pathname));
    setNavReady(true);
    // Init once from storage + active route; badge-driven `items` changes must not re-open parents.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional one-shot hydrate
  }, [navReady]);

  useEffect(() => {
    if (!navReady) return;
    setOpenIds((prev) => {
      const next = ensureActiveParentOpen(prev, items, pathname);
      if (next.length === prev.length && next.every((id, i) => id === prev[i])) return prev;
      writeOpenIds(next);
      return next;
    });
  }, [pathname, navReady]);

  useLayoutEffect(() => {
    const el = chromeRef.current;
    if (!el) return;
    const apply = () => {
      document.documentElement.style.setProperty('--ops-chrome-h', `${el.offsetHeight}px`);
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => {
      ro.disconnect();
      document.documentElement.style.removeProperty('--ops-chrome-h');
    };
  }, [nextAction]);

  const showExpandedNav = sidebarExpanded || isMobileNav;

  function toggleSidebar() {
    setSidebarExpanded((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? '1' : '0');
      }
      applyShellClasses(next);
      if (!next) setFlyoutId(null);
      return next;
    });
  }

  function navigateTo(href: string) {
    setFlyoutId(null);
    if (!isActiveHref(pathname, href)) {
      router.push(href);
    }
  }

  function toggleParent(id: string) {
    setOpenIds((prev) => {
      const next = nextOpenIdsAfterToggle({
        openIds: prev,
        toggledId: id,
        items,
        pathname,
      });
      writeOpenIds(next);
      return next;
    });
  }

  const drawerItem: NavItem | null = flyoutId
    ? items.find((item) => item.id === flyoutId) ?? null
    : null;

  function renderBadge(badge?: number) {
    if (!badge || badge <= 0) return null;
    return <span className="ops-nav-badge">{badge > 99 ? '99+' : badge}</span>;
  }

  return (
    <>
      <aside
        className={`ops-sidebar${showExpandedNav ? ' ops-sidebar--expanded' : ' ops-sidebar--rail'}`}
        aria-label="Điều hướng chính"
      >
        <div className="ops-sidebar-brand">
          <button
            type="button"
            className="ops-sidebar-burger"
            onClick={toggleSidebar}
            aria-label={sidebarExpanded ? 'Thu gọn menu' : 'Mở rộng menu'}
          >
            <i /><i /><i />
          </button>
          <span className="ops-sidebar-brand-mark">
            <BrandLogo size={32} />
          </span>
          <div className="ops-sidebar-brand-text">
            <strong>PTT CRM</strong>
            <span>Theo việc, không theo module</span>
          </div>
        </div>
        <nav className={`ops-sidebar-nav${showExpandedNav ? ' is-expanded' : ' is-collapsed-rail'}`}>
          {showExpandedNav ? (
            items.map((item) => {
              if (item.kind === 'leaf') {
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`ops-nav-link ops-nav-link--button ops-nav-item--leaf${
                      isActiveHref(pathname, item.href) ? ' is-active' : ''
                    }`}
                    onClick={() => navigateTo(item.href)}
                  >
                    <span className="ops-nav-link-icon-wrap">
                      <span className="ops-nav-link-icon">
                        <NavIcon name={item.icon !== 'dot' ? item.icon : iconForHref(item.href)} />
                      </span>
                      {renderBadge(item.badge)}
                    </span>
                    <span>{item.label}</span>
                  </button>
                );
              }
              const open = navReady ? openIds.includes(item.id) : itemContainsPath(item, pathname);
              const active = itemContainsPath(item, pathname);
              return (
                <div
                  key={item.id}
                  className={`ops-nav-group${open ? ' is-open' : ''}${active ? ' has-active' : ''}`}
                >
                  <button
                    type="button"
                    className="ops-nav-group-header"
                    aria-expanded={open}
                    onClick={() => toggleParent(item.id)}
                  >
                    <span className="ops-nav-group-icon">
                      <NavIcon name={item.icon || sectionIcon(item.label)} />
                    </span>
                    <span className="ops-nav-group-label">{sectionShortLabel(item.label)}</span>
                    <span className="ops-nav-group-toggle" aria-hidden="true">
                      ▾
                    </span>
                  </button>
                  <div className="ops-nav-group-panel">
                    <div className="ops-nav-group-panel-inner">
                      <div className="ops-nav-group-links">
                        {item.children.map((child) => (
                          <button
                            key={child.href}
                            type="button"
                            className={`ops-nav-link ops-nav-link--child ops-nav-link--button${
                              isActiveHref(pathname, child.href) ? ' is-active' : ''
                            }`}
                            onClick={() => navigateTo(child.href)}
                          >
                            <span className="ops-nav-link-icon-wrap">
                              <NavIcon name={iconForHref(child.href.split('?')[0] || child.href)} />
                              {renderBadge(child.badge)}
                            </span>
                            <span>{child.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="ops-nav-rail">
              {items.map((item) => {
                const shortLabel = sectionShortLabel(item.label);
                const active = itemContainsPath(item, pathname);
                const open = flyoutId === item.id;
                return (
                  <div
                    key={item.id}
                    className={`ops-nav-rail-item${active ? ' is-active' : ''}${open ? ' is-open' : ''}`}
                  >
                    <button
                      type="button"
                      className="ops-nav-rail-btn"
                      title={shortLabel}
                      aria-label={shortLabel}
                      aria-expanded={item.kind === 'parent' ? open : undefined}
                      onClick={() => {
                        if (item.kind === 'leaf') {
                          navigateTo(item.href);
                          return;
                        }
                        setFlyoutId((prev) => (prev === item.id ? null : item.id));
                      }}
                    >
                      <NavIcon name={item.icon || sectionIcon(item.label)} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </nav>
        <div className="ops-sidebar-footer">
          {sidebarExpanded && canViewAdminSection(user) ? (
            <button
              type="button"
              className={`ops-nav-link ops-nav-link--text ops-nav-link--button${
                isActiveHref(pathname, '/admin') ? ' is-active' : ''
              }`}
              onClick={() => navigateTo('/admin')}
            >
              <span className="ops-nav-link-icon">
                <NavIcon name="settings" />
              </span>
              <span>Cài đặt</span>
            </button>
          ) : null}
          <button
            type="button"
            className="ops-sidebar-toggle"
            onClick={toggleSidebar}
            aria-label={sidebarExpanded ? 'Thu gọn menu' : 'Mở rộng menu'}
            title={sidebarExpanded ? 'Thu gọn menu' : 'Mở rộng menu'}
          >
            {sidebarExpanded ? '«' : '»'}
          </button>
        </div>
      </aside>

      {!showExpandedNav && drawerItem && drawerItem.kind === 'parent' ? (
        <>
          <button
            type="button"
            className="ops-nav-drawer-backdrop"
            aria-label="Đóng menu"
            onClick={() => setFlyoutId(null)}
          />
          <nav className="ops-nav-drawer" aria-label={sectionShortLabel(drawerItem.label)}>
            <div className="ops-nav-drawer-head">
              <strong>{sectionShortLabel(drawerItem.label)}</strong>
              <button type="button" className="ops-nav-drawer-close" onClick={() => setFlyoutId(null)}>
                ×
              </button>
            </div>
            <div className="ops-nav-drawer-links">
              {drawerItem.children.map((link) => (
                <button
                  key={link.href}
                  type="button"
                  className={`ops-nav-drawer-link${isActiveHref(pathname, link.href) ? ' is-active' : ''}`}
                  onClick={() => navigateTo(link.href)}
                >
                  <span className="ops-nav-drawer-link-icon">
                    <NavIcon name={iconForHref(link.href.split('?')[0] || link.href)} />
                  </span>
                  <span>{link.label}</span>
                  {renderBadge(link.badge)}
                </button>
              ))}
            </div>
          </nav>
        </>
      ) : null}

      <div className="ops-chrome-head" ref={chromeRef}>
        <header className="ops-topbar">
          <div className="ops-topbar-strip" aria-hidden="true" />
          <div className="ops-topbar-inner">
            <div className="ops-topbar-app">
              <button
                type="button"
                className="ops-sidebar-toggle ops-sidebar-toggle--topbar"
                onClick={toggleSidebar}
                aria-label={sidebarExpanded ? 'Thu gọn menu' : 'Mở rộng menu'}
              >
                ☰
              </button>
              <span className="ops-topbar-app-name">PTT CRM</span>
            </div>
            <GlobalSearchBar />
            <div className="ops-topbar-user">
              {user && (winPayslipPortalEnabled() || winLeaveLiteEnabled()) ? (
                <StaffNotificationBell />
              ) : null}
              <div className="ops-topbar-user-meta">
                <WinRbacBadge user={sidebarUser} />
                <WinRbacBadge user={sidebarUser} className="win-badge-rbac--mobile" />
                <span>{pageTitleFor(pathname)}</span>
              </div>
              <StaffAvatarMenu
                user={sidebarUser}
                token={accessToken}
                initials={userInitials(sidebarUser)}
                onLogout={onLogout}
              />
            </div>
          </div>
        </header>
        {nextAction ? (
          <p className="canopy-next-action" role="status">
            {nextAction}
          </p>
        ) : null}
      </div>
    </>
  );
}
