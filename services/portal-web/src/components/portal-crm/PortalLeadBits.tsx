'use client';

/** Shared visual atoms for the Lead page (table, kanban, drawer). Display only. */
import { leadInitials, toneFor } from '@/lib/portal/portal-leads-pro.util';

export const LEAD_STATUS_LABEL: Record<string, string> = {
  waiting_receive: 'Chờ nhận',
  received: 'Đã nhận',
  caring: 'Đang chăm sóc',
  purchased: 'Mua hàng',
};

/* ---------- tiny inline icon set (no new deps) ---------- */
const ICONS: Record<string, string> = {
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm10 17-4.35-4.35',
  phone: 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z',
  chevron: 'm9 18 6-6-6-6',
  left: 'm15 18-6-6 6-6',
  filter: 'M3 5h18M6 12h12M10 19h4',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  board: 'M3 4h5v16H3zM10 4h5v10h-5zM17 4h4v13h-4z',
  chart: 'M3 3v18h18M8 17V9m5 8V5m5 12v-6',
  download: 'M12 3v12m0 0-4-4m4 4 4-4M4 21h16',
  x: 'M18 6 6 18M6 6l12 12',
  check: 'M20 6 9 17l-5-5',
  inbox: 'M22 12h-6l-2 3h-4l-2-3H2m3.5-7h13L22 12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6Z',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm13 10v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Zm0-14v4l3 2',
  user: 'M20 21a8 8 0 1 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z',
  spark: 'M12 3v4m0 10v4M3 12h4m10 0h4M5.6 5.6l2.8 2.8m7.2 7.2 2.8 2.8m0-12.8-2.8 2.8m-7.2 7.2-2.8 2.8',
  trend: 'm22 7-8.5 8.5-5-5L2 17M16 7h6v6',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  note: 'M4 4h16v12l-4 4H4zM16 20v-4h4M8 9h8M8 13h5',
  tag: 'M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8ZM7.5 7.5h.01',
  cart: 'M3 3h2l2.4 12.4a2 2 0 0 0 2 1.6h8.8a2 2 0 0 0 2-1.6L22 7H6M10 21h.01M18 21h.01',
  chat: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z',
  form: 'M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 3h6v4H9zM9 12h6M9 16h4',
  link: 'M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7',
  eye: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
};

export function PlIcon({ name, size = 16 }: { name: keyof typeof ICONS | string; size?: number }) {
  return (
    <svg className="pl-icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name] || ''} />
    </svg>
  );
}

export function PlAvatar({ name, seed, size = 'md' }: { name: string; seed?: string; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <span className={`pl-avatar pl-avatar--${size}`} style={{ background: toneFor(seed || name) }} aria-hidden="true">
      {leadInitials(name)}
    </span>
  );
}

export function PlStatus({ status }: { status: string }) {
  return <span className={`pl-pill pl-pill--${status}`}>{LEAD_STATUS_LABEL[status] || status}</span>;
}

