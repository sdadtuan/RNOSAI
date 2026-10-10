import { normalizeConsultFactsSuggest } from './consult-facts-suggest.util';

const input = {
  company: 'A Nhàn Spa Tĩnh Viên',
  niche: 'Spa & Beauty',
  need: 'khách đã từng chạy ads nhưng chưa biết cách tối ưu chi phí và đánh vào đúng tệp khách hàng mong muốn',
  serviceLabel: 'SEO tổng thể',
};

describe('normalizeConsultFactsSuggest', () => {
  it('keeps allowed channels and replaces invented money', () => {
    const out = normalizeConsultFactsSuggest(
      {
        usp: 'Spa có liệu trình riêng, ngân sách 50 triệu/tháng',
        goals: ['40 lịch/tháng', 'Giảm CPL xuống 80.000đ'],
        channels: ['facebook ads', 'SEO', 'Email'],
        close: 'Chốt gói 15 triệu',
      },
      input,
    );
    expect(out.usp).toContain('[cần chốt]');
    expect(out.usp).not.toContain('50');
    expect(out.goals[0]).toBe('[cần chốt] lịch/tháng');
    expect(out.goals.some((goal) => goal.includes('80'))).toBe(false);
    expect(out.channels).toEqual(['Facebook Ads', 'SEO']);
    expect(out.close).not.toContain('15');
  });

  it('falls back to ads channels from the need when the model list is empty', () => {
    const out = normalizeConsultFactsSuggest({}, input);
    expect(out.usp).toContain('A Nhàn Spa Tĩnh Viên');
    expect(out.goals).toHaveLength(3);
    expect(out.channels).toEqual(expect.arrayContaining(['Facebook Ads', 'Google Ads']));
    expect(out.close).toContain('số điện thoại');
  });

  it('keeps a number that sales already wrote', () => {
    const out = normalizeConsultFactsSuggest(
      { usp: 'Giữ ngân sách 20 triệu sales đã ghi', goals: [], channels: ['Zalo'], close: '' },
      { ...input, budget: '20 triệu' },
    );
    expect(out.usp).toContain('20');
    expect(out.channels).toEqual(['Zalo']);
  });
});
