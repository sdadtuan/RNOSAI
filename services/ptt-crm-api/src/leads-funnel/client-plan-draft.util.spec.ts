import { emptyClientBrief } from './client-plan-brief.util';
import {
  buildClientPlanDraftCall,
  mergeClientPlanModelDraft,
  selectClientPlanModel,
} from './client-plan-draft.util';

const brief = {
  ...emptyClientBrief(),
  usp: 'Concept riêng',
  goal: '40 lịch mỗi tháng',
  channels: 'Facebook, gọi xác nhận',
};

describe('selectClientPlanModel', () => {
  it('uses the vision model when a public page exists', () => {
    expect(
      selectClientPlanModel({
        hasPublicSource: true,
        mktAiModel: 'gpt-4o',
        llmModel: 'gpt-4o-mini',
      }),
    ).toEqual({ model: 'gpt-4o', vision: true });
  });

  it('uses gpt-4o-mini without vision when there is no page and no OPENAI_MODEL', () => {
    expect(
      selectClientPlanModel({
        hasPublicSource: false,
        mktAiModel: 'gpt-4o',
        llmModel: 'gpt-4.1',
      }),
    ).toEqual({ model: 'gpt-4o-mini', vision: false });
  });

  it('uses OPENAI_MODEL from env when PTT_MKT_AI_MODEL is empty', () => {
    expect(
      selectClientPlanModel({
        hasPublicSource: true,
        mktAiModel: '',
        openAiModel: 'gpt-6-astra',
        llmModel: 'gpt-4o-mini',
      }),
    ).toEqual({ model: 'gpt-6-astra', vision: false });
    expect(
      selectClientPlanModel({
        hasPublicSource: false,
        openAiModel: 'gpt-6-astra',
      }),
    ).toEqual({ model: 'gpt-6-astra', vision: false });
  });
});

describe('buildClientPlanDraftCall', () => {
  it('presets market, competitors and cover before the model when there is no page', () => {
    const built = buildClientPlanDraftCall({
      brief,
      lead: { company_name: 'Quý Nguyễn Studio', niche: 'Ảnh cưới', need: 'ít lịch' },
      serviceLabel: 'SEO',
      sourceText: '',
      imageUrls: [],
      humanEdited: {},
      hasPublicSource: false,
    });
    expect(built.locked.target_market).toBe('[cần xác nhận]');
    expect(built.locked.competitors).toBe('[cần xác nhận]');
    expect(built.locked.cover_image_url).toBeNull();
    expect(built.schemaKeys).not.toContain('target_market');
    expect(built.schemaKeys).not.toContain('competitors');
    expect(built.schemaKeys).not.toContain('cover_image_url');
    expect(built.systemPrompt).toMatch(/JSON/);
    expect(built.userContent).toMatch(/Không có website hoặc fanpage/);

    const merged = mergeClientPlanModelDraft(
      {
        target_market: 'nhóm bịa',
        competitors: 'Studio Z',
        cover_image_url: 'https://stock.example/a.jpg',
        north_star: '40 lịch mỗi tháng',
      },
      built,
    );
    expect(merged.target_market).toBe('[cần xác nhận]');
    expect(merged.competitors).toBe('[cần xác nhận]');
    expect(merged.cover_image_url).toBeNull();
  });

  it('keeps the fanpage link when the page text was not fetched', () => {
    const built = buildClientPlanDraftCall({
      brief: { ...brief, fanpage: 'https://www.facebook.com/massagetinhvien' },
      lead: { company_name: 'A Nhàn Spa', niche: 'Spa', need: 'đúng tệp' },
      serviceLabel: 'Tiếp thị nội dung',
      sourceText: '',
      imageUrls: [],
      humanEdited: {},
      hasPublicSource: true,
    });
    expect(built.userContent).toContain('https://www.facebook.com/massagetinhvien');
    expect(built.userContent).not.toContain('Không có website hoặc fanpage');
  });

  it('lets the model fill market, competitors and cover when a page was fetched', () => {
    const built = buildClientPlanDraftCall({
      brief,
      lead: { company_name: 'Quý Nguyễn Studio', niche: 'Ảnh cưới', need: 'ít lịch' },
      serviceLabel: 'SEO',
      sourceText: 'đối thủ Studio B',
      imageUrls: ['https://cdn.example/a.jpg'],
      humanEdited: { market_message: 'Thông điệp đã sửa' },
      hasPublicSource: true,
    });
    expect(built.schemaKeys).toEqual(expect.arrayContaining(['target_market', 'competitors', 'cover_image_url']));
    expect(built.schemaKeys).not.toContain('market_message');

    const merged = mergeClientPlanModelDraft(
      {
        target_market: 'cô dâu',
        competitors: 'Studio B',
        cover_image_url: 'https://cdn.example/a.jpg',
        market_message: 'AI viết khác',
        north_star: '40 lịch mỗi tháng',
      },
      built,
    );
    expect(merged.target_market).toBe('cô dâu');
    expect(merged.competitors).toBe('Studio B');
    expect(merged.cover_image_url).toBe('https://cdn.example/a.jpg');
    expect(merged.market_message).toBe('Thông điệp đã sửa');
  });
});
