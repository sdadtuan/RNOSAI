export const LEAD_STATUS_LABELS: Record<string, string> = {
  moi: 'Mới',
  da_lien_he: 'Đã liên hệ',
  dang_tu_van: 'Đang tư vấn',
  hen_gap: 'Hẹn gặp',
  bao_gia: 'Báo giá',
  dam_phan: 'Đàm phán',
  chot: 'Chốt',
  post_sale: 'Post-sale',
  won: 'Won (HĐ ký)',
  proposal: 'Proposal',
  lost: 'Lost',
  pending_cleanup: 'Chờ dọn',
  __other__: 'Khác',
};

/** Align with ptt-crm-api `lead-status-gate.util` — funnel stage keys ≠ CRM kanban columns. */
const STATUS_ALIASES: Record<string, string> = {
  new: 'moi',
  contacted: 'da_lien_he',
  qualified: 'da_lien_he',
  first_contact: 'moi',
  intake: 'moi',
  qualify: 'da_lien_he',
  nurturing: 'dang_tu_van',
  negotiation: 'dam_phan',
};

export function normalizeLeadStatus(status: string | null | undefined): string {
  const raw = String(status ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
  if (!raw) return 'moi';
  return STATUS_ALIASES[raw] ?? raw;
}

export function leadStatusLabel(status: string | null | undefined): string {
  if (!status) return '—';
  const key = normalizeLeadStatus(status);
  return LEAD_STATUS_LABELS[key] ?? LEAD_STATUS_LABELS[status] ?? status.replace(/_/g, ' ');
}

export type LeadStatusTone = 'new' | 'active' | 'won' | 'lost' | 'neutral';

export function leadStatusTone(status: string | null | undefined): LeadStatusTone {
  if (!status) return 'neutral';
  const st = normalizeLeadStatus(status);
  if (st === 'moi') return 'new';
  if (st === 'chot' || st === 'post_sale' || st === 'won') return 'won';
  if (st === 'lost' || st === 'pending_cleanup') return 'lost';
  if (['da_lien_he', 'dang_tu_van', 'hen_gap', 'bao_gia', 'dam_phan', 'proposal'].includes(st)) return 'active';
  return 'neutral';
}

/** Bucket leads into kanban columns; unknown statuses land in `__other__`. */
export function bucketLeadsByKanbanStage<T extends { status?: string | null }>(
  rows: T[],
  stages: readonly string[],
): { stageKeys: string[]; byStage: Record<string, T[]> } {
  const byStage: Record<string, T[]> = {};
  for (const st of stages) byStage[st] = [];
  byStage.__other__ = [];

  for (const row of rows) {
    const st = normalizeLeadStatus(row.status);
    if (byStage[st]) byStage[st].push(row);
    else byStage.__other__.push(row);
  }

  const stageKeys = [...stages];
  if (byStage.__other__.length > 0) stageKeys.push('__other__');
  return { stageKeys, byStage };
}
