import {
  filterScoreSuggestions,
  formCorpus,
  normalizeScoreQuote,
} from './intake-score-suggest.util';

describe('intake-score-suggest.util', () => {
  const corpus = 'agency cũ không đạt KPI tháng 3 ngân sách 30 triệu';

  describe('normalizeScoreQuote', () => {
    it('lowercases and collapses whitespace', () => {
      expect(normalizeScoreQuote('  Không   Đạt KPI  ')).toBe('không đạt kpi');
    });
  });

  describe('formCorpus', () => {
    it('joins discovery, win, and commitment texts', () => {
      expect(
        formCorpus({
          discoveryAnswers: ['answer1'],
          winAnswers: ['answer2'],
          commitmentTexts: ['commit1'],
        }),
      ).toBe('answer1 answer2 commit1');
    });
  });

  describe('filterScoreSuggestions', () => {
    it('keeps quote found in corpus', () => {
      const result = filterScoreSuggestions({
        corpus,
        bant: { need: { score: 3, quote: 'không đạt KPI' } },
      });
      expect(result.suggestions.bant?.need).toEqual({ score: 3, quote: 'không đạt KPI' });
      expect(result.rejected).toHaveLength(0);
    });

    it('rejects quote not in form', () => {
      const result = filterScoreSuggestions({
        corpus,
        bant: { need: { score: 3, quote: 'top 1 google' } },
      });
      expect(result.suggestions.bant?.need).toBeUndefined();
      expect(result.rejected).toEqual([
        { layer: 'bant', key: 'need', reason: 'quote_not_in_form' },
      ]);
    });

    it('rejects empty quote', () => {
      const result = filterScoreSuggestions({
        corpus,
        bant: { need: { score: 3, quote: '   ' } },
      });
      expect(result.suggestions.bant?.need).toBeUndefined();
      expect(result.rejected).toEqual([{ layer: 'bant', key: 'need', reason: 'empty_quote' }]);
    });

    it('rejects bad score', () => {
      const result = filterScoreSuggestions({
        corpus,
        bant: { need: { score: 9 as 3, quote: 'không đạt KPI' } },
      });
      expect(result.suggestions.bant?.need).toBeUndefined();
      expect(result.rejected).toEqual([{ layer: 'bant', key: 'need', reason: 'bad_score' }]);
    });

    it('skips unknown bant and win keys without crashing', () => {
      const result = filterScoreSuggestions({
        corpus,
        bant: { not_a_bant_key: { score: 3, quote: 'không đạt KPI' } },
        win: { not_a_win_key: { score: 4, quote: 'không đạt KPI' } },
      });
      expect(result.suggestions.bant).toBeUndefined();
      expect(result.suggestions.win).toBeUndefined();
      expect(result.rejected).toHaveLength(0);
    });

    it('validates win layer suggestions', () => {
      const result = filterScoreSuggestions({
        corpus,
        win: { incumbent: { score: 4, quote: 'ngân sách 30 triệu' } },
      });
      expect(result.suggestions.win?.incumbent).toEqual({
        score: 4,
        quote: 'ngân sách 30 triệu',
      });
      expect(result.rejected).toHaveLength(0);
    });
  });
});
