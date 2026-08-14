import { describe, expect, it } from 'vitest';
import { insightConfidencePayload, normalizeReportExec, type ConfidenceRubric } from './market-research-api';

const empty: ConfidenceRubric = { S: 0, F: 0, T: 0, A: 0, R: 0 };

describe('normalizeReportExec', () => {
  it("normalizeReportExec('hello') → { vi: 'hello', en: null, en_status: 'none' }", () => {
    expect(normalizeReportExec('hello')).toEqual({
      vi: 'hello',
      en: null,
      en_status: 'none',
    });
  });
});

describe('insightConfidencePayload', () => {
  it('omits all-zero fallback when untouched and no stored rubric', () => {
    expect(insightConfidencePayload(empty, { touched: false, hasStoredRubric: false })).toBeUndefined();
  });

  it('sends rubric when the analyst touched it', () => {
    expect(insightConfidencePayload(empty, { touched: true, hasStoredRubric: false })).toEqual(empty);
  });

  it('sends rubric when a stored rubric exists', () => {
    const stored: ConfidenceRubric = { S: 2, F: 2, T: 1, A: 3, R: 2 };
    expect(insightConfidencePayload(stored, { touched: false, hasStoredRubric: true })).toEqual(stored);
  });
});
