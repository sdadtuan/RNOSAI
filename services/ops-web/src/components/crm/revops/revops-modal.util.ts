import type { CrmStaffRow, LeadRow } from '@/lib/api';

export const REVOPS_DEAL_STAGES = [
  { value: 'dang_tu_van', label: 'Discovery' },
  { value: 'bao_gia', label: 'Qualified' },
  { value: 'proposal', label: 'Proposal Submitted' },
  { value: 'dam_phan', label: 'Negotiation' },
] as const;

export function parseVndInput(raw: string): number | null {
  const digits = raw.replace(/[^\d]/g, '');
  if (!digits) return null;
  const n = Number(digits);
  return Number.isFinite(n) ? n : null;
}

export function formatVndInput(n: number | null | undefined): string {
  if (n == null) return '';
  return new Intl.NumberFormat('vi-VN').format(n);
}

/** W1 round-robin: rotate staff list by lead id, prefer lead receivers. */
export function suggestAssignees(staff: CrmStaffRow[], leadId: number, limit = 3): CrmStaffRow[] {
  const pool = staff.filter((s) => s.active !== 0 && s.can_receive_leads !== false);
  if (pool.length === 0) return [];
  const start = leadId > 0 ? leadId % pool.length : 0;
  const rotated = [...pool.slice(start), ...pool.slice(0, start)];
  return rotated.slice(0, limit);
}

export function leadOptionLabel(lead: LeadRow): string {
  const bits = [lead.full_name, lead.phone, lead.email].filter(Boolean);
  return `#${lead.id} — ${bits.join(' · ')}`;
}
