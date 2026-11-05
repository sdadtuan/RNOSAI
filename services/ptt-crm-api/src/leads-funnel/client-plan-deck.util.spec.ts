import { buildClientPlanDeck, clientPlanExportFilename } from './client-plan-deck.util';

const plan = {
  name: 'KH MKT sơ bộ — Quý Nguyễn Studio',
  north_star: 'Tăng lịch chụp',
  objectives: 'Đủ lịch mỗi tháng',
  strategy_framework: {
    target_market: 'cô dâu',
    market_message: 'Concept riêng',
    media_reach: 'Facebook',
    conversion_strategy: 'gọi xác nhận',
    retention_system: 'nhắc lịch',
    nurture_system: 'gọi lại form',
    world_class_experience: 'xem album trước',
    lifecycle_extension: '[cần xác nhận]',
    referral_engine: 'giới thiệu bạn bè',
  },
  cover_image_url: null as string | null,
};

const brief = {
  audience: '',
  usp: 'Concept riêng',
  goal: 'Tăng lịch chụp',
  channels: 'Facebook, gọi xác nhận',
  retain: '',
  competitors: '',
  metrics: '',
  website: '',
  fanpage: '',
  budget: '',
};

const lead = {
  company_name: 'Quý Nguyễn Studio',
  service_label: 'SEO',
  niche: 'Ảnh cưới',
  need: 'ít lịch',
  phone: '0900000000',
  email: 'studio@example.com',
  address: 'Q1',
};

describe('buildClientPlanDeck', () => {
  const deck = buildClientPlanDeck(plan, brief, lead);

  it('prints unset budget as a token and the director line', () => {
    const slide = deck.slides.find((item) => item.id === 'VIII');
    const text = slide?.body.join('\n') ?? '';
    expect(text).toContain('[cần chốt]');
    expect(text).toContain('Giám đốc PTT chốt');
    expect(text).not.toMatch(/\d/);
  });

  it('keeps a placeholder lifecycle as the only line on slide 05', () => {
    const slide = deck.slides.find((item) => item.id === '05');
    expect(slide?.body).toEqual(['[cần xác nhận]']);
  });

  it('derives the 90-day slide from earlier chapters and numbers the footer', () => {
    const slide = deck.slides.find((item) => item.id === 'VII');
    const text = slide?.body.join('\n') ?? '';
    expect(text).toContain('30 ngày');
    expect(text).toContain('60 ngày');
    expect(text).toContain('90 ngày');
    expect(text).not.toContain('[cần xác nhận]');
    expect(deck.slides[0]?.footer).toBe('PTT Advertising · Quý Nguyễn Studio · 1');
    expect(deck.slides[0]?.title).toBe('Kế hoạch tiếp thị tích hợp');
    expect(deck.slides[0]?.imageUrl).toBeNull();
    expect(deck.slides.length).toBeGreaterThanOrEqual(16);
  });
});

describe('clientPlanExportFilename', () => {
  it('slugs the client name', () => {
    expect(clientPlanExportFilename('Quý Nguyễn Studio')).toBe('PTT_QuyNguyenStudio_KeHoachMarketing.pptx');
  });
});
