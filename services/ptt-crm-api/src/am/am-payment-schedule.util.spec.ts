import { derivePaymentSchedule } from './am-payment-schedule.util';

describe('derivePaymentSchedule', () => {
  it('returns empty when no start or signed date', () => {
    expect(
      derivePaymentSchedule({
        billing_type: 'retainer',
        amount_vnd: 12_000_000,
        starts_on: null,
        ends_on: null,
        signed_on: null,
        as_of: '2026-09-05',
      }),
    ).toEqual([]);
  });

  it('emits one row for one_off and never marks paid', () => {
    const rows = derivePaymentSchedule({
      billing_type: 'one_off',
      amount_vnd: 50_000_000,
      starts_on: '2026-08-01',
      ends_on: null,
      signed_on: '2026-07-15',
      as_of: '2026-09-05',
    });
    expect(rows).toEqual([
      { due_on: '2026-08-01', amount_vnd: 50_000_000, status: 'overdue', source: 'derived' },
    ]);
    expect(rows[0]).not.toHaveProperty('paid');
  });

  it('caps recurring months at 36', () => {
    const rows = derivePaymentSchedule({
      billing_type: 'retainer',
      amount_vnd: 12_000_000,
      starts_on: '2024-01-01',
      ends_on: '2028-12-01',
      signed_on: null,
      as_of: '2026-09-05',
    });
    expect(rows.length).toBe(36);
  });
});
