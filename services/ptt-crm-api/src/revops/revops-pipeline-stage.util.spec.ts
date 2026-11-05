import {
  isRevopsPipelineDealStale,
  mapRevopsPipelineStage,
  REVOPS_PIPELINE_STAGES,
} from './revops-pipeline-stage.util';

describe('mapRevopsPipelineStage', () => {
  it('maps presales stages to five RevOps columns', () => {
    expect(
      mapRevopsPipelineStage({ presalesStage: 'lead', hasProposal: false, contractApprovalPending: false }),
    ).toBe('discovery');
    expect(
      mapRevopsPipelineStage({
        presalesStage: 'consult',
        hasProposal: false,
        contractApprovalPending: false,
      }),
    ).toBe('qualified');
    expect(
      mapRevopsPipelineStage({
        presalesStage: 'proposal',
        hasProposal: false,
        contractApprovalPending: false,
      }),
    ).toBe('proposal');
    expect(
      mapRevopsPipelineStage({
        presalesStage: 'proposal',
        hasProposal: true,
        contractApprovalPending: false,
      }),
    ).toBe('negotiation');
    expect(
      mapRevopsPipelineStage({
        presalesStage: 'proposal',
        hasProposal: true,
        contractApprovalPending: true,
      }),
    ).toBe('contract_review');
  });

  it('covers all five kanban columns', () => {
    expect(REVOPS_PIPELINE_STAGES).toHaveLength(5);
  });
});

describe('isRevopsPipelineDealStale', () => {
  it('is stale when close_date is before today and stage is not won', () => {
    expect(isRevopsPipelineDealStale('2026-08-01', 'dang_tu_van', '2026-09-06')).toBe(true);
    expect(isRevopsPipelineDealStale('2026-09-06', 'dang_tu_van', '2026-09-06')).toBe(false);
    expect(isRevopsPipelineDealStale('2026-09-10', 'dang_tu_van', '2026-09-06')).toBe(false);
  });

  it('is not stale when close_date missing or lead already won', () => {
    expect(isRevopsPipelineDealStale(null, 'dang_tu_van', '2026-09-06')).toBe(false);
    expect(isRevopsPipelineDealStale('2026-08-01', 'won', '2026-09-06')).toBe(false);
    expect(isRevopsPipelineDealStale('2026-08-01', 'chot', '2026-09-06')).toBe(false);
  });
});
