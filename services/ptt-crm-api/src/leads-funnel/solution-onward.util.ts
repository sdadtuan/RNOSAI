/** Leads Marketing Leader may see: handed to Solution, or already on Báo giá / Triển Khai. */

export const SOLUTION_ONWARD_STATUSES = [
  'bao_gia',
  'proposal',
  'dam_phan',
  'negotiation',
  'trien_khai',
  'won',
  'chot',
  'post_sale',
] as const;

export const SOLUTION_HANDOFF_ONWARD = ['pending', 'with_solution', 'released'] as const;

export function leadIsFromSolutionOnward(lead: {
  status?: string | null;
  solution_handoff?: string | null;
}): boolean {
  const status = String(lead.status ?? '')
    .trim()
    .toLowerCase();
  if ((SOLUTION_ONWARD_STATUSES as readonly string[]).includes(status)) return true;
  const handoff = String(lead.solution_handoff ?? '')
    .trim()
    .toLowerCase();
  return (SOLUTION_HANDOFF_ONWARD as readonly string[]).includes(handoff);
}

/** Postgres list predicate. Pending / with Solution / released, or a quote-or-later status. */
export function buildFromSolutionOnwardClause(alias = 'l'): string {
  const status = `lower(trim(COALESCE(${alias}.status, '')))`;
  const onward = SOLUTION_ONWARD_STATUSES.map((value) => `'${value}'`).join(', ');
  const handoffs = SOLUTION_HANDOFF_ONWARD.map((value) => `'${value}'`).join(', ');
  return `(
    ${status} IN (${onward})
    OR EXISTS (
      SELECT 1 FROM crm_lead_presales ps
      WHERE ps.lead_id = ${alias}.sqlite_lead_id
        AND COALESCE(ps.status, '') = 'active'
        AND lower(COALESCE(ps.handoff_status, '')) IN (${handoffs})
    )
  )`;
}
