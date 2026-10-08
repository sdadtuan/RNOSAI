import { sanitizeClientPlanDraft } from './client-plan-sanitize.util';

const emptyCtx = {
  brief: {},
  sourceText: '',
  imageUrls: [] as string[],
  humanEdited: {},
};

describe('sanitizeClientPlanDraft', () => {
  it('replaces money that is not in the brief', () => {
    const stripped = sanitizeClientPlanDraft(
      { objectives: 'Ngân sách 50.000.000 mỗi tháng' },
      emptyCtx,
    );
    expect(stripped.objectives).toBe('Ngân sách [cần chốt] mỗi tháng');

    const kept = sanitizeClientPlanDraft(
      { objectives: 'Ngân sách 50.000.000 mỗi tháng' },
      { ...emptyCtx, brief: { goal: 'ngân sách 50.000.000' } },
    );
    expect(kept.objectives).toBe('Ngân sách 50.000.000 mỗi tháng');
  });

  it('replaces a follower count missing from the fetched page', () => {
    const stripped = sanitizeClientPlanDraft(
      { media_reach: 'Fanpage 12000 follower' },
      { ...emptyCtx, sourceText: 'Studio chụp ảnh cưới' },
    );
    expect(stripped.media_reach).toBe('Fanpage [cần xác nhận]');

    const kept = sanitizeClientPlanDraft(
      { media_reach: 'Fanpage 12000 follower' },
      { ...emptyCtx, sourceText: 'Fanpage đang có 12000 follower' },
    );
    expect(kept.media_reach).toBe('Fanpage 12000 follower');
  });

  it('drops a cover image that was not fetched', () => {
    const stripped = sanitizeClientPlanDraft(
      { cover_image_url: 'https://stock.example/a.jpg' },
      { ...emptyCtx, imageUrls: ['https://cdn.example/a.jpg'] },
    );
    expect(stripped.cover_image_url).toBeNull();

    const kept = sanitizeClientPlanDraft(
      { cover_image_url: 'https://cdn.example/a.jpg' },
      { ...emptyCtx, imageUrls: ['https://cdn.example/a.jpg'] },
    );
    expect(kept.cover_image_url).toBe('https://cdn.example/a.jpg');
  });

  it('keeps a human-edited market message', () => {
    const out = sanitizeClientPlanDraft(
      { market_message: 'AI viết khác' },
      { ...emptyCtx, humanEdited: { market_message: 'Thông điệp đã sửa' } },
    );
    expect(out.market_message).toBe('Thông điệp đã sửa');
  });

  it('drops competitor names that are not on the page', () => {
    const stripped = sanitizeClientPlanDraft(
      { competitors: 'Studio B' },
      { ...emptyCtx, sourceText: 'ảnh cưới' },
    );
    expect(stripped.competitors).toBe('[cần xác nhận]');

    const fromPage = sanitizeClientPlanDraft(
      { competitors: 'Studio B' },
      { ...emptyCtx, sourceText: 'đối thủ Studio B' },
    );
    expect(fromPage.competitors).toBe('Studio B');

    const fromBrief = sanitizeClientPlanDraft(
      { competitors: 'Studio C' },
      { ...emptyCtx, brief: { competitors: 'Studio B' }, sourceText: 'ảnh cưới' },
    );
    expect(fromBrief.competitors).toBe('Studio B');
  });
});
