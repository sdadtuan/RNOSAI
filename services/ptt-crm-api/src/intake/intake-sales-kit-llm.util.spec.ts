import {
  assertNoInventedMoney,
  buildKitLlmSystemPrompt,
  stripInventedMoney,
} from './intake-sales-kit-llm.util';

describe('intake-sales-kit-llm.util', () => {
  it('blocks money without pricing/qa citation', () => {
    expect(assertNoInventedMoney('Gói 20 triệu', [])).toBe(false);
    expect(assertNoInventedMoney('Gói 20 triệu', [{ kind: 'pricing' }])).toBe(true);
    expect(assertNoInventedMoney('Gói 20 triệu', [{ kind: 'qa' }])).toBe(true);
    expect(assertNoInventedMoney('Hỏi ngân sách tháng', [])).toBe(true);
  });

  it('allows money when case citation present', () => {
    expect(assertNoInventedMoney('Gói 20 triệu', [{ kind: 'case' }])).toBe(true);
  });

  it('stripInventedMoney removes numeric price phrases', () => {
    expect(stripInventedMoney('Gói 20 triệu/tháng')).not.toMatch(/20\s*triệu/i);
    expect(stripInventedMoney('Gói 20 triệu/tháng')).toMatch(/số đã ẩn/);
  });

  it('does not treat BANT scores or ordinary Vietnamese counts as money', () => {
    expect(assertNoInventedMoney('Còn 24 điểm để Go. Ưu tiên hỏi ngân sách.', [])).toBe(true);
    expect(stripInventedMoney('Còn 24 điểm để Go')).toBe('Còn 24 điểm để Go');
    expect(stripInventedMoney('Xem 5 trang tài liệu')).toBe('Xem 5 trang tài liệu');
    expect(stripInventedMoney('Khách có 2 đơn hàng cũ')).toBe('Khách có 2 đơn hàng cũ');
  });

  it('catches tỷ and k units', () => {
    expect(assertNoInventedMoney('Ngân sách 2 tỷ có phù hợp?', [])).toBe(false);
    expect(assertNoInventedMoney('20k/tháng', [])).toBe(false);
    expect(stripInventedMoney('Ngân sách 2 tỷ')).toMatch(/số đã ẩn/);
  });

  it('buildKitLlmSystemPrompt includes safety rules', () => {
    const prompt = buildKitLlmSystemPrompt();
    expect(prompt).toMatch(/bịa/i);
    expect(prompt).toMatch(/KPI|case/i);
    expect(prompt).toMatch(/một ý|1 ý/i);
    expect(prompt).toMatch(/outbound/i);
    expect(prompt).toMatch(/SĐT|số điện thoại/i);
    expect(prompt).toMatch(/excerpt|citation/i);
  });
});
