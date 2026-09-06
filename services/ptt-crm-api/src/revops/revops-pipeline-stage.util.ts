export const REVOPS_PIPELINE_STAGES = [
  'discovery',
  'qualified',
  'proposal',
  'negotiation',
  'contract_review',
] as const;

export type RevopsPipelineStage = (typeof REVOPS_PIPELINE_STAGES)[number];

export const REVOPS_STAGE_WEIGHT: Record<RevopsPipelineStage, number> = {
  discovery: 0.1,
  qualified: 0.25,
  proposal: 0.5,
  negotiation: 0.75,
  contract_review: 0.9,
};

export type RevopsPipelineSourceRow = {
  presalesStage: string | null;
  hasProposal: boolean;
  contractApprovalPending: boolean;
  leadStatus: string;
  closeDate: string | null;
};

const WON_STATUSES = new Set(['won', 'chot']);

export function mapRevopsPipelineStage(row: {
  presalesStage: string | null;
  hasProposal: boolean;
  contractApprovalPending: boolean;
}): RevopsPipelineStage {
  if (row.contractApprovalPending) return 'contract_review';
  if (row.hasProposal && row.presalesStage === 'proposal') return 'negotiation';
  if (row.presalesStage === 'proposal') return 'proposal';
  if (row.presalesStage === 'consult') return 'qualified';
  return 'discovery';
}

/** Plan B9: stale when close_date < today and stage is not won. */
export function isRevopsPipelineDealStale(
  closeDate: string | null,
  leadStatus: string,
  todayIso: string,
): boolean {
  if (!closeDate?.trim()) return false;
  if (WON_STATUSES.has(leadStatus.trim().toLowerCase())) return false;
  const closeDay = closeDate.trim().slice(0, 10);
  const todayDay = todayIso.trim().slice(0, 10);
  return closeDay < todayDay;
}

export function revopsPipelineRiskLabel(flags: string[]): string | null {
  if (flags.includes('overdue_close')) return 'Quá hạn close';
  if (flags.includes('stage_aging')) return 'Stage aging';
  if (flags.includes('missing_quote')) return 'Thiếu báo giá';
  if (flags.includes('no_activity')) return 'Không activity';
  if (flags.includes('missing_next_step')) return 'Thiếu next step';
  return flags[0] ?? null;
}
