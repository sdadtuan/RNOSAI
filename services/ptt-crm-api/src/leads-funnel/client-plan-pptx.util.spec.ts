import { buildClientPlanDeck } from './client-plan-deck.util';
import { convertClientPlanPdf, LIBREOFFICE_MISSING_NOTE, renderClientPlanPptx } from './client-plan-pptx.util';

const deck = buildClientPlanDeck(
  {
    name: 'KH',
    north_star: 'Tăng lịch chụp',
    objectives: 'Đủ lịch',
    strategy_framework: {
      market_message: 'Concept riêng',
      media_reach: 'Facebook',
      conversion_strategy: 'gọi',
      lifecycle_extension: '[cần xác nhận]',
    },
    cover_image_url: null,
  },
  { channels: 'Facebook', budget: '' },
  { company_name: 'Quý Nguyễn Studio' },
);

describe('renderClientPlanPptx', () => {
  it('writes a pptx with at least 16 slides and no cover image', async () => {
    const buf = await renderClientPlanPptx(deck);
    expect(buf.subarray(0, 2).toString()).toBe('PK');
    const names = buf.toString('latin1').match(/ppt\/slides\/slide\d+\.xml/g) ?? [];
    expect(new Set(names).size).toBeGreaterThanOrEqual(16);
    expect(buf.toString('latin1')).not.toMatch(/ppt\/media\/image\d+/);
  });
});

describe('convertClientPlanPdf', () => {
  it('keeps the pptx when LibreOffice is absent', async () => {
    const buf = Buffer.from('PK');
    const out = await convertClientPlanPdf(buf, 'PTT_QuyNguyenStudio_Plan_GuiKhach.pptx', null);
    expect(out.pdf).toBeNull();
    expect(out.note).toBe(LIBREOFFICE_MISSING_NOTE);
  });
});
