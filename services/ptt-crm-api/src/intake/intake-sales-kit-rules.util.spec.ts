import { runSalesKitRules } from './intake-sales-kit-rules.util';

const base = {
  bant: { budget: 0, authority: 0, need: 0, timeline: 0, fit: 0, history: 0 },
  discoveryAnswers: {},
  criticalKeys: ['phone_pain_point', 'phone_budget', 'phone_decision_maker'],
  qualifyItems: [{ key: 'domain', text: 'Website domain' }],
  serviceSlug: 'dich-vu-seo-tong-the',
  isPilot: true,
};

describe('runSalesKitRules', () => {
  it('gap_to_go lists all empty when total 0', () => {
    const out = runSalesKitRules({ ...base, intent: 'gap_to_go' });
    expect(out.gap.total).toBe(0);
    expect(out.gap.to_go).toBe(24);
    expect(out.gap.weakest).toEqual(['budget', 'authority', 'need', 'timeline', 'fit', 'history']);
    expect(out.apply.bant_hints).toBeUndefined();
    expect(out.reply_vi).toMatch(/Budget|ngân sách/i);
  });

  it('next_question returns first critical without answer', () => {
    const out = runSalesKitRules({ ...base, intent: 'next_question' });
    expect(out.next_question?.key).toBe('phone_pain_point');
    expect(out.next_question?.tab).toBe('discovery');
  });

  it('service_dive tells non-pilot to use common form', () => {
    const out = runSalesKitRules({
      ...base,
      intent: 'service_dive',
      serviceSlug: 'dich-vu-aeo',
      isPilot: false,
    });
    expect(out.reply_vi).toMatch(/Chưa có playbook/);
  });

  it('ask_library without chunks stays empty-state', () => {
    const out = runSalesKitRules({ ...base, intent: 'ask_library', message: 'đắt' });
    expect(out.citations).toEqual([]);
    expect(out.reply_vi).toMatch(/Chưa có file|kho/i);
  });

  it('summary text never contains [stub]', () => {
    const out = runSalesKitRules({ ...base, intent: 'summary_30s' });
    expect(out.reply_vi.includes('[stub]')).toBe(false);
  });
});
