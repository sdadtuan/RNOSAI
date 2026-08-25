import type { LeadRow } from '@/lib/api';
import { WORK_SIGNALS } from './work-signals';

export type KanbanCardCta = {
  href: string;
  label: string;
  kind: 'call' | 'intake' | 'quote' | 'lead' | 'hub';
};

const EARLY: ReadonlySet<string> = new Set(['moi', 'da_lien_he', 'new']);
const CONSULT: ReadonlySet<string> = new Set(['dang_tu_van', 'hen_gap']);
const QUOTE: ReadonlySet<string> = new Set(['bao_gia', 'proposal', 'dam_phan']);
const WON: ReadonlySet<string> = new Set(['won', 'chot']);

export const KANBAN_STAGE_SETS = {
  early: EARLY,
  consult: CONSULT,
  quote: QUOTE,
  won: WON,
};

export function kanbanStageAccent(status: string): string {
  if (KANBAN_STAGE_SETS.consult.has(status)) return WORK_SIGNALS.sky;
  if (KANBAN_STAGE_SETS.quote.has(status)) return WORK_SIGNALS.gold;
  if (KANBAN_STAGE_SETS.won.has(status)) return WORK_SIGNALS.won;
  if (status === 'lost' || status === 'pending_cleanup') return WORK_SIGNALS.cold;
  return WORK_SIGNALS.ptt;
}

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
    return { href: `/crm/leads/${lead.id}`, label: 'Đề xuất', kind: 'quote' };
  }
  if (WON.has(status)) {
    return { href: '/crm/hub', label: 'Hợp đồng', kind: 'hub' };
  }
  if (EARLY.has(status) && phone) {
    return { href: `tel:${phone}`, label: 'Gọi', kind: 'call' };
  }
  return { href: `/crm/leads/${lead.id}`, label: 'Mở lead', kind: 'lead' };
}
