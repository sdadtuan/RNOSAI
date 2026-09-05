import {
  amGrrNrr,
  amLogoRetention,
  amLogoStartSet,
  amRecurringMrrAt,
  type AmReportsClient,
} from './am-reports.util';

const PERIOD = { from: '2026-01-01', to: '2026-09-05' };

function client(partial: Partial<AmReportsClient> & { agency_client_id: string }): AmReportsClient {
  return {
    owner_staff_id: 1,
    am_status: 'active',
    churned_at: null,
    churn_reason: null,
    contracts: [
      {
        billing_type: 'monthly',
        amount_vnd: 10_000_000,
        starts_on: '2025-01-01',
        ends_on: null,
        status: 'active',
      },
    ],
    ...partial,
  };
}

describe('am-reports.util', () => {
  it('computes GRR 0.85 and NRR 1.05 from the fixture', () => {
    expect(amGrrNrr({ start: 100, churn: 10, contraction: 5, expansion: 20 })).toEqual({
      grr: 0.85,
      nrr: 1.05,
    });
  });

  it('returns null GRR and NRR when Start is 0', () => {
    expect(amGrrNrr({ start: 0, churn: 0, contraction: 0, expansion: 0 })).toEqual({
      grr: null,
      nrr: null,
    });
  });

  it('hides NRR when expansion is unclassified', () => {
    expect(amGrrNrr({ start: 100, churn: 10, contraction: 5, expansion: null })).toEqual({
      grr: 0.85,
      nrr: null,
    });
  });

  it('computes Logo remaining_end / start_set', () => {
    expect(amLogoRetention({ startSet: 10, remainingEnd: 9 })).toBe(0.9);
  });

  it('does not add a new logo to the Logo denominator', () => {
    const startSet = Array.from({ length: 10 }, (_, i) =>
      client({ agency_client_id: `start-${i}` }),
    );
    const before = amLogoStartSet(startSet, PERIOD);
    expect(before).toHaveLength(10);

    const withNewLogo = [
      ...startSet,
      client({
        agency_client_id: 'new-logo',
        contracts: [
          {
            billing_type: 'monthly',
            amount_vnd: 8_000_000,
            starts_on: '2026-03-15',
            ends_on: null,
            status: 'active',
          },
        ],
      }),
    ];
    expect(amLogoStartSet(withNewLogo, PERIOD)).toHaveLength(before.length);
  });

  it('excludes media billing from Start MRR', () => {
    const row = client({
      agency_client_id: 'media-mix',
      contracts: [
        {
          billing_type: 'media',
          amount_vnd: 50_000_000,
          starts_on: '2025-01-01',
          ends_on: null,
          status: 'active',
        },
        {
          billing_type: 'monthly',
          amount_vnd: 12_000_000,
          starts_on: '2025-01-01',
          ends_on: null,
          status: 'active',
        },
      ],
    });
    expect(amRecurringMrrAt(row.contracts, PERIOD.from)).toBe(12_000_000);
  });
});
