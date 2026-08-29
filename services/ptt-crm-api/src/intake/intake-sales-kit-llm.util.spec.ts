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
