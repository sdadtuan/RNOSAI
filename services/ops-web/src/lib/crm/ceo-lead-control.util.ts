export type CeoLeadFlowFilter = 'all' | 'b2b_prospect' | 'spa_operational';
export type CeoLeadSituationFilter = 'all' | 'review' | 'unassigned' | 'assigned';

export type CeoLeadStatusFilter = {
  id: string;
  label: string;
  statuses: string[];
};

/** Every CRM status the desk can isolate, including stored aliases. */
export const CEO_LEAD_STATUS_FILTERS: readonly CeoLeadStatusFilter[] = [
  { id: 'all', label: 'Mọi trạng thái', statuses: [] },
  { id: 'moi', label: 'Mới', statuses: ['moi', 'new', 'first_contact', 'intake'] },
  { id: 'da_lien_he', label: 'Đã liên hệ', statuses: ['da_lien_he', 'contacted', 'qualified'] },
  { id: 'dang_tu_van', label: 'Đang tư vấn', statuses: ['dang_tu_van', 'nurturing'] },
  { id: 'hen_gap', label: 'Hẹn gặp', statuses: ['hen_gap'] },
  { id: 'bao_gia', label: 'Báo giá', statuses: ['bao_gia'] },
  { id: 'dam_phan', label: 'Đàm phán', statuses: ['dam_phan', 'negotiation'] },
  { id: 'proposal', label: 'Proposal', statuses: ['proposal'] },
  { id: 'chot', label: 'Chốt', statuses: ['chot'] },
  { id: 'won', label: 'Won', statuses: ['won'] },
  { id: 'lost', label: 'Lost', statuses: ['lost'] },
  { id: 'pending_cleanup', label: 'Chờ dọn', statuses: ['pending_cleanup'] },
];

export function ceoLeadStatusFilter(id: string): CeoLeadStatusFilter {
  return CEO_LEAD_STATUS_FILTERS.find((row) => row.id === id) ?? CEO_LEAD_STATUS_FILTERS[0];
}

export function ceoLeadListParams(input: {
  q?: string;
  statusId: string;
  flow: CeoLeadFlowFilter;
  situation: CeoLeadSituationFilter;
  limit: number;
  offset: number;
}): {
  q?: string;
  statuses?: string[];
  lead_flow_kind?: 'spa_operational' | 'b2b_prospect';
  hide_review_queue: false;
  review_queue_only?: boolean;
  unassigned_only?: boolean;
  assigned_only?: boolean;
  limit: number;
  offset: number;
} {
  const statuses = ceoLeadStatusFilter(input.statusId).statuses;
  return {
    q: input.q?.trim() || undefined,
    statuses: statuses.length ? statuses : undefined,
    lead_flow_kind: input.flow === 'all' ? undefined : input.flow,
    hide_review_queue: false,
    review_queue_only: input.situation === 'review' ? true : undefined,
    unassigned_only: input.situation === 'unassigned' ? true : undefined,
    assigned_only: input.situation === 'assigned' ? true : undefined,
    limit: input.limit,
    offset: input.offset,
  };
}
