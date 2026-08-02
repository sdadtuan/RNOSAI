'use client';

import { GlobalSearchBar } from '@/components/search/GlobalSearchBar';
import { iconForHref, NavIcon, sectionIcon, sectionShortLabel } from '@/components/layout/nav-icons';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { StoredStaffUser } from '@/lib/auth';
import { getAccessToken, hasCap } from '@/lib/auth';
import { fetchReviewQueueCount } from '@/lib/api';
import { emailGateAEnabled, emailJourneysEnabled, emailModuleEnabled } from '@/lib/email-flags';
import { canViewEmailGateA } from '@/lib/email/caps';
import { canViewMetaAdsOps, canViewMetaIntelligence, canViewMetaTracking } from '@/lib/meta/caps';
import {
  canViewSeoAeo,
  canViewSeoAuthority,
  canViewSeoAutomations,
  canViewSeoContent,
  canViewSeoBi,
  canViewSeoCms,
  canViewSeoGateA,
  canViewSeoExperiments,
  canViewSeoFreshness,
  canViewSeoGovernance,
  canViewSeoHub,
  canViewSeoRanks,
  canViewSeoReports,
  canViewSeoResearch,
  canViewSeoStrategy,
  canViewSeoTechnical,
} from '@/lib/seo/caps';
import {
  seoAeoEnabled,
  seoAuthorityEnabled,
  seoAutomationsEnabled,
  seoBiEnabled,
  seoCmsEnabled,
  seoGateAEnabled,
  seoContentEnabled,
  seoExperimentsEnabled,
  seoFreshnessEnabled,
  seoGovernanceEnabled,
  seoHubEnabled,
  seoRanksEnabled,
  seoReportsEnabled,
  seoResearchEnabled,
  seoStrategyEnabled,
  seoTechnicalEnabled,
} from '@/lib/seo/flags';
import { metaAdsOpsEnabled, metaIntelligenceEnabled, metaTrackingEnabled } from '@/lib/meta/flags';

interface OpsNavProps {
  user: StoredStaffUser | null;
  onLogout: () => void;
  emailPendingApprovals?: number;
  agencyUnread?: number;
}

type NavLink = { href: string; label: string };
type NavSection = { label: string; links: NavLink[]; defaultOpen?: boolean };

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
const GROUPS_COLLAPSED_BY_DEFAULT = new Set<string>();

const PAGE_TITLES: Record<string, string> = {
  '/': 'Bảng điều khiển',
  '/crm': 'Bảng CSKH',
  '/crm/cskh-board': 'Bảng CSKH SLA',
  '/crm/tickets': 'Ticket CS',
  '/crm/leads': 'Quản lý Lead',
  '/crm/leads/new': 'Tạo lead thủ công',
  '/crm/catalog': 'CRM Catalog',
  '/crm/customers': 'Khách hàng',
  '/crm/intake': 'Lead Intake',
  '/crm/marketing-plan': 'Kế hoạch marketing',
  '/crm/service-delivery': 'Triển khai dịch vụ',
  '/crm/sop': 'Quy trình SOP',
  '/crm/launch-qa': 'Launch QA',
  '/crm/creatives': 'Creative Hub',
  '/crm/campaign-writes': 'Campaign Write',
  '/crm/sales': 'Kinh doanh',
  '/crm/kpi': 'KPI',
  '/crm/ai/insights': 'AI Insights',
  '/crm/ai/coach': 'Manager Coach',
  '/crm/ai/query': 'NL Analytics',
  '/crm/automation': 'Workflow automation',
  '/crm/playbooks': 'Playbook library',
  '/crm/staff-kpi': 'KPI AM/SP',
  '/crm/staff': 'Nhân viên',
  '/crm/proposals': 'Đề xuất dịch vụ',
  '/crm/orders': 'Đơn hàng',
  '/crm/invoices': 'Hóa đơn',
  '/crm/re-projects': 'Dự án BĐS',
  '/crm/payroll': 'Chấm công & lương',
  '/crm/business-dashboard': 'Dashboard kinh doanh',
  '/crm/forecast': 'Forecast doanh thu',
  '/crm/health': 'CS Health score',
  '/crm/owner-weekly': 'Báo cáo tuần chủ DN',
  '/crm/financials': 'Tài chính',
  '/admin/crm/custom-fields': 'Custom fields',
  '/admin/crm/pipeline': 'Pipeline sales',
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
};

function pageTitleFor(pathname: string): string {
  if (pathname === '/crm/leads/new') return PAGE_TITLES['/crm/leads/new'];
  if (pathname.startsWith('/crm/leads/') && pathname !== '/crm/leads') return 'Chi tiết lead';
  if (pathname.startsWith('/crm/customers/') && pathname !== '/crm/customers') return 'Chi tiết khách hàng';
  if (pathname.startsWith('/crm/marketing-plan/') && pathname !== '/crm/marketing-plan') {
    return 'Chi tiết kế hoạch';
  }
  if (pathname.startsWith('/crm/service-delivery/') && pathname !== '/crm/service-delivery') {
    return 'Service lifecycle';
  }
  if (pathname.startsWith('/crm/staff/') && pathname !== '/crm/staff') return 'Workspace nhân viên';
  if (pathname.startsWith('/crm/re-projects/') && pathname !== '/crm/re-projects') return 'Chi tiết dự án BĐS';
  if (pathname.startsWith('/agency/clients/')) return 'Chi tiết client';
  if (pathname.startsWith('/email/templates/') && pathname !== '/email/templates') return 'Template editor';
  if (pathname.startsWith('/email/campaigns/') && pathname.endsWith('/review')) return 'Campaign review';
  if (pathname.startsWith('/email/campaigns/') && pathname !== '/email/campaigns') return 'Campaign detail';
  if (pathname.startsWith('/email/journeys/') && pathname !== '/email/journeys') return 'Journey canvas';
  if (pathname.startsWith('/email/clients/') && pathname !== '/email/clients') return 'Client workspace';
  if (pathname.startsWith('/seo/content/') && pathname !== '/seo/content') return 'Content detail';
  return PAGE_TITLES[pathname] ?? 'PTT CRM';
}

function navBadge(count: number | undefined): string {
  if (!count || count <= 0) return '';
  return count > 99 ? ' (99+)' : ` (${count})`;
}

function isActive(pathname: string, href: string): boolean {
  return pathname === href || (href !== '/' && pathname.startsWith(`${href}/`));
}

function buildSeoLinks(user: StoredStaffUser | null): NavLink[] {
  if (!seoHubEnabled() || !canViewSeoHub(user)) return [];
  const links: NavLink[] = [
    { href: '/seo/hub', label: 'SEO/AEO Hub' },
    { href: '/seo/clients', label: 'SEO Clients' },
  ];
  if (seoResearchEnabled() && canViewSeoResearch(user)) links.push({ href: '/seo/research', label: 'SEO Research' });
  if (seoContentEnabled() && canViewSeoContent(user)) links.push({ href: '/seo/content', label: 'SEO Content' });
  if (seoTechnicalEnabled() && canViewSeoTechnical(user)) links.push({ href: '/seo/technical', label: 'SEO Technical' });
  if (seoReportsEnabled() && canViewSeoReports(user)) links.push({ href: '/seo/reports', label: 'SEO Reports' });
  if (seoStrategyEnabled() && canViewSeoStrategy(user)) links.push({ href: '/seo/strategy', label: 'SEO Strategy' });
  if (seoGovernanceEnabled() && canViewSeoGovernance(user)) links.push({ href: '/seo/governance', label: 'SEO Governance' });
  if (seoAeoEnabled() && canViewSeoAeo(user)) links.push({ href: '/seo/aeo', label: 'AEO Console' });
  if (seoAuthorityEnabled() && canViewSeoAuthority(user)) links.push({ href: '/seo/authority', label: 'Authority' });
  if (seoRanksEnabled() && canViewSeoRanks(user)) links.push({ href: '/seo/ranks', label: 'Rank Tracker' });
  if (seoAutomationsEnabled() && canViewSeoAutomations(user)) links.push({ href: '/seo/automations', label: 'Automations' });
  if (seoFreshnessEnabled() && canViewSeoFreshness(user)) links.push({ href: '/seo/freshness', label: 'Freshness' });
  if (seoExperimentsEnabled() && canViewSeoExperiments(user)) links.push({ href: '/seo/experiments', label: 'Experiments' });
  if (seoBiEnabled() && canViewSeoBi(user)) links.push({ href: '/seo/bi', label: 'SEO BI' });
  if (seoCmsEnabled() && canViewSeoCms(user)) links.push({ href: '/seo/cms', label: 'CMS Pilot' });
  if (seoGateAEnabled() && canViewSeoGateA(user)) links.push({ href: '/seo/gate-a', label: 'Gate A Go-live' });
  return links;
}

function buildSections(
  user: StoredStaffUser | null,
  emailPendingApprovals?: number,
  agencyUnread?: number,
  reviewQueueCount?: number,
): NavSection[] {
  const sections: NavSection[] = [];

  const overview: NavLink[] = [{ href: '/', label: 'Bảng điều khiển' }];
  if (hasCap(user, 'crm_board', 'view')) {
    overview.push({ href: '/crm', label: 'Bảng CSKH' });
  }
  if (overview.length) sections.push({ label: 'Tổng quan', links: overview, defaultOpen: true });

  const care: NavLink[] = [];
  if (hasCap(user, 'crm_leads', 'view')) {
    care.push({ href: '/crm/leads', label: 'Quản lý Lead' });
    care.push({ href: '/crm/cskh-board', label: 'Bảng CSKH SLA' });
    if (hasCap(user, 'crm_leads', 'assign')) {
      care.push({
        href: '/crm/leads/review-queue',
        label: `Phải tra soát (B2)${navBadge(reviewQueueCount)}`,
      });
    }
    care.push({ href: '/crm/catalog', label: 'Catalog' });
  }
  if (hasCap(user, 'crm_board', 'view')) {
    care.push({ href: '/crm/tickets', label: 'Ticket CS' });
  }
  if (hasCap(user, 'crm_board_customers', 'view')) {
    care.push({ href: '/crm/customers', label: 'Khách hàng' });
  }
  if (care.length) sections.push({ label: 'CRM · Lead & CSKH', links: care, defaultOpen: true });

  const salesContract: NavLink[] = [];
  if (hasCap(user, 'crm_agency', 'view')) {
    salesContract.push({ href: '/crm/hub', label: 'Hub · Hợp đồng' });
  }
  if (hasCap(user, 'crm_sales_overview', 'view') || hasCap(user, 'crm_sales_plans', 'view')) {
    salesContract.push({ href: '/crm/sales', label: 'Kinh doanh' });
  }
  if (hasCap(user, 'crm_board', 'view')) {
    salesContract.push({ href: '/crm/proposals', label: 'Đề xuất' });
    salesContract.push({ href: '/crm/orders', label: 'Đơn hàng' });
  }
  if (hasCap(user, 'crm_re_projects', 'view') || hasCap(user, 'crm_re_projects_products', 'view')) {
    salesContract.push({ href: '/crm/re-projects', label: 'Dự án BĐS' });
  }
  if (salesContract.length) {
    sections.push({ label: 'CRM · Bán hàng & Hợp đồng', links: salesContract, defaultOpen: true });
  }

  const delivery: NavLink[] = [];
  if (hasCap(user, 'crm_board', 'view')) {
    delivery.push({ href: '/crm/marketing-plan', label: 'Kế hoạch marketing' });
    delivery.push({ href: '/crm/service-delivery', label: 'Triển khai DV' });
    delivery.push({ href: '/crm/sop', label: 'Quy trình SOP' });
    delivery.push({ href: '/crm/launch-qa', label: 'Launch QA' });
    delivery.push({ href: '/crm/creatives', label: 'Creative Hub' });
    delivery.push({ href: '/crm/campaign-writes', label: 'Campaign Write' });
  }
  if (delivery.length) sections.push({ label: 'CRM · Triển khai dịch vụ', links: delivery, defaultOpen: true });

  const hr: NavLink[] = [];
  if (hasCap(user, 'crm_staff_roster', 'view')) {
    hr.push({ href: '/crm/staff', label: 'Nhân viên' });
  }
  if (hasCap(user, 'crm_kpi_records', 'view')) {
    hr.push({ href: '/crm/kpi', label: 'KPI' });
    hr.push({ href: '/crm/ai/insights', label: 'AI Insights' });
    hr.push({ href: '/crm/ai/coach', label: 'Coach digest' });
  } else if (hasCap(user, 'crm_business_dashboard', 'view')) {
    hr.push({ href: '/crm/ai/coach', label: 'Coach digest' });
  }
  if (hasCap(user, 'crm_staff_kpi_am_sp', 'view')) {
    hr.push({ href: '/crm/staff-kpi', label: 'KPI AM/SP' });
  }
  if (
    hasCap(user, 'crm_payroll_salary', 'view') ||
    hasCap(user, 'crm_payroll_attendance', 'view') ||
    hasCap(user, 'crm_staff_roster', 'view')
  ) {
    hr.push({ href: '/crm/payroll', label: 'Chấm công & lương' });
  }
  if (hr.length) sections.push({ label: 'CRM · Nhân sự & KPI', links: hr, defaultOpen: true });

  const finance: NavLink[] = [];
  if (hasCap(user, 'crm_business_dashboard', 'view')) {
    finance.push({ href: '/crm/business-dashboard', label: 'Dashboard KD' });
    finance.push({ href: '/crm/forecast', label: 'Forecast' });
    finance.push({ href: '/crm/financials', label: 'Tài chính' });
    finance.push({ href: '/crm/invoices', label: 'Hóa đơn' });
    finance.push({ href: '/crm/ai/query', label: 'NL Analytics' });
  } else if (hasCap(user, 'ai_analytics', 'query')) {
    finance.push({ href: '/crm/ai/query', label: 'NL Analytics' });
  }
  if (hasCap(user, 'crm_agency', 'view') || hasCap(user, 'crm_board', 'view') || hasCap(user, 'ai_admin', 'view')) {
    finance.push({ href: '/crm/health', label: 'CS Health' });
  }
  if (hasCap(user, 'crm_owner_weekly_dashboard', 'view')) {
    finance.push({ href: '/crm/owner-weekly', label: 'BC tuần chủ DN' });
  }
  if (finance.length) sections.push({ label: 'Quản trị & Tài chính', links: finance, defaultOpen: true });

  const agencyClient: NavLink[] = [];
  if (hasCap(user, 'crm_agency', 'view')) {
    agencyClient.push({ href: '/agency', label: 'Agency' });
    agencyClient.push({ href: '/agency/ingest', label: 'Ingest' });
    agencyClient.push({
      href: '/agency/notifications',
      label: `Thông báo${navBadge(agencyUnread)}`,
    });
    agencyClient.push({ href: '/agency/kpi-definitions', label: 'KPI definitions' });
  }
  if (agencyClient.length) sections.push({ label: 'Agency & Client', links: agencyClient, defaultOpen: true });

  const ads: NavLink[] = [];
  if (hasCap(user, 'crm_facebook_ads', 'view') || hasCap(user, 'crm_agency', 'view')) {
    ads.push({ href: '/meta/facebook-ads', label: 'Meta Ads' });
    if (metaAdsOpsEnabled() && canViewMetaAdsOps(user)) {
      ads.push({ href: '/meta/ads-ops', label: 'Meta Ads Ops' });
    }
    if (metaTrackingEnabled() && canViewMetaTracking(user)) {
      ads.push({ href: '/meta/tracking', label: 'Meta Tracking' });
    }
    if (metaIntelligenceEnabled() && canViewMetaIntelligence(user)) {
      ads.push({ href: '/meta/intelligence', label: 'Meta Intelligence' });
    }
    ads.push({ href: '/meta/migration', label: 'Meta Migration' });
  }
  if (hasCap(user, 'crm_google_ads', 'view') || hasCap(user, 'crm_agency', 'view')) {
    ads.push({ href: '/google/google-ads', label: 'Google Ads' });
    ads.push({ href: '/meta/ads-combined', label: 'Ads CPL' });
  }
  if (hasCap(user, 'crm_zalo_ads', 'view') || hasCap(user, 'crm_agency', 'view')) {
    ads.push({ href: '/zalo/zalo-ads', label: 'Zalo Ads' });
    ads.push({ href: '/zalo/leads', label: 'Zalo Leads' });
  }
  if (ads.length) sections.push({ label: 'Kênh quảng cáo', links: ads });

  const seoLinks = buildSeoLinks(user);
  if (seoLinks.length) sections.push({ label: 'SEO / AEO', links: seoLinks });

  const emailView = hasCap(user, 'crm_email_mkt', 'view') || hasCap(user, 'crm_agency', 'view');
  const emailWrite = hasCap(user, 'crm_email_mkt', 'write') || hasCap(user, 'crm_agency', 'create');
  const emailDeliverability =
    hasCap(user, 'crm_email_mkt', 'deliverability') ||
    hasCap(user, 'crm_email_mkt', 'settings') ||
    hasCap(user, 'crm_agency', 'create');
  const emailReports =
    hasCap(user, 'crm_email_mkt', 'reports') ||
    hasCap(user, 'crm_email_mkt', 'write') ||
    hasCap(user, 'crm_agency', 'view');

  if (emailView && emailModuleEnabled()) {
    const email: NavLink[] = [
      { href: '/email/hub', label: `Email Hub${navBadge(emailPendingApprovals)}` },
      { href: '/email/clients', label: 'Email Clients' },
      { href: '/email/contacts', label: 'Contacts' },
      { href: '/email/consent', label: 'Consent' },
      { href: '/email/suppression', label: 'Suppression' },
      { href: '/email/governance', label: 'Governance' },
    ];
    if (emailWrite) {
      email.push({ href: '/email/segments', label: 'Segments' });
      email.push({ href: '/email/templates', label: 'Templates' });
      email.push({ href: '/email/campaigns', label: `Campaigns${navBadge(emailPendingApprovals)}` });
    }
    if (emailJourneysEnabled() && emailWrite) {
      email.push({ href: '/email/journeys', label: 'Journeys' });
    }
    if (emailDeliverability) {
      email.push({ href: '/email/deliverability', label: 'Deliverability' });
    }
    if (emailReports) {
      email.push({ href: '/email/reports', label: 'Reports' });
    }
    if (emailGateAEnabled() && canViewEmailGateA(user)) {
      email.push({ href: '/email/gate-a', label: 'Gate A Prod pilot' });
    }
    sections.push({ label: 'Email Marketing', links: email });
  }

  const aiAutomation: NavLink[] = [];
  if (hasCap(user, 'automation_workflows', 'view')) {
    aiAutomation.push({ href: '/crm/automation', label: 'Workflows' });
  }
  if (hasCap(user, 'playbooks', 'view')) {
    aiAutomation.push({ href: '/crm/playbooks', label: 'Playbooks' });
  }
  if (hasCap(user, 'ai_admin', 'view')) {
    aiAutomation.push({ href: '/admin/ai/agents', label: 'AI Agents' });
    aiAutomation.push({ href: '/admin/ai/runs', label: 'AI agent runs' });
    aiAutomation.push({ href: '/admin/ai/tools', label: 'Tools' });
  }
  if (aiAutomation.length) sections.push({ label: 'AI & Automation', links: aiAutomation });

  const config: NavLink[] = [];
  if (hasCap(user, 'crm_data_config', 'view')) {
    config.push({ href: '/admin/crm/custom-fields', label: 'Custom fields' });
    config.push({ href: '/admin/crm/pipeline', label: 'Pipeline sales' });
  }
  if (config.length) sections.push({ label: 'Cấu hình CRM', links: config });

  return sections;
}

function sectionHasActive(pathname: string, section: NavSection): boolean {
  return section.links.some((link) => isActive(pathname, link.href));
}

function userInitials(user: StoredStaffUser | null): string {
  const name = user?.display_name?.trim() || user?.email?.trim() || '?';
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function OpsNav({ user, onLogout, emailPendingApprovals, agencyUnread }: OpsNavProps) {
  const pathname = usePathname();
  const [reviewQueueCount, setReviewQueueCount] = useState<number | undefined>();
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [flyoutSection, setFlyoutSection] = useState<string | null>(null);
  const [isMobileNav, setIsMobileNav] = useState(false);
  const sidebarRef = useRef<HTMLElement | null>(null);

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
    setFlyoutSection(null);
  }, [pathname]);

  useEffect(() => {
    if (!flyoutSection) return;
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node | null;
      if (sidebarRef.current?.contains(target)) return;
      setFlyoutSection(null);
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [flyoutSection]);

  useEffect(() => {
    if (!user || !hasCap(user, 'crm_leads', 'assign')) return;
    const token = getAccessToken();
    if (!token) return;
    void fetchReviewQueueCount(token)
      .then((out) => setReviewQueueCount(out.count))
      .catch(() => setReviewQueueCount(undefined));
  }, [user, pathname]);

  const sections = buildSections(user, emailPendingApprovals, agencyUnread, reviewQueueCount);

  useEffect(() => {
    setOpenGroups((prev) => {
      const next = { ...prev };
      for (const section of sections) {
        if (next[section.label] == null) {
          next[section.label] = section.defaultOpen ?? !GROUPS_COLLAPSED_BY_DEFAULT.has(section.label);
        }
        if (sectionHasActive(pathname, section)) {
          next[section.label] = true;
        }
      }
      return next;
    });
  }, [pathname, sections]);

  const showExpandedNav = sidebarExpanded || isMobileNav;

  function toggleSidebar() {
    setSidebarExpanded((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? '1' : '0');
      }
      applyShellClasses(next);
      if (!next) setFlyoutSection(null);
      return next;
    });
  }

  function toggleGroup(label: string) {
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  }

  return (
    <>
      <aside
        ref={sidebarRef}
        className={`ops-sidebar${showExpandedNav ? ' ops-sidebar--expanded' : ' ops-sidebar--rail'}`}
        aria-label="Điều hướng chính"
      >
        <div className="ops-sidebar-brand">
          <span className="ops-sidebar-brand-mark">PTT</span>
          <div className="ops-sidebar-brand-text">
            <strong>PTT CRM</strong>
            <span>Staff console</span>
          </div>
        </div>
        <nav className={`ops-sidebar-nav${showExpandedNav ? ' is-expanded' : ' is-collapsed-rail'}`}>
          {showExpandedNav ? (
            sections.map((section) => {
              const groupOpen = openGroups[section.label] ?? true;
              const shortLabel = sectionShortLabel(section.label);
              return (
                <div
                  key={section.label}
                  className={`ops-nav-group${groupOpen ? ' is-open' : ''}${sectionHasActive(pathname, section) ? ' has-active' : ''}`}
                >
                  <button
                    type="button"
                    className="ops-nav-group-header"
                    onClick={() => toggleGroup(section.label)}
                    aria-expanded={groupOpen}
                  >
                    <span className="ops-nav-group-icon">
                      <NavIcon name={sectionIcon(section.label)} />
                    </span>
                    <span className="ops-nav-group-label">{shortLabel}</span>
                    <span className="ops-nav-group-toggle" aria-hidden="true">
                      ›
                    </span>
                  </button>
                  <div className={`ops-nav-group-links${groupOpen ? '' : ' is-collapsed'}`}>
                    {section.links.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        className={`ops-nav-link ops-nav-link--text${isActive(pathname, link.href) ? ' is-active' : ''}`}
                      >
                        {link.label}
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="ops-nav-rail">
              {sections.map((section) => {
                const shortLabel = sectionShortLabel(section.label);
                const active = sectionHasActive(pathname, section);
                const open = flyoutSection === section.label;
                return (
                  <div
                    key={section.label}
                    className={`ops-nav-rail-item${active ? ' is-active' : ''}${open ? ' is-open' : ''}`}
                  >
                    <button
                      type="button"
                      className="ops-nav-rail-btn"
                      title={shortLabel}
                      aria-label={shortLabel}
                      aria-expanded={open}
                      onClick={() => setFlyoutSection((prev) => (prev === section.label ? null : section.label))}
                    >
                      <NavIcon name={sectionIcon(section.label)} />
                    </button>
                    {open ? (
                      <div className="ops-nav-flyout" role="menu">
                        <p className="ops-nav-flyout-title">{shortLabel}</p>
                        {section.links.map((link) => (
                          <Link
                            key={link.href}
                            href={link.href}
                            role="menuitem"
                            className={`ops-nav-flyout-link${isActive(pathname, link.href) ? ' is-active' : ''}`}
                          >
                            <span className="ops-nav-flyout-link-icon">
                              <NavIcon name={iconForHref(link.href)} />
                            </span>
                            <span>{link.label}</span>
                          </Link>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </nav>
        <div className="ops-sidebar-footer">
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
            <div className="ops-topbar-user-meta">
              <strong>{user?.display_name ?? user?.email ?? 'Staff'}</strong>
              <span>{pageTitleFor(pathname)}</span>
            </div>
            <span className="ops-topbar-avatar" aria-hidden="true">
              {userInitials(user)}
            </span>
            <button type="button" className="btn btn-sm btn-secondary btn-topbar-logout" onClick={onLogout}>
              Đăng xuất
            </button>
          </div>
        </div>
      </header>
    </>
  );
}
