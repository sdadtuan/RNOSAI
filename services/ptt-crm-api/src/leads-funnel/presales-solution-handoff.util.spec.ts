import {
  blocksDirectProposalAdvance,
  handoffBadgeLabel,
  leadStatusAfterSolutionHandoff,
  leadStatusAfterSolutionRelease,
  normalizeHandoffStatus,
} from './presales-solution-handoff.util';

describe('presales-solution-handoff.util', () => {
  it('normalizes handoff status', () => {
    expect(normalizeHandoffStatus('pending')).toBe('pending');
    expect(normalizeHandoffStatus('with_solution')).toBe('with_solution');
    expect(normalizeHandoffStatus('released')).toBe('released');
    expect(normalizeHandoffStatus('')).toBe('');
    expect(normalizeHandoffStatus(null)).toBe('');
  });

  it('blocks direct proposal advance for active handoff', () => {
    expect(blocksDirectProposalAdvance('pending')).toBe(true);
    expect(blocksDirectProposalAdvance('with_solution')).toBe(true);
    expect(blocksDirectProposalAdvance('released')).toBe(false);
    expect(blocksDirectProposalAdvance('')).toBe(false);
  });

  it('moves an early lead to Đang tư vấn and leaves a closed lead', () => {
    expect(leadStatusAfterSolutionHandoff('first_contact')).toBe('dang_tu_van');
    expect(leadStatusAfterSolutionHandoff('moi')).toBe('dang_tu_van');
    expect(leadStatusAfterSolutionHandoff('lost')).toBeNull();
    expect(leadStatusAfterSolutionHandoff('bao_gia')).toBeNull();
    expect(leadStatusAfterSolutionHandoff('dang_tu_van')).toBeNull();
  });

  it('builds badge labels', () => {
    expect(handoffBadgeLabel('pending')).toContain('chờ');
    expect(handoffBadgeLabel('with_solution', 'Lan')).toContain('Lan');
  });
});

  it('moves Đang tư vấn to Chờ báo giá (bao_gia) and leaves a closed lead', () => {
    expect(leadStatusAfterSolutionRelease('dang_tu_van')).toBe('bao_gia');
    expect(leadStatusAfterSolutionRelease('hen_gap')).toBe('bao_gia');
    expect(leadStatusAfterSolutionRelease('lost')).toBeNull();
    expect(leadStatusAfterSolutionRelease('won')).toBeNull();
    expect(leadStatusAfterSolutionRelease('bao_gia')).toBeNull();
  });
