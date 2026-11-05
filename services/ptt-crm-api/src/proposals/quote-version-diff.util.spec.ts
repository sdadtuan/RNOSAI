import { diffQuoteVersions } from './quote-version-diff.util';

describe('diffQuoteVersions', () => {
  it('marks price, qty, discount, tax, cost, scope, visible KPI, payment, and clause as critical', () => {
    const from = {
      lines: [
        {
          qty: 1,
          unit_price_vnd: 25000000,
          final_price_vnd: 25000000,
          discount_vnd: 0,
          tax_vnd: 0,
          cost_labor_vnd: 10000000,
          cost_outsource_vnd: null,
          cost_other_vnd: null,
          scope_notes: '10 video',
        },
      ],
      discount_vnd: 0,
      tax_vnd: 2000000,
      kpis: [{ name: 'Leads', value_text: '20', client_visible: true }],
      payments: [{ seq: 1, pct_bps: 5000, amount_vnd: 13500000, milestone: 'Đợt 1' }],
      clauses: [{ template_key: 'ptt-hcm', body: 'Thanh toán 15 ngày' }],
    };
    const to = {
      lines: [
        {
          qty: 2,
          unit_price_vnd: 30000000,
          final_price_vnd: 60000000,
          discount_vnd: 1000000,
          tax_vnd: 4000000,
          cost_labor_vnd: 12000000,
          cost_outsource_vnd: null,
          cost_other_vnd: null,
          scope_notes: '20 video',
        },
      ],
      discount_vnd: 1000000,
      tax_vnd: 4720000,
      kpis: [{ name: 'Leads', value_text: '40', client_visible: true }],
      payments: [{ seq: 1, pct_bps: 10000, amount_vnd: 63720000, milestone: 'Full' }],
      clauses: [{ template_key: 'ptt-hcm', body: 'Thanh toán 30 ngày' }],
    };

    const diffs = diffQuoteVersions(from, to);
    const byPath = Object.fromEntries(diffs.map((d) => [d.path, d]));

    expect(byPath['lines[0].qty']).toMatchObject({ from: 1, to: 2, critical: true });
    expect(byPath['lines[0].unit_price_vnd']).toMatchObject({
      from: 25000000,
      to: 30000000,
      critical: true,
    });
    expect(byPath['lines[0].discount_vnd']).toMatchObject({ critical: true });
    expect(byPath['lines[0].tax_vnd']).toMatchObject({ critical: true });
    expect(byPath['lines[0].cost_labor_vnd']).toMatchObject({ critical: true });
    expect(byPath['lines[0].scope_notes']).toMatchObject({
      from: '10 video',
      to: '20 video',
      critical: true,
    });
    expect(byPath['kpis[0].value_text']).toMatchObject({ from: '20', to: '40', critical: true });
    expect(byPath['payments[0].pct_bps']).toMatchObject({ from: 5000, to: 10000, critical: true });
    expect(byPath['clauses[0].body']).toMatchObject({ critical: true });
    expect(diffs.every((d) => typeof d.path === 'string')).toBe(true);
  });

  it('does not mark hidden KPI or title-only fields as critical', () => {
    const diffs = diffQuoteVersions(
      {
        title: 'v1',
        kpis: [{ name: 'Internal', value_text: 'a', client_visible: false }],
      },
      {
        title: 'v2',
        kpis: [{ name: 'Internal', value_text: 'b', client_visible: false }],
      },
    );
    expect(diffs.find((d) => d.path === 'title')?.critical).not.toBe(true);
    expect(diffs.find((d) => d.path === 'kpis[0].value_text')?.critical).toBe(false);
  });

  it('qty-only change against an incomplete recalc snapshot does not invent discount/tax/scope', () => {
    const diffs = diffQuoteVersions(
      {
        lines: [{ qty: 1, unit_price_vnd: 25000000, final_price_vnd: 25000000 }],
      },
      {
        lines: [
          {
            qty: 2,
            unit_price_vnd: 25000000,
            final_price_vnd: 25000000,
            discount_vnd: 0,
            tax_vnd: 0,
            cost_labor_vnd: null,
            cost_outsource_vnd: null,
            cost_other_vnd: null,
            scope_notes: '',
          },
        ],
      },
    );
    const critical = diffs.filter((d) => d.critical).map((d) => d.path);
    expect(critical).toEqual(['lines[0].qty']);
    expect(critical.some((path) => path.includes('discount'))).toBe(false);
    expect(critical.some((path) => path.includes('tax'))).toBe(false);
    expect(critical.some((path) => path.includes('scope'))).toBe(false);
  });

  it('marks visible KPI changes critical and omits assumption/hidden KPI critical', () => {
    const diffs = diffQuoteVersions(
      {
        kpis: [
          { name: 'Leads', value_text: '20', client_visible: true, class: 'committed' },
          { name: 'CPL', value_text: 'a', class: 'assumption_input' },
        ],
      },
      {
        kpis: [
          { name: 'Leads', value_text: '40', client_visible: true, class: 'committed' },
          { name: 'CPL', value_text: 'b', class: 'assumption_input' },
        ],
      },
    );
    expect(diffs.find((d) => d.path === 'kpis[0].value_text')).toMatchObject({
      from: '20',
      to: '40',
      critical: true,
    });
    expect(diffs.find((d) => d.path === 'kpis[1].value_text')?.critical).not.toBe(true);
  });
});
