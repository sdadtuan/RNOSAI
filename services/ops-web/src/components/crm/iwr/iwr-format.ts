import type { IwrRag } from '@/lib/crm/iwr-api';

export function iwrInitials(name: string | undefined | null): string {
  const parts = String(name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return 'NV';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function iwrAvatarTone(seed: string | number): string {
  const tones = [
    'bg-sky-100 text-sky-800',
    'bg-violet-100 text-violet-800',
    'bg-emerald-100 text-emerald-800',
    'bg-amber-100 text-amber-800',
    'bg-rose-100 text-rose-800',
    'bg-indigo-100 text-indigo-800',
  ];
  const n = typeof seed === 'number' ? seed : Array.from(seed).reduce((a, c) => a + c.charCodeAt(0), 0);
  return tones[Math.abs(n) % tones.length];
}

export function iwrRelativeVi(iso: string | null | undefined): string {
  if (!iso) return '—';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return iso;
  const diff = Date.now() - t;
  const min = Math.round(diff / 60_000);
  if (min < 1) return 'vừa xong';
  if (min < 60) return `${min} phút trước`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} giờ trước`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day} ngày trước`;
  return new Date(iso).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
}

export function iwrRagClass(rag: IwrRag): string {
  if (rag === 'green') return 'bg-emerald-100 text-emerald-800';
  if (rag === 'yellow') return 'bg-amber-100 text-amber-800';
  if (rag === 'red') return 'bg-red-100 text-red-700';
  return 'bg-slate-100 text-slate-600';
}

export function iwrRagLabel(rag: IwrRag): string {
  if (rag === 'green') return 'Xanh';
  if (rag === 'yellow') return 'Vàng';
  if (rag === 'red') return 'Đỏ';
  return 'Chưa RAG';
}

export function iwrIsoWeekLabel(d = new Date()): { label: string; start: string; end: string; week: number } {
  const vn = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
  const day = vn.getDay() || 7;
  const monday = new Date(vn);
  monday.setDate(vn.getDate() - day + 1);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 5);
  const jan4 = new Date(vn.getFullYear(), 0, 4);
  const week = Math.ceil(((monday.getTime() - new Date(jan4.getFullYear(), 0, 1).getTime()) / 86400000 + 1) / 7);
  const fmt = (x: Date) =>
    `${String(x.getDate()).padStart(2, '0')}/${String(x.getMonth() + 1).padStart(2, '0')}`;
  const ymd = (x: Date) =>
    `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  return {
    week,
    start: ymd(monday),
    end: ymd(sunday),
    label: `Tuần ${week} — ${fmt(monday)}–${fmt(sunday)}/${vn.getFullYear()}`,
  };
}

export function iwrRoleLabel(positionCode?: string, jobFunctions?: string[]): string {
  if (positionCode) return positionCode.replace(/_/g, ' ');
  if (jobFunctions?.[0]) return jobFunctions[0];
  return 'Nhân sự';
}
