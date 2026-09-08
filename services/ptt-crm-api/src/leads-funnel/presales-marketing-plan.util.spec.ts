import {
  planContentFromRow,
  validatePreliminaryPlan,
} from './presales-marketing-plan.util';

const COMPLETE_STRATEGY = {
  market_message: 'Nội dung nghề + chủ xe',
  media_reach: 'TikTok, Facebook, YouTube',
  conversion_strategy: 'Form + inbox',
};

describe('validatePreliminaryPlan', () => {
  it('accepts strategy_framework_json already parsed as an object (pg JSONB)', () => {
    const out = validatePreliminaryPlan({
      name: '360 AUTO DETAILING',
      north_star: '',
      objectives: 'Tăng nhận diện',
      strategy_framework_json: COMPLETE_STRATEGY,
    });
    expect(out.ok).toBe(true);
    expect(out.messages).toEqual([]);
  });

  it('still accepts a JSON string', () => {
    const out = validatePreliminaryPlan({
      name: '360 AUTO DETAILING',
      north_star: 'NS',
      objectives: '',
      strategy_framework_json: JSON.stringify(COMPLETE_STRATEGY),
    });
    expect(out.ok).toBe(true);
  });

  it('flags missing strategy keys when JSONB is empty object', () => {
    const out = validatePreliminaryPlan({
      name: '360 AUTO DETAILING',
      north_star: '',
      objectives: 'Tăng nhận diện',
      strategy_framework_json: {},
    });
    expect(out.ok).toBe(false);
    expect(out.messages.some((m) => m.includes('market_message'))).toBe(true);
  });
});

describe('planContentFromRow', () => {
  it('reads strategy fields from a JSONB object so PATCH does not wipe them', () => {
    const content = planContentFromRow({
      name: '360 AUTO DETAILING',
      north_star: '',
      objectives: 'Tăng nhận diện',
      strategy_framework_json: COMPLETE_STRATEGY,
    });
    expect(content.strategy_framework.market_message).toBe(COMPLETE_STRATEGY.market_message);
    expect(content.strategy_framework.media_reach).toBe(COMPLETE_STRATEGY.media_reach);
    expect(content.strategy_framework.conversion_strategy).toBe(
      COMPLETE_STRATEGY.conversion_strategy,
    );
  });
});
