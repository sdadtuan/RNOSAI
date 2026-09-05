import {
  amBuildRetention,
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

  it('excludes churned am_status at from from startSet', () => {
    expect(
      amLogoStartSet(
        [
          client({
            agency_client_id: 'churned-no-date',
            am_status: 'churned',
            churned_at: null,
          }),
          client({
            agency_client_id: 'churned-before',
            am_status: 'churned',
            churned_at: '2025-12-15',
          }),
        ],
        PERIOD,
      ),
    ).toHaveLength(0);

    expect(
      amLogoStartSet(
        [
          client({
            agency_client_id: 'still-active-at-from',
            am_status: 'churned',
            churned_at: '2026-03-01',
          }),
        ],
        PERIOD,
      ),
    ).toHaveLength(1);
  });

  it('does not count a won expand opp on a new logo toward NRR', () => {
    const out = amBuildRetention({
      period: PERIOD,
      scope: 'all',
      clients: [
        client({ agency_client_id: 'start-1' }),
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
      ],
      wonExpandOpps: [{ agency_client_id: 'new-logo', kind: 'expand', value_vnd: 20_000_000 }],
      lostRenewals: [],
      forecast: [],
      freshnessAsOf: null,
      now: new Date('2026-09-05T00:00:00.000Z'),
    });
    expect(out.kpis.nrr).toBeNull();
    expect(out.kpis.expansion_mrr).toBeNull();
    expect(out.nrr_hidden).toBe(true);
  });

  it('builds chart drills that differ from the generic Logo href', () => {
    const out = amBuildRetention({
      period: PERIOD,
      scope: 'me',
      clients: [
        client({
          agency_client_id: 'owned',
          owner_staff_id: 7,
          churn_reason: 'Giá',
          am_status: 'churned',
          churned_at: '2026-04-01',
        }),
      ],
      wonExpandOpps: [],
      lostRenewals: [],
      forecast: [{ bucket: 'committed', value_vnd: 1 }],
      freshnessAsOf: null,
      now: new Date('2026-09-05T00:00:00.000Z'),
    });
    expect(out.by_owner[0]?.href).toContain('owner=7');
    expect(out.by_owner[0]?.href).not.toBe(out.drills.logo);
    expect(out.churn_reasons[0]?.href).toContain('reason=');
    expect(out.churn_reasons[0]?.href).not.toBe(out.drills.logo);
    expect(out.churn_reasons[0]?.href).not.toBe(out.drills.churned_mrr);
    expect(out.forecast[0]?.href).toContain('forecast=committed');
    expect(out.forecast[0]?.href).not.toBe(out.drills.logo);
    expect(out.cohort[0]?.cells[0]?.href).toContain('cohort=');
    expect(out.cohort[0]?.cells[0]?.href).not.toBe(out.drills.logo);
  });
});
