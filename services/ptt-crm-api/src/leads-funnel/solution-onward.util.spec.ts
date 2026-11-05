import { buildFromSolutionOnwardClause, leadIsFromSolutionOnward } from './solution-onward.util';

describe('leadIsFromSolutionOnward', () => {
  it('hides a consult lead that has not been handed to Solution', () => {
    expect(leadIsFromSolutionOnward({ status: 'dang_tu_van', solution_handoff: '' })).toBe(false);
    expect(leadIsFromSolutionOnward({ status: 'moi' })).toBe(false);
    expect(leadIsFromSolutionOnward({ status: 'new' })).toBe(false);
  });

  it('keeps waiting, in progress, submitted Solution, quote, and Triển Khai', () => {
    expect(leadIsFromSolutionOnward({ status: 'dang_tu_van', solution_handoff: 'pending' })).toBe(true);
    expect(leadIsFromSolutionOnward({ status: 'dang_tu_van', solution_handoff: 'with_solution' })).toBe(true);
    expect(leadIsFromSolutionOnward({ status: 'dang_tu_van', solution_handoff: 'released' })).toBe(true);
    expect(leadIsFromSolutionOnward({ status: 'bao_gia' })).toBe(true);
    expect(leadIsFromSolutionOnward({ status: 'dam_phan' })).toBe(true);
    expect(leadIsFromSolutionOnward({ status: 'proposal' })).toBe(true);
    expect(leadIsFromSolutionOnward({ status: 'trien_khai' })).toBe(true);
  });
});

describe('buildFromSolutionOnwardClause', () => {
  it('matches handoff and quote-column statuses', () => {
    const sql = buildFromSolutionOnwardClause('l');
    expect(sql).toContain("l.sqlite_lead_id");
    expect(sql).toContain("'pending', 'with_solution', 'released'");
    expect(sql).toContain("'bao_gia', 'proposal', 'dam_phan', 'negotiation', 'trien_khai'");
    expect(sql).not.toContain("'dang_tu_van'");
    expect(sql).not.toContain("'moi'");
  });
});
