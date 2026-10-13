import { describe, expect, it } from 'vitest';
import { sortAeTeamRows, type AeTeamSortRow } from './ae-team-table.util';

function row(partial: Partial<AeTeamSortRow> & Pick<AeTeamSortRow, 'staff_id' | 'name' | 'sla_breach'>): AeTeamSortRow {
  return {
    accepting: true,
    open_leads: 0,
    sla_warning: 0,
    within_sla_pct: null,
    avg_first_response_minutes: null,
    calls: 0,
    answer_pct: null,
    stale: 0,
    missed_callbacks: 0,
    lead_to_quote_pct: null,
    quote_to_won_pct: null,
    revenue_vnd: null,
    attainment_pct: null,
    tone: 'green',
    by_status: { moi: 0, da_lien_he: 0, dang_tu_van: 0, bao_gia: 0 },
    ...partial,
  };
}

describe('sortAeTeamRows', () => {
  it('puts the AE with more late leads first', () => {
    const sorted = sortAeTeamRows([
      row({ staff_id: 1, name: 'An', sla_breach: 1 }),
      row({ staff_id: 2, name: 'Bình', sla_breach: 4 }),
    ]);
    expect(sorted.map((item) => item.staff_id)).toEqual([2, 1]);
  });
});
