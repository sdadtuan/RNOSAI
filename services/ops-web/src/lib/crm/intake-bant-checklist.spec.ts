import { describe, expect, it } from 'vitest';
import { BANT_KEYS } from './intake-bant';
import {
  BANT_CHECKLIST,
  checklistFromBant,
  parseBantChecklist,
  scoreBantFromChecklist,
  toggleBantChecklistScore,
} from './intake-bant-checklist';

describe('intake-bant-checklist', () => {
  it('has 5 statements for every BANT key', () => {
    for (const key of BANT_KEYS) {
      expect(BANT_CHECKLIST[key].items.map((item) => item.score)).toEqual([1, 2, 3, 4, 5]);
    }
  });

  it('scores selected statements into bant_json', () => {
    expect(scoreBantFromChecklist({ budget: 4, need: 5 })).toEqual({
      budget: 4,
      authority: 0,
      need: 5,
      timeline: 0,
      fit: 0,
      history: 0,
    });
  });

  it('toggles the same score off', () => {
    const once = toggleBantChecklistScore({}, 'budget', 3);
    expect(once.budget).toBe(3);
    expect(toggleBantChecklistScore(once, 'budget', 3).budget).toBeUndefined();
  });

  it('replaces score when picking another statement', () => {
    const next = toggleBantChecklistScore({ budget: 2 }, 'budget', 5);
    expect(next.budget).toBe(5);
  });

  it('parses answers_json and mirrors existing bant radios', () => {
    expect(parseBantChecklist({ bant_checklist: { budget: 4, junk: 9 } })).toEqual({ budget: 4 });
    expect(checklistFromBant({ budget: 2, authority: 0 })).toEqual({ budget: 2 });
  });
});
