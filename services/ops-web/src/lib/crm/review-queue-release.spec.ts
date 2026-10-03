import { describe, expect, it } from 'vitest';
import {
  DEFAULT_REVIEW_RELEASE_SPLIT,
  REVIEW_RELEASE_SPLITS,
  reviewReleaseSplitLabel,
} from './review-queue-release';

describe('review queue release split', () => {
  it('defaults to the project commission reset the API accepts', () => {
    expect(DEFAULT_REVIEW_RELEASE_SPLIT).toBe('reset_closer');
    expect(REVIEW_RELEASE_SPLITS.map((row) => row.value)).toEqual([
      'reset_closer',
      'keep_first_touch',
      'no_split',
    ]);
  });

  it('labels every choice in Vietnamese', () => {
    for (const row of REVIEW_RELEASE_SPLITS) {
      expect(reviewReleaseSplitLabel(row.value)).toBe(row.label);
      expect(row.label.length).toBeGreaterThan(8);
    }
  });
});
