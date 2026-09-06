export const REVOPS_COMMISSION_KPI_WEIGHTS = {
  newPct: 45,
  renewalPct: 25,
  upsellPct: 15,
  slaPct: 15,
} as const;

export type CommissionDealCategory = 'new' | 'renewal' | 'upsell' | 'sla';

export function categorizeCommissionDealRef(dealRef: string): CommissionDealCategory {
  const ref = dealRef.toLowerCase();
  if (ref.includes('renewal') || ref.includes('renew')) return 'renewal';
  if (ref.includes('upsell') || ref.includes('up-sell')) return 'upsell';
  if (ref.includes('sla')) return 'sla';
  return 'new';
}

export type CommissionProjectionInput = {
  dealRef: string;
  commissionVnd: number;
};

export type CommissionProjectionBreakdown = {
  newVnd: number;
  renewalVnd: number;
  upsellVnd: number;
  slaVnd: number;
  totalVnd: number;
};

export function buildCommissionProjections(
  transactions: CommissionProjectionInput[],
  estimatedTotal: number | null,
): CommissionProjectionBreakdown {
  const buckets = { newVnd: 0, renewalVnd: 0, upsellVnd: 0, slaVnd: 0 };
  for (const tx of transactions) {
    const cat = categorizeCommissionDealRef(tx.dealRef);
    if (cat === 'renewal') buckets.renewalVnd += tx.commissionVnd;
    else if (cat === 'upsell') buckets.upsellVnd += tx.commissionVnd;
    else if (cat === 'sla') buckets.slaVnd += tx.commissionVnd;
    else buckets.newVnd += tx.commissionVnd;
  }
  const fromTx = buckets.newVnd + buckets.renewalVnd + buckets.upsellVnd + buckets.slaVnd;
  if (fromTx > 0) {
    return { ...buckets, totalVnd: fromTx };
  }
  const total = estimatedTotal ?? 0;
  const w = REVOPS_COMMISSION_KPI_WEIGHTS;
  return {
    newVnd: Math.round((total * w.newPct) / 100),
    renewalVnd: Math.round((total * w.renewalPct) / 100),
    upsellVnd: Math.round((total * w.upsellPct) / 100),
    slaVnd: Math.round((total * w.slaPct) / 100),
    totalVnd: total,
  };
}

export type StaffCommissionRollupRow = {
  staffId: number;
  name: string;
  estimatedVnd: number;
  approvedVnd: number;
  pendingVnd: number;
  transactionCount: number;
};

export function payoutStepIndex(status: string): number {
  if (status === 'reconciled') return 3;
  if (status === 'locked') return 2;
  if (status === 'draft') return 1;
  return 0;
}
