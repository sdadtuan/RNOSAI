import {
  DEFAULT_BRIEF_WEIGHTS,
  briefCompleteness,
  briefReadyForPublish,
  briefScoreThreshold,
  generatePathBriefReady,
  normalizeBriefForGate,
  usesEnterpriseBrief,
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

describe('usesEnterpriseBrief / normalizeBriefForGate', () => {
  it('is false for E0 generate-path keys and true when any weight key is present', () => {
    expect(usesEnterpriseBrief({ hook: 'x', audience: 'CMO', goal: 'Lead' })).toBe(false);
    expect(usesEnterpriseBrief({ objective: '' })).toBe(true);
    expect(usesEnterpriseBrief({ kpi: 'MQLs' })).toBe(true);
  });

  it('aliases goal/audience/hook/usp/funnel_goal without changing DEFAULT_BRIEF_WEIGHTS', () => {
    const normalized = normalizeBriefForGate(
      { goal: 'Lead', audience: 'CMO', hook: 'Open', usp: 'Proof', funnel_goal: 'BOFU' },
      { funnel_goal: 'ignored-when-brief-has-funnel' },
    );
    expect(normalized.objective).toBe('Lead');
    expect(normalized.persona).toBe('CMO');
    expect(normalized.smm).toBe('Open');
    expect(normalized.proofs).toBe('Proof');
    expect(normalized.funnel).toBe('BOFU');
    expect(DEFAULT_BRIEF_WEIGHTS.objective).toBe(15);
  });

  it('falls back to item.funnel_goal when brief funnel is empty', () => {
    expect(normalizeBriefForGate({}, { funnel_goal: 'awareness' }).funnel).toBe('awareness');
  });
});

describe('generatePathBriefReady / briefReadyForPublish', () => {
  it('requires audience|persona and goal|objective and does not invent Pass from hook-only', () => {
    expect(generatePathBriefReady({ hook: 'only' })).toBe(false);
    expect(generatePathBriefReady({ audience: 'CMO', goal: 'Lead' })).toBe(true);
    expect(generatePathBriefReady({ persona: 'CMO', objective: 'Lead' })).toBe(true);
    expect(briefReadyForPublish({ brief_json: {}, status: 'draft', body_json: {} })).toBe(false);
  });

  it('uses generate-path or approved body path for non-enterprise briefs', () => {
    expect(
      briefReadyForPublish({
        brief_json: { audience: 'CMO', goal: 'Lead' },
        status: 'draft',
        body_json: { markdown: '' },
      }),
    ).toBe(true);
    expect(
      briefReadyForPublish({
        brief_json: {},
        status: 'approved_internal',
        body_json: { markdown: 'ready' },
      }),
    ).toBe(true);
    expect(
      briefReadyForPublish({
        brief_json: {},
        status: 'approved_internal',
        body_json: { markdown: '' },
      }),
    ).toBe(false);
  });

  it('keeps 80/95 on the normalized enterprise brief', () => {
    expect(
      briefReadyForPublish({
        brief_json: {
          objective: 'Lead',
          funnel: 'BOFU',
          persona: 'CMO',
          smm: 'LI',
          proofs: 'Case',
          restricted: 'None',
          disclaimer: 'N/A',
          cta: 'Book',
          kpi: 'SQL',
        },
        risk_level: 'Normal',
        status: 'draft',
      }),
    ).toBe(true);
    expect(
      briefReadyForPublish({
        brief_json: { objective: 'Lead' },
        risk_level: 'Normal',
        status: 'approved_internal',
        body_json: { markdown: 'ready' },
      }),
    ).toBe(false);
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
