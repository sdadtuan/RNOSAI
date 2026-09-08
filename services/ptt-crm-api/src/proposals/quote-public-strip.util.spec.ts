import { stripPublicQuote } from './quote-public-strip.util';

const FORBIDDEN = ['cost', 'margin', 'gm_bps', 'nsr'] as const;

describe('stripPublicQuote', () => {
  it('excludes cost, margin, gm_bps, nsr and cost_* / approval internals', () => {
    const stripped = stripPublicQuote({
      title: 'Growth Q4',
      cost: 48_000_000,
      margin: 0.224,
      gm_bps: 2240,
      nsr: 132_600_000,
      nsr_vnd: 132_600_000,
      cost_labor_vnd: 20_000_000,
      cost_outsource_vnd: 5_000_000,
      cost_other_vnd: 1,
      direct_cost_vnd: 26_000_000,
      approval: { status: 'approved' },
      approvals: [{ step: 'finance' }],
      approval_id: 'apr-1',
      pending_approval: true,
      investment: {
        fee_vnd: 100_000_000,
        payable_vnd: 108_000_000,
        gm_bps: 2240,
        cost: 9,
      },
    });

    for (const key of FORBIDDEN) {
      expect(stripped).not.toHaveProperty(key);
    }
    expect(JSON.stringify(stripped)).not.toMatch(
      /"cost"|"margin"|"gm_bps"|"nsr"|"nsr_vnd"|"cost_labor_vnd"|"cost_outsource_vnd"|"approval"/,
    );
    expect(stripped.investment).toEqual({
      fee_vnd: 100_000_000,
      payable_vnd: 108_000_000,
    });
    expect(stripped.title).toBe('Growth Q4');
  });

  it('drops options where client_visible is false, including nested option arrays', () => {
    const stripped = stripPublicQuote({
      title: 'Growth Q4',
      options: [
        {
          option_key: 'A',
          name: 'Standard',
          recommended: true,
          client_visible: true,
          payable_vnd: 100_000_000,
        },
        {
          option_key: 'B',
          name: 'Hidden',
          recommended: false,
          client_visible: false,
          payable_vnd: 80_000_000,
        },
      ],
      compare: {
        options: [
          {
            option_key: 'C',
            name: 'Internal',
            recommended: false,
            client_visible: false,
            payable_vnd: 1,
          },
        ],
      },
    });

    expect(stripped.options).toEqual([
      {
        option_key: 'A',
        name: 'Standard',
        recommended: true,
        client_visible: true,
        payable_vnd: 100_000_000,
      },
    ]);
    expect(stripped.compare.options).toEqual([]);
    expect(JSON.stringify(stripped)).not.toMatch(/"Hidden"|"Internal"/);
  });
});
