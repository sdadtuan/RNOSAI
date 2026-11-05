import type { RsMobileTabId } from '@/lib/crm/rs-mobile-shell';

type RsMobileIconProps = {
  id: RsMobileTabId | 'logout';
};

export function RsMobileIcon({ id }: RsMobileIconProps) {
  const common = {
    viewBox: '0 0 24 24',
    width: 22,
    height: 22,
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true as const,
  };
  if (id === 'leads') {
    return (
      <svg {...common}>
        <circle cx="9" cy="8" r="3" />
        <path d="M3.5 19c.6-3 2.8-4.5 5.5-4.5S14 16 14.5 19" />
        <circle cx="17" cy="9" r="2.2" />
        <path d="M16 14.5c2.2.3 3.8 1.6 4.5 4" />
      </svg>
    );
  }
  if (id === 'cskh') {
    return (
      <svg {...common}>
        <path d="M4 13a8 8 0 0 1 16 0" />
        <rect x="3" y="13" width="4" height="6" rx="1.2" />
        <rect x="17" y="13" width="4" height="6" rx="1.2" />
      </svg>
    );
  }
  if (id === 'chat') {
    return (
      <svg {...common}>
        <path d="M5 16.5 4 20l3.8-1.4A8 8 0 1 0 5 16.5Z" />
      </svg>
    );
  }
  if (id === 'tickets') {
    return (
      <svg {...common}>
        <path d="M7 4h10a2 2 0 0 1 2 2v14l-3-1.5L13 20l-3-1.5L7 20V6a2 2 0 0 1 0-2Z" />
        <path d="M9 9h6M9 13h6" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M10 7V5a2 2 0 0 1 2-2h7v18h-7a2 2 0 0 1-2-2v-2" />
      <path d="M4 12h10" />
      <path d="m11 8 4 4-4 4" />
    </svg>
  );
}
