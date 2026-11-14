import { describe, expect, it } from 'vitest';
import { isAiDraftNotice, presentSolutionAiDraft, SOLUTION_AI_DRAFT_LABEL } from './solution-ai-draft-display';

describe('presentSolutionAiDraft', () => {
  it('returns a title and readable sections, skipping file payloads', () => {
    const view = presentSolutionAiDraft({
      name: 'KH MKT sơ bộ — spa',
      north_star: 'Tăng lịch hẹn',
      objectives: '40 lịch / tháng',
      strategy_framework: {
        target_market: 'Khách spa nội thành',
        market_message: 'Chăm sóc cá nhân hóa',
        mkt_files: '[{"name":"Solution Test.pdf"}]',
      },
    });
    expect(view?.title).toBe('KH MKT sơ bộ — spa');
    expect(view?.badge).toBe(SOLUTION_AI_DRAFT_LABEL);
    expect(view?.sections.map((row) => row.label)).toEqual([
      'North Star',
      'Mục tiêu chiến lược',
      'Thị trường mục tiêu',
      'Thông điệp thị trường',
    ]);
    expect(view?.sections.some((row) => row.key === 'mkt_files')).toBe(false);
  });
});

describe('isAiDraftNotice', () => {
  it('detects the old and new AI draft toasts', () => {
    expect(isAiDraftNotice('Bản nháp — SP duyệt')).toBe(true);
    expect(isAiDraftNotice(SOLUTION_AI_DRAFT_LABEL)).toBe(true);
    expect(isAiDraftNotice('Đã tải Solution Test.pdf')).toBe(false);
  });
});
