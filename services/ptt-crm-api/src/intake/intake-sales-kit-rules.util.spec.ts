import {
  buildRulesInputFromSession,
  runSalesKitRules,
} from './intake-sales-kit-rules.util';

const base = {
  bant: { budget: 0, authority: 0, need: 0, timeline: 0, fit: 0, history: 0 },
  discoveryAnswers: {},
  criticalKeys: ['phone_pain_point', 'phone_budget', 'phone_decision_maker'],
  qualifyItems: [{ key: 'domain', text: 'Website domain' }],
  questionItems: [{ key: 'phone_pain_point', text: 'Pain #1 (traffic / lead / rank / brand)?' }],
  qualifyChecked: {} as Record<string, boolean>,
  winIntel: {} as Record<string, string>,
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
    expect(out.next_question?.text).toBe('Pain #1 (traffic / lead / rank / brand)?');
    expect(out.reply_vi).toContain('Pain #1');
    expect(out.reply_vi).not.toMatch(/: phone_pain_point$/);
  });

  it('service_dive skips qualify items already checked', () => {
    const out = runSalesKitRules({
      ...base,
      intent: 'service_dive',
      qualifyItems: [
        { key: 'nganh', text: 'ngành' },
        { key: 'domain', text: 'website domain' },
      ],
      qualifyChecked: { nganh: true },
    });
    expect(out.reply_vi).toContain('website domain');
    expect(out.reply_vi).not.toContain('ngành');
    expect(out.next_question?.key).toBe('domain');
  });

  it('win_intel lists only empty fields', () => {
    const out = runSalesKitRules({
      ...base,
      intent: 'win_intel',
      winIntel: { incumbent: 'Agency A' },
    });
    expect(out.reply_vi).toMatch(/competitor|selection_criteria|switch_risk/);
    expect(out.reply_vi).not.toMatch(/incumbent/);
    expect(out.next_question?.key).toBe('competitor');
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

describe('buildRulesInputFromSession', () => {
  it('maps critical key to phone question text', () => {
    const input = buildRulesInputFromSession({
      intent: 'next_question',
      session: {
        service_slug: 'dich-vu-seo-tong-the',
        mode: 'phone',
        bant_json: {},
        answers_json: {},
      },
    });
    expect(input.questionItems.find((q) => q.key === 'phone_pain_point')?.text).toMatch(/Pain/i);
    expect(input.criticalKeys).toContain('seo_domain');
  });

  it('honors serviceSlug override over session _common', () => {
    const input = buildRulesInputFromSession({
      intent: 'next_question',
      serviceSlug: 'dich-vu-seo-tong-the',
      session: {
        service_slug: '_common',
        mode: 'phone',
        bant_json: {},
        answers_json: {},
      },
    });
    expect(input.serviceSlug).toBe('dich-vu-seo-tong-the');
    expect(input.isPilot).toBe(true);
    expect(input.criticalKeys).toContain('seo_domain');
  });

  it('reads qualify_checked and win_intel from answers_json', () => {
    const input = buildRulesInputFromSession({
      intent: 'service_dive',
      session: {
        service_slug: 'dich-vu-seo-tong-the',
        mode: 'phone',
        bant_json: {},
        answers_json: {
          qualify_checked: { nganh: true },
          win_intel: { incumbent: { answer: 'Agency A', confidence: 'heard' } },
        },
      },
    });
    expect(input.qualifyChecked.nganh).toBe(true);
    expect(input.winIntel.incumbent).toBe('Agency A');
  });
});
