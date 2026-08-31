import { describe, expect, it } from 'vitest';
import { BANT_KEYS } from './intake-bant';
import { emptyWinIntel } from './intake-win-intel';
import {
  type IntakeCompleteValidationInput,
  validateIntakeComplete,
} from './intake-validation';

const scoredBant = Object.fromEntries(BANT_KEYS.map((key) => [key, 3]));

const decisionMaker = {
  role: 'decision_maker',
  role_label: 'Decision Maker',
  name: 'CEO Minh',
  title: 'CEO',
  influence: 'high',
  notes: '',
};

function completeInput(
  overrides: Partial<IntakeCompleteValidationInput> = {},
): IntakeCompleteValidationInput {
  return {
    contactName: 'Nguyen Van A',
    need: 'Can tang lead B2B',
    bant: scoredBant,
    decision: 'go',
    decisionReason: '',
    sessionMode: 'meeting',
    discoveryChecked: {},
    discoveryResponses: {},
    discoveryTotal: 0,
    questionItems: [],
    redFlagsChecked: {},
    stakeholders: [decisionMaker],
    winIntel: emptyWinIntel(),
    winChecklist: {},
    ...overrides,
  };
}

describe('validateIntakeComplete win_thin', () => {
  it('warns win_thin once when Go and Win intel is empty', () => {
    const issues = validateIntakeComplete(completeInput({ decision: 'go' }));
    const thin = issues.filter((issue) => issue.code === 'win_thin');

    expect(thin).toEqual([
      {
        level: 'warn',
        code: 'win_thin',
        message:
          'Go nhưng Win intel / Win-score chưa đủ để chuyển Tư vấn (cần 3 mục bắt buộc + Win ≥18).',
      },
    ]);
    expect(issues.filter((issue) => issue.level === 'error')).toEqual([]);
  });

  it('does not emit win_thin when Nurture and Win intel is empty', () => {
    const issues = validateIntakeComplete(
      completeInput({ decision: 'nurture', decisionReason: 'Chua san sang ngan sach' }),
    );

    expect(issues.some((issue) => issue.code === 'win_thin')).toBe(false);
  });
});
