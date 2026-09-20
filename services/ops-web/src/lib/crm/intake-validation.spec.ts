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
    serviceSlug: 'dich-vu-seo-tong-the',
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
  });

  it('does not emit win_thin when Nurture and Win intel is empty', () => {
    const issues = validateIntakeComplete(
      completeInput({ decision: 'nurture', decisionReason: 'Chua san sang ngan sach' }),
    );

    expect(issues.some((issue) => issue.code === 'win_thin')).toBe(false);
  });
});

describe('validateIntakeComplete hard-block required fields', () => {
  it('errors when service is still _common', () => {
    const issues = validateIntakeComplete(completeInput({ serviceSlug: '_common' }));
    expect(issues.find((i) => i.code === 'service_unselected')).toEqual({
      level: 'error',
      code: 'service_unselected',
      message: 'Chọn dịch vụ trước khi hoàn thành phiên (không để «Chưa chọn dịch vụ»).',
    });
  });

  it('errors when Need / Pain is empty', () => {
    const issues = validateIntakeComplete(completeInput({ need: '' }));
    expect(issues.find((i) => i.code === 'need_empty')?.level).toBe('error');
  });

  it('errors when critical discovery answers are missing', () => {
    const issues = validateIntakeComplete(
      completeInput({
        questionItems: [
          { key: 'phone_web', text: 'Website?', critical: true },
          { key: 'phone_goal', text: 'Mục tiêu?', critical: true },
        ],
        discoveryChecked: { phone_web: true },
        discoveryResponses: { phone_web: { asked: true, answer: 'example.com', confidence: '' } },
      }),
    );
    expect(issues.find((i) => i.code === 'critical_answers_missing')?.level).toBe('error');
    expect(issues.find((i) => i.code === 'critical_answers_missing')?.message).toMatch(/1\/2/);
  });

  it('errors when Go without Decision Maker name', () => {
    const issues = validateIntakeComplete(
      completeInput({
        stakeholders: [
          {
            role: 'decision_maker',
            role_label: 'Decision Maker',
            name: '',
            title: '',
            influence: '',
            notes: '',
          },
        ],
      }),
    );
    expect(issues.find((i) => i.code === 'stakeholder_dm_missing')?.level).toBe('error');
  });

  it('does not error DM when Nurture', () => {
    const issues = validateIntakeComplete(
      completeInput({
        decision: 'nurture',
        decisionReason: 'Chưa sẵn',
        stakeholders: [
          {
            role: 'decision_maker',
            role_label: 'Decision Maker',
            name: '',
            title: '',
            influence: '',
            notes: '',
          },
        ],
      }),
    );
    expect(issues.some((i) => i.code === 'stakeholder_dm_missing')).toBe(false);
  });
});
