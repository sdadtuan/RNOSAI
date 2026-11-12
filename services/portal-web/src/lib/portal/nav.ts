import type { StoredUser } from '@/lib/auth';
import { isMarketResearchPortalFeEnabled } from '@/lib/market-research-portal-flags';
import { isOpsPortalSummaryFeEnabled } from '@/lib/ops-portal-flags';
import { isPortalCrmCareEnabled } from '@/lib/portal-crm-flags';

export type PortalNavLink = { href: string; label: string; badge?: number };

export type PortalNavSection = {
  id: string;
  label: string;
  shortLabel: string;
  links: PortalNavLink[];
};

export type PortalNavContext = {
  user: StoredUser | null;
  pendingCount?: number;
  notificationUnread?: number;
  emailPending?: number;
  seoPending?: number;
  seoEnabled?: boolean;
  emailEnabled?: boolean;
  adsChannelIds?: string[];
  openLeads?: number;
  openMessages?: number;
};

function badgeSuffix(count: number | undefined): string {
  if (!count || count <= 0) return '';
  return count > 99 ? ' (99+)' : ` (${count})`;
}

export function buildPortalNavSections(ctx: PortalNavContext): PortalNavSection[] {
  const {
    user,
    pendingCount = 0,
    notificationUnread = 0,
    emailPending = 0,
    seoPending = 0,
    seoEnabled = false,
    emailEnabled = false,
    adsChannelIds = [],
    openLeads = 0,
    openMessages = 0,
  } = ctx;

  const channelCatalog = [
    { id: 'meta', href: '/meta', label: 'Meta (Facebook / IG)' },
    { id: 'google', href: '/google', label: 'Google Ads' },
    { id: 'zalo', href: '/zalo', label: 'Zalo Ads' },
  ];
  const channelLinks = channelCatalog.filter((item) => adsChannelIds.includes(item.id));

  const sections: PortalNavSection[] = [
    {
      id: 'overview',
      label: 'Tổng quan',
      shortLabel: 'Home',
      links: [{ href: '/dashboard', label: 'Tổng quan' }],
    },
  ];

  if (isPortalCrmCareEnabled()) {
    sections.push(
      {
        id: 'lead',
        label: 'Lead',
        shortLabel: 'Lead',
        links: [{ href: '/crm/leads', label: 'Lead', badge: openLeads }],
      },
      {
        id: 'message',
        label: 'Tin nhắn',
        shortLabel: 'Tin nhắn',
        links: [{ href: '/crm/messages', label: 'Tin nhắn', badge: openMessages }],
      },
      {
        id: 'customers',
        label: 'Khách hàng',
        shortLabel: 'Khách hàng',
        links: [{ href: '/crm/customers', label: 'Khách hàng' }],
      },
      {
        id: 'products',
        label: 'Sản phẩm',
        shortLabel: 'Sản phẩm',
        links: [{ href: '/products', label: 'Sản phẩm' }],
      },
      {
        id: 'orders',
        label: 'Đơn hàng',
        shortLabel: 'Đơn hàng',
        links: [{ href: '/crm/orders', label: 'Đơn hàng' }],
      },
      {
        id: 'sales',
        label: 'Báo cáo bán hàng',
        shortLabel: 'Báo cáo',
        links: [{ href: '/crm/sales', label: 'Báo cáo bán hàng' }],
      },
      {
        id: 'shipping',
        label: 'Cài đặt vận chuyển',
        shortLabel: 'Vận chuyển',
        links: [{ href: '/crm/shipping', label: 'Cài đặt vận chuyển' }],
      },
    );
  }

  if (channelLinks.length > 0) {
    sections.push({
      id: 'channels',
      label: 'Kênh quảng cáo',
      shortLabel: 'Ads',
      links: channelLinks.map(({ href, label }) => ({ href, label })),
    });
  }
  sections.push({
    id: 'workflow',
    label: 'Duyệt',
    shortLabel: 'Duyệt',
    links: [
      {
        href: '/creatives',
        label: `Creative inbox${badgeSuffix(pendingCount)}`,
        badge: pendingCount,
      },
      {
        href: '/notifications',
        label: `Thông báo${badgeSuffix(notificationUnread)}`,
        badge: notificationUnread,
      },
    ],
  });

  if (seoEnabled) {
    sections.push({
      id: 'seo',
      label: 'SEO / AEO',
      shortLabel: 'SEO',
      links: [
        { href: '/seo', label: 'SEO' },
        { href: '/seo/reports', label: 'SEO reports' },
        {
          href: '/seo/content',
          label: `SEO review${badgeSuffix(seoPending)}`,
          badge: seoPending,
        },
      ],
    });
  }

  if (emailEnabled) {
    const emailLinks: PortalNavLink[] = [{ href: '/email', label: 'Email' }];
    if (user?.role === 'approver') {
      emailLinks.push({
        href: '/email/approvals',
        label: `Email approvals${badgeSuffix(emailPending)}`,
        badge: emailPending,
      });
    }
    sections.push({
      id: 'email',
      label: 'Email marketing',
      shortLabel: 'Email',
      links: emailLinks,
    });
  }

  if (isOpsPortalSummaryFeEnabled()) {
    sections.splice(1, 0, {
      id: 'service-delivery',
      label: 'Triển khai dịch vụ',
      shortLabel: 'DV',
      links: [{ href: '/service-delivery', label: 'Tiến độ & KPI' }],
    });
  }

  if (isMarketResearchPortalFeEnabled()) {
    sections.push({
      id: 'research',
      label: 'Nghiên cứu',
      shortLabel: 'NC',
      links: [{ href: '/research', label: 'Báo cáo nghiên cứu' }],
    });
  }

  sections.push({
    id: 'settings',
    label: 'Cài đặt',
    shortLabel: 'Cài đặt',
    links: [{ href: '/settings', label: 'Tài khoản & thông báo' }],
  });

  return sections;
}

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Tổng quan',
  '/crm': 'Tổng quan',
  '/crm/leads': 'Lead',
  '/crm/messages': 'Tin nhắn',
  '/crm/customers': 'Khách hàng',
  '/crm/customers/leads': 'Khách hàng',
  '/crm/customers/messages': 'Khách hàng',
  '/meta': 'Hiệu quả Meta',
  '/google': 'Hiệu quả Google',
  '/zalo': 'Hiệu quả Zalo',
  '/creatives': 'Creative inbox',
  '/notifications': 'Thông báo',
  '/settings': 'Cài đặt',
  '/products': 'Sản phẩm',
  '/crm/orders': 'Đơn hàng',
  '/crm/sales': 'Báo cáo bán hàng',
  '/crm/shipping': 'Cài đặt vận chuyển',
  '/seo': 'SEO / AEO',
  '/seo/reports': 'SEO Reports',
  '/seo/content': 'SEO Content review',
  '/email': 'Email',
  '/email/approvals': 'Email approvals',
  '/service-delivery': 'Triển khai dịch vụ',
  '/research': 'Báo cáo nghiên cứu',
};

type TitleListener = () => void;
const titleListeners = new Set<TitleListener>();
let titleOverride: string | null = null;

export function setPortalTitleOverride(title: string | null): void {
  titleOverride = title;
  titleListeners.forEach((fn) => fn());
}

export function subscribePortalTitle(listener: TitleListener): () => void {
  titleListeners.add(listener);
  return () => {
    titleListeners.delete(listener);
  };
}

export function currentPortalTitle(pathname: string): string {
  return titleOverride || portalPageTitle(pathname);
}

export function portalPageTitle(pathname: string): string {
  if (pathname === '/crm/orders/new') return 'Tạo đơn';
  if (pathname.startsWith('/crm/orders/') && pathname !== '/crm/orders') return 'Chi tiết đơn hàng';
  if (pathname.startsWith('/email/campaigns/')) return 'Campaign performance';
  if (pathname.startsWith('/seo/content/') && pathname !== '/seo/content') return 'SEO content detail';
  if (pathname.startsWith('/research/') && pathname !== '/research') return 'Báo cáo nghiên cứu';
  return PAGE_TITLES[pathname] ?? 'Client Portal';
}

export function portalNavIsActive(pathname: string, href: string): boolean {
  if (href === '/crm') return pathname === '/crm';
  if (href === '/dashboard') return pathname === '/dashboard' || pathname === '/crm';
  return pathname === href || (href !== '/dashboard' && pathname.startsWith(`${href}/`));
}

export function portalSectionHasActive(pathname: string, section: PortalNavSection): boolean {
  return section.links.some((link) => portalNavIsActive(pathname, link.href));
}
