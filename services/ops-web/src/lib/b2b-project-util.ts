export type B2bProjectStatus = 'draft' | 'active' | 'paused' | 'archived';

export const B2B_PROJECT_STATUSES: B2bProjectStatus[] = ['draft', 'active', 'paused', 'archived'];

export const B2B_PROJECT_STATUS_LABELS: Record<B2bProjectStatus, string> = {
  draft: 'Nháp',
  active: 'Đang chạy',
  paused: 'Tạm dừng',
  archived: 'Lưu trữ',
};

export function labelB2bProjectStatus(status: string): string {
  return B2B_PROJECT_STATUS_LABELS[status as B2bProjectStatus] ?? status;
}

export function b2bProjectStatusBadgeClass(status: string): string {
  switch (status) {
    case 'active':
      return 'meta-badge meta-badge--ok';
    case 'paused':
      return 'meta-badge meta-badge--warn';
    case 'archived':
      return 'meta-badge';
    default:
      return 'meta-badge';
  }
}

export function normalizeProjectCode(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-_]/g, '');
}

export type SlaBand = { warnMin?: number; hopMin?: number };

export type B2bSlaForm = {
  hot: SlaBand;
  warm: SlaBand;
  cold: SlaBand;
  maxHops: number;
};

export function slaFromJson(raw: Record<string, unknown> | undefined): B2bSlaForm {
  const band = (key: string): SlaBand => {
    const v = raw?.[key];
    if (!v || typeof v !== 'object') return {};
    const o = v as Record<string, unknown>;
    return {
      warnMin: typeof o.warnMin === 'number' ? o.warnMin : Number(o.warnMin) || undefined,
      hopMin: typeof o.hopMin === 'number' ? o.hopMin : Number(o.hopMin) || undefined,
    };
  };
  return {
    hot: band('hot'),
    warm: band('warm'),
    cold: band('cold'),
    maxHops: typeof raw?.maxHops === 'number' ? raw.maxHops : Number(raw?.maxHops) || 2,
  };
}

export function slaToJson(form: B2bSlaForm): Record<string, unknown> {
  return {
    hot: { warnMin: form.hot.warnMin ?? 3, hopMin: form.hot.hopMin ?? 5 },
    warm: { warnMin: form.warm.warnMin ?? 10, hopMin: form.warm.hopMin ?? 15 },
    cold: { warnMin: form.cold.warnMin ?? 25, hopMin: form.cold.hopMin ?? 30 },
    maxHops: form.maxHops,
  };
}
