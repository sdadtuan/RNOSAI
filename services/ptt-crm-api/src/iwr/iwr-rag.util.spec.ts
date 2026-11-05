import { computeRagHint } from './iwr-rag.util';

describe('computeRagHint', () => {
  it('hints red when blocker high and does not overwrite user rag', () => {
    expect(computeRagHint({ overdue_p1: 0, blocker_high: 1, kpi_below: 0 })).toEqual({
      rag: 'red',
      reasons: ['blocker_high'],
    });
  });

  it('hints yellow when kpi below and no blockers', () => {
    expect(computeRagHint({ overdue_p1: 0, blocker_high: 0, kpi_below: 2 })).toEqual({
      rag: 'yellow',
      reasons: ['kpi_below'],
    });
  });

  it('hints green when all clear', () => {
    expect(computeRagHint({ overdue_p1: 0, blocker_high: 0, kpi_below: 0 })).toEqual({
      rag: 'green',
      reasons: [],
    });
  });
});
