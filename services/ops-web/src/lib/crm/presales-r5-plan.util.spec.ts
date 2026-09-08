import { describe, expect, it } from 'vitest';
import {
  hydratePresalesR5Form,
  parsePresalesJsonRecord,
  shouldHydratePresalesMarketingPlan,
} from './presales-r5-plan.util';

const STRATEGY = {
  target_market: 'Chủ xe',
  market_message: 'Nội dung nghề',
  media_reach: 'TikTok, Facebook',
  conversion_strategy: 'Form + inbox',
};

describe('parsePresalesJsonRecord', () => {
  it('keeps a JSONB object instead of String(object) → [object Object]', () => {
    expect(parsePresalesJsonRecord(STRATEGY)).toEqual(STRATEGY);
  });

  it('parses a JSON string', () => {
    expect(parsePresalesJsonRecord(JSON.stringify(STRATEGY))).toEqual(STRATEGY);
  });

  it('returns {} for null or invalid', () => {
    expect(parsePresalesJsonRecord(null)).toEqual({});
    expect(parsePresalesJsonRecord('[object Object]')).toEqual({});
  });
});

describe('hydratePresalesR5Form', () => {
  it('hydrates name, objectives and strategy from a GET plan row', () => {
    const form = hydratePresalesR5Form({
      name: '360 AUTO DETAILING',
      north_star: '',
      objectives: 'Tăng nhận diện thương hiệu',
      strategy_framework_json: STRATEGY,
    });
    expect(form.planName).toBe('360 AUTO DETAILING');
    expect(form.planObjectives).toContain('Tăng nhận diện');
    expect(form.planStrategy.market_message).toBe('Nội dung nghề');
    expect(form.planStrategy.media_reach).toBe('TikTok, Facebook');
  });

  it('also reads strategy_framework when API already decoded the object', () => {
    const form = hydratePresalesR5Form({
      name: 'Plan',
      strategy_framework: { market_message: 'from decoded key' },
    });
    expect(form.planStrategy.market_message).toBe('from decoded key');
  });
});

describe('shouldHydratePresalesMarketingPlan', () => {
  it('loads R5 even when funnel fetch is skipped (Consult → Tổng quan remount)', () => {
    expect(
      shouldHydratePresalesMarketingPlan({
        fetchOnMount: false,
        hasSyncFunnel: true,
        stage: 'consult',
      }),
    ).toBe(true);
    expect(
      shouldHydratePresalesMarketingPlan({
        fetchOnMount: false,
        hasSyncFunnel: true,
        stage: 'proposal',
      }),
    ).toBe(true);
  });

  it('does not load R5 before consult', () => {
    expect(
      shouldHydratePresalesMarketingPlan({
        fetchOnMount: false,
        hasSyncFunnel: true,
        stage: 'lead',
      }),
    ).toBe(false);
  });
});
