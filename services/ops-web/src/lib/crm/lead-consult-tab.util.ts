import type { LeadFunnelSnapshot } from '@/lib/api';
import { funnelPresalesStage } from '@/lib/crm/funnel-snapshot.util';

export const LEAD_CONSULT_TAB_HASH = '#funnel-presales';

/** PO Q1 — tab Tư vấn khi presales exists && stage ∈ {consult, proposal}. */
export function showLeadConsultTab(funnel: LeadFunnelSnapshot | null | undefined): boolean {
  const stage = funnelPresalesStage(funnel);
  if (!funnel?.presales || !stage) return false;
  return stage === 'consult' || stage === 'proposal';
}

export function presalesStageLabel(stage: string | undefined): string {
  const raw = String(stage ?? '')
    .trim()
    .toLowerCase()
    .replace(/-/g, '_');
  if (!raw) return '—';
  if (raw === 'consult' || raw === 'tu_van' || raw === 'dang_tu_van') return 'Tư vấn';
  if (raw === 'proposal' || raw === 'bao_gia' || raw === 'de_xuat' || raw === 'de xuat') return 'Báo giá';
  if (raw === 'lead' || raw === 'presales_lead' || raw === 'pre_sale' || raw === 'presale') return 'Pre Sale';
  // Never leak raw enum/slug codes to the UI.
  return '—';
}
