import { applyTicketRollup, normalizeSection } from './csd-report-rollup.util';

describe('csd-report-rollup.util', () => {
  it('puts OOS tickets into risks with upsell flag', () => {
    const next = applyTicketRollup({}, {
      closed: [{ id: 't1', code: 'PTT-2026-000001', title: 'Fix pixel' }],
      breached: [],
      out_of_scope: [{ id: 't2', code: 'PTT-2026-000002', title: 'Làm app' }],
    });
    const risks = normalizeSection(next.risks);
    expect(risks.blocks.some((b) => b.type === 'ticket_rollup' && b.ticket_ids.includes('t2'))).toBe(true);
    expect(JSON.stringify(risks)).toMatch(/upsell/i);
  });

  it('normalizeSection accepts legacy { body: string }', () => {
    const section = normalizeSection({ body: 'Tóm tắt tháng' });
    expect(section.blocks).toEqual([{ type: 'rich_text', body: 'Tóm tắt tháng' }]);
  });
});
