import { CsdReportBlock, CsdReportSection, normalizeSection } from './csd-report-blocks';

export type { CsdReportBlock, CsdReportSection };
export { normalizeSection };

export type CsdTicketRollup = {
  closed: { id: string; code: string; title: string }[];
  breached: { id: string; code: string; title: string }[];
  out_of_scope: { id: string; code: string; title: string }[];
};

const UPSELL_BODY = 'Cờ upsell: ngoài phạm vi hợp đồng.';

function summarize(tickets: { code: string; title: string }[]): string {
  return tickets.map((t) => `${t.code} ${t.title}`).join('; ');
}

function isUpsellBlock(block: CsdReportBlock): boolean {
  return block.type === 'rich_text' && /upsell/i.test(block.body);
}

function mergeRollup(existing: unknown, incoming: CsdReportBlock[]): CsdReportSection {
  const current = normalizeSection(existing);
  const kept = current.blocks.filter((b) => b.type !== 'ticket_rollup' && !isUpsellBlock(b));
  const meaningful = kept.filter((b) => !(b.type === 'rich_text' && b.body === '' && kept.length === 1));
  return { blocks: [...meaningful, ...incoming] };
}

export function applyTicketRollup(
  sections: Record<string, unknown>,
  rollup: CsdTicketRollup,
): Record<string, unknown> {
  const closedBlock: CsdReportBlock = {
    type: 'ticket_rollup',
    ticket_ids: rollup.closed.map((t) => t.id),
    summary: summarize(rollup.closed),
  };
  const riskTickets = [...rollup.breached, ...rollup.out_of_scope];
  const riskBlocks: CsdReportBlock[] = [
    {
      type: 'ticket_rollup',
      ticket_ids: riskTickets.map((t) => t.id),
      summary: summarize(riskTickets),
    },
  ];
  if (rollup.out_of_scope.length > 0) {
    riskBlocks.push({ type: 'rich_text', body: UPSELL_BODY });
  }

  return {
    ...sections,
    work_completed: mergeRollup(sections.work_completed, [closedBlock]),
    ticket_sla: mergeRollup(sections.ticket_sla, [closedBlock]),
    risks: mergeRollup(sections.risks, riskBlocks),
  };
}
