import type { ReactNode } from 'react';
import type { PortalNavSection } from '@/lib/portal/nav';

type IconName =
  | 'overview'
  | 'channels'
  | 'workflow'
  | 'seo'
  | 'email'
  | 'settings'
  | 'meta'
  | 'google'
  | 'zalo'
  | 'creatives'
  | 'notifications'
  | 'dashboard'
  | 'inbox'
  | 'lead'
  | 'customers'
  | 'products'
  | 'orders'
  | 'sales'
  | 'shipping'
  | 'research'
  | 'delivery'
  | 'generic';

const PATH_ICON: Record<string, IconName> = {
  '/dashboard': 'dashboard',
  '/meta': 'meta',
  '/google': 'google',
  '/zalo': 'zalo',
  '/creatives': 'creatives',
  '/notifications': 'notifications',
  '/settings': 'settings',
  '/products': 'products',
  '/crm': 'dashboard',
  '/crm/leads': 'lead',
  '/crm/messages': 'inbox',
  '/crm/customers': 'customers',
  '/crm/orders': 'orders',
  '/crm/sales': 'sales',
  '/crm/shipping': 'shipping',
  '/seo': 'seo',
  '/seo/reports': 'seo',
  '/seo/content': 'seo',
  '/email': 'email',
  '/email/approvals': 'email',
  '/research': 'research',
  '/service-delivery': 'delivery',
};

const SECTION_ICON: Record<string, IconName> = {
  overview: 'overview',
  channels: 'channels',
  workflow: 'workflow',
  lead: 'lead',
  message: 'inbox',
  customers: 'customers',
  seo: 'seo',
  email: 'email',
  settings: 'settings',
  products: 'products',
  orders: 'orders',
  sales: 'sales',
  shipping: 'shipping',
  account: 'settings',
  research: 'research',
  'service-delivery': 'delivery',
};

function Svg({ children }: { children: ReactNode }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {children}
    </svg>
  );
}

export function PortalNavIcon({ name }: { name: IconName }) {
  switch (name) {
    case 'overview':
    case 'dashboard':
      return (
        <Svg>
          <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        </Svg>
      );
    case 'channels':
      return (
        <Svg>
          <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" />
          <path d="M3 10h18" stroke="currentColor" strokeWidth="1.6" />
        </Svg>
      );
    case 'workflow':
    case 'creatives':
      return (
        <Svg>
          <path d="M5 7h14M5 12h10M5 17h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </Svg>
      );
    case 'notifications':
      return (
        <Svg>
          <path d="M12 4a4 4 0 0 1 4 4v3l2 2v1H6v-1l2-2V8a4 4 0 0 1 4-4Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M10 19a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </Svg>
      );
    case 'seo':
      return (
        <Svg>
          <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="1.6" />
          <path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </Svg>
      );
    case 'email':
      return (
        <Svg>
          <rect x="3" y="6" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="1.6" />
          <path d="m3 8 9 6 9-6" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        </Svg>
      );
    case 'settings':
      return (
        <Svg>
          <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
          <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </Svg>
      );
    case 'meta':
      return (
        <Svg>
          <path d="M12 3c4 2.5 7 6 7 9s-3 6.5-7 9c-4-2.5-7-6.5-7-9s3-6.5 7-9Z" stroke="currentColor" strokeWidth="1.6" />
        </Svg>
      );
    case 'google':
      return (
        <Svg>
          <path d="M12 4v8l6 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.6" />
        </Svg>
      );
    case 'zalo':
      return (
        <Svg>
          <path d="M6 6h12v12H6z" stroke="currentColor" strokeWidth="1.6" />
          <path d="M9 10h6M9 14h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </Svg>
      );

    case 'inbox':
      return (
        <Svg>
          <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7A2.5 2.5 0 0 1 17.5 16H8l-4 3.5V6.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M8 9h8M8 12h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </Svg>
      );
    case 'lead':
      return (
        <Svg>
          <circle cx="12" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.6" />
          <path d="M6 19c.8-3 3.2-4.5 6-4.5S17.2 16 18 19" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M18.5 8.5v4M16.5 10.5h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </Svg>
      );
    case 'customers':
      return (
        <Svg>
          <circle cx="9" cy="8.5" r="2.7" stroke="currentColor" strokeWidth="1.6" />
          <path d="M4.5 18c.7-2.6 2.7-4 4.5-4s3.8 1.4 4.5 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="16.5" cy="9.5" r="2.2" stroke="currentColor" strokeWidth="1.6" />
          <path d="M15 18c.5-1.8 1.8-2.8 3.2-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </Svg>
      );
    case 'products':
      return (
        <Svg>
          <path d="M4 8.5 12 4l8 4.5v9L12 22l-8-4.5v-9Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M12 13V22M4 8.5 12 13l8-4.5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        </Svg>
      );
    case 'orders':
      return (
        <Svg>
          <path d="M7 4.5h10a1.5 1.5 0 0 1 1.5 1.5v14l-3-1.5-3 1.5-3-1.5-3 1.5V6A1.5 1.5 0 0 1 7 4.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M9 9h6M9 13h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </Svg>
      );
    case 'sales':
      return (
        <Svg>
          <path d="M4 19h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <rect x="6" y="11" width="3" height="6" rx="0.8" stroke="currentColor" strokeWidth="1.6" />
          <rect x="10.5" y="7" width="3" height="10" rx="0.8" stroke="currentColor" strokeWidth="1.6" />
          <rect x="15" y="9" width="3" height="8" rx="0.8" stroke="currentColor" strokeWidth="1.6" />
        </Svg>
      );
    case 'shipping':
      return (
        <Svg>
          <path d="M3 15.5V8h11v7.5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M14 11h4.5L21 14.5V16.5h-2" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <circle cx="7.5" cy="17.5" r="2" stroke="currentColor" strokeWidth="1.6" />
          <circle cx="16.5" cy="17.5" r="2" stroke="currentColor" strokeWidth="1.6" />
          <path d="M9.5 17.5h5" stroke="currentColor" strokeWidth="1.6" />
        </Svg>
      );
    case 'research':
      return (
        <Svg>
          <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="1.6" />
          <path d="m16 16 4 4M9 11h4M11 9v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </Svg>
      );
    case 'delivery':
      return (
        <Svg>
          <path d="M5 19V6.5A1.5 1.5 0 0 1 6.5 5H13l6 6v8H5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M13 5v6h6" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        </Svg>
      );

    default:
      return (
        <Svg>
          <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.6" />
        </Svg>
      );
  }
}

export function portalSectionIcon(section: PortalNavSection): IconName {
  return SECTION_ICON[section.id] ?? 'generic';
}

export function portalLinkIcon(href: string): IconName {
  return PATH_ICON[href] ?? 'generic';
}
