import { describe, expect, it } from 'vitest';
import { formatSharePct, shouldShowConjointTab, CJ_TAB_BANNER } from './conjoint-pane.util';

describe('conjoint-pane.util', () => {
  it('keeps conjoint tab banner verbatim', () => {
    expect(CJ_TAB_BANNER).toBe(
      'Conjoint lite — đếm mức được chọn theo thuộc tính. Không market simulator. Không suy MOE.',
    );
  });

  it('shows conjoint tab only on PRICE_OFFER', () => {
    expect(shouldShowConjointTab('PRICE_OFFER')).toBe(true);
    expect(shouldShowConjointTab('CAT_REVIEW')).toBe(false);
    expect(shouldShowConjointTab('TRACKER')).toBe(false);
  });

  it('formats share pct', () => {
    expect(formatSharePct(50)).toBe('50');
    expect(formatSharePct(37.5)).toBe('37.5');
  });
});
