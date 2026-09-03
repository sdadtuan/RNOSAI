const TZ = 'Asia/Ho_Chi_Minh';

function vnParts(d: Date): { y: number; m: number; day: number; hh: string; mm: string } {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const map = Object.fromEntries(fmt.formatToParts(d).map((p) => [p.type, p.value]));
  return { y: Number(map.year), m: Number(map.month), day: Number(map.day), hh: map.hour, mm: map.minute };
}

function dayKey(d: Date): string {
  const p = vnParts(d);
  return `${p.y}-${p.m}-${p.day}`;
}

function vnEpochDay(d: Date): number {
  const p = vnParts(d);
  return Date.UTC(p.y, p.m - 1, p.day) / 86_400_000;
}

export function initialsFromName(name: string | null | undefined, fallback = 'KH'): string {
  const parts = String(name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return fallback;
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function avatarHue(seed: string | number | null | undefined): number {
  const s = String(seed ?? 'KH');
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 360;
}

export function formatChatListTime(iso: string | null | undefined, now = new Date()): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const a = vnParts(d);
  if (vnEpochDay(now) === vnEpochDay(d)) return `${a.hh}:${a.mm}`;
  if (vnEpochDay(now) - vnEpochDay(d) === 1) return 'Hôm qua';
  return `${String(a.day).padStart(2, '0')}/${String(a.m).padStart(2, '0')}`;
}

export function formatDateChip(iso: string | null | undefined, now = new Date()): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const a = vnParts(d);
  const list = formatChatListTime(iso, now);
  if (list === 'Hôm qua') return 'Hôm qua';
  if (list.includes(':')) return 'Hôm nay';
  return `${String(a.day).padStart(2, '0')}/${String(a.m).padStart(2, '0')}/${a.y}`;
}

export function isCsdChatImageMime(mime: string | null | undefined): boolean {
  return String(mime ?? '')
    .trim()
    .toLowerCase()
    .startsWith('image/');
}

export type ChatFrameBox = { left: number; right: number; top: number; bottom: number };

export function shiftBoxIntoFrame(box: ChatFrameBox, frame: ChatFrameBox, pad = 8): { x: number; y: number } {
  let x = 0;
  let y = 0;
  const minX = frame.left + pad;
  const maxX = frame.right - pad;
  const minY = frame.top + pad;
  const maxY = frame.bottom - pad;
  if (box.left < minX) x += minX - box.left;
  if (box.right + x > maxX) x += maxX - (box.right + x);
  if (box.left + x < minX) x = minX - box.left;
  if (box.top < minY) y += minY - box.top;
  if (box.bottom + y > maxY) y += maxY - (box.bottom + y);
  if (box.top + y < minY) y = minY - box.top;
  return { x, y };
}

export function findChatFrame(el: HTMLElement | null): HTMLElement | null {
  if (!el) return null;
  const frame = el.closest('.csd-chat-messages') ?? el.closest('.csd-chat-workspace__thread');
  return frame instanceof HTMLElement ? frame : null;
}

export function clampElementInChatFrame(el: HTMLElement | null, pad = 8): void {
  if (!el) return;
  el.style.transform = '';
  if (el.getBoundingClientRect().width < 2) return;
  const frame = findChatFrame(el);
  if (!frame) return;
  const { x, y } = shiftBoxIntoFrame(el.getBoundingClientRect(), frame.getBoundingClientRect(), pad);
  el.style.transform = x || y ? `translate(${Math.round(x)}px, ${Math.round(y)}px)` : '';
}

export function shouldShowDateChip(prevIso: string | null | undefined, currIso: string): boolean {
  if (!prevIso) return true;
  const a = new Date(prevIso);
  const b = new Date(currIso);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return true;
  return dayKey(a) !== dayKey(b);
}

export type CsdMessagePeerDisplay = {
  name: string;
  seed: string | number;
  staffId: number | null;
  hasAvatar: boolean;
  avatarUpdatedAt: string | null;
};

type ResolvePeerContext = {
  active: { id: string; kind: string; name_vi: string } | null;
  members: Array<{ member_staff_id: number; display_name_vi?: string | null }>;
};

export function resolveCsdMessagePeer(
  message: {
    author_staff_id: number | null;
    author_staff_name?: string | null;
    author_has_avatar?: boolean;
    author_avatar_updated_at?: string | null;
  },
  ctx: ResolvePeerContext,
): CsdMessagePeerDisplay {
  const authorId = message.author_staff_id;
  const member =
    authorId != null ? ctx.members.find((m) => m.member_staff_id === authorId) : undefined;
  const authorName = String(message.author_staff_name ?? '').trim();
  const avatarMeta = {
    hasAvatar: Boolean(message.author_has_avatar),
    avatarUpdatedAt: message.author_avatar_updated_at ?? null,
  };

  if (authorName) {
    return {
      name: authorName,
      seed: authorId ?? ctx.active?.id ?? 'KH',
      staffId: authorId,
      ...avatarMeta,
    };
  }

  if (ctx.active && (ctx.active.kind === 'direct' || ctx.active.kind === 'client')) {
    return {
      name: ctx.active.name_vi,
      seed: ctx.active.id,
      staffId: authorId,
      ...avatarMeta,
    };
  }

  const memberName = String(member?.display_name_vi ?? '').trim();
  if (memberName) {
    return {
      name: memberName,
      seed: authorId ?? member?.member_staff_id ?? 'KH',
      staffId: authorId,
      ...avatarMeta,
    };
  }

  if (authorId != null) {
    return {
      name: `Staff #${authorId}`,
      seed: authorId,
      staffId: authorId,
      ...avatarMeta,
    };
  }

  return {
    name: ctx.active?.name_vi ?? 'Khách',
    seed: ctx.active?.id ?? 'KH',
    staffId: null,
    hasAvatar: false,
    avatarUpdatedAt: null,
  };
}
