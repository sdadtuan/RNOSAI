/** Inline SVG icons for collapsed sidebar (Bitrix-style). */
export function NavIcon({ name }: { name: string }) {
  const common = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.75, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true as const };

  switch (name) {
    case 'home':
      return (
        <svg {...common}>
          <path d="M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-10.5z" />
        </svg>
      );
    case 'board':
      return (
        <svg {...common}>
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
      );
    case 'leads':
      return (
        <svg {...common}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case 'sales':
      return (
        <svg {...common}>
          <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
      );
    case 'delivery':
      return (
        <svg {...common}>
          <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
        </svg>
      );
    case 'staff':
      return (
        <svg {...common}>
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      );
    case 'finance':
      return (
        <svg {...common}>
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <path d="M2 10h20" />
        </svg>
      );
    case 'agency':
      return (
        <svg {...common}>
          <path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6" />
        </svg>
      );
    case 'ads':
      return (
        <svg {...common}>
          <path d="m3 11 18-5v12L3 13v-2z" />
          <path d="M11 13v8" />
        </svg>
      );
    case 'seo':
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
      );
    case 'email':
      return (
        <svg {...common}>
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
        </svg>
      );
    case 'ai':
      return (
        <svg {...common}>
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z" />
        </svg>
      );
    case 'settings':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="2" />
        </svg>
      );
  }
}

export const LINK_ICONS: Record<string, string> = {
  '/': 'home',
  '/crm': 'board',
  '/crm/leads': 'leads',
  '/crm/cskh-board': 'board',
  '/crm/leads/review-queue': 'leads',
  '/crm/tickets': 'leads',
  '/crm/customers': 'leads',
  '/crm/catalog': 'delivery',
  '/crm/hub': 'sales',
  '/crm/sales': 'sales',
  '/crm/proposals': 'sales',
  '/crm/orders': 'sales',
  '/crm/re-projects': 'sales',
  '/crm/marketing-plan': 'delivery',
  '/crm/service-delivery': 'delivery',
  '/crm/sop': 'delivery',
  '/crm/launch-qa': 'delivery',
  '/crm/creatives': 'delivery',
  '/crm/campaign-writes': 'delivery',
  '/crm/staff': 'staff',
  '/crm/kpi': 'staff',
  '/crm/staff-kpi': 'staff',
  '/crm/payroll': 'staff',
  '/crm/ai/insights': 'ai',
  '/crm/ai/coach': 'ai',
  '/crm/business-dashboard': 'finance',
  '/crm/forecast': 'finance',
  '/crm/financials': 'finance',
  '/crm/invoices': 'finance',
  '/crm/health': 'finance',
  '/crm/owner-weekly': 'finance',
  '/crm/ai/query': 'ai',
  '/agency': 'agency',
  '/agency/ingest': 'agency',
  '/agency/notifications': 'agency',
  '/agency/kpi-definitions': 'agency',
  '/meta/facebook-ads': 'ads',
  '/meta/ads-ops': 'ads',
  '/meta/tracking': 'ads',
  '/meta/intelligence': 'ads',
  '/meta/migration': 'ads',
  '/google/google-ads': 'ads',
  '/meta/ads-combined': 'ads',
  '/zalo/zalo-ads': 'ads',
  '/zalo/leads': 'ads',
  '/seo/hub': 'seo',
  '/email/hub': 'email',
  '/crm/automation': 'ai',
  '/crm/playbooks': 'ai',
  '/admin/crm/custom-fields': 'settings',
  '/admin/crm/pipeline': 'settings',
  '/admin/ai/agents': 'ai',
  '/admin/ai/runs': 'ai',
  '/admin/ai/tools': 'ai',
};

export const SECTION_ICONS: Record<string, string> = {
  'Tổng quan': 'home',
  'CRM · Lead & CSKH': 'leads',
  'CRM · Bán hàng & Hợp đồng': 'sales',
  'CRM · Triển khai dịch vụ': 'delivery',
  'CRM · Nhân sự & KPI': 'staff',
  'Quản trị & Tài chính': 'finance',
  'Agency & Client': 'agency',
  'Kênh quảng cáo': 'ads',
  'SEO / AEO': 'seo',
  'Email Marketing': 'email',
  'AI & Automation': 'ai',
  'Cấu hình CRM': 'settings',
};
