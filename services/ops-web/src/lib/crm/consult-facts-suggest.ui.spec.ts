import { describe, expect, it } from 'vitest';
import {
  applyConsultFactsSuggest,
  formatChannelsBrief,
  normalizeConsultGoalPicks,
  parseChannelsBrief,
  CONSULT_GOAL_STUBS,
} from '@/lib/crm/consult-facts-suggest.ui';

describe('consult facts channel brief', () => {
  it('round-trips checked channels and the close line', () => {
    const text = formatChannelsBrief(['Facebook Ads', 'SEO'], 'AE gọi xác nhận lịch trong ngày');
    expect(parseChannelsBrief(text)).toEqual({
      selected: ['Facebook Ads', 'SEO'],
      close: 'AE gọi xác nhận lịch trong ngày',
    });
  });

  it('keeps a freeform note as the close line', () => {
    expect(parseChannelsBrief('Facebook rồi gọi điện')).toEqual({
      selected: [],
      close: 'Facebook rồi gọi điện',
    });
  });
});

describe('applyConsultFactsSuggest', () => {
  const suggestion = {
    usp: 'Công ty A (Spa): tối ưu ads đúng tệp',
    goals: [
      'Tăng số lịch đặt đúng tệp — mốc [cần chốt]',
      'Giảm chi phí mỗi lịch hẹn — mốc [cần chốt]',
      'Tăng tỷ lệ khách đến sau khi để lại số — mốc [cần chốt]',
    ],
    channels: ['Facebook Ads', 'Google Ads'],
    close: 'Khách để lại số, AE gọi trong ngày.',
  };

  it('prefills an empty measurable goal from the first suggestion and keeps chips', () => {
    const out = applyConsultFactsSuggest(
      { usp: 'Đã có USP', goal: '', selected: ['Facebook Ads'], close: 'đã có' },
      suggestion,
      'fill-empty',
    );
    expect(out.usp).toBe('Đã có USP');
    expect(out.goal).toBe(suggestion.goals[0]);
    expect(out.goalPicks).toEqual(suggestion.goals);
    expect(out.selected).toEqual(['Facebook Ads']);
    expect(out.close).toBe('đã có');
  });

  it('does not overwrite a goal the user already wrote in fill-empty mode', () => {
    const out = applyConsultFactsSuggest(
      { usp: 'USP', goal: 'Giữ 40 lịch/tháng', selected: [], close: '' },
      suggestion,
      'fill-empty',
    );
    expect(out.goal).toBe('Giữ 40 lịch/tháng');
    expect(out.goalPicks).toEqual(suggestion.goals);
    expect(out.selected).toEqual(suggestion.channels);
  });

  it('replaces usp, goal, and channels when asked', () => {
    const out = applyConsultFactsSuggest(
      { usp: 'cũ', goal: 'cũ', selected: ['Zalo'], close: 'cũ' },
      suggestion,
      'replace',
    );
    expect(out.usp).toBe(suggestion.usp);
    expect(out.goal).toBe(suggestion.goals[0]);
    expect(out.selected).toEqual(suggestion.channels);
    expect(out.close).toBe(suggestion.close);
  });

  it('pads missing or empty AI goals with [cần chốt] stubs so chips still show', () => {
    expect(normalizeConsultGoalPicks([])).toEqual([...CONSULT_GOAL_STUBS]);
    expect(normalizeConsultGoalPicks(undefined)).toEqual([...CONSULT_GOAL_STUBS]);
    const out = applyConsultFactsSuggest(
      { usp: '', goal: '', selected: [], close: '' },
      { usp: 'USP mới', goals: [], channels: ['SEO'], close: 'gọi' },
      'fill-empty',
    );
    expect(out.goal).toBe(CONSULT_GOAL_STUBS[0]);
    expect(out.goal.includes('[cần chốt]')).toBe(true);
    expect(out.goalPicks).toHaveLength(3);
  });
});
