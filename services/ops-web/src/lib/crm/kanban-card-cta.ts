import type { LeadRow } from '@/lib/api';

export type KanbanCardCta = {
  href: string;
  label: string;
  kind: 'call' | 'intake' | 'lead' | 'hub';
};

const EARLY = new Set(['moi', 'da_lien_he', 'new']);
const CONSULT = new Set(['dang_tu_van', 'hen_gap']);
const QUOTE = new Set(['bao_gia', 'proposal', 'dam_phan']);
const WON = new Set(['won', 'chot']);

function digitsPhone(phone: string | undefined): string {
  return String(phone ?? '').replace(/[^\d+]/g, '');
}

export function kanbanCardCta(
  lead: Pick<LeadRow, 'id' | 'phone' | 'status' | 'ai_band' | 'sla_state'>,
): KanbanCardCta {
  const status = String(lead.status ?? 'moi');
  const phone = digitsPhone(lead.phone);
  const urgent =
    lead.ai_band === 'hot' || lead.sla_state === 'warning' || lead.sla_state === 'breach';

  if (EARLY.has(status) && phone && urgent) {
    return { href: `tel:${phone}`, label: 'Gọi', kind: 'call' };
  }
  if (CONSULT.has(status)) {
    return { href: `/crm/intake?lead_id=${lead.id}`, label: 'Intake', kind: 'intake' };
  }
  if (QUOTE.has(status)) {
    return { href: `/crm/leads/${lead.id}`, label: 'Đề xuất', kind: 'lead' };
  }
  if (WON.has(status)) {
    return { href: '/crm/hub', label: 'Hợp đồng', kind: 'hub' };
  }
  if (EARLY.has(status) && phone) {
    return { href: `tel:${phone}`, label: 'Gọi', kind: 'call' };
  }
  return { href: `/crm/leads/${lead.id}`, label: 'Mở lead', kind: 'lead' };
}
