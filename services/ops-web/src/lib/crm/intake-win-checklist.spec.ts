import { describe, expect, it } from 'vitest';
import { WIN_SCORE_KEYS } from './intake-win-score';
import {
  mergeWinChecklistPatch,
  parseWinChecklist,
  toggleWinChecklistScore,
  winChecklistTotal,
  WIN_CHECKLIST,
} from './intake-win-checklist';

describe('intake-win-checklist', () => {
  it('has 5 statements for every Win-score key', () => {
    for (const key of WIN_SCORE_KEYS) {
      expect(WIN_CHECKLIST[key].items.map((item) => item.score)).toEqual([1, 2, 3, 4, 5]);
    }
  });

  it('parses answers_json win_checklist', () => {
    expect(parseWinChecklist({ win_checklist: { incumbent: 4 } })).toEqual({ incumbent: 4 });
    expect(parseWinChecklist({ win_checklist: { incumbent: 4, junk: 9 } })).toEqual({ incumbent: 4 });
  });

  it('toggles the same score off', () => {
    const once = toggleWinChecklistScore({}, 'incumbent', 4);
    expect(once.incumbent).toBe(4);
    expect(toggleWinChecklistScore(once, 'incumbent', 4).incumbent).toBeUndefined();
  });

  it('totals checklist via computeWinTotal', () => {
    const allThrees = Object.fromEntries(WIN_SCORE_KEYS.map((key) => [key, 3]));
    expect(winChecklistTotal(allThrees)).toBe(18);
  });

  it('merge writes win_checklist and win_score_json', () => {
    const merged = mergeWinChecklistPatch({ foo: 'bar' }, { incumbent: 4, competitor: 3 });
    expect(merged).toMatchObject({
      foo: 'bar',
      win_checklist: {
        incumbent: 4,
        competitor: 3,
        selection_criteria: 0,
        switch_risk: 0,
        champion: 0,
        next_step: 0,
      },
      win_score_json: {
        incumbent: 4,
        competitor: 3,
        selection_criteria: 0,
        switch_risk: 0,
        champion: 0,
        next_step: 0,
      },
    });
  });
});
