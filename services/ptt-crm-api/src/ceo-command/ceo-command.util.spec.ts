import {
  assertReplyNumbersInFacts,
  ceoThreadId,
  nearestNlAliases,
} from './ceo-command.util';

describe('ceo-command.util', () => {
  it('builds thread id in VN date', () => {
    expect(ceoThreadId(12, new Date('2026-08-29T18:00:00.000Z'))).toBe('ceo:12:2026-08-30');
  });

  it('rejects invented money vs facts', () => {
    expect(assertReplyNumbersInFacts('Doanh thu 2 tỷ', { amount_vnd: 1000 })).toBe(false);
    expect(assertReplyNumbersInFacts('1000 lead', { total: '1000 lead' })).toBe(true);
  });

  it('nearestNlAliases ranks overlap', () => {
    const out = nearestNlAliases(
      'doanh thu thang',
      [
        { id: 'revenue_received_30d', label: 'Doanh thu 30 ngày', aliases: ['dt 30n'] },
        { id: 'leads_new_30d', label: 'Lead mới 30 ngày', aliases: [] },
      ],
    );
    expect(out[0]?.id).toBe('revenue_received_30d');
  });
});
