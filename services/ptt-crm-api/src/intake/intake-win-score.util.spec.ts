import {
  computeWinTotal,
  missingRequiredWinKeys,
  parseWinChecklist,
  parseWinIntel,
  scoreWinFromChecklist,
  WIN_SCORE_KEYS,
  WIN_THRESHOLDS,
} from './intake-win-score.util';

describe('intake-win-score.util', () => {
  it('computeWinTotal sums only WIN_SCORE_KEYS within 1–5 to 18', () => {
    expect(
      computeWinTotal({
        incumbent: 4,
        competitor: 4,
        selection_criteria: 4,
        switch_risk: 3,
        champion: 2,
        next_step: 1,
      }),
    ).toBe(18);
    expect(WIN_SCORE_KEYS).toHaveLength(6);
    expect(WIN_THRESHOLDS.consult).toBe(18);
  });

  it('parseWinChecklist reads answers_json win_checklist', () => {
    expect(parseWinChecklist({ win_checklist: { incumbent: 5 } })).toEqual({ incumbent: 5 });
  });

  it('scoreWinFromChecklist fills all six keys', () => {
    expect(scoreWinFromChecklist({ incumbent: 5 })).toEqual({
      incumbent: 5,
      competitor: 0,
      selection_criteria: 0,
      switch_risk: 0,
      champion: 0,
      next_step: 0,
    });
  });

  it('missingRequiredWinKeys uses copied 4-key parse', () => {
    const answers = {
      win_intel: {
        competitor: { answer: 'Agency A đã làm SEO', confidence: 'confirmed' },
      },
      win_checklist: { incumbent: 5 },
    };
    const winIntel = parseWinIntel(answers);
    expect(winIntel.incumbent.answer).toBe('');
    expect(winIntel.competitor.answer).toBe('Agency A đã làm SEO');
    expect(
      missingRequiredWinKeys({
        winIntel,
        winChecklist: parseWinChecklist(answers),
      }),
    ).toEqual(['incumbent', 'selection_criteria', 'switch_risk']);
  });
});
