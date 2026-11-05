import { describe, expect, it } from 'vitest';
import {
  missingRequiredWinKeys,
  WIN_REQUIRED_KEYS,
  winConsultLabel,
  winGapToConsult,
  winKeyFilled,
} from './intake-win-coverage';
import { emptyWinIntel, type WinIntelState } from './intake-win-intel';

function withIntel(patch: Partial<WinIntelState>): WinIntelState {
  return { ...emptyWinIntel(), ...patch };
}

describe('winKeyFilled', () => {
  it('treats incumbent as filled when answer is long enough and confirmed', () => {
    expect(
      winKeyFilled({
        key: 'incumbent',
        winIntel: withIntel({ incumbent: { answer: 'Agency A đã làm SEO', confidence: 'confirmed' } }),
        winChecklist: {},
      }),
    ).toBe(true);
  });

  it('rejects short incumbent answer even if confirmed', () => {
    expect(
      winKeyFilled({
        key: 'incumbent',
        winIntel: withIntel({ incumbent: { answer: 'abc', confidence: 'confirmed' } }),
        winChecklist: {},
      }),
    ).toBe(false);
  });

  it('rejects long incumbent answer with guess confidence', () => {
    expect(
      winKeyFilled({
        key: 'incumbent',
        winIntel: withIntel({ incumbent: { answer: 'Agency A đã làm SEO', confidence: 'guess' } }),
        winChecklist: {},
      }),
    ).toBe(false);
  });

  it('accepts heard confidence for intel keys', () => {
    expect(
      winKeyFilled({
        key: 'incumbent',
        winIntel: withIntel({ incumbent: { answer: 'Agency A đã làm SEO', confidence: 'heard' } }),
        winChecklist: {},
      }),
    ).toBe(true);
  });

  it('treats champion as filled when checklist score is 3', () => {
    expect(
      winKeyFilled({
        key: 'champion',
        winIntel: emptyWinIntel(),
        winChecklist: { champion: 3 },
      }),
    ).toBe(true);
  });
});

describe('missingRequiredWinKeys', () => {
  it('returns required keys when only competitor is filled', () => {
    expect(WIN_REQUIRED_KEYS).toEqual(['incumbent', 'selection_criteria', 'switch_risk']);
    expect(
      missingRequiredWinKeys({
        winIntel: withIntel({
          competitor: { answer: 'Agency A đã làm SEO', confidence: 'confirmed' },
        }),
        winChecklist: {},
      }),
    ).toEqual(['incumbent', 'selection_criteria', 'switch_risk']);
  });
});

describe('winConsultLabel', () => {
  it('labels consult-ready totals', () => {
    expect(winGapToConsult(18)).toBe(0);
    expect(winConsultLabel(18)).toBe('Đủ đạn Tư vấn');
  });

  it('shows remaining gap below 18', () => {
    expect(winGapToConsult(15)).toBe(3);
    expect(winConsultLabel(15)).toBe('Còn 3 để thắng');
  });
});
