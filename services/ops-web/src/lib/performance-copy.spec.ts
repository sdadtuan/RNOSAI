import { describe, expect, it } from 'vitest';
import { PM_SUBTITLES, RHYTHM_CTA, SIDE_NOTE_PERFORMANCE_OS } from './performance-copy';

describe('performance-copy', () => {
  it('locks 11 PM subtitles from mockup', () => {
    expect(Object.keys(PM_SUBTITLES)).toHaveLength(11);
    expect(PM_SUBTITLES.dashboard).toBe(
      'PM-01 · Nhịp tuần agency — không phải dashboard OKR generic. Scope: PTT Growth · Tháng 09/2026',
    );
    expect(PM_SUBTITLES.registry).toBe(
      'PM-02 · Direction-aware · quality chip · Quoted Δ. Không average raw đơn vị.',
    );
    expect(PM_SUBTITLES.policy).toBe(
      'PM-11 · Effective date. Không rewrite snapshot. Impact analysis trước khi save.',
    );
  });

  it('locks rhythm CTA labels', () => {
    expect(RHYTHM_CTA.at_risk).toBe('Registry');
    expect(RHYTHM_CTA.scorecard).toBe('Duyệt');
  });

  it('locks Performance OS side note', () => {
    expect(SIDE_NOTE_PERFORMANCE_OS).toContain('Quoted/Assigned/Verified');
  });
});
