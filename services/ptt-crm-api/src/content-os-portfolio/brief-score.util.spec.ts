import {
  DEFAULT_BRIEF_WEIGHTS,
  briefCompleteness,
  briefScoreThreshold,
} from './brief-score.util';

describe('DEFAULT_BRIEF_WEIGHTS', () => {
  it('matches the CMKT-E brief contract', () => {
    expect(DEFAULT_BRIEF_WEIGHTS).toEqual({
      objective: 15,
      funnel: 10,
      persona: 8,
      smm: 15,
      proofs: 12,
      restricted: 10,
      disclaimer: 15,
      cta: 10,
      kpi: 5,
    });
  });
});

describe('briefCompleteness', () => {
  it('returns 0 when all weighted fields are empty', () => {
    expect(briefCompleteness({}, DEFAULT_BRIEF_WEIGHTS)).toBe(0);
  });

  it('returns 100 when every weighted field is filled', () => {
    expect(
      briefCompleteness(
        {
          objective: 'Lead gen',
          funnel: 'consideration',
          persona: 'CMO',
          smm: 'LinkedIn cadence',
          proofs: 'Case study',
          restricted: 'No medical claims',
          disclaimer: 'Results vary',
          cta: 'Book demo',
          kpi: 'MQLs',
        },
        DEFAULT_BRIEF_WEIGHTS,
      ),
    ).toBe(100);
  });

  it('ignores null, blank, and empty-array values', () => {
    expect(
      briefCompleteness(
        {
          objective: 'Lead gen',
          funnel: '   ',
          persona: null,
          smm: [],
          proofs: 'Case',
        },
        DEFAULT_BRIEF_WEIGHTS,
      ),
    ).toBe(27);
  });
});

describe('briefScoreThreshold', () => {
  it('is 95 for Brand-Sensitive and Regulated', () => {
    expect(briefScoreThreshold('Brand-Sensitive')).toBe(95);
    expect(briefScoreThreshold('Regulated')).toBe(95);
  });

  it('is 80 for Normal and any other risk_level', () => {
    expect(briefScoreThreshold('Normal')).toBe(80);
    expect(briefScoreThreshold('High')).toBe(80);
    expect(briefScoreThreshold(undefined)).toBe(80);
  });
});
